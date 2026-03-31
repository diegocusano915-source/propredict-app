// ==========================================================
// ProPredict UI Enhancements Layer (SAFE ADD-ON)
// PATCHED: avoids overriding core app/auth logic + avoids touching hidden containers
// PATCHED: never blocks logout/login UI, never rewrites content when user is logged out
// PATCHED: no more forced "LIMITED ACCESS" spam while core app is loading
// ==========================================================

(function () {

  console.log("✅ UI Enhancements Loaded (Patched)");

  // ==========================================================
  // ELEMENT REFERENCES
  // ==========================================================

  const topPicksContainer = document.getElementById("topPicksContainer");
  const teamAnalysisContainer = document.getElementById("teamAnalysisContainer");
  const marketOptionsContainer = document.getElementById("marketOptionsContainer");
  const accumulatorSelections = document.getElementById("accumulatorSelections");
  const dashboardBadge = document.getElementById("dashboardAccessBadge");

  // Prefer the real protected shell root (only present in your HTML)
  const protectedApp = document.getElementById("protectedApp");

  // ==========================================================
  // HELPERS
  // ==========================================================

  function isLoggedInByStorage() {
    // Mirrors your script.js storage key
    try {
      return !!localStorage.getItem("pp_token");
    } catch {
      return false;
    }
  }

  function isProtectedAppVisible() {
    if (!protectedApp) return false;
    // Your core script uses .hidden + display toggles. Cover both.
    const hiddenByClass = protectedApp.classList.contains("hidden");
    const hiddenByStyle = window.getComputedStyle(protectedApp).display === "none";
    return !(hiddenByClass || hiddenByStyle);
  }

  function setAPIStatus(status) {
    if (!dashboardBadge) return;

    // Keep your class base intact
    dashboardBadge.className = "dashboard-access-badge";

    if (status === "live") {
      dashboardBadge.textContent = "🟢 LIVE DATA";
      dashboardBadge.style.background = "rgba(0,255,150,0.15)";
      dashboardBadge.style.color = "#00ffa6";
      dashboardBadge.style.boxShadow = "0 0 10px rgba(0,255,150,0.3)";
      return;
    }

    if (status === "limited") {
      dashboardBadge.textContent = "🟡 LIMITED";
      dashboardBadge.style.background = "rgba(255,200,0,0.15)";
      dashboardBadge.style.color = "#facc15";
      dashboardBadge.style.boxShadow = "0 0 10px rgba(255,200,0,0.3)";
      return;
    }

    if (status === "error") {
      dashboardBadge.textContent = "🟡 LIMITED ACCESS";
      dashboardBadge.style.background = "rgba(255,180,0,0.12)";
      dashboardBadge.style.color = "#facc15";
      dashboardBadge.style.boxShadow = "0 0 8px rgba(255,180,0,0.2)";
      return;
    }
  }

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
  // SAFE DATA CHECK (NO OVERRIDE OF CORE UI)
  // - Only updates the badge
  // - Only shows empty state if the core app is visible + user logged in
  // - Never touches dropdowns/competition/sport
  // ==========================================================

  function checkDataState() {

    // Wait a bit for core script.js to render
    setTimeout(() => {

      // If user is not logged in or protected app is not visible,
      // do not override any containers (prevents login/logout conflicts)
      if (!isLoggedInByStorage() || !isProtectedAppVisible()) {
        // Keep badge neutral when locked
        setAPIStatus("limited");
        return;
      }

      const hasData =
        !!(topPicksContainer && topPicksContainer.querySelector(".match-accordion"));

      if (!hasData) {
        setAPIStatus("error");

        // Only render empty state if container is currently empty or showing skeleton/loading.
        // This avoids fighting your core app messages.
        if (topPicksContainer && !topPicksContainer.querySelector(".match-accordion")) {
          renderEmptyState(
            topPicksContainer,
            "Live match data could not be loaded due to API limits. Please try again later or upgrade access."
          );
        }

        // Do NOT spam warnings into other areas; keep them as-is.
        // Just ensure they aren't stuck on skeleton if core didn't render.
        if (teamAnalysisContainer && teamAnalysisContainer.querySelector(".skeleton-card")) {
          teamAnalysisContainer.innerHTML = `<div class="empty-state">No analysis data yet</div>`;
        }

        if (marketOptionsContainer && marketOptionsContainer.querySelector(".skeleton-card")) {
          marketOptionsContainer.innerHTML = `<div class="empty-state">Markets will appear here</div>`;
        }

        if (accumulatorSelections && accumulatorSelections.querySelector(".skeleton-card")) {
          accumulatorSelections.innerHTML = `<div class="empty-state">Build your accumulator here</div>`;
        }

      } else {
        setAPIStatus("live");
      }

      renderTopPickOfTheDay();

    }, 1500);
  }

  // ==========================================================
  // SMOOTH FADE-IN EFFECT (SAFE)
  // ==========================================================

  function applyFadeIn() {
    // Avoid forcing opacity to 0 if something else already handles it
    if (!document.body) return;

    // Only apply once
    if (document.body.dataset.ppFadeInApplied === "1") return;
    document.body.dataset.ppFadeInApplied = "1";

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

    // Only show skeletons when user is actually in protected app (prevents flicker on guest landing)
    if (isLoggedInByStorage() && isProtectedAppVisible()) {
      renderSkeleton(topPicksContainer);
      renderSkeleton(teamAnalysisContainer);
      renderSkeleton(marketOptionsContainer);
      // accumulatorSelections is rendered by core; don't force skeleton there
    } else {
      // Keep badge neutral when locked
      setAPIStatus("limited");
    }

    checkDataState();

  });

})();
