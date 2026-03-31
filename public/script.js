// ==========================================================
// ProPredict — Multi-Sport Probability Intelligence Dashboard
// FULL PRODUCTION BUILD — FIXED CORE ENGINE (PART 1)
// ==========================================================

// ==========================================================
// GLOBAL STATE
// ==========================================================

let currentSport = "football";
let currentCompetition = "PL";
let topPicksData = [];
let accumulatorSelections = [];

let performanceLogCache = [];

let smartTier = "balanced";
let smartBuilderLoading = false;
let smartBuilderSelections = [];

let ppAuthMode = "login";
let ppAuthListenersBound = false;

// ==========================================================
// BASIC HELPERS
// ==========================================================

function getEl(...ids) {
    for (const id of ids) {
        const el = document.getElementById(id);
        if (el) return el;
    }
    return null;
}

function showEl(el, display = "") {
    if (!el) return;
    el.style.display = display;
    el.classList.remove("hidden");
}

function hideEl(el) {
    if (!el) return;
    el.style.display = "none";
    el.classList.add("hidden");
}

function setHTML(el, html) {
    if (!el) return;
    el.innerHTML = html;
}

function setText(el, text) {
    if (!el) return;
    el.textContent = text;
}

function clearEl(el) {
    if (!el) return;
    el.innerHTML = "";
}

// ==========================================================
// AUTH STORAGE + STATE
// ==========================================================

const PP_AUTH_STORAGE_KEY = "pp_token";

const ppAuthState = {
    token: null,
    role: "free",
    payload: null,
    initialized: false
};

// ==========================================================
// DOM REFERENCES
// ==========================================================

const DOM = {
    sportSelect: getEl("sportSelect"),
    competitionSelect: getEl("competitionSelect"),
    eliteToggle: getEl("eliteToggle"),

    topPicksContainer: getEl("topPicksContainer"),
    marketOptionsContainer: getEl("marketOptionsContainer"),
    teamAnalysisContainer: getEl("teamAnalysisContainer"),

    accumulatorContainer: getEl("accumulatorSelections", "accumulatorContainer"),
    combinedProbability: getEl("combinedProbability"),
    decimalOdds: getEl("decimalOdds"),
    riskLevel: getEl("riskLevel"),

    teamSelect: getEl("teamSelect"),

    loginBtn: getEl("loginBtn"),
    registerBtn: getEl("registerBtn"),
    logoutBtn: getEl("logoutBtn"),

    authModal: getEl("authModal"),
    authForm: getEl("authForm"),
    authEmail: getEl("authEmail"),
    authPassword: getEl("authPassword"),
    authMessage: getEl("authMessage")
};

// ==========================================================
// AUTH HELPERS
// ==========================================================

function ppSafeDecodeJWT(token) {
    try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        return payload;
    } catch {
        return null;
    }
}

function ppIsLoggedIn() {
    return !!ppAuthState.token;
}

// ✅ FIXED (CRITICAL)
function ppCanAccessProtectedApp() {
    return ppIsLoggedIn();
}

// ==========================================================
// AUTH INIT
// ==========================================================

function ppInitAuth() {
    const token = localStorage.getItem(PP_AUTH_STORAGE_KEY);

    if (token) {
        const payload = ppSafeDecodeJWT(token);
        if (payload) {
            ppAuthState.token = token;
            ppAuthState.role = payload.role || "free";
        }
    }

    ppSetupAuthListeners();
}

// ==========================================================
// 🔥 FIXED SPORT SWITCH (MAIN BUG FIX)
// ==========================================================

