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
              content: `You are a professional sports journalist for ProPredict, a leading sports analytics platform. You write engaging, data-driven football/soccer news articles. You ONLY use the real data provided to you — never invent scores, names, standings, or match results. Your writing style is authoritative yet accessible, similar to The Athletic or BBC Sport. You use real team names, real player names, and real statistics exactly as provided. You never fabricate information.`
            },
            { role: 'user', content: prompt }
          ],
          max_tokens: 4000,
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

Write the article in this format (use HTML):
<h2>Match Overview</h2>
<p>Detailed preview paragraph about the match context...</p>

<h2>Current Form & Standings</h2>
<p>Analysis of both teams' positions and recent form...</p>

<h2>Head-to-Head History</h2>
<p>Analysis of recent meetings between these teams...</p>

<h2>Key Storylines</h2>
<p>2-3 paragraphs about key narratives (relegation battles, title races, derbies, etc.)...</p>

<h2>What to Expect</h2>
<p>Final preview with tactical expectations...</p>

IMPORTANT: Use only the data provided above. Reference real team names and real statistics. Do NOT make up player names, scores, or events.`;

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
  // Strip HTML tags
  const text = contentHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
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
  generateWeeklyRoundup,
  generateMultiLeagueDigest,
  generateSummary,
  estimateReadTime,
  generateSlug
};
