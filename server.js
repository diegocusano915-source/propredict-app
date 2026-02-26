const express = require("express");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ Serve frontend
app.use(express.static(__dirname));


// ✅ LIVE matches
app.get("/api/matches", async (req, res) => {
  try {
    const response = await fetch(
      "https://v3.football.api-sports.io/fixtures?live=all",
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


// ✅ League fixtures (season only — free plan safe)
app.get("/api/league/:id", async (req, res) => {
  try {
    const leagueId = req.params.id;

    const response = await fetch(
      `https://v3.football.api-sports.io/fixtures?league=${leagueId}&season=2024`,
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


// ✅ Head-to-Head (free plan safe — no last parameter)
app.get("/api/h2h/:home/:away", async (req, res) => {
  try {
    const { home, away } = req.params;

    const response = await fetch(
      `https://v3.football.api-sports.io/fixtures/headtohead?h2h=${home}-${away}`,
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
    res.status(500).json({ error: "Failed to fetch H2H data" });
  }
});

// ✅ Team last 10 matches
app.get("/api/team/:id", async (req, res) => {
  try {
    const teamId = req.params.id;

    const response = await fetch(
      `https://v3.football.api-sports.io/fixtures?team=${teamId}&season=2024`,
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
    res.status(500).json({ error: "Failed to fetch team stats" });
  }
});
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
