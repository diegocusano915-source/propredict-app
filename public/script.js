// =============================
// DOM ELEMENTS
// =============================

const leagueSelect = document.getElementById("leagueSelect");
const topPicksContainer = document.getElementById("topPicksContainer");
const cacheStatus = document.getElementById("cacheStatus");

const analyzeBtn = document.getElementById("analyzeBtn");
const teamIdInput = document.getElementById("teamIdInput");

const analysisPanel = document.getElementById("analysisPanel");
const fullTimeGrid = document.getElementById("fullTimeGrid");
const firstHalfGrid = document.getElementById("firstHalfGrid");

// =============================
// UTILITY FUNCTIONS
// =============================

function getConfidenceClass(label) {
    if (!label) return "";

    const value = label.toLowerCase();

    if (value.includes("elite")) return "confidence-elite";
    if (value.includes("strong")) return "confidence-strong";
    if (value.includes("medium")) return "confidence-medium";
    return "confidence-low";
}

function formatPercent(value) {
    if (value === null || value === undefined) return "-";
    return `${Number(value).toFixed(1)}%`;
}

function clearElement(element) {
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }
}

// =============================
// TOP PICKS
// =============================

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
                "<p>No projections available.</p>";
            return;
        }

        data.topPicks.forEach(match => {
            const card = document.createElement("div");
            card.className = "card";

            const title = document.createElement("h4");
            title.textContent = match.match;
            card.appendChild(title);

            const metrics = [
                { label: "Over 2.5", value: match.over25 },
                { label: "BTTS", value: match.btts },
                { label: "Home Win", value: match.homeWin }
            ];

            metrics.forEach(item => {
                const row = document.createElement("div");
                row.className = "metric";

                const label = document.createElement("span");
                label.textContent = item.label;

                const value = document.createElement("span");
                value.textContent = `${item.value}%`;

                row.appendChild(label);
                row.appendChild(value);
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

// =============================
// TEAM ANALYSIS (EXPANDED)
// =============================

async function loadTeamAnalysis(teamId) {
    try {
        analysisPanel.classList.add("hidden");
        clearElement(fullTimeGrid);
        clearElement(firstHalfGrid);

        const response = await fetch(`/api/team-analysis/${teamId}`);
        const data = await response.json();

        if (!data) return;

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
            value.textContent = valueText ?? "-";

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
            value.textContent = valueText ?? "-";

            item.appendChild(label);
            item.appendChild(value);

            firstHalfGrid.appendChild(item);
        });

        analysisPanel.classList.remove("hidden");

    } catch (error) {
        console.error("Team analysis error:", error);
    }
}

// =============================
// EVENTS
// =============================

leagueSelect.addEventListener("change", (e) => {
    loadTopPicks(e.target.value);
});

analyzeBtn.addEventListener("click", () => {
    const teamId = teamIdInput.value.trim();
    if (!teamId) return;
    loadTeamAnalysis(teamId);
});

// =============================
// INITIAL LOAD
// =============================

document.addEventListener("DOMContentLoaded", () => {
    loadTopPicks("PL");
});
