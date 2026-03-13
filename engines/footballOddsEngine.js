const axios = require("axios");
const { getCache, setCache } = require("../services/multiSportCache");

const BASE_URL = "https://api.the-odds-api.com/v4/sports";

/* ==========================================================
   COVERAGE UPDATE
   ----------------------------------------------------------
   Regions optimized from:
   "us,uk,eu,au,ca"
   to:
   "uk,eu,us"
   This reduces API credit consumption while maintaining
   strong bookmaker coverage.
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
   MAP COMPETITION (EXPANDED + CORRECTED)
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

    if (!game.bookmakers || game.bookmakers.length === 0) continue;

    const bestH2HPrices = {};
    const bestTotalsPrices = {};

    for (const bookmaker of game.bookmakers) {

      for (const market of bookmaker.markets) {

        if (market.key === "h2h") {
          for (const outcome of market.outcomes) {
            if (!bestH2HPrices[outcome.name] ||
                outcome.price > bestH2HPrices[outcome.name]) {
              bestH2HPrices[outcome.name] = outcome.price;
            }
          }
        }

        if (market.key === "totals") {
          for (const outcome of market.outcomes) {
            const line = outcome.point;
            const key = `${line}_${outcome.name}`;
            if (!bestTotalsPrices[key] ||
                outcome.price > bestTotalsPrices[key]) {
              bestTotalsPrices[key] = outcome.price;
            }
          }
        }
      }
    }

    const h2hNames = Object.keys(bestH2HPrices);
    const h2hPrices = Object.values(bestH2HPrices);

    const h2hImplied = h2hPrices.map(price =>
      calculateImpliedProbability(price)
    );

    const h2hAdjusted = removeOverround(h2hImplied);

    const probabilityMap = {};

    for (let i = 0; i < h2hNames.length; i++) {

      const name = h2hNames[i];
      const implied = h2hAdjusted[i] || 0;
      const hybrid = calculateHybridProbability(implied);

      probabilityMap[name] = hybrid;

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

    const home = game.home_team;
    const away = game.away_team;

    const homeProb = probabilityMap[home] || 0;
    const awayProb = probabilityMap[away] || 0;
    const drawProb = probabilityMap["Draw"] || 0;

    const dcMarkets = [
      { name: `${home} or Draw`, value: homeProb + drawProb },
      { name: `${away} or Draw`, value: awayProb + drawProb },
      { name: `${home} or ${away}`, value: homeProb + awayProb }
    ];

    for (const dc of dcMarkets) {
      const hybrid = Math.min(dc.value, 82);

      groupedMarkets.double_chance.push({
        matchId: game.id,
        homeTeam: home,
        awayTeam: away,
        market: dc.name,
        impliedProbability: dc.value.toFixed(1),
        adjustedProbability: hybrid.toFixed(1),
        confidence: getConfidenceLabel(hybrid)
      });
    }

    const totalsByLine = {};

    for (const key in bestTotalsPrices) {

      const [line, type] = key.split("_");
      const price = bestTotalsPrices[key];

      if (!totalsByLine[line]) {
        totalsByLine[line] = {};
      }

      totalsByLine[line][type] = price;
    }

    const sortedLines = Object.keys(totalsByLine)
      .map(Number)
      .sort((a, b) => a - b);

    for (const line of sortedLines) {

      const lineMarkets = totalsByLine[line];
      const types = Object.keys(lineMarkets);

      for (const type of types) {

        const price = lineMarkets[type];
        const implied = calculateImpliedProbability(price);
        const hybrid = calculateHybridProbability(implied);

        groupedMarkets.totals.push({
          matchId: game.id,
          homeTeam: game.home_team,
          awayTeam: game.away_team,
          market: `${type} ${line}`,
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

  const now = new Date();
  const sevenDaysAhead = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));

  const data = await safeRequest(
    `${BASE_URL}/${sportKey}/odds`,
    {
      apiKey: apiKey,
      regions: "uk,eu,us",
      markets: "h2h,totals",
      oddsFormat: "decimal",
      commenceTimeFrom: now.toISOString(),
      commenceTimeTo: sevenDaysAhead.toISOString()
    }
  );

  if (data) extractMarkets(data, groupedMarkets);

  groupedMarkets.h2h.sort((a, b) =>
    parseFloat(b.adjustedProbability) - parseFloat(a.adjustedProbability)
  );

  groupedMarkets.double_chance.sort((a, b) =>
    parseFloat(b.adjustedProbability) - parseFloat(a.adjustedProbability)
  );

  setCache(cacheKey, groupedMarkets);

  return groupedMarkets;
}

module.exports = {
  getFootballOddsTopPicks
};
