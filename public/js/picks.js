// ==========================================================
// ProPredict — Multi-Sport Probability Intelligence Dashboard
// SPLIT BUILD — /public/js/picks.js
// PURPOSE: Load + normalize + render top picks (protected)
// UPDATED: Option B Dashboard - Real API Data Connection
// REQUIRES: app-state.js, helpers.js, dom.js, auth.js
// ==========================================================

// ==========================================================
// 🔥 FREE USER LIMIT CONFIG
// ==========================================================
const FREE_PICKS_LIMIT = 3;
const FREE_PICKS_STORAGE_KEY = 'propredict_free_picks_used';

function getTodayDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function canViewMorePicks() {
  if (typeof window.ppIsPro === 'function' && window.ppIsPro()) return true;
  const today = getTodayDate();
  const usedData = localStorage.getItem(FREE_PICKS_STORAGE_KEY);
  if (!usedData) return true;
  try {
    const parsed = JSON.parse(usedData);
    if (parsed.date !== today) {
      localStorage.setItem(FREE_PICKS_STORAGE_KEY, JSON.stringify({ date: today, count: 0 }));
      return true;
    }
    return parsed.count < FREE_PICKS_LIMIT;
  } catch (e) {
    return true;
  }
}

function incrementFreePickCounter() {
  if (typeof window.ppIsPro === 'function' && window.ppIsPro()) return;
  const today = getTodayDate();
  let usedData = { date: today, count: 0 };
  try {
    const stored = localStorage.getItem(FREE_PICKS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.date === today) usedData.count = parsed.count;
    }
  } catch (e) {}
  usedData.count++;
  localStorage.setItem(FREE_PICKS_STORAGE_KEY, JSON.stringify(usedData));
}

// ==========================================================
// NORMALIZE PICKS
// ==========================================================

window.normalizePicks = function normalizePicks(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map(pick => {
      const match = pick.match || pick.matchId || "";
      const parts = match.split(" vs ");
      return {
        matchId: match,
        homeTeam: parts[0]?.trim() || "",
        awayTeam: parts[1]?.trim() || "",
        market: pick.market || "1X2",
        probability: parseFloat(pick.adjustedProbability || pick.impliedProbability || pick.probability || 0) / 100 || 0,
        confidence: pick.confidence || "Medium",
        odds: pick.odds || null
      };
    });
  }
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
          probability: parseFloat(pick.adjustedProbability || pick.impliedProbability || pick.probability || 0) / 100 || 0,
          confidence: pick.confidence || "Medium",
          odds: pick.odds || null
        });
      });
    });
    return combined;
  }
  return [];
};

// ==========================================================
// LOAD TOP PICKS + POPULATE OPTION B DASHBOARD
// ==========================================================

window.loadTopPicks = async function loadTopPicks() {
  if (!window.ppCanAccessProtectedApp()) {
    window.ppRenderLockedContent();
    return;
  }

  const container = document.getElementById('topPicksContainer');
  if (container) {
    container.innerHTML = `<div class="loading-state">Loading projections...</div>`;
  }

  // Show skeleton on the new dashboard table
  const tableBody = document.getElementById('predictionsTableBody');
  if (tableBody) {
    tableBody.innerHTML = `
      <tr><td colspan="5" style="text-align:center;padding:30px;color:#8a9bb5;">Loading real match data...</td></tr>
    `;
  }

  try {
    const route = (window.DOM.eliteToggle && window.DOM.eliteToggle.checked)
      ? `/api/elite/${window.currentSport}/${window.currentCompetition}`
      : `/api/top-picks/${window.currentSport}/${window.currentCompetition}`;

    const res = await fetch(route);
    if (!res.ok) throw new Error("Network response was not ok");

    const data = await res.json();
    const rawPicks = (window.DOM.eliteToggle && window.DOM.eliteToggle.checked)
      ? data.elitePicks
      : data.topPicks;

    window.topPicksData = window.normalizePicks(rawPicks);

    // Reset daily counter
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

    // 🔥 POPULATE OPTION B DASHBOARD WITH REAL DATA
    populateDashboardWithRealData();

    // Also render the old card view if the container exists
    window.renderTopPicks();

  } catch (err) {
    console.error("Load Top Picks Error:", err);
    if (container) {
      container.innerHTML = `<div class="error-state">Failed to load fixtures.</div>`;
    }
    if (tableBody) {
      tableBody.innerHTML = `
        <tr><td colspan="5" style="text-align:center;padding:30px;color:#ff6b6b;">Failed to load match data. Please try again.</td></tr>
      `;
    }
  }
};

