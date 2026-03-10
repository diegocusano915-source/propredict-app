const axios = require("axios");

const BASE_URL = "https://api.football-data.org/v4";
const CACHE_DURATION = 10 * 60 * 1000;

const cache = {};

function getConfidenceLabel(value) {
  const num = parseFloat(value);
  if (num >= 80) return "Elite";
  if (num >= 70) return "Strong";
  if (num >= 60) return "Medium";
  return "Low";
}

function calculateWeightedStats(matches, teamId) {
  const weights = [1.5,1.4,1.3,1.2,1.1,1.0,0.9,0.8,0.7,0.6];
  let totalWeight = 0;

  let over25 = 0;
  let btts = 0;
  let wins = 0;
  let losses = 0;

  matches.forEach((match, index) => {
    const weight = weights[index] || 0.6;
    totalWeight += weight;

    if (!match.score || !match.score.fullTime) return;

    const isHome = match.homeTeam.id == teamId;

    const ftHome = match.score.fullTime.home ?? 0;
    const ftAway = match.score.fullTime.away ?? 0;

    const ftScored = isHome ? ftHome : ftAway;
    const ftConceded = isHome ? ftAway : ftHome;

    const totalGoals = ftHome + ftAway;

    if (totalGoals > 2) over25 += weight;
    if (ftHome > 0 && ftAway > 0) btts += weight;

    if (ftScored > ftConceded) wins += weight;
    else if (ftScored < ftConceded) losses += weight;
  });

  return {
    over25: ((over25 / totalWeight) * 100).toFixed(1),
    btts: ((btts / totalWeight) * 100).toFixed(1),
    winPercentage: ((wins / totalWeight) * 100).toFixed(1),
    lossPercentage: ((losses / totalWeight) * 100).toFixed(1)
  };
}

async function safeRequest(config) {
  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    if (error.response && error.response.status === 429) {
      return { rateLimited: true };
    }
    return null;
  }
}

async function getFootballTopPicks(leagueCode, apiKey) {

  const cacheKey = `top-picks-${leagueCode}`;
  const now = Date.now();

  if (cache[cacheKey]) {
    const cacheAge = now - cache[cacheKey].timestamp;
    if (cacheAge < CACHE_DURATION) {
      return cache[cacheKey].data;
    }
  }

  const fixturesData = await safeRequest({
    method: "GET",
    url: `${BASE_URL}/competitions/${leagueCode}/matches`,
    headers: { "X-Auth-Token": apiKey },
    params: { status: "SCHEDULED" }
  });

  if (!fixturesData || fixturesData.rateLimited) {
    return cache[cacheKey]?.data || [];
  }

  const fixtures = (fixturesData.matches || []).slice(0, 4);
  const projections = [];

  for (const match of fixtures) {

    const homeId = match.homeTeam?.id;
    const awayId = match.awayTeam?.id;
    if (!homeId || !awayId) continue;

    const homeRes = await safeRequest({
      method: "GET",
      url: `${BASE_URL}/teams/${homeId}/matches`,
      headers: { "X-Auth-Token": apiKey },
      params: { status: "FINISHED", limit: 10 }
    });

    const awayRes = await safeRequest({
      method: "GET",
      url: `${BASE_URL}/teams/${awayId}/matches`,
      headers: { "X-Auth-Token": apiKey },
      params: { status: "FINISHED", limit: 10 }
    });

    if (!homeRes || !awayRes) continue;

    const homeStats = calculateWeightedStats(homeRes.matches || [], homeId);
    const awayStats = calculateWeightedStats(awayRes.matches || [], awayId);

    const projectedOver25 =
      (parseFloat(homeStats.over25) + parseFloat(awayStats.over25)) / 2;

    const projectedBTTS =
      (parseFloat(homeStats.btts) + parseFloat(awayStats.btts)) / 2;

    projections.push({
      match: `${match.homeTeam.name} vs ${match.awayTeam.name}`,
      over25: projectedOver25.toFixed(1),
      btts: projectedBTTS.toFixed(1),
      confidence: getConfidenceLabel(
        Math.max(projectedOver25, projectedBTTS)
      )
    });
  }

  cache[cacheKey] = {
    data: projections,
    timestamp: now
  };

  return projections;
}

module.exports = {
  getFootballTopPicks
};
