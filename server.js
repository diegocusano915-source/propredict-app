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
  console.error("❌ FOOTBALL_DATA_KEY is missing.");
  process.exit(1);
}

const BASE_URL = "https://api.football-data.org/v4";

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/* --------------------------------------------------
   ROOT ROUTE
-------------------------------------------------- */
app.get("/", (req, res) => {
  res.send("ProPredict Backend Running ✅");
});

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

  let ftGoalsScored = 0;
  let ftGoalsConceded = 0;
  let ftOver05 = 0;
  let ftOver15 = 0;
  let ftOver25 = 0;
  let ftOver35 = 0;
  let ftBTTS = 0;
  let ftWins = 0;
  let ftDraws = 0;
  let ftLosses = 0;

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

    const ftScored = isHome ? ftHome : ftAway;
    const ftConceded = isHome ? ftAway : ftHome;
    const ftTotalGoals = ftHome + ftAway;

    ftGoalsScored += ftScored * weight;
    ftGoalsConceded += ftConceded * weight;

    if (ftTotalGoals > 0) ftOver05 += weight;
    if (ftTotalGoals > 1) ftOver15 += weight;
    if (ftTotalGoals > 2) ftOver25 += weight;
    if (ftTotalGoals > 3) ftOver35 += weight;

    if (ftHome > 0 && ftAway > 0) ftBTTS += weight;

    if (ftScored > ftConceded) ftWins += weight;
    else if (ftScored === ftConceded) ftDraws += weight;
    else ftLosses += weight;

    const fhHome = match.score.halfTime.home ?? 0;
    const fhAway = match.score.halfTime.away ?? 0;

    const fhScored = isHome ? fhHome : fhAway;
    const fhConceded = isHome ? fhAway : fhHome;
    const fhTotalGoals = fhHome + fhAway;

    if (fhTotalGoals > 0) fhOver05 += weight;
    if (fhTotalGoals > 1) fhOver15 += weight;
    if (fhHome > 0 && fhAway > 0) fhBTTS += weight;

    if (fhScored > fhConceded) fhWins += weight;
    else if (fhScored === fhConceded) fhDraws += weight;
    else fhLosses += weight;
  });

  const fullTime = {
    avgGoalsScored: (ftGoalsScored / totalWeight).toFixed(2),
    avgGoalsConceded: (ftGoalsConceded / totalWeight).toFixed(2),
    over05: ((ftOver05 / totalWeight) * 100).toFixed(1),
    over15: ((ftOver15 / totalWeight) * 100).toFixed(1),
    over25: ((ftOver25 / totalWeight) * 100).toFixed(1),
    over35: ((ftOver35 / totalWeight) * 100).toFixed(1),
    btts: ((ftBTTS / totalWeight) * 100).toFixed(1),
    winRate: ((ftWins / totalWeight) * 100).toFixed(1),
    drawRate: ((ftDraws / totalWeight) * 100).toFixed(1),
    lossRate: ((ftLosses / totalWeight) * 100).toFixed(1)
  };

  const winOrDraw = Math.min(
    parseFloat(fullTime.winRate) + parseFloat(fullTime.drawRate),
    100
  ).toFixed(1);

  const drawOrLoss = Math.min(
    parseFloat(fullTime.drawRate) + parseFloat(fullTime.lossRate),
    100
  ).toFixed(1);

  fullTime.doubleChance = { winOrDraw, drawOrLoss };

  fullTime.confidence = {
    over25: getConfidenceLabel(fullTime.over25),
    btts: getConfidenceLabel(fullTime.btts),
    winRate: getConfidenceLabel(fullTime.winRate),
    doubleChanceWinOrDraw: getConfidenceLabel(winOrDraw)
  };

  const firstHalf = {
    over05: ((fhOver05 / totalWeight) * 100).toFixed(1),
    over15: ((fhOver15 / totalWeight) * 100).toFixed(1),
    btts: ((fhBTTS / totalWeight) * 100).toFixed(1),
    winRate: ((fhWins / totalWeight) * 100).toFixed(1),
    drawRate: ((fhDraws / totalWeight) * 100).toFixed(1),
    lossRate: ((fhLosses / totalWeight) * 100).toFixed(1)
  };

  return { fullTime, firstHalf };
}

/* --------------------------------------------------
   TEAM ANALYSIS ROUTE
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

    res.json({ teamId, matchesAnalyzed: matches.length, analysis });

  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: "Team analysis failed" });
  }
});

/* --------------------------------------------------
   TOP PICKS (FREE TIER SAFE)
-------------------------------------------------- */
app.get("/api/top-picks/:leagueCode", async (req, res) => {
  try {
    const leagueCode = req.params.leagueCode;

    const fixturesRes = await axios.get(
      `${BASE_URL}/competitions/${leagueCode}/matches`,
      {
        headers: { "X-Auth-Token": FOOTBALL_DATA_KEY },
        params: { status: "SCHEDULED" }
      }
    );

    const fixtures = fixturesRes.data.matches.slice(0, 3);

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
        (parseFloat(homeStats.fullTime.over25) +
         parseFloat(awayStats.fullTime.over25)) / 2;

      const projectedBTTS =
        (parseFloat(homeStats.fullTime.btts) +
         parseFloat(awayStats.fullTime.btts)) / 2;

      const projectedHomeWin =
        (parseFloat(homeStats.fullTime.winRate) +
         parseFloat(awayStats.fullTime.lossRate)) / 2;

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
          confidence: {
            over25: getConfidenceLabel(projectedOver25),
            btts: getConfidenceLabel(projectedBTTS),
            homeWin: getConfidenceLabel(projectedHomeWin)
          }
        });
      }
    }

    projections.sort((a, b) => {
      return Math.max(b.over25, b.btts, b.homeWin) -
             Math.max(a.over25, a.btts, a.homeWin);
    });

    res.json({
      league: leagueCode,
      topPicks: projections.slice(0, 5)
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
  console.log(`✅ ProPredict Server running on port ${PORT}`);
});
