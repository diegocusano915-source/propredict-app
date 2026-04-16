// ==========================================================
// ProPredict — Multi-Sport Probability Intelligence Dashboard
// SPLIT BUILD — /public/js/picks.js
// PURPOSE: Load + normalize + render top picks (protected)
// REQUIRES: app-state.js, helpers.js, dom.js, auth.js, smart-builder.js (optional)
// ==========================================================

// ==========================================================
// 🔥 FREE USER LIMIT CONFIG
// ==========================================================
const FREE_PICKS_LIMIT = 3;  // Free users can only see 3 picks per day
const FREE_PICKS_STORAGE_KEY = 'propredict_free_picks_used';

// Get today's date as YYYY-MM-DD
function getTodayDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Check if user can view more picks
function canViewMorePicks() {
  // Pro users have unlimited
  if (typeof window.ppIsPro === 'function' && window.ppIsPro()) {
    return true;
  }
  
  // Free users - check daily limit
  const today = getTodayDate();
  const usedData = localStorage.getItem(FREE_PICKS_STORAGE_KEY);
  
  if (!usedData) return true;
  
  try {
    const parsed = JSON.parse(usedData);
    if (parsed.date !== today) {
      // New day, reset counter
      localStorage.setItem(FREE_PICKS_STORAGE_KEY, JSON.stringify({ date: today, count: 0 }));
      return true;
    }
    return parsed.count < FREE_PICKS_LIMIT;
  } catch (e) {
    return true;
  }
}

// Increment free pick counter
function incrementFreePickCounter() {
  if (typeof window.ppIsPro === 'function' && window.ppIsPro()) return;
  
  const today = getTodayDate();
  let usedData = { date: today, count: 0 };
  
  try {
    const stored = localStorage.getItem(FREE_PICKS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.date === today) {
        usedData.count = parsed.count;
      }
    }
  } catch (e) {
    // Ignore
  }
  
  usedData.count++;
  localStorage.setItem(FREE_PICKS_STORAGE_KEY, JSON.stringify(usedData));
  
  // Update counter display
  updateFreePicksCounter();
}

// Update the free picks counter UI
function updateFreePicksCounter() {
  const counterEl = document.getElementById('freePicksCounter');
  if (!counterEl) return;
  
  if (typeof window.ppIsPro === 'function' && window.ppIsPro()) {
    counterEl.style.display = 'none';
    return;
  }
  
  const today = getTodayDate();
  let usedCount = 0;
  
  try {
    const stored = localStorage.getItem(FREE_PICKS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.date === today) {
        usedCount = parsed.count;
      }
    }
  } catch (e) {
    // Ignore
  }
  
  const remaining = FREE_PICKS_LIMIT - usedCount;
  counterEl.textContent = `🔒 ${remaining} free picks left today`;
  counterEl.style.display = 'inline-block';
}

// ==========================================================
// NORMALIZE PICKS (SAFE)
// ==========================================================

window.normalizePicks = function normalizePicks(raw) {

  if (!raw) return [];

  // Array format
  if (Array.isArray(raw)) {

    return raw.map(pick => {

      const match = pick.match || "";
      const parts = match.split(" vs ");

      return {
        matchId: match,
        homeTeam: parts[0] || "",
        awayTeam: parts[1] || "",
        market: pick.market || "Over 2.5 Goals",
        probability: parseFloat(
          pick.adjustedProbability ||
          pick.impliedProbability ||
          pick.probability ||
          pick.over25
        ) / 100 || 0,
        confidence: pick.confidence || "Low"
      };
    });
  }

  // Object grouped
  if (typeof raw === "object") {

    const combined = [];

    Object.keys(raw).forEach(marketKey => {

      if (!Array.isArray(raw[marketKey])) return;

      raw[marketKey].forEach(pick => {

        combined.push({
          matchId: pick.matchId || pick.match,
          homeTeam: pick.homeTeam || "",
          awayTeam: pick.awayTeam || "",
          market: pick.market || marketKey,
          probability: parseFloat(
            pick.adjustedProbability ||
            pick.impliedProbability ||
            pick.probability
          ) / 100 || 0,
          confidence: pick.confidence || "Low"
        });

      });

    });

    return combined;
  }

  return [];
};

