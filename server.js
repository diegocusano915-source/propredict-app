const express = require("express");
require("dotenv").config();
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Serve frontend
app.use(express.static(path.join(__dirname)));

// ✅ LIVE matches only
app.get("/api/matches", async (req, res) => {
  try {
    const response = await fetch(
      `https://v3.football.api-sports.io/fixtures?live=all`,
      {
        headers: {
          "x-apisports-key": process.env.API_KEY,
        },
      }
    );

    const data = await response.json();
    res.json(data);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch live matches" });
  }
});

// ✅ Upcoming next 10 fixtures by league
app.get("/api/league/:id", async (req, res) => {
  try {
    const leagueId = req.params.id;

    const response = await fetch(
      `https://v3.football.api-sports.io/fixtures?league=${leagueId}&next=10`,
      {
        headers: {
          "x-apisports-key": process.env.API_KEY,
        },
      }
    );

    const data = await response.json();
    res.json(data);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch league fixtures" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
