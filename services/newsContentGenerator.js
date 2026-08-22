/**
 * ProPredict AI News Content Generator
 * Uses OpenRouter to generate professional sports news articles
 * from REAL match data. No fake content.
 * 
 * Required env vars:
 *   OPENROUTER_API_KEY - OpenRouter API key
 */

const axios = require('axios');
const { formatDatePretty } = require('./newsDataService');

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Models to try (fallback chain) — ordered by cost/quality
const MODELS = [
  'deepseek/deepseek-chat-v3-0324',
  'google/gemini-2.5-flash-preview-05-20',
  'meta-llama/llama-3.3-70b-instruct'
];

async function callAI(prompt, retries = 2) {
  for (const model of MODELS) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await axios.post(OPENROUTER_URL, {
          model,
          messages: [
            {
              role: 'system',
              content: `You are a professional sports journalist for ProPredict, a leading sports analytics platform. You write engaging, data-driven football/soccer news articles. You ONLY use the real data provided to you — never invent scores, names, standings, or match results. Your writing style is authoritative yet accessible, similar to The Athletic or BBC Sport. You use real team names, real player names, and real statistics exactly as provided. You never fabricate information. Every article you write is a FULL, DETAILED report of at least 900 words: substantial paragraphs (4-6 sentences each), deep analysis in every section, and zero placeholders — never write '...' or 'content here'; deliver the complete finished article.`
            },
            { role: 'user', content: prompt }
          ],
          max_tokens: 6000,
          temperature: 0.7
        }, {
          headers: {
            'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://propredict-app.onrender.com',
            'X-Title': 'ProPredict News Generator'
          }
        });

        if (response.data?.choices?.[0]?.message?.content) {
          return response.data.choices[0].message.content;
        }
      } catch (err) {
        console.error(`  AI call failed (${model}, attempt ${attempt + 1}): ${err.message}`);
        if (attempt === retries) continue; // Try next model
      }
    }
  }
  throw new Error('All AI models failed to generate content');
}

/**
 * Generate a match preview article
 */
async function generateMatchPreview(match, standings, h2h) {
  const prompt = `Write a detailed football match preview article using ONLY the following REAL data. Do NOT invent any information.

MATCH: ${match.homeTeam.name} vs ${match.awayTeam.name}
LEAGUE: ${match.league.name} (${match.league.country})
DATE: ${formatDatePretty(match.date)}
ROUND: ${match.league.round || 'TBD'}

HEAD-TO-HEAD (Last ${h2h.length} meetings):
${h2h.map(h => `- ${formatDatePretty(h.date)}: ${h.homeTeam} ${h.homeGoals}-${h.awayGoals} ${h.awayTeam} (${h.winner})`).join('\n')}

${standings.length > 0 ? `CURRENT STANDINGS (Top 10):
${standings.map(s => `${s.rank}. ${s.team} — P:${s.played} W:${s.wins} D:${s.draws} L:${s.losses} GD:${s.goalDiff} Pts:${s.points} Form:${s.form}`).join('\n')}` : 'No standings data available.'}

Write a DETAILED report of 900-1,200 words in this format (use HTML):
<h2>Match Overview</h2>
<p>2-3 substantial paragraphs on the match context: stakes, round, season implications for both clubs.</p>

<h2>Current Form & Standings</h2>
<p>Deep analysis of both teams' league positions, points, goal difference and recent form strings — what the numbers actually say about each side's trajectory.</p>

<h2>Head-to-Head History</h2>
<p>Analyze every recent meeting listed above: patterns, scorelines, which side has held the edge and what history suggests about this fixture.</p>

<h2>Key Storylines</h2>
<p>3-4 paragraphs on the narratives: title races, relegation battles, derby history, European qualification math — whatever the standings data genuinely supports.</p>

<h2>Tactical Expectations</h2>
<p>2-3 paragraphs on likely approaches based on each team's numbers: attacking output, defensive record, goal difference and form.</p>

<h2>The ProPredict Angle</h2>
<p>A closing analytical section: what the data says smart watchers should focus on, framed as analysis (never a betting instruction or guaranteed outcome).</p>

IMPORTANT: Use only the data provided above. Reference real team names and real statistics. Do NOT make up player names, scores, or events.`;

  return await callAI(prompt);
}

