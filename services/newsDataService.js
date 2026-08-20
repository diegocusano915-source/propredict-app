/**
 * ProPredict News Data Service
 * Fetches REAL match data from API-Football (api-sports.io)
 * Covers 20+ leagues across Europe and beyond
 * 
 * Required env vars:
 *   API_FOOTBALL_KEY  - API-Football key from api-sports.io (free tier: 100 requests/day)
 *   OPENROUTER_API_KEY - OpenRouter key for AI content generation
 */

const axios = require('axios');

const API_FOOTBALL_BASE = 'https://v3.football.api-sports.io';

// 20 leagues with real IDs from API-Football
const LEAGUES = [
  // Top 5 (higher priority, picked more often)
  { id: 39,  name: 'Premier League', country: 'England', flag: '🏴🇨🇦', priority: 1, season: '2025-2026' },
  { id: 140, name: 'La Liga', country: 'Spain', flag: '🇪🇸', priority: 1, season: '2025-2026' },
  { id: 135, name: 'Serie A', country: 'Italy', flag: '🇮🇹', priority: 1, season: '2025-2026' },
  { id: 78,  name: 'Bundesliga', country: 'Germany', flag: '🇩🇪', priority: 1, season: '2025-2026' },
  { id: 61,  name: 'Ligue 1', country: 'France', flag: '🇫🇷', priority: 1, season: '2025-2026' },
  // Secondary leagues
  { id: 88,  name: 'Eredivisie', country: 'Netherlands', flag: '🇳🇱', priority: 2, season: '2025-2026' },
  { id: 94,  name: 'Primeira Liga', country: 'Portugal', flag: '🇵🇹', priority: 2, season: '2025-2026' },
  { id: 203, name: 'Super Lig', country: 'Turkey', flag: '🇹🇷', priority: 2, season: '2025-2026' },
  { id: 144, name: 'Jupiler Pro League', country: 'Belgium', flag: '🇧🇪', priority: 2, season: '2025-2026' },
  { id: 340, name: 'Brasileirao', country: 'Brazil', flag: '🇧🇷', priority: 2, season: '2025' },
  { id: 128, name: 'Liga MX', country: 'Mexico', flag: '🇲🇽', priority: 2, season: '2025-2026' },
  { id: 2,  name: 'Champions League', country: 'Europe', flag: '🇦🇪', priority: 1, season: '2025-2026' },
  { id: 3,  name: 'Europa League', country: 'Europe', flag: '🇪🇺', priority: 2, season: '2025-2026' },
  { id: 848, name: 'Conference League', country: 'Europe', flag: '🇪🇺', priority: 3, season: '2025-2026' },
  { id: 169, name: 'Serie B', country: 'Italy', flag: '🇮🇹', priority: 3, season: '2025-2026' },
  { id: 325, name: 'FA Cup', country: 'England', flag: '🏴🇨🇦', priority: 2, season: '2025-2026' },
  { id: 326, name: 'League Cup', country: 'England', flag: '🏴🇨🇦', priority: 3, season: '2025-2026' },
  { id: 421, name: 'Copa del Rey', country: 'Spain', flag: '🇪🇸', priority: 3, season: '2025-2026' },
  { id: 433, name: 'DFB Pokal', country: 'Germany', flag: '🇩🇪', priority: 3, season: '2025-2026' },
  { id: 338, name: 'MLS', country: 'USA', flag: '🇺🇸', priority: 3, season: '2025' },
];

// Request cache to minimize API calls (100/day limit on free tier)
const cache = new Map();
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours

function cacheKey(type, ...args) {
  return `${type}:${args.join(':')}`;
}

async function apiGet(endpoint, params = {}) {
  const key = cacheKey('api', endpoint, JSON.stringify(params));
  const cached = cache.get(key);
  if (cached && (Date.now() - cached.ts) < CACHE_TTL) {
    return cached.data;
  }

  const response = await axios.get(`${API_FOOTBALL_BASE}${endpoint}`, {
    headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY },
    params
  });

  if (response.data && response.data.errors && Object.keys(response.data.errors).length > 0) {
    console.error('API-Football error:', response.data.errors);
    return null;
  }

  const result = response.data;
  cache.set(key, { data: result, ts: Date.now() });
  return result;
}

/**
 * Get fixtures for a league in a date range
 */
async function getFixtures(leagueId, season, dateFrom, dateTo) {
  const data = await apiGet('/fixtures', {
    league: leagueId,
    season,
    from: dateFrom,
    to: dateTo
  });
  return data?.response || [];
}

