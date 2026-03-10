const axios = require("axios");

const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
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
   NORMALIZED PICK STRUCTURE
-------------------------------------------------- */
function normalizePick(matchId, homeTeam, awayTeam, market, probability, confidence) {
  return {
    matchId,
    homeTeam,
    awayTeam,
    market,
    probability,
    confidence
  };
}

/* --------------------------------------------------
   IMPLIED PROBABILITY FROM DECIMAL ODDS
-------------------------------------------------- */
function calculateImpliedProbability(decimalOdds) {
  if (!decimalOdds || decimalOdds <= 0) return 0;
  return (1 / decimalOdds) * 100;
}

/* --------------------------------------------------
   MAP COMPETITION TO ODDS API SPORT KEY
-------------------------------------------------- */
function mapCompetitionToSportKey(competition) {
  const comp = competition.toLowerCase();

  if (comp === "nba") return "basketball_nba";
  if (comp === "wnba") return "basketball_wnba";
  if (comp === "ncaab") return "basketball_ncaab";

  // Default fallback
  return "basketball_nba";
}

/* --------------------------------------------------
   BASKETBALL TOP PICKS (REAL DATA)
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

  try {

    const sportKey = mapCompetitionToSportKey(competition);
    const apiKey = process.env.ODDS_API_KEY;

    if (!apiKey) {
      console.error("ODDS_API_KEY missing");
      return [];
    }

    const response = await axios.get(
      `${BASE_URL}/${sportKey}/odds`,
      {
        params: {
          apiKey: apiKey,
          regions: "us",
          markets: "h2h",
          oddsFormat: "decimal"
        }
      }
    );

    const games = response.data || [];
    const picks = [];

    for (const game of games.slice(0, 5)) {

      if (!game.bookmakers || game.bookmakers.length === 0) continue;

      const bookmaker = game.bookmakers[0];
      if (!bookmaker.markets) continue;

      const market = bookmaker.markets.find(m => m.key === "h2h");
      if (!market) continue;

      for (const outcome of market.outcomes) {

        const probability = calculateImpliedProbability(outcome.price);

        picks.push(
          normalizePick(
            game.id,
            game.home_team,
            game.away_team,
            `Win: ${outcome.name}`,
            probability.toFixed(1),
            getConfidenceLabel(probability)
          )
        );
      }
    }

    cache[cacheKey] = {
      data: picks,
      timestamp: now
    };

    return picks;

  } catch (error) {
    console.error("Basketball API error:", error.response?.data || error.message);
    return [];
  }
}

module.exports = {
  getBasketballTopPicks
};
