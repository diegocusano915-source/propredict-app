const axios = require("axios");

const CACHE_DURATION = 10 * 60 * 1000;
const cache = {};

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
   ✅ NEW — REMOVE BOOKMAKER OVERROUND (VIG)
   Normalizes implied probabilities so total = 100%
-------------------------------------------------- */
function removeOverround(impliedProbabilities) {
  const total = impliedProbabilities.reduce((sum, p) => sum + p, 0);

  if (!total || total <= 0) return impliedProbabilities;

  return impliedProbabilities.map(p => (p / total) * 100);
}

/* --------------------------------------------------
   ✅ NEW — CALCULATE TRUE IMPLIED PROBABILITY
   (Only used for moneyline markets)
-------------------------------------------------- */
function calculateOverroundAdjustedImplied(outcomes) {

  const impliedList = outcomes.map(o =>
    calculateImpliedProbability(o.price)
  );

  const normalized = removeOverround(impliedList);

  return normalized;
}

/* --------------------------------------------------
   HYBRID ADJUSTMENT MODEL
   Combines bookmaker probability with market strength bias
-------------------------------------------------- */
function calculateHybridProbability(impliedProbability, marketKey) {

  let modelAdjustment = 0;

  /*
    Market strength adjustments:
    Core markets are more reliable than props.
  */

  if (marketKey === "h2h") {
    modelAdjustment = 2; // slight confidence boost
  }

  if (marketKey === "spreads") {
    modelAdjustment = 1.5;
  }

  if (marketKey === "totals") {
    modelAdjustment = 1;
  }

  if (marketKey === "team_totals") {
    modelAdjustment = -1;
  }

  if (marketKey === "player_points" ||
      marketKey === "player_rebounds" ||
      marketKey === "player_assists") {
    modelAdjustment = -2;
  }

  /*
    Hybrid formula:
    80% bookmaker implied
    20% model bias
  */

  const hybrid =
    (impliedProbability * 0.8) +
    ((impliedProbability + modelAdjustment) * 0.2);

  return Math.max(0, Math.min(100, hybrid));
}
/* --------------------------------------------------
   MAP COMPETITION
-------------------------------------------------- */
function mapCompetitionToSportKey(competition) {
  const comp = competition.toLowerCase();

  if (comp === "nba") return "basketball_nba";
  if (comp === "wnba") return "basketball_wnba";
  if (comp === "ncaab") return "basketball_ncaab";

  return "basketball_nba";
}

/* --------------------------------------------------
   SAFE REQUEST
-------------------------------------------------- */
async function safeRequest(url, params) {
  try {
    const response = await axios.get(url, { params });
    return response.data;
  } catch (error) {
    console.error("Basketball API error:", error.response?.data || error.message);
    return null;
  }
}

/* --------------------------------------------------
   EXTRACT MARKETS WITH HYBRID LOGIC
   ✅ h2h markets now use overround-adjusted probability
-------------------------------------------------- */
function extractMarkets(data, groupedMarkets) {

  for (const game of data.slice(0, 5)) {

    if (!game.bookmakers || game.bookmakers.length === 0) continue;

    const bookmaker = game.bookmakers[0];
    if (!bookmaker.markets) continue;

    for (const market of bookmaker.markets) {

      let adjustedImpliedList = [];

      // ✅ Only normalize overround for moneyline (h2h)
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
async function getBasketballTopPicks(competition) {

  const cacheKey = `basketball-${competition}`;
  const now = Date.now();

  if (cache[cacheKey]) {
    const age = now - cache[cacheKey].timestamp;
    if (age < CACHE_DURATION) {
      return cache[cacheKey].data;
    }
  }

  const apiKey = process.env.ODDS_API_KEY;
  const sportKey = mapCompetitionToSportKey(competition);

  const groupedMarkets = {
    h2h: [],
    spreads: [],
    totals: [],
    team_totals: [],
    player_points: [],
    player_rebounds: [],
    player_assists: []
  };

  if (!apiKey) return groupedMarkets;

  /* -------- CORE MARKETS -------- */
  const coreData = await safeRequest(
    `${BASE_URL}/${sportKey}/odds`,
    {
      apiKey: apiKey,
      regions: "us",
      markets: "h2h,spreads,totals",
      oddsFormat: "decimal"
    }
  );

  if (coreData) extractMarkets(coreData, groupedMarkets);

  /* -------- EXTENDED MARKETS -------- */
  const extendedData = await safeRequest(
    `${BASE_URL}/${sportKey}/odds`,
    {
      apiKey: apiKey,
      regions: "us",
      markets: "team_totals,player_points,player_rebounds,player_assists",
      oddsFormat: "decimal"
    }
  );

  if (extendedData) extractMarkets(extendedData, groupedMarkets);

  cache[cacheKey] = {
    data: groupedMarkets,
    timestamp: now
  };

  return groupedMarkets;
}

module.exports = {
  getBasketballTopPicks
};
