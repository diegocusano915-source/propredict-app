require("dotenv").config();
const express = require("express");
const axios = require("axios");
const path = require("path");

const { getFootballTopPicks } = require("./engines/footballAdapter");
const { getBasketballTopPicks } = require("./engines/basketballEngine");
const { getDartsTopPicks } = require("./engines/dartsEngine");
const { getTableTennisTopPicks } = require("./engines/tableTennisEngine");
const { calculateAccumulator } = require("./services/accumulatorEngine");
const {
  recordPick,
  updatePickResult,
  getPerformanceSummary,
  getPerformanceLog
} = require("./services/performanceEngine");

const app = express();
const PORT = process.env.PORT || 3000;

const FOOTBALL_DATA_KEY = process.env.FOOTBALL_DATA_KEY;

if (!FOOTBALL_DATA_KEY) {
  console.error("FOOTBALL_DATA_KEY is missing.");
  process.exit(1);
}

const BASE_URL = "https://api.football-data.org/v4";

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/* --------------------------------------------------
   SAFE AXIOS WRAPPER
-------------------------------------------------- */
async function safeRequest(config) {
  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    if (error.response && error.response.status === 429) {
      console.warn("⚠️ Rate limit hit (429)");
      return { rateLimited: true };
    }
    console.error("Request error:", error.message);
    return null;
  }
}

/* --------------------------------------------------
   FOOTBALL TEAM ROUTES
-------------------------------------------------- */
app.get("/api/league-teams/:leagueCode", async (req, res) => {
  try {
    const leagueCode = req.params.leagueCode;

    const response = await safeRequest({
      method: "GET",
      url: `${BASE_URL}/competitions/${leagueCode}/teams`,
      headers: { "X-Auth-Token": FOOTBALL_DATA_KEY }
    });

    if (!response || response.rateLimited) {
      return res.json([]);
    }

    const teams = response.teams.map(team => ({
      id: team.id,
      name: team.name
    }));

    res.json(teams);

  } catch (error) {
    console.error("League teams error:", error.message);
    res.json([]);
  }
});
/* --------------------------------------------------
   TEAM ANALYSIS
-------------------------------------------------- */
app.get("/api/team-analysis/:teamId", async (req, res) => {
  try {
    const teamId = req.params.teamId;

    const response = await safeRequest({
      method: "GET",
      url: `${BASE_URL}/teams/${teamId}/matches`,
      headers: { "X-Auth-Token": FOOTBALL_DATA_KEY },
      params: { status: "FINISHED", limit: 10 }
    });

    if (!response || response.rateLimited) {
      return res.json({});
    }

    const matches = response.matches || [];
    if (!matches.length) return res.json({});

    let wins = 0, draws = 0, losses = 0;
    let goalsScored = 0, goalsConceded = 0;
    let cleanSheets = 0, failedToScore = 0;

    matches.forEach(match => {
      if (!match.score || !match.score.fullTime) return;

      const isHome = match.homeTeam.id == teamId;
      const ftHome = match.score.fullTime.home ?? 0;
      const ftAway = match.score.fullTime.away ?? 0;

      const ftScored = isHome ? ftHome : ftAway;
      const ftConceded = isHome ? ftAway : ftHome;

      goalsScored += ftScored;
      goalsConceded += ftConceded;

      if (ftScored > ftConceded) wins++;
      else if (ftScored === ftConceded) draws++;
      else losses++;

      if (ftConceded === 0) cleanSheets++;
      if (ftScored === 0) failedToScore++;
    });

    const total = matches.length;

    res.json({
      fullTime: {
        "Win %": ((wins / total) * 100).toFixed(1),
        "Draw %": ((draws / total) * 100).toFixed(1),
        "Loss %": ((losses / total) * 100).toFixed(1),
        "Avg Goals Scored": (goalsScored / total).toFixed(2),
        "Avg Goals Conceded": (goalsConceded / total).toFixed(2),
        "Clean Sheet %": ((cleanSheets / total) * 100).toFixed(1),
        "Failed To Score %": ((failedToScore / total) * 100).toFixed(1)
      }
    });

  } catch (error) {
    console.error("Team analysis error:", error.message);
    res.json({});
  }
});

/* --------------------------------------------------
   MULTI-SPORT TOP PICKS
-------------------------------------------------- */
app.get("/api/top-picks/:sport/:competition", async (req, res) => {
  const { sport, competition } = req.params;

  try {
    if (sport === "football") {
      const picks = await getFootballTopPicks(competition, FOOTBALL_DATA_KEY);
      return res.json({ sport, competition, topPicks: picks });
    }

    if (sport === "basketball") {
      const picks = await getBasketballTopPicks(competition);
      return res.json({ sport, competition, topPicks: picks });
    }

    if (sport === "darts") {
      const picks = await getDartsTopPicks(competition);
      return res.json({ sport, competition, topPicks: picks });
    }

    if (sport === "tabletennis") {
      const picks = await getTableTennisTopPicks(competition);
      return res.json({ sport, competition, topPicks: picks });
    }

    return res.status(400).json({ error: "Unsupported sport" });

  } catch (error) {
    console.error("Multi-sport error:", error.message);
    res.json({ sport, competition, topPicks: [] });
  }
});

/* --------------------------------------------------
   ACCUMULATOR
-------------------------------------------------- */
app.post("/api/accumulator", (req, res) => {
  try {
    const { selections } = req.body;
    const result = calculateAccumulator(selections);

    res.json({
      selectionsCount: selections ? selections.length : 0,
      combinedProbability: result.combinedProbability,
      decimalOdds: result.decimalOdds,
      riskLevel: result.riskLevel
    });

  } catch (error) {
    console.error("Accumulator error:", error.message);
    res.json({ combinedProbability: 0, decimalOdds: 0, riskLevel: "Error" });
  }
});

/* --------------------------------------------------
   PERFORMANCE TRACKING ROUTES
-------------------------------------------------- */
app.post("/api/performance/record", (req, res) => {
  try {
    const pick = req.body;
    const log = recordPick(pick);
    res.json(log);
  } catch (error) {
    res.json({ error: "Failed to record pick" });
  }
});

app.post("/api/performance/result", (req, res) => {
  try {
    const { id, result } = req.body;
    const updated = updatePickResult(id, result);
    res.json(updated);
  } catch (error) {
    res.json({ error: "Failed to update result" });
  }
});

app.get("/api/performance/summary", (req, res) => {
  res.json(getPerformanceSummary());
});

app.get("/api/performance/log", (req, res) => {
  res.json(getPerformanceLog());
});

/* --------------------------------------------------
   SERVER START
-------------------------------------------------- */
app.listen(PORT, () => {
  console.log(`ProPredict Server running on port ${PORT}`);
});
