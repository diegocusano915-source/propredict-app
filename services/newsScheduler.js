/**
 * ProPredict News Scheduler
 * Runs 3-4 times per week, scanning real matches and generating AI articles
 * 
 * Schedule:
 *   - Monday:    Weekly digest (weekend results review)
 *   - Wednesday: Match previews (upcoming midweek fixtures)
 *   - Friday:    Weekend preview + league roundups
 *   - Sunday:    Weekend results roundup
 *
 * Can also be triggered manually via API: POST /news/generate
 */

const cron = require('node-cron');
const {
  scanWeeklyMatches,
  selectNewsMatches,
  enrichMatchData,
  getLeagueContext,
  LEAGUES,
  formatDatePretty
} = require('./newsDataService');
const {
  generateMatchPreview,
  generateWeeklyRoundup,
  generateMultiLeagueDigest,
  generateSummary,
  estimateReadTime,
  generateSlug
} = require('./newsContentGenerator');
const {
  addArticle,
  loadMeta,
  saveMeta,
  loadArticles
} = require('./newsStorage');

let isRunning = false;

/**
 * Main article generation pipeline
 */
async function generateNews() {
  if (isRunning) {
    console.log('⏳ News generation already in progress, skipping...');
    return { status: 'skipped', reason: 'already_running' };
  }
  isRunning = true;

  const startTime = Date.now();
  const runReport = {
    timestamp: new Date().toISOString(),
    articlesGenerated: 0,
    apiCallsUsed: 0,
    leaguesScanned: 0,
    matchesFound: 0,
    errors: []
  };

  try {
    console.log('\n\U0001f4f0 ========== NEWS GENERATION STARTED ==========');
    console.log(`Time: ${new Date().toISOString()}`);

    // Step 1: Scan all leagues for this week's matches
    console.log('\n\u2699\ufe0f Step 1: Scanning matches across all leagues...');
    const weeklyData = await scanWeeklyMatches();
    runReport.leaguesScanned = weeklyData.results.length;
    runReport.matchesFound = weeklyData.results.reduce((s, r) => s + r.matchCount, 0);
    runReport.apiCallsUsed += weeklyData.apiCalls;

    if (weeklyData.results.length === 0) {
      console.log('\u26a0\ufe0f No matches found this week. Skipping article generation.');
      runReport.errors.push('No matches found in scan period');
      return { status: 'no_matches', report: runReport };
    }

    // Step 2: Select the most newsworthy matches
    console.log('\n\u2699\ufe0f Step 2: Selecting newsworthy matches...');
    const selectedMatches = selectNewsMatches(weeklyData);
    console.log(`  Selected ${selectedMatches.length} matches for articles`);

    // Step 3: Enrich selected matches with H2H data
    console.log('\n\u2699\ufe0f Step 3: Enriching match data (H2H)...');
    const enrichedMatches = await enrichMatchData(selectedMatches);
    runReport.apiCallsUsed += enrichedMatches.length;

    // Step 4: Get league context for each league we're covering
    console.log('\n\u2699\ufe0f Step 4: Fetching league standings & top scorers...');
    const leagueContexts = new Map();
    const leaguesToCover = new Set(enrichedMatches.map(m => m.league.code || m.league.id));
    
    for (const leagueCode of leaguesToCover) {
      const league = LEAGUES.find(l => l.code === leagueCode);
      if (league) {
        try {
          const context = await getLeagueContext(league.code);
          leagueContexts.set(leagueCode, context);
          runReport.apiCallsUsed += 2; // standings + scorers
        } catch (err) {
          console.error(`  Failed to get context for ${league.name}: ${err.message}`);
          leagueContexts.set(leagueCode, { standings: [], topScorers: [] });
        }
      }
    }

    // Step 5: Determine article types based on day of week
    console.log('\n\u2699\ufe0f Step 5: Generating articles...');
    const dayOfWeek = new Date().getDay();
    const existingArticles = loadArticles();
    const existingSlugs = new Set(existingArticles.map(a => a.slug));

    // --- ARTICLE TYPE 1: Multi-League Digest ---
    // Generated on Monday (weekend review) and Sunday (weekend results)
    if (dayOfWeek === 1 || dayOfWeek === 0) {
      console.log('  \U0001f4ca Generating multi-league digest...');
      try {
        const leagueSummaries = weeklyData.results
          .filter(r => r.matchCount > 0)
          .slice(0, 8)
          .map(r => ({
            league: r.league,
            fixtures: r.fixtures,
            standings: leagueContexts.get(r.league.code)?.standings || []
          }));

        const digestContent = await generateMultiLeagueDigest(leagueSummaries);
        const digestSlug = generateSlug(`Weekly Football Digest - ${formatDatePretty(new Date().toISOString())}`);
        
        if (!existingSlugs.has(digestSlug)) {
          const article = {
            slug: digestSlug,
            title: `Weekend Football Digest: Results & Standings Across Europe's Top Leagues`,
            category: 'Weekly Digest',
            date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
            readTime: estimateReadTime(digestContent),
            summary: generateSummary(digestContent),
            content: digestContent,
            leagues: weeklyData.results.filter(r => r.matchCount > 0).map(r => r.league),
            tags: ['digest', 'weekly', 'results', ...weeklyData.results.slice(0, 5).map(r => r.league.name.toLowerCase().replace(/\s+/g, '-'))],
            generatedAt: new Date().toISOString(),
            type: 'digest',
            views: 0
          };
          addArticle(article);
          runReport.articlesGenerated++;
          console.log('  \u2705 Digest article created');
        }
      } catch (err) {
        console.error('  \u274c Digest generation failed:', err.message);
        runReport.errors.push(`Digest: ${err.message}`);
      }
    }

    // --- ARTICLE TYPE 2: Individual Match Previews (2-3 PL + others) ---
    // Generated on Wednesday and Friday
    if (dayOfWeek === 3 || dayOfWeek === 5) {
      const previewMatches = enrichedMatches
        .filter(m => ['NS', '1H', 'HT', '2H'].includes(m.status))
        .slice(0, 6);

      for (const match of previewMatches) {
        console.log(`  \U0001f3ae Generating preview: ${match.homeTeam.name} vs ${match.awayTeam.name}`);
        try {
          const standings = leagueContexts.get(match.league.code)?.standings || [];
          const h2h = match.headToHead || [];
          const content = await generateMatchPreview(match, standings, h2h);
          const slug = generateSlug(`${match.homeTeam.name} vs ${match.awayTeam.name} Preview`);

          if (!existingSlugs.has(slug)) {
            const article = {
              slug,
              title: `${match.homeTeam.name} vs ${match.awayTeam.name}: Match Preview — ${match.league.name}`,
              category: 'Match Preview',
              date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
              readTime: estimateReadTime(content),
              summary: generateSummary(content),
              content,
              league: match.league,
              matchData: {
                homeTeam: match.homeTeam,
                awayTeam: match.awayTeam,
                date: match.date,
                round: match.league.round
              },
              tags: ['preview', match.league.name.toLowerCase().replace(/\s+/g, '-'), 
                     match.homeTeam.name.toLowerCase().replace(/\s+/g, '-'),
                     match.awayTeam.name.toLowerCase().replace(/\s+/g, '-')],
              generatedAt: new Date().toISOString(),
              type: 'preview',
              views: 0
            };
            addArticle(article);
            runReport.articlesGenerated++;
            console.log(`    \u2705 Preview article created: ${match.homeTeam.name} vs ${match.awayTeam.name}`);
          }
        } catch (err) {
          console.error(`    \u274c Preview failed: ${err.message}`);
          runReport.errors.push(`Preview ${match.homeTeam.name} vs ${match.awayTeam.name}: ${err.message}`);
        }
      }
    }

    // --- ARTICLE TYPE 3: League Roundup (one per major league) ---
    // Generated on Monday (reviewing weekend) and Friday (previewing weekend)
    if (dayOfWeek === 1 || dayOfWeek === 5) {
      const leaguesWithMatches = weeklyData.results
        .filter(r => r.matchCount >= 3)
        .sort((a, b) => a.league.priority - b.league.priority)
        .slice(0, 4);

      for (const leagueData of leaguesWithMatches) {
        console.log(`  \U0001f4c8 Generating roundup for ${leagueData.league.name}...`);
        try {
          const context = leagueContexts.get(leagueData.league.code) || { standings: [], topScorers: [] };
          const content = await generateWeeklyRoundup(
            leagueData.league,
            leagueData.fixtures,
            context.standings,
            context.topScorers
          );
          const slug = generateSlug(`${leagueData.league.name} Roundup ${formatDatePretty(new Date().toISOString())}`);

          if (!existingSlugs.has(slug)) {
            const article = {
              slug,
              title: `${leagueData.league.name} Roundup: Results, Standings & Key Storylines`,
              category: 'League Roundup',
              date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
              readTime: estimateReadTime(content),
              summary: generateSummary(content),
              content,
              league: leagueData.league,
              tags: ['roundup', leagueData.league.name.toLowerCase().replace(/\s+/g, '-'), 'standings'],
              generatedAt: new Date().toISOString(),
              type: 'roundup',
              views: 0
            };
            addArticle(article);
            runReport.articlesGenerated++;
            console.log(`    \u2705 Roundup article created: ${leagueData.league.name}`);
          }
        } catch (err) {
          console.error(`    \u274c Roundup failed for ${leagueData.league.name}: ${err.message}`);
          runReport.errors.push(`Roundup ${leagueData.league.name}: ${err.message}`);
        }
      }
    }

    // Update metadata
    const meta = loadMeta();
    meta.lastRun = new Date().toISOString();
    meta.lastArticleCount = runReport.articlesGenerated;
    meta.lastLeaguesScanned = runReport.leaguesScanned;
    meta.lastMatchesFound = runReport.matchesFound;
    meta.totalArticlesGenerated = (meta.totalArticlesGenerated || 0) + runReport.articlesGenerated;
    meta.totalApiCallsUsed = (meta.totalApiCallsUsed || 0) + runReport.apiCallsUsed;
    saveMeta(meta);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n\U0001f4f0 ========== NEWS GENERATION COMPLETE (${elapsed}s) ==========`);
    console.log(`  Articles: ${runReport.articlesGenerated}`);
    console.log(`  Leagues: ${runReport.leaguesScanned}`);
    console.log(`  Matches: ${runReport.matchesFound}`);
    console.log(`  API calls: ${runReport.apiCallsUsed}`);
    if (runReport.errors.length > 0) {
      console.log(`  Errors: ${runReport.errors.length}`);
    }

  } catch (err) {
    console.error('\u274c News generation failed:', err);
    runReport.errors.push(`Fatal: ${err.message}`);
  } finally {
    isRunning = false;
  }

  return { status: 'completed', report: runReport };
}

/**
 * Start the cron scheduler
 * Schedule: 3-4 times per week
 *   - Monday 09:00 UTC — Weekend results digest + league roundups
 *   - Wednesday 10:00 UTC — Midweek match previews
 *   - Friday 09:00 UTC — Weekend previews + league roundups
 *   - Sunday 18:00 UTC — Weekend results roundup
 */
function startScheduler() {
  if (!process.env.FOOTBALL_DATA_KEY) {
    console.log('\u26a0\ufe0f FOOTBALL_DATA_KEY not set — news scheduler DISABLED');
    return null;
  }
  if (!process.env.OPENROUTER_API_KEY) {
    console.log('\u26a0\ufe0f OPENROUTER_API_KEY not set — news scheduler DISABLED');
    return null;
  }

  // Monday 09:00 UTC
  cron.schedule('0 9 * * 1', () => {
    console.log('\U0001f4f0 Cron: Monday digest trigger');
    generateNews().catch(err => console.error('Monday cron error:', err));
  });

  // Wednesday 10:00 UTC
  cron.schedule('0 10 * * 3', () => {
    console.log('\U0001f4f0 Cron: Wednesday preview trigger');
    generateNews().catch(err => console.error('Wednesday cron error:', err));
  });

  // Friday 09:00 UTC
  cron.schedule('0 9 * * 5', () => {
    console.log('\U0001f4f0 Cron: Friday preview trigger');
    generateNews().catch(err => console.error('Friday cron error:', err));
  });

  // Sunday 18:00 UTC
  cron.schedule('0 18 * * 0', () => {
    console.log('\U0001f4f0 Cron: Sunday roundup trigger');
    generateNews().catch(err => console.error('Sunday cron error:', err));
  });

  console.log('\U0001f4f0 News scheduler ACTIVE — runs Mon/Wed/Fri/Sun');

  // Invisible match updater: watches for freshly PLAYED matches every 45 min
  // and publishes full-time reports automatically (free-tier pacing).
  try { startMatchUpdater(); } catch (e) { console.error('Match updater failed to start:', e.message); }

  return true;
}

module.exports = {
  generateNews,
  startScheduler
};
