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
   REMOVE BOOKMAKER OVERROUND
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
   STRENGTH GAP ADJUSTMENT
-------------------------------------------------- */
function applyStrengthGapAdjustment(hybridProbability, opponentProbability) {

  const gap = Math.abs(hybridProbability - opponentProbability);
  let adjustment = 0;

  if (gap >= 25) adjustment = 2;
  else if (gap >= 15) adjustment = 1;
  else if (gap <= 5) adjustment = -1;

  return Math.max(0, Math.min(100, hybridProbability + adjustment));
}

/* --------------------------------------------------
   CONSERVATIVE DERIVED EFFICIENCY MODEL
-------------------------------------------------- */
function applyDerivedEfficiencyAdjustment(
  hybridProbability,
  netScoreEdge
) {

  let adjustment = 0;

  if (netScoreEdge >= 10) adjustment = 1;
  else if (netScoreEdge <= -10) adjustment = -1;

  return Math.max(0, Math.min(100, hybridProbability + adjustment));
}

/* --------------------------------------------------
   HYBRID MODEL
-------------------------------------------------- */
function calculateHybridProbability(impliedProbability, marketKey) {

  let modelAdjustment = 0;

  if (marketKey === "h2h") modelAdjustment = 2;
  if (marketKey === "spreads") modelAdjustment = 1.5;
  if (marketKey === "totals") modelAdjustment = 1;
  if (marketKey === "team_totals") modelAdjustment = -1;

  if (
    marketKey === "player_points" ||
    marketKey === "player_rebounds" ||
    marketKey === "player_assists"
  ) {
    modelAdjustment = -2;
  }

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
   EXTRACT MARKETS WITH STABILIZED EFFICIENCY LOGIC
-------------------------------------------------- */
function extractMarkets(data, groupedMarkets) {

  for (const game of data.slice(0, 5)) {

    if (!game.bookmakers || game.bookmakers.length === 0) continue;

    const bookmaker = game.bookmakers[0];
    if (!bookmaker.markets) continue;

    let spreadMarket = null;
    let totalsMarket = null;

    bookmaker.markets.forEach(m => {
      if (m.key === "spreads") spreadMarket = m;
      if (m.key === "totals") totalsMarket = m;
    });

    for (const market of bookmaker.markets) {

      let adjustedImpliedList = [];

      if (market.key === "h2h") {
        adjustedImpliedList = calculateOverroundAdjustedImplied(market.outcomes);
      }

      const hybridValues = [];

      for (let i = 0; i < market.outcomes.length; i++) {

        const outcome = market.outcomes[i];

        let implied;

        if (market.key === "h2h" && adjustedImpliedList[i] !== undefined) {
          implied = adjustedImpliedList[i];
        } else {
          implied = calculateImpliedProbability(outcome.price);
        }

        const hybrid = calculateHybridProbability(implied, market.key);

        hybridValues.push({
          outcome,
          implied,
          hybrid
        });
      }

      if (market.key === "h2h" && hybridValues.length === 2) {

        let first = hybridValues[0];
        let second = hybridValues[1];

        first.hybrid =
          applyStrengthGapAdjustment(first.hybrid, second.hybrid);

        second.hybrid =
          applyStrengthGapAdjustment(second.hybrid, first.hybrid);

        if (spreadMarket && totalsMarket) {

          const totalPoint =
            totalsMarket.outcomes[0]?.point || 0;

          const spreadFirst =
            spreadMarket.outcomes.find(o =>
              o.name === first.outcome.name
            )?.point || 0;

          const spreadSecond =
            spreadMarket.outcomes.find(o =>
              o.name === second.outcome.name
            )?.point || 0;

          const impliedScoreFirst =
            (totalPoint / 2) - (spreadFirst / 2);

          const impliedScoreSecond =
            (totalPoint / 2) - (spreadSecond / 2);

          const netEdgeFirst =
            impliedScoreFirst - impliedScoreSecond;

          const netEdgeSecond =
            impliedScoreSecond - impliedScoreFirst;

          first.hybrid =
            applyDerivedEfficiencyAdjustment(
              first.hybrid,
              netEdgeFirst
            );

          second.hybrid =
            applyDerivedEfficiencyAdjustment(
              second.hybrid,
              netEdgeSecond
            );
        }

        // ✅ Clamp lowered to 82
        first.hybrid = Math.min(first.hybrid, 82);
        second.hybrid = Math.min(second.hybrid, 82);
      }

      for (const entry of hybridValues) {

        const record = {
          matchId: game.id,
          homeTeam: game.home_team,
          awayTeam: game.away_team,
          market: market.key === "h2h"
            ? `Win: ${entry.outcome.name}`
            : `${entry.outcome.name} ${entry.outcome.point || ""}`.trim(),
          impliedProbability: entry.implied.toFixed(1),
          adjustedProbability: entry.hybrid.toFixed(1),
          confidence: getConfidenceLabel(entry.hybrid)
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
