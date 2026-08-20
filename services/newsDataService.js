/**
 * ProPredict News Data Service
 * Fetches REAL match data from football-data.org (FREE tier: 10 req/min)
 * Covers 12 major leagues across Europe + more
 * 
 * Required env vars:
 *   FOOTBALL_DATA_KEY - Free API key from football-data.org (no credit card needed)
 *   OPENROUTER_API_KEY - OpenRouter key for AI content generation
 */

const axios = require('axios');

const BASE = 'https://api.football-data.org/v4';

// 12 leagues — football-data.org competition codes
// Free tier covers: PL, CL, EL, BL, SA, LL, L1, EC, WC, PPL, EFL
const LEAGUES = [
  // Top 5 European leagues
  { code: 'PL',  name: 'Premier League',    country: 'England', flag: '\ud83c\udff4\udb40\udc67\udb40\udc62\udb40\udc77\udb40\udc7c', priority: 1 },
  { code: 'PD',  name: 'La Liga',            country: 'Spain',   flag: '\ud83c\uddea\ud83c\udddf8', priority: 1 },
  { code: 'SA',  name: 'Serie A',            country: 'Italy',   flag: '\ud83c\uddee\ud83c\uddf9', priority: 1 },
  { code: 'BL1', name: 'Bundesliga',         country: 'Germany', flag: '\ud83c\udde9\ud83c\uddea', priority: 1 },
  { code: 'FL1', name: 'Ligue 1',            country: 'France',  flag: '\ud83c\uddeb\ud83c\uddf7', priority: 1 },
  // European competitions
  { code: 'CL',  name: 'Champions League',   country: 'Europe',  flag: '\u26bd',            priority: 1 },
  { code: 'EC',  name: 'European Championship', country: 'Europe', flag: '\ud83c\uddea\ud83c\uddfa', priority: 2 },
  // Secondary leagues
  { code: 'ELC', name: 'Championship',       country: 'England', flag: '\ud83c\udff4\udb40\udc67\udb40\udc62\udb40\udc77\udb40\udc7c', priority: 2 },
  { code: 'DED', name: 'Eredivisie',         country: 'Netherlands', flag: '\ud83c\uddf3\ud83c\uddf1', priority: 2 },
  { code: 'PPL', name: 'Primeira Liga',      country: 'Portugal', flag: '\ud83c\uddf5\ud83c\uddf9', priority: 2 },
  { code: 'BSA', name: 'Serie A (Brazil)',   country: 'Brazil',  flag: '\ud83c\udde7\ud83c\uddf7', priority: 3 },
  { code: 'EL',  name: 'Europa League',      country: 'Europe',  flag: '\ud83c\uddea\ud83c\uddfa', priority: 2 },
];

// Cache to stay under 10 req/min
const cache = new Map();
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours

function cacheKey(type, ...args) {
  return `${type}:${args.join(':')}`;
}

// Rate limiter: max 8 requests per 60 seconds (under 10/min limit)
const requestTimes = [];
async function rateLimit() {
  const now = Date.now();
  const windowStart = now - 60000;
  // Clean old entries
  while (requestTimes.length > 0 && requestTimes[0] < windowStart) {
    requestTimes.shift();
  }
  if (requestTimes.length >= 8) {
    const waitMs = 60000 - (now - requestTimes[0]) + 500;
    console.log(`  \u23f3 Rate limit: waiting ${Math.ceil(waitMs / 1000)}s...`);
    await new Promise(resolve => setTimeout(resolve, waitMs));
  }
  requestTimes.push(Date.now());
}

async function apiGet(endpoint) {
  const key = cacheKey('fd', endpoint);
  const cached = cache.get(key);
  if (cached && (Date.now() - cached.ts) < CACHE_TTL) {
    return cached.data;
  }

  await rateLimit();

  const response = await axios.get(`${BASE}${endpoint}`, {
    headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_KEY }
  });

  if (response.status === 429) {
    console.error('  \u26a0\ufe0f Rate limited by football-data.org, waiting 60s...');
    await new Promise(resolve => setTimeout(resolve, 61000));
    return apiGet(endpoint); // Retry once
  }

  const result = response.data;
  cache.set(key, { data: result, ts: Date.now() });
  return result;
}

