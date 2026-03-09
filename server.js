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
   WEIGHTED FORM ENGINE (EXPANDED)
-------------------------------------------------- */
function calculateWeightedStats(matches, teamId) {
  const weights = [1.5,1.4,1.3,1.2,1.1,1.0,0.9,0.8,0.7,0.6];
  let totalWeight = 0;

  let goalsScored = 0;
  let goalsConceded = 0;

  let over05 = 0;
  let over15 = 0;
  let over25 = 0;
  let over35 = 0;
  let btts = 0;

  let wins = 0;
  let draws = 0;
  let losses = 0;

  let fhOver05 = 0;
  let fhOver15 = 0;
  let fhBTTS = 0;
  let fhWins = 0;
  let fhDraws = 0;
  let fhLosses = 0;

  matches.forEach((match, index) => {
    const weight = weights[index] || 0.6;
    totalWeight += weight;

    const isHome = match.homeTeam.id == teamId;

    const ftHome = match.score.fullTime.home ?? 0;
    const ftAway = match.score.fullTime.away ?? 0;

    const fhHome = match.score.halfTime.home ?? 0;
    const fhAway = match.score.halfTime.away ?? 0;

    const ftScored = isHome ? ftHome : ftAway;
    const ftConceded = isHome ? ftAway : ftHome;

    const fhScored = isHome ? fhHome : fhAway;
    const fhConceded = isHome ? fhAway : fhHome;

    const totalGoals = ftHome + ftAway;
    const totalFHGoals = fhHome + fhAway;

    goalsScored += ftScored * weight;
    goalsConceded += ftConceded * weight;

    if (totalGoals > 0) over05 += weight;
    if (totalGoals > 1) over15 += weight;
    if (totalGoals > 2) over25 += weight;
    if (totalGoals > 3) over35 += weight;

    if (ftHome > 0 && ftAway > 0) btts += weight;

    if (ftScored > ftConceded) wins += weight;
    else if (ftScored === ftConceded) draws += weight;
    else losses += weight;

    if (totalFHGoals > 0) fhOver05 += weight;
    if (totalFHGoals > 1) fhOver15 += weight;
    if (fhHome > 0 && fhAway > 0) fhBTTS += weight;

    if (fhScored > fhConceded) fhWins += weight;
    else if (fhScored === fhConceded) fhDraws += weight;
    else fhLosses += weight;
  });

  const winPct = (wins / totalWeight) * 100;
  const drawPct = (draws / totalWeight) * 100;
  const lossPct = (losses / totalWeight) * 100;

  return {
    avgGoalsScored: (goalsScored / totalWeight).toFixed(2),
    avgGoalsConceded: (goalsConceded / totalWeight).toFixed(2),

    over05: ((over05 / totalWeight) * 100).toFixed(1),
    over15: ((over15 / totalWeight) * 100).toFixed(1),
    over25: ((over25 / totalWeight) * 100).toFixed(1),
    over35: ((over35 / totalWeight) * 100).toFixed(1),
    btts: ((btts / totalWeight) * 100).toFixed(1),

    winPercentage: winPct.toFixed(1),
    drawPercentage: drawPct.toFixed(1),
    lossPercentage: lossPct.toFixed(1),

    doubleChance1X: (winPct + drawPct).toFixed(1),
    doubleChanceX2: (drawPct + lossPct).toFixed(1),

    fhOver05: ((fhOver05 / totalWeight) * 100).toFixed(1),
    fhOver15: ((fhOver15 / totalWeight) * 100).toFixed(1),
    fhBtts: ((fhBTTS / totalWeight) * 100).toFixed(1),
    fhWinPercentage: ((fhWins / totalWeight) * 100).toFixed(1),
    fhDrawPercentage: ((fhDraws / totalWeight) * 100).toFixed(1),
    fhLossPercentage: ((fhLosses / totalWeight) * 100).toFixed(1)
  };
}

