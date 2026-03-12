// ==========================================================
// ProPredict — Multi-Sport Probability Intelligence Dashboard
// FULL PRODUCTION BUILD — SMART BUILDER INTEGRATED
// UPDATED WITH RUGBY LEAGUE + RUGBY UNION SUPPORT
// PART 1/4
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
// ✅ UPDATED COMPETITION OPTIONS
// NOW SUPPORTS NFL, NHL, RUGBY LEAGUE, RUGBY UNION
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

    if (currentSport === "nfl") {
        addOption("NFL", "NFL");
    }

    if (currentSport === "nhl") {
        addOption("NHL", "NHL");
    }

    if (currentSport === "rugbyleague") {
        addOption("NRL", "NRL");
    }

    // ✅ NEW RUGBY UNION SUPPORT
    if (currentSport === "rugbyunion") {
        addOption("TOP14", "Top 14");
        addOption("SIXNATIONS", "Six Nations");
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
// PART 2/4
// ==========================================================

async function loadTopPicks() {

    DOM.topPicksContainer.innerHTML = "Loading projections...";

    try {

        const route = DOM.eliteToggle.checked
            ? `/api/elite/${currentSport}/${currentCompetition}`
            : `/api/top-picks/${currentSport}/${currentCompetition}`;

        const res = await fetch(route);

        if (!res.ok) {
            throw new Error("Network response was not ok");
        }

        const data = await res.json();

        const rawPicks = DOM.eliteToggle.checked
            ? data.elitePicks
            : data.topPicks;

        topPicksData = normalizePicks(rawPicks);

        renderTopPicks();

    } catch (err) {
        console.error("Load Top Picks Error:", err);
        DOM.topPicksContainer.innerHTML = "Failed to load fixtures.";
    }
}

// ==========================================================
// NORMALIZE PICKS
// ==========================================================

function normalizePicks(raw) {

    if (!raw) return [];

    // ✅ Array format
    if (Array.isArray(raw)) {

        return raw.map(pick => {

            const match = pick.match || "";
            const parts = match.split(" vs ");

            return {
                matchId: match,
                homeTeam: parts[0] || "",
                awayTeam: parts[1] || "",
                market: pick.market || "Over 2.5 Goals",
                probability: parseFloat(
                    pick.adjustedProbability ||
                    pick.impliedProbability ||
                    pick.probability ||
                    pick.over25
                ) / 100 || 0,
                confidence: pick.confidence || "Low"
            };
        });
    }

    // ✅ Object grouped by market (Football, Basketball, NFL, NHL, Rugby League, Rugby Union)
    if (typeof raw === "object") {

        const combined = [];

        Object.keys(raw).forEach(marketKey => {

            if (!Array.isArray(raw[marketKey])) return;

            raw[marketKey].forEach(pick => {

                combined.push({
                    matchId: pick.matchId || pick.match,
                    homeTeam: pick.homeTeam || "",
                    awayTeam: pick.awayTeam || "",
                    market: pick.market || marketKey,
                    probability: parseFloat(
                        pick.adjustedProbability ||
                        pick.impliedProbability ||
                        pick.probability
                    ) / 100 || 0,
                    confidence: pick.confidence || "Low"
                });

            });

        });

        return combined;
    }

    return [];
}

// ==========================================================
// SMART BUILDER CORE ENGINE
// ==========================================================

function generateSmartAccumulator() {

    smartBuilderLoading = true;
    updateSmartStatus("Generating smart accumulator...");

    const flatPicks = Array.isArray(topPicksData)
        ? [...topPicksData]
        : flattenMarketObject(topPicksData);

    if (!flatPicks.length) {
        updateSmartStatus("No picks available for smart generation.");
        smartBuilderLoading = false;
        return;
    }

    flatPicks.sort((a, b) => b.probability - a.probability);

    const tierConfig = getTierConfig(smartTier);

    const selected = [];
    const usedMatches = new Set();

    for (let pick of flatPicks) {

        if (selected.length >= tierConfig.targetSize) break;
        if (usedMatches.has(pick.matchId)) continue;

        if (
            pick.probability >= tierConfig.min &&
            pick.probability <= tierConfig.max
        ) {
            selected.push(pick);
            usedMatches.add(pick.matchId);
        }
    }

    if (selected.length < tierConfig.targetSize) {

        for (let pick of flatPicks) {

            if (selected.length >= tierConfig.targetSize) break;
            if (usedMatches.has(pick.matchId)) continue;

            selected.push(pick);
            usedMatches.add(pick.matchId);
        }
    }

    smartBuilderSelections = selected;
    accumulatorSelections = [...selected];

    renderAccumulator();
    renderTopPicks();

    const combinedProbability = selected.reduce(
        (acc, pick) => acc * pick.probability,
        1
    );

    const percentage = (combinedProbability * 100).toFixed(2);

    updateSmartStatus(
        `Smart Acca Generated (${smartTier.toUpperCase()}) — Combined: ${percentage}%`
    );

    smartBuilderLoading = false;
}

// ==========================================================
// TIER CONFIGURATION
// ==========================================================

function getTierConfig(tier) {

    if (tier === "low") {
        return { min: 0.60, max: 0.85, targetSize: 3 };
    }

    if (tier === "balanced") {
        return { min: 0.50, max: 0.75, targetSize: 4 };
    }

    if (tier === "aggressive") {
        return { min: 0.35, max: 0.65, targetSize: 5 };
    }

    return { min: 0.50, max: 0.75, targetSize: 4 };
}

// ==========================================================
// FLATTEN HELPER
// ==========================================================

function flattenMarketObject(obj) {

    const combined = [];

    if (!obj || typeof obj !== "object") return combined;

    Object.keys(obj).forEach(key => {

        if (!Array.isArray(obj[key])) return;

        obj[key].forEach(pick => {
            combined.push(pick);
        });

    });

    return combined;
}
// ==========================================================
// RENDER TOP PICKS
// PART 3/4
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
            DOM.topPicksContainer.innerHTML = "No projections available.";
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
        wrapper.className = "match-accordion";

        const header = document.createElement("div");
        header.className = "match-header";
        header.innerHTML = `
            <strong>${match.homeTeam} vs ${match.awayTeam}</strong>
            <span class="toggle-indicator">▼</span>
        `;

        const body = document.createElement("div");
        body.className = "match-body";
        body.style.display = "none";

        header.addEventListener("click", () => {
            const isOpen = body.style.display === "block";
            body.style.display = isOpen ? "none" : "block";
        });

        match.markets.forEach(pick => {

            const added = accumulatorSelections.some(sel =>
                sel.matchId === pick.matchId &&
                sel.market === pick.market
            );

            const card = document.createElement("div");
            card.className = "pick-card";

            card.innerHTML = `
                <div>${pick.market}</div>
                <div>${(pick.probability * 100).toFixed(1)}%</div>
                <div>${pick.confidence}</div>
                <button ${added ? "disabled" : ""}>
                    ${added ? "Added" : "Add"}
                </button>
            `;

            card.querySelector("button").addEventListener("click", async () => {

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

            body.appendChild(card);
        });

        wrapper.appendChild(header);
        wrapper.appendChild(body);

        DOM.topPicksContainer.appendChild(wrapper);
    });
}
// ==========================================================
// ACCUMULATOR
// PART 4/4
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