// ==========================================================
// LOAD TOP PICKS (AUTH PROTECTED)
// ==========================================================

window.loadTopPicks = async function loadTopPicks() {

  if (!window.ppCanAccessProtectedApp()) {
    window.ppRenderLockedContent();
    return;
  }

  if (!window.DOM.topPicksContainer) return;

  // Guard: competition must exist
  if (!window.currentCompetition) {
    window.DOM.topPicksContainer.innerHTML = `
      <div class="error-state">
        Please select a competition.
      </div>
    `;
    return;
  }

  window.DOM.topPicksContainer.innerHTML = `
    <div class="loading-state">
      Loading projections...
    </div>
  `;

  try {

    const route = window.DOM.eliteToggle && window.DOM.eliteToggle.checked
      ? `/api/elite/${window.currentSport}/${window.currentCompetition}`
      : `/api/top-picks/${window.currentSport}/${window.currentCompetition}`;

    const res = await fetch(route);

    if (!res.ok) {
      throw new Error("Network response was not ok");
    }

    const data = await res.json();

    const rawPicks = window.DOM.eliteToggle && window.DOM.eliteToggle.checked
      ? data.elitePicks
      : data.topPicks;

    window.topPicksData = window.normalizePicks(rawPicks);
    
    // 🔥 Reset free pick counter at start of day
    const today = getTodayDate();
    const stored = localStorage.getItem(FREE_PICKS_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.date !== today) {
          localStorage.setItem(FREE_PICKS_STORAGE_KEY, JSON.stringify({ date: today, count: 0 }));
        }
      } catch (e) {
        localStorage.setItem(FREE_PICKS_STORAGE_KEY, JSON.stringify({ date: today, count: 0 }));
      }
    } else {
      localStorage.setItem(FREE_PICKS_STORAGE_KEY, JSON.stringify({ date: today, count: 0 }));
    }

    window.renderTopPicks();

  } catch (err) {
    console.error("Load Top Picks Error:", err);

    window.DOM.topPicksContainer.innerHTML = `
      <div class="error-state">
        Failed to load fixtures.
      </div>
    `;
  }
};

// ==========================================================
// RENDER TOP PICKS
// ==========================================================

