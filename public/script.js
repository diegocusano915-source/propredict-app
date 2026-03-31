// ==========================================================
// ProPredict — Multi-Sport Probability Intelligence Dashboard
// FULL PRODUCTION BUILD — SMART BUILDER INTEGRATED
// UPDATED WITH RUGBY LEAGUE + RUGBY UNION + MLB + TENNIS SUPPORT
// AUTH GATE + PROFESSIONAL LOGIN FLOW + PROTECTED APP SHELL
// FULL UPDATED FILE — FIXED COMPETITION DEFAULT BUG
// PART 1/8
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
    DOM.authMessage.style.color = isError ? "#ff6b6b" : "";
}

function ppShowSubscriptionMessage(message, isError = false) {
    if (!DOM.subscriptionMessage) return;
    DOM.subscriptionMessage.textContent = message;
    DOM.subscriptionMessage.style.color = isError ? "#ff6b6b" : "";
}

// ==========================================================
// AUTH ROLE + VISIBILITY MANAGEMENT
// ==========================================================

function ppApplyRole(role) {
    ppAuthState.role = role || "free";
    ppUpdateRoleBadge();
    ppUpdateEliteAccess();
    ppSyncProtectedUI();
}

function ppUpdateRoleBadge() {
    if (!DOM.userRoleBadge) return;

    const role = (ppAuthState.role || "free").toLowerCase();
    DOM.userRoleBadge.textContent = role.toUpperCase();

    DOM.userRoleBadge.classList.remove("role-free", "role-pro", "role-vvip");

    if (role === "pro") {
        DOM.userRoleBadge.classList.add("role-pro");
    } else if (role === "vvip") {
        DOM.userRoleBadge.classList.add("role-vvip");
    } else {
        DOM.userRoleBadge.classList.add("role-free");
    }
}

function ppUpdateEliteAccess() {
    if (!DOM.eliteToggle) return;

    if (!ppIsLoggedIn()) {
        DOM.eliteToggle.checked = false;
        DOM.eliteToggle.disabled = true;
        return;
    }

    if (ppIsFreeRole()) {
        DOM.eliteToggle.checked = false;
        DOM.eliteToggle.disabled = true;
    } else {
        DOM.eliteToggle.disabled = false;
    }
}

function ppSyncProtectedUI() {
    const loggedIn = ppCanAccessProtectedApp();

    // Header buttons
    if (loggedIn) {
        hideEl(DOM.loginBtn);
        hideEl(DOM.registerBtn);
        showEl(DOM.logoutBtn, "inline-flex");
        showEl(DOM.upgradeBtn, "inline-flex");
    } else {
        showEl(DOM.loginBtn, "inline-flex");
        showEl(DOM.registerBtn, "inline-flex");
        hideEl(DOM.logoutBtn);
        hideEl(DOM.upgradeBtn);
    }

    // Guest landing and app shell
    if (loggedIn) {
        hideEl(DOM.guestLanding);
        hideEl(DOM.lockedNotice);
        showEl(DOM.protectedApp, "block");
        setText(DOM.dashboardAccessBadge, ppAuthState.role.toUpperCase());
    } else {
        showEl(DOM.guestLanding, "block");
        showEl(DOM.lockedNotice, "block");
        hideEl(DOM.protectedApp);
        setText(DOM.dashboardAccessBadge, "Protected");
        ppRenderLockedContent();
    }
}

function ppRenderLockedContent() {
    setHTML(
        DOM.topPicksContainer,
        `<div class="placeholder">Login or register to view top picks and matches.</div>`
    );

    setHTML(
        DOM.marketOptionsContainer,
        `<div class="placeholder">Login or register to view betting market options.</div>`
    );

    setHTML(
        DOM.teamAnalysisContainer,
        `<div class="placeholder">Login or register to view team analysis.</div>`
    );

    if (DOM.accumulatorContainer) {
        DOM.accumulatorContainer.innerHTML =
            `<p class="builder-empty">Login or register to use the accumulator.</p>`;
    }

    updateMetrics(0);
}