// ==========================================================
// METRICS
// ==========================================================

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
// PERFORMANCE SUMMARY
// ==========================================================

async function loadPerformanceSummary() {

    try {
        const res = await fetch("/api/performance/summary");
        const data = await res.json();

        DOM.perfTotal.textContent = data.totalPicks || 0;
        DOM.perfSettled.textContent = data.settledPicks || 0;
        DOM.perfWins.textContent = data.wins || 0;
        DOM.perfLosses.textContent = data.losses || 0;
        DOM.perfWinRate.textContent =
            data.winRate ? data.winRate + "%" : "0%";
        DOM.perfROI.textContent =
            data.roi ? data.roi + "%" : "0%";

    } catch (error) {
        console.error("Performance summary failed:", error);
    }
}

// ==========================================================
// PERFORMANCE LOG
// ==========================================================

async function loadPerformanceLog() {

    if (!DOM.performanceLogContainer) return;

    try {
        const res = await fetch("/api/performance/log");
        const data = await res.json();

        performanceLogCache = data || [];
        renderPerformanceLog();

    } catch (error) {
        console.error("Performance log load failed:", error);
    }
}

function renderPerformanceLog() {

    if (!DOM.performanceLogContainer) return;

    DOM.performanceLogContainer.innerHTML = "";

    if (!performanceLogCache.length) {
        DOM.performanceLogContainer.innerHTML =
            `<p class="builder-empty">No recorded picks yet.</p>`;
        return;
    }

    performanceLogCache.forEach(pick => {

        const row = document.createElement("div");
        row.className = "builder-item";

        row.innerHTML = `
            <div>
                <div><strong>${pick.sport.toUpperCase()}</strong></div>
                <div>${pick.market}</div>
                <div>${parseFloat(pick.probability).toFixed(1)}%</div>
                <div>Status: ${pick.status}</div>
            </div>
        `;

        if (pick.status === "pending") {

            const winBtn = document.createElement("button");
            winBtn.textContent = "✅ Win";

            const lossBtn = document.createElement("button");
            lossBtn.textContent = "❌ Loss";

            winBtn.addEventListener("click", () =>
                updatePickResultFrontend(pick.id, "win")
            );

            lossBtn.addEventListener("click", () =>
                updatePickResultFrontend(pick.id, "loss")
            );

            row.appendChild(winBtn);
            row.appendChild(lossBtn);
        }

        DOM.performanceLogContainer.appendChild(row);
    });
}

async function updatePickResultFrontend(id, result) {

    try {

        await fetch("/api/performance/result", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, result })
        });

        await loadPerformanceSummary();
        await loadPerformanceLog();

    } catch (error) {
        console.error("Result update failed:", error);
    }
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

// ==========================================================
// END OF FILE
// ==========================================================
