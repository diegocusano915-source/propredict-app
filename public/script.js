// ==========================================================
// ProPredict — Multi-Sport Probability Intelligence Dashboard
// FULL PRODUCTION BUILD — SMART BUILDER INTEGRATED
// UPDATED WITH RUGBY LEAGUE + RUGBY UNION + MLB + TENNIS SUPPORT
// AUTH GATE + PROFESSIONAL LOGIN FLOW + PROTECTED APP SHELL
// FULL UPDATED FILE — PART 1/3
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

// ✅ Auth UI Mode
let ppAuthMode = "login";

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

function isElementAvailable(el) {
    return !!el;
}

// ==========================================================
// ✅ UI HELPERS
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
    // Core header controls
    sportSelect: getEl("sportSelect"),
    competitionSelect: getEl("competitionSelect"),
    eliteToggle: getEl("eliteToggle"),
    themeToggleBtn: getEl("themeToggleBtn"),

    // Main content
    topPicksContainer: getEl("topPicksContainer"),
    marketOptionsContainer: getEl("marketOptionsContainer"),
    teamAnalysisContainer: getEl("teamAnalysisContainer"),

    // Accumulator — support both old and new HTML ids
    accumulatorContainer: getEl("accumulatorSelections", "accumulatorContainer"),
    combinedProbability: getEl("combinedProbability"),
    decimalOdds: getEl("decimalOdds"),
    riskLevel: getEl("riskLevel"),
    clearAccumulatorBtn: getEl("clearAccumulatorBtn"),

    // Team analysis controls
    teamSelect: getEl("teamSelect"),
    analyzeBtn: getEl("analyzeBtn"),

    // Performance
    perfTotal: getEl("perfTotal"),
    perfSettled: getEl("perfSettled"),
    perfWins: getEl("perfWins"),
    perfLosses: getEl("perfLosses"),
    perfWinRate: getEl("perfWinRate"),
    perfROI: getEl("perfROI"),
    performanceLogContainer: getEl("performanceLogContainer"),

    // Smart builder refs
    smartBuilderContainer: null,
    smartTierSelect: null,
    smartGenerateBtn: null,
    smartStatus: null,

    // Protected shell / guest shell
    appRoot: getEl("appRoot"),
    guestLanding: getEl("guestLanding"),
    lockedNotice: getEl("lockedNotice"),
    protectedApp: getEl("protectedApp"),
    matchesSection: getEl("matchesSection"),
    marketOptionsSection: getEl("marketOptionsSection"),
    teamAnalysisSection: getEl("teamAnalysisSection"),
    accumulatorSection: getEl("accumulatorSection"),
    dashboardAccessBadge: getEl("dashboardAccessBadge"),

    // Auth controls in header / hero
    loginBtn: getEl("loginBtn"),
    registerBtn: getEl("registerBtn"),
    heroLoginBtn: getEl("heroLoginBtn"),
    heroRegisterBtn: getEl("heroRegisterBtn"),
    upgradeBtn: getEl("upgradeBtn"),
    logoutBtn: getEl("logoutBtn"),
    userStatus: getEl("userStatus"),
    userRoleBadge: getEl("userRoleBadge"),

    // Auth modal
    authModal: getEl("authModal"),
    closeAuthModal: getEl("closeAuthModal"),
    authModalTitle: getEl("authModalTitle"),
    authForm: getEl("authForm"),
    authEmail: getEl("authEmail"),
    authPassword: getEl("authPassword"),
    authMessage: getEl("authMessage"),
    switchAuthMode: getEl("switchAuthMode"),

    // Subscription modal
    subscriptionModal: getEl("subscriptionModal"),
    closeSubscriptionModal: getEl("closeSubscriptionModal"),
    subscriptionMessage: getEl("subscriptionMessage")
};

// ==========================================================
// AUTH HELPERS
// ==========================================================

function ppSafeDecodeJWT(token) {
    try {
        const parts = token.split(".");
        if (parts.length !== 3) return null;
        const payload = JSON.parse(atob(parts[1]));
        return payload;
    } catch {
        return null;
    }
}

function ppIsTokenExpired(payload) {
    if (!payload || !payload.exp) return true;
    const now = Date.now() / 1000;
    return payload.exp < now;
}