/**
 * Generate a post-match REPORT article (auto match updater)
 * Written only after a match has actually FINISHED — real final score,
 * real scorers if provided, real standings context. No fabrication.
 */
async function generateMatchReport(match, standings, h2h) {
  const scorersText = (match.scorers && match.scorers.length > 0)
    ? `\nGOALSCORERS (chronological, real data):\n${match.scorers.map(s => `- ${s.minute}' ${s.name} (${s.team})`).join('\n')}`
    : '\nNo goalscorer detail available — do NOT invent scorer names.';

  const prompt = `Write a DETAILED post-match football report using ONLY the following REAL data. Do NOT invent any information.

FINAL RESULT: ${match.homeTeam.name} ${match.goals.home ?? '?'}-${match.goals.away ?? '?'} ${match.awayTeam.name}
LEAGUE: ${match.league.name} (${match.league.country})
ROUND: ${match.league.round || 'TBD'}
STATUS: ${match.status}
${scorersText}

${standings.length > 0 ? `CURRENT STANDINGS (Top 10):\n${standings.map(s => `${s.rank}. ${s.team} — P:${s.played} W:${s.wins} D:${s.draws} L:${s.losses} GD:${s.goalDiff} Pts:${s.points} Form:${s.form}`).join('\n')}` : 'No standings data available.'}

${h2h.length > 0 ? `HEAD-TO-HEAD (recent meetings):\n${h2h.map(h => `- ${formatDatePretty(h.date)}: ${h.homeTeam} ${h.homeGoals}-${h.awayGoals} ${h.awayTeam}`).join('\n')}` : 'No head-to-head data available.'}

Write a DETAILED report of 900-1,200 words in this format (use HTML):
<h2>Full-Time Verdict</h2>
<p>2-3 substantial paragraphs on how the result unfolded and what it means.</p>

<h2>How the Scoreline Was Built</h2>
<p>If goalscorer data is provided, walk through the goals chronologically with each real scorer and minute. If NOT provided, analyse the scoreline and what the result does for each side — and say plainly that scorers were not in the data feed rather than inventing any.</p>

<h2>Standings Impact</h2>
<p>Detailed analysis using the real table: points won or lost, positions, goal difference swings, form strings.</p>

<h2>The Bigger Picture</h2>
<p>2-3 paragraphs on what this result means for each club's season based strictly on the standings and result data.</p>

<h2>History Check</h2>
<p>If head-to-head data is provided, how this result fits the recent pattern of the fixture.</p>

IMPORTANT: Use ONLY the data provided. Reference real team names and real statistics. Do NOT make up player names, scorer names, or events. If a data point is missing, say it was not available.`;

  return await callAI(prompt);
}

/**
 * Generate a weekly roundup article for a league
 */
async function generateWeeklyRoundup(league, fixtures, standings, topScorers) {
  const completedMatches = fixtures.filter(f => 
    ['FT', 'AET', 'PEN'].includes(f.status)
  );
  const upcomingMatches = fixtures.filter(f => 
    ['NS', '1H', 'HT', '2H'].includes(f.status)
  );

  const resultsText = completedMatches.map(f => 
    `${f.homeTeam.name} ${f.goals.home ?? '-'}-${f.goals.away ?? '-'} ${f.awayTeam.name}`
  ).join('\n');

  const upcomingText = upcomingMatches.map(f => 
    `${f.homeTeam.name} vs ${f.awayTeam.name} (${formatDatePretty(f.date)})`
  ).join('\n');

  const prompt = `Write a detailed weekly roundup article for ${league.name} using ONLY the following REAL data. Do NOT invent any information.

LEAGUE: ${league.name} (${league.country})

${completedMatches.length > 0 ? `RESULTS THIS WEEK:
${resultsText}` : 'No completed matches this period.'}

${upcomingMatches.length > 0 ? `UPCOMING FIXTURES:
${upcomingText}` : 'No upcoming fixtures this period.'}

${standings.length > 0 ? `CURRENT STANDINGS (Top 10):
${standings.map(s => `${s.rank}. ${s.team} — P:${s.played} W:${s.wins} D:${s.draws} L:${s.losses} GD:${s.goalDiff} Pts:${s.points} Form:${s.form}`).join('\n')}` : ''}

${topScorers.length > 0 ? `TOP SCORERS:
${topScorers.map(s => `${s.name} (${s.team}) — ${s.goals} goals, ${s.assists} assists`).join('\n')}` : ''}

Write the article in this format (use HTML):
<h2>Week in Review</h2>
<p>Summary of the week's results and major talking points...</p>

<h2>Results Roundup</h2>
<p>Detailed breakdown of key results, scorelines, and performances...</p>

<h2>Standings Shake-up</h2>
<p>How the results affected the league table, title race, and relegation battle...</p>

<h2>Top Performers</h2>
<p>Players and teams that stood out this week...</p>

${upcomingMatches.length > 0 ? `<h2>Looking Ahead</h2>
<p>Preview of upcoming fixtures and what to watch for...</p>` : ''}

IMPORTANT: Use ONLY the data above. Use real team names and real scores. Do NOT fabricate any information.`;

  return await callAI(prompt);
}

