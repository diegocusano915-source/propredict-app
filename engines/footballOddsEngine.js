const axios = require("axios");
const { getCache, setCache } = require("../services/multiSportCache");

const BASE_URL = "https://api.the-odds-api.com/v4/sports";

/* ==========================================================
   COVERAGE UPDATE
   ----------------------------------------------------------
   Using minimal working configuration to ensure
   consistent EPL data retrieval.
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
  if (c === "EFL") return "soccer_england_championship";
  if (c === "BL2") return "soccer_germany_bundesliga2";
  if (c === "SB") return "soccer_italy_serie_b";
  if (c === "FL2") return "soccer_france_ligue_two";
  if (c === "SD") return "soccer_spain_segunda_division";
  if (c === "SPL") return "soccer_saudi_arabia_pro_league";
  if (c === "J1") return "soccer_japan_j1_league";
  if (c === "ALLS") return "soccer_sweden_allsvenskan";
  if (c === "UCL") return "soccer_uefa_champs_league";
  if (c === "UEL") return "soccer_uefa_europa_league";

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
   EXTRACT MARKETS
-------------------------------------------------- */
function extractMarkets(data, groupedMarkets) {

  for (const game of data.slice(0, 15)) {

    if (!game.bookmakers || !Array.isArray(game.bookmakers)) continue;

    const bestH2HPrices = {};

    for (const bookmaker of game.bookmakers) {

      if (!bookmaker.markets) continue;

      for (const market of bookmaker.markets) {

        if (market.key === "h2h" && Array.isArray(market.outcomes)) {
          for (const outcome of market.outcomes) {
            if (!bestH2HPrices[outcome.name] ||
                outcome.price > bestH2HPrices[outcome.name]) {
              bestH2HPrices[outcome.name] = outcome.price;
            }
          }
        }
      }
    }

    const h2hNames = Object.keys(bestH2HPrices);
    const h2hPrices = Object.values(bestH2HPrices);

    if (h2hNames.length > 1) {

      const h2hImplied = h2hPrices.map(price =>
        calculateImpliedProbability(price)
      );

      const h2hAdjusted = removeOverround(h2hImplied);

      for (let i = 0; i < h2hNames.length; i++) {

        const name = h2hNames[i];
        const implied = h2hAdjusted[i] || 0;
        const hybrid = calculateHybridProbability(implied);

        groupedMarkets.h2h.push({
          matchId: game.id,
          homeTeam: game.home_team,
          awayTeam: game.away_team,
          market: `Win: ${name}`,
          impliedProbability: implied.toFixed(1),
          adjustedProbability: hybrid.toFixed(1),
          confidence: getConfidenceLabel(hybrid)
        });
      }
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
    return { h2h: [], double_chance: [], totals: [] };
  }

  const sportKey = mapCompetitionToSportKey(competition);

  const groupedMarkets = {
    h2h: [],
    double_chance: [],
    totals: []
  };

  const data = await safeRequest(
    `${BASE_URL}/${sportKey}/odds`,
    {
      apiKey: apiKey,
      regions: "uk",
      markets: "h2h",
      oddsFormat: "decimal"
    }
  );

  if (Array.isArray(data) && data.length > 0) {
    extractMarkets(data, groupedMarkets);
  }

  setCache(cacheKey, groupedMarkets);

  return groupedMarkets;
}

module.exports = {
  getFootballOddsTopPicks
};
