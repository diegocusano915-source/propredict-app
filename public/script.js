// ==========================================================
// ProPredict
// Football Probability Intelligence Dashboard
// Frontend Controller — Normalized Stable Build
// ==========================================================


// ==========================================================
// SECTION 1 — GLOBAL STATE
// ==========================================================

let currentLeague = "PL";
let topPicksData = [];
let accumulatorSelections = [];
let isLoading = false;


// ==========================================================
// SECTION 2 — DOM REFERENCES
// ==========================================================

const DOM = {
    leagueSelect: document.getElementById("leagueSelect"),
    topPicksContainer: document.getElementById("topPicksContainer"),
    accumulatorContainer: document.getElementById("accumulatorContainer"),
    combinedProbability: document.getElementById("combinedProbability"),
    impliedOdds: document.getElementById("impliedOdds"),
    riskLevel: document.getElementById("riskLevel"),
    clearAccumulatorButton: document.getElementById("clearAccumulator")
};


// ==========================================================
// SECTION 3 — INIT
// ==========================================================

document.addEventListener("DOMContentLoaded", function () {
    initializeApplication();
});

function initializeApplication() {
    bindEvents();
    resetAccumulatorMetrics();
    loadTopPicksForLeague(currentLeague);
}


// ==========================================================
// SECTION 4 — EVENTS
// ==========================================================

function bindEvents() {

    if (DOM.leagueSelect) {
        DOM.leagueSelect.addEventListener("change", function (e) {
            currentLeague = e.target.value;
            clearAccumulatorSelections();
            loadTopPicksForLeague(currentLeague);
        });
    }

    if (DOM.clearAccumulatorButton) {
        DOM.clearAccumulatorButton.addEventListener("click", function () {
            clearAccumulatorSelections();
        });
    }

}


// ==========================================================
// SECTION 5 — FETCH + NORMALIZE (KEY FIX)
// ==========================================================

async function loadTopPicksForLeague(leagueCode) {

    if (!leagueCode) return;
    if (isLoading) return;

    isLoading = true;

    renderLoadingState();

    try {

        const response = await fetch(`/api/top-picks/${leagueCode}`);
        const data = await response.json();

        const picksArray = Array.isArray(data)
            ? data
            : Array.isArray(data.topPicks)
                ? data.topPicks
                : [];

        if (!picksArray.length) {
            renderEmptyState();
            isLoading = false;
            return;
        }

        // ✅ NORMALIZE BACKEND STRUCTURE HERE
        topPicksData = picksArray.map(function (pick) {

            const matchParts = typeof pick.match === "string"
                ? pick.match.split(" vs ")
                : ["Unknown", "Unknown"];

            const homeTeam = matchParts[0] || "Unknown";
            const awayTeam = matchParts[1] || "Unknown";

            const over25 = parseFloat(pick.over25);
            const btts = parseFloat(pick.btts);
            const homeWin = parseFloat(pick.homeWin);

            const markets = [
                { name: "Over 2.5 Goals", value: over25 },
                { name: "BTTS", value: btts },
                { name: "Home Win", value: homeWin }
            ].filter(m => !isNaN(m.value));

            const bestMarket = markets.sort((a, b) => b.value - a.value)[0] || {
                name: "N/A",
                value: 0
            };

            return {
                matchId: pick.match,
                homeTeam: homeTeam,
                awayTeam: awayTeam,
                market: bestMarket.name,
                probability: bestMarket.value / 100,
                confidence: pick.confidence || "Low"
            };

        });

        renderTopPicksCards();

    } catch (error) {
        renderErrorState();
    }

    isLoading = false;
}


// ==========================================================
// SECTION 6 — STATES
// ==========================================================

function renderLoadingState() {
    if (!DOM.topPicksContainer) return;
    DOM.topPicksContainer.innerHTML = `<div>Loading fixtures...</div>`;
}

function renderEmptyState() {
    if (!DOM.topPicksContainer) return;
    DOM.topPicksContainer.innerHTML = `<div>No fixtures available.</div>`;
}

function renderErrorState() {
    if (!DOM.topPicksContainer) return;
    DOM.topPicksContainer.innerHTML = `<div>Failed to load fixtures.</div>`;
}


// ==========================================================
// SECTION 7 — TOP PICKS RENDER
// ==========================================================