function ppIsLoggedIn() {
    return !!ppAuthState.token;
}

function ppIsFreeRole() {
    return (ppAuthState.role || "free") === "free";
}

function ppCanAccessProtectedApp() {
    return ppIsLoggedIn();
}

// ==========================================================
// AUTH UI MODE HELPERS
// ==========================================================

function ppSetAuthMode(mode) {
    ppAuthMode = mode === "register" ? "register" : "login";

    if (DOM.authModalTitle) {
        DOM.authModalTitle.textContent =
            ppAuthMode === "register" ? "Create Account" : "Login";
    }

    if (DOM.switchAuthMode) {
        DOM.switchAuthMode.textContent =
            ppAuthMode === "register"
                ? "Already have an account? Login"
                : "Don't have an account? Register";
    }

    if (DOM.authMessage) {
        DOM.authMessage.textContent = "";
    }
}

function ppOpenAuthModal(mode = "login") {
    if (!DOM.authModal) return;

    ppSetAuthMode(mode);
    DOM.authModal.classList.remove("hidden");
    DOM.authModal.style.display = "flex";

    if (DOM.authEmail) DOM.authEmail.focus();
}

function ppCloseAuthModal() {
    if (!DOM.authModal) return;

    DOM.authModal.classList.add("hidden");
    DOM.authModal.style.display = "none";

    if (DOM.authMessage) DOM.authMessage.textContent = "";
    if (DOM.authForm) DOM.authForm.reset();
}

function ppOpenSubscriptionModal() {
    if (!DOM.subscriptionModal) return;
    DOM.subscriptionModal.classList.remove("hidden");
    DOM.subscriptionModal.style.display = "flex";
}

function ppCloseSubscriptionModal() {
    if (!DOM.subscriptionModal) return;
    DOM.subscriptionModal.classList.add("hidden");
    DOM.subscriptionModal.style.display = "none";
    if (DOM.subscriptionMessage) DOM.subscriptionMessage.textContent = "";
}

function ppShowAuthMessage(message, isError = false) {
    if (!DOM.authMessage) return;
    DOM.authMessage.textContent = message;
    DOM.authMessage.className = isError ? "auth-error" : "auth-success";
}

// ==========================================================
// INIT AUTH STATE FROM STORAGE
// ==========================================================

function ppInitAuth() {

    const stored = localStorage.getItem(PP_AUTH_STORAGE_KEY);

    if (!stored) {
        ppAuthState.token = null;
        ppAuthState.role = "free";
        ppAuthState.payload = null;
        ppAuthState.initialized = true;
        ppSyncProtectedUI();
        return;
    }

    const payload = ppSafeDecodeJWT(stored);

    if (!payload || ppIsTokenExpired(payload)) {
        localStorage.removeItem(PP_AUTH_STORAGE_KEY);
        ppAuthState.token = null;
        ppAuthState.role = "free";
        ppAuthState.payload = null;
        ppAuthState.initialized = true;
        ppSyncProtectedUI();
        return;
    }

    ppAuthState.token = stored;
    ppAuthState.payload = payload;
    ppAuthState.role = payload.role || "free";
    ppAuthState.initialized = true;

    ppSyncProtectedUI();
}

// ==========================================================
// SYNC UI WITH AUTH STATE
// ==========================================================