/**
 * Get league standings
 */
async function getStandings(leagueId, season) {
  const data = await apiGet('/standings', { league: leagueId, season });
  return data?.response?.[0]?.league?.standings?.[0] || [];
}

/**
 * Get head-to-head between two teams
 */
async function getHeadToHead(team1Id, team2Id) {
  const data = await apiGet('/fixtures/headtohead', {
    h2h: `${team1Id}-${team2Id}`,
    last: 5
  });
  return data?.response || [];
}

/**
 * Get top scorers for a league
 */
async function getTopScorers(leagueId, season) {
  const data = await apiGet('/players/topscorers', { league: leagueId, season });
  return data?.response || [];
}

/**
 * Get team statistics for a league/season
 */
async function getTeamStats(teamId, leagueId, season) {
  const data = await apiGet('/teams/statistics', {
    team: teamId,
    league: leagueId,
    season
  });
  return data?.response || null;
}

/**
 * Scan this week's matches across all leagues
 * Returns fixtures grouped by league with rich data
 */
async function scanWeeklyMatches() {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun
  
  // Define the "week window": from upcoming Friday to next Thursday
  const fridayOffset = (5 - dayOfWeek + 7) % 7 || 7;
  const friday = new Date(today);
  friday.setDate(today.getDate() + fridayOffset);
  
  const thursday = new Date(friday);
  thursday.setDate(friday.getDate() + 6);

  const dateFrom = formatDate(friday);
  const dateTo = formatDate(thursday);

  console.log(`\ud83d\udccd Scanning fixtures from ${dateFrom} to ${dateTo}...`);

  const results = [];
  let apiCalls = 0;
  const MAX_DAILY_CALLS = 80; // Leave room under 100/day limit

  // Prioritize: fetch top leagues first
  const sortedLeagues = [...LEAGUES].sort((a, b) => a.priority - b.priority);

  for (const league of sortedLeagues) {
    if (apiCalls >= MAX_DAILY_CALLS) {
      console.log(`\u26a0\ufe0f API call limit reached (${apiCalls}/${MAX_DAILY_CALLS}), stopping scan`);
      break;
    }

    try {
      const fixtures = await getFixtures(league.id, league.season, dateFrom, dateTo);
      apiCalls++;

      if (!fixtures || fixtures.length === 0) continue;

      // Enrich with match data
      const enrichedFixtures = fixtures.map(f => ({
        id: f.fixture.id,
        date: f.fixture.date,
        status: f.fixture.status.short,
        homeTeam: {
          id: f.teams.home.id,
          name: f.teams.home.name,
          logo: f.teams.home.logo,
          winner: f.teams.home.winner
        },
        awayTeam: {
          id: f.teams.away.id,
          name: f.teams.away.name,
          logo: f.teams.away.logo,
          winner: f.teams.away.winner
        },
        goals: f.goals,
        league: {
          id: league.id,
          name: league.name,
          country: league.country,
          flag: league.flag,
          logo: f.league.logo,
          round: f.league.round
        },
        score: f.score
      }));

      results.push({
        league,
        fixtures: enrichedFixtures,
        matchCount: enrichedFixtures.length
      });

      console.log(`  \u2705 ${league.name}: ${enrichedFixtures.length} matches`);
    } catch (err) {
      console.error(`  \u274c ${league.name}: ${err.message}`);
    }
  }

  console.log(`\ud83d\udcca Scan complete: ${results.length} leagues, ${results.reduce((s, r) => s + r.matchCount, 0)} total matches, ${apiCalls} API calls`);
  return { dateFrom, dateTo, results, apiCalls };
}

/**
 * Select matches for news articles (2-3 PL + 2-3 from other leagues)
 */