function renderTopPicksCards() {

    if (!DOM.topPicksContainer) return;

    DOM.topPicksContainer.innerHTML = "";

    topPicksData.forEach(function (pick, index) {

        const card = document.createElement("div");
        card.className = "pick-card";

        const alreadyAdded = accumulatorSelections.some(item =>
            item.matchId === pick.matchId &&
            item.market === pick.market
        );

        card.innerHTML = `
            <div class="fixture">
                ${pick.homeTeam} vs ${pick.awayTeam}
            </div>
            <div class="confidence ${formatConfidenceClass(pick.confidence)}">
                ${pick.confidence}
            </div>
            <div class="market">
                ${pick.market}
            </div>
            <div class="probability">
                Probability: ${(pick.probability * 100).toFixed(1)}%
            </div>
            <button 
                class="add-btn"
                data-index="${index}"
                ${alreadyAdded ? "disabled" : ""}
            >
                ${alreadyAdded ? "Added" : "Add"}
            </button>
        `;

        DOM.topPicksContainer.appendChild(card);

    });

    attachAddListeners();
}
// ==========================================================
// SECTION 8 — ADD TO ACCUMULATOR
// ==========================================================

function attachAddListeners() {

    const buttons = document.querySelectorAll(".add-btn");

    buttons.forEach(function (button) {

        button.addEventListener("click", function (event) {

            const index = event.target.getAttribute("data-index");

            if (index === null) return;

            const pick = topPicksData[index];

            if (!pick) return;

            handleAddSelection(pick);

        });

    });

}


function handleAddSelection(pick) {

    if (!pick) return;

    const duplicate = accumulatorSelections.some(item =>
        item.matchId === pick.matchId &&
        item.market === pick.market
    );

    if (duplicate) return;

    accumulatorSelections.push(pick);

    renderAccumulatorSelections();
    renderTopPicksCards();

}


// ==========================================================
// SECTION 9 — ACCUMULATOR RENDER
// ==========================================================

function renderAccumulatorSelections() {

    if (!DOM.accumulatorContainer) return;

    DOM.accumulatorContainer.innerHTML = "";

    if (!accumulatorSelections.length) {
        resetAccumulatorMetrics();
        return;
    }

    accumulatorSelections.forEach(function (pick, index) {

        const row = document.createElement("div");
        row.className = "accumulator-row";

        row.innerHTML = `
            <div>
                <div>${pick.homeTeam} vs ${pick.awayTeam}</div>
                <div>${pick.market}</div>
                <div>${(pick.probability * 100).toFixed(1)}%</div>
            </div>
            <button class="remove-btn" data-index="${index}">
                Remove
            </button>
        `;

        DOM.accumulatorContainer.appendChild(row);

    });

    attachRemoveListeners();
    calculateAccumulatorMetrics();

}


// ==========================================================
// SECTION 10 — REMOVE
// ==========================================================

function attachRemoveListeners() {

    const removeButtons = document.querySelectorAll(".remove-btn");

    removeButtons.forEach(function (button) {

        button.addEventListener("click", function (event) {

            const index = event.target.getAttribute("data-index");

            if (index === null) return;

            accumulatorSelections.splice(index, 1);

            renderAccumulatorSelections();
            renderTopPicksCards();

        });

    });

}


// ==========================================================
// SECTION 11 — CLEAR
// ==========================================================

function clearAccumulatorSelections() {

    accumulatorSelections = [];

    renderAccumulatorSelections();
    renderTopPicksCards();

}


// ==========================================================
// SECTION 12 — PROBABILITY ENGINE
// ==========================================================

function calculateAccumulatorMetrics() {

    let combinedProbability = 1;

    accumulatorSelections.forEach(function (pick) {

        combinedProbability *= normalizeProbability(pick.probability);

    });

    const percentage = combinedProbability * 100;

    if (DOM.combinedProbability) {
        DOM.combinedProbability.textContent = percentage.toFixed(2) + "%";
    }

    if (DOM.impliedOdds) {

        if (combinedProbability > 0) {
            DOM.impliedOdds.textContent = (1 / combinedProbability).toFixed(2);
        } else {
            DOM.impliedOdds.textContent = "-";
        }

    }

    if (DOM.riskLevel) {

        let risk = "High";

        if (percentage >= 60) {
            risk = "Low";
        } else if (percentage >= 35) {
            risk = "Medium";
        }

        DOM.riskLevel.textContent = risk;
    }

}


// ==========================================================
// SECTION 13 — RESET METRICS
// ==========================================================

function resetAccumulatorMetrics() {

    if (DOM.combinedProbability) {
        DOM.combinedProbability.textContent = "0%";
    }

    if (DOM.impliedOdds) {
        DOM.impliedOdds.textContent = "-";
    }

    if (DOM.riskLevel) {
        DOM.riskLevel.textContent = "-";
    }

}


// ==========================================================
// SECTION 14 — HELPERS
// ==========================================================

function normalizeProbability(value) {

    if (typeof value !== "number") return 0;
    if (value < 0) return 0;
    if (value > 1) return 1;

    return value;

}


function formatConfidenceClass(confidence) {

    if (!confidence) return "";

    return confidence.toLowerCase();

}
