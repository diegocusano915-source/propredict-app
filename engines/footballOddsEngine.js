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
   REMOVE OVERROUND (FOR 1X2)
-------------------------------------------------- */
function removeOverround(impliedProbabilities) {
  const total = impliedProbabilities.reduce((sum, p) => sum + p, 0);
  if (!total || total <= 0) return impliedProbabilities;
  return impliedProbabilities.map(p => (p / total) * 100);
}

/* --------------------------------------------------
   HYBRID MODEL (LIGHT VERSION FOR SOCCER)
-------------------------------------------------- */
function calculateHybridProbability(impliedProbability, marketKey) {

  let adjustment = 0;

  if (marketKey === "h2h") adjustment = 2;
  if (marketKey === "spreads") adjustment = 1;
  if (marketKey === "totals") adjustment = 1;

  const hybrid =
    (impliedProbability * 0.85) +
    ((impliedProbability + adjustment) * 0.15);

  return Math.max(0, Math.min(82, hybrid)); // 82% clamp
}

/* --------------------------------------------------
   MAP COMPETITION TO ODDS API KEY
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
   EXTRACT MARKETS
-------------------------------------------------- */
function extractMarkets(data, groupedMarkets) {

  for (const game of data.slice(0, 5)) {

    if (!game.bookmakers || game.bookmakers.length === 0) continue;

    const bookmaker = game.bookmakers[0];
    if (!bookmaker.markets) continue;

    for (const market of bookmaker.markets) {

      const impliedList = market.outcomes.map(o =>
        calculateImpliedProbability(o.price)
      );

      let adjustedImplied = impliedList;

      if (market.key === "h2h") {
        adjustedImplied = removeOverround(impliedList);
      }

      for (let i = 0; i < market.outcomes.length; i++) {

        const outcome = market.outcomes[i];

        const implied = adjustedImplied[i] || 0;
        const hybrid = calculateHybridProbability(implied, market.key);

        const record = {
          matchId: game.id,
          homeTeam: game.home_team,
          awayTeam: game.away_team,
          market:
            market.key === "h2h"
              ? `Win: ${outcome.name}`
              : `${outcome.name} ${outcome.point || ""}`.trim(),
          impliedProbability: implied.toFixed(1),
          adjustedProbability: hybrid.toFixed(1),
          confidence: getConfidenceLabel(hybrid)
        };

        if (groupedMarkets[market.key]) {
          groupedMarkets[market.key].push(record);
        }
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
  if (!apiKey) return {
    h2h: [],
    spreads: [],
    totals: [],
    team_totals: []
  };

  const sportKey = mapCompetitionToSportKey(competition);

  const groupedMarkets = {
    h2h: [],
    spreads: [],
    totals: [],
    team_totals: []
  };

  const data = await safeRequest(
    `${BASE_URL}/${sportKey}/odds`,
    {
      apiKey: apiKey,
      regions: "us", // ✅ FIXED REGION
      markets: "h2h,spreads,totals,team_totals",
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
