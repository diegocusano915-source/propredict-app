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
   EXTRACT MARKETS
-------------------------------------------------- */
function extractMarkets(data, groupedMarkets) {

  for (const game of data.slice(0, 5)) {

    if (!game.bookmakers || game.bookmakers.length === 0) continue;

    const bookmaker = game.bookmakers[0];
    if (!bookmaker.markets) continue;

    for (const market of bookmaker.markets) {

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

      if (market.key === "spreads") {
        for (const outcome of market.outcomes) {
          const probability = calculateImpliedProbability(outcome.price);
          groupedMarkets.spreads.push({
            matchId: game.id,
            homeTeam: game.home_team,
            awayTeam: game.away_team,
            market: `${outcome.name} ${outcome.point}`,
            probability: probability.toFixed(1),
            confidence: getConfidenceLabel(probability)
          });
        }
      }

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

      if (market.key === "team_totals") {
        for (const outcome of market.outcomes) {
          const probability = calculateImpliedProbability(outcome.price);
          groupedMarkets.team_totals.push({
            matchId: game.id,
            homeTeam: game.home_team,
            awayTeam: game.away_team,
            market: `${outcome.name} ${outcome.point}`,
            probability: probability.toFixed(1),
            confidence: getConfidenceLabel(probability)
          });
        }
      }

      if (market.key === "player_points") {
        for (const outcome of market.outcomes) {
          const probability = calculateImpliedProbability(outcome.price);
          groupedMarkets.player_points.push({
            matchId: game.id,
            homeTeam: game.home_team,
            awayTeam: game.away_team,
            market: `${outcome.name} ${outcome.point}`,
            probability: probability.toFixed(1),
            confidence: getConfidenceLabel(probability)
          });
        }
      }

      if (market.key === "player_rebounds") {
        for (const outcome of market.outcomes) {
          const probability = calculateImpliedProbability(outcome.price);
          groupedMarkets.player_rebounds.push({
            matchId: game.id,
            homeTeam: game.home_team,
            awayTeam: game.away_team,
            market: `${outcome.name} ${outcome.point}`,
            probability: probability.toFixed(1),
            confidence: getConfidenceLabel(probability)
          });
        }
      }

      if (market.key === "player_assists") {
        for (const outcome of market.outcomes) {
          const probability = calculateImpliedProbability(outcome.price);
          groupedMarkets.player_assists.push({
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
