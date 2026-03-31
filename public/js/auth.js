// ==========================================================
// ProPredict — Multi-Sport Probability Intelligence Dashboard
// SPLIT BUILD — /public/js/auth.js
// PURPOSE: Auth helpers + UI sync + login/register/logout + subscription init
// REQUIRES: app-state.js, helpers.js, dom.js
// ==========================================================

// ==========================================================
// AUTH HELPERS
// ==========================================================

window.ppSafeDecodeJWT = function ppSafeDecodeJWT(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch {
    return null;
  }
};

window.ppIsTokenExpired = function ppIsTokenExpired(payload) {
  if (!payload || !payload.exp) return true;
  const now = Date.now() / 1000;
  return payload.exp < now;
};

window.ppIsLoggedIn = function ppIsLoggedIn() {
  return !!window.ppAuthState.token;
};

window.ppIsFreeRole = function ppIsFreeRole() {
  return (window.ppAuthState.role || "free") === "free";
};

window.ppCanAccessProtectedApp = function ppCanAccessProtectedApp() {
  return window.ppIsLoggedIn();
};

// ==========================================================
// AUTH UI MODE HELPERS
// ==========================================================

window.ppSetAuthMode = function ppSetAuthMode(mode) {
  window.ppAuthMode = mode === "register" ? "register" : "login";

  if (window.DOM.authModalTitle) {
    window.DOM.authModalTitle.textContent =
      window.ppAuthMode === "register" ? "Create Account" : "Login";
  }

  if (window.DOM.switchAuthMode) {
    window.DOM.switchAuthMode.textContent =
      window.ppAuthMode === "register"
        ? "Already have an account? Login"
        : "Don't have an account? Register";
  }

  if (window.DOM.authMessage) {
    window.DOM.authMessage.textContent = "";
  }
};

window.ppOpenAuthModal = function ppOpenAuthModal(mode = "login") {
  if (!window.DOM.authModal) return;

  window.ppSetAuthMode(mode);
  window.DOM.authModal.classList.remove("hidden");
  window.DOM.authModal.style.display = "flex";

  if (window.DOM.authEmail) window.DOM.authEmail.focus();
};

window.ppCloseAuthModal = function ppCloseAuthModal() {
  if (!window.DOM.authModal) return;

  window.DOM.authModal.classList.add("hidden");
  window.DOM.authModal.style.display = "none";

  if (window.DOM.authMessage) window.DOM.authMessage.textContent = "";
  if (window.DOM.authForm) window.DOM.authForm.reset();
};

window.ppOpenSubscriptionModal = function ppOpenSubscriptionModal() {
  if (!window.DOM.subscriptionModal) return;
  window.DOM.subscriptionModal.classList.remove("hidden");
  window.DOM.subscriptionModal.style.display = "flex";
};

window.ppCloseSubscriptionModal = function ppCloseSubscriptionModal() {
  if (!window.DOM.subscriptionModal) return;
  window.DOM.subscriptionModal.classList.add("hidden");
  window.DOM.subscriptionModal.style.display = "none";
  if (window.DOM.subscriptionMessage) window.DOM.subscriptionMessage.textContent = "";
};

window.ppShowAuthMessage = function ppShowAuthMessage(message, isError = false) {
  if (!window.DOM.authMessage) return;
  window.DOM.authMessage.textContent = message;
  window.DOM.authMessage.style.color = isError ? "#ff6b6b" : "";
};

window.ppShowSubscriptionMessage = function ppShowSubscriptionMessage(message, isError = false) {
  if (!window.DOM.subscriptionMessage) return;
  window.DOM.subscriptionMessage.textContent = message;
  window.DOM.subscriptionMessage.style.color = isError ? "#ff6b6b" : "";
};

// ==========================================================
// AUTH ROLE + VISIBILITY MANAGEMENT
// ==========================================================

window.ppApplyRole = function ppApplyRole(role) {
  window.ppAuthState.role = role || "free";
  window.ppUpdateRoleBadge();
  window.ppUpdateEliteAccess();
  window.ppSyncProtectedUI();
};

window.ppUpdateRoleBadge = function ppUpdateRoleBadge() {
  if (!window.DOM.userRoleBadge) return;

  const role = (window.ppAuthState.role || "free").toLowerCase();
  window.DOM.userRoleBadge.textContent = role.toUpperCase();

  window.DOM.userRoleBadge.classList.remove("role-free", "role-pro", "role-vvip");

  if (role === "pro") {
    window.DOM.userRoleBadge.classList.add("role-pro");
  } else if (role === "vvip") {
    window.DOM.userRoleBadge.classList.add("role-vvip");
  } else {
    window.DOM.userRoleBadge.classList.add("role-free");
  }
};

