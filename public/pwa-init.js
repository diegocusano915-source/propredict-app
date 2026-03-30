// ==========================================================
// PRO PREDICT — PWA INIT (SAFE ADD-ON)
// DOES NOT TOUCH CORE LOGIC
// ==========================================================

(function () {

    console.log("🚀 PWA Init Loaded");

    // Register Service Worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker
                .register('/service-worker.js')
                .then(reg => {
                    console.log("✅ Service Worker registered:", reg.scope);
                })
                .catch(err => {
                    console.log("❌ Service Worker failed:", err);
                });
        });
    }

    // Install prompt handling
    let deferredPrompt;

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;

        console.log("💡 App can be installed");

        // Optional: you can later trigger install button here
        // deferredPrompt.prompt();
    });

})();
