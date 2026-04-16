// ==========================================================
// ProPredict — Multi-Sport Probability Intelligence Dashboard
// SPLIT BUILD — /public/js/teams.js
// PURPOSE: Multi-sport teams loader + team analysis
// REQUIRES: app-state.js, helpers.js, dom.js, auth.js
// ==========================================================

// ==========================================================
// SPORT-SPECIFIC TEAM API MAPPING
// ==========================================================
const SPORT_TEAMS_API_MAP = {
  football: (competition) => `/api/league-teams/${competition}`,
  basketball: (competition) => `/api/basketball/teams/${competition}`,
  nfl: (competition) => `/api/nfl/teams/${competition}`,
  nhl: (competition) => `/api/nhl/teams/${competition}`,
  mlb: (competition) => `/api/mlb/teams/${competition}`,
  tennis: (competition) => `/api/tennis/teams/${competition}`,
  rugbyleague: (competition) => `/api/rugby-league/teams/${competition}`,
  rugbyunion: (competition) => `/api/rugby-union/teams/${competition}`,
  darts: (competition) => `/api/darts/teams/${competition}`,
  tabletennis: (competition) => `/api/table-tennis/teams/${competition}`
};

// Sport display names
const SPORT_DISPLAY_NAMES = {
  football: 'Football',
  basketball: 'Basketball',
  nfl: 'NFL',
  nhl: 'NHL',
  mlb: 'MLB',
  tennis: 'Tennis',
  rugbyleague: 'Rugby League',
  rugbyunion: 'Rugby Union',
  darts: 'Darts',
  tabletennis: 'Table Tennis'
};

// ==========================================================
// LOAD TEAMS FOR CURRENT SPORT
// ==========================================================

window.loadTeamsForCurrentSport = async function loadTeamsForCurrentSport() {
  if (!window.ppCanAccessProtectedApp()) return;
  if (!window.DOM.teamSelect) return;
  
  // Check if Pro user
  if (typeof window.ppIsPro === 'function' && !window.ppIsPro()) {
    window.DOM.teamSelect.innerHTML = `<option value="">🔒 Pro feature</option>`;
    return;
  }

  const sport = window.currentSport || 'football';
  const competition = window.currentCompetition || 'PL';

  window.DOM.teamSelect.innerHTML = `<option value="">Loading ${SPORT_DISPLAY_NAMES[sport] || sport} teams...</option>`;

  try {
    const apiPath = SPORT_TEAMS_API_MAP[sport];
    if (!apiPath) {
      window.DOM.teamSelect.innerHTML = `<option value="">Select Team</option>`;
      console.warn(`No team API mapped for sport: ${sport}`);
      return;
    }

    const res = await fetch(apiPath(competition));
    
    if (!res.ok) {
      throw new Error(`Failed to load teams: ${res.status}`);
    }

    const teams = await res.json();

    window.DOM.teamSelect.innerHTML = `<option value="">Select Team</option>`;

    if (!teams || teams.length === 0) {
      window.DOM.teamSelect.innerHTML = `<option value="">No teams available</option>`;
      return;
    }

    // Sort teams alphabetically
    teams.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    teams.forEach(team => {
      const option = document.createElement("option");
      option.value = team.id;
      option.textContent = team.name || team.displayName || team.fullName || `Team ${team.id}`;
      window.DOM.teamSelect.appendChild(option);
    });
    
    console.log(`✅ Loaded ${teams.length} teams for ${SPORT_DISPLAY_NAMES[sport]}`);

  } catch (err) {
    console.error("Load teams error:", err);
    window.DOM.teamSelect.innerHTML = `<option value="">Select Team</option>`;
  }
};

// ==========================================================
// LEGACY: Load Football Teams (kept for backward compatibility)
// ==========================================================

window.loadTeams = async function loadTeams(league) {
  // Redirect to new multi-sport function
  return window.loadTeamsForCurrentSport();
};

// ==========================================================
// ANALYZE TEAM (Multi-Sport)
// ==========================================================

