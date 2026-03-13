// ==========================================================
// ProPredict — Multi-Sport Probability Intelligence Dashboard
// FULL PRODUCTION BUILD — SMART BUILDER INTEGRATED
// ==========================================================

// ==========================================================
// GLOBAL STATE
// ==========================================================

let currentSport = "football";
let currentCompetition = "PL";
let topPicksData = [];
let accumulatorSelections = [];

// ✅ Performance log cache
let performanceLogCache = [];

// ✅ Smart Builder State
let smartTier = "balanced";
let smartBuilderLoading = false;
let smartBuilderSelections = [];

// ==========================================================
// ✅ UI HELPERS
// ==========================================================

function getConfidenceBadgeClass(confidence) {
    if (!confidence) return "badge-low";

    const value = confidence.toLowerCase();

    if (value.includes("elite")) return "badge-high";
    if (value.includes("strong")) return "badge-high";
    if (value.includes("medium")) return "badge-mid";
    return "badge-low";
}

function toggleMatchBody(bodyElement, indicator) {
    const isOpen = bodyElement.classList.contains("open");

    if (isOpen) {
        bodyElement.classList.remove("open");
        bodyElement.style.maxHeight = null;
        if (indicator) indicator.textContent = "▼";
    } else {
        bodyElement.classList.add("open");
        bodyElement.style.maxHeight = bodyElement.scrollHeight + "px";
        if (indicator) indicator.textContent = "▲";
    }
}
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
    perfROI: document.getElementById("perfROI"),

    performanceLogContainer: document.getElementById("performanceLogContainer"),

    smartBuilderContainer: null,
    smartTierSelect: null,
    smartGenerateBtn: null,
    smartStatus: null
};

// ==========================================================
// INIT
// ==========================================================

document.addEventListener("DOMContentLoaded", () => {
    bindEvents();
    injectSmartBuilderUI();
    updateCompetitionOptions();
    loadTopPicks();
    loadPerformanceSummary();
    loadPerformanceLog();
});

// ==========================================================
// EVENT BINDING
// ==========================================================

function bindEvents() {

    DOM.sportSelect.addEventListener("change", (e) => {
        currentSport = e.target.value;
        updateCompetitionOptions();
        resetBuilders();
        loadTopPicks();
    });

    DOM.competitionSelect.addEventListener("change", (e) => {
        currentCompetition = e.target.value;
        resetBuilders();
        loadTopPicks();
    });

    DOM.eliteToggle.addEventListener("change", () => {
        loadTopPicks();
    });

    DOM.clearAccumulatorBtn.addEventListener("click", () => {
        accumulatorSelections = [];
        smartBuilderSelections = [];
        renderAccumulator();
        renderTopPicks();
        updateSmartStatus("");
    });

    DOM.analyzeBtn.addEventListener("click", () => {
        if (currentSport !== "football") return;
        const teamId = DOM.teamSelect.value;
        if (teamId) analyzeTeam(teamId);
    });
}

function resetBuilders() {
    accumulatorSelections = [];
    smartBuilderSelections = [];
    renderAccumulator();
    updateSmartStatus("");
}
// ==========================================================
// SMART BUILDER UI INJECTION
// ==========================================================

function injectSmartBuilderUI() {

    const container = document.createElement("div");
    container.className = "smart-builder-container";

    container.innerHTML = `
        <h3>Smart Accumulator Builder</h3>
        <div class="smart-controls">
            <select id="smartTierSelect">
                <option value="low">Low Risk</option>
                <option value="balanced" selected>Balanced</option>
                <option value="aggressive">Aggressive</option>
            </select>
            <button id="smartGenerateBtn">Generate Smart Acca</button>
        </div>
        <div id="smartStatus" class="smart-status"></div>
    `;

    DOM.accumulatorContainer.parentNode.insertBefore(
        container,
        DOM.accumulatorContainer
    );

    DOM.smartBuilderContainer = container;
    DOM.smartTierSelect = document.getElementById("smartTierSelect");
    DOM.smartGenerateBtn = document.getElementById("smartGenerateBtn");
    DOM.smartStatus = document.getElementById("smartStatus");

    DOM.smartTierSelect.addEventListener("change", (e) => {
        smartTier = e.target.value;
    });

    DOM.smartGenerateBtn.addEventListener("click", () => {
        if (!topPicksData || smartBuilderLoading) return;
        generateSmartAccumulator();
    });
}

function updateSmartStatus(message) {
    if (DOM.smartStatus) {
        DOM.smartStatus.textContent = message;
    }
}

// ==========================================================
// COMPETITION OPTIONS
// ==========================================================

