require("dotenv").config();
const express = require("express");
const axios = require("axios");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const FOOTBALL_DATA_KEY = process.env.FOOTBALL_DATA_KEY;

if (!FOOTBALL_DATA_KEY) {
  console.error("❌ FOOTBALL_DATA_KEY is missing from environment variables.");
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
   WEIGHTED FORM ENGINE
-------------------------------------------------- */
function calculateWeightedStats(matches, teamId) {
  const weights = [1.5,1.4,1.3,1.2,1.1,1.0,0.9,0.8,0.7,0.6];

  let totalWeight = 0;

  /* FULL TIME */
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

  /* FIRST HALF */
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

    /* FULL TIME SCORES */
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

    /* FIRST HALF SCORES */
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

  return {
    fullTime: {
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
    },
    firstHalf: {
      over05: ((fhOver05 / totalWeight) * 100).toFixed(1),
      over15: ((fhOver15 / totalWeight) * 100).toFixed(1),
      btts: ((fhBTTS / totalWeight) * 100).toFixed(1),
      winRate: ((fhWins / totalWeight) * 100).toFixed(1),
      drawRate: ((fhDraws / totalWeight) * 100).toFixed(1),
      lossRate: ((fhLosses / totalWeight) * 100).toFixed(1)
    }
  };
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

    if (!matches || matches.length === 0) {
      return res.json({ message: "No matches found." });
    }

    const analysis = calculateWeightedStats(matches, teamId);

    res.json({
      teamId,
      matchesAnalyzed: matches.length,
      analysis
    });

  } catch (error) {
    console.error("❌ Team analysis error:", error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: "Failed to generate team analysis",
      error: error.response?.data || error.message
    });
  }
});

/* --------------------------------------------------
   SERVER START
-------------------------------------------------- */
app.listen(PORT, () => {
  console.log(`✅ ProPredict Server running on port ${PORT}`);
});
