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
      dashboardBadge.textContent = "🟡 LIMITED ACCESS";
      dashboardBadge.style.background = "rgba(255,180,0,0.12)";
      dashboardBadge.style.color = "#facc15";
      dashboardBadge.style.boxShadow = "0 0 8px rgba(255,180,0,0.2)";
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
  // TOP PICK OF THE DAY (SAFE, REAL-DATA ONLY)
  // ==========================================================

  function getOrCreateTopPickBanner() {
    if (!topPicksContainer || !topPicksContainer.parentNode) return null;

    let banner = document.getElementById("topPickOfDayCard");

    if (!banner) {
      banner = document.createElement("div");
      banner.id = "topPickOfDayCard";
      banner.style.marginBottom = "16px";
      banner.style.display = "none";

      topPicksContainer.parentNode.insertBefore(banner, topPicksContainer);
    }

    return banner;
  }

  function renderTopPickOfTheDay() {
    const banner = getOrCreateTopPickBanner();
    if (!banner || !topPicksContainer) return;

    const firstMatch = topPicksContainer.querySelector(".match-accordion");
    if (!firstMatch) {
      banner.style.display = "none";
      banner.innerHTML = "";
      return;
    }

    const titleEl = firstMatch.querySelector(".match-header strong");
    const firstPickCard = firstMatch.querySelector(".pick-card");

    if (!titleEl || !firstPickCard) {
      banner.style.display = "none";
      banner.innerHTML = "";
      return;
    }

    const pickParts = Array.from(firstPickCard.querySelectorAll("div")).map(el => el.textContent.trim());
    const matchTitle = titleEl.textContent.trim();
    const market = pickParts[0] || "Top selection";
    const probability = pickParts[1] || "";
    const confidence = pickParts[2] || "";

    banner.innerHTML = `
      <div style="
        padding:20px;
        border-radius:18px;
        background:linear-gradient(145deg, rgba(10,18,30,0.96), rgba(18,28,44,0.96));
        border:1px solid rgba(0,255,180,0.12);
        box-shadow:0 10px 30px rgba(0,0,0,0.25);
        color:#e5e7eb;
      ">
        <div style="
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:12px;
          flex-wrap:wrap;
          margin-bottom:10px;
        ">
          <div style="
            font-size:12px;
            font-weight:800;
            letter-spacing:0.08em;
            text-transform:uppercase;
            color:#7ff0c5;
          ">
            ⭐ Top Pick of the Day
          </div>

          <div style="
            padding:6px 10px;
            border-radius:999px;
            background:rgba(255,255,255,0.06);
            border:1px solid rgba(255,255,255,0.08);
            font-size:12px;
            font-weight:700;
            color:#d1d5db;
          ">
            ${confidence || "Top Confidence"}
          </div>
        </div>

        <div style="
          font-size:18px;
          font-weight:800;
          margin-bottom:8px;
          color:#ffffff;
        ">
          ${matchTitle}
        </div>

        <div style="
          font-size:14px;
          color:rgba(229,231,235,0.82);
          margin-bottom:10px;
        ">
          ${market}
        </div>

        <div style="
          display:inline-flex;
          align-items:center;
          gap:8px;
          padding:8px 12px;
          border-radius:999px;
          background:rgba(0,255,166,0.08);
          border:1px solid rgba(0,255,166,0.14);
          color:#7ff0c5;
          font-size:13px;
          font-weight:700;
        ">
          📈 ${probability || "Top probability available"}
        </div>
      </div>
    `;

    banner.style.display = "block";
  }

  // ==========================================================
  // SAFE DATA CHECK (CLEANED UX)
  // ==========================================================

  function checkDataState() {

    setTimeout(() => {

      let hasData = false;

      if (
        topPicksContainer &&
        topPicksContainer.querySelector(".match-accordion")
      ) {
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

      renderTopPickOfTheDay();

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