window.analyzeTeam = async function analyzeTeam(teamId) {

  if (!window.ppCanAccessProtectedApp()) {
    window.ppOpenAuthModal("login");
    return;
  }
  
  // Check if Pro user
  if (typeof window.ppIsPro === 'function' && !window.ppIsPro()) {
    if (window.DOM.teamAnalysisContainer) {
      window.DOM.teamAnalysisContainer.innerHTML = `
        <div class="upgrade-banner" style="margin: 20px 0;">
          <span class="upgrade-banner-text"><strong>👑 Pro Feature</strong> — Upgrade to unlock team analysis</span>
          <button class="upgrade-banner-btn" onclick="document.getElementById('upgradeBtn')?.click()">Upgrade Now</button>
        </div>
      `;
    }
    return;
  }

  if (!window.DOM.teamAnalysisContainer) return;

  const sport = window.currentSport || 'football';
  const sportName = SPORT_DISPLAY_NAMES[sport] || sport;

  window.DOM.teamAnalysisContainer.innerHTML = `<div class="loading-state">🔍 Analyzing ${sportName} team...</div>`;

  try {
    // Use sport-specific analysis endpoint
    let apiUrl;
    if (sport === 'football') {
      apiUrl = `/api/team-analysis/${teamId}`;
    } else {
      apiUrl = `/api/${sport}/team-analysis/${teamId}`;
    }

    const res = await fetch(apiUrl);
    
    if (!res.ok) {
      throw new Error(`Analysis failed: ${res.status}`);
    }

    const data = await res.json();

    window.DOM.teamAnalysisContainer.innerHTML = "";

    const wrapper = document.createElement("div");
    wrapper.className = "analysis-card";

    // Add sport header
    const sportHeader = document.createElement("div");
    sportHeader.className = "analysis-sport-header";
    sportHeader.innerHTML = `<span class="sport-emoji">${getSportEmoji(sport)}</span> ${sportName} Analysis`;
    wrapper.appendChild(sportHeader);

    // Check if data has fullTime structure
    if (data.fullTime) {
      Object.keys(data.fullTime).forEach(key => {
        const row = document.createElement("div");
        row.className = "analysis-row";
        
        let value = data.fullTime[key];
        let displayValue = typeof value === 'string' ? value : `${value}%`;
        
        row.innerHTML = `
          <span>${key}</span>
          <strong>${displayValue}</strong>
        `;
        wrapper.appendChild(row);
      });
    } else if (data.stats) {
      // Alternative format for other sports
      Object.keys(data.stats).forEach(key => {
        const row = document.createElement("div");
        row.className = "analysis-row";
        
        row.innerHTML = `
          <span>${key}</span>
          <strong>${data.stats[key]}</strong>
        `;
        wrapper.appendChild(row);
      });
    } else if (data.wins !== undefined) {
      // Win/loss format
      const stats = [
        { label: 'Wins', value: data.wins || 0 },
        { label: 'Losses', value: data.losses || 0 },
        { label: 'Win Rate', value: `${data.winRate || 0}%` },
        { label: 'Avg Score', value: data.avgScore || 'N/A' }
      ];
      
      stats.forEach(stat => {
        const row = document.createElement("div");
        row.className = "analysis-row";
        row.innerHTML = `
          <span>${stat.label}</span>
          <strong>${stat.value}</strong>
        `;
        wrapper.appendChild(row);
      });
    } else {
      // Fallback - show all data
      Object.keys(data).forEach(key => {
        if (typeof data[key] === 'object') return;
        
        const row = document.createElement("div");
        row.className = "analysis-row";
        row.innerHTML = `
          <span>${formatKey(key)}</span>
          <strong>${data[key]}</strong>
        `;
        wrapper.appendChild(row);
      });
    }

    window.DOM.teamAnalysisContainer.appendChild(wrapper);

  } catch (err) {
    console.error("Team analysis error:", err);
    window.DOM.teamAnalysisContainer.innerHTML = `<p class="placeholder">⚠️ Analysis unavailable for ${sportName}. Try again later.</p>`;
  }
};

// ==========================================================
// HELPER FUNCTIONS
// ==========================================================

function getSportEmoji(sport) {
  const emojiMap = {
    football: '⚽',
    basketball: '🏀',
    nfl: '🏈',
    nhl: '🏒',
    mlb: '⚾',
    tennis: '🎾',
    rugbyleague: '🏉',
    rugbyunion: '🏉',
    darts: '🎯',
    tabletennis: '🏓'
  };
  return emojiMap[sport] || '🏆';
}

function formatKey(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

// ==========================================================
// INITIALIZATION HOOK
// ==========================================================

// Hook into sport/competition changes
const originalLoadTopPicks = window.loadTopPicks;
window.loadTopPicks = async function() {
  if (originalLoadTopPicks) await originalLoadTopPicks.call(this);
  // Also reload teams when sport/competition changes
  setTimeout(() => window.loadTeamsForCurrentSport(), 100);
};

// Update team lookup section title based on sport
window.updateTeamLookupTitle = function() {
  const sport = window.currentSport || 'football';
  const sportName = SPORT_DISPLAY_NAMES[sport] || 'Football';
  
  const headerEl = document.querySelector('#teamAnalysisSection')?.previousElementSibling?.querySelector('h2');
  if (headerEl) {
    headerEl.textContent = `${sportName} Team Lookup`;
  }
  
  const descEl = document.querySelector('#teamAnalysisSection')?.previousElementSibling?.querySelector('p');
  if (descEl) {
    descEl.textContent = `Select a ${sportName.toLowerCase()} team to run deeper analysis.`;
  }
};

// ==========================================================
// EXPOSE FOR GLOBAL USE
// ==========================================================

window.refreshTeams = window.loadTeamsForCurrentSport;

console.log('✅ Multi-sport teams.js loaded');
