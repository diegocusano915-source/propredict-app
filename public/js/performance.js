// ==========================================================
// ProPredict — Multi-Sport Probability Intelligence Dashboard
// SPLIT BUILD — /public/js/performance.js
// PURPOSE: Performance summary + log + result updates
// REQUIRES: app-state.js, helpers.js, dom.js, auth.js
// ==========================================================

window.loadPerformanceSummary = async function loadPerformanceSummary() {

  if (!window.ppCanAccessProtectedApp()) return;

  try {

    const res = await fetch("/api/performance/summary");
    const data = await res.json();

    if (window.DOM.perfTotal) window.DOM.perfTotal.textContent = data.totalPicks || 0;
    if (window.DOM.perfSettled) window.DOM.perfSettled.textContent = data.settledPicks || 0;
    if (window.DOM.perfWins) window.DOM.perfWins.textContent = data.wins || 0;
    if (window.DOM.perfLosses) window.DOM.perfLosses.textContent = data.losses || 0;

    if (window.DOM.perfWinRate) {
      window.DOM.perfWinRate.textContent =
        data.winRate ? data.winRate + "%" : "0%";
    }

    if (window.DOM.perfROI) {
      window.DOM.perfROI.textContent =
        data.roi ? data.roi + "%" : "0%";
    }

  } catch (error) {
    console.error("Performance summary failed:", error);
  }
};

window.loadPerformanceLog = async function loadPerformanceLog() {

  if (!window.ppCanAccessProtectedApp()) return;
  if (!window.DOM.performanceLogContainer) return;

  try {

    const res = await fetch("/api/performance/log");
    const data = await res.json();

    window.performanceLogCache = data || [];
    window.renderPerformanceLog();

  } catch (error) {
    console.error("Performance log load failed:", error);
  }
};

window.renderPerformanceLog = function renderPerformanceLog() {

  if (!window.ppCanAccessProtectedApp()) return;
  if (!window.DOM.performanceLogContainer) return;

  window.DOM.performanceLogContainer.innerHTML = "";

  if (!window.performanceLogCache.length) {
    window.DOM.performanceLogContainer.innerHTML =
      `<p class="builder-empty">No recorded picks yet.</p>`;
    return;
  }

  window.performanceLogCache.forEach(pick => {

    const row = document.createElement("div");
    row.className = "builder-item";

    row.innerHTML = `
      <div>
        <div><strong>${String(pick.sport || "").toUpperCase()}</strong></div>
        <div>${pick.market}</div>
        <div>${parseFloat(pick.probability).toFixed(1)}%</div>
        <div>Status: ${pick.status}</div>
      </div>
    `;

    if (pick.status === "pending") {

      const winBtn = document.createElement("button");
      winBtn.textContent = "✅ Win";

      const lossBtn = document.createElement("button");
      lossBtn.textContent = "❌ Loss";

      winBtn.addEventListener("click", () =>
        window.updatePickResultFrontend(pick.id, "win")
      );

      lossBtn.addEventListener("click", () =>
        window.updatePickResultFrontend(pick.id, "loss")
      );

      row.appendChild(winBtn);
      row.appendChild(lossBtn);
    }

    window.DOM.performanceLogContainer.appendChild(row);
  });
};

window.updatePickResultFrontend = async function updatePickResultFrontend(id, result) {

  try {

    await fetch("/api/performance/result", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, result })
    });

    await window.loadPerformanceSummary();
    await window.loadPerformanceLog();

  } catch (error) {
    console.error("Result update failed:", error);
  }
};
