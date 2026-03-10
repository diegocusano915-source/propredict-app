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
   LEAGUE TEAMS (FOOTBALL ONLY)
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
   EXPANDED TEAM ANALYSIS (FOOTBALL ONLY)
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

    let wins = 0;
    let draws = 0;
    let losses = 0;
    let goalsScored = 0;
    let goalsConceded = 0;
    let cleanSheets = 0;
    let failedToScore = 0;

    let fhWins = 0;
    let fhDraws = 0;
    let fhLosses = 0;
    let fhOver05 = 0;
    let fhOver15 = 0;
    let fhBTTS = 0;

    matches.forEach(match => {

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

      goalsScored += ftScored;
      goalsConceded += ftConceded;

      if (ftScored > ftConceded) wins++;
      else if (ftScored === ftConceded) draws++;
      else losses++;

      if (ftConceded === 0) cleanSheets++;
      if (ftScored === 0) failedToScore++;

      if (fhScored > fhConceded) fhWins++;
      else if (fhScored === fhConceded) fhDraws++;
      else fhLosses++;

      if ((fhHome + fhAway) > 0) fhOver05++;
      if ((fhHome + fhAway) > 1) fhOver15++;
      if (fhHome > 0 && fhAway > 0) fhBTTS++;
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
      },
      firstHalf: {
        "FH Win %": ((fhWins / total) * 100).toFixed(1),
        "FH Draw %": ((fhDraws / total) * 100).toFixed(1),
        "FH Loss %": ((fhLosses / total) * 100).toFixed(1),
        "FH Over 0.5 %": ((fhOver05 / total) * 100).toFixed(1),
        "FH Over 1.5 %": ((fhOver15 / total) * 100).toFixed(1),
        "FH BTTS %": ((fhBTTS / total) * 100).toFixed(1)
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
    console.error("Multi-sport error:", error.message);
    return res.json({ sport, competition, topPicks: [] });
  }
});

/* --------------------------------------------------
   ELITE PICKS
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

    return res.json({
      sport,
      competition,
      elitePicks: picks || []
    });

  } catch (error) {
    console.error("Elite route error:", error.message);
    res.json({ sport, competition, elitePicks: [] });
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
    res.json({
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
