// ==========================================================
// ProPredict — Stable Multi-Sport Dashboard
// ==========================================================

let currentSport = "football";
let currentCompetition = "PL";
let topPicksData = [];
let accumulatorSelections = [];

// ==========================================================
// DOM REFERENCES
// ==========================================================

const DOM = {
    sportSelect: document.getElementById("sportSelect"),
    competitionSelect: document.getElementById("competitionSelect"),
    eliteToggle: document.getElementById("eliteToggle"),

    topPicksContainer: document.getElementById("topPicksContainer"),

    accumulatorContainer: document.getElementById("accumulatorSelections"),
    combinedProbability: document.getElementById("combinedProbability"),
    decimalOdds: document.getElementById("decimalOdds"),
    riskLevel: document.getElementById("riskLevel"),
    clearAccumulatorBtn: document.getElementById("clearAccumulatorBtn"),

    teamSelect: document.getElementById("teamSelect"),
    analyzeBtn: document.getElementById("analyzeBtn"),
    teamAnalysisContainer: document.getElementById("teamAnalysisContainer")
};

// ==========================================================
// INIT
// ==========================================================

document.addEventListener("DOMContentLoaded", () => {
    bindEvents();
    updateCompetitionOptions();
    loadTopPicks();
});

// ==========================================================
// EVENTS
// ==========================================================

function bindEvents() {

    DOM.sportSelect.addEventListener("change", (e) => {
        currentSport = e.target.value;
        updateCompetitionOptions();
        accumulatorSelections = [];
        renderAccumulator();
        loadTopPicks();
    });

    DOM.competitionSelect.addEventListener("change", (e) => {
        currentCompetition = e.target.value;
        accumulatorSelections = [];
        renderAccumulator();
        loadTopPicks();
    });

    DOM.eliteToggle.addEventListener("change", () => {
        loadTopPicks();
    });

    DOM.clearAccumulatorBtn.addEventListener("click", () => {
        accumulatorSelections = [];
        renderAccumulator();
        renderTopPicks();
    });

    DOM.analyzeBtn.addEventListener("click", () => {
        if (currentSport !== "football") return;
        const teamId = DOM.teamSelect.value;
        if (teamId) analyzeTeam(teamId);
    });
}

// ==========================================================
// COMPETITION OPTIONS PER SPORT
// ==========================================================

function updateCompetitionOptions() {

    DOM.competitionSelect.innerHTML = "";

    if (currentSport === "football") {
        addOption("PL", "Premier League");
        addOption("PD", "La Liga");
        addOption("SA", "Serie A");
        addOption("BL1", "Bundesliga");
    }

    if (currentSport === "basketball") {
        addOption("NBA", "NBA");
    }

    if (currentSport === "darts") {
        addOption("PDC", "PDC");
    }

    if (currentSport === "tabletennis") {
        addOption("ALL", "All Events");
    }

    currentCompetition = DOM.competitionSelect.value;

    if (currentSport === "football") {
        loadTeams(currentCompetition);
    } else {
        DOM.teamSelect.innerHTML = `<option value="">Football Only</option>`;
        DOM.teamAnalysisContainer.innerHTML =
            `<p class="placeholder">Team analysis available for football only.</p>`;
    }
}

function addOption(value, text) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = text;
    DOM.competitionSelect.appendChild(option);
}

// ==========================================================
// LOAD TOP PICKS
// ==========================================================

async function loadTopPicks() {

    DOM.topPicksContainer.innerHTML = "Loading projections...";

    try {

        const route = DOM.eliteToggle.checked
            ? `/api/elite/${currentSport}/${currentCompetition}`
            : `/api/top-picks/${currentSport}/${currentCompetition}`;

        const res = await fetch(route);
        const data = await res.json();

        const rawPicks = DOM.eliteToggle.checked
            ? data.elitePicks
            : data.topPicks;

        topPicksData = normalizePicks(rawPicks);

        renderTopPicks();

    } catch (err) {
        DOM.topPicksContainer.innerHTML = "Failed to load fixtures.";
    }
}
// ==========================================================
// NORMALIZE PICKS
// ==========================================================

