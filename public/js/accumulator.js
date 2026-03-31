// ==========================================================
// ProPredict — Multi-Sport Probability Intelligence Dashboard
// SPLIT BUILD — /public/js/accumulator.js
// PURPOSE: Accumulator rendering + metrics
// REQUIRES: app-state.js, helpers.js, dom.js, auth.js
// ==========================================================

window.updateMetrics = function updateMetrics(probabilityDecimal) {

  const percentage = probabilityDecimal * 100;

  if (window.DOM.combinedProbability) {
    window.DOM.combinedProbability.textContent =
      percentage.toFixed(2) + "%";
  }

  if (window.DOM.decimalOdds) {
    window.DOM.decimalOdds.textContent =
      probabilityDecimal > 0
        ? (1 / probabilityDecimal).toFixed(2)
        : "-";
  }

  let risk = "High";
  if (percentage >= 60) risk = "Low";
  else if (percentage >= 35) risk = "Medium";

  if (window.DOM.riskLevel) {
    window.DOM.riskLevel.textContent =
      probabilityDecimal ? risk : "-";
  }
};

window.renderAccumulator = function renderAccumulator() {

  if (!window.ppCanAccessProtectedApp()) {
    window.ppRenderLockedContent();
    return;
  }

  if (!window.DOM.accumulatorContainer) return;

  window.DOM.accumulatorContainer.innerHTML = "";

  if (!window.accumulatorSelections.length) {
    window.DOM.accumulatorContainer.innerHTML =
      `<p class="builder-empty">No selections added.</p>`;
    window.updateMetrics(0);
    return;
  }

  window.accumulatorSelections.forEach((pick, index) => {

    const row = document.createElement("div");
    row.className = "builder-item";

    row.innerHTML = `
      <div>
        <div>${pick.homeTeam} vs ${pick.awayTeam}</div>
        <div>${pick.market}</div>
        <div>${window.safePercent(pick.probability)}%</div>
      </div>
      <button>Remove</button>
    `;

    const btn = row.querySelector("button");

    if (btn) {
      btn.addEventListener("click", () => {
        window.accumulatorSelections.splice(index, 1);
        window.renderAccumulator();
        window.renderTopPicks();
      });
    }

    window.DOM.accumulatorContainer.appendChild(row);
  });

  const combinedProbability = window.accumulatorSelections.reduce(
    (acc, pick) => acc * pick.probability,
    1
  );

  window.updateMetrics(combinedProbability);
};

// ==========================================================
// RESET BUILDERS (used by event binding)
// ==========================================================

window.resetBuilders = function resetBuilders() {
  window.accumulatorSelections = [];
  window.smartBuilderSelections = [];

  if (typeof window.updateSmartStatus === "function") {
    window.updateSmartStatus("");
  }

  if (window.DOM.accumulatorContainer) {
    window.DOM.accumulatorContainer.innerHTML = `<p class="builder-empty">No selections added.</p>`;
  }

  window.updateMetrics(0);
};