function setupSportSelector() {
    if (!DOM.sportSelect) return;

    DOM.sportSelect.addEventListener("change", (e) => {
        const rawSport = String(e.target.value || "").toLowerCase();

        const sportMap = {
            football: "football",
            basketball: "basketball",
            nfl: "americanfootball",
            americanfootball: "americanfootball",
            mlb: "baseball",
            baseball: "baseball",
            tennis: "tennis",
            rugbyleague: "rugbyleague",
            rugbyunion: "rugbyunion"
        };

        currentSport = sportMap[rawSport] || rawSport;

        // ✅ rebuild competitions correctly
        updateCompetitionOptions();

        // ✅ ensure correct competition selected
        if (DOM.competitionSelect?.value) {
            currentCompetition = DOM.competitionSelect.value;
        }

        // ✅ reset football-only UI
        if (currentSport !== "football" && DOM.teamSelect) {
            DOM.teamSelect.innerHTML = `<option value="">Select Team</option>`;
        }

        // ✅ reload data cleanly
        if (ppCanAccessProtectedApp()) {
            loadTopPicks();

            if (currentSport === "football") {
                loadTeams(currentCompetition);
            }
        }
    });
}

// ==========================================================
// INIT
// ==========================================================

document.addEventListener("DOMContentLoaded", () => {
    ppInitAuth();
    setupSportSelector();
});
// ==========================================================
// PART 2 — COMPETITION MAP + PICK ENGINE + MARKET RENDER
// ==========================================================

// ==========================================================
// COMPETITION MAP
// ==========================================================

const competitionMap = {
    football: {
        PL: "Premier League",
        CL: "Champions League",
        EL: "Europa League",
        FL1: "Ligue 1",
        BL1: "Bundesliga",
        SA: "Serie A",
        PD: "La Liga",
        EC: "European Championship",
        WC: "World Cup"
    },

    basketball: {
        NBA: "NBA",
        EUROLEAGUE: "EuroLeague",
        NCAAB: "NCAA Basketball"
    },

    americanfootball: {
        NFL: "NFL",
        NCAAF: "NCAA Football"
    },

    baseball: {
        MLB: "MLB"
    },

    tennis: {
        ATP: "ATP Tour",
        WTA: "WTA Tour",
        GRANDSLAM: "Grand Slam"
    },

    rugbyleague: {
        NRL: "NRL",
        SL: "Super League"
    },

    rugbyunion: {
        INTL: "International Rugby",
        CLUB: "Club Rugby"
    }
};

// ==========================================================
// UI HELPERS
// ==========================================================

function getConfidenceBadgeClass(confidence) {
    if (!confidence) return "badge-low";

    const value = String(confidence).toLowerCase();

    if (value.includes("high")) return "badge-high";
    if (value.includes("medium")) return "badge-mid";
    return "badge-low";
}

function toggleMatchBody(bodyElement, indicator) {
    if (!bodyElement) return;

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

function safePercent(value) {
    const num = Number(value || 0);
    if (!Number.isFinite(num)) return "0.0";
    return (num * 100).toFixed(1);
}

function safeNumber(value, fallback = 0) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
}

// ==========================================================
// COMPETITION DROPDOWN
// ==========================================================

function updateCompetitionOptions() {
    if (!DOM.competitionSelect) return;

    const options = competitionMap[currentSport] || {};

    DOM.competitionSelect.innerHTML = "";

    Object.keys(options).forEach((key) => {
        const option = document.createElement("option");
        option.value = key;
        option.textContent = options[key];
        DOM.competitionSelect.appendChild(option);
    });

    const firstKey = Object.keys(options)[0];
    if (firstKey) {
        currentCompetition = firstKey;
        DOM.competitionSelect.value = firstKey;
    }
}

// ==========================================================
// TOP PICKS LOADER
// ==========================================================

async function loadTopPicks() {
    if (!ppCanAccessProtectedApp()) {
        if (DOM.topPicksContainer) {
            DOM.topPicksContainer.innerHTML =
                `<p class="placeholder">Login to view predictions.</p>`;
        }
        return;
    }

    if (!DOM.topPicksContainer) return;

    DOM.topPicksContainer.innerHTML =
        `<div class="loading-state">Loading predictions...</div>`;

    try {
        const eliteMode = DOM.eliteToggle?.checked ? "true" : "false";

        const res = await fetch(
            `/api/top-picks/${currentSport}/${currentCompetition}?elite=${eliteMode}`
        );

        const data = await res.json();

        topPicksData = Array.isArray(data) ? data : [];
        renderTopPicks(topPicksData);

    } catch (error) {
        console.error("Top picks load failed:", error);
        DOM.topPicksContainer.innerHTML =
            `<p class="placeholder">Failed to load predictions.</p>`;
    }
}