window.ppUpdateEliteAccess = function ppUpdateEliteAccess() {
  if (!window.DOM.eliteToggle) return;

  if (!window.ppIsLoggedIn()) {
    window.DOM.eliteToggle.checked = false;
    window.DOM.eliteToggle.disabled = true;
    return;
  }

  if (window.ppIsFreeRole()) {
    window.DOM.eliteToggle.checked = false;
    window.DOM.eliteToggle.disabled = true;
  } else {
    window.DOM.eliteToggle.disabled = false;
  }
};

window.ppRenderLockedContent = function ppRenderLockedContent() {
  window.setHTML(
    window.DOM.topPicksContainer,
    `<div class="placeholder">Login or register to view top picks and matches.</div>`
  );

  window.setHTML(
    window.DOM.marketOptionsContainer,
    `<div class="placeholder">Login or register to view betting market options.</div>`
  );

  window.setHTML(
    window.DOM.teamAnalysisContainer,
    `<div class="placeholder">Login or register to view team analysis.</div>`
  );

  if (window.DOM.accumulatorContainer) {
    window.DOM.accumulatorContainer.innerHTML =
      `<p class="builder-empty">Login or register to use the accumulator.</p>`;
  }

  if (typeof window.updateMetrics === "function") {
    window.updateMetrics(0);
  }
};

window.ppSyncProtectedUI = function ppSyncProtectedUI() {
  const loggedIn = window.ppCanAccessProtectedApp();

  // Header buttons
  if (loggedIn) {
    window.hideEl(window.DOM.loginBtn);
    window.hideEl(window.DOM.registerBtn);
    window.showEl(window.DOM.logoutBtn, "inline-flex");
    window.showEl(window.DOM.upgradeBtn, "inline-flex");
  } else {
    window.showEl(window.DOM.loginBtn, "inline-flex");
    window.showEl(window.DOM.registerBtn, "inline-flex");
    window.hideEl(window.DOM.logoutBtn);
    window.hideEl(window.DOM.upgradeBtn);
  }

  // Guest landing and app shell
  if (loggedIn) {
    window.hideEl(window.DOM.guestLanding);
    window.hideEl(window.DOM.lockedNotice);
    window.showEl(window.DOM.protectedApp, "block");
    window.setText(window.DOM.dashboardAccessBadge, window.ppAuthState.role.toUpperCase());
  } else {
    window.showEl(window.DOM.guestLanding, "block");
    window.showEl(window.DOM.lockedNotice, "block");
    window.hideEl(window.DOM.protectedApp);
    window.setText(window.DOM.dashboardAccessBadge, "Protected");
    window.ppRenderLockedContent();
  }
};

window.ppClearProtectedState = function ppClearProtectedState() {
  window.topPicksData = [];
  window.accumulatorSelections = [];
  window.smartBuilderSelections = [];
  window.performanceLogCache = [];

  window.ppRenderLockedContent();

  if (window.DOM.performanceLogContainer) {
    window.DOM.performanceLogContainer.innerHTML =
      `<p class="builder-empty">Login required.</p>`;
  }

  if (window.DOM.perfTotal) window.DOM.perfTotal.textContent = "0";
  if (window.DOM.perfSettled) window.DOM.perfSettled.textContent = "0";
  if (window.DOM.perfWins) window.DOM.perfWins.textContent = "0";
  if (window.DOM.perfLosses) window.DOM.perfLosses.textContent = "0";
  if (window.DOM.perfWinRate) window.DOM.perfWinRate.textContent = "0%";
  if (window.DOM.perfROI) window.DOM.perfROI.textContent = "0%";

  if (typeof window.updateSmartStatus === "function") {
    window.updateSmartStatus("");
  }
};

// ==========================================================
// AUTH INITIALIZATION
// ==========================================================

window.ppInitAuth = function ppInitAuth() {
  if (window.ppAuthState.initialized) return;

  const token = localStorage.getItem(window.PP_AUTH_STORAGE_KEY);

  if (!token) {
    window.ppAuthState.token = null;
    window.ppAuthState.payload = null;
    window.ppApplyRole("free");
    window.ppAuthState.initialized = true;
    return;
  }

  const payload = window.ppSafeDecodeJWT(token);

  if (!payload || window.ppIsTokenExpired(payload)) {
    localStorage.removeItem(window.PP_AUTH_STORAGE_KEY);
    window.ppAuthState.token = null;
    window.ppAuthState.payload = null;
    window.ppApplyRole("free");
    window.ppAuthState.initialized = true;
    return;
  }

  window.ppAuthState.token = token;
  window.ppAuthState.payload = payload;
  window.ppApplyRole(payload.role || "free");
  window.ppAuthState.initialized = true;
};

