/* ==========================================================
   RISK CLASSIFICATION ENGINE
========================================================== */
function classifyRisk(combinedProbability) {
  const value = parseFloat(combinedProbability);

  if (value >= 70) return "Low Risk";
  if (value >= 50) return "Moderate Risk";
  if (value >= 30) return "High Risk";
  return "Extreme Risk";
}

/* ==========================================================
   EXTRACT BEST AVAILABLE PROBABILITY
========================================================== */
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

/* ==========================================================
   BASIC ACCUMULATOR CALCULATION (MANUAL MODE)
   — UNCHANGED
========================================================== */
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

/* ==========================================================
   SPORT-SPECIFIC TIER CONFIGURATION (V2)
========================================================== */
function getTierConfig(tier, sport) {

  const baseConfig = {
    conservative: { minOdds: 8, maxOdds: 18, minProb: 72 },
    balanced: { minOdds: 18, maxOdds: 45, minProb: 65 },
    aggressive: { minOdds: 45, maxOdds: 90, minProb: 60 },
    highrisk: { minOdds: 90, maxOdds: 160, minProb: 55 }
  };

  let config = baseConfig[tier] || baseConfig.balanced;

  // ✅ Sport-based calibration
  if (sport === "mlb" || sport === "nhl") {
    config = { ...config, minProb: config.minProb - 3 };
  }

  if (sport === "basketball") {
    config = { ...config, minProb: config.minProb - 2 };
  }

  if (sport === "football") {
    config = { ...config, minProb: config.minProb };
  }

  return config;
}

/* ==========================================================
   CONFIDENCE WEIGHTING
========================================================== */
function applyConfidenceBoost(probability, confidence) {

  if (!confidence) return probability;

  if (confidence === "Elite") return probability + 1.5;
  if (confidence === "Strong") return probability + 1;
  if (confidence === "Medium") return probability + 0.5;

  return probability;
}

/* ==========================================================
   CORRELATION GUARD (BASIC VERSION)
   Prevent:
   - Same match duplicate
   - Same market type stacking
========================================================== */
function isCorrelated(pick, selected) {

  for (const existing of selected) {

    if (existing.matchId === pick.matchId) return true;

    // Prevent stacking totals + spreads from same match
    if (
      existing.matchId === pick.matchId &&
      existing.market !== pick.market
    ) {
      return true;
    }
  }

  return false;
}

/* ==========================================================
   SMART ACCUMULATOR GENERATOR V2
========================================================== */
function generateSmartAccumulator(allMarkets, options = {}) {

  const tier = options.tier || "balanced";
  const sport = options.sport || "football";

  const { minOdds, maxOdds, minProb } = getTierConfig(tier, sport);
  const targetMid = (minOdds + maxOdds) / 2;

  if (!allMarkets || typeof allMarkets !== "object") {
    return { selections: [], combinedProbability: 0, decimalOdds: 0 };
  }

  const flattened = [];

  for (const marketKey in allMarkets) {

    const picks = allMarkets[marketKey];
    if (!Array.isArray(picks)) continue;

    for (const pick of picks) {

      let probability = extractProbability(pick);
      probability = applyConfidenceBoost(probability, pick.confidence);

      if (probability >= minProb) {
        flattened.push({
          ...pick,
          probability
        });
      }
    }
  }

  // ✅ Sort by weighted probability
  flattened.sort((a, b) => b.probability - a.probability);

  let bestResult = null;

  for (let start = 0; start < flattened.length; start++) {

    const selected = [];
    let combinedProbabilityDecimal = 1;
    let currentOdds = 1;

    for (let i = start; i < flattened.length; i++) {

      const pick = flattened[i];

      if (isCorrelated(pick, selected)) continue;

      const probabilityDecimal = pick.probability / 100;

      combinedProbabilityDecimal *= probabilityDecimal;
      currentOdds = 1 / combinedProbabilityDecimal;

      selected.push(pick);

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