function ppSyncProtectedUI() {

    const loggedIn = ppIsLoggedIn();
    const isFree = ppIsFreeRole();

    // === GUEST / HERO BUTTONS ===
    if (DOM.heroLoginBtn) {
        if (loggedIn) hideEl(DOM.heroLoginBtn);
        else showEl(DOM.heroLoginBtn, "inline-block");
    }

    if (DOM.heroRegisterBtn) {
        if (loggedIn) hideEl(DOM.heroRegisterBtn);
        else showEl(DOM.heroRegisterBtn, "inline-block");
    }

    // === HEADER AUTH BUTTONS ===
    if (DOM.loginBtn) {
        if (loggedIn) hideEl(DOM.loginBtn);
        else showEl(DOM.loginBtn, "inline-block");
    }

    if (DOM.registerBtn) {
        if (loggedIn) hideEl(DOM.registerBtn);
        else showEl(DOM.registerBtn, "inline-block");
    }

    if (DOM.logoutBtn) {
        if (loggedIn) showEl(DOM.logoutBtn, "inline-block");
        else hideEl(DOM.logoutBtn);
    }

    if (DOM.upgradeBtn) {
        if (loggedIn && isFree) showEl(DOM.upgradeBtn, "inline-block");
        else hideEl(DOM.upgradeBtn);
    }

    // === USER STATUS BADGE ===
    if (DOM.userStatus) {
        if (loggedIn) {
            showEl(DOM.userStatus, "flex");
            if (DOM.userRoleBadge) {
                DOM.userRoleBadge.textContent = ppAuthState.role.toUpperCase();
            }
        } else {
            hideEl(DOM.userStatus);
        }
    }

    // === GUEST LANDING / LOCKED NOTICE / PROTECTED APP ===
    if (loggedIn) {

        // Logged in => show protected app
        if (DOM.guestLanding) hideEl(DOM.guestLanding);
        if (DOM.lockedNotice) hideEl(DOM.lockedNotice);
        if (DOM.protectedApp) showEl(DOM.protectedApp, "block");

        ppShowProtectedContent();

    } else {

        // Logged out => show guest landing
        if (DOM.guestLanding) showEl(DOM.guestLanding, "block");
        if (DOM.lockedNotice) hideEl(DOM.lockedNotice);
        if (DOM.protectedApp) hideEl(DOM.protectedApp);

        ppClearProtectedState();
    }

    // === DASHBOARD ACCESS BADGE (GUEST VIEW) ===
    if (DOM.dashboardAccessBadge) {
        if (!loggedIn) {
            showEl(DOM.dashboardAccessBadge, "inline-block");
        } else {
            hideEl(DOM.dashboardAccessBadge);
        }
    }
}

// ==========================================================
// SHOW PROTECTED CONTENT (LOGGED IN)
// ==========================================================

function ppShowProtectedContent() {

    if (!ppCanAccessProtectedApp()) {
        ppRenderLockedContent();
        return;
    }

    // Show all sections
    if (DOM.matchesSection) showEl(DOM.matchesSection, "block");
    if (DOM.marketOptionsSection) showEl(DOM.marketOptionsSection, "block");
    if (DOM.teamAnalysisSection) showEl(DOM.teamAnalysisSection, "block");
    if (DOM.accumulatorSection) showEl(DOM.accumulatorSection, "block");
}

// ==========================================================
// RENDER LOCKED CONTENT (LOGGED OUT)
// ==========================================================

function ppRenderLockedContent() {

    // Clear all protected sections
    if (DOM.topPicksContainer) {
        DOM.topPicksContainer.innerHTML =
            `<p class="placeholder">Login to view predictions.</p>`;
    }

    if (DOM.marketOptionsContainer) {
        DOM.marketOptionsContainer.innerHTML =
            `<p class="placeholder">Login to view markets.</p>`;
    }

    if (DOM.teamAnalysisContainer) {
        DOM.teamAnalysisContainer.innerHTML =
            `<p class="placeholder">Login to analyze teams.</p>`;
    }

    if (DOM.accumulatorContainer) {
        DOM.accumulatorContainer.innerHTML =
            `<p class="builder-empty">Login to build accumulators.</p>`;
    }

    if (DOM.performanceLogContainer) {
        DOM.performanceLogContainer.innerHTML =
            `<p class="builder-empty">Login to track performance.</p>`;
    }
}

// ==========================================================
// CLEAR PROTECTED STATE
// ==========================================================

function ppClearProtectedState() {

    topPicksData = [];
    accumulatorSelections = [];
    performanceLogCache = [];
    smartBuilderSelections = [];

    ppRenderLockedContent();
}

// ==========================================================
// LOGIN FUNCTION
// ==========================================================