// ==========================================================
// RENDER TOP PICKS
// ==========================================================

function renderTopPicks(picks) {
    if (!DOM.topPicksContainer) return;

    DOM.topPicksContainer.innerHTML = "";

    if (!picks || picks.length === 0) {
        DOM.topPicksContainer.innerHTML =
            `<p class="placeholder">No predictions available.</p>`;
        return;
    }

    picks.forEach((pick, idx) => {
        const card = document.createElement("div");
        card.className = "match-card";

        const header = document.createElement("div");
        header.className = "match-header";

        const titleDiv = document.createElement("div");
        titleDiv.className = "match-title";

        const toggleIndicator = document.createElement("span");
        toggleIndicator.className = "toggle-indicator";
        toggleIndicator.textContent = "▼";

        titleDiv.innerHTML = `
            <strong>${pick.homeTeam || pick.player1 || "Home"}</strong>
            vs
            <strong>${pick.awayTeam || pick.player2 || "Away"}</strong>
        `;

        titleDiv.appendChild(toggleIndicator);
        header.appendChild(titleDiv);

        const infoDiv = document.createElement("div");
        infoDiv.className = "match-info";

        const dateInfo = pick.date
            ? new Date(pick.date).toLocaleDateString()
            : "TBD";

        const leagueInfo = pick.league || currentCompetition;

        infoDiv.innerHTML = `
            <span>${leagueInfo}</span>
            <span>${dateInfo}</span>
        `;

        header.appendChild(infoDiv);
        card.appendChild(header);

        const body = document.createElement("div");
        body.className = "match-body";

        const topPick = normalizePicks(pick)[0];

        if (topPick) {
            const badgeClass = getConfidenceBadgeClass(topPick.confidence);

            body.innerHTML = `
                <div class="top-pick">
                    <div class="pick-header">
                        <strong>${topPick.market}</strong>
                        <span class="confidence-badge ${badgeClass}">
                            ${topPick.confidence}
                        </span>
                    </div>
                    <div class="pick-value">${topPick.selection}</div>
                    <div class="pick-prob">
                        <div class="prob-bar">
                            <div class="prob-fill" style="width:${topPick.probability}%"></div>
                        </div>
                        <div class="prob-text">${topPick.probability}%</div>
                    </div>
                </div>
            `;

            const actionsRow = document.createElement("div");
            actionsRow.className = "pick-actions";

            const marketsBtn = document.createElement("button");
            marketsBtn.className = "btn-primary";
            marketsBtn.textContent = "View All Markets";
            marketsBtn.addEventListener("click", () => loadMarketOptions(idx));

            const addBtn = document.createElement("button");
            addBtn.className = "btn-secondary";
            addBtn.textContent = "Add to Accumulator";
            addBtn.addEventListener("click", () => {
                addToAccumulator({
                    sport: currentSport,
                    match: `${pick.homeTeam || pick.player1 || "Home"} vs ${pick.awayTeam || pick.player2 || "Away"}`,
                    market: topPick.market,
                    selection: topPick.selection,
                    probability: topPick.probability,
                    confidence: topPick.confidence
                });
            });

            actionsRow.appendChild(marketsBtn);
            actionsRow.appendChild(addBtn);
            body.appendChild(actionsRow);
        }

        card.appendChild(body);

        titleDiv.addEventListener("click", () => {
            toggleMatchBody(body, toggleIndicator);
        });

        DOM.topPicksContainer.appendChild(card);
    });
}