function updateCompetitionOptions() {

    DOM.competitionSelect.innerHTML = "";

    if (currentSport === "football") {

        addOption("PL", "Premier League");
        addOption("PD", "La Liga");
        addOption("SA", "Serie A");
        addOption("BL1", "Bundesliga");
        addOption("FL1", "Ligue 1");

        addOption("EFL", "EFL Championship");
        addOption("BL2", "Bundesliga 2");
        addOption("SB", "Serie B");
        addOption("FL2", "Ligue 2");
        addOption("SD", "Segunda Division");
        addOption("SPL", "Saudi Pro League");
        addOption("J1", "Japan J-League");
        addOption("ALLS", "Sweden Allsvenskan");
        addOption("UCL", "UEFA Champions League");
        addOption("UEL", "UEFA Europa League");
    }

    if (currentSport === "basketball") {
        addOption("NBA", "NBA");
        addOption("WNBA", "WNBA");
        addOption("NCAAB", "NCAAB");
    }

    if (currentSport === "nfl") addOption("NFL", "NFL");
    if (currentSport === "nhl") addOption("NHL", "NHL");
    if (currentSport === "rugbyleague") addOption("NRL", "NRL");
    if (currentSport === "rugbyunion") {
        addOption("TOP14", "Top 14");
        addOption("SIXNATIONS", "Six Nations");
    }
    if (currentSport === "mlb") addOption("MLB", "MLB");
    if (currentSport === "tennis") {
        addOption("ATP", "ATP");
        addOption("WTA", "WTA");
    }
    if (currentSport === "darts") addOption("PDC", "PDC");
    if (currentSport === "tabletennis") addOption("ALL", "All Events");

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
// RENDER TOP PICKS — V2 HERO LAYOUT
// ==========================================================

function renderTopPicks() {

    DOM.topPicksContainer.innerHTML = "";

    if (!topPicksData || !topPicksData.length) {

        if (currentSport === "darts" || currentSport === "tabletennis") {
            DOM.topPicksContainer.innerHTML =
                `<p class="placeholder">
                    ℹ️ No bookmaker markets currently available for this sport.
                </p>`;
        } else {
            DOM.topPicksContainer.innerHTML =
                `<div class="empty-state-card">
                    No projections available.
                </div>`;
        }

        return;
    }

    const matches = {};

    topPicksData.forEach(pick => {
        if (!matches[pick.matchId]) {
            matches[pick.matchId] = {
                homeTeam: pick.homeTeam,
                awayTeam: pick.awayTeam,
                markets: []
            };
        }
        matches[pick.matchId].markets.push(pick);
    });

    Object.keys(matches).forEach(matchId => {

        const match = matches[matchId];

        const wrapper = document.createElement("div");
        wrapper.className = "sportsbook-card";

        const header = document.createElement("div");
        header.className = "match-header";

        header.innerHTML = `
            <div class="match-title">
                <div class="teams">
                    <span>${match.homeTeam}</span>
                    <span class="vs-divider">vs</span>
                    <span>${match.awayTeam}</span>
                </div>
                <div class="match-meta">
                    ${currentSport.toUpperCase()} • ${currentCompetition}
                </div>
            </div>
        `;

        const body = document.createElement("div");
        body.className = "match-body";

        // HERO PROBABILITY DISPLAY
        const heroProb = document.createElement("div");
        heroProb.className = "hero-probabilities";

        const topMarket = match.markets
            .sort((a, b) => b.probability - a.probability)[0];

        heroProb.innerHTML = `
            <span class="home-prob">
                ${topMarket.homeTeam ? topMarket.probability * 100 >= 50 ? (topMarket.probability * 100).toFixed(1) + "%" : "" : ""}
            </span>
            <span class="away-prob">
                ${(topMarket.probability * 100).toFixed(1)}%
            </span>
        `;

        body.appendChild(heroProb);

        // MARKET BLOCKS
        match.markets.forEach(pick => {

            const added = accumulatorSelections.some(sel =>
                sel.matchId === pick.matchId &&
                sel.market === pick.market
            );

            const row = document.createElement("div");
            row.className = "sportsbook-row";

            row.innerHTML = `
                <div class="market-name">
                    ${pick.market}
                </div>

                <div class="probability-value">
                    ${(pick.probability * 100).toFixed(1)}%
                </div>

                <div class="confidence-badge ${getConfidenceBadgeClass(pick.confidence)}">
                    ${pick.confidence}
                </div>

                <button class="odds-button" ${added ? "disabled" : ""}>
                    ${added ? "Added" : "Add"}
                </button>
            `;

            row.querySelector("button").addEventListener("click", async () => {

                accumulatorSelections.push({
                    matchId: pick.matchId,
                    homeTeam: pick.homeTeam,
                    awayTeam: pick.awayTeam,
                    market: pick.market,
                    probability: pick.probability,
                    confidence: pick.confidence
                });

                try {
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
                } catch (error) {
                    console.error("Performance record error:", error);
                }

                renderAccumulator();
                renderTopPicks();
                loadPerformanceSummary();
                loadPerformanceLog();
            });

            body.appendChild(row);
        });

        wrapper.appendChild(header);
        wrapper.appendChild(body);

        DOM.topPicksContainer.appendChild(wrapper);
    });
}
