require("dotenv").config();
const express = require("express");
const axios = require("axios");
const path = require("path");

const { getFootballTopPicks } = require("./engines/footballAdapter");
const { getBasketballTopPicks } = require("./engines/basketballEngine");
const { getDartsTopPicks } = require("./engines/dartsEngine");
const { getTableTennisTopPicks } = require("./engines/tableTennisEngine");
const { calculateAccumulator } = require("./services/accumulatorEngine");

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
   SAFE AXIOS WRAPPER
-------------------------------------------------- */
async function safeRequest(config) {
  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    if (error.response && error.response.status === 429) {
      console.warn("⚠️  Rate limit hit (429)");
      return { rateLimited: true };
    }
    console.error("Request error:", error.message);
    return null;
  }
}

/* --------------------------------------------------
   RESTORE FOOTBALL TEAM ROUTES (IMPORTANT)
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

    const stats = {
      fullTime: {},
      firstHalf: {}
    };

    matches.forEach(match => {
      if (!match.score || !match.score.fullTime) return;

      const ftHome = match.score.fullTime.home ?? 0;
      const ftAway = match.score.fullTime.away ?? 0;

      const totalGoals = ftHome + ftAway;

      stats.fullTime["Over 0.5"] =
        (stats.fullTime["Over 0.5"] || 0) + (totalGoals > 0 ? 1 : 0);

      stats.fullTime["Over 2.5"] =
        (stats.fullTime["Over 2.5"] || 0) + (totalGoals > 2 ? 1 : 0);

      stats.fullTime["BTTS"] =
        (stats.fullTime["BTTS"] || 0) +
        (ftHome > 0 && ftAway > 0 ? 1 : 0);
    });

    const totalMatches = matches.length || 1;

    Object.keys(stats.fullTime).forEach(key => {
      stats.fullTime[key] =
        ((stats.fullTime[key] / totalMatches) * 100).toFixed(1);
    });

    res.json(stats);

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

    if (sport.toLowerCase() === "football") {
      const picks = await getFootballTopPicks(
        competition,
        FOOTBALL_DATA_KEY
      );
      return res.json({ sport, competition, topPicks: picks });
    }

    if (sport.toLowerCase() === "basketball") {
      const picks = await getBasketballTopPicks(competition);
      return res.json({ sport, competition, topPicks: picks });
    }

    if (sport.toLowerCase() === "darts") {
      const picks = await getDartsTopPicks(competition);
      return res.json({ sport, competition, topPicks: picks });
    }

    if (sport.toLowerCase() === "tabletennis") {
      const picks = await getTableTennisTopPicks(competition);
      return res.json({ sport, competition, topPicks: picks });
    }

    return res.status(400).json({ error: "Unsupported sport" });

  } catch (error) {
    console.error("Multi-sport route error:", error.message);
    return res.json({ sport, competition, topPicks: [] });
  }

});

/* --------------------------------------------------
   ELITE PICKS ROUTE
-------------------------------------------------- */
app.get("/api/elite/:sport/:competition", async (req, res) => {

  const { sport, competition } = req.params;

  try {

    let picks;

    if (sport.toLowerCase() === "football") {
      picks = await getFootballTopPicks(
        competition,
        FOOTBALL_DATA_KEY
      );
    }

    if (sport.toLowerCase() === "basketball") {
      picks = await getBasketballTopPicks(competition);
    }

    if (sport.toLowerCase() === "darts") {
      picks = await getDartsTopPicks(competition);
    }

    if (sport.toLowerCase() === "tabletennis") {
      picks = await getTableTennisTopPicks(competition);
    }

    const elite = picks;

    return res.json({
      sport,
      competition,
      elitePicks: elite
    });

  } catch (error) {
    console.error("Elite route error:", error.message);
    return res.json({
      sport,
      competition,
      elitePicks: []
    });
  }

});

/* --------------------------------------------------
   ACCUMULATOR ROUTE
-------------------------------------------------- */
app.post("/api/accumulator", (req, res) => {

  try {

    const { selections } = req.body;
    const result = calculateAccumulator(selections);

    return res.json({
      selectionsCount: selections ? selections.length : 0,
      combinedProbability: result.combinedProbability,
      decimalOdds: result.decimalOdds,
      riskLevel: result.riskLevel
    });

  } catch (error) {
    console.error("Accumulator error:", error.message);

    return res.json({
      combinedProbability: 0,
      decimalOdds: 0,
      riskLevel: "Error"
    });
  }

});

/* --------------------------------------------------
   SERVER START
-------------------------------------------------- */
app.listen(PORT, () => {
  console.log(`ProPredict Server running on port ${PORT}`);
});