function ppClearProtectedState() {
    topPicksData = [];
    accumulatorSelections = [];
    smartBuilderSelections = [];
    performanceLogCache = [];

    ppRenderLockedContent();

    if (DOM.performanceLogContainer) {
        DOM.performanceLogContainer.innerHTML =
            `<p class="builder-empty">Login required.</p>`;
    }

    if (DOM.perfTotal) DOM.perfTotal.textContent = "0";
    if (DOM.perfSettled) DOM.perfSettled.textContent = "0";
    if (DOM.perfWins) DOM.perfWins.textContent = "0";
    if (DOM.perfLosses) DOM.perfLosses.textContent = "0";
    if (DOM.perfWinRate) DOM.perfWinRate.textContent = "0%";
    if (DOM.perfROI) DOM.perfROI.textContent = "0%";

    updateSmartStatus("");
}

// ==========================================================
// AUTH INITIALIZATION
// ==========================================================

function ppInitAuth() {
    if (ppAuthState.initialized) return;

    const token = localStorage.getItem(PP_AUTH_STORAGE_KEY);

    if (!token) {
        ppAuthState.token = null;
        ppAuthState.payload = null;
        ppApplyRole("free");
        ppAuthState.initialized = true;
        return;
    }

    const payload = ppSafeDecodeJWT(token);

    if (!payload || ppIsTokenExpired(payload)) {
        localStorage.removeItem(PP_AUTH_STORAGE_KEY);
        ppAuthState.token = null;
        ppAuthState.payload = null;
        ppApplyRole("free");
        ppAuthState.initialized = true;
        return;
    }

    ppAuthState.token = token;
    ppAuthState.payload = payload;
    ppApplyRole(payload.role || "free");
    ppAuthState.initialized = true;
}

// ==========================================================
// INIT
// ==========================================================

document.addEventListener("DOMContentLoaded", () => {
    bindEvents();
    injectSmartBuilderUI();
    ppInitAuth();
    ppBindAuthUI();
    updateCompetitionOptions();

    if (ppCanAccessProtectedApp()) {
        loadTopPicks();
        loadPerformanceSummary();
        loadPerformanceLog();
    } else {
        ppRenderLockedContent();
    }
});
// ==========================================================
// PART 2/8
// ==========================================================

// ==========================================================
// EVENT BINDING
// ==========================================================

function bindEvents() {
    if (DOM.sportSelect) {
        DOM.sportSelect.addEventListener("change", (e) => {
            currentSport = e.target.value;
            updateCompetitionOptions();
            resetBuilders();

            if (ppCanAccessProtectedApp()) {
                loadTopPicks();
            } else {
                ppRenderLockedContent();
            }
        });
    }

    if (DOM.competitionSelect) {
        DOM.competitionSelect.addEventListener("change", (e) => {
            currentCompetition = e.target.value;
            resetBuilders();

            if (ppCanAccessProtectedApp()) {
                loadTopPicks();
            } else {
                ppRenderLockedContent();
            }
        });
    }

    if (DOM.eliteToggle) {
        DOM.eliteToggle.addEventListener("change", () => {
            if (!ppCanAccessProtectedApp()) {
                DOM.eliteToggle.checked = false;
                ppOpenAuthModal("login");
                return;
            }

            if (ppIsFreeRole()) {
                DOM.eliteToggle.checked = false;
                ppOpenSubscriptionModal();
                return;
            }

            loadTopPicks();
        });
    }

    if (DOM.clearAccumulatorBtn) {
        DOM.clearAccumulatorBtn.addEventListener("click", () => {
            if (!ppCanAccessProtectedApp()) {
                ppOpenAuthModal("login");
                return;
            }

            accumulatorSelections = [];
            smartBuilderSelections = [];
            renderAccumulator();
            renderTopPicks();
            updateSmartStatus("");
        });
    }

    if (DOM.analyzeBtn) {
        DOM.analyzeBtn.addEventListener("click", () => {
            if (!ppCanAccessProtectedApp()) {
                ppOpenAuthModal("login");
                return;
            }

            if (currentSport !== "football") return;
            const teamId = DOM.teamSelect ? DOM.teamSelect.value : "";

            if (teamId) {
                analyzeTeam(teamId);
            }
        });
    }
}

