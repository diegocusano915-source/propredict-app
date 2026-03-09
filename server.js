require("dotenv").config();
const express = require("express");
const axios = require("axios");
const path = require("path");

const app = express();

/* --------------------------------------------------
   PORT CONFIGURATION
-------------------------------------------------- */
const PORT = process.env.PORT || 3000;

/* --------------------------------------------------
   ENVIRONMENT VARIABLE VALIDATION
-------------------------------------------------- */
const FOOTBALL_DATA_KEY = process.env.FOOTBALL_DATA_KEY;

if (!FOOTBALL_DATA_KEY) {
  console.error("❌ FOOTBALL_DATA_KEY is missing from environment variables.");
  process.exit(1);
}

/* --------------------------------------------------
   BASE API URL
-------------------------------------------------- */
const BASE_URL = "https://api.football-data.org/v4";

/* --------------------------------------------------
   MIDDLEWARE
-------------------------------------------------- */
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/* --------------------------------------------------
   ROOT ROUTE (Health Check)
-------------------------------------------------- */
app.get("/", (req, res) => {
  res.send("ProPredict Backend Running ✅");
});

/* --------------------------------------------------
   LIVE MATCHES
   Returns all live matches
-------------------------------------------------- */
app.get("/api/live-matches", async (req, res) => {
  try {
    const response = await axios.get(`${BASE_URL}/matches`, {
      headers: {
        "X-Auth-Token": FOOTBALL_DATA_KEY
      },
      params: {
        status: "LIVE"
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error("❌ Live matches error:");
    console.error(error.response?.data || error.message);

    res.status(500).json({
      success: false,
      message: "Failed to fetch live matches",
      error: error.response?.data || error.message
    });
  }
});

/* --------------------------------------------------
   LEAGUE FIXTURES
   Use league codes:
   PL  = Premier League
   PD  = La Liga
   BL1 = Bundesliga
   SA  = Serie A
   FL1 = Ligue 1
   CL  = Champions League
-------------------------------------------------- */
app.get("/api/league-fixtures/:leagueCode", async (req, res) => {
  try {
    const leagueCode = req.params.leagueCode;

    const response = await axios.get(
      `${BASE_URL}/competitions/${leagueCode}/matches`,
      {
        headers: {
          "X-Auth-Token": FOOTBALL_DATA_KEY
        },
        params: {
          status: "SCHEDULED"
        }
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error("❌ League fixtures error:");
    console.error(error.response?.data || error.message);

    res.status(500).json({
      success: false,
      message: "Failed to fetch league fixtures",
      error: error.response?.data || error.message
    });
  }
});

/* --------------------------------------------------
   TEAM LAST 10 COMPLETED MATCHES
   Example team IDs:
   66  = Manchester United
   64  = Liverpool
   65  = Manchester City
   57  = Arsenal
-------------------------------------------------- */
app.get("/api/team-last10/:teamId", async (req, res) => {
  try {
    const teamId = req.params.teamId;

    const response = await axios.get(
      `${BASE_URL}/teams/${teamId}/matches`,
      {
        headers: {
          "X-Auth-Token": FOOTBALL_DATA_KEY
        },
        params: {
          status: "FINISHED",
          limit: 10
        }
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error("❌ Team last 10 error:");
    console.error(error.response?.data || error.message);

    res.status(500).json({
      success: false,
      message: "Failed to fetch team last 10 matches",
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
