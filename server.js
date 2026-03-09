require("dotenv").config();
const express = require("express");
const axios = require("axios");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

/* ----------------------------------
   ENVIRONMENT VARIABLE CHECK
---------------------------------- */
const API_KEY = process.env.API_FOOTBALL_KEY;

if (!API_KEY) {
  console.error("❌ API_FOOTBALL_KEY is missing from environment variables.");
  process.exit(1);
}

const BASE_URL = "https://v3.football.api-sports.io";

/* ----------------------------------
   MIDDLEWARE
---------------------------------- */
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/* ----------------------------------
   LIVE MATCHES
---------------------------------- */
app.get("/api/live-matches", async (req, res) => {
  try {
    const response = await axios.get(`${BASE_URL}/fixtures`, {
      headers: {
        "x-apisports-key": API_KEY
      },
      params: {
        live: "all"
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error("Live match error:", error.response?.data || error.message);
    res.status(500).json({
      error: "Live match fetch failed",
      details: error.response?.data || error.message
    });
  }
});

/* ----------------------------------
   LEAGUE FIXTURES
---------------------------------- */
app.get("/api/league-fixtures/:leagueId", async (req, res) => {
  try {
    const response = await axios.get(`${BASE_URL}/fixtures`, {
      headers: {
        "x-apisports-key": API_KEY
      },
      params: {
        league: req.params.leagueId,
        next: 20
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error("League fixtures error:", error.response?.data || error.message);
    res.status(500).json({
      error: "League fixtures fetch failed",
      details: error.response?.data || error.message
    });
  }
});

/* ----------------------------------
   TEAM LAST 10 COMPLETED MATCHES
---------------------------------- */
app.get("/api/team-last10/:teamId", async (req, res) => {
  try {
    const response = await axios.get(`${BASE_URL}/fixtures`, {
      headers: {
        "x-apisports-key": API_KEY
      },
      params: {
        team: req.params.teamId,
        last: 10,
        status: "FT"
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error("Team last 10 error:", error.response?.data || error.message);
    res.status(500).json({
      error: "Team last 10 fetch failed",
      details: error.response?.data || error.message
    });
  }
});

/* ----------------------------------
   START SERVER
---------------------------------- */
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
