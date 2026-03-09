const leagueSelect = document.getElementById("leagueSelect");
const teamSelect = document.getElementById("teamSelect");
const analyzeBtn = document.getElementById("analyzeBtn");

const topPicksContainer = document.getElementById("topPicksContainer");
const cacheStatus = document.getElementById("cacheStatus");

const analysisPanel = document.getElementById("analysisPanel");
const fullTimeGrid = document.getElementById("fullTimeGrid");
const firstHalfGrid = document.getElementById("firstHalfGrid");

/* =============================
   BUILDER STATE
============================= */

let builderSelections = [];

const builderSelectionsContainer = document.getElementById("builderSelections");
const combinedProbabilityEl = document.getElementById("combinedProbability");
const combinedOddsEl = document.getElementById("combinedOdds");
const riskLevelEl = document.getElementById("riskLevel");
const clearBuilderBtn = document.getElementById("clearBuilderBtn");

/* =============================
   UTILITY
============================= */

function getConfidenceClass(label) {
    if (!label) return "";
    const value = label.toLowerCase();
    if (value.includes("elite")) return "confidence-elite";
    if (value.includes("strong")) return "confidence-strong";
    if (value.includes("medium")) return "confidence-medium";
    return "confidence-low";
}

function clearElement(element) {
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }
}

/* =============================
   BUILDER FUNCTIONS
============================= */

function addToBuilder(matchName, market, probability) {
    const id = `${matchName}-${market}`;

    if (builderSelections.find(item => item.id === id)) return;

    builderSelections.push({
        id,
        matchName,
        market,
        probability: parseFloat(probability)
    });

    renderBuilder();
}

function removeFromBuilder(id) {
    builderSelections = builderSelections.filter(item => item.id !== id);
    renderBuilder();
}

function calculateCombinedProbability() {
    if (builderSelections.length === 0) return 0;

    let combined = 1;

    builderSelections.forEach(item => {
        combined *= item.probability / 100;
    });

    return combined * 100;
}

function getRiskLevel(prob) {
    if (prob >= 60) return "Low Risk";
    if (prob >= 40) return "Moderate Risk";
    if (prob >= 20) return "High Risk";
    return "Very High Risk";
}

function renderBuilder() {
    clearElement(builderSelectionsContainer);

    if (builderSelections.length === 0) {
        builderSelectionsContainer.innerHTML =
            '<p class="builder-empty">No selections added.</p>';
        combinedProbabilityEl.textContent = "0%";
        combinedOddsEl.textContent = "-";
        riskLevelEl.textContent = "-";
        return;
    }

    builderSelections.forEach(item => {
        const row = document.createElement("div");
        row.className = "builder-selection-item";

        const text = document.createElement("span");
        text.textContent =
            `${item.matchName} — ${item.market} (${item.probability}%)`;

        const removeBtn = document.createElement("button");
        removeBtn.textContent = "Remove";
        removeBtn.className = "remove-selection-btn";
        removeBtn.onclick = () => removeFromBuilder(item.id);

        row.appendChild(text);
        row.appendChild(removeBtn);

        builderSelectionsContainer.appendChild(row);
    });

    const combinedProb = calculateCombinedProbability();
    combinedProbabilityEl.textContent = `${combinedProb.toFixed(2)}%`;

    if (combinedProb > 0) {
        const impliedOdds = (100 / combinedProb).toFixed(2);
        combinedOddsEl.textContent = impliedOdds;
        riskLevelEl.textContent = getRiskLevel(combinedProb);
    } else {
        combinedOddsEl.textContent = "-";
        riskLevelEl.textContent = "-";
    }
}

clearBuilderBtn.addEventListener("click", () => {
    builderSelections = [];
    renderBuilder();
});

/* =============================
   LOAD TEAMS
============================= */

async function loadTeams(leagueCode) {
    try {
        teamSelect.innerHTML = `<option value="">Loading teams...</option>`;

        const response = await fetch(`/api/teams/${leagueCode}`);
        const data = await response.json();

        teamSelect.innerHTML = `<option value="">Select Team</option>`;

        data.teams.forEach(team => {
            const option = document.createElement("option");
            option.value = team.id;
            option.textContent = team.name;
            teamSelect.appendChild(option);
        });

    } catch (error) {
        console.error("Error loading teams:", error);
    }
}

/* =============================
   TOP PICKS
============================= */

