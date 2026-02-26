const express = require("express");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ Serve static frontend files (including index.html)
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

// ✅ Upcoming fixtures by league (next 10)
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
