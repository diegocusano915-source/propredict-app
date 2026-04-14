// ==========================================================
// ProPredict Upgrade UI Layer (SAFE ADD-ON)
// PATCHED: does not override auth visibility logic
// PATCHED: no forced display of upgrade button
// PATCHED: uses existing subscription modal if available
// PATCHED: safe DOMContentLoaded + null guards (prevents breaking logout/login)
// ==========================================================

(function () {

  console.log("💰 Upgrade UI Loaded (Patched)");

  function $(id) {
    return document.getElementById(id);
  }

  function showEl(el, display = "flex") {
    if (!el) return;
    el.classList.remove("hidden");
    el.style.display = display;
  }

  function hideEl(el) {
    if (!el) return;
    el.classList.add("hidden");
    el.style.display = "none";
  }

  function init() {

    const upgradeBtn = $("upgradeBtn");
    if (!upgradeBtn) return;

    // ==========================================================
    // IMPORTANT:
    // Do NOT force show/hide. Core script.js controls visibility
    // based on login state and role.
    // ==========================================================

    // Style enhancement only (non-invasive)
    upgradeBtn.style.background = "linear-gradient(135deg, #00ffa6, #00c2ff)";
    upgradeBtn.style.color = "#001018";
    upgradeBtn.style.fontWeight = "600";
    upgradeBtn.style.boxShadow = "0 0 12px rgba(0,255,200,0.4)";
    upgradeBtn.style.transition = "all 0.3s ease";

    upgradeBtn.addEventListener("mouseenter", () => {
      upgradeBtn.style.transform = "scale(1.05)";
      upgradeBtn.style.boxShadow = "0 0 18px rgba(0,255,200,0.7)";
    });

    upgradeBtn.addEventListener("mouseleave", () => {
      upgradeBtn.style.transform = "scale(1)";
      upgradeBtn.style.boxShadow = "0 0 12px rgba(0,255,200,0.4)";
    });

    // ==========================================================
    // Prefer the existing subscription modal from index.html
    // ==========================================================

    const subscriptionModal = $("subscriptionModal");
    const closeSubscriptionModal = $("closeSubscriptionModal");

    // If the app already has a subscription modal, just open it safely
    if (subscriptionModal) {

      upgradeBtn.addEventListener("click", (e) => {
        // Let core app handle auth checks if it wants;
        // but ensure we don't block it. Just open modal.
        // If core already opened it, this does nothing harmful.
        setTimeout(() => {
          showEl(subscriptionModal, "flex");
        }, 0);
      });

      if (closeSubscriptionModal) {
        closeSubscriptionModal.addEventListener("click", () => {
          hideEl(subscriptionModal);
        });
      }

      // Also allow clicking on overlay to close (optional safe UX)
      subscriptionModal.addEventListener("click", (e) => {
        if (e.target === subscriptionModal) {
          hideEl(subscriptionModal);
        }
      });

      return;
    }

    // ==========================================================
    // Fallback modal (only if subscriptionModal is missing)
    // ==========================================================

    const modal = document.createElement("div");

    modal.style.position = "fixed";
    modal.style.top = "0";
    modal.style.left = "0";
    modal.style.width = "100%";
    modal.style.height = "100%";
    modal.style.background = "rgba(0,0,0,0.6)";
    modal.style.display = "none";
    modal.style.alignItems = "center";
    modal.style.justifyContent = "center";
    modal.style.zIndex = "9999";
    modal.id = "ppUpgradeFallbackModal";

    modal.innerHTML = `
      <div style="
        width:90%;
        max-width:420px;
        background:linear-gradient(145deg,#0b1220,#111827);
        border-radius:16px;
        padding:24px;
        border:1px solid rgba(255,255,255,0.08);
        box-shadow:0 0 40px rgba(0,0,0,0.6);
        text-align:center;
        color:#e5e7eb;
      ">

        <h2 style="margin-bottom:10px;">🚀 Go Pro</h2>

        <p style="font-size:14px; opacity:0.8; margin-bottom:20px;">
          Unlock real-time data, elite picks, and smart accumulators.
        </p>

        <div style="margin-bottom:18px; font-size:13px; line-height:1.6;">
          ✅ Live match predictions<br>
          ✅ Elite high-accuracy picks<br>
          ✅ Smart accumulator builder<br>
          ✅ Full performance analytics
        </div>

        <button id="ppConfirmUpgrade" style="
          width:100%;
          padding:12px;
          border:none;
          border-radius:10px;
          background:linear-gradient(135deg,#00ffa6,#00c2ff);
          color:#001018;
          font-weight:600;
          cursor:pointer;
        ">
          Upgrade Now
        </button>

        <div id="ppCloseUpgradeModal" style="
          margin-top:12px;
          font-size:12px;
          opacity:0.6;
          cursor:pointer;
        ">
          Maybe later
        </div>

      </div>
    `;

    document.body.appendChild(modal);

    upgradeBtn.addEventListener("click", () => {
      modal.style.display = "flex";
    });

    modal.addEventListener("click", (e) => {
      if (e.target && (e.target.id === "ppCloseUpgradeModal" || e.target === modal)) {
        modal.style.display = "none";
      }
    });

    const confirmBtn = document.getElementById("ppConfirmUpgrade");
    if (confirmBtn) {
      confirmBtn.addEventListener("click", () => {
        alert("🚀 Upgrade system coming next...");
      });
    }
  }

  document.addEventListener("DOMContentLoaded", init);

})();
