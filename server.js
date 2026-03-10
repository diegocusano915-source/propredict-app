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
   ELITE FILTER ENGINE
-------------------------------------------------- */
function filterElitePicks(topPicks) {

  if (!topPicks) return [];

  const threshold = 70;

  /* If grouped markets */
  if (typeof topPicks === "object" && !Array.isArray(topPicks)) {

    const filtered = {};

    for (const marketKey in topPicks) {

      const marketArray = topPicks[marketKey];

      if (!Array.isArray(marketArray)) continue;

      filtered[marketKey] = marketArray.filter(pick => {

        const adjusted =
          parseFloat(pick.adjustedProbability) ||
          parseFloat(pick.impliedProbability) ||
          parseFloat(pick.probability);

        return (
          adjusted >= threshold ||
          pick.confidence === "Strong" ||
          pick.confidence === "Elite"
        );
      });
    }

    return filtered;
  }

  /* If flat array (football adapter) */
  if (Array.isArray(topPicks)) {

    return topPicks.filter(pick => {

      const adjusted =
        parseFloat(pick.adjustedProbability) ||
        parseFloat(pick.impliedProbability) ||
        parseFloat(pick.probability);

      return (
        adjusted >= threshold ||
        pick.confidence === "Strong" ||
        pick.confidence === "Elite"
      );
    });
  }

  return [];
}
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

    const elite = filterElitePicks(picks);

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
