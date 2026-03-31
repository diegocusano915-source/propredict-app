// ==========================================================
// ProPredict — Multi-Sport Probability Intelligence Dashboard
// SPLIT BUILD — /public/js/safety-wrappers.js
// PURPOSE: Extra safety layer to prevent data calls when logged out
// NOTE: Mirrors the final wrappers from your original monolith
// REQUIRES: auth.js + picks.js + performance.js loaded first
// ==========================================================

(function () {
  // Wrap loadTopPicks
  if (typeof window.loadTopPicks === "function") {
    const safeOriginalLoadTopPicks = window.loadTopPicks;
    window.loadTopPicks = async function () {
      if (!window.ppCanAccessProtectedApp()) {
        window.ppRenderLockedContent();
        return;
      }
      return safeOriginalLoadTopPicks();
    };
  }

  // Wrap loadPerformanceSummary
  if (typeof window.loadPerformanceSummary === "function") {
    const safeOriginalLoadPerf = window.loadPerformanceSummary;
    window.loadPerformanceSummary = async function () {
      if (!window.ppCanAccessProtectedApp()) return;
      return safeOriginalLoadPerf();
    };
  }

  // Wrap loadPerformanceLog
  if (typeof window.loadPerformanceLog === "function") {
    const safeOriginalLoadLog = window.loadPerformanceLog;
    window.loadPerformanceLog = async function () {
      if (!window.ppCanAccessProtectedApp()) return;
      return safeOriginalLoadLog();
    };
  }
})();
