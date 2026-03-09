// ==========================================================
// ProPredict — Stable Simplified Build
// ==========================================================

let currentLeague = "PL";
let topPicksData = [];
let accumulatorSelections = [];

const DOM = {
    leagueSelect: document.getElementById("leagueSelect"),
    topPicksContainer: document.getElementById("topPicksContainer"),
    builderSelections: document.getElementById("builderSelections"),
    combinedProbability: document.getElementById("combinedProbability"),
    combinedOdds: document.getElementById("combinedOdds"),
    riskLevel: document.getElementById("riskLevel"),
    clearBuilderBtn: document.getElementById("clearBuilderBtn"),
    teamSelect: document.getElementById("teamSelect"),
    analyzeBtn: document.getElementById("analyzeBtn"),
    analysisPanel: document.getElementById("analysisPanel"),
    fullTimeGrid: document.getElementById("fullTimeGrid"),
    firstHalfGrid: document.getElementById("firstHalfGrid")
};

document.addEventListener("DOMContentLoaded", () => {
    bindEvents();
    loadLeagueData(currentLeague);
});

function bindEvents() {

    DOM.leagueSelect.addEventListener("change", (e) => {
        currentLeague = e.target.value;
        accumulatorSelections = [];
        renderAccumulator();
        loadLeagueData(currentLeague);
    });

    DOM.clearBuilderBtn.addEventListener("click", () => {
        accumulatorSelections = [];
        renderAccumulator();
        renderTopPicks();
    });

    DOM.analyzeBtn.addEventListener("click", () => {
        const teamId = DOM.teamSelect.value;
        if (teamId) analyzeTeam(teamId);
    });
}


// ==========================================================
// LOAD BOTH PICKS + TEAMS TOGETHER
// ==========================================================

async function loadLeagueData(league) {
    await Promise.all([
        loadTopPicks(league),
        loadTeams(league)
    ]);
}


// ==========================================================
// TOP PICKS
// ==========================================================

async function loadTopPicks(league) {

    DOM.topPicksContainer.innerHTML = "Loading fixtures...";

    try {
        const res = await fetch(`/api/top-picks/${league}`);
        const data = await res.json();

        const picks = Array.isArray(data?.topPicks) ? data.topPicks : [];

        topPicksData = picks.map(pick => {

            const [home = "Unknown", away = "Unknown"] =
                typeof pick.match === "string"
                    ? pick.match.split(" vs ")
                    : [];

            const markets = [
                { name: "Over 2.5 Goals", value: parseFloat(pick.over25) },
                { name: "BTTS", value: parseFloat(pick.btts) },
                { name: "Home Win", value: parseFloat(pick.homeWin) }
            ].filter(m => !isNaN(m.value));

            const best = markets.sort((a,b) => b.value - a.value)[0] || {
                name: "N/A",
                value: 0
            };

            return {
                matchId: pick.match,
                homeTeam: home,
                awayTeam: away,
                market: best.name,
                probability: best.value / 100,
                confidence: pick.confidence || "Low"
            };
        });

        renderTopPicks();

    } catch {
        DOM.topPicksContainer.innerHTML = "Failed to load fixtures.";
    }
}

function renderTopPicks() {

    DOM.topPicksContainer.innerHTML = "";

    if (!topPicksData.length) {
        DOM.topPicksContainer.innerHTML = "No fixtures available.";
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
            <div>${pick.homeTeam} vs ${pick.awayTeam}</div>
            <div>${pick.confidence}</div>
            <div>${pick.market}</div>
            <div>Probability: ${(pick.probability*100).toFixed(1)}%</div>
            <button data-index="${index}" ${added ? "disabled" : ""}>
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

    DOM.builderSelections.innerHTML = "";

    if (!accumulatorSelections.length) {
        DOM.builderSelections.innerHTML =
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
            <button data-index="${index}">Remove</button>
        `;

        row.querySelector("button").addEventListener("click", () => {
            accumulatorSelections.splice(index, 1);
            renderAccumulator();
            renderTopPicks();
        });

        DOM.builderSelections.appendChild(row);
    });

    const combined = accumulatorSelections.reduce(
        (acc, pick) => acc * pick.probability,
        1
    );

    updateMetrics(combined);
}

function updateMetrics(probabilityDecimal) {

    const percentage = probabilityDecimal * 100;

    DOM.combinedProbability.textContent =
        percentage.toFixed(2) + "%";

    DOM.combinedOdds.textContent =
        probabilityDecimal > 0
            ? (1 / probabilityDecimal).toFixed(2)
            : "-";

    let risk = "High";
    if (percentage >= 60) risk = "Low";
    else if (percentage >= 35) risk = "Medium";

    DOM.riskLevel.textContent = probabilityDecimal ? risk : "-";
}


// ==========================================================
// TEAMS
// ==========================================================

async function loadTeams(league) {

    DOM.teamSelect.innerHTML =
        `<option value="">Loading teams...</option>`;

    try {
        const res = await fetch(`/api/league-teams/${league}`);
        const teams = await res.json();

        DOM.teamSelect.innerHTML =
            `<option value="">Select Team</option>`;

        if (!Array.isArray(teams)) return;

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


// ==========================================================
// TEAM ANALYSIS
// ==========================================================

async function analyzeTeam(teamId) {

    try {
        const res = await fetch(`/api/team-analysis/${teamId}`);
        const data = await res.json();

        if (!data) return;

        DOM.analysisPanel.classList.remove("hidden");

        renderAnalysisGrid(DOM.fullTimeGrid, data.fullTime);
        renderAnalysisGrid(DOM.firstHalfGrid, data.firstHalf);

    } catch {
        console.error("Team analysis failed");
    }
}

function renderAnalysisGrid(container, section) {

    if (!container) return;

    container.innerHTML = "";

    if (!section) return;

    Object.keys(section).forEach(key => {

        const item = document.createElement("div");
        item.className = "analysis-item";

        item.innerHTML = `
            <span>${key}</span>
            <span>${section[key]}%</span>
        `;

        container.appendChild(item);
    });
}