/**
 * Generate a multi-league digest article
 */
async function generateMultiLeagueDigest(leagueSummaries) {
  const summariesText = leagueSummaries.map(ls => {
    const resultsText = ls.fixtures
      .filter(f => ['FT', 'AET', 'PEN'].includes(f.status))
      .map(f => `${f.homeTeam.name} ${f.goals.home ?? '-'}-${f.goals.away ?? '-'} ${f.awayTeam.name}`)
      .join(', ');
    const upcomingText = ls.fixtures
      .filter(f => ['NS', '1H', 'HT', '2H'].includes(f.status))
      .map(f => `${f.homeTeam.name} vs ${f.awayTeam.name}`)
      .join(', ');
    
    return `${ls.league.flag} ${ls.league.name}: Results: ${resultsText || 'None'} | Upcoming: ${upcomingText || 'None'}${ls.standings.length > 0 ? ` | Table topper: ${ls.standings[0].team} (${ls.standings[0].points} pts)` : ''}`;
  }).join('\n\n');

  const prompt = `Write a comprehensive multi-league football news digest using ONLY the following REAL data. Do NOT invent any information.

${summariesText}

Write the article in this format (use HTML):
<h2>Across the Continent</h2>
<p>Opening overview of the football week across all leagues...</p>

${leagueSummaries.map(ls => `<h2>${ls.league.flag} ${ls.league.name} Roundup</h2>
<p>Detailed coverage of ${ls.league.name} results, standings implications, and storylines...</p>`).join('\n\n')}

<h2>The Bigger Picture</h2>
<p>Cross-league analysis — title race comparisons, European qualification battles, surprising performers...</p>

<h2>Weekend Watch Guide</h2>
<p>Best matches to look out for across all leagues...</p>

IMPORTANT: Use ONLY the data provided above. Use real team names, real scores, and real standings. Do NOT fabricate anything.`;

  return await callAI(prompt);
}

/**
 * Generate a summary for article cards (shorter, for listing pages)
 */
function generateSummary(contentHtml, maxLength = 180) {
  // Strip HTML tags AND markdown syntax (# headings, * bullets, _em_, **bold**)
  const text = contentHtml
    .replace(/<[^>]*>/g, ' ')
    .replace(/^#{1,6}\s+/gm, '')      // markdown headings
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1') // bold/italic
    .replace(/^\s*[-*+]\s+/gm, '')   // bullets
    .replace(/_{1,2}([^_]+)_{1,2}/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).replace(/\s+\S*$/, '') + '...';
}

/**
 * Estimate reading time from content
 */
function estimateReadTime(contentHtml) {
  const text = contentHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const words = text.split(/\s+/).length;
  const minutes = Math.max(3, Math.ceil(words / 200));
  return `${minutes} min read`;
}

/**
 * Generate a slug from a title
 */
function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 80) + '-' + Date.now().toString(36);
}

module.exports = {
  generateMatchPreview,
  generateMatchReport,
  generateMatchPreview,
  generateWeeklyRoundup,
  generateMultiLeagueDigest,
  generateSummary,
  estimateReadTime,
  generateSlug
};