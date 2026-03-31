// ==========================================================
// PRO PREDICT — PWA INIT (SAFE ADD-ON)
// UPDATED: Always-visible Install button with:
//  - Android/Desktop Chrome: real install prompt via beforeinstallprompt
//  - iPhone/iPad: instructs "Open in Safari" + Share → Add to Home Screen
// DOES NOT TOUCH CORE APP LOGIC
// ==========================================================

(function () {

  console.log("🚀 PWA Init Loaded (Cross-Platform Install UX)");

  // ----------------------------------------------------------
  // Service Worker registration (safe)
  // ----------------------------------------------------------
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/service-worker.js")
        .then((reg) => console.log("✅ Service Worker registered:", reg.scope))
        .catch((err) => console.log("❌ Service Worker failed:", err));
    });
  }

  // ----------------------------------------------------------
  // Install prompt handling (Chrome Android/Desktop)
  // ----------------------------------------------------------
  let deferredPrompt = null;

  function isStandaloneMode() {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true
    );
  }

  function isIOS() {
    const ua = navigator.userAgent || navigator.vendor || window.opera;
    return /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  }

  function isSafariOnIOS() {
    if (!isIOS()) return false;
    const ua = navigator.userAgent;
    // iOS Safari contains "Safari" and NOT "CriOS" (Chrome) / "FxiOS" (Firefox) / "EdgiOS" (Edge)
    return /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  }

  function getInstallButtonText() {
    if (isStandaloneMode()) return "Installed";
    if (isIOS()) return "Add to Home Screen";
    return "Install App";
  }

  function ensureInstallButton() {
    if (document.getElementById("ppInstallBtn")) return;

    const btn = document.createElement("button");
    btn.id = "ppInstallBtn";
    btn.type = "button";
    btn.textContent = getInstallButtonText();

    // Show always unless already installed
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
      // If installed, hide
      if (isStandaloneMode()) {
        btn.style.display = "none";
        return;
      }

      // iOS path: guide user (Safari only supports Add to Home Screen)
      if (isIOS()) {
        if (!isSafariOnIOS()) {
          alert(
            "iPhone/iPad install requires Safari.\n\n" +
              "1) Tap the Share button\n" +
              "2) Choose 'Open in Safari'\n" +
              "3) In Safari: Share → 'Add to Home Screen'\n\n" +
              "Note: Chrome on iPhone cannot install PWAs directly."
          );
          return;
        }

        alert(
          "To install on iPhone/iPad (Safari):\n\n" +
            "1) Tap the Share button (square with arrow up)\n" +
            "2) Tap 'Add to Home Screen'\n" +
            "3) Tap Add"
        );
        return;
      }

      // Android/Desktop Chrome path: use real prompt if available
      if (deferredPrompt) {
        try {
          deferredPrompt.prompt();
          const choiceResult = await deferredPrompt.userChoice;
          console.log("📲 Install choice:", choiceResult);
          deferredPrompt = null;
        } catch (err) {
          console.log("❌ Install prompt failed:", err);
          alert("Install prompt failed. Try again from the browser menu.");
        }
        return;
      }

      // Fallback guidance for other browsers
      alert(
        "Install is not available yet on this device/browser.\n\n" +
          "Try: browser menu → 'Install app' or 'Add to Home screen'."
      );
    });

    // Place into header auth-controls area
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

  function refreshInstallButtonLabel() {
    const btn = document.getElementById("ppInstallBtn");
    if (!btn) return;
    btn.textContent = getInstallButtonText();
    btn.style.display = isStandaloneMode() ? "none" : "inline-flex";
  }

  document.addEventListener("DOMContentLoaded", () => {
    ensureInstallButton();
    refreshInstallButtonLabel();
  });

  // Capture Chrome install prompt (Android/Desktop)
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    console.log("💡 beforeinstallprompt captured — install prompt available");
    refreshInstallButtonLabel();
  });

  // After install, hide button
  window.addEventListener("appinstalled", () => {
    console.log("✅ App installed");
    deferredPrompt = null;
    refreshInstallButtonLabel();
  });

})();