// ==========================================================
// NORMALIZE PICKS
// ==========================================================

function normalizePicks(pick) {
    const output = [];

    function getAutoConfidence(probStr) {
        const p = parseFloat(probStr);

        if (p >= 75) return "High";
        if (p >= 55) return "Medium";
        return "Low";
    }

    if (currentSport === "football") {
        if (pick.topPick) {
            const prob = safePercent(pick.winProbability);
            output.push({
                market: "Match Result",
                selection: pick.topPick,
                probability: prob,
                confidence: pick.confidence || getAutoConfidence(prob)
            });
        }

        if (pick.btts !== undefined) {
            const prob = safePercent(
                pick.btts ? pick.bttsProbability : 1 - pick.bttsProbability
            );
            output.push({
                market: "Both Teams To Score",
                selection: pick.btts ? "Yes" : "No",
                probability: prob,
                confidence: getAutoConfidence(prob)
            });
        }

        if (pick.over25 !== undefined) {
            const prob = safePercent(
                pick.over25 ? pick.goalsProbability : 1 - pick.goalsProbability
            );
            output.push({
                market: "Over 2.5 Goals",
                selection: pick.over25 ? "Yes" : "No",
                probability: prob,
                confidence: getAutoConfidence(prob)
            });
        }
    } else if (currentSport === "basketball") {
        if (pick.topPick) {
            const prob = safePercent(pick.winProbability);
            output.push({
                market: "Match Winner",
                selection: pick.topPick,
                probability: prob,
                confidence: pick.confidence || getAutoConfidence(prob)
            });
        }

        if (pick.spreadPick) {
            const prob = safePercent(pick.spreadProbability);
            output.push({
                market: "Spread",
                selection: pick.spreadPick,
                probability: prob,
                confidence: getAutoConfidence(prob)
            });
        }

        if (pick.totalPick) {
            const prob = safePercent(pick.totalProbability);
            output.push({
                market: "Total Points",
                selection: pick.totalPick,
                probability: prob,
                confidence: getAutoConfidence(prob)
            });
        }
    } else if (currentSport === "americanfootball") {
        if (pick.topPick) {
            const prob = safePercent(pick.winProbability);
            output.push({
                market: "Match Winner",
                selection: pick.topPick,
                probability: prob,
                confidence: pick.confidence || getAutoConfidence(prob)
            });
        }

        if (pick.spreadPick) {
            const prob = safePercent(pick.spreadProbability);
            output.push({
                market: "Spread",
                selection: pick.spreadPick,
                probability: prob,
                confidence: getAutoConfidence(prob)
            });
        }

        if (pick.totalPick) {
            const prob = safePercent(pick.totalProbability);
            output.push({
                market: "Total Points",
                selection: pick.totalPick,
                probability: prob,
                confidence: getAutoConfidence(prob)
            });
        }
    } else if (currentSport === "baseball") {
        if (pick.topPick) {
            const prob = safePercent(pick.winProbability);
            output.push({
                market: "Match Winner",
                selection: pick.topPick,
                probability: prob,
                confidence: pick.confidence || getAutoConfidence(prob)
            });
        }

        if (pick.runLinePick) {
            const prob = safePercent(pick.runLineProbability);
            output.push({
                market: "Run Line",
                selection: pick.runLinePick,
                probability: prob,
                confidence: getAutoConfidence(prob)
            });
        }

        if (pick.totalPick) {
            const prob = safePercent(pick.totalProbability);
            output.push({
                market: "Total Runs",
                selection: pick.totalPick,
                probability: prob,
                confidence: getAutoConfidence(prob)
            });
        }
    } else if (currentSport === "tennis") {
        if (pick.topPick) {
            const prob = safePercent(pick.winProbability);
            output.push({
                market: "Match Winner",
                selection: pick.topPick,
                probability: prob,
                confidence: pick.confidence || getAutoConfidence(prob)
            });
        }

        if (pick.setPick) {
            const prob = safePercent(pick.setProbability);
            output.push({
                market: "Set Betting",
                selection: pick.setPick,
                probability: prob,
                confidence: getAutoConfidence(prob)
            });
        }

        if (pick.totalGamesPick) {
            const prob = safePercent(pick.totalGamesProbability);
            output.push({
                market: "Total Games",
                selection: pick.totalGamesPick,
                probability: prob,
                confidence: getAutoConfidence(prob)
            });
        }
    } else if (currentSport === "rugbyleague") {
        if (pick.topPick) {
            const prob = safePercent(pick.winProbability);
            output.push({
                market: "Match Winner",
                selection: pick.topPick,
                probability: prob,
                confidence: pick.confidence || getAutoConfidence(prob)
            });
        }

        if (pick.marginPick) {
            const prob = safePercent(pick.marginProbability);
            output.push({
                market: "Winning Margin",
                selection: pick.marginPick,
                probability: prob,
                confidence: getAutoConfidence(prob)
            });
        }

        if (pick.totalPick) {
            const prob = safePercent(pick.totalProbability);
            output.push({
                market: "Total Points",
                selection: pick.totalPick,
                probability: prob,
                confidence: getAutoConfidence(prob)
            });
        }
    } else if (currentSport === "rugbyunion") {
        if (pick.topPick) {
            const prob = safePercent(pick.winProbability);
            output.push({
                market: "Match Winner",
                selection: pick.topPick,
                probability: prob,
                confidence: pick.confidence || getAutoConfidence(prob)
            });
        }

        if (pick.marginPick) {
            const prob = safePercent(pick.marginProbability);
            output.push({
                market: "Winning Margin",
                selection: pick.marginPick,
                probability: prob,
                confidence: getAutoConfidence(prob)
            });
        }

        if (pick.totalPick) {
            const prob = safePercent(pick.totalProbability);
            output.push({
                market: "Total Points",
                selection: pick.totalPick,
                probability: prob,
                confidence: getAutoConfidence(prob)
            });
        }
    }

    return output.length > 0 ? output : [
        {
            market: "No Data",
            selection: "N/A",
            probability: "0.0",
            confidence: "Low"
        }
    ];
}

