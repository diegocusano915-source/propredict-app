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
  
  // 🔥 Hide beast loader when modal closes
  if (typeof window.hideBeastLoader === 'function') {
    window.hideBeastLoader();
  }
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
  window.DOM.authMessage.style.color = isError ? "#ff6b6b" : "#46e6a6";
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

  // Try multiple keys for mobile compatibility
  const token = localStorage.getItem(window.PP_AUTH_STORAGE_KEY) ||
                localStorage.getItem('propredict_token') ||
                localStorage.getItem('pp_token');

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
    localStorage.removeItem('propredict_token');
    localStorage.removeItem('pp_token');
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
  const rememberMeCheckbox = document.getElementById('rememberMeCheckbox');
  const rememberMe = rememberMeCheckbox ? rememberMeCheckbox.checked : false;

  if (typeof window.showBeastLoader === 'function') {
    window.showBeastLoader('Signing you in...');
  }
  
  window.ppShowAuthMessage("🔐 Logging you in...", false);

  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, rememberMe })
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.error || "Login failed");

    const tokenKey = window.PP_AUTH_STORAGE_KEY || 'propredict_token';
    localStorage.setItem(tokenKey, data.token);
    localStorage.setItem('propredict_token', data.token);
    localStorage.setItem('pp_token', data.token);
    localStorage.setItem('token', data.token);
    
    if (data.referralCode) {
      localStorage.setItem('referralCode', data.referralCode);
    }

    window.ppAuthState.initialized = false;
    window.ppInitAuth();
    
    window.ppShowAuthMessage("✅ Login successful! Welcome back.", false);
    
    if (typeof window.hideBeastLoader === 'function') {
      window.hideBeastLoader();
    }
    
    return data;
  } catch (err) {
    if (typeof window.hideBeastLoader === 'function') {
      window.hideBeastLoader();
    }
    throw err;
  }
};

window.ppRegister = async function ppRegister(email, password) {
  const savedRef = sessionStorage.getItem('referralCode');
  const referralCode = savedRef || null;

  if (typeof window.showBeastLoader === 'function') {
    window.showBeastLoader('Creating your account...');
  }
  
  window.ppShowAuthMessage("🎉 Creating your account...", false);

  try {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, referralCode })
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.error || "Register failed");
    
    sessionStorage.removeItem('referralCode');
    
    if (data.referralCode) {
      localStorage.setItem('referralCode', data.referralCode);
    }

    window.ppShowAuthMessage("✅ Account created! Logging you in...", false);

    const loginRes = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, rememberMe: false })
    });

    const loginData = await loginRes.json();

    if (!loginRes.ok) throw new Error(loginData.error || "Auto-login failed");

    const tokenKey = window.PP_AUTH_STORAGE_KEY || 'propredict_token';
    localStorage.setItem(tokenKey, loginData.token);
    localStorage.setItem('propredict_token', loginData.token);
    localStorage.setItem('pp_token', loginData.token);
    localStorage.setItem('token', loginData.token);
    
    if (loginData.referralCode) {
      localStorage.setItem('referralCode', loginData.referralCode);
    }

    window.ppAuthState.initialized = false;
    window.ppInitAuth();
    
    window.ppShowAuthMessage("🎉 Welcome to ProPredict! Let's get started.", false);
    
    if (typeof window.hideBeastLoader === 'function') {
      window.hideBeastLoader();
    }
    
    return loginData;
  } catch (err) {
    if (typeof window.hideBeastLoader === 'function') {
      window.hideBeastLoader();
    }
    throw err;
  }
};

window.ppLogout = function ppLogout() {
  localStorage.removeItem(window.PP_AUTH_STORAGE_KEY);
  localStorage.removeItem('propredict_token');
  localStorage.removeItem('pp_token');
  localStorage.removeItem('token');

  window.ppAuthState.token = null;
  window.ppAuthState.payload = null;

  window.ppApplyRole("free");
  window.ppClearProtectedState();
};

// ==========================================================
// REFERRAL SYSTEM
// ==========================================================

window.ppGetReferralStats = async function ppGetReferralStats() {
  if (!window.ppAuthState.token) return null;
  
  try {
    const res = await fetch('/api/user/referral-stats', {
      headers: { 'Authorization': `Bearer ${window.ppAuthState.token}` }
    });
    
    if (res.ok) {
      return await res.json();
    }
    return null;
  } catch (e) {
    console.error("Referral stats error:", e);
    return null;
  }
};

