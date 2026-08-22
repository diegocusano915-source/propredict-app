// ==========================================================
// ProPredict — Multi-Sport Probability Intelligence Dashboard
// SPLIT BUILD — /public/js/picks.js
// PURPOSE: Load + normalize + render top picks (protected)
// FIXED: Deduplicated accumulator, best pick per match, real odds
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

function calculateImpliedOdds(probPercent) {
  const p = parseFloat(probPercent);
  if (!p || p <= 0) return 1.50;
  return (100 / p).toFixed(2);
}

// ==========================================================
// NORMALIZE PICKS
// ==========================================================

window.normalizePicks = function normalizePicks(raw) {
  if (!raw) return [];

  // A REAL bookmaker price only — null when the engine had no live price.
  // Never invented: value bets are computed exclusively from these.
  function parseBookOdds(v) {
    if (v === undefined || v === null || v === '') return null;
    const n = parseFloat(v);
    return (!isNaN(n) && n > 1) ? n : null;
  }

  if (raw.h2h && Array.isArray(raw.h2h)) {
    return raw.h2h.map(pick => ({
      matchId: pick.matchId || '',
      homeTeam: pick.homeTeam || '',
      awayTeam: pick.awayTeam || '',
      market: (pick.market || '').replace('Win: ', ''),
      probability: parseFloat(pick.adjustedProbability || pick.impliedProbability || 0) / 100,
      confidence: pick.confidence || 'Low',
      odds: pick.odds || calculateImpliedOdds(pick.adjustedProbability || pick.impliedProbability || 33),
      bookOdds: parseBookOdds(pick.odds)
    }));
  }

  if (Array.isArray(raw)) {
    return raw.map(pick => ({
      matchId: pick.matchId || pick.match || '',
      homeTeam: pick.homeTeam || '',
      awayTeam: pick.awayTeam || '',
      market: (pick.market || '1X2').replace('Win: ', ''),
      probability: parseFloat(pick.adjustedProbability || pick.impliedProbability || pick.probability || 0) / 100,
      confidence: pick.confidence || 'Low',
      odds: pick.odds || calculateImpliedOdds(pick.adjustedProbability || pick.impliedProbability || pick.probability || 33),
      bookOdds: parseBookOdds(pick.odds)
    }));
  }

  return [];
};

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

    const today = getTodayDate();
    localStorage.setItem(FREE_PICKS_STORAGE_KEY, JSON.stringify({ date: today, count: 0 }));

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
// POPULATE OPTION B DASHBOARD (DEDUPLICATED BY MATCH ID)
// ==========================================================