// ==========================================================
// RESET BUILDERS (MISSING IN ORIGINAL -> ADDED)
// Prevents stale accumulator/smart selections when switching sport/competition
// ==========================================================

function resetBuilders() {
    accumulatorSelections = [];
    smartBuilderSelections = [];
    updateSmartStatus("");

    if (DOM.accumulatorContainer) {
        DOM.accumulatorContainer.innerHTML = `<p class="builder-empty">No selections added.</p>`;
    }

    updateMetrics(0);
}

// ==========================================================
// AUTH UI EVENTS
// ==========================================================

function ppBindAuthUI() {

    // Header buttons
    if (DOM.loginBtn) {
        DOM.loginBtn.addEventListener("click", () => {
            ppOpenAuthModal("login");
        });
    }

    if (DOM.registerBtn) {
        DOM.registerBtn.addEventListener("click", () => {
            ppOpenAuthModal("register");
        });
    }

    // Hero buttons
    if (DOM.heroLoginBtn) {
        DOM.heroLoginBtn.addEventListener("click", () => {
            ppOpenAuthModal("login");
        });
    }

    if (DOM.heroRegisterBtn) {
        DOM.heroRegisterBtn.addEventListener("click", () => {
            ppOpenAuthModal("register");
        });
    }

    // Logout
    if (DOM.logoutBtn) {
        DOM.logoutBtn.addEventListener("click", () => {
            ppLogout();
        });
    }

    // Upgrade
    if (DOM.upgradeBtn) {
        DOM.upgradeBtn.addEventListener("click", () => {
            ppOpenSubscriptionModal();
        });
    }

    // Close modals
    if (DOM.closeAuthModal) {
        DOM.closeAuthModal.addEventListener("click", ppCloseAuthModal);
    }

    if (DOM.closeSubscriptionModal) {
        DOM.closeSubscriptionModal.addEventListener("click", ppCloseSubscriptionModal);
    }

    // Switch login/register
    if (DOM.switchAuthMode) {
        DOM.switchAuthMode.addEventListener("click", () => {
            ppSetAuthMode(ppAuthMode === "login" ? "register" : "login");
        });
    }

    // Auth form submit
    if (DOM.authForm) {
        DOM.authForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const email = DOM.authEmail ? DOM.authEmail.value.trim() : "";
            const password = DOM.authPassword ? DOM.authPassword.value.trim() : "";

            if (!email || !password) {
                ppShowAuthMessage("Email and password required", true);
                return;
            }

            try {
                ppShowAuthMessage("Processing...");

                if (ppAuthMode === "login") {
                    await ppLogin(email, password);
                } else {
                    await ppRegister(email, password);
                }

                ppCloseAuthModal();

                // reload protected data
                loadTopPicks();
                loadPerformanceSummary();
                loadPerformanceLog();

            } catch (err) {
                ppShowAuthMessage(err.message || "Authentication failed", true);
            }
        });
    }

    // Subscription buttons
    document.querySelectorAll("[data-tier]").forEach(btn => {
        btn.addEventListener("click", async () => {
            const tier = btn.dataset.tier;
            const interval = btn.dataset.interval;

            try {
                ppShowSubscriptionMessage("Initializing payment...");
                await ppStartSubscription({ tier, interval });
            } catch (err) {
                ppShowSubscriptionMessage(err.message || "Payment failed", true);
            }
        });
    });
}
// ==========================================================
// PART 3/8
// ==========================================================

// ==========================================================
// LOGIN / REGISTER
// ==========================================================

async function ppLogin(email, password) {

    const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.message || "Login failed");

    localStorage.setItem(PP_AUTH_STORAGE_KEY, data.token);

    ppAuthState.initialized = false;
    ppInitAuth();
}

async function ppRegister(email, password) {

    const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.message || "Register failed");

    localStorage.setItem(PP_AUTH_STORAGE_KEY, data.token);

    ppAuthState.initialized = false;
    ppInitAuth();
}

function ppLogout() {

    localStorage.removeItem(PP_AUTH_STORAGE_KEY);

    ppAuthState.token = null;
    ppAuthState.payload = null;

    ppApplyRole("free");
    ppClearProtectedState();
}

