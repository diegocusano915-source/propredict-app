// ==========================================================
// ProPredict — Multi-Sport Stable Build
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

    builderSelections: document.getElementById("accumulatorSelections"),
    combinedProbability: document.getElementById("combinedProbability"),
    combinedOdds: document.getElementById("decimalOdds"),
    riskLevel: document.getElementById("riskLevel"),
    clearBuilderBtn: document.getElementById("clearAccumulatorBtn"),

    teamSelect: document.getElementById("teamSelect"),
    analyzeBtn: document.getElementById("analyzeBtn"),
    teamAnalysisContainer: document.getElementById("teamAnalysisContainer")
};

// ==========================================================
// INIT
// ==========================================================

document.addEventListener("DOMContentLoaded", () => {
    bindEvents();
    loadTopPicks();
});

// ==========================================================
// EVENTS
// ==========================================================

function bindEvents() {

    DOM.sportSelect.addEventListener("change", (e) => {
        currentSport = e.target.value;
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

    DOM.clearBuilderBtn.addEventListener("click", () => {
        accumulatorSelections = [];
        renderAccumulator();
        renderTopPicks();
    });
}

// ==========================================================
// LOAD TOP PICKS (MULTI-SPORT)
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
// NORMALIZE PICK STRUCTURE
// ==========================================================

function normalizePicks(raw) {

    if (!raw) return [];

    // Football (flat array)
    if (Array.isArray(raw)) {
        return raw.map(pick => ({
            matchId: pick.match || pick.matchId,
            homeTeam: pick.homeTeam || "",
            awayTeam: pick.awayTeam || "",
            market: pick.market,
            probability: parseFloat(pick.adjustedProbability || pick.impliedProbability || pick.probability) / 100,
            confidence: pick.confidence || "Low"
        }));
    }

    // Grouped markets (basketball, darts, table tennis)
    if (typeof raw === "object") {

        const combined = [];

        Object.keys(raw).forEach(marketKey => {

            raw[marketKey].forEach(pick => {

                combined.push({
                    matchId: pick.matchId,
                    homeTeam: pick.homeTeam,
                    awayTeam: pick.awayTeam,
                    market: pick.market,
                    probability: parseFloat(pick.adjustedProbability || pick.impliedProbability || pick.probability) / 100,
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
// ACCUMULATOR (FRONTEND SIDE CALCULATION)
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
            <button>Remove</button>
        `;

        row.querySelector("button").addEventListener("click", () => {
            accumulatorSelections.splice(index, 1);
            renderAccumulator();
            renderTopPicks();
        });

        DOM.builderSelections.appendChild(row);
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

    DOM.combinedOdds.textContent =
        probabilityDecimal > 0
            ? (1 / probabilityDecimal).toFixed(2)
            : "-";

    let risk = "High";
    if (percentage >= 60) risk = "Low";
    else if (percentage >= 35) risk = "Medium";

    DOM.riskLevel.textContent =
        probabilityDecimal ? risk : "-";
}
