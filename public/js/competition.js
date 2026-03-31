// ==========================================================
// ProPredict — Multi-Sport Probability Intelligence Dashboard
// SPLIT BUILD — /public/js/competition.js
// PURPOSE: Competition dropdown population + team analysis availability
// REQUIRES: app-state.js, helpers.js, dom.js, auth.js
// ==========================================================

window.addOption = function addOption(value, text) {
  if (!window.DOM.competitionSelect) return;

  const option = document.createElement("option");
  option.value = value;
  option.textContent = text;
  window.DOM.competitionSelect.appendChild(option);
};

window.updateCompetitionOptions = function updateCompetitionOptions() {

  if (!window.DOM.competitionSelect) return;

  window.DOM.competitionSelect.innerHTML = "";

  if (window.currentSport === "football") {

    window.addOption("PL", "Premier League");
    window.addOption("PD", "La Liga");
    window.addOption("SA", "Serie A");
    window.addOption("BL1", "Bundesliga");
    window.addOption("FL1", "Ligue 1");

    // Secondary leagues
    window.addOption("EFL", "EFL Championship");
    window.addOption("BL2", "Bundesliga 2");
    window.addOption("SB", "Serie B");
    window.addOption("FL2", "Ligue 2");
    window.addOption("SD", "Segunda Division");

    // Added leagues
    window.addOption("SPL", "Saudi Pro League");
    window.addOption("J1", "Japan J-League");
    window.addOption("CSL", "Chinese Super League");

    // European competitions
    window.addOption("UCL", "UEFA Champions League");
    window.addOption("UEL", "UEFA Europa League");
    window.addOption("UECL", "UEFA Conference League");

    // International
    window.addOption("WC", "FIFA World Cup");
    window.addOption("EURO", "UEFA Euro");

    // Others
    window.addOption("ALLS", "Sweden Allsvenskan");
  } else if (window.currentSport === "basketball") {
    window.addOption("NBA", "NBA");
    window.addOption("WNBA", "WNBA");
    window.addOption("NCAAB", "NCAAB");
  } else if (window.currentSport === "nfl") {
    window.addOption("NFL", "NFL");
  } else if (window.currentSport === "nhl") {
    window.addOption("NHL", "NHL");
  } else if (window.currentSport === "rugbyleague") {
    window.addOption("NRL", "NRL");
  } else if (window.currentSport === "rugbyunion") {
    window.addOption("TOP14", "Top 14");
    window.addOption("SIXNATIONS", "Six Nations");
  } else if (window.currentSport === "mlb") {
    window.addOption("MLB", "MLB");
  } else if (window.currentSport === "tennis") {
    window.addOption("ATP", "ATP");
    window.addOption("WTA", "WTA");
  } else if (window.currentSport === "darts") {
    window.addOption("PDC", "PDC");
  } else if (window.currentSport === "tabletennis") {
    window.addOption("ALL", "All Events");
  }

  // ✅ Force-select first option to avoid stale values (mobile-safe)
  const first = window.DOM.competitionSelect.options[0];
  if (first) {
    window.DOM.competitionSelect.value = first.value;
    window.currentCompetition = first.value;
  } else {
    window.currentCompetition = "";
  }

  // Team analysis availability
  if (window.currentSport === "football") {
    if (typeof window.loadTeams === "function") {
      window.loadTeams(window.currentCompetition);
    }
  } else {
    if (window.DOM.teamSelect) {
      window.DOM.teamSelect.innerHTML = `<option value="">Football Only</option>`;
    }

    if (window.DOM.teamAnalysisContainer) {
      window.DOM.teamAnalysisContainer.innerHTML =
        `<p class="placeholder">Team analysis available for football only.</p>`;
    }
  }
};
