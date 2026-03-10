require("dotenv").config();
const express = require("express");
const axios = require("axios");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

/* --------------------------------------------------
   ENVIRONMENT VALIDATION
-------------------------------------------------- */
const FOOTBALL_DATA_KEY = process.env.FOOTBALL_DATA_KEY;

if (!FOOTBALL_DATA_KEY) {
  console.error("FOOTBALL_DATA_KEY is missing.");
  process.exit(1);
}

const BASE_URL = "https://api.football-data.org/v4";

/* --------------------------------------------------
   IN-MEMORY CACHE
-------------------------------------------------- */
const cache = {};
const CACHE_DURATION = 10 * 60 * 1000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/* --------------------------------------------------
   CONFIDENCE ENGINE
-------------------------------------------------- */
function getConfidenceLabel(value) {
  const num = parseFloat(value);
  if (num >= 80) return "Elite";
  if (num >= 70) return "Strong";
  if (num >= 60) return "Medium";
  return "Low";
}

/* --------------------------------------------------
   WEIGHTED FORM ENGINE
-------------------------------------------------- */
function calculateWeightedStats(matches, teamId) {
  const weights = [1.5,1.4,1.3,1.2,1.1,1.0,0.9,0.8,0.7,0.6];
  let totalWeight = 0;

  let goalsScored = 0;
  let goalsConceded = 0;
  let over25 = 0;
  let btts = 0;
  let wins = 0;
  let draws = 0;
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

    goalsScored += ftScored * weight;
    goalsConceded += ftConceded * weight;

    if (totalGoals > 2) over25 += weight;
    if (ftHome > 0 && ftAway > 0) btts += weight;

    if (ftScored > ftConceded) wins += weight;
    else if (ftScored === ftConceded) draws += weight;
    else losses += weight;
  });

  const winPct = (wins / totalWeight) * 100;
  const drawPct = (draws / totalWeight) * 100;
  const lossPct = (losses / totalWeight) * 100;

  return {
    over25: ((over25 / totalWeight) * 100).toFixed(1),
    btts: ((btts / totalWeight) * 100).toFixed(1),
    winPercentage: winPct.toFixed(1),
    lossPercentage: lossPct.toFixed(1)
  };
}

/* --------------------------------------------------
   SAFE AXIOS WRAPPER
-------------------------------------------------- */
async function safeRequest(config) {
  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    if (error.response && error.response.status === 429) {
      console.warn("Rate limit hit (429)");
      return { rateLimited: true };
    }
    console.error("Request error:", error.message);
    return null;
  }
}
/* --------------------------------------------------
   GET TEAMS BY LEAGUE
-------------------------------------------------- */
app.get("/api/teams/:leagueCode", async (req, res) => {
  try {
    const leagueCode = req.params.leagueCode;

    const response = await safeRequest({
      method: "GET",
      url: `${BASE_URL}/competitions/${leagueCode}/teams`,
      headers: { "X-Auth-Token": FOOTBALL_DATA_KEY }
    });

    if (!response || response.rateLimited) {
      return res.json({ league: leagueCode, teams: [] });
    }

    const teams = response.teams.map(team => ({
      id: team.id,
      name: team.name
    }));

    res.json({ league: leagueCode, teams });

  } catch (error) {
    res.json({ league: req.params.leagueCode, teams: [] });
  }
});

/* --------------------------------------------------
   TOP PICKS
-------------------------------------------------- */
app.get("/api/top-picks/:leagueCode", async (req, res) => {

  const leagueCode = req.params.leagueCode;
  const cacheKey = `top-picks-${leagueCode}`;
  const now = Date.now();

  try {

    if (cache[cacheKey]) {
      const cacheAge = now - cache[cacheKey].timestamp;
      if (cacheAge < CACHE_DURATION) {
        return res.json({
          league: leagueCode,
          cached: true,
          topPicks: cache[cacheKey].data
        });
      }
    }

    const fixturesData = await safeRequest({
      method: "GET",
      url: `${BASE_URL}/competitions/${leagueCode}/matches`,
      headers: { "X-Auth-Token": FOOTBALL_DATA_KEY },
      params: { status: "SCHEDULED" }
    });

    if (!fixturesData || fixturesData.rateLimited) {
      return res.json({
        league: leagueCode,
        cached: true,
        topPicks: cache[cacheKey]?.data || []
      });
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
        headers: { "X-Auth-Token": FOOTBALL_DATA_KEY },
        params: { status: "FINISHED", limit: 10 }
      });

      const awayRes = await safeRequest({
        method: "GET",
        url: `${BASE_URL}/teams/${awayId}/matches`,
        headers: { "X-Auth-Token": FOOTBALL_DATA_KEY },
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

    res.json({
      league: leagueCode,
      cached: false,
      topPicks: projections
    });

  } catch (error) {

    res.json({
      league: leagueCode,
      cached: true,
      topPicks: cache[cacheKey]?.data || []
    });
  }
});

/* --------------------------------------------------
   EXTERNAL API TEST ROUTE (REAL DATA)
-------------------------------------------------- */
app.get("/api/test-external", async (req, res) => {
  try {

    const response = await axios.get(
      "https://www.balldontlie.io/api/v1/teams"
    );

    res.json({
      success: true,
      sample: response.data.data.slice(0, 3)
    });

  } catch (error) {

    res.json({
      success: false,
      error: error.message
    });
  }
});

/* --------------------------------------------------
   SERVER START
-------------------------------------------------- */
app.listen(PORT, () => {
  console.log(`ProPredict Server running on port ${PORT}`);
});
