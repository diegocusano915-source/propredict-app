// ==========================================================
// ProPredict — Multi-Sport Probability Intelligence Dashboard
// SPLIT BUILD — /public/js/app-state.js
// PURPOSE: Global state + auth state/constants (must load first)
// SAFE: No DOM access, no event binding, no side effects
// ==========================================================

// ==========================================================
// GLOBAL STATE (Core)
// ==========================================================

window.currentSport = "football";
window.currentCompetition = "PL";
window.topPicksData = [];
window.accumulatorSelections = [];

// ✅ Performance log cache
window.performanceLogCache = [];

// ✅ Smart Builder State
window.smartTier = "balanced";
window.smartBuilderLoading = false;
window.smartBuilderSelections = [];

// ✅ Auth UI Mode
window.ppAuthMode = "login";

// ==========================================================
// AUTH STORAGE + STATE
// ==========================================================

window.PP_AUTH_STORAGE_KEY = "pp_token";

window.ppAuthState = {
  token: null,
  role: "free",
  payload: null,
  initialized: false
};