/**
 * Get fixtures for a competition in a date range
 */
async function getFixtures(competitionCode, dateFrom, dateTo) {
  const data = await apiGet(`/competitions/${competitionCode}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`);
  return (data.matches || []).map(m => normalizeMatch(m));
}

/**
 * Get all upcoming fixtures for a competition (next 7 days)
 */
async function getUpcomingFixtures(competitionCode) {
  const today = formatDate(new Date());
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const to = formatDate(nextWeek);
  return getFixtures(competitionCode, today, to);
}

/**
 * Get recent finished fixtures for a competition (last 7 days)
 */
async function getRecentFixtures(competitionCode) {
  const today = formatDate(new Date());
  const lastWeek = new Date();
  lastWeek.setDate(lastWeek.getDate() - 7);
  const from = formatDate(lastWeek);
  const data = await apiGet(`/competitions/${competitionCode}/matches?dateFrom=${from}&dateTo=${today}&status=FINISHED`);
  return (data.matches || []).map(m => normalizeMatch(m));
}

/**
 * Get league standings
 */
async function getStandings(competitionCode) {
  const data = await apiGet(`/competitions/${competitionCode}/standings`);
  return (data.standings?.[0]?.table || []).map(s => ({
    rank: s.position,
    team: s.team.name,
    logo: s.team.crest,
    teamId: s.team.id,
    played: s.playedGames,
    wins: s.won,
    draws: s.draw,
    losses: s.lost,
    goalsFor: s.goalsFor,
    goalsAgainst: s.goalsAgainst,
    goalDiff: s.goalDifference,
    points: s.points,
    form: s.form || ''
  }));
}

/**
 * Get head-to-head between two teams
 */
async function getHeadToHead(team1Id, team2Id) {
  const data = await apiGet(`/teams/${team1Id}/matches?opponent=${team2Id}&limit=5`);
  return (data.matches || []).map(m => ({
    date: m.utcDate,
    homeTeam: m.homeTeam.name,
    awayTeam: m.awayTeam.name,
    homeGoals: m.score?.fullTime?.home,
    awayGoals: m.score?.fullTime?.away,
    winner: m.score?.winner || 'draw',
    competition: m.competition?.name || ''
  }));
}

/**
 * Get top scorers for a competition
 */
async function getTopScorers(competitionCode) {
  const data = await apiGet(`/competitions/${competitionCode}/scorers`);
  return (data.scorers || []).slice(0, 10).map(s => ({
    name: s.player.name,
    team: s.team.name,
    goals: s.goals || 0,
    assists: s.assists || 0,
    playedMinutes: s.playedMinutes || 0,
    rating: s.rating || '0'
  }));
}

/**
 * Normalize a football-data.org match to our internal format
 */
function normalizeMatch(m) {
  const ftHome = m.score?.fullTime?.home;
  const ftAway = m.score?.fullTime?.away;
  const isFinished = m.status === 'FINISHED';
  const isScheduled = m.status === 'SCHEDULED' || m.status === 'TIMED';
  const isInPlay = ['IN_PLAY', 'PAUSED', 'HALFTIME'].includes(m.status);

  return {
    id: m.id,
    date: m.utcDate,
    status: isFinished ? 'FT' : isInPlay ? 'LIVE' : isScheduled ? 'NS' : m.status,
    homeTeam: {
      id: m.homeTeam.id,
      name: m.homeTeam.name,
      logo: m.homeTeam.crest || '',
      winner: isFinished ? (ftHome > ftAway) : null
    },
    awayTeam: {
      id: m.awayTeam.id,
      name: m.awayTeam.name,
      logo: m.awayTeam.crest || '',
      winner: isFinished ? (ftAway > ftHome) : null
    },
    goals: {
      home: isFinished ? ftHome : null,
      away: isFinished ? ftAway : null
    },
    league: {
      code: m.competition?.code || '',
      name: m.competition?.name || '',
      country: '',
      flag: '',
      logo: m.competition?.emblem || '',
      round: m.matchday ? `Matchday ${m.matchday}` : ''
    },
    matchday: m.matchday || null
  };
}

