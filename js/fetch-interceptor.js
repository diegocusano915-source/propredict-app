// ==========================================================
// ProPredict — Multi-Sport Probability Intelligence Dashboard
// SPLIT BUILD — /public/js/fetch-interceptor.js
// PURPOSE: Attach auth token to protected routes (safe override)
// REQUIRES: app-state.js (PP_AUTH_STORAGE_KEY)
// ==========================================================

(function () {
  const originalFetch = window.fetch;

  window.fetch = async function (input, init = {}) {
    const url = typeof input === "string" ? input : input.url;

    const needsAuth =
      url.includes("/api/elite") ||
      url.includes("/api/performance") ||
      url.includes("/api/paystack");

    if (needsAuth) {
      const token = localStorage.getItem(window.PP_AUTH_STORAGE_KEY);

      if (token) {
        init.headers = init.headers || {};
        init.headers["Authorization"] = `Bearer ${token}`;
      }
    }

    return originalFetch(input, init);
  };
})();
