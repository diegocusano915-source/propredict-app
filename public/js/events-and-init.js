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
      
      // 🔥 Update team lookup title for the new sport
      if (typeof window.updateTeamLookupTitle === 'function') {
        window.updateTeamLookupTitle();
      }
      
      // 🔥 Load teams for the new sport
      if (typeof window.loadTeamsForCurrentSport === 'function') {
        window.loadTeamsForCurrentSport();
      } else if (typeof window.loadTeams === 'function') {
        window.loadTeams(window.currentCompetition);
      }

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
      
      // 🔥 Reload teams when competition changes
      if (typeof window.loadTeamsForCurrentSport === 'function') {
        window.loadTeamsForCurrentSport();
      } else if (typeof window.loadTeams === 'function') {
        window.loadTeams(window.currentCompetition);
      }

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

  // 🔥 FIXED: Analyze button works for ALL sports
  if (window.DOM.analyzeBtn) {
    window.DOM.analyzeBtn.addEventListener("click", () => {
      if (!window.ppCanAccessProtectedApp()) {
        window.ppOpenAuthModal("login");
        return;
      }
      
      // Check if Pro user
      if (typeof window.ppIsPro === 'function' && !window.ppIsPro()) {
        window.ppOpenSubscriptionModal();
        return;
      }

      const teamId = window.DOM.teamSelect ? window.DOM.teamSelect.value : "";
      
      if (teamId && teamId !== "") {
        console.log(`🔍 Analyzing team: ${teamId} for sport: ${window.currentSport}`);
        if (typeof window.analyzeTeam === 'function') {
          window.analyzeTeam(teamId);
        } else {
          console.error("❌ window.analyzeTeam not found");
        }
      } else {
        // Show friendly message
        if (window.DOM.teamAnalysisContainer) {
          window.DOM.teamAnalysisContainer.innerHTML = `
            <p class="placeholder">Please select a team first.</p>
          `;
        }
      }
    });
  }
};

// ==========================================================
// ✅ SAFE PERFORMANCE LOG LOAD (ONLY FOR PRO USERS)
// ==========================================================

window.loadPerformanceLogSafely = function loadPerformanceLogSafely() {
  // Only fetch performance log if user is Pro or VVIP
  const role = (window.ppAuthState.role || "free").toLowerCase();
  
  if (role === "pro" || role === "vvip" || role === "admin") {
    // Pro user - fetch the real data
    if (typeof window.loadPerformanceLog === "function") {
      window.loadPerformanceLog();
    }
  } else {
    // Free user or guest - show friendly upgrade message
    if (window.DOM.performanceLogContainer) {
      window.DOM.performanceLogContainer.innerHTML = `
        <div class="placeholder" style="text-align: center; padding: 40px 20px;">
          <h3 style="color: #7ff0c5; margin-bottom: 12px;">🔒 Pro Feature</h3>
          <p style="color: #a0b3d9; margin-bottom: 20px;">
            Upgrade to Pro to access detailed performance tracking, win/loss history, and ROI analytics.
          </p>
          <button class="btn-primary" onclick="window.ppOpenSubscriptionModal()" style="margin: 0 auto;">
            Upgrade to Pro
          </button>
        </div>
      `;
    }
    
    // Also set performance summary to placeholders
    if (window.DOM.perfTotal) window.DOM.perfTotal.textContent = "—";
    if (window.DOM.perfSettled) window.DOM.perfSettled.textContent = "—";
    if (window.DOM.perfWins) window.DOM.perfWins.textContent = "—";
    if (window.DOM.perfLosses) window.DOM.perfLosses.textContent = "—";
    if (window.DOM.perfWinRate) window.DOM.perfWinRate.textContent = "—";
    if (window.DOM.perfROI) window.DOM.perfROI.textContent = "—";
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
    
    // ✅ Use safe performance log loader instead of direct call
    window.loadPerformanceLogSafely();

    // 🔥 Load teams for current sport (multi-sport support)
    if (typeof window.loadTeamsForCurrentSport === 'function') {
      window.loadTeamsForCurrentSport();
    } else if (window.currentSport === "football" && typeof window.loadTeams === 'function') {
      window.loadTeams(window.currentCompetition);
    }
    
    // 🔥 Update team lookup title
    if (typeof window.updateTeamLookupTitle === 'function') {
      window.updateTeamLookupTitle();
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
  
  // 🔥 Refresh Pro locks
  if (typeof window.refreshProLocks === 'function') {
    setTimeout(window.refreshProLocks, 100);
  }
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