// ==========================================================
// 🔥 POPULATE OPTION B DASHBOARD WITH REAL API DATA
// ==========================================================

function populateDashboardWithRealData() {
  if (!window.topPicksData || window.topPicksData.length === 0) return;

  // === FEATURED MATCH HERO ===
  const featuredMatch = window.topPicksData[0];
  if (featuredMatch) {
    const homeEl = document.getElementById('featuredHomeTeam');
    const awayEl = document.getElementById('featuredAwayTeam');
    const pickEl = document.getElementById('featuredPick');
    const confEl = document.getElementById('featuredConfidence');
    const oddsEl = document.getElementById('featuredOdds');
    const venueEl = document.getElementById('featuredVenue');
    const timeEl = document.getElementById('featuredTime');
    const leagueEl = document.getElementById('featuredLeague');

    if (homeEl) homeEl.textContent = featuredMatch.homeTeam || 'Home';
    if (awayEl) awayEl.textContent = featuredMatch.awayTeam || 'Away';
    if (pickEl) pickEl.textContent = `${featuredMatch.homeTeam || 'Home'} to Win`;
    if (confEl) confEl.textContent = `${Math.round((featuredMatch.probability || 0) * 100)}%`;
    if (oddsEl) oddsEl.textContent = featuredMatch.odds ? `Odds: ${featuredMatch.odds}` : 'Odds: N/A';

    // Set competition as venue label
    const competitionNames = {
      'PL': '🏟 Premier League',
      'PD': '🏟 La Liga',
      'SA': '🏟 Serie A',
      'BL1': '🏟 Bundesliga',
      'FL1': '🏟 Ligue 1',
      'UCL': '🏟 Champions League',
      'UEL': '🏟 Europa League'
    };
    if (venueEl) venueEl.textContent = competitionNames[window.currentCompetition] || `🏟 ${window.currentCompetition}`;
    if (timeEl) timeEl.textContent = '📅 Upcoming Fixture';
    if (leagueEl) leagueEl.textContent = '';
  }

  // === PREDICTIONS TABLE ===
  const tableBody = document.getElementById('predictionsTableBody');
  if (tableBody) {
    const isPro = (typeof window.ppIsPro === 'function' && window.ppIsPro());
    const displayPicks = window.topPicksData.slice(0, isPro ? 10 : FREE_PICKS_LIMIT);

    if (displayPicks.length === 0) {
      tableBody.innerHTML = `
        <tr><td colspan="5" style="text-align:center;padding:30px;color:#8a9bb5;">No predictions available for this competition.</td></tr>
      `;
    } else {
      tableBody.innerHTML = displayPicks.map(pick => {
        const probPercent = Math.round((pick.probability || 0) * 100);
        let confidenceClass = 'low';
        let confidenceLabel = 'Low';
        if (probPercent >= 70) { confidenceClass = 'high'; confidenceLabel = 'High'; }
        else if (probPercent >= 50) { confidenceClass = 'medium'; confidenceLabel = 'Medium'; }

        return `
          <tr>
            <td>${pick.homeTeam || '?'} vs ${pick.awayTeam || '?'}</td>
            <td>${pick.market || '1X2'}</td>
            <td style="color:#00f5ff;font-weight:600;">${pick.homeTeam || 'Home'}</td>
            <td><span class="confidence-pill ${confidenceClass}">${probPercent}%</span></td>
            <td style="font-weight:600;">${pick.odds || 'N/A'}</td>
          </tr>
        `;
      }).join('');

      // Show upgrade reminder for free users
      if (!isPro && window.topPicksData.length > FREE_PICKS_LIMIT) {
        const remaining = window.topPicksData.length - FREE_PICKS_LIMIT;
        tableBody.innerHTML += `
          <tr>
            <td colspan="5" style="text-align:center;padding:16px;background:rgba(0,245,255,0.03);color:#a0b3d9;font-size:13px;">
              🔒 ${remaining} more picks available. <a href="#" onclick="document.getElementById('upgradeBtn')?.click(); return false;" style="color:#00f5ff;font-weight:600;">Upgrade to Pro</a> to unlock all.
            </td>
          </tr>
        `;
      }
    }
  }

  // === ACCUMULATOR BUILDER ===
  const accaContainer = document.getElementById('accumulatorSelectionsPremium');
  if (accaContainer && window.topPicksData.length >= 4) {
    const accaPicks = window.topPicksData.slice(0, 4);
    let totalOdds = 1;
    accaContainer.innerHTML = accaPicks.map(pick => {
      const odds = parseFloat(pick.odds) || 1.5;
      totalOdds *= odds;
      return `
        <div class="acca-selection">
          <span class="selection-name">${pick.homeTeam || 'Team'} (${pick.market || '1X2'})</span>
          <span class="selection-odds">${odds.toFixed(2)}</span>
        </div>
      `;
    }).join('');

    // Update total odds
    const totalOddsEl = document.querySelector('.accumulator-premium-card .total-odds');
    if (totalOddsEl) totalOddsEl.textContent = totalOdds.toFixed(2);

    // Update potential return
    const returnEl = document.querySelector('.accumulator-premium-card .acca-return');
    if (returnEl) returnEl.textContent = `Potential Return: $${(totalOdds * 100).toFixed(2)}`;
  }
}