async function loadTopPicks(leagueCode) {
    try {
        clearElement(topPicksContainer);
        cacheStatus.textContent = "Loading projections...";

        const response = await fetch(`/api/top-picks/${leagueCode}`);
        const data = await response.json();

        cacheStatus.textContent = data.cached
            ? "Cached result (10 min window)"
            : "Live calculation";

        if (!data.topPicks || data.topPicks.length === 0) {
            topPicksContainer.innerHTML =
                "<p>No projections available for this league.</p>";
            return;
        }

        data.topPicks.forEach(match => {
            const card = document.createElement("div");
            card.className = "card";

            const title = document.createElement("h4");
            title.textContent = match.match;
            card.appendChild(title);

            const markets = [
                { label: "Over 2.5", value: match.over25 },
                { label: "BTTS", value: match.btts },
                { label: "Home Win", value: match.homeWin }
            ];

            markets.forEach(item => {
                const row = document.createElement("div");
                row.className = "metric";

                const label = document.createElement("span");
                label.textContent = `${item.label} — ${item.value}%`;

                const addBtn = document.createElement("button");
                addBtn.textContent = "Add";
                addBtn.className = "add-selection-btn";
                addBtn.onclick = () =>
                    addToBuilder(match.match, item.label, item.value);

                row.appendChild(label);
                row.appendChild(addBtn);
                card.appendChild(row);
            });

            const confidenceRow = document.createElement("div");
            confidenceRow.className =
                `metric ${getConfidenceClass(match.confidence)}`;

            const confLabel = document.createElement("span");
            confLabel.textContent = "Confidence";

            const confValue = document.createElement("span");
            confValue.textContent = match.confidence;

            confidenceRow.appendChild(confLabel);
            confidenceRow.appendChild(confValue);
            card.appendChild(confidenceRow);

            topPicksContainer.appendChild(card);
        });

    } catch (error) {
        cacheStatus.textContent = "Error loading projections";
        console.error(error);
    }
}

/* =============================
   TEAM ANALYSIS
============================= */

async function loadTeamAnalysis(teamId) {
    try {
        analysisPanel.classList.add("hidden");
        clearElement(fullTimeGrid);
        clearElement(firstHalfGrid);

        const response = await fetch(`/api/team-analysis/${teamId}`);
        const data = await response.json();

        const fullTimeMetrics = [
            ["Avg Goals Scored", data.avgGoalsScored],
            ["Avg Goals Conceded", data.avgGoalsConceded],
            ["Over 0.5", `${data.over05}%`],
            ["Over 1.5", `${data.over15}%`],
            ["Over 2.5", `${data.over25}%`],
            ["Over 3.5", `${data.over35}%`],
            ["BTTS", `${data.btts}%`],
            ["Win %", `${data.winPercentage}%`],
            ["Draw %", `${data.drawPercentage}%`],
            ["Loss %", `${data.lossPercentage}%`],
            ["Double Chance 1X", `${data.doubleChance1X}%`],
            ["Double Chance X2", `${data.doubleChanceX2}%`]
        ];

        fullTimeMetrics.forEach(([labelText, valueText]) => {
            const item = document.createElement("div");
            item.className = "analysis-item";

            const label = document.createElement("span");
            label.textContent = labelText;

            const value = document.createElement("span");
            value.textContent = valueText;

            item.appendChild(label);
            item.appendChild(value);
            fullTimeGrid.appendChild(item);
        });

        const firstHalfMetrics = [
            ["FH Over 0.5", `${data.fhOver05}%`],
            ["FH Over 1.5", `${data.fhOver15}%`],
            ["FH BTTS", `${data.fhBtts}%`],
            ["FH Win %", `${data.fhWinPercentage}%`],
            ["FH Draw %", `${data.fhDrawPercentage}%`],
            ["FH Loss %", `${data.fhLossPercentage}%`]
        ];

        firstHalfMetrics.forEach(([labelText, valueText]) => {
            const item = document.createElement("div");
            item.className = "analysis-item";

            const label = document.createElement("span");
            label.textContent = labelText;

            const value = document.createElement("span");
            value.textContent = valueText;

            item.appendChild(label);
            item.appendChild(value);
            firstHalfGrid.appendChild(item);
        });

        analysisPanel.classList.remove("hidden");

    } catch (error) {
        console.error("Team analysis error:", error);
    }
}

/* =============================
   EVENTS
============================= */

leagueSelect.addEventListener("change", (e) => {
    const leagueCode = e.target.value;
    loadTopPicks(leagueCode);
    loadTeams(leagueCode);
});

analyzeBtn.addEventListener("click", () => {
    const teamId = teamSelect.value;
    if (!teamId) return;
    loadTeamAnalysis(teamId);
});

/* =============================
   INITIAL LOAD
============================= */

document.addEventListener("DOMContentLoaded", () => {
    loadTopPicks("PL");
    loadTeams("PL");
});
