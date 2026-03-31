// ==========================================================
// ProPredict — Multi-Sport Probability Intelligence Dashboard
// SPLIT BUILD — /public/js/smart-builder.js
// PURPOSE: Smart builder UI injection + smart accumulator engine
// REQUIRES: app-state.js, helpers.js, dom.js, auth.js
// ==========================================================

window.injectSmartBuilderUI = function injectSmartBuilderUI() {

  if (!window.DOM.accumulatorContainer) return;

  const container = document.createElement("div");
  container.className = "smart-builder-container";

  container.innerHTML = `
        <h3>Smart Accumulator Builder</h3>
        <div class="smart-controls">
            <select id="smartTierSelect">
                <option value="low">Low Risk</option>
                <option value="balanced" selected>Balanced</option>
                <option value="aggressive">Aggressive</option>
            </select>
            <button id="smartGenerateBtn">Generate Smart Acca</button>
        </div>
        <div id="smartStatus" class="smart-status"></div>
    `;

  window.DOM.accumulatorContainer.parentNode.insertBefore(
    container,
    window.DOM.accumulatorContainer
  );

  window.DOM.smartBuilderContainer = container;
  window.DOM.smartTierSelect = document.getElementById("smartTierSelect");
  window.DOM.smartGenerateBtn = document.getElementById("smartGenerateBtn");
  window.DOM.smartStatus = document.getElementById("smartStatus");

  if (window.DOM.smartTierSelect) {
    window.DOM.smartTierSelect.addEventListener("change", (e) => {
      window.smartTier = e.target.value;
    });
  }

  if (window.DOM.smartGenerateBtn) {
    window.DOM.smartGenerateBtn.addEventListener("click", () => {

      if (!window.ppCanAccessProtectedApp()) {
        window.ppOpenAuthModal("login");
        return;
      }

      if (!window.topPicksData || window.smartBuilderLoading) return;

      window.generateSmartAccumulator();
    });
  }
};

window.updateSmartStatus = function updateSmartStatus(message) {
  if (window.DOM.smartStatus) {
    window.DOM.smartStatus.textContent = message;
  }
};

// ==========================================================
// SMART BUILDER CORE ENGINE
// ==========================================================

window.getTierConfig = function getTierConfig(tier) {

  if (tier === "low") {
    return { min: 0.60, max: 0.85, targetSize: 3 };
  }

  if (tier === "balanced") {
    return { min: 0.50, max: 0.75, targetSize: 4 };
  }

  if (tier === "aggressive") {
    return { min: 0.35, max: 0.65, targetSize: 5 };
  }

  return { min: 0.50, max: 0.75, targetSize: 4 };
};

window.flattenMarketObject = function flattenMarketObject(obj) {

  const combined = [];

  if (!obj || typeof obj !== "object") return combined;

  Object.keys(obj).forEach(key => {

    if (!Array.isArray(obj[key])) return;

    obj[key].forEach(pick => {
      combined.push(pick);
    });

  });

  return combined;
};

window.generateSmartAccumulator = function generateSmartAccumulator() {

  window.smartBuilderLoading = true;
  window.updateSmartStatus("Generating smart accumulator...");

  const flatPicks = Array.isArray(window.topPicksData)
    ? [...window.topPicksData]
    : window.flattenMarketObject(window.topPicksData);

  if (!flatPicks.length) {
    window.updateSmartStatus("No picks available for smart generation.");
    window.smartBuilderLoading = false;
    return;
  }

  flatPicks.sort((a, b) => b.probability - a.probability);

  const tierConfig = window.getTierConfig(window.smartTier);

  const selected = [];
  const usedMatches = new Set();

  for (let pick of flatPicks) {

    if (selected.length >= tierConfig.targetSize) break;
    if (usedMatches.has(pick.matchId)) continue;

    if (
      pick.probability >= tierConfig.min &&
      pick.probability <= tierConfig.max
    ) {
      selected.push(pick);
      usedMatches.add(pick.matchId);
    }
  }

  if (selected.length < tierConfig.targetSize) {

    for (let pick of flatPicks) {

      if (selected.length >= tierConfig.targetSize) break;
      if (usedMatches.has(pick.matchId)) continue;

      selected.push(pick);
      usedMatches.add(pick.matchId);
    }
  }

  window.smartBuilderSelections = selected;
  window.accumulatorSelections = [...selected];

  if (typeof window.renderAccumulator === "function") window.renderAccumulator();
  if (typeof window.renderTopPicks === "function") window.renderTopPicks();

  const combinedProbability = selected.reduce(
    (acc, pick) => acc * pick.probability,
    1
  );

  const percentage = (combinedProbability * 100).toFixed(2);

  window.updateSmartStatus(
    `Smart Acca Generated (${window.smartTier.toUpperCase()}) — Combined: ${percentage}%`
  );

  window.smartBuilderLoading = false;
};
