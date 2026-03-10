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
   WEIGHTED FORM ENGINE (UNCHANGED)
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

    if (!match.score || !match.score.fullTime) return;

    const isHome = match.homeTeam.id == teamId;

    const ftHome = match.score.fullTime.home ?? 0;
    const ftAway = match.score.fullTime.away ?? 0;

    const fhHome = match.score.halfTime?.home ?? 0;
    const fhAway = match.score.halfTime?.away ?? 0;

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
    console.error("Teams fetch error:", error.message);
    res.json({ league: req.params.leagueCode, teams: [] });
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