/**
 * Scan this week's matches across all leagues
 * Returns fixtures grouped by league
 */
async function scanWeeklyMatches() {
  const today = new Date();
  const lastWeek = new Date(today);
  lastWeek.setDate(today.getDate() - 7);
  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);

  const dateFrom = formatDate(lastWeek);
  const dateTo = formatDate(nextWeek);

  console.log(`\ud83d\udccd Scanning fixtures from ${dateFrom} to ${dateTo}...`);

  const results = [];
  let apiCalls = 0;

  const sortedLeagues = [...LEAGUES].sort((a, b) => a.priority - b.priority);

  for (const league of sortedLeagues) {
    try {
      const fixtures = await getFixtures(league.code, dateFrom, dateTo);
      apiCalls++;

      if (!fixtures || fixtures.length === 0) continue;

      // Tag with our league metadata
      const tagged = fixtures.map(f => ({
        ...f,
        league: { ...f.league, id: league.code, country: league.country, flag: league.flag, name: league.name }
      }));

      results.push({
        league,
        fixtures: tagged,
        matchCount: tagged.length
      });

      console.log(`  \u2705 ${league.name}: ${tagged.length} matches`);
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      console.error(`  \u274c ${league.name}: ${msg}`);
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

  // Pick 2-3 Premier League matches
  const pl = weeklyData.results.find(r => r.league.code === 'PL');
  if (pl && pl.fixtures.length > 0) {
    const plMatches = pickBestMatches(pl.fixtures, 3);
    selected.push(...plMatches.map(m => ({ ...m, selectionReason: 'Premier League spotlight' })));
    usedLeagues.add('PL');
  }

  // Pick 2-3 from other priority-1 leagues
  const otherTopLeagues = weeklyData.results
    .filter(r => r.league.priority === 1 && !usedLeagues.has(r.league.code))
    .sort((a, b) => b.matchCount - a.matchCount);

  for (const item of otherTopLeagues.slice(0, 2)) {
    const matches = pickBestMatches(item.fixtures, 2);
    selected.push(...matches.map(m => ({ ...m, selectionReason: `${item.league.name} spotlight` })));
    usedLeagues.add(item.league.code);
  }

  // Pick 1-2 from priority-2 leagues for variety
  const otherLeagues = weeklyData.results
    .filter(r => !usedLeagues.has(r.league.code))
    .sort((a, b) => b.matchCount - a.matchCount);

  for (const item of otherLeagues.slice(0, 2)) {
    const matches = pickBestMatches(item.fixtures, 1);
    selected.push(...matches.map(m => ({ ...m, selectionReason: `${item.league.name} feature` })));
  }

  return selected;
}

/**
 * Pick the most interesting matches
 */
function pickBestMatches(fixtures, count) {
  const scored = fixtures.map(f => {
    let score = 0;
    if (f.status === 'NS' || f.status === 'LIVE') score += 10;
    if (f.status === 'FT') score += 3;
    const day = new Date(f.date).getDay();
    if (day === 0 || day === 6) score += 5;
    return { ...f, _score: score };
  });
  scored.sort((a, b) => b._score - a._score);
  return scored.slice(0, count);
}

/**
 * Get enrichment data for selected matches (H2H)
 */
async function enrichMatchData(matches) {
  const enriched = [];

  for (const match of matches) {
    try {
      const h2h = await getHeadToHead(match.homeTeam.id, match.awayTeam.id);
      enriched.push({ ...match, headToHead: h2h });
    } catch (err) {
      console.error(`H2H failed for ${match.homeTeam.name} vs ${match.awayTeam.name}: ${err.message}`);
      enriched.push({ ...match, headToHead: [] });
    }
  }

  return enriched;
}

/**
 * Get league standings for article context
 */
async function getLeagueContext(leagueCode) {
  try {
    const [standings, scorers] = await Promise.all([
      getStandings(leagueCode),
      getTopScorers(leagueCode)
    ]);
    return { standings, topScorers };
  } catch (err) {
    console.error(`League context failed for ${leagueCode}: ${err.message}`);
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
  getUpcomingFixtures,
  getRecentFixtures,
  getStandings,
  getHeadToHead,
  getTopScorers,
  formatDate,
  formatDatePretty
};
