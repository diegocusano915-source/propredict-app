// ==========================================================
// ProPredict — Multi-Sport Probability Intelligence Dashboard
// SPLIT BUILD — /public/js/events-and-init.js
// PURPOSE: Event binding + full UI refresh/reinit + DOMContentLoaded init
// REQUIRES: all previous split files
// ==========================================================

// ==========================================================
// EVENT BINDING
// ==========================================================

window.bindEvents = function bindEvents() {

  if (window.DOM.sportSelect) {
    window.DOM.sportSelect.addEventListener("change", (e) => {
      window.currentSport = e.target.value;
      window.updateCompetitionOptions();
      window.resetBuilders();

      if (window.ppCanAccessProtectedApp()) {
        window.loadTopPicks();
      } else {
        window.ppRenderLockedContent();
      }
    });
  }

  if (window.DOM.competitionSelect) {
    window.DOM.competitionSelect.addEventListener("change", (e) => {
      window.currentCompetition = e.target.value;
      window.resetBuilders();

      if (window.ppCanAccessProtectedApp()) {
        window.loadTopPicks();
      } else {
        window.ppRenderLockedContent();
      }
    });
  }

  if (window.DOM.eliteToggle) {
    window.DOM.eliteToggle.addEventListener("change", () => {
      if (!window.ppCanAccessProtectedApp()) {
        window.DOM.eliteToggle.checked = false;
        window.ppOpenAuthModal("login");
        return;
      }

      if (window.ppIsFreeRole()) {
        window.DOM.eliteToggle.checked = false;
        window.ppOpenSubscriptionModal();
        return;
      }

      window.loadTopPicks();
    });
  }

  if (window.DOM.clearAccumulatorBtn) {
    window.DOM.clearAccumulatorBtn.addEventListener("click", () => {
      if (!window.ppCanAccessProtectedApp()) {
        window.ppOpenAuthModal("login");
        return;
      }

      window.accumulatorSelections = [];
      window.smartBuilderSelections = [];
      window.renderAccumulator();
      window.renderTopPicks();
      window.updateSmartStatus("");
    });
  }

  if (window.DOM.analyzeBtn) {
    window.DOM.analyzeBtn.addEventListener("click", () => {
      if (!window.ppCanAccessProtectedApp()) {
        window.ppOpenAuthModal("login");
        return;
      }

      if (window.currentSport !== "football") return;
      const teamId = window.DOM.teamSelect ? window.DOM.teamSelect.value : "";

      if (teamId) {
        window.analyzeTeam(teamId);
      }
    });
  }
};

// ==========================================================
// FINAL AUTH + UI SYNC + SAFETY LAYER
// ==========================================================

window.ppFullUIRefresh = function ppFullUIRefresh() {

  window.ppInitAuth();
  window.ppSyncProtectedUI();

  if (window.ppCanAccessProtectedApp()) {

    window.loadTopPicks();
    window.loadPerformanceSummary();
    window.loadPerformanceLog();

    if (window.currentSport === "football") {
      window.loadTeams(window.currentCompetition);
    }

  } else {
    window.ppClearProtectedState();
  }
};

// ==========================================================
// SAFE RE-INIT AFTER LOGIN / LOGOUT
// ==========================================================

window.ppReinitializeAppAfterAuth = function ppReinitializeAppAfterAuth() {

  // Reset builders to avoid stale state
  window.accumulatorSelections = [];
  window.smartBuilderSelections = [];

  window.updateSmartStatus("");

  // Reset UI
  if (window.DOM.accumulatorContainer) {
    window.DOM.accumulatorContainer.innerHTML =
      `<p class="builder-empty">No selections added.</p>`;
  }

  window.updateMetrics(0);

  // Reload UI properly
  window.ppFullUIRefresh();
};

// ==========================================================
// INIT (DOMContentLoaded)
// ==========================================================

document.addEventListener("DOMContentLoaded", () => {

  console.log("🔥 DOM READY — Starting initialization...");

  // ✅ CRITICAL FIX: Map DOM AFTER page loads, BEFORE anything else
  if (typeof window.mapDOM === "function") {
    window.mapDOM();
    console.log("✅ DOM mapped:", window.DOM);
  } else {
    console.error("❌ window.mapDOM not found! Make sure dom.js is loaded.");
  }

  // ✅ Now bind UI events (DOM is mapped)
  if (typeof window.bindEvents === "function") {
    window.bindEvents();
    console.log("✅ Events bound");
  }

  // Inject Smart Builder UI
  if (typeof window.injectSmartBuilderUI === "function") {
    window.injectSmartBuilderUI();
    console.log("✅ Smart Builder injected");
  }

  // Init auth state + auth UI events
  if (typeof window.ppInitAuth === "function") {
    window.ppInitAuth();
    console.log("✅ Auth initialized");
  }

  if (typeof window.ppBindAuthUI === "function") {
    window.ppBindAuthUI();
    console.log("✅ Auth UI bound");
  }

  // Build competition list based on currentSport
  if (typeof window.updateCompetitionOptions === "function") {
    window.updateCompetitionOptions();
    console.log("✅ Competition options updated");
  }

  // Final UI refresh (delayed)
  setTimeout(() => {
    if (typeof window.ppFullUIRefresh === "function") {
      window.ppFullUIRefresh();
      console.log("✅ Full UI refresh complete");
    }
  }, 50);

  console.log("🚀 Initialization complete!");
});
