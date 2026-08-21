/**
 * ProPredict — Invisible Match Updater
 * Watches for matches that have actually been PLAYED (status FINISHED on
 * football-data.org) and auto-publishes a detailed match report the moment
 * a result lands — no manual trigger, no fake coverage.
 *
 * FREE-TIER FRIENDLY:
 *   - Polls every 45 minutes
 *   - Only 1 API request per league per run (finished matches, last 36h)
 *   - Staggers leagues across runs (3 leagues checked per run, rotating)
 *   - Max 2 AI articles per run
 *   - A match is only ever reported once (persisted covered-ID set)
 *   - Silent no-ops when no new results exist
 */

const { addArticle, loadArticles, generateSlug, generateSummary, estimateReadTime } = require('./newsStorage');
const { generateMatchReport } = require('./newsContentGenerator');
const { LEAGUES, getRecentFixtures, getStandings } = require('./newsDataService');

const CHECK_INTERVAL_MS = 45 * 60 * 1000; // every 45 minutes
const LEAGUES_PER_RUN = 3;      // rotate: 3 leagues checked per run
const MAX_ARTICLES_PER_RUN = 2; // AI cost cap
const COVERED_KEY = 'news_covered_match_ids';

// ---------- tiny persistent covered-set (file in ./data alongside storage) ----------
const fs = require('fs');
const path = require('path');
const DATA_DIR = path.join(__dirname, '..', 'data');
const COVERED_FILE = path.join(DATA_DIR, `${COVERED_KEY}.json`);

function loadCovered() {
  try {
    if (fs.existsSync(COVERED_FILE)) return new Set(JSON.parse(fs.readFileSync(COVERED_FILE, 'utf8')).ids || []);
  } catch (_) {}
  return new Set();
}

function saveCovered(set) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(COVERED_FILE, JSON.stringify({ ids: Array.from(set).slice(-2000) }));
  } catch (_) {}
}

// ---------- the run ----------
let running = false;
let leagueCursor = 0;

async function checkForPlayedMatches() {
  if (running) return;
  if (!process.env.FOOTBALL_DATA_KEY || !process.env.OPENROUTER_API_KEY) return;
  running = true;

  try {
    const covered = loadCovered();
    const existingSlugs = new Set(loadArticles().map(a => a.slug));
    const to = new Date();
    const from = new Date(to.getTime() - 36 * 60 * 60 * 1000); // last 36h window

    // Rotate through the league list, a few per run
    let produced = 0;
    const ordered = [...LEAGUES].sort((a, b) => (a.priority || 9) - (b.priority || 9));
    for (let i = 0; i < LEAGUES_PER_RUN && produced < MAX_ARTICLES_PER_RUN; i++) {
      const league = ordered[(leagueCursor + i) % ordered.length];
      leagueCursor = (leagueCursor + LEAGUES_PER_RUN) % Math.max(1, ordered.length);

      let finished = [];
      try {
        finished = (await getRecentFixtures(league.code))
          .filter(m => m.status === 'FT' && !covered.has(String(m.id)))
          .filter(m => {
            // Only FRESH results (last 36h) — older finished matches are the
            // weekly digest's job, not the live updater's
            const kick = new Date(m.date).getTime();
            return Date.now() - kick <= 36 * 60 * 60 * 1000;
          });
      } catch (err) {
        continue; // league fetch failed (rate limit / no data) — silent, next run retries
      }
      if (finished.length === 0) continue;

      // Most recent result first; one report per run per league
      const match = finished.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
      const slug = generateSlug(`${match.homeTeam.name} vs ${match.awayTeam.name} Report`);
      covered.add(String(match.id));
      if (existingSlugs.has(slug)) { saveCovered(covered); continue; }

      try {
        let standings = [];
        try { standings = (await getStandings(league.code)) || []; } catch (_) {}
        const content = await generateMatchReport(match, standings, []);
        addArticle({
          slug,
          title: `${match.homeTeam.name} ${match.goals.home}-${match.goals.away} ${match.awayTeam.name}: Full-Time Report — ${league.name}`,
          category: 'Match Report',
          date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
          readTime: estimateReadTime(content),
          summary: generateSummary(content),
          content,
          league: { name: league.name, country: league.country, flag: league.flag, code: league.code },
          matchData: {
            homeTeam: match.homeTeam,
            awayTeam: match.awayTeam,
            date: match.date,
            round: match.league?.round,
            score: `${match.goals.home}-${match.goals.away}`,
            scorers: match.scorers || []
          },
          tags: ['report', 'result', league.name.toLowerCase().replace(/\s+/g, '-'),
                 match.homeTeam.name.toLowerCase().replace(/\s+/g, '-'),
                 match.awayTeam.name.toLowerCase().replace(/\s+/g, '-')],
          generatedAt: new Date().toISOString(),
          type: 'report',
          views: 0
        });
        produced++;
        console.log(`\u26A1 Match updater: published report — ${match.homeTeam.name} ${match.goals.home}-${match.goals.away} ${match.awayTeam.name} (${league.name})`);
      } catch (err) {
        console.error(`Match updater: article failed (${league.name}): ${err.message}`);
      }
      saveCovered(covered);
      if (produced >= MAX_ARTICLES_PER_RUN) break;
    }
  } catch (err) {
    console.error('Match updater run error:', err.message);
  } finally {
    running = false;
  }
}

/**
 * Start the invisible updater. Runs quietly in the background; first check
 * fires a few minutes after boot so it never collides with startup work.
 */
function startMatchUpdater() {
  if (!process.env.FOOTBALL_DATA_KEY || !process.env.OPENROUTER_API_KEY) {
    console.log('\u26A0\uFE0F Match updater DISABLED — API keys not configured');
    return null;
  }
  setTimeout(() => checkForPlayedMatches().catch(() => {}), 5 * 60 * 1000);
  setInterval(() => checkForPlayedMatches().catch(() => {}), CHECK_INTERVAL_MS);
  console.log('\u26A1 Match updater ACTIVE — checks for played matches every 45 min (free-tier pacing)');
  return true;
}

module.exports = { startMatchUpdater, checkForPlayedMatches };
