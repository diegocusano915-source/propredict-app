// ==========================================================
// ProPredict — Multi-Sport Probability Intelligence Dashboard
// SPLIT BUILD — /public/js/picks.js
// PURPOSE: Load + normalize + render top picks (protected)
// UPDATED: Fixed for { h2h: [...] } API structure
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
  } catch (e) { return true; }
}

// ==========================================================
// NORMALIZE PICKS — Fixed for { h2h: [...] } structure
// ==========================================================

window.normalizePicks = function normalizePicks(raw) {
  if (!raw) return [];

  // If raw is an object with h2h array
  if (raw.h2h && Array.isArray(raw.h2h)) {
    return raw.h2h.map(pick => ({
      matchId: pick.matchId || '',
      homeTeam: pick.homeTeam || '',
      awayTeam: pick.awayTeam || '',
      market: (pick.market || '').replace('Win: ', ''),
      probability: parseFloat(pick.adjustedProbability || pick.impliedProbability || 0) / 100,
      confidence: pick.confidence || 'Low',
      odds: pick.odds || calculateImpliedOdds(pick.adjustedProbability || pick.impliedProbability || 33)
    }));
  }

  // If raw is already an array
  if (Array.isArray(raw)) {
    return raw.map(pick => ({
      matchId: pick.matchId || pick.match || '',
      homeTeam: pick.homeTeam || '',
      awayTeam: pick.awayTeam || '',
      market: (pick.market || '1X2').replace('Win: ', ''),
      probability: parseFloat(pick.adjustedProbability || pick.impliedProbability || pick.probability || 0) / 100,
      confidence: pick.confidence || 'Low',
      odds: pick.odds || calculateImpliedOdds(pick.adjustedProbability || pick.impliedProbability || 33)
    }));
  }

  return [];
};

// Calculate decimal odds from probability percentage
function calculateImpliedOdds(probPercent) {
  const p = parseFloat(probPercent);
  if (!p || p <= 0) return 1.50;
  return (100 / p).toFixed(2);
}

// ==========================================================
// LOAD TOP PICKS
// ==========================================================

window.loadTopPicks = async function loadTopPicks() {
  if (!window.ppCanAccessProtectedApp()) {
    window.ppRenderLockedContent();
    return;
  }

  const tableBody = document.getElementById('predictionsTableBody');
  if (tableBody) {
    tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:30px;color:#8a9bb5;">Loading real match data...</td></tr>`;
  }

  try {
    const route = (window.DOM.eliteToggle && window.DOM.eliteToggle.checked)
      ? `/api/elite/${window.currentSport}/${window.currentCompetition}`
      : `/api/top-picks/${window.currentSport}/${window.currentCompetition}`;

    const res = await fetch(route);
    if (!res.ok) throw new Error("Network error");

    const data = await res.json();
    const rawPicks = (window.DOM.eliteToggle && window.DOM.eliteToggle.checked)
      ? data.elitePicks
      : data.topPicks;

    window.topPicksData = window.normalizePicks(rawPicks);

    // Reset daily counter
    const today = getTodayDate();
    localStorage.setItem(FREE_PICKS_STORAGE_KEY, JSON.stringify({ date: today, count: 0 }));

    // Populate dashboard
    populateDashboardWithRealData();
    window.renderTopPicks();

  } catch (err) {
    console.error("Load Error:", err);
    if (tableBody) {
      tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:30px;color:#ff6b6b;">Failed to load. Try again.</td></tr>`;
    }
  }
};

// ==========================================================
// POPULATE OPTION B DASHBOARD
// ==========================================================

