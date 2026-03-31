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

  // Bind UI events
  window.bindEvents();

  // Inject Smart Builder UI
  window.injectSmartBuilderUI();

  // Init auth state + auth UI events
  window.ppInitAuth();
  window.ppBindAuthUI();

  // Build competition list based on currentSport
  window.updateCompetitionOptions();

  // Final UI refresh (delayed like original)
  setTimeout(() => {
    window.ppFullUIRefresh();
  }, 50);
});
