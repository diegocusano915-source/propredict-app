/* --------------------------------------------------
   RISK CLASSIFICATION ENGINE
-------------------------------------------------- */
function classifyRisk(combinedProbability) {
  const value = parseFloat(combinedProbability);

  if (value >= 70) return "Low Risk";
  if (value >= 50) return "Moderate Risk";
  if (value >= 30) return "High Risk";
  return "Extreme Risk";
}

/* --------------------------------------------------
   EXTRACT BEST AVAILABLE PROBABILITY
-------------------------------------------------- */
function extractProbability(pick) {

  if (pick.adjustedProbability !== undefined) {
    return parseFloat(pick.adjustedProbability);
  }

  if (pick.impliedProbability !== undefined) {
    return parseFloat(pick.impliedProbability);
  }

  if (pick.probability !== undefined) {
    return parseFloat(pick.probability);
  }

  return 0;
}

/* --------------------------------------------------
   BASIC ACCUMULATOR CALCULATION (MANUAL MODE)
-------------------------------------------------- */
function calculateAccumulator(selections) {

  if (!Array.isArray(selections) || selections.length === 0) {
    return {
      combinedProbability: 0,
      decimalOdds: 0,
      riskLevel: "No Selections"
    };
  }

  let combinedProbabilityDecimal = 1;

  for (const pick of selections) {

    const probabilityPercent = extractProbability(pick);
    if (!probabilityPercent || probabilityPercent <= 0) continue;

    const probabilityDecimal = probabilityPercent / 100;
    combinedProbabilityDecimal *= probabilityDecimal;
  }

  const combinedProbabilityPercent =
    (combinedProbabilityDecimal * 100).toFixed(2);

  const decimalOdds =
    combinedProbabilityDecimal > 0
      ? (1 / combinedProbabilityDecimal).toFixed(2)
      : 0;

  return {
    combinedProbability: combinedProbabilityPercent,
    decimalOdds: decimalOdds,
    riskLevel: classifyRisk(combinedProbabilityPercent)
  };
}

/* --------------------------------------------------
   TIER CONFIGURATION
-------------------------------------------------- */
function getTierConfig(tier) {

  switch (tier) {

    case "conservative":
      return { minOdds: 10, maxOdds: 20, minProb: 70 };

    case "balanced":
      return { minOdds: 20, maxOdds: 50, minProb: 65 };

    case "aggressive":
      return { minOdds: 50, maxOdds: 100, minProb: 60 };

    case "highrisk":
      return { minOdds: 100, maxOdds: 160, minProb: 55 };

    default:
      return { minOdds: 10, maxOdds: 20, minProb: 65 };
  }
}

/* --------------------------------------------------
   SMART ACCUMULATOR GENERATOR (MIDPOINT OPTIMIZED)
-------------------------------------------------- */
function generateSmartAccumulator(allMarkets, options = {}) {

  const tier = options.tier || "balanced";
  const { minOdds, maxOdds, minProb } = getTierConfig(tier);

  const targetMid = (minOdds + maxOdds) / 2;

  if (!allMarkets || typeof allMarkets !== "object") {
    return { selections: [], combinedProbability: 0, decimalOdds: 0 };
  }

  const flattened = [];

  for (const marketKey in allMarkets) {

    const picks = allMarkets[marketKey];
    if (!Array.isArray(picks)) continue;

    for (const pick of picks) {

      const probability = extractProbability(pick);

      if (probability >= minProb) {
        flattened.push({
          ...pick,
          probability
        });
      }
    }
  }

  flattened.sort((a, b) => b.probability - a.probability);

  let bestResult = null;

  for (let start = 0; start < flattened.length; start++) {

    const selected = [];
    const usedMatches = new Set();

    let combinedProbabilityDecimal = 1;
    let currentOdds = 1;

    for (let i = start; i < flattened.length; i++) {

      const pick = flattened[i];

      if (usedMatches.has(pick.matchId)) continue;

      const probabilityDecimal = pick.probability / 100;

      combinedProbabilityDecimal *= probabilityDecimal;
      currentOdds = 1 / combinedProbabilityDecimal;

      selected.push(pick);
      usedMatches.add(pick.matchId);

      if (currentOdds >= minOdds && currentOdds <= maxOdds) {

        const distanceFromMid = Math.abs(currentOdds - targetMid);

        if (!bestResult || distanceFromMid < bestResult.distance) {

          bestResult = {
            selections: [...selected],
            combinedProbabilityDecimal,
            decimalOdds: currentOdds,
            distance: distanceFromMid
          };
        }
      }

      if (currentOdds > maxOdds) break;
    }
  }

  if (!bestResult) {
    return {
      tier,
      selections: [],
      combinedProbability: 0,
      decimalOdds: 0,
      riskLevel: "No Valid Combination"
    };
  }

  const combinedProbabilityPercent =
    (bestResult.combinedProbabilityDecimal * 100).toFixed(2);

  return {
    tier,
    selections: bestResult.selections,
    combinedProbability: combinedProbabilityPercent,
    decimalOdds: bestResult.decimalOdds.toFixed(2),
    riskLevel: classifyRisk(combinedProbabilityPercent)
  };
}

module.exports = {
  calculateAccumulator,
  generateSmartAccumulator
};
