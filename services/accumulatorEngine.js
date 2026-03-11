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

    if (!probabilityPercent || probabilityPercent <= 0) {
      continue;
    }

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
   SMART ACCUMULATOR GENERATOR
-------------------------------------------------- */
function generateSmartAccumulator(allMarkets, options = {}) {

  const {
    targetMinOdds = 10,
    targetMaxOdds = 20,
    riskProfile = "balanced"
  } = options;

  if (!allMarkets || typeof allMarkets !== "object") {
    return { selections: [], combinedProbability: 0, decimalOdds: 0 };
  }

  /* ---------------------------------------------
     RISK PROFILE SETTINGS
  --------------------------------------------- */
  let minProbabilityThreshold = 60;

  if (riskProfile === "conservative") minProbabilityThreshold = 70;
  if (riskProfile === "balanced") minProbabilityThreshold = 65;
  if (riskProfile === "aggressive") minProbabilityThreshold = 60;
  if (riskProfile === "highrisk") minProbabilityThreshold = 55;

  /* ---------------------------------------------
     FLATTEN MARKETS
  --------------------------------------------- */
  const flattened = [];

  for (const marketKey in allMarkets) {
    const picks = allMarkets[marketKey];

    if (!Array.isArray(picks)) continue;

    for (const pick of picks) {
      const probability = extractProbability(pick);

      if (probability >= minProbabilityThreshold) {
        flattened.push({
          ...pick,
          probability
        });
      }
    }
  }

  /* ---------------------------------------------
     SORT BY HIGHEST PROBABILITY
  --------------------------------------------- */
  flattened.sort((a, b) => b.probability - a.probability);

  /* ---------------------------------------------
     BUILD ACCUMULATOR
     - Avoid same match
     - Build until odds range reached
  --------------------------------------------- */
  const selected = [];
  const usedMatches = new Set();

  let combinedProbabilityDecimal = 1;

  for (const pick of flattened) {

    if (usedMatches.has(pick.matchId)) continue;

    const probabilityDecimal = pick.probability / 100;

    const tempCombined = combinedProbabilityDecimal * probabilityDecimal;
    const tempOdds = tempCombined > 0 ? (1 / tempCombined) : 0;

    selected.push(pick);
    usedMatches.add(pick.matchId);

    combinedProbabilityDecimal = tempCombined;

    if (tempOdds >= targetMinOdds && tempOdds <= targetMaxOdds) {
      break;
    }

    if (tempOdds > targetMaxOdds) {
      break;
    }
  }

  const combinedProbabilityPercent =
    (combinedProbabilityDecimal * 100).toFixed(2);

  const decimalOdds =
    combinedProbabilityDecimal > 0
      ? (1 / combinedProbabilityDecimal).toFixed(2)
      : 0;

  return {
    selections: selected,
    combinedProbability: combinedProbabilityPercent,
    decimalOdds: decimalOdds,
    riskLevel: classifyRisk(combinedProbabilityPercent)
  };
}

module.exports = {
  calculateAccumulator,
  generateSmartAccumulator
};