function populateDashboardWithRealData() {
  if (!window.topPicksData || window.topPicksData.length === 0) return;

  // Get BEST pick per UNIQUE match (deduplicated)
  const matchMap = {};
  window.topPicksData.forEach(pick => {
    const key = pick.matchId;
    if (!matchMap[key] || pick.probability > matchMap[key].probability) {
      matchMap[key] = pick;
    }
  });
  const bestPicks = Object.values(matchMap).sort((a, b) => b.probability - a.probability);

  // === FEATURED MATCH HERO ===
  const featured = bestPicks[0];
  if (featured) {
    const homeEl = document.getElementById('featuredHomeTeam');
    const awayEl = document.getElementById('featuredAwayTeam');
    const pickEl = document.getElementById('featuredPick');
    const confEl = document.getElementById('featuredConfidence');
    const oddsEl = document.getElementById('featuredOdds');

    if (homeEl) homeEl.textContent = featured.homeTeam;
    if (awayEl) awayEl.textContent = featured.awayTeam;
    if (pickEl) pickEl.textContent = featured.market + ': ' + featured.homeTeam;
    if (confEl) confEl.textContent = Math.round(featured.probability * 100) + '%';
    if (oddsEl) oddsEl.textContent = 'Odds: ' + featured.odds;

    const compNames = { 'PL': '🏟 Premier League', 'PD': '🏟 La Liga', 'SA': '🏟 Serie A', 'BL1': '🏟 Bundesliga', 'FL1': '🏟 Ligue 1', 'UCL': '🏟 Champions League' };
    const venueEl = document.getElementById('featuredVenue');
    if (venueEl) venueEl.textContent = compNames[window.currentCompetition] || '🏟 ' + window.currentCompetition;
  }

  // === PREDICTIONS TABLE ===
  const tableBody = document.getElementById('predictionsTableBody');
  if (tableBody && bestPicks.length > 0) {
    const isPro = (typeof window.ppIsPro === 'function' && window.ppIsPro());
    const displayPicks = bestPicks.slice(0, isPro ? 10 : FREE_PICKS_LIMIT);

    tableBody.innerHTML = displayPicks.map(pick => {
      const probPercent = Math.round(pick.probability * 100);
      let confClass = 'low';
      if (probPercent >= 70) confClass = 'high';
      else if (probPercent >= 50) confClass = 'medium';

      const prediction = pick.market.includes('Draw') ? 'Draw' : pick.homeTeam;

      return `
        <tr>
          <td>${pick.homeTeam} vs ${pick.awayTeam}</td>
          <td>${pick.market}</td>
          <td style="color:#00f5ff;font-weight:600;">${prediction}</td>
          <td><span class="confidence-pill ${confClass}">${probPercent}%</span></td>
          <td style="font-weight:600;">${pick.odds != null && !isNaN(parseFloat(pick.odds)) ? parseFloat(pick.odds).toFixed(2) : '-'}</td>
        </tr>
      `;
    }).join('');

    if (!isPro && bestPicks.length > FREE_PICKS_LIMIT) {
      const remaining = bestPicks.length - FREE_PICKS_LIMIT;
      tableBody.innerHTML += `
        <tr><td colspan="5" style="text-align:center;padding:14px;background:rgba(0,245,255,0.03);color:#a0b3d9;font-size:13px;">
          🔒 ${remaining} more available. <a href="#" onclick="document.getElementById('upgradeBtn')?.click(); return false;" style="color:#00f5ff;font-weight:600;">Upgrade to Pro</a>
        </td></tr>`;
    }
  }

  // === ACCUMULATOR (4 UNIQUE matches, deduplicated by matchId) ===
  const accaContainer = document.getElementById('accumulatorSelectionsPremium');
  if (accaContainer && bestPicks.length >= 2) {
    // Deduplicate by matchId for accumulator
    const accaMap = {};
    bestPicks.forEach(pick => {
      if (!accaMap[pick.matchId]) {
        accaMap[pick.matchId] = pick;
      }
    });
    const accaPicks = Object.values(accaMap).slice(0, 4);

    // REAL ODDS ONLY: selections without a live bookmaker price are skipped -
    // we never invent a fallback price.
    const pricedPicks = accaPicks.filter(pick => {
      const o = parseFloat(pick.odds);
      return !isNaN(o) && o > 1;
    });

    if (pricedPicks.length >= 2) {
      let totalOdds = 1;
      accaContainer.innerHTML = pricedPicks.map(pick => {
        const odds = parseFloat(pick.odds);
        totalOdds *= odds;
        const displayName = pick.market.includes('Draw')
          ? pick.homeTeam + ' vs ' + pick.awayTeam + ' (Draw)'
          : pick.homeTeam + ' (Win)';
        return `
          <div class="acca-selection">
            <span class="selection-name">${displayName}</span>
            <span class="selection-odds">${odds.toFixed(2)}</span>
          </div>
        `;
      }).join('');

      const totalEl = document.querySelector('.accumulator-premium-card .total-odds');
      if (totalEl) totalEl.textContent = totalOdds.toFixed(2);

      // HONEST RETURN: your stake x real combined odds - stake input,
      // no hidden $100 assumption.
      const returnEl = document.querySelector('.accumulator-premium-card .acca-return');
      const stakeInput = document.getElementById('accaStakeInput');
      const stake = parseFloat(stakeInput && stakeInput.value) || 10;
      if (returnEl) returnEl.textContent = 'Potential Return: $' + (totalOdds * stake).toFixed(2) + ' (on $' + stake.toFixed(2) + ' staked)';
      window.__accaTotalOdds = totalOdds;
    } else {
      accaContainer.innerHTML = '<div class="acca-selection"><span class="selection-name">No live-priced selections right now.</span><span class="selection-odds">-</span></div>';
      const totalEl = document.querySelector('.accumulator-premium-card .total-odds');
      if (totalEl) totalEl.textContent = '-';
      const returnEl = document.querySelector('.accumulator-premium-card .acca-return');
      if (returnEl) returnEl.textContent = 'Potential Return: -';
    }
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
    container.innerHTML = '<p class="placeholder">No projections available.</p>';
    return;
  }

  const matchMap = {};
  window.topPicksData.forEach(pick => {
    const key = pick.matchId;
    if (!matchMap[key] || pick.probability > matchMap[key].probability) {
      matchMap[key] = pick;
    }
  });
  const bestPicks = Object.values(matchMap).sort((a, b) => b.probability - a.probability);

  bestPicks.forEach(pick => {
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

  window.renderValueBets();
};

// ==========================================================
// VALUE BETS — real bookmaker odds vs model probability only
// Edge = probability × bookOdds − 1. No priced market, no entry.
// ==========================================================
window.renderValueBets = function renderValueBets() {
  const container = document.getElementById('valueBetsContainer');
  if (!container) return;
  container.innerHTML = '';

  const picks = window.topPicksData || [];
  if (picks.length === 0) {
    container.innerHTML = '<div style="font-size:12px;color:#8a9bb5;line-height:1.5;">No picks loaded for this competition yet.</div>';
    return;
  }

  const priced = picks.filter(p => p.bookOdds && p.probability > 0 && p.probability < 1);
  if (priced.length === 0) {
    container.innerHTML = '<div style="font-size:12px;color:#8a9bb5;line-height:1.5;">No live bookmaker prices for this market right now — value bets appear only when real odds are available.</div>';
    return;
  }

  const valued = priced
    .map(p => Object.assign({}, p, { edge: p.probability * p.bookOdds - 1 }))
    .filter(p => p.edge > 0.01)
    .sort((a, b) => b.edge - a.edge)
    .slice(0, 3);

  if (valued.length === 0) {
    container.innerHTML = '<div style="font-size:12px;color:#8a9bb5;line-height:1.5;">No value bets: every priced play is currently below fair value. Updates live as odds move.</div>';
    return;
  }

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  valued.forEach(v => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:12px;color:#c5d1eb;';
    const label = (v.homeTeam && v.awayTeam) ? `${v.homeTeam} v ${v.awayTeam}` : (v.matchId || '');
    row.innerHTML =
      `<span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(label)} — ${esc(v.market)} @ ${v.bookOdds.toFixed(2)}</span>` +
      `<span style="color:#22c55e;font-weight:700;white-space:nowrap;">+${(v.edge * 100).toFixed(1)}%</span>`;
    container.appendChild(row);
  });
};