function selectNewsMatches(weeklyData) {
  const selected = [];
  const usedLeagues = new Set();

  // Group by league
  const byLeague = {};
  for (const item of weeklyData.results) {
    byLeague[item.league.name] = item;
  }

  // Pick 2-3 Premier League matches
  const pl = byLeague['Premier League'];
  if (pl && pl.fixtures.length > 0) {
    const plMatches = pickBestMatches(pl.fixtures, 3);
    selected.push(...plMatches.map(m => ({ ...m, selectionReason: 'Premier League spotlight' })));
    usedLeagues.add('Premier League');
  }

  // Pick 2-3 from other priority-1 leagues (La Liga, Serie A, Bundesliga, Ligue 1, UCL)
  const otherTopLeagues = weeklyData.results
    .filter(r => r.league.priority === 1 && !usedLeagues.has(r.league.name))
    .sort((a, b) => b.matchCount - a.matchCount);

  for (const item of otherTopLeagues.slice(0, 2)) {
    const matches = pickBestMatches(item.fixtures, 2);
    selected.push(...matches.map(m => ({ ...m, selectionReason: `${item.league.name} spotlight` })));
    usedLeagues.add(item.league.name);
  }

  // Pick 1-2 from priority-2 leagues for variety
  const otherLeagues = weeklyData.results
    .filter(r => !usedLeagues.has(r.league.name))
    .sort((a, b) => b.matchCount - a.matchCount);

  for (const item of otherLeagues.slice(0, 2)) {
    const matches = pickBestMatches(item.fixtures, 1);
    selected.push(...matches.map(m => ({ ...m, selectionReason: `${item.league.name} feature` })));
  }

  return selected;
}

/**
 * Pick the most interesting matches (prefer upcoming/big teams)
 */
function pickBestMatches(fixtures, count) {
  // Prefer: not started > in progress > finished; then earlier dates first
  const scored = fixtures.map(f => {
    let score = 0;
    if (f.status === 'NS' || f.status === '1H' || f.status === 'HT' || f.status === '2H') score += 10;
    if (f.status === 'FT' || f.status === 'AET' || f.status === 'PEN') score += 3;
    // Prefer weekend matches (Saturday/Sunday)
    const day = new Date(f.date).getDay();
    if (day === 0 || day === 6) score += 5;
    return { ...f, _score: score };
  });

  scored.sort((a, b) => b._score - a._score);
  return scored.slice(0, count);
}

/**
 * Get enrichment data for selected matches (H2H, standings, team stats)
 */
async function enrichMatchData(matches) {
  const enriched = [];
  let apiCalls = 0;
  const MAX_ENRICHMENT_CALLS = 30;

  for (const match of matches) {
    if (apiCalls >= MAX_ENRICHMENT_CALLS) break;

    try {
      // Get head-to-head (1 call per match pair)
      const h2h = await getHeadToHead(match.homeTeam.id, match.awayTeam.id);
      apiCalls++;

      enriched.push({
        ...match,
        headToHead: h2h.map(m => ({
          date: m.fixture.date,
          homeTeam: m.teams.home.name,
          awayTeam: m.teams.away.name,
          homeGoals: m.goals.home,
          awayGoals: m.goals.away,
          winner: m.teams.home.winner === true ? 'home' : m.teams.away.winner === true ? 'away' : 'draw'
        }))
      });
    } catch (err) {
      console.error(`H2H fetch failed for ${match.homeTeam.name} vs ${match.awayTeam.name}: ${err.message}`);
      enriched.push({ ...match, headToHead: [] });
    }
  }

  return enriched;
}

/**
 * Get league standings for article context
 */
async function getLeagueContext(leagueId, season) {
  try {
    const [standings, scorers] = await Promise.all([
      getStandings(leagueId, season),
      getTopScorers(leagueId, season)
    ]);

    return {
      standings: standings.slice(0, 10).map(s => ({
        rank: s.rank,
        team: s.team.name,
        logo: s.team.logo,
        played: s.all.played,
        wins: s.all.win,
        draws: s.all.draw,
        losses: s.all.lose,
        goalsFor: s.all.goals.for,
        goalsAgainst: s.all.goals.against,
        goalDiff: s.goalsDiff,
        points: s.points,
        form: s.form
      })),
      topScorers: scorers.slice(0, 5).map(s => ({
        name: s.player.name,
        team: s.statistics[0]?.team?.name || '',
        goals: s.statistics[0]?.goals?.total || 0,
        assists: s.statistics[0]?.goals?.assists || 0,
        rating: s.statistics[0]?.games?.rating || '0'
      }))
    };
  } catch (err) {
    console.error(`League context fetch failed: ${err.message}`);
    return { standings: [], topScorers: [] };
  }
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDatePretty(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}

module.exports = {
  LEAGUES,
  scanWeeklyMatches,
  selectNewsMatches,
  enrichMatchData,
  getLeagueContext,
  getFixtures,
  getStandings,
  getHeadToHead,
  getTopScorers,
  getTeamStats,
  formatDate,
  formatDatePretty
};
