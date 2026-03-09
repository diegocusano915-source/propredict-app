// ==========================================================
// ProPredict
// Football Probability Intelligence Dashboard
// Frontend Controller — Phase 2 Stable Expanded Build
// ==========================================================


// ==========================================================
// SECTION 1 — GLOBAL APPLICATION STATE
// ==========================================================

let currentLeague = "PL";

let topPicksData = [];

let accumulatorSelections = [];

let isLoading = false;


// ==========================================================
// SECTION 2 — DOM ELEMENT REFERENCES
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
// SECTION 3 — INITIALIZATION
// ==========================================================

document.addEventListener("DOMContentLoaded", function () {

    initializeApplication();

});


function initializeApplication() {

    bindGlobalEventListeners();

    resetAccumulatorMetrics();

    loadTopPicksForLeague(currentLeague);

}


// ==========================================================
// SECTION 4 — EVENT BINDING
// ==========================================================

function bindGlobalEventListeners() {

    if (DOM.leagueSelect) {

        DOM.leagueSelect.addEventListener("change", function (event) {

            handleLeagueChange(event);

        });

    }

    if (DOM.clearAccumulatorButton) {

        DOM.clearAccumulatorButton.addEventListener("click", function () {

            clearAccumulatorSelections();

        });

    }

}


// ==========================================================
// SECTION 5 — LEAGUE HANDLING
// ==========================================================

function handleLeagueChange(event) {

    const selectedLeague = event.target.value;

    if (!selectedLeague) return;

    currentLeague = selectedLeague;

    clearAccumulatorSelections();

    loadTopPicksForLeague(currentLeague);

}


// ==========================================================
// SECTION 6 — DATA FETCHING
// ==========================================================

async function loadTopPicksForLeague(leagueCode) {

    if (!leagueCode) return;

    if (isLoading) return;

    isLoading = true;

    renderLoadingState();

    try {

        const response = await fetch(`/api/top-picks/${leagueCode}`);

        const data = await response.json();

        if (!Array.isArray(data)) {

            renderEmptyState();

            isLoading = false;

            return;

        }

        topPicksData = data;

        renderTopPicksCards();

    } catch (error) {

        renderErrorState();

    }

    isLoading = false;

}


function renderLoadingState() {

    if (!DOM.topPicksContainer) return;

    DOM.topPicksContainer.innerHTML = `
        <div class="loading-state">
            Loading fixtures...
        </div>
    `;

}


function renderEmptyState() {

    if (!DOM.topPicksContainer) return;

    DOM.topPicksContainer.innerHTML = `
        <div class="empty-state">
            No fixtures available.
        </div>
    `;

}


function renderErrorState() {

    if (!DOM.topPicksContainer) return;

    DOM.topPicksContainer.innerHTML = `
        <div class="error-state">
            Failed to load fixtures.
        </div>
    `;

}


// ==========================================================
// SECTION 7 — TOP PICKS RENDERING
// ==========================================================

function renderTopPicksCards() {

    if (!DOM.topPicksContainer) return;

    DOM.topPicksContainer.innerHTML = "";

    if (!topPicksData.length) {

        renderEmptyState();

        return;

    }

    topPicksData.forEach(function (pick, index) {

        const cardElement = buildTopPickCard(pick, index);

        DOM.topPicksContainer.appendChild(cardElement);

    });

}


function buildTopPickCard(pick, index) {

    const card = document.createElement("div");

    card.className = "pick-card";

    const alreadyAdded = isSelectionAlreadyInAccumulator(pick);

    const probabilityPercentage = formatProbability(pick.probability);

    card.innerHTML = `
        <div class="pick-header">
            <div class="fixture">
                ${pick.homeTeam} vs ${pick.awayTeam}
            </div>
            <div class="confidence ${formatConfidenceClass(pick.confidence)}">
                ${pick.confidence || ""}
            </div>
        </div>

        <div class="market">
            ${pick.market}
        </div>

        <div class="probability">
            Probability: ${probabilityPercentage}
        </div>

        <button 
            class="add-selection-button"
            data-index="${index}"
            ${alreadyAdded ? "disabled" : ""}
        >
            ${alreadyAdded ? "Added" : "Add"}
        </button>
    `;

    return card;
}
// ==========================================================
// SECTION 8 — ACCUMULATOR LOGIC
// ==========================================================

function attachAddButtonListeners() {

    const addButtons = document.querySelectorAll(".add-selection-button");

    addButtons.forEach(function (button) {

        button.addEventListener("click", function (event) {

            const index = event.target.getAttribute("data-index");

            if (index === null) return;

            const pick = topPicksData[index];

            if (!pick) return;

            handleAddSelection(pick);

        });

    });

}


// Attach listeners after each render
const observer = new MutationObserver(function () {
    attachAddButtonListeners();
});