/* --------------------------------------------------
   GET TEAMS BY LEAGUE
-------------------------------------------------- */
app.get("/api/teams/:leagueCode", async (req, res) => {
  try {
    const leagueCode = req.params.leagueCode;

    const response = await axios.get(
      `${BASE_URL}/competitions/${leagueCode}/teams`,
      {
        headers: { "X-Auth-Token": FOOTBALL_DATA_KEY }
      }
    );

    const teams = response.data.teams.map(team => ({
      id: team.id,
      name: team.name
    }));

    res.json({ league: leagueCode, teams });

  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: "Failed to fetch teams" });
  }
});

/* --------------------------------------------------
   TEAM ANALYSIS ROUTE (UPDATED)
-------------------------------------------------- */
app.get("/api/team-analysis/:teamId", async (req, res) => {
  try {
    const teamId = req.params.teamId;

    const response = await axios.get(
      `${BASE_URL}/teams/${teamId}/matches`,
      {
        headers: { "X-Auth-Token": FOOTBALL_DATA_KEY },
        params: { status: "FINISHED", limit: 10 }
      }
    );

    const matches = response.data.matches;
    const analysis = calculateWeightedStats(matches, teamId);

    res.json(analysis);

  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: "Team analysis failed" });
  }
});

/* --------------------------------------------------
   TOP PICKS (UNCHANGED)
-------------------------------------------------- */
app.get("/api/top-picks/:leagueCode", async (req, res) => {
  try {
    const leagueCode = req.params.leagueCode;
    const cacheKey = `top-picks-${leagueCode}`;
    const now = Date.now();

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

    const fixturesRes = await axios.get(
      `${BASE_URL}/competitions/${leagueCode}/matches`,
      {
        headers: { "X-Auth-Token": FOOTBALL_DATA_KEY },
        params: { status: "SCHEDULED" }
      }
    );

    const fixtures = fixturesRes.data.matches.slice(0, 8);
    const projections = [];

    for (const match of fixtures) {
      const homeId = match.homeTeam.id;
      const awayId = match.awayTeam.id;

      const homeRes = await axios.get(
        `${BASE_URL}/teams/${homeId}/matches`,
        {
          headers: { "X-Auth-Token": FOOTBALL_DATA_KEY },
          params: { status: "FINISHED", limit: 10 }
        }
      );

      const awayRes = await axios.get(
        `${BASE_URL}/teams/${awayId}/matches`,
        {
          headers: { "X-Auth-Token": FOOTBALL_DATA_KEY },
          params: { status: "FINISHED", limit: 10 }
        }
      );

      const homeStats = calculateWeightedStats(homeRes.data.matches, homeId);
      const awayStats = calculateWeightedStats(awayRes.data.matches, awayId);

      const projectedOver25 =
        (parseFloat(homeStats.over25) + parseFloat(awayStats.over25)) / 2;

      const projectedBTTS =
        (parseFloat(homeStats.btts) + parseFloat(awayStats.btts)) / 2;

      const projectedHomeWin =
        (parseFloat(homeStats.winPercentage) + parseFloat(awayStats.lossPercentage)) / 2;

      if (
        projectedOver25 >= 70 ||
        projectedBTTS >= 70 ||
        projectedHomeWin >= 65
      ) {
        projections.push({
          match: `${match.homeTeam.name} vs ${match.awayTeam.name}`,
          over25: projectedOver25.toFixed(1),
          btts: projectedBTTS.toFixed(1),
          homeWin: projectedHomeWin.toFixed(1),
          confidence: getConfidenceLabel(
            Math.max(projectedOver25, projectedBTTS, projectedHomeWin)
          )
        });
      }
    }

    projections.sort((a, b) => {
      return Math.max(b.over25, b.btts, b.homeWin) -
             Math.max(a.over25, a.btts, a.homeWin);
    });

    const finalTopPicks = projections.slice(0, 5);

    cache[cacheKey] = {
      data: finalTopPicks,
      timestamp: now
    };

    res.json({
      league: leagueCode,
      cached: false,
      topPicks: finalTopPicks
    });

  } catch (error) {
    console.error("Top picks error:", error.response?.data || error.message);
    res.status(500).json({ error: "Top picks generation failed" });
  }
});

/* --------------------------------------------------
   SERVER START
-------------------------------------------------- */
app.listen(PORT, () => {
  console.log(`ProPredict Server running on port ${PORT}`);
});
