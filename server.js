const express = require("express");
const fetch = require("node-fetch");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("ProPredict API is running ✅");
});

app.get("/api/matches", async (req, res) => {
  try {
    const response = await fetch(
      https://v3.football.api-sports.io/fixtures?date=${new Date().toISOString().split("T")[0]}`,
      {
        headers: {
          "x-apisports-key": process.env.API_KEY,
        },
      }
    );

    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch matches" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