function normalizePicks(raw) {

    if (!raw) return [];

    // FOOTBALL (flat array)
    if (Array.isArray(raw)) {

        return raw.map(pick => {

            const match = pick.match || "";
            const parts = match.split(" vs ");

            return {
                matchId: match,
                homeTeam: parts[0] || "",
                awayTeam: parts[1] || "",
                market: "Over 2.5 Goals",
                probability: parseFloat(pick.over25) / 100 || 0,
                confidence: pick.confidence || "Low"
            };
        });
    }

    // GROUPED SPORTS
    if (typeof raw === "object") {

        const combined = [];

        Object.keys(raw).forEach(marketKey => {

            raw[marketKey].forEach(pick => {

                combined.push({
                    matchId: pick.matchId,
                    homeTeam: pick.homeTeam,
                    awayTeam: pick.awayTeam,
                    market: pick.market,
                    probability:
                        parseFloat(
                            pick.adjustedProbability ||
                            pick.impliedProbability ||
                            pick.probability
                        ) / 100,
                    confidence: pick.confidence || "Low"
                });

            });

        });

        return combined;
    }

    return [];
}

// ==========================================================
// RENDER TOP PICKS
// ==========================================================

function renderTopPicks() {

    DOM.topPicksContainer.innerHTML = "";

    if (!topPicksData.length) {
        DOM.topPicksContainer.innerHTML = "No projections available.";
        return;
    }

    topPicksData.forEach((pick, index) => {

        const added = accumulatorSelections.some(sel =>
            sel.matchId === pick.matchId &&
            sel.market === pick.market
        );

        const card = document.createElement("div");
        card.className = "pick-card";

        card.innerHTML = `
            <div><strong>${pick.homeTeam} vs ${pick.awayTeam}</strong></div>
            <div>${pick.market}</div>
            <div>${(pick.probability * 100).toFixed(1)}%</div>
            <div>${pick.confidence}</div>
            <button ${added ? "disabled" : ""}>
                ${added ? "Added" : "Add"}
            </button>
        `;

        card.querySelector("button").addEventListener("click", () => {
            accumulatorSelections.push(pick);
            renderAccumulator();
            renderTopPicks();
        });

        DOM.topPicksContainer.appendChild(card);
    });
}

// ==========================================================
// ACCUMULATOR
// ==========================================================

function renderAccumulator() {

    DOM.accumulatorContainer.innerHTML = "";

    if (!accumulatorSelections.length) {
        DOM.accumulatorContainer.innerHTML =
            `<p class="builder-empty">No selections added.</p>`;
        updateMetrics(0);
        return;
    }

    accumulatorSelections.forEach((pick, index) => {

        const row = document.createElement("div");
        row.className = "builder-item";

        row.innerHTML = `
            <div>
                <div>${pick.homeTeam} vs ${pick.awayTeam}</div>
                <div>${pick.market}</div>
                <div>${(pick.probability * 100).toFixed(1)}%</div>
            </div>
            <button>Remove</button>
        `;

        row.querySelector("button").addEventListener("click", () => {
            accumulatorSelections.splice(index, 1);
            renderAccumulator();
            renderTopPicks();
        });

        DOM.accumulatorContainer.appendChild(row);
    });

    const combinedProbability = accumulatorSelections.reduce(
        (acc, pick) => acc * pick.probability,
        1
    );

    updateMetrics(combinedProbability);
}

function updateMetrics(probabilityDecimal) {

    const percentage = probabilityDecimal * 100;

    DOM.combinedProbability.textContent =
        percentage.toFixed(2) + "%";

    DOM.decimalOdds.textContent =
        probabilityDecimal > 0
            ? (1 / probabilityDecimal).toFixed(2)
            : "-";

    let risk = "High";
    if (percentage >= 60) risk = "Low";
    else if (percentage >= 35) risk = "Medium";

    DOM.riskLevel.textContent =
        probabilityDecimal ? risk : "-";
}

// ==========================================================
// FOOTBALL TEAM ANALYSIS
// ==========================================================

async function loadTeams(league) {

    DOM.teamSelect.innerHTML =
        `<option value="">Loading teams...</option>`;

    try {

        const res = await fetch(`/api/league-teams/${league}`);
        const teams = await res.json();

        DOM.teamSelect.innerHTML =
            `<option value="">Select Team</option>`;

        teams.forEach(team => {
            const option = document.createElement("option");
            option.value = team.id;
            option.textContent = team.name;
            DOM.teamSelect.appendChild(option);
        });

    } catch {
        DOM.teamSelect.innerHTML =
            `<option value="">Select Team</option>`;
    }
}

async function analyzeTeam(teamId) {

    try {

        const res = await fetch(`/api/team-analysis/${teamId}`);
        const data = await res.json();

        DOM.teamAnalysisContainer.innerHTML = "";

        Object.keys(data.fullTime || {}).forEach(key => {

            const div = document.createElement("div");
            div.textContent = `${key}: ${data.fullTime[key]}%`;
            DOM.teamAnalysisContainer.appendChild(div);
        });

    } catch {
        DOM.teamAnalysisContainer.innerHTML =
            `<p class="placeholder">Analysis failed.</p>`;
    }
}
