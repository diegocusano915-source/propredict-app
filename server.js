require("dotenv").config();
const express = require("express");
const axios = require("axios");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const FOOTBALL_DATA_KEY = process.env.FOOTBALL_DATA_KEY;

if (!FOOTBALL_DATA_KEY) {
  console.error("❌ FOOTBALL_DATA_KEY is missing.");
  process.exit(1);
}

const BASE_URL = "https://api.football-data.org/v4";

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
   WEIGHTED ENGINE
-------------------------------------------------- */
function calculateWeightedStats(matches, teamId) {
  const weights = [1.5,1.4,1.3,1.2,1.1,1.0,0.9,0.8,0.7,0.6];
  let totalWeight = 0;

  let ftOver25 = 0;
  let ftBTTS = 0;
  let ftWins = 0;
  let ftLosses = 0;

  matches.forEach((match, index) => {
    const weight = weights[index] || 0.6;
    totalWeight += weight;

    const isHome = match.homeTeam.id == teamId;

    const ftHome = match.score.fullTime.home ?? 0;
    const ftAway = match.score.fullTime.away ?? 0;

    const ftScored = isHome ? ftHome : ftAway;
    const ftConceded = isHome ? ftAway : ftHome;
    const totalGoals = ftHome + ftAway;

    if (totalGoals > 2) ftOver25 += weight;
    if (ftHome > 0 && ftAway > 0) ftBTTS += weight;

    if (ftScored > ftConceded) ftWins += weight;
    if (ftScored < ftConceded) ftLosses += weight;
  });

  return {
    over25: ((ftOver25 / totalWeight) * 100),
    btts: ((ftBTTS / totalWeight) * 100),
    winRate: ((ftWins / totalWeight) * 100),
    lossRate: ((ftLosses / totalWeight) * 100)
  };
}

/* --------------------------------------------------
   TEAM ANALYSIS (Existing)
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

    res.json({ teamId, analysis });

  } catch (error) {
    res.status(500).json({ error: "Team analysis failed" });
  }
});

/* --------------------------------------------------
   TOP 5 DAILY PICKS
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

    const fixtures = fixturesRes.data.matches;

    const projections = [];

    for (const match of fixtures) {
      const homeId = match.homeTeam.id;
      const awayId = match.awayTeam.id;

      const [homeRes, awayRes] = await Promise.all([
        axios.get(`${BASE_URL}/teams/${homeId}/matches`, {
          headers: { "X-Auth-Token": FOOTBALL_DATA_KEY },
          params: { status: "FINISHED", limit: 10 }
        }),
        axios.get(`${BASE_URL}/teams/${awayId}/matches`, {
          headers: { "X-Auth-Token": FOOTBALL_DATA_KEY },
          params: { status: "FINISHED", limit: 10 }
        })
      ]);

      const homeStats = calculateWeightedStats(homeRes.data.matches, homeId);
      const awayStats = calculateWeightedStats(awayRes.data.matches, awayId);

      const projectedOver25 = ((homeStats.over25 + awayStats.over25) / 2);
      const projectedBTTS = ((homeStats.btts + awayStats.btts) / 2);
      const projectedHomeWin = ((homeStats.winRate + awayStats.lossRate) / 2);

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
    console.error(error.message);
    res.status(500).json({ error: "Top picks generation failed" });
  }
});

/* -------------------------------------------------- */
app.listen(PORT, () => {
  console.log(`✅ ProPredict Server running on port ${PORT}`);
});
