// ==========================================================
// ProPredict Upgrade UI Layer (SAFE ADD-ON)
// DOES NOT MODIFY EXISTING LOGIC
// ==========================================================

(function () {

  console.log("💰 Upgrade UI Loaded");

  // ==========================================================
  // FIND BUTTON (FIXED TARGET)
  // ==========================================================

  const upgradeBtn = document.getElementById("upgradeBtn");

  if (!upgradeBtn) return;

  // ==========================================================
  // FORCE SHOW (TEST MODE ONLY)
// ==========================================================

  upgradeBtn.style.display = "inline-block";
  upgradeBtn.classList.remove("hidden");

  // ==========================================================
  // STYLE UPGRADE BUTTON (GLOW EFFECT)
  // ==========================================================

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
  // CREATE MODAL
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

      <button id="confirmUpgrade" style="
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

      <div id="closeModal" style="
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

  // ==========================================================
  // EVENTS
  // ==========================================================

  upgradeBtn.addEventListener("click", () => {
    modal.style.display = "flex";
  });

  modal.addEventListener("click", (e) => {
    if (e.target.id === "closeModal") {
      modal.style.display = "none";
    }
  });

  document.getElementById("confirmUpgrade").addEventListener("click", () => {
    alert("🚀 Upgrade system coming next...");
  });

})();
