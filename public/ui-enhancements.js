// ==========================================================
// ProPredict UI Enhancements Layer (SAFE ADD-ON)
// DOES NOT MODIFY EXISTING LOGIC
// ==========================================================

(function () {

  console.log("✅ UI Enhancements Loaded");

  // ==========================================================
  // ELEMENT REFERENCES
  // ==========================================================

  const topPicksContainer = document.getElementById("topPicksContainer");
  const teamAnalysisContainer = document.getElementById("teamAnalysisContainer");
  const marketOptionsContainer = document.getElementById("marketOptionsContainer");
  const accumulatorContainer = document.getElementById("accumulatorContainer");

  const dashboardBadge = document.getElementById("dashboardAccessBadge");

  // ==========================================================
  // API STATUS BADGE
  // ==========================================================

  function setAPIStatus(status) {
    if (!dashboardBadge) return;

    dashboardBadge.classList.remove("status-live", "status-limited", "status-error");

    if (status === "live") {
      dashboardBadge.textContent = "Live Data";
      dashboardBadge.classList.add("status-live");
    }

    if (status === "limited") {
      dashboardBadge.textContent = "Limited Data";
      dashboardBadge.classList.add("status-limited");
    }

    if (status === "error") {
      dashboardBadge.textContent = "API Limit Reached";
      dashboardBadge.classList.add("status-error");
    }
  }

  // ==========================================================
  // EMPTY STATE UI
  // ==========================================================

  function renderEmptyState(container, message) {
    if (!container) return;

    container.innerHTML = `
      <div style="
        padding:20px;
        border-radius:12px;
        background:rgba(255,255,255,0.03);
        text-align:center;
        color:#aaa;
      ">
        ${message}
      </div>
    `;
  }

  // ==========================================================
  // LOADING SKELETON
  // ==========================================================

  function renderSkeleton(container) {
    if (!container) return;

    container.innerHTML = `
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
    `;
  }

  // ==========================================================
  // SAFE DATA CHECK (RUN AFTER LOAD)
  // ==========================================================

  function checkDataState() {

    setTimeout(() => {

      let hasData = false;

      if (topPicksContainer && topPicksContainer.children.length > 0) {
        hasData = true;
      }

      if (!hasData) {
        setAPIStatus("error");

        renderEmptyState(
          topPicksContainer,
          "⚠️ No match data available (API limit reached or unavailable)"
        );

        renderEmptyState(
          teamAnalysisContainer,
          "⚠️ Team analysis unavailable due to API limit"
        );

        renderEmptyState(
          marketOptionsContainer,
          "⚠️ Betting markets unavailable at the moment"
        );

        renderEmptyState(
          accumulatorContainer,
          "Add selections to build your accumulator"
        );

      } else {
        setAPIStatus("live");
      }

    }, 1500);
  }

  // ==========================================================
  // SMOOTH FADE-IN EFFECT
  // ==========================================================

  function applyFadeIn() {
    document.body.classList.add("ui-fade-in");
  }

  // ==========================================================
  // INIT
  // ==========================================================

  document.addEventListener("DOMContentLoaded", function () {

    applyFadeIn();

    renderSkeleton(topPicksContainer);
    renderSkeleton(teamAnalysisContainer);
    renderSkeleton(marketOptionsContainer);

    checkDataState();

  });

})();