window.ppApplyReferralCode = async function ppApplyReferralCode(referralCode) {
  if (!window.ppAuthState.token) {
    throw new Error("Please login first");
  }
  
  const res = await fetch('/api/user/apply-referral', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${window.ppAuthState.token}`
    },
    body: JSON.stringify({ referralCode })
  });
  
  const data = await res.json();
  
  if (!res.ok) throw new Error(data.error || "Failed to apply referral");
  
  return data;
};

// ==========================================================
// PAYSTACK — UPDATED FOR 4-TIER PREDICT PLANS
// ==========================================================

window.ppStartSubscription = async function ppStartSubscription(tier, interval) {
  try {
    if (typeof window.showBeastLoader === 'function') {
      window.showBeastLoader('Initializing secure payment...');
    }
    
    window.ppShowSubscriptionMessage("💳 Initializing secure payment...", false);
    
    const res = await fetch("/api/paystack/initialize-subscription", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${window.ppAuthState.token}`
      },
      body: JSON.stringify({ tier, interval })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Payment initialization failed");
    }

    if (data.authorization_url) {
      window.location.href = data.authorization_url;
    } else {
      throw new Error("No authorization URL received");
    }
  } catch (err) {
    console.error("Subscription error:", err);
    if (typeof window.hideBeastLoader === 'function') {
      window.hideBeastLoader();
    }
    window.ppShowSubscriptionMessage(err.message || "Payment failed. Please try again.", true);
    throw err;
  }
};

// ==========================================================
// ✅ MULTI-CURRENCY MANUAL PAYMENT (ADDED)
// ==========================================================

window.ppStartManualPayment = async function ppStartManualPayment(currency, tier, interval, amount, ngnAmount) {
  try {
    if (!window.ppIsLoggedIn()) {
      window.ppShowSubscriptionMessage("Please login first to subscribe", true);
      window.ppOpenAuthModal("login");
      return;
    }

    window.pendingManualPayment = {
      currency,
      tier,
      interval,
      amount,
      ngnAmount
    };
    
    return { success: true, message: "Manual payment flow initiated" };
    
  } catch (err) {
    console.error("Manual payment error:", err);
    throw err;
  }
};

window.ppInitializeSubscription = async function ppInitializeSubscription(tier, interval, currency = 'NGN') {
  if (currency === 'NGN') {
    return await window.ppStartSubscription(tier, interval);
  } else {
    console.log(`Manual payment requested: ${currency} ${tier} ${interval}`);
    return { success: false, message: "Manual payment flow requires UI interaction" };
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
        window.ppShowAuthMessage("❌ Email and password required", true);
        return;
      }

      try {
        const submitBtn = e.target.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;

        if (window.ppAuthMode === "login") {
          await window.ppLogin(email, password);
        } else {
          await window.ppRegister(email, password);
        }

        setTimeout(() => {
          window.ppCloseAuthModal();
          
          if (typeof window.ppReinitializeAppAfterAuth === "function") {
            window.ppReinitializeAppAfterAuth();
          } else {
            if (typeof window.loadTopPicks === "function") window.loadTopPicks();
            if (typeof window.loadPerformanceSummary === "function") window.loadPerformanceSummary();
            if (typeof window.loadPerformanceLogSafely === "function") window.loadPerformanceLogSafely();
          }
        }, 800);

      } catch (err) {
        window.ppShowAuthMessage("❌ " + (err.message || "Authentication failed"), true);
        const submitBtn = e.target.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = false;
        if (typeof window.hideBeastLoader === 'function') {
          window.hideBeastLoader();
        }
      }
    });
  }

  // Subscription buttons
  document.querySelectorAll("[data-tier]").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      
      const tier = btn.dataset.tier;
      const interval = btn.dataset.interval;
      
      const currencySelect = document.getElementById('currencySelect');
      const currentCurrency = currencySelect ? currencySelect.value : 'NGN';

      if (!window.ppIsLoggedIn()) {
        window.ppShowSubscriptionMessage("Please login first to subscribe", true);
        window.ppOpenAuthModal("login");
        return;
      }

      if (currentCurrency === 'NGN') {
        try {
          await window.ppStartSubscription(tier, interval);
        } catch (err) {
          // Error already handled
        }
      }
    });
  });
};

// ==========================================================
// ✅ INITIALIZE SUPABASE CLIENT (KEPT FOR OAUTH IF NEEDED LATER)
// ==========================================================

(function initSupabase() {
  if (window.supabase) return;
  
  const SUPABASE_URL = 'https://veyydrngucgtnwqffnew.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZleXlkcm5ndWNndG53cWZmbmV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTIzNDU2NzgsImV4cCI6MjAyNzkyMTY3OH0.abcdefghijklmnopqrstuvwxyz';
  
  window.supabase = {
    auth: {
      signInWithOAuth: async ({ provider, options }) => {
        const redirectTo = options?.redirectTo || 'https://propredict-app.onrender.com/auth/callback';
        const queryParams = options?.queryParams || {};
        const params = new URLSearchParams({ provider, redirect_to: redirectTo, ...queryParams });
        window.location.href = `${SUPABASE_URL}/auth/v1/authorize?${params.toString()}`;
        return { data: {}, error: null };
      },
      getSession: async () => {
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        
        if (accessToken) {
          const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
            headers: { 'Authorization': `Bearer ${accessToken}`, 'apikey': SUPABASE_ANON_KEY }
          });
          const user = await res.json();
          
          return {
            data: { session: { access_token: accessToken, refresh_token: refreshToken, user: user } },
            error: null
          };
        }
        return { data: { session: null }, error: null };
      }
    }
  };
  
  console.log('✅ Supabase client initialized');
})();