// ==========================================================
// LOAD MARKET OPTIONS
// ==========================================================

async function loadMarketOptions(pickIndex) {
    if (!ppCanAccessProtectedApp()) {
        ppOpenAuthModal("login");
        return;
    }

    if (!DOM.marketOptionsContainer) return;

    DOM.marketOptionsContainer.innerHTML =
        `<div class="loading-state">Loading market options...</div>`;

    const pick = topPicksData[pickIndex];

    if (!pick) {
        DOM.marketOptionsContainer.innerHTML =
            `<p class="placeholder">No data available.</p>`;
        return;
    }

    const allPicks = normalizePicks(pick);

    DOM.marketOptionsContainer.innerHTML = "";

    allPicks.forEach((marketPick) => {
        const card = document.createElement("div");
        card.className = "market-card";

        const badgeClass = getConfidenceBadgeClass(marketPick.confidence);

        card.innerHTML = `
            <div class="market-header">
                <strong>${marketPick.market}</strong>
                <span class="confidence-badge ${badgeClass}">
                    ${marketPick.confidence}
                </span>
            </div>
            <div class="market-selection">${marketPick.selection}</div>
            <div class="market-prob">Probability: ${marketPick.probability}%</div>
        `;

        const addBtn = document.createElement("button");
        addBtn.textContent = "Add to Accumulator";
        addBtn.className = "btn-add-market";

        addBtn.addEventListener("click", () => {
            addToAccumulator({
                sport: currentSport,
                match: `${pick.homeTeam || pick.player1 || "Home"} vs ${pick.awayTeam || pick.player2 || "Away"}`,
                market: marketPick.market,
                selection: marketPick.selection,
                probability: marketPick.probability,
                confidence: marketPick.confidence
            });
        });

        card.appendChild(addBtn);
        DOM.marketOptionsContainer.appendChild(card);
    });
}
// ==========================================================
// PART 3 — ACCUMULATOR + SMART BUILDER + PERFORMANCE + FINAL INIT
// ==========================================================

