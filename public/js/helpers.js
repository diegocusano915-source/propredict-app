// ==========================================================
// ProPredict — Multi-Sport Probability Intelligence Dashboard
// SPLIT BUILD — /public/js/helpers.js
// PURPOSE: Basic + UI helper utilities (no side effects)
// SAFE: No event binding, no fetch calls
// ==========================================================

// ==========================================================
// BASIC HELPERS
// ==========================================================

window.getEl = function getEl(...ids) {
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) return el;
  }
  return null;
};

window.showEl = function showEl(el, display = "") {
  if (!el) return;
  el.style.display = display;
  el.classList.remove("hidden");
};

window.hideEl = function hideEl(el) {
  if (!el) return;
  el.style.display = "none";
  el.classList.add("hidden");
};

window.setHTML = function setHTML(el, html) {
  if (!el) return;
  el.innerHTML = html;
};

window.setText = function setText(el, text) {
  if (!el) return;
  el.textContent = text;
};

window.clearEl = function clearEl(el) {
  if (!el) return;
  el.innerHTML = "";
};

window.isElementAvailable = function isElementAvailable(el) {
  return !!el;
};

// ==========================================================
// UI HELPERS
// ==========================================================

window.getConfidenceBadgeClass = function getConfidenceBadgeClass(confidence) {
  if (!confidence) return "badge-low";

  const value = String(confidence).toLowerCase();

  if (value.includes("high")) return "badge-high";
  if (value.includes("medium")) return "badge-mid";
  return "badge-low";
};

window.toggleMatchBody = function toggleMatchBody(bodyElement, indicator) {
  if (!bodyElement) return;

  const isOpen = bodyElement.classList.contains("open");

  if (isOpen) {
    bodyElement.classList.remove("open");
    bodyElement.style.maxHeight = null;
    if (indicator) indicator.textContent = "▼";
  } else {
    bodyElement.classList.add("open");
    bodyElement.style.maxHeight = bodyElement.scrollHeight + "px";
    if (indicator) indicator.textContent = "▲";
  }
};

window.safePercent = function safePercent(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "0.0";
  return (num * 100).toFixed(1);
};

window.safeNumber = function safeNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};