async function ppLogin(email, password) {

    if (!email || !password) {
        ppShowAuthMessage("Email and password required.", true);
        return;
    }

    try {

        const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();

        if (!res.ok || !data.token) {
            ppShowAuthMessage(data.message || "Login failed.", true);
            return;
        }

        localStorage.setItem(PP_AUTH_STORAGE_KEY, data.token);

        ppAuthState.token = data.token;
        ppAuthState.payload = ppSafeDecodeJWT(data.token);
        ppAuthState.role = ppAuthState.payload?.role || "free";

        ppShowAuthMessage("Login successful!", false);

        setTimeout(() => {
            ppCloseAuthModal();
            ppSyncProtectedUI();
        }, 800);

    } catch (error) {
        console.error("Login error:", error);
        ppShowAuthMessage("Login failed. Please try again.", true);
    }
}

// ==========================================================
// REGISTER FUNCTION
// ==========================================================

async function ppRegister(email, password) {

    if (!email || !password) {
        ppShowAuthMessage("Email and password required.", true);
        return;
    }

    try {

        const res = await fetch("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();

        if (!res.ok || !data.token) {
            ppShowAuthMessage(data.message || "Registration failed.", true);
            return;
        }

        localStorage.setItem(PP_AUTH_STORAGE_KEY, data.token);

        ppAuthState.token = data.token;
        ppAuthState.payload = ppSafeDecodeJWT(data.token);
        ppAuthState.role = ppAuthState.payload?.role || "free";

        ppShowAuthMessage("Account created successfully!", false);

        setTimeout(() => {
            ppCloseAuthModal();
            ppSyncProtectedUI();
        }, 800);

    } catch (error) {
        console.error("Registration error:", error);
        ppShowAuthMessage("Registration failed. Please try again.", true);
    }
}

// ==========================================================
// LOGOUT FUNCTION
// ==========================================================

function ppLogout() {

    localStorage.removeItem(PP_AUTH_STORAGE_KEY);

    ppAuthState.token = null;
    ppAuthState.role = "free";
    ppAuthState.payload = null;

    ppSyncProtectedUI();
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
// EVENT LISTENERS — AUTH MODAL
// ==========================================================

if (DOM.closeAuthModal) {
    DOM.closeAuthModal.addEventListener("click", ppCloseAuthModal);
}

if (DOM.authModal) {
    DOM.authModal.addEventListener("click", (e) => {
        if (e.target === DOM.authModal) ppCloseAuthModal();
    });
}

if (DOM.authForm) {
    DOM.authForm.addEventListener("submit", (e) => {
        e.preventDefault();

        const email = DOM.authEmail?.value.trim();
        const password = DOM.authPassword?.value;

        if (ppAuthMode === "register") {
            ppRegister(email, password);
        } else {
            ppLogin(email, password);
        }
    });
}

if (DOM.switchAuthMode) {
    DOM.switchAuthMode.addEventListener("click", () => {
        ppSetAuthMode(ppAuthMode === "login" ? "register" : "login");
    });
}

// ==========================================================
// EVENT LISTENERS — SUBSCRIPTION MODAL
// ==========================================================

if (DOM.closeSubscriptionModal) {
    DOM.closeSubscriptionModal.addEventListener("click", ppCloseSubscriptionModal);
}

if (DOM.subscriptionModal) {
    DOM.subscriptionModal.addEventListener("click", (e) => {
        if (e.target === DOM.subscriptionModal) ppCloseSubscriptionModal();
    });
}

// ==========================================================
// EVENT LISTENERS — AUTH BUTTONS IN HEADER / HERO
// ==========================================================

if (DOM.loginBtn) {
    DOM.loginBtn.addEventListener("click", () => ppOpenAuthModal("login"));
}

if (DOM.registerBtn) {
    DOM.registerBtn.addEventListener("click", () => ppOpenAuthModal("register"));
}

if (DOM.heroLoginBtn) {
    DOM.heroLoginBtn.addEventListener("click", () => ppOpenAuthModal("login"));
}

if (DOM.heroRegisterBtn) {
    DOM.heroRegisterBtn.addEventListener("click", () => ppOpenAuthModal("register"));
}

if (DOM.upgradeBtn) {
    DOM.upgradeBtn.addEventListener("click", ppUpgradeToPro);
}

if (DOM.logoutBtn) {
    DOM.logoutBtn.addEventListener("click", ppLogout);
}

// ==========================================================
// COMPETITION MAP (UPDATED WITH ALL SPORTS)
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
// POPULATE COMPETITION DROPDOWN
// ==========================================================

function updateCompetitionOptions() {

    if (!DOM.competitionSelect) return;

    const options = competitionMap[currentSport] || {};

    DOM.competitionSelect.innerHTML = "";

    Object.keys(options).forEach(key => {
        const option = document.createElement("option");
        option.value = key;
        option.textContent = options[key];
        DOM.competitionSelect.appendChild(option);
    });

    // Set first available as default
    const firstKey = Object.keys(options)[0];
    if (firstKey) {
        currentCompetition = firstKey;
        DOM.competitionSelect.value = firstKey;
    }
}

// ==========================================================
// LOAD TOP PICKS
// ==========================================================

async function loadTopPicks() {

    if (!ppCanAccessProtectedApp()) {
        ppRenderLockedContent();
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

        topPicksData = data;

        renderTopPicks(data);

    } catch (error) {
        console.error("Top picks load failed:", error);
        DOM.topPicksContainer.innerHTML =
            `<p class="placeholder">Failed to load predictions.</p>`;
    }
}

// ==========================================================
// RENDER TOP PICKS (UPDATED FOR ALL SPORTS)
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

        // === MATCH HEADER ===
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

        // === MATCH INFO ===
        const infoDiv = document.createElement("div");
        infoDiv.className = "match-info";

        const dateInfo = pick.date ? new Date(pick.date).toLocaleDateString() : "TBD";
        const leagueInfo = pick.league || currentCompetition;

        infoDiv.innerHTML = `
            <span>${leagueInfo}</span>
            <span>${dateInfo}</span>
        `;

        header.appendChild(infoDiv);

        card.appendChild(header);

        // === MATCH BODY ===
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
                    <div class="pick-prob">Win Probability: ${topPick.probability}</div>
                </div>
            `;

            // === ADD TO ACCUMULATOR BUTTON ===
            const addBtn = document.createElement("button");
            addBtn.className = "btn-add-acca";
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

            body.appendChild(addBtn);
        }

        card.appendChild(body);

        // === TOGGLE LOGIC ===
        titleDiv.style.cursor = "pointer";
        titleDiv.addEventListener("click", () => {
            toggleMatchBody(body, toggleIndicator);
        });

        DOM.topPicksContainer.appendChild(card);
    });
}

// ==========================================================
// NORMALIZE PICKS (UPDATED CONFIDENCE BADGE LOGIC)
// ==========================================================

function normalizePicks(pick) {

    const output = [];

    function getAutoConfidence(probPercent) {
        const p = Number(probPercent);

        if (p >= 75) return "High";
        if (p >= 55) return "Medium";
        return "Low";
    }

    // === FOOTBALL ===
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
    }

    // === BASKETBALL ===
    else if (currentSport === "basketball") {

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
    }

    // === AMERICAN FOOTBALL ===
    else if (currentSport === "americanfootball") {

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
    }

    // ==========================================================
    // SEND PART 2 FOR THE REST
    // ==========================================================
// === BASEBALL (MLB) ===
    else if (currentSport === "baseball") {

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
    }

    // === TENNIS ===
    else if (currentSport === "tennis") {

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
    }

    // === RUGBY LEAGUE ===
    else if (currentSport === "rugbyleague") {

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

    // === RUGBY UNION ===
    else if (currentSport === "rugbyunion") {

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
// LOAD MARKET OPTIONS (EXPANDED VIEW)
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

    allPicks.forEach(marketPick => {

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
// CONTINUE IN PART 3
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
// SMART BUILDER
// ==========================================================

function initSmartBuilder() {

    DOM.smartBuilderContainer = getEl("smartBuilderContainer");
    DOM.smartTierSelect = getEl("smartTierSelect");
    DOM.smartGenerateBtn = getEl("smartGenerateBtn");
    DOM.smartStatus = getEl("smartStatus");

    if (!DOM.smartBuilderContainer) return;

    if (DOM.smartTierSelect) {
        DOM.smartTierSelect.addEventListener("change", (e) => {
            smartTier = e.target.value;
        });
    }

    if (DOM.smartGenerateBtn) {
        DOM.smartGenerateBtn.addEventListener("click", generateSmartAccumulator);
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
// FINAL SYNC
// ==========================================================

document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
        ppInitAuth();
    }, 50);
});