// ==========================================================
// ACCUMULATOR BUILDER
// ==========================================================

function addToAccumulator(pick) {

    if (!ppCanAccessProtectedApp()) {
        ppOpenAuthModal("login");
        return;
    }

    const exists = accumulatorSelections.some(
        sel => sel.match === pick.match && sel.market === pick.market
    );

    if (exists) {
        alert("This selection is already in your accumulator.");
        return;
    }

    accumulatorSelections.push(pick);

    renderAccumulator();
    updateMetrics();
}

function removeFromAccumulator(index) {

    if (!ppCanAccessProtectedApp()) return;

    accumulatorSelections.splice(index, 1);

    renderAccumulator();
    updateMetrics();
}

function renderAccumulator() {

    if (!DOM.accumulatorContainer) return;

    DOM.accumulatorContainer.innerHTML = "";

    if (accumulatorSelections.length === 0) {
        DOM.accumulatorContainer.innerHTML =
            `<p class="builder-empty">No selections added.</p>`;
        return;
    }

    accumulatorSelections.forEach((pick, idx) => {

        const item = document.createElement("div");
        item.className = "builder-item";

        const badgeClass = getConfidenceBadgeClass(pick.confidence);

        item.innerHTML = `
            <div>
                <div><strong>${pick.match}</strong></div>
                <div>${pick.market}: ${pick.selection}</div>
                <div>Probability: ${pick.probability}%</div>
                <span class="confidence-badge ${badgeClass}">
                    ${pick.confidence}
                </span>
            </div>
        `;

        const removeBtn = document.createElement("button");
        removeBtn.textContent = "Remove";
        removeBtn.addEventListener("click", () => removeFromAccumulator(idx));

        item.appendChild(removeBtn);

        DOM.accumulatorContainer.appendChild(item);
    });
}

function updateMetrics(combined = null) {

    if (!ppCanAccessProtectedApp()) return;

    let combinedProb = combined;

    if (combinedProb === null) {
        combinedProb = accumulatorSelections.reduce((acc, pick) => {
            const prob = parseFloat(pick.probability) / 100;
            return acc * prob;
        }, 1);
    }

    const decimalOdds = combinedProb > 0 ? (1 / combinedProb).toFixed(2) : "0.00";

    let riskLevel = "Low";
    if (combinedProb < 0.3) riskLevel = "High";
    else if (combinedProb < 0.6) riskLevel = "Medium";

    if (DOM.combinedProbability) {
        DOM.combinedProbability.textContent = (combinedProb * 100).toFixed(1) + "%";
    }

    if (DOM.decimalOdds) {
        DOM.decimalOdds.textContent = decimalOdds;
    }

    if (DOM.riskLevel) {
        DOM.riskLevel.textContent = riskLevel;
    }
}

function clearAccumulator() {

    if (!ppCanAccessProtectedApp()) return;

    accumulatorSelections = [];

    renderAccumulator();
    updateMetrics(0);
}

async function submitAccumulator() {

    if (!ppCanAccessProtectedApp()) {
        ppOpenAuthModal("login");
        return;
    }

    if (accumulatorSelections.length === 0) {
        alert("Add at least one selection before submitting.");
        return;
    }

    try {

        const res = await fetch("/api/performance/track", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ picks: accumulatorSelections })
        });

        const data = await res.json();

        if (res.ok) {
            alert("Accumulator tracked successfully!");
            clearAccumulator();
            loadPerformanceSummary();
            loadPerformanceLog();
        } else {
            alert(data.message || "Submission failed.");
        }

    } catch (error) {
        console.error("Accumulator submission failed:", error);
        alert("Submission failed.");
    }
}

// ==========================================================
// TEAM ANALYSIS
// ==========================================================