// ==========================================================
// PAYSTACK
// ==========================================================

async function ppStartSubscription(plan) {

    const res = await fetch("/api/paystack/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan })
    });

    const data = await res.json();

    if (!res.ok) throw new Error("Payment initialization failed");

    if (data.authorization_url) {
        window.location.href = data.authorization_url;
    }
}

// ==========================================================
// FETCH INTERCEPTOR (SAFE)
// ==========================================================

const originalFetch = window.fetch;

window.fetch = async function (input, init = {}) {

    const url = typeof input === "string" ? input : input.url;

    const needsAuth =
        url.includes("/api/elite") ||
        url.includes("/api/performance") ||
        url.includes("/api/paystack");

    if (needsAuth) {
        const token = localStorage.getItem(PP_AUTH_STORAGE_KEY);

        if (token) {
            init.headers = init.headers || {};
            init.headers["Authorization"] = `Bearer ${token}`;
        }
    }

    return originalFetch(input, init);
};

// ==========================================================
// SMART BUILDER UI INJECTION
// ==========================================================

function injectSmartBuilderUI() {

    if (!DOM.accumulatorContainer) return;

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

    if (DOM.smartTierSelect) {
        DOM.smartTierSelect.addEventListener("change", (e) => {
            smartTier = e.target.value;
        });
    }

    if (DOM.smartGenerateBtn) {
        DOM.smartGenerateBtn.addEventListener("click", () => {

            if (!ppCanAccessProtectedApp()) {
                ppOpenAuthModal("login");
                return;
            }

            if (!topPicksData || smartBuilderLoading) return;

            generateSmartAccumulator();
        });
    }
}

function updateSmartStatus(message) {
    if (DOM.smartStatus) {
        DOM.smartStatus.textContent = message;
    }
}
// ==========================================================
// PART 4/8
// ==========================================================

// ==========================================================
// COMPETITION OPTIONS (UPDATED + EXPANDED)
// ✅ FIX: force a valid default competition for each sport
// ==========================================================

