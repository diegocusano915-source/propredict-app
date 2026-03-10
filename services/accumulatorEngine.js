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
   Uses adjustedProbability if available,
   otherwise falls back to impliedProbability
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
   ACCUMULATOR CALCULATION
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

module.exports = {
  calculateAccumulator
};