// ==========================================================
// LOGIN / REGISTER / LOGOUT
// ==========================================================

window.ppLogin = async function ppLogin(email, password) {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();

  if (!res.ok) throw new Error(data.message || "Login failed");

  localStorage.setItem(window.PP_AUTH_STORAGE_KEY, data.token);

  window.ppAuthState.initialized = false;
  window.ppInitAuth();
};

window.ppRegister = async function ppRegister(email, password) {
  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();

  if (!res.ok) throw new Error(data.message || "Register failed");

  localStorage.setItem(window.PP_AUTH_STORAGE_KEY, data.token);

  window.ppAuthState.initialized = false;
  window.ppInitAuth();
};

window.ppLogout = function ppLogout() {
  localStorage.removeItem(window.PP_AUTH_STORAGE_KEY);

  window.ppAuthState.token = null;
  window.ppAuthState.payload = null;

  window.ppApplyRole("free");
  window.ppClearProtectedState();
};

// ==========================================================
// PAYSTACK
// ==========================================================

window.ppStartSubscription = async function ppStartSubscription(plan) {
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
};

// ==========================================================
// AUTH UI EVENTS
// ==========================================================

window.ppBindAuthUI = function ppBindAuthUI() {

  // Header buttons
  if (window.DOM.loginBtn) {
    window.DOM.loginBtn.addEventListener("click", () => {
      window.ppOpenAuthModal("login");
    });
  }

  if (window.DOM.registerBtn) {
    window.DOM.registerBtn.addEventListener("click", () => {
      window.ppOpenAuthModal("register");
    });
  }

  // Hero buttons
  if (window.DOM.heroLoginBtn) {
    window.DOM.heroLoginBtn.addEventListener("click", () => {
      window.ppOpenAuthModal("login");
    });
  }

  if (window.DOM.heroRegisterBtn) {
    window.DOM.heroRegisterBtn.addEventListener("click", () => {
      window.ppOpenAuthModal("register");
    });
  }

  // Logout
  if (window.DOM.logoutBtn) {
    window.DOM.logoutBtn.addEventListener("click", () => {
      window.ppLogout();
      if (typeof window.ppReinitializeAppAfterAuth === "function") {
        window.ppReinitializeAppAfterAuth();
      }
    });
  }

  // Upgrade
  if (window.DOM.upgradeBtn) {
    window.DOM.upgradeBtn.addEventListener("click", () => {
      window.ppOpenSubscriptionModal();
    });
  }

  // Close modals
  if (window.DOM.closeAuthModal) {
    window.DOM.closeAuthModal.addEventListener("click", window.ppCloseAuthModal);
  }

  if (window.DOM.closeSubscriptionModal) {
    window.DOM.closeSubscriptionModal.addEventListener("click", window.ppCloseSubscriptionModal);
  }

  // Switch login/register
  if (window.DOM.switchAuthMode) {
    window.DOM.switchAuthMode.addEventListener("click", () => {
      window.ppSetAuthMode(window.ppAuthMode === "login" ? "register" : "login");
    });
  }

  // Auth form submit
  if (window.DOM.authForm) {
    window.DOM.authForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const email = window.DOM.authEmail ? window.DOM.authEmail.value.trim() : "";
      const password = window.DOM.authPassword ? window.DOM.authPassword.value.trim() : "";

      if (!email || !password) {
        window.ppShowAuthMessage("Email and password required", true);
        return;
      }

      try {
        window.ppShowAuthMessage("Processing...");

        if (window.ppAuthMode === "login") {
          await window.ppLogin(email, password);
        } else {
          await window.ppRegister(email, password);
        }

        window.ppCloseAuthModal();

        if (typeof window.ppReinitializeAppAfterAuth === "function") {
          window.ppReinitializeAppAfterAuth();
        } else {
          // fallback
          if (typeof window.loadTopPicks === "function") window.loadTopPicks();
          if (typeof window.loadPerformanceSummary === "function") window.loadPerformanceSummary();
          if (typeof window.loadPerformanceLog === "function") window.loadPerformanceLog();
        }

      } catch (err) {
        window.ppShowAuthMessage(err.message || "Authentication failed", true);
      }
    });
  }

  // Subscription buttons
  document.querySelectorAll("[data-tier]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const tier = btn.dataset.tier;
      const interval = btn.dataset.interval;

      try {
        window.ppShowSubscriptionMessage("Initializing payment...");
        await window.ppStartSubscription({ tier, interval });
      } catch (err) {
        window.ppShowSubscriptionMessage(err.message || "Payment failed", true);
      }
    });
  });
};
