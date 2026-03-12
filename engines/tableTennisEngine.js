const axios = require("axios");

const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
const cache = {};

const BASE_URL = "https://api.the-odds-api.com/v4/sports";

/* ==========================================================
   COVERAGE UPDATE
   ----------------------------------------------------------
   Regions expanded from:
   "us"
   to:
   "us,uk,eu"
   This increases bookmaker availability globally.
========================================================== */

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
   IMPLIED PROBABILITY
-------------------------------------------------- */
function calculateImpliedProbability(decimalOdds) {
  if (!decimalOdds || decimalOdds <= 0) return 0;
  return (1 / decimalOdds) * 100;
}

/* --------------------------------------------------
   SAFE REQUEST
-------------------------------------------------- */
async function safeRequest(url, params) {
  try {
    const response = await axios.get(url, { params });
    return response.data;
  } catch (error) {
    console.error("Table Tennis API error:", error.response?.data || error.message);
    return null;
  }
}

/* --------------------------------------------------
   EXTRACT MARKETS
-------------------------------------------------- */
function extractMarkets(data, groupedMarkets) {

  for (const game of data.slice(0, 5)) {

    if (!game.bookmakers || game.bookmakers.length === 0) continue;

    const bookmaker = game.bookmakers[0];
    if (!bookmaker.markets) continue;

    for (const market of bookmaker.markets) {

      /* -------- H2H -------- */
      if (market.key === "h2h") {
        for (const outcome of market.outcomes) {

          const probability = calculateImpliedProbability(outcome.price);

          groupedMarkets.h2h.push({
            matchId: game.id,
            homeTeam: game.home_team,
            awayTeam: game.away_team,
            market: `Win: ${outcome.name}`,
            probability: probability.toFixed(1),
            confidence: getConfidenceLabel(probability)
          });
        }
      }

      /* -------- TOTALS -------- */
      if (market.key === "totals") {
        for (const outcome of market.outcomes) {

          const probability = calculateImpliedProbability(outcome.price);

          groupedMarkets.totals.push({
            matchId: game.id,
            homeTeam: game.home_team,
            awayTeam: game.away_team,
            market: `${outcome.name} ${outcome.point}`,
            probability: probability.toFixed(1),
            confidence: getConfidenceLabel(probability)
          });
        }
      }

    }
  }
}

/* --------------------------------------------------
   MAIN FUNCTION
-------------------------------------------------- */
async function getTableTennisTopPicks(competition) {

  const cacheKey = `tabletennis-${competition}`;
  const now = Date.now();

  if (cache[cacheKey]) {
    const age = now - cache[cacheKey].timestamp;
    if (age < CACHE_DURATION) {
      return cache[cacheKey].data;
    }
  }

  const apiKey = process.env.ODDS_API_KEY;

  const groupedMarkets = {
    h2h: [],
    totals: []
  };

  if (!apiKey) return groupedMarkets;

  const data = await safeRequest(
    `${BASE_URL}/table_tennis/odds`,
    {
      apiKey: apiKey,
      regions: "us,uk,eu", // ✅ EXPANDED COVERAGE
      markets: "h2h,totals",
      oddsFormat: "decimal"
    }
  );

  if (data) {
    extractMarkets(data, groupedMarkets);
  }

  cache[cacheKey] = {
    data: groupedMarkets,
    timestamp: now
  };

  return groupedMarkets;
}

module.exports = {
  getTableTennisTopPicks
};