async function loadTeams(league) {

    if (!ppCanAccessProtectedApp()) return;
    if (!DOM.teamSelect) return;

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

    } catch (error) {
        console.error("Load teams failed:", error);
        DOM.teamSelect.innerHTML =
            `<option value="">Select Team</option>`;
    }
}

async function analyzeTeam(teamId) {

    if (!ppCanAccessProtectedApp()) {
        ppOpenAuthModal("login");
        return;
    }

    if (!DOM.teamAnalysisContainer) return;

    DOM.teamAnalysisContainer.innerHTML =
        `<div class="loading-state">Analyzing team...</div>`;

    try {

        const res = await fetch(`/api/team-analysis/${teamId}`);
        const data = await res.json();

        DOM.teamAnalysisContainer.innerHTML = "";

        const wrapper = document.createElement("div");
        wrapper.className = "analysis-card";

        Object.keys(data.fullTime || {}).forEach(key => {
            const row = document.createElement("div");
            row.className = "analysis-row";

            row.innerHTML = `
                <span>${key}</span>
                <strong>${data.fullTime[key]}%</strong>
            `;

            wrapper.appendChild(row);
        });

        DOM.teamAnalysisContainer.appendChild(wrapper);

    } catch (error) {
        console.error("Analyze team failed:", error);
        DOM.teamAnalysisContainer.innerHTML =
            `<p class="placeholder">Analysis failed.</p>`;
    }
}

// ==========================================================
// SMART BUILDER
// ==========================================================

function initSmartBuilder() {

    DOM.smartBuilderContainer = getEl("smartBuilderContainer");
    DOM.smartTierSelect = getEl("smartTierSelect");
    DOM.smartGenerateBtn = getEl("smartGenerateBtn");
    DOM.smartStatus = getEl("smartStatus");

    if (!DOM.smartBuilderContainer) return;

    if (DOM.smartTierSelect && !DOM.smartTierSelect.dataset.bound) {
        DOM.smartTierSelect.addEventListener("change", (e) => {
            smartTier = e.target.value;
        });
        DOM.smartTierSelect.dataset.bound = "true";
    }

    if (DOM.smartGenerateBtn && !DOM.smartGenerateBtn.dataset.bound) {
        DOM.smartGenerateBtn.addEventListener("click", generateSmartAccumulator);
        DOM.smartGenerateBtn.dataset.bound = "true";
    }
}

async function generateSmartAccumulator() {

    if (!ppCanAccessProtectedApp()) {
        ppOpenAuthModal("login");
        return;
    }

    if (smartBuilderLoading) return;

    smartBuilderLoading = true;
    updateSmartStatus("Generating smart accumulator...");

    try {

        const res = await fetch(`/api/smart-builder/${currentSport}/${smartTier}`);
        const data = await res.json();

        if (!data || !data.picks || data.picks.length === 0) {
            updateSmartStatus("No smart picks available.");
            smartBuilderLoading = false;
            return;
        }

        smartBuilderSelections = data.picks;
        accumulatorSelections = [];

        smartBuilderSelections.forEach(pick => {
            accumulatorSelections.push(pick);
        });

        renderAccumulator();
        updateMetrics();

        updateSmartStatus(
            `Generated ${smartBuilderSelections.length} picks (${data.tier} tier).`
        );

    } catch (error) {
        console.error("Smart builder failed:", error);
        updateSmartStatus("Smart builder failed.");
    } finally {
        smartBuilderLoading = false;
    }
}

function updateSmartStatus(message) {
    if (DOM.smartStatus) {
        DOM.smartStatus.textContent = message;
    }
}

// ==========================================================
// PERFORMANCE SUMMARY
// ==========================================================

