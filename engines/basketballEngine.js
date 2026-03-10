const CACHE_DURATION = 10 * 60 * 1000;

const cache = {};

/* --------------------------------------------------
   CONFIDENCE ENGINE (SHARED LOGIC STYLE)
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
   BASKETBALL TOP PICKS (ARCHITECTURE PLACEHOLDER)
-------------------------------------------------- */
async function getBasketballTopPicks(competition) {

  const cacheKey = `basketball-top-picks-${competition}`;
  const now = Date.now();

  // Return cached if valid
  if (cache[cacheKey]) {
    const cacheAge = now - cache[cacheKey].timestamp;
    if (cacheAge < CACHE_DURATION) {
      return cache[cacheKey].data;
    }
  }

  /*
    IMPORTANT:
    No external API connected yet.
    No simulated matches.
    No fake probabilities.

    This returns an empty array until
    a real provider is connected.
  */

  const picks = [];

  cache[cacheKey] = {
    data: picks,
    timestamp: now
  };

  return picks;
}

module.exports = {
  getBasketballTopPicks,
  normalizePick
};
