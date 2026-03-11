const axios = require("axios");
const { getCache, setCache } = require("../services/multiSportCache");

const BASE_URL = "https://api.the-odds-api.com/v4/sports";

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
   REMOVE OVERROUND
-------------------------------------------------- */
function removeOverround(impliedProbabilities) {
  const total = impliedProbabilities.reduce((sum, p) => sum + p, 0);
  if (!total || total <= 0) return impliedProbabilities;
  return impliedProbabilities.map(p => (p / total) * 100);
}

/* --------------------------------------------------
   HYBRID MODEL
-------------------------------------------------- */
function calculateHybridProbability(impliedProbability) {
  const hybrid =
    (impliedProbability * 0.85) +
    ((impliedProbability + 2) * 0.15);

  return Math.max(0, Math.min(82, hybrid));
}

/* --------------------------------------------------
   MAP COMPETITION
-------------------------------------------------- */
function mapCompetitionToSportKey(code) {
  const c = code.toUpperCase();

  if (c === "PL") return "soccer_epl";
  if (c === "SA") return "soccer_italy_serie_a";
  if (c === "BL1") return "soccer_germany_bundesliga";
  if (c === "PD") return "soccer_spain_la_liga";
  if (c === "FL1") return "soccer_france_ligue_one";

  return "soccer_epl";
}

/* --------------------------------------------------
   SAFE REQUEST
-------------------------------------------------- */
async function safeRequest(url, params) {
  try {
    const response = await axios.get(url, { params });
    return response.data;
  } catch (error) {
    console.error("Football Odds API error:", error.response?.data || error.message);
    return null;
  }
}

/* --------------------------------------------------
   EXTRACT MARKETS (DEDUP BY BEST PRICE)
-------------------------------------------------- */
function extractMarkets(data, groupedMarkets) {

  for (const game of data.slice(0, 5)) {

    if (!game.bookmakers || game.bookmakers.length === 0) continue;

    const outcomeBestPrices = {};

    for (const bookmaker of game.bookmakers) {

      const h2hMarket = bookmaker.markets.find(m => m.key === "h2h");
      if (!h2hMarket) continue;

      for (const outcome of h2hMarket.outcomes) {

        if (!outcomeBestPrices[outcome.name]) {
          outcomeBestPrices[outcome.name] = outcome.price;
        } else {
          // keep best price (highest decimal odds)
          if (outcome.price > outcomeBestPrices[outcome.name]) {
            outcomeBestPrices[outcome.name] = outcome.price;
          }
        }
      }
    }

    const prices = Object.values(outcomeBestPrices);
    const impliedList = prices.map(price =>
      calculateImpliedProbability(price)
    );

    const adjustedImplied = removeOverround(impliedList);

    const outcomeNames = Object.keys(outcomeBestPrices);

    for (let i = 0; i < outcomeNames.length; i++) {

      const outcomeName = outcomeNames[i];
      const implied = adjustedImplied[i] || 0;
      const hybrid = calculateHybridProbability(implied);

      groupedMarkets.h2h.push({
        matchId: game.id,
        homeTeam: game.home_team,
        awayTeam: game.away_team,
        market: `Win: ${outcomeName}`,
        impliedProbability: implied.toFixed(1),
        adjustedProbability: hybrid.toFixed(1),
        confidence: getConfidenceLabel(hybrid)
      });
    }
  }
}

/* --------------------------------------------------
   MAIN FUNCTION
-------------------------------------------------- */
async function getFootballOddsTopPicks(competition) {

  const cacheKey = `football-${competition}`;

  const cached = getCache(cacheKey);
  if (cached) return cached;

  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) {
    return { h2h: [] };
  }

  const sportKey = mapCompetitionToSportKey(competition);

  const groupedMarkets = {
    h2h: []
  };

  const data = await safeRequest(
    `${BASE_URL}/${sportKey}/odds`,
    {
      apiKey: apiKey,
      regions: "us",
      markets: "h2h",
      oddsFormat: "decimal"
    }
  );

  if (data) extractMarkets(data, groupedMarkets);

  setCache(cacheKey, groupedMarkets);

  return groupedMarkets;
}

module.exports = {
  getFootballOddsTopPicks
};