async function loadPerformanceSummary() {

    if (!ppCanAccessProtectedApp()) return;

    try {

        const res = await fetch("/api/performance/summary");
        const data = await res.json();

        if (DOM.perfTotal) {
            DOM.perfTotal.textContent = data.total || 0;
        }

        if (DOM.perfSettled) {
            DOM.perfSettled.textContent = data.settled || 0;
        }

        if (DOM.perfWins) {
            DOM.perfWins.textContent = data.wins || 0;
        }

        if (DOM.perfLosses) {
            DOM.perfLosses.textContent = data.losses || 0;
        }

        if (DOM.perfWinRate) {
            DOM.perfWinRate.textContent =
                data.winRate ? data.winRate + "%" : "0%";
        }

        if (DOM.perfROI) {
            DOM.perfROI.textContent =
                data.roi ? data.roi + "%" : "0%";
        }

    } catch (error) {
        console.error("Performance summary failed:", error);
    }
}

// ==========================================================
// PERFORMANCE LOG
// ==========================================================

async function loadPerformanceLog() {

    if (!ppCanAccessProtectedApp()) return;
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

    if (!ppCanAccessProtectedApp()) return;
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

// ==========================================================
// OPTIONAL: UPDATE PICK RESULT (FRONTEND)
// ==========================================================

async function updatePickResultFrontend(id, result) {

    if (!ppCanAccessProtectedApp()) return;

    try {
        const res = await fetch(`/api/performance/result`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, result })
        });

        if (res.ok) {
            loadPerformanceSummary();
            loadPerformanceLog();
        }

    } catch (error) {
        console.error("Update pick result failed:", error);
    }
}

// ==========================================================
// FINAL AUTH HANDLERS
// ==========================================================

async function ppHandleAuthSubmit(e) {
    e.preventDefault();

    const email = DOM.authEmail?.value?.trim();
    const password = DOM.authPassword?.value?.trim();

    if (!email || !password) {
        ppShowAuthMessage("Email and password required.", true);
        return;
    }

    const endpoint = ppAuthMode === "register"
        ? "/api/auth/register"
        : "/api/auth/login";

    try {
        const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();

        if (!res.ok) {
            ppShowAuthMessage(data.message || "Auth failed.", true);
            return;
        }

        if (!data.token) {
            ppShowAuthMessage("No token received.", true);
            return;
        }

        const payload = ppSafeDecodeJWT(data.token);

        if (!payload || ppIsTokenExpired(payload)) {
            ppShowAuthMessage("Invalid token received.", true);
            return;
        }

        localStorage.setItem(PP_AUTH_STORAGE_KEY, data.token);

        ppAuthState.token = data.token;
        ppAuthState.role = payload.role || "free";
        ppAuthState.payload = payload;
        ppAuthState.initialized = true;

        ppCloseAuthModal();
        ppUpdateAuthUI();

    } catch (error) {
        console.error("Auth submit failed:", error);
        ppShowAuthMessage("Auth failed.", true);
    }
}

function ppHandleLogout() {
    localStorage.removeItem(PP_AUTH_STORAGE_KEY);

    ppAuthState.token = null;
    ppAuthState.role = "free";
    ppAuthState.payload = null;
    ppAuthState.initialized = true;

    accumulatorSelections = [];
    performanceLogCache = [];
    smartBuilderSelections = [];

    ppUpdateAuthUI();
}

// ==========================================================
// UPGRADE TO PRO
// ==========================================================

async function ppUpgradeToPro() {
    if (!ppIsLoggedIn()) {
        ppOpenAuthModal("login");
        return;
    }

    ppOpenSubscriptionModal();

    if (DOM.subscriptionMessage) {
        DOM.subscriptionMessage.textContent =
            "Upgrade feature coming soon. Contact support for Pro access.";
    }
}

// ==========================================================
// FINAL INIT
// ==========================================================

document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
        ppInitAuth();
        updateCompetitionOptions();
        initSmartBuilder();

        if (ppCanAccessProtectedApp()) {
            loadTopPicks();

            if (currentSport === "football") {
                loadTeams(currentCompetition);
            }

            loadPerformanceSummary();
            loadPerformanceLog();
        }
    }, 50);
});
