// engines/basketballEngine.js

const axios = require('axios');
const { getCache, setCache } = require('../services/multiSportCache');

/*
|--------------------------------------------------------------------------
| CONFIGURATION
|--------------------------------------------------------------------------
*/

const BASE_URL = 'https://api-basketball.p.rapidapi.com';

const HEADERS = {
  'X-RapidAPI-Key': process.env.BASKETBALL_API_KEY,
  'X-RapidAPI-Host': process.env.BASKETBALL_API_HOST
};

/*
|--------------------------------------------------------------------------
| SAFE REQUEST WRAPPER
|--------------------------------------------------------------------------
*/

async function safeRequest(url, params = {}) {
  try {
    const response = await axios.get(url, {
      headers: HEADERS,
      params
    });

    return response.data;

  } catch (error) {

    if (error.response && error.response.status === 429) {
      console.warn('Basketball API rate limit hit (429)');
      return null;
    }

    console.error('Basketball API Error:', error.message);
    return null;
  }
}

/*
|--------------------------------------------------------------------------
| FETCH FIXTURES (STRUCTURE ONLY)
|--------------------------------------------------------------------------
*/

async function fetchFixtures(leagueId, season) {
  const cacheKey = `basketball-fixtures-${leagueId}-${season}`;

  const cached = getCache(cacheKey);
  if (cached) return cached;

  const data = await safeRequest(`${BASE_URL}/games`, {
    league: leagueId,
    season: season,
    next: 10
  });

  if (!data || !data.response) return null;

  setCache(cacheKey, data.response);

  return data.response;
}

/*
|--------------------------------------------------------------------------
| FETCH TEAM LAST MATCHES (STRUCTURE ONLY)
|--------------------------------------------------------------------------
*/

async function fetchLastMatches(teamId, season) {
  const cacheKey = `basketball-last-${teamId}-${season}`;

  const cached = getCache(cacheKey);
  if (cached) return cached;

  const data = await safeRequest(`${BASE_URL}/games`, {
    team: teamId,
    season: season,
    last: 10
  });

  if (!data || !data.response) return null;

  setCache(cacheKey, data.response);

  return data.response;
}

/*
|--------------------------------------------------------------------------
| NORMALIZED RESPONSE FORMAT
|--------------------------------------------------------------------------
*/

function normalizePick(matchId, homeTeam, awayTeam, market, probability, confidence) {
  return {
    matchId,
    homeTeam,
    awayTeam,
    market,
    probability,
    confidence
  };
}

module.exports = {
  fetchFixtures,
  fetchLastMatches,
  normalizePick
};
