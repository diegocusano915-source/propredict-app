// ==========================================================
// ProPredict
// Football Probability Intelligence Dashboard
// Fully Aligned & Stable Build
// ==========================================================


// ==========================================================
// GLOBAL STATE
// ==========================================================

let currentLeague = "PL";
let topPicksData = [];
let accumulatorSelections = [];
let isLoading = false;


// ==========================================================
// DOM REFERENCES (MATCHES index.html EXACTLY)
// ==========================================================

const DOM = {

    leagueSelect: document.getElementById("leagueSelect"),
    topPicksContainer: document.getElementById("topPicksContainer"),

    builderSelections: document.getElementById("builderSelections"),

    combinedProbability: document.getElementById("combinedProbability"),
    combinedOdds: document.getElementById("combinedOdds"),
    riskLevel: document.getElementById("riskLevel"),

    clearBuilderBtn: document.getElementById("clearBuilderBtn")

};


// ==========================================================
// INIT
// ==========================================================

document.addEventListener("DOMContentLoaded", function () {

    bindEvents();
    resetAccumulatorMetrics();
    loadTopPicksForLeague(currentLeague);

});


// ==========================================================
// EVENTS
// ==========================================================

function bindEvents() {

    if (DOM.leagueSelect) {
        DOM.leagueSelect.addEventListener("change", function (e) {
            currentLeague = e.target.value;
            clearAccumulatorSelections();
            loadTopPicksForLeague(currentLeague);
        });
    }

    if (DOM.clearBuilderBtn) {
        DOM.clearBuilderBtn.addEventListener("click", function () {
            clearAccumulatorSelections();
        });
    }

}


// ==========================================================
// FETCH + NORMALIZE
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
// STATE RENDERERS
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
// TOP PICKS RENDER
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
// ADD TO ACCUMULATOR
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
// ACCUMULATOR RENDER
// ==========================================================

function renderAccumulatorSelections() {

    if (!DOM.builderSelections) return;

    DOM.builderSelections.innerHTML = "";

    if (!accumulatorSelections.length) {

        DOM.builderSelections.innerHTML = `
            <p class="builder-empty">No selections added.</p>
        `;

        resetAccumulatorMetrics();
        return;
    }

    accumulatorSelections.forEach(function (pick, index) {

        const row = document.createElement("div");
        row.className = "builder-item";

        row.innerHTML = `
            <div class="builder-item-info">
                <div>${pick.homeTeam} vs ${pick.awayTeam}</div>
                <div>${pick.market}</div>
                <div>${(pick.probability * 100).toFixed(1)}%</div>
            </div>
            <button class="remove-btn" data-index="${index}">
                Remove
            </button>
        `;

        DOM.builderSelections.appendChild(row);

    });

    attachRemoveListeners();
    calculateAccumulatorMetrics();

}


// ==========================================================
// REMOVE
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
// CLEAR
// ==========================================================

function clearAccumulatorSelections() {

    accumulatorSelections = [];

    renderAccumulatorSelections();
    renderTopPicksCards();

}


// ==========================================================
// PROBABILITY ENGINE
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

    if (DOM.combinedOdds) {

        if (combinedProbability > 0) {
            DOM.combinedOdds.textContent = (1 / combinedProbability).toFixed(2);
        } else {
            DOM.combinedOdds.textContent = "-";
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
// RESET METRICS
// ==========================================================

function resetAccumulatorMetrics() {

    if (DOM.combinedProbability) {
        DOM.combinedProbability.textContent = "0%";
    }

    if (DOM.combinedOdds) {
        DOM.combinedOdds.textContent = "-";
    }

    if (DOM.riskLevel) {
        DOM.riskLevel.textContent = "-";
    }

}


// ==========================================================
// HELPERS
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
