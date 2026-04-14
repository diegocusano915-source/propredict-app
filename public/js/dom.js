// ==========================================================
// ProPredict — Multi-Sport Probability Intelligence Dashboard
// SPLIT BUILD — /public/js/dom.js
// PURPOSE: Central DOM references map (no side effects)
// REQUIRES: helpers.js (getEl)
// ==========================================================

// ✅ FIX: Map DOM AFTER page loads, not immediately
window.mapDOM = function mapDOM() {
  window.DOM = {
    // Core header controls
    sportSelect: window.getEl("sportSelect"),
    competitionSelect: window.getEl("competitionSelect"),
    eliteToggle: window.getEl("eliteToggle"),
    themeToggleBtn: window.getEl("themeToggleBtn"),

    // Main content
    topPicksContainer: window.getEl("topPicksContainer"),
    marketOptionsContainer: window.getEl("marketOptionsContainer"),
    teamAnalysisContainer: window.getEl("teamAnalysisContainer"),

    // Accumulator — support both old and new HTML ids
    accumulatorContainer: window.getEl("accumulatorSelections", "accumulatorContainer"),
    combinedProbability: window.getEl("combinedProbability"),
    decimalOdds: window.getEl("decimalOdds"),
    riskLevel: window.getEl("riskLevel"),
    clearAccumulatorBtn: window.getEl("clearAccumulatorBtn"),

    // Team analysis controls
    teamSelect: window.getEl("teamSelect"),
    analyzeBtn: window.getEl("analyzeBtn"),

    // Performance
    perfTotal: window.getEl("perfTotal"),
    perfSettled: window.getEl("perfSettled"),
    perfWins: window.getEl("perfWins"),
    perfLosses: window.getEl("perfLosses"),
    perfWinRate: window.getEl("perfWinRate"),
    perfROI: window.getEl("perfROI"),
    performanceLogContainer: window.getEl("performanceLogContainer"),

    // Smart builder refs (will be injected later)
    smartBuilderContainer: null,
    smartTierSelect: null,
    smartGenerateBtn: null,
    smartStatus: null,

    // Protected shell / guest shell
    appRoot: window.getEl("appRoot"),
    guestLanding: window.getEl("guestLanding"),
    lockedNotice: window.getEl("lockedNotice"),
    protectedApp: window.getEl("protectedApp"),
    matchesSection: window.getEl("matchesSection"),
    marketOptionsSection: window.getEl("marketOptionsSection"),
    teamAnalysisSection: window.getEl("teamAnalysisSection"),
    accumulatorSection: window.getEl("accumulatorSection"),
    dashboardAccessBadge: window.getEl("dashboardAccessBadge"),

    // Auth controls in header / hero
    loginBtn: window.getEl("loginBtn"),
    registerBtn: window.getEl("registerBtn"),
    heroLoginBtn: window.getEl("heroLoginBtn"),
    heroRegisterBtn: window.getEl("heroRegisterBtn"),
    upgradeBtn: window.getEl("upgradeBtn"),
    logoutBtn: window.getEl("logoutBtn"),
    userStatus: window.getEl("userStatus"),
    userRoleBadge: window.getEl("userRoleBadge"),

    // Auth modal
    authModal: window.getEl("authModal"),
    closeAuthModal: window.getEl("closeAuthModal"),
    authModalTitle: window.getEl("authModalTitle"),
    authForm: window.getEl("authForm"),
    authEmail: window.getEl("authEmail"),
    authPassword: window.getEl("authPassword"),
    authMessage: window.getEl("authMessage"),
    switchAuthMode: window.getEl("switchAuthMode"),

    // Subscription modal
    subscriptionModal: window.getEl("subscriptionModal"),
    closeSubscriptionModal: window.getEl("closeSubscriptionModal"),
    subscriptionMessage: window.getEl("subscriptionMessage")
  };
  
  console.log("✅ DOM mapped successfully");
};

// Debug helper
window.debugDOM = function () {
  console.log("DOM CHECK:", window.DOM);
  console.log("sportSelect:", window.DOM?.sportSelect);
  console.log("loginBtn:", window.DOM?.loginBtn);
};