window.renderTopPicks = function renderTopPicks() {

  if (!window.ppCanAccessProtectedApp()) {
    window.ppRenderLockedContent();
    return;
  }

  if (!window.DOM.topPicksContainer) return;

  window.DOM.topPicksContainer.innerHTML = "";

  if (!window.topPicksData || !window.topPicksData.length) {

    if (window.currentSport === "darts" || window.currentSport === "tabletennis") {
      window.DOM.topPicksContainer.innerHTML =
        `<p class="placeholder">
          ℹ️ No bookmaker markets currently available for this sport.
        </p>`;
    } else {
      window.DOM.topPicksContainer.innerHTML = "No projections available.";
    }

    return;
  }

  // 🔥 Check if user can view more picks
  const canViewMore = canViewMorePicks();
  const isPro = (typeof window.ppIsPro === 'function' && window.ppIsPro());
  
  // Update counter display
  updateFreePicksCounter();

  const matches = {};
  let totalMarketsRendered = 0;

  window.topPicksData.forEach(pick => {

    if (!matches[pick.matchId]) {
      matches[pick.matchId] = {
        homeTeam: pick.homeTeam,
        awayTeam: pick.awayTeam,
        markets: []
      };
    }

    matches[pick.matchId].markets.push(pick);
  });

  Object.keys(matches).forEach(matchId => {

    const match = matches[matchId];

    const wrapper = document.createElement("div");
    wrapper.className = "match-accordion";

    const header = document.createElement("div");
    header.className = "match-header";

    const indicator = document.createElement("span");
    indicator.className = "toggle-indicator";
    indicator.textContent = "▼";

    const title = document.createElement("strong");
    title.textContent = `${match.homeTeam} vs ${match.awayTeam}`;

    header.appendChild(title);
    header.appendChild(indicator);

    const body = document.createElement("div");
    body.className = "match-body";

    header.addEventListener("click", () => {
      window.toggleMatchBody(body, indicator);
    });

    match.markets.forEach(pick => {
      
      // 🔥 FREE USER LIMIT CHECK
      if (!isPro && !canViewMore && totalMarketsRendered >= FREE_PICKS_LIMIT) {
        return; // Skip rendering this pick
      }

      const added = window.accumulatorSelections.some(sel =>
        sel.matchId === pick.matchId &&
        sel.market === pick.market
      );

      const card = document.createElement("div");
      card.className = "pick-card";

      card.innerHTML = `
        <div>${pick.market}</div>
        <div>${window.safePercent(pick.probability)}%</div>
        <div>${pick.confidence}</div>
        <button ${added ? "disabled" : ""}>
          ${added ? "Added" : "Add"}
        </button>
      `;

      const btn = card.querySelector("button");

      if (btn) {
        btn.addEventListener("click", async () => {

          window.accumulatorSelections.push({
            matchId: pick.matchId,
            homeTeam: pick.homeTeam,
            awayTeam: pick.awayTeam,
            market: pick.market,
            probability: pick.probability,
            confidence: pick.confidence
          });

          try {
            await fetch("/api/performance/record", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                sport: window.currentSport,
                matchId: pick.matchId,
                market: pick.market,
                probability: pick.probability * 100,
                confidence: pick.confidence
              })
            });
          } catch (error) {
            console.error("Performance record error:", error);
          }

          window.renderAccumulator();
          window.renderTopPicks();
          window.loadPerformanceSummary();
          window.loadPerformanceLog();
        });
      }

      body.appendChild(card);
      totalMarketsRendered++;
      
      // 🔥 Increment counter when pick is rendered (viewed)
      if (!isPro) {
        incrementFreePickCounter();
      }
    });

    // Only add wrapper if there are markets to show
    if (body.children.length > 0) {
      wrapper.appendChild(header);
      wrapper.appendChild(body);
      window.DOM.topPicksContainer.appendChild(wrapper);
    }
  });
  
  // 🔥 If free user reached limit, show upgrade banner
  if (!isPro && totalMarketsRendered === 0) {
    const upgradeMsg = document.createElement('div');
    upgradeMsg.className = 'upgrade-banner';
    upgradeMsg.style.margin = '20px 0';
    upgradeMsg.innerHTML = `
      <span class="upgrade-banner-text"><strong>👑 Free limit reached!</strong> You've viewed ${FREE_PICKS_LIMIT} picks today.</span>
      <button class="upgrade-banner-btn" onclick="document.getElementById('upgradeBtn')?.click()">Upgrade to Pro</button>
    `;
    window.DOM.topPicksContainer.appendChild(upgradeMsg);
  } else if (!isPro && totalMarketsRendered > 0) {
    // Show subtle upgrade reminder at bottom
    const reminder = document.createElement('div');
    reminder.style.textAlign = 'center';
    reminder.style.marginTop = '20px';
    reminder.style.padding = '12px';
    reminder.style.background = 'rgba(0, 245, 255, 0.05)';
    reminder.style.borderRadius = '12px';
    reminder.style.fontSize = '13px';
    reminder.style.color = '#a0b3d9';
    reminder.innerHTML = `
      <span>🔒 Free plan: ${FREE_PICKS_LIMIT} picks per day. </span>
      <a href="#" onclick="document.getElementById('upgradeBtn')?.click(); return false;" style="color:#00f5ff; font-weight:600; text-decoration:none;">Upgrade to Pro for unlimited →</a>
    `;
    window.DOM.topPicksContainer.appendChild(reminder);
  }
};