// ==========================================================
// RENDER TOP PICKS (OLD CARD VIEW - KEPT FOR COMPATIBILITY)
// ==========================================================

window.renderTopPicks = function renderTopPicks() {
  if (!window.ppCanAccessProtectedApp()) {
    window.ppRenderLockedContent();
    return;
  }

  const container = document.getElementById('topPicksContainer');
  if (!container) return;
  container.innerHTML = "";

  if (!window.topPicksData || !window.topPicksData.length) {
    container.innerHTML = `<p class="placeholder">No projections available.</p>`;
    return;
  }

  const matches = {};
  window.topPicksData.forEach(pick => {
    const key = pick.matchId || `${pick.homeTeam} vs ${pick.awayTeam}`;
    if (!matches[key]) {
      matches[key] = { homeTeam: pick.homeTeam, awayTeam: pick.awayTeam, markets: [] };
    }
    matches[key].markets.push(pick);
  });

  Object.keys(matches).forEach(matchId => {
    const match = matches[matchId];
    const wrapper = document.createElement("div");
    wrapper.className = "match-card";

    const header = document.createElement("div");
    header.className = "match-header";
    header.innerHTML = `
      <div class="match-teams">
        <i class="fas fa-futbol"></i>
        <strong>${match.homeTeam || 'Home'} vs ${match.awayTeam || 'Away'}</strong>
      </div>
      <span class="match-expand-icon">▼</span>
    `;

    const body = document.createElement("div");
    body.className = "match-body";
    body.style.display = "none";

    header.addEventListener("click", () => {
      const isHidden = body.style.display === "none";
      body.style.display = isHidden ? "block" : "none";
      header.querySelector(".match-expand-icon").textContent = isHidden ? "▲" : "▼";
    });

    match.markets.forEach(pick => {
      const probPercent = Math.round((pick.probability || 0) * 100);
      let confClass = 'confidence-low';
      if (probPercent >= 70) confClass = 'confidence-high';
      else if (probPercent >= 50) confClass = 'confidence-medium';

      const row = document.createElement("div");
      row.className = "pick-item";
      row.innerHTML = `
        <div class="pick-info">
          <span class="pick-name">${pick.market || '1X2'}</span>
          <div class="probability-bar">
            <div class="probability-fill ${probPercent >= 70 ? 'high' : probPercent >= 50 ? 'medium' : 'low'}" style="width:${probPercent}%"></div>
          </div>
          <span class="pick-probability">${probPercent}%</span>
          <span class="pick-confidence ${confClass}">${pick.confidence || 'Medium'}</span>
        </div>
        <button class="add-btn">Add</button>
      `;
      body.appendChild(row);
    });

    wrapper.appendChild(header);
    wrapper.appendChild(body);
    container.appendChild(wrapper);
  });
};
