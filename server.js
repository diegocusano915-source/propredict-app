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
   WEIGHTED FORM ENGINE FUNCTION
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

  matches.forEach((match, index) => {
    const weight = weights[index] || 0.6;
    totalWeight += weight;

    const isHome = match.homeTeam.id == teamId;

    const scored = isHome ? match.score.fullTime.home : match.score.fullTime.away;
    const conceded = isHome ? match.score.fullTime.away : match.score.fullTime.home;

    const totalGoals = match.score.fullTime.home + match.score.fullTime.away;

    goalsScored += scored * weight;
    goalsConceded += conceded * weight;

    if (totalGoals > 0) over05 += weight;
    if (totalGoals > 1) over15 += weight;
    if (totalGoals > 2) over25 += weight;
    if (totalGoals > 3) over35 += weight;

    if (match.score.fullTime.home > 0 && match.score.fullTime.away > 0) {
      btts += weight;
    }

    if (scored > conceded) wins += weight;
    else if (scored === conceded) draws += weight;
    else losses += weight;
  });

  return {
    avgGoalsScored: (goalsScored / totalWeight).toFixed(2),
    avgGoalsConceded: (goalsConceded / totalWeight).toFixed(2),
    over05: ((over05 / totalWeight) * 100).toFixed(1),
    over15: ((over15 / totalWeight) * 100).toFixed(1),
    over25: ((over25 / totalWeight) * 100).toFixed(1),
    over35: ((over35 / totalWeight) * 100).toFixed(1),
    btts: ((btts / totalWeight) * 100).toFixed(1),
    winRate: ((wins / totalWeight) * 100).toFixed(1),
    drawRate: ((draws / totalWeight) * 100).toFixed(1),
    lossRate: ((losses / totalWeight) * 100).toFixed(1)
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
