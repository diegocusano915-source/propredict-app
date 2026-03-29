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
  // API STATUS BADGE (UPGRADED)
  // ==========================================================

  function setAPIStatus(status) {
    if (!dashboardBadge) return;

    dashboardBadge.className = "dashboard-access-badge";

    if (status === "live") {
      dashboardBadge.textContent = "🟢 LIVE DATA";
      dashboardBadge.style.background = "rgba(0,255,150,0.15)";
      dashboardBadge.style.color = "#00ffa6";
      dashboardBadge.style.boxShadow = "0 0 10px rgba(0,255,150,0.3)";
    }

    if (status === "limited") {
      dashboardBadge.textContent = "🟡 LIMITED";
      dashboardBadge.style.background = "rgba(255,200,0,0.15)";
      dashboardBadge.style.color = "#facc15";
      dashboardBadge.style.boxShadow = "0 0 10px rgba(255,200,0,0.3)";
    }

    if (status === "error") {
      dashboardBadge.textContent = "🔴 API LIMIT";
      dashboardBadge.style.background = "rgba(255,50,50,0.15)";
      dashboardBadge.style.color = "#ff4d4d";
      dashboardBadge.style.boxShadow = "0 0 10px rgba(255,50,50,0.3)";
    }
  }

  // ==========================================================
  // EMPTY STATE UI (MAIN CARD)
  // ==========================================================

  function renderEmptyState(container, message) {
    if (!container) return;

    container.innerHTML = `
      <div style="
        padding:28px;
        border-radius:16px;
        background:linear-gradient(145deg, rgba(20,25,40,0.8), rgba(10,15,25,0.9));
        border:1px solid rgba(0,255,180,0.08);
        text-align:center;
        color:#d1d5db;
        backdrop-filter:blur(6px);
      ">

        <div style="
          font-size:28px;
          margin-bottom:10px;
          color:#facc15;
        ">⚠️</div>

        <div style="
          font-size:14px;
          line-height:1.6;
          opacity:0.9;
        ">
          ${message}
        </div>

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
  // SAFE DATA CHECK (CLEANED UX)
  // ==========================================================

  function checkDataState() {

    setTimeout(() => {

      let hasData = false;

      if (topPicksContainer && topPicksContainer.children.length > 0) {
        hasData = true;
      }

      if (!hasData) {
        setAPIStatus("error");

        // ONLY TOP PICKS GET FULL MESSAGE
        renderEmptyState(
          topPicksContainer,
          "Live match data could not be loaded due to API limits. Please try again later or upgrade access."
        );

        // CLEAN OTHER SECTIONS (NO WARNING SPAM)
        if (teamAnalysisContainer) {
          teamAnalysisContainer.innerHTML =
            `<div class="empty-state">No analysis data yet</div>`;
        }

        if (marketOptionsContainer) {
          marketOptionsContainer.innerHTML =
            `<div class="empty-state">Markets will appear here</div>`;
        }

        if (accumulatorContainer) {
          accumulatorContainer.innerHTML =
            `<div class="empty-state">Build your accumulator here</div>`;
        }

      } else {
        setAPIStatus("live");
      }

    }, 1500);
  }

  // ==========================================================
  // SMOOTH FADE-IN EFFECT
  // ==========================================================

  function applyFadeIn() {
    document.body.style.opacity = "0";
    document.body.style.transition = "opacity 0.5s ease";

    setTimeout(() => {
      document.body.style.opacity = "1";
    }, 100);
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
