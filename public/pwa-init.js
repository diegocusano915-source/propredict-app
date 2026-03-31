// ==========================================================
// PRO PREDICT — PWA INIT (SAFE ADD-ON)
// UPDATED: Always-visible Install button + real prompt when available
// DOES NOT TOUCH CORE APP LOGIC
// ==========================================================

(function () {

  console.log("🚀 PWA Init Loaded (Always-Visible Install Button)");

  // ----------------------------------------------------------
  // Service Worker registration
  // ----------------------------------------------------------
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/service-worker.js")
        .then((reg) => {
          console.log("✅ Service Worker registered:", reg.scope);
        })
        .catch((err) => {
          console.log("❌ Service Worker failed:", err);
        });
    });
  }

  // ----------------------------------------------------------
  // Install prompt handling
  // ----------------------------------------------------------
  let deferredPrompt = null;

  function isStandaloneMode() {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true
    );
  }

  function ensureInstallButton() {
    if (document.getElementById("ppInstallBtn")) return;

    const btn = document.createElement("button");
    btn.id = "ppInstallBtn";
    btn.type = "button";
    btn.textContent = "Install App";

    // Show always by default (unless already installed)
    btn.style.display = isStandaloneMode() ? "none" : "inline-flex";
    btn.style.alignItems = "center";
    btn.style.justifyContent = "center";

    // Styling
    btn.style.background = "linear-gradient(135deg, #00ffa6, #00c2ff)";
    btn.style.color = "#001018";
    btn.style.fontWeight = "700";
    btn.style.border = "none";
    btn.style.borderRadius = "12px";
    btn.style.padding = "10px 14px";
    btn.style.cursor = "pointer";
    btn.style.boxShadow = "0 0 12px rgba(0,255,200,0.35)";
    btn.style.transition = "all 0.25s ease";
    btn.style.whiteSpace = "nowrap";

    btn.addEventListener("mouseenter", () => {
      btn.style.transform = "scale(1.03)";
      btn.style.boxShadow = "0 0 18px rgba(0,255,200,0.55)";
    });

    btn.addEventListener("mouseleave", () => {
      btn.style.transform = "scale(1)";
      btn.style.boxShadow = "0 0 12px rgba(0,255,200,0.35)";
    });

    btn.addEventListener("click", async () => {
      // If already installed, hide
      if (isStandaloneMode()) {
        btn.style.display = "none";
        return;
      }

      // If Chrome has provided the install prompt, use it
      if (deferredPrompt) {
        try {
          deferredPrompt.prompt();
          const choiceResult = await deferredPrompt.userChoice;
          console.log("📲 Install choice:", choiceResult);

          deferredPrompt = null;

          // If installed, appinstalled will hide it too
        } catch (err) {
          console.log("❌ Install prompt failed:", err);
          alert("Install prompt failed. Try again from the browser menu.");
        }
        return;
      }

      // If prompt not available, guide user
      alert(
        "Install is not available yet on this device/browser.\n\n" +
        "Try: Chrome menu (⋮) → 'Install app' or 'Add to Home screen'."
      );
    });

    // Place into header auth-controls area (best spot)
    const authControls = document.querySelector(".auth-controls");
    const headerRight = document.querySelector(".header-right");

    if (authControls) {
      authControls.insertBefore(btn, authControls.firstChild);
    } else if (headerRight) {
      headerRight.appendChild(btn);
    } else {
      document.body.appendChild(btn);
      btn.style.position = "fixed";
      btn.style.right = "16px";
      btn.style.bottom = "16px";
      btn.style.zIndex = "9999";
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    ensureInstallButton();
  });

  // Capture Chrome install prompt
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    console.log("💡 beforeinstallprompt captured — install prompt available");
  });

  // After install, hide button
  window.addEventListener("appinstalled", () => {
    console.log("✅ App installed");
    deferredPrompt = null;

    const btn = document.getElementById("ppInstallBtn");
    if (btn) btn.style.display = "none";
  });

})();