if (DOM.topPicksContainer) {
    observer.observe(DOM.topPicksContainer, { childList: true });
}


function handleAddSelection(pick) {

    if (!pick) return;

    if (isSelectionAlreadyInAccumulator(pick)) return;

    accumulatorSelections.push(pick);

    renderAccumulatorSelections();

    renderTopPicksCards();

}


// ==========================================================
// SECTION 9 — DUPLICATE CHECK
// ==========================================================

function isSelectionAlreadyInAccumulator(pick) {

    return accumulatorSelections.some(function (item) {

        return (
            item.matchId === pick.matchId &&
            item.market === pick.market
        );

    });

}


// ==========================================================
// SECTION 10 — ACCUMULATOR RENDERING
// ==========================================================

function renderAccumulatorSelections() {

    if (!DOM.accumulatorContainer) return;

    DOM.accumulatorContainer.innerHTML = "";

    if (!accumulatorSelections.length) {

        resetAccumulatorMetrics();

        return;

    }

    accumulatorSelections.forEach(function (pick, index) {

        const row = buildAccumulatorRow(pick, index);

        DOM.accumulatorContainer.appendChild(row);

    });

    calculateAndRenderAccumulatorMetrics();

}


function buildAccumulatorRow(pick, index) {

    const row = document.createElement("div");

    row.className = "accumulator-row";

    row.innerHTML = `
        <div class="accumulator-details">
            <div class="fixture">
                ${pick.homeTeam} vs ${pick.awayTeam}
            </div>
            <div class="market">
                ${pick.market}
            </div>
            <div class="probability">
                ${formatProbability(pick.probability)}
            </div>
        </div>

        <button 
            class="remove-selection-button"
            data-index="${index}"
        >
            Remove
        </button>
    `;

    const removeButton = row.querySelector(".remove-selection-button");

    removeButton.addEventListener("click", function () {

        handleRemoveSelection(index);

    });

    return row;

}


// ==========================================================
// SECTION 11 — REMOVE LOGIC
// ==========================================================

function handleRemoveSelection(index) {

    if (index < 0) return;

    if (index >= accumulatorSelections.length) return;

    accumulatorSelections.splice(index, 1);

    renderAccumulatorSelections();

    renderTopPicksCards();

}


// ==========================================================
// SECTION 12 — CLEAR ACCUMULATOR
// ==========================================================

function clearAccumulatorSelections() {

    accumulatorSelections = [];

    renderAccumulatorSelections();

    renderTopPicksCards();

}


// ==========================================================
// SECTION 13 — PROBABILITY ENGINE
// ==========================================================

function calculateAndRenderAccumulatorMetrics() {

    if (!accumulatorSelections.length) {

        resetAccumulatorMetrics();

        return;

    }

    const combinedProbability = calculateCombinedProbability();

    const probabilityPercentage = combinedProbability * 100;

    renderCombinedProbability(probabilityPercentage);

    renderImpliedFairOdds(combinedProbability);

    renderRiskClassification(probabilityPercentage);

}


function calculateCombinedProbability() {

    let result = 1;

    accumulatorSelections.forEach(function (pick) {

        const probability = normalizeProbability(pick.probability);

        result = result * probability;

    });

    return result;

}


// ==========================================================
// SECTION 14 — METRIC RENDERERS
// ==========================================================

function renderCombinedProbability(percentageValue) {

    if (!DOM.combinedProbability) return;

    DOM.combinedProbability.textContent =
        percentageValue.toFixed(2) + "%";

}


function renderImpliedFairOdds(combinedProbability) {

    if (!DOM.impliedOdds) return;

    if (combinedProbability <= 0) {

        DOM.impliedOdds.textContent = "-";

        return;

    }

    const impliedOddsValue = 1 / combinedProbability;

    DOM.impliedOdds.textContent =
        impliedOddsValue.toFixed(2);

}


function renderRiskClassification(percentageValue) {

    if (!DOM.riskLevel) return;

    let classification = "High";

    if (percentageValue >= 60) {

        classification = "Low";

    } else if (percentageValue >= 35) {

        classification = "Medium";

    }

    DOM.riskLevel.textContent = classification;

}


// ==========================================================
// SECTION 15 — METRIC RESET
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
// SECTION 16 — UTILITY HELPERS
// ==========================================================

function formatProbability(probabilityValue) {

    const normalized = normalizeProbability(probabilityValue);

    return (normalized * 100).toFixed(1) + "%";

}


function normalizeProbability(probabilityValue) {

    if (typeof probabilityValue !== "number") return 0;

    if (probabilityValue < 0) return 0;

    if (probabilityValue > 1) return 1;

    return probabilityValue;

}


function formatConfidenceClass(confidenceValue) {

    if (!confidenceValue) return "";

    return confidenceValue.toLowerCase();

}
