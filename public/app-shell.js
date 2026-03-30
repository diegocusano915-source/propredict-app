// ==========================================================
// PRO PREDICT — APP SHELL (SAFE ADD-ON)
// DOES NOT TOUCH EXISTING LOGIC
// ==========================================================

(function () {

    console.log("📱 App Shell Loaded");

    // Detect if running as installed app (PWA)
    const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true;

    function applyAppMode() {
        if (isStandalone) {
            document.body.classList.add("app-mode");
            console.log("✅ App Mode Enabled");
        } else {
            console.log("🌐 Browser Mode");
        }
    }

    function improveMobileUX() {
        // Prevent double tap zoom
        let lastTouchEnd = 0;
        document.addEventListener('touchend', function (event) {
            const now = (new Date()).getTime();
            if (now - lastTouchEnd <= 300) {
                event.preventDefault();
            }
            lastTouchEnd = now;
        }, false);
    }

    function init() {
        applyAppMode();
        improveMobileUX();
    }

    document.addEventListener("DOMContentLoaded", init);

})();
