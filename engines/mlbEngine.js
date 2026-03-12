const axios = require("axios");
const { getCache, setCache } = require("../services/multiSportCache");

const BASE_URL = "https://api.the-odds-api.com/v4/sports";

/* ==========================================================
   MLB ENGINE
   ----------------------------------------------------------
   - Expanded coverage: us,uk,eu
   - Hybrid probability model
   - Overround removal
   - 82% cap
   - Smart Builder compatible
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

function calculateOverroundAdjustedImplied(outcomes) {
  const impliedList = outcomes.map(o =>
    calculateImpliedProbability(o.price)
  );
  return removeOverround(impliedList);
}

/* --------------------------------------------------
   HYBRID MODEL (MLB OPTIMIZED)
-------------------------------------------------- */
function calculateHybridProbability(impliedProbability, marketKey) {

  let modelAdjustment = 0;

  if (marketKey === "h2h") modelAdjustment = 2;
  if (marketKey === "spreads") modelAdjustment = 1.5;
  if (marketKey === "totals") modelAdjustment = 1;

  const hybrid =
    (impliedProbability * 0.8) +
    ((impliedProbability + modelAdjustment) * 0.2);

  return Math.max(0, Math.min(82, hybrid));
}

/* --------------------------------------------------
   MAP COMPETITION
-------------------------------------------------- */
function mapCompetitionToSportKey(competition) {
  const comp = competition.toLowerCase();

  if (comp === "mlb") return "baseball_mlb";

  return "baseball_mlb";
}

/* --------------------------------------------------
   SAFE REQUEST
-------------------------------------------------- */
async function safeRequest(url, params) {
  try {
    const response = await axios.get(url, { params });
    return response.data;
  } catch (error) {
    console.error("MLB API error:", error.response?.data || error.message);
    return null;
  }
}

/* --------------------------------------------------
   EXTRACT MARKETS
-------------------------------------------------- */
function extractMarkets(data, groupedMarkets) {

  for (const game of data.slice(0, 10)) {

    if (!game.bookmakers || game.bookmakers.length === 0) continue;

    const bookmaker = game.bookmakers[0];
    if (!bookmaker.markets) continue;

    for (const market of bookmaker.markets) {

      let adjustedImpliedList = [];

      if (market.key === "h2h") {
        adjustedImpliedList = calculateOverroundAdjustedImplied(market.outcomes);
      }

      for (let i = 0; i < market.outcomes.length; i++) {

        const outcome = market.outcomes[i];

        let implied;

        if (market.key === "h2h" && adjustedImpliedList[i] !== undefined) {
          implied = adjustedImpliedList[i];
        } else {
          implied = calculateImpliedProbability(outcome.price);
        }

        const hybrid = calculateHybridProbability(implied, market.key);

        const record = {
          matchId: game.id,
          homeTeam: game.home_team,
          awayTeam: game.away_team,
          market: market.key === "h2h"
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
async function getMLBTopPicks(competition) {

  const cacheKey = `mlb-${competition}`;
  const cachedData = getCache(cacheKey);

  if (cachedData) {
    return cachedData;
  }

  const apiKey = process.env.ODDS_API_KEY;
  const sportKey = mapCompetitionToSportKey(competition);

  const groupedMarkets = {
    h2h: [],
    spreads: [],
    totals: []
  };

  if (!apiKey) return groupedMarkets;

  const data = await safeRequest(
    `${BASE_URL}/${sportKey}/odds`,
    {
      apiKey: apiKey,
      regions: "us,uk,eu", // ✅ Expanded coverage
      markets: "h2h,spreads,totals",
      oddsFormat: "decimal"
    }
  );

  if (data) extractMarkets(data, groupedMarkets);

  setCache(cacheKey, groupedMarkets);

  return groupedMarkets;
}

module.exports = {
  getMLBTopPicks
};