function populateDashboardWithRealData() {
  if (!window.topPicksData || window.topPicksData.length === 0) return;

  // Get unique matches (deduplicate by matchId)
  const seen = new Set();
  const uniqueMatches = [];
  window.topPicksData.forEach(pick => {
    if (!seen.has(pick.matchId)) {
      seen.add(pick.matchId);
      uniqueMatches.push(pick);
    }
  });

  // === FEATURED MATCH HERO (First unique match) ===
  const featured = uniqueMatches[0];
  if (featured) {
    const homeEl = document.getElementById('featuredHomeTeam');
    const awayEl = document.getElementById('featuredAwayTeam');
    const pickEl = document.getElementById('featuredPick');
    const confEl = document.getElementById('featuredConfidence');
    const oddsEl = document.getElementById('featuredOdds');

    if (homeEl) homeEl.textContent = featured.homeTeam;
    if (awayEl) awayEl.textContent = featured.awayTeam;
    if (pickEl) pickEl.textContent = `${featured.homeTeam} to Win`;
    if (confEl) confEl.textContent = `${Math.round(featured.probability * 100)}%`;
    if (oddsEl) oddsEl.textContent = `Odds: ${featured.odds}`;

    const venueEl = document.getElementById('featuredVenue');
    const compNames = { 'PL': '🏟 Premier League', 'PD': '🏟 La Liga', 'SA': '🏟 Serie A', 'BL1': '🏟 Bundesliga', 'FL1': '🏟 Ligue 1', 'UCL': '🏟 Champions League' };
    if (venueEl) venueEl.textContent = compNames[window.currentCompetition] || `🏟 ${window.currentCompetition}`;
  }

  // === PREDICTIONS TABLE (Unique matches, best pick per match) ===
  const tableBody = document.getElementById('predictionsTableBody');
  if (tableBody && uniqueMatches.length > 0) {
    const isPro = (typeof window.ppIsPro === 'function' && window.ppIsPro());
    const displayMatches = uniqueMatches.slice(0, isPro ? 10 : FREE_PICKS_LIMIT);

    tableBody.innerHTML = displayMatches.map(match => {
      const probPercent = Math.round(match.probability * 100);
      let confClass = 'low';
      if (probPercent >= 70) confClass = 'high';
      else if (probPercent >= 50) confClass = 'medium';

      return `
        <tr>
          <td>${match.homeTeam} vs ${match.awayTeam}</td>
          <td>1X2</td>
          <td style="color:#00f5ff;font-weight:600;">${match.homeTeam}</td>
          <td><span class="confidence-pill ${confClass}">${probPercent}%</span></td>
          <td style="font-weight:600;">${match.odds}</td>
        </tr>
      `;
    }).join('');

    if (!isPro && uniqueMatches.length > FREE_PICKS_LIMIT) {
      tableBody.innerHTML += `
        <tr><td colspan="5" style="text-align:center;padding:14px;background:rgba(0,245,255,0.03);color:#a0b3d9;font-size:13px;">
          🔒 ${uniqueMatches.length - FREE_PICKS_LIMIT} more available. <a href="#" onclick="document.getElementById('upgradeBtn')?.click(); return false;" style="color:#00f5ff;font-weight:600;">Upgrade to Pro</a>
        </td></tr>`;
    }
  }

  // === ACCUMULATOR (First 4 unique matches with win picks) ===
  const accaContainer = document.getElementById('accumulatorSelectionsPremium');
  if (accaContainer && uniqueMatches.length >= 2) {
    const accaPicks = uniqueMatches.slice(0, 4);
    let totalOdds = 1;
    accaContainer.innerHTML = accaPicks.map(pick => {
      const odds = parseFloat(pick.odds) || 1.50;
      totalOdds *= odds;
      return `
        <div class="acca-selection">
          <span class="selection-name">${pick.homeTeam} (Win)</span>
          <span class="selection-odds">${odds.toFixed(2)}</span>
        </div>
      `;
    }).join('');

    const totalEl = document.querySelector('.accumulator-premium-card .total-odds');
    if (totalEl) totalEl.textContent = totalOdds.toFixed(2);
    const returnEl = document.querySelector('.accumulator-premium-card .acca-return');
    if (returnEl) returnEl.textContent = `Potential Return: $${(totalOdds * 100).toFixed(2)}`;
  }
}

// ==========================================================
// RENDER TOP PICKS (Legacy card view)
// ==========================================================

window.renderTopPicks = function renderTopPicks() {
  const container = document.getElementById('topPicksContainer');
  if (!container) return;
  container.innerHTML = '';

  if (!window.topPicksData || window.topPicksData.length === 0) {
    container.innerHTML = `<p class="placeholder">No projections available.</p>`;
    return;
  }

  const seen = new Set();
  window.topPicksData.forEach(pick => {
    if (seen.has(pick.matchId)) return;
    seen.add(pick.matchId);

    const probPercent = Math.round(pick.probability * 100);
    let confClass = 'confidence-low';
    if (probPercent >= 70) confClass = 'confidence-high';
    else if (probPercent >= 50) confClass = 'confidence-medium';

    const wrapper = document.createElement('div');
    wrapper.className = 'match-card';
    wrapper.innerHTML = `
      <div class="match-header" style="cursor:pointer;">
        <div class="match-teams"><strong>${pick.homeTeam} vs ${pick.awayTeam}</strong></div>
        <span class="match-expand-icon">▼</span>
      </div>
      <div class="match-body" style="display:none;padding:16px;">
        <div class="pick-item">
          <span class="pick-name">${pick.market || '1X2'}</span>
          <div class="probability-bar"><div class="probability-fill ${probPercent >= 70 ? 'high' : probPercent >= 50 ? 'medium' : 'low'}" style="width:${probPercent}%"></div></div>
          <span class="pick-probability">${probPercent}%</span>
          <span class="pick-confidence ${confClass}">${pick.confidence}</span>
          <span style="color:#00f5ff;font-weight:700;">${pick.odds}</span>
        </div>
      </div>
    `;

    wrapper.querySelector('.match-header').addEventListener('click', function() {
      const body = wrapper.querySelector('.match-body');
      const icon = wrapper.querySelector('.match-expand-icon');
      const isHidden = body.style.display === 'none';
      body.style.display = isHidden ? 'block' : 'none';
      icon.textContent = isHidden ? '▲' : '▼';
    });

    container.appendChild(wrapper);
  });
};
