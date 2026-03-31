// ==========================================================
// ProPredict — Multi-Sport Probability Intelligence Dashboard
// SPLIT BUILD — /public/js/teams.js
// PURPOSE: Football teams loader + team analysis
// REQUIRES: app-state.js, helpers.js, dom.js, auth.js
// ==========================================================

window.loadTeams = async function loadTeams(league) {

  if (!window.ppCanAccessProtectedApp()) return;
  if (!window.DOM.teamSelect) return;

  window.DOM.teamSelect.innerHTML =
    `<option value="">Loading teams...</option>`;

  try {

    const res = await fetch(`/api/league-teams/${league}`);
    const teams = await res.json();

    window.DOM.teamSelect.innerHTML =
      `<option value="">Select Team</option>`;

    teams.forEach(team => {
      const option = document.createElement("option");
      option.value = team.id;
      option.textContent = team.name;
      window.DOM.teamSelect.appendChild(option);
    });

  } catch {
    window.DOM.teamSelect.innerHTML =
      `<option value="">Select Team</option>`;
  }
};

window.analyzeTeam = async function analyzeTeam(teamId) {

  if (!window.ppCanAccessProtectedApp()) {
    window.ppOpenAuthModal("login");
    return;
  }

  if (!window.DOM.teamAnalysisContainer) return;

  window.DOM.teamAnalysisContainer.innerHTML =
    `<div class="loading-state">Analyzing team...</div>`;

  try {

    const res = await fetch(`/api/team-analysis/${teamId}`);
    const data = await res.json();

    window.DOM.teamAnalysisContainer.innerHTML = "";

    const wrapper = document.createElement("div");
    wrapper.className = "analysis-card";

    Object.keys(data.fullTime || {}).forEach(key => {

      const row = document.createElement("div");
      row.className = "analysis-row";

      row.innerHTML = `
        <span>${key}</span>
        <strong>${data.fullTime[key]}%</strong>
      `;

      wrapper.appendChild(row);
    });

    window.DOM.teamAnalysisContainer.appendChild(wrapper);

  } catch {
    window.DOM.teamAnalysisContainer.innerHTML =
      `<p class="placeholder">Analysis failed.</p>`;
  }
};
