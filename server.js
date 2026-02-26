const express = require("express");
require("dotenv").config();
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ Serve frontend
app.use(express.static(path.join(__dirname)));

// ✅ Today's matches
app.get("/api/matches", async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];

    const response = await fetch(
      `https://v3.football.api-sports.io/fixtures?date=${today}`,
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
    res.status(500).json({ error: "Failed to fetch matches" });
  }
});

// ✅ League-based upcoming fixtures (next 7 days)
app.get("/api/league/:id", async (req, res) => {
  try {
    const leagueId = req.params.id;

    const today = new Date();
    const next7Days = new Date();
    next7Days.setDate(today.getDate() + 7);

    const from = today.toISOString().split("T")[0];
    const to = next7Days.toISOString().split("T")[0];

    const response = await fetch(
      `https://v3.football.api-sports.io/fixtures?league=${leagueId}&season=2024&from=${from}&to=${to}`,
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
    res.status(500).json({ error: "Failed to fetch league data" });
  }
});

// ✅ Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