function updateCompetitionOptions() {

    if (!DOM.competitionSelect) return;

    DOM.competitionSelect.innerHTML = "";

    if (currentSport === "football") {

        addOption("PL", "Premier League");
        addOption("PD", "La Liga");
        addOption("SA", "Serie A");
        addOption("BL1", "Bundesliga");
        addOption("FL1", "Ligue 1");

        // Secondary leagues
        addOption("EFL", "EFL Championship");
        addOption("BL2", "Bundesliga 2");
        addOption("SB", "Serie B");
        addOption("FL2", "Ligue 2");
        addOption("SD", "Segunda Division");

        // Added leagues (your missing ones)
        addOption("SPL", "Saudi Pro League");
        addOption("J1", "Japan J-League");
        addOption("CSL", "Chinese Super League");

        // European competitions
        addOption("UCL", "UEFA Champions League");
        addOption("UEL", "UEFA Europa League");
        addOption("UECL", "UEFA Conference League");

        // International
        addOption("WC", "FIFA World Cup");
        addOption("EURO", "UEFA Euro");

        // Others
        addOption("ALLS", "Sweden Allsvenskan");
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

    if (currentSport === "rugbyunion") {
        addOption("TOP14", "Top 14");
        addOption("SIXNATIONS", "Six Nations");
    }

    if (currentSport === "mlb") {
        addOption("MLB", "MLB");
    }

    if (currentSport === "tennis") {
        addOption("ATP", "ATP");
        addOption("WTA", "WTA");
    }

    if (currentSport === "darts") {
        addOption("PDC", "PDC");
    }

    if (currentSport === "tabletennis") {
        addOption("ALL", "All Events");
    }

    // ✅ FIX: after rebuilding options, force-select first option
    const first = DOM.competitionSelect.options[0];
    if (first) {
        DOM.competitionSelect.value = first.value;
        currentCompetition = first.value;
    } else {
        currentCompetition = "";
    }

    if (currentSport === "football") {
        loadTeams(currentCompetition);
    } else {
        if (DOM.teamSelect) {
            DOM.teamSelect.innerHTML = `<option value="">Football Only</option>`;
        }

        if (DOM.teamAnalysisContainer) {
            DOM.teamAnalysisContainer.innerHTML =
                `<p class="placeholder">Team analysis available for football only.</p>`;
        }
    }
}

function addOption(value, text) {
    if (!DOM.competitionSelect) return;

    const option = document.createElement("option");
    option.value = value;
    option.textContent = text;
    DOM.competitionSelect.appendChild(option);
}
// ==========================================================
// PART 5/8
// ==========================================================

// ==========================================================
// LOAD TOP PICKS (AUTH PROTECTED)
// ==========================================================

async function loadTopPicks() {

    if (!ppCanAccessProtectedApp()) {
        ppRenderLockedContent();
        return;
    }

    if (!DOM.topPicksContainer) return;

    // ✅ Guard: stop if competition missing
    if (!currentCompetition) {
        DOM.topPicksContainer.innerHTML = `
            <div class="error-state">
                Please select a competition.
            </div>
        `;
        return;
    }

    DOM.topPicksContainer.innerHTML = `
        <div class="loading-state">
            Loading projections...
        </div>
    `;

    try {

        const route = DOM.eliteToggle && DOM.eliteToggle.checked
            ? `/api/elite/${currentSport}/${currentCompetition}`
            : `/api/top-picks/${currentSport}/${currentCompetition}`;

        const res = await fetch(route);

        if (!res.ok) {
            throw new Error("Network response was not ok");
        }

        const data = await res.json();

        const rawPicks = DOM.eliteToggle && DOM.eliteToggle.checked
            ? data.elitePicks
            : data.topPicks;

        topPicksData = normalizePicks(rawPicks);

        renderTopPicks();

    } catch (err) {
        console.error("Load Top Picks Error:", err);

        DOM.topPicksContainer.innerHTML = `
            <div class="error-state">
                Failed to load fixtures.
            </div>
        `;
    }
}

// ==========================================================
// NORMALIZE PICKS (SAFE)
// ==========================================================

function normalizePicks(raw) {

    if (!raw) return [];

    // Array format
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

    // Object grouped
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
// PART 6/8
// ==========================================================

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
// PART 7/8
// ==========================================================

// ==========================================================
// RENDER TOP PICKS (SAFE + AUTH + NO BREAK)
// ==========================================================

function renderTopPicks() {

    if (!ppCanAccessProtectedApp()) {
        ppRenderLockedContent();
        return;
    }

    if (!DOM.topPicksContainer) return;

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

        const indicator = document.createElement("span");
        indicator.className = "toggle-indicator";
        indicator.textContent = "▼";

        const title = document.createElement("strong");
        title.textContent = `${match.homeTeam} vs ${match.awayTeam}`;

        header.appendChild(title);
        header.appendChild(indicator);

        const body = document.createElement("div");
        body.className = "match-body";

        header.addEventListener("click", () => {
            toggleMatchBody(body, indicator);
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
                <div>${safePercent(pick.probability)}%</div>
                <div>${pick.confidence}</div>
                <button ${added ? "disabled" : ""}>
                    ${added ? "Added" : "Add"}
                </button>
            `;

            const btn = card.querySelector("button");

            if (btn) {
                btn.addEventListener("click", async () => {

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
            }

            body.appendChild(card);
        });

        wrapper.appendChild(header);
        wrapper.appendChild(body);

        DOM.topPicksContainer.appendChild(wrapper);
    });
}

// ==========================================================
// ACCUMULATOR (FIXED + SAFE)
// ==========================================================

function renderAccumulator() {

    if (!ppCanAccessProtectedApp()) {
        ppRenderLockedContent();
        return;
    }

    if (!DOM.accumulatorContainer) return;

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
                <div>${safePercent(pick.probability)}%</div>
            </div>
            <button>Remove</button>
        `;

        const btn = row.querySelector("button");

        if (btn) {
            btn.addEventListener("click", () => {
                accumulatorSelections.splice(index, 1);
                renderAccumulator();
                renderTopPicks();
            });
        }

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

    if (DOM.combinedProbability) {
        DOM.combinedProbability.textContent =
            percentage.toFixed(2) + "%";
    }

    if (DOM.decimalOdds) {
        DOM.decimalOdds.textContent =
            probabilityDecimal > 0
                ? (1 / probabilityDecimal).toFixed(2)
                : "-";
    }

    let risk = "High";
    if (percentage >= 60) risk = "Low";
    else if (percentage >= 35) risk = "Medium";

    if (DOM.riskLevel) {
        DOM.riskLevel.textContent =
            probabilityDecimal ? risk : "-";
    }
}
// ==========================================================
// PART 8/8
// ==========================================================

// ==========================================================
// PERFORMANCE SUMMARY
// ==========================================================

async function loadPerformanceSummary() {

    if (!ppCanAccessProtectedApp()) return;

    try {

        const res = await fetch("/api/performance/summary");
        const data = await res.json();

        if (DOM.perfTotal) DOM.perfTotal.textContent = data.totalPicks || 0;
        if (DOM.perfSettled) DOM.perfSettled.textContent = data.settledPicks || 0;
        if (DOM.perfWins) DOM.perfWins.textContent = data.wins || 0;
        if (DOM.perfLosses) DOM.perfLosses.textContent = data.losses || 0;

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
// TEAM ANALYSIS (FIXED + SAFE)
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

    } catch {
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

    } catch {
        DOM.teamAnalysisContainer.innerHTML =
            `<p class="placeholder">Analysis failed.</p>`;
    }
}

// ==========================================================
// FINAL AUTH + UI SYNC + SAFETY LAYER
// ==========================================================

// Ensure UI always reflects auth state correctly
function ppFullUIRefresh() {

    ppInitAuth();
    ppSyncProtectedUI();

    if (ppCanAccessProtectedApp()) {

        // Reload everything clean
        loadTopPicks();
        loadPerformanceSummary();
        loadPerformanceLog();

        if (currentSport === "football") {
            loadTeams(currentCompetition);
        }

    } else {

        ppClearProtectedState();
    }
}

// ==========================================================
// SAFE RE-INIT AFTER LOGIN / LOGOUT
// ==========================================================

function ppReinitializeAppAfterAuth() {

    // Reset builders to avoid stale state
    accumulatorSelections = [];
    smartBuilderSelections = [];

    updateSmartStatus("");

    // Reset UI
    if (DOM.accumulatorContainer) {
        DOM.accumulatorContainer.innerHTML =
            `<p class="builder-empty">No selections added.</p>`;
    }

    updateMetrics(0);

    // Reload UI properly
    ppFullUIRefresh();
}

// ==========================================================
// OVERRIDE LOGIN / REGISTER FLOW TO TRIGGER FULL SYNC
// ==========================================================

const originalLogin = ppLogin;
ppLogin = async function (email, password) {

    await originalLogin(email, password);

    ppReinitializeAppAfterAuth();
};

const originalRegister = ppRegister;
ppRegister = async function (email, password) {

    await originalRegister(email, password);

    ppReinitializeAppAfterAuth();
};

const originalLogout = ppLogout;
ppLogout = function () {

    originalLogout();

    ppReinitializeAppAfterAuth();
};

// ==========================================================
// EXTRA SAFETY: PREVENT DATA CALLS WHEN LOGGED OUT
// ==========================================================

const safeOriginalLoadTopPicks = loadTopPicks;
loadTopPicks = async function () {

    if (!ppCanAccessProtectedApp()) {
        ppRenderLockedContent();
        return;
    }

    return safeOriginalLoadTopPicks();
};

const safeOriginalLoadPerf = loadPerformanceSummary;
loadPerformanceSummary = async function () {

    if (!ppCanAccessProtectedApp()) return;

    return safeOriginalLoadPerf();
};

const safeOriginalLoadLog = loadPerformanceLog;
loadPerformanceLog = async function () {

    if (!ppCanAccessProtectedApp()) return;

    return safeOriginalLoadLog();
};

// ==========================================================
// INITIAL FINAL SYNC ON LOAD
// ==========================================================

document.addEventListener("DOMContentLoaded", () => {

    // Delay slightly to ensure DOM fully ready
    setTimeout(() => {
        ppFullUIRefresh();
    }, 50);
});
