require("dotenv").config();
const express = require("express");
const axios = require("axios");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const API_KEY = process.env.API_FOOTBALL_KEY;
const BASE_URL = "https://v3.football.api-sports.io";

/* Safety check */
if (!API_KEY) {
  console.error("API_FOOTBALL_KEY missing in .env file");
  process.exit(1);
}

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/* Live Matches */
app.get("/api/live-matches", async (req, res) => {
  try {
    const response = await axios.get(`${BASE_URL}/fixtures`, {
      headers: { "x-apisports-key": API_KEY },
      params: { live: "all" }
    });

    res.json(response.data.response);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: "Failed to fetch live matches" });
  }
});

/* League Fixtures */
app.get("/api/league-fixtures/:leagueId", async (req, res) => {
  try {
    const response = await axios.get(`${BASE_URL}/fixtures`, {
      headers: { "x-apisports-key": API_KEY },
      params: {
        league: req.params.leagueId,
        next: 20
      }
    });

    res.json(response.data.response);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: "Failed to fetch league fixtures" });
  }
});

/* Team Last 10 Completed Matches */
app.get("/api/team-last10/:teamId", async (req, res) => {
  try {
    const response = await axios.get(`${BASE_URL}/fixtures`, {
      headers: { "x-apisports-key": API_KEY },
      params: {
        team: req.params.teamId,
        last: 10,
        status: "FT"
      }
    });

    res.json(response.data.response);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: "Failed to fetch team last 10 matches" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
