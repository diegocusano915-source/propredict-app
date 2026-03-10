// ==========================================================
// ProPredict — Stable Multi-Sport Dashboard + Performance
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
    teamAnalysisContainer: document.getElementById("teamAnalysisContainer"),

    perfTotal: document.getElementById("perfTotal"),
    perfSettled: document.getElementById("perfSettled"),
    perfWins: document.getElementById("perfWins"),
    perfLosses: document.getElementById("perfLosses"),
    perfWinRate: document.getElementById("perfWinRate"),
    perfROI: document.getElementById("perfROI")
};

// ==========================================================
// INIT
// ==========================================================

document.addEventListener("DOMContentLoaded", () => {
    bindEvents();
    updateCompetitionOptions();
    loadTopPicks();
    loadPerformanceSummary();
});
// ==========================================================
// LOAD PERFORMANCE SUMMARY
// ==========================================================

async function loadPerformanceSummary() {

    try {
        const res = await fetch("/api/performance/summary");
        const data = await res.json();

        DOM.perfTotal.textContent = data.totalPicks || 0;
        DOM.perfSettled.textContent = data.settledPicks || 0;
        DOM.perfWins.textContent = data.wins || 0;
        DOM.perfLosses.textContent = data.losses || 0;
        DOM.perfWinRate.textContent = data.winRate
            ? data.winRate + "%"
            : "0%";
        DOM.perfROI.textContent = data.roi
            ? data.roi + "%"
            : "0%";

    } catch (error) {
        console.error("Performance summary failed");
    }
}

// ==========================================================
// MODIFY ADD BUTTON BEHAVIOR (RECORD PICK)
// ==========================================================

function renderTopPicks() {

    DOM.topPicksContainer.innerHTML = "";

    if (!topPicksData.length) {
        DOM.topPicksContainer.innerHTML = "No projections available.";
        return;
    }

    topPicksData.forEach((pick) => {

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

        card.querySelector("button").addEventListener("click", async () => {

            accumulatorSelections.push(pick);

            // ✅ RECORD PICK TO PERFORMANCE ENGINE
            await fetch("/api/performance/record", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sport: currentSport,
                    matchId: pick.matchId,
                    market: pick.market,
                    probability: pick.probability * 100,
                    confidence: pick.confidence
                })
            });

            renderAccumulator();
            renderTopPicks();
            loadPerformanceSummary();
        });

        DOM.topPicksContainer.appendChild(card);
    });
}
