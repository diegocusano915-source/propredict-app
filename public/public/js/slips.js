// ==========================================================
// ProPredict — Saved Slips (Slip Library)
// FILE: /public/js/slips.js
// PURPOSE:
//  - Save / Load / Delete / Duplicate accumulator slips
//  - Logged-in: persist to backend (Postgres)
//  - Logged-out: fallback to localStorage
// REQUIRES: app-state.js, helpers.js, auth.js, accumulator.js
// ==========================================================

(function () {
  "use strict";

  const LS_KEY = "pp_saved_slips_v1";

  // ==========================================================
  // UTIL: SAFE JSON
  // ==========================================================

  function safeJsonParse(value, fallback) {
    try {
      if (!value) return fallback;
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  function safeJsonStringify(value, fallback = "[]") {
    try {
      return JSON.stringify(value);
    } catch {
      return fallback;
    }
  }

  function nowIso() {
    try {
      return new Date().toISOString();
    } catch {
      return "";
    }
  }

  function generateLocalId() {
    // local-only id for slips
    return "local_" + Math.random().toString(36).slice(2, 10);
  }

  // ==========================================================
  // SHAPE: Slip
  // ==========================================================
  // {
  //   id: string,
  //   name: string,
  //   sport: string,
  //   competition: string,
  //   selections: Array<{
  //     matchId, homeTeam, awayTeam, market, probability, confidence
  //   }>,
  //   createdAt: ISO string,
  //   updatedAt: ISO string,
  //   source: "local" | "server"
  // }

  function sanitizeSelections(selections) {
    if (!Array.isArray(selections)) return [];

    return selections
      .map(s => ({
        matchId: s && s.matchId ? String(s.matchId) : "",
        homeTeam: s && s.homeTeam ? String(s.homeTeam) : "",
        awayTeam: s && s.awayTeam ? String(s.awayTeam) : "",
        market: s && s.market ? String(s.market) : "",
        probability: typeof s.probability === "number"
          ? s.probability
          : parseFloat(s && s.probability) || 0,
        confidence: s && s.confidence ? String(s.confidence) : "Low"
      }))
      .filter(s => s.matchId && s.market);
  }

  function buildSlipPayload({ name, selections, sport, competition }) {
    return {
      name: (name || "").trim().slice(0, 80) || "My Slip",
      sport: sport || window.currentSport || "football",
      competition: competition || window.currentCompetition || "",
      selections: sanitizeSelections(selections),
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
  }

  // ==========================================================
  // AUTH DETECTION
  // ==========================================================

  function isLoggedIn() {
    // Keep compatible with existing auth.js conventions.
    // We avoid coupling to private variables; we just detect a token getter.
    if (typeof window.ppGetAuthToken === "function") {
      return !!window.ppGetAuthToken();
    }
    // Fallback: try common token storage names (non-breaking, optional)
    try {
      const t =
        localStorage.getItem("token") ||
        localStorage.getItem("pp_token") ||
        localStorage.getItem("authToken");
      return !!t;
    } catch {
      return false;
    }
  }

  async function authFetch(url, options = {}) {
    const headers = Object.assign({}, options.headers || {});

    if (typeof window.ppGetAuthToken === "function") {
      const token = window.ppGetAuthToken();
      if (token) headers["Authorization"] = `Bearer ${token}`;
    } else {
      // optional fallback
      try {
        const t =
          localStorage.getItem("token") ||
          localStorage.getItem("pp_token") ||
          localStorage.getItem("authToken");
        if (t) headers["Authorization"] = `Bearer ${t}`;
      } catch {}
    }

    return fetch(url, Object.assign({}, options, { headers }));
  }

  // ==========================================================
  // LOCAL STORAGE IMPLEMENTATION
  // ==========================================================

  function loadLocalSlips() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      const slips = safeJsonParse(raw, []);
      if (!Array.isArray(slips)) return [];
      return slips.map(s => ({
        id: s.id || generateLocalId(),
        name: s.name || "My Slip",
        sport: s.sport || "football",
        competition: s.competition || "",
        selections: sanitizeSelections(s.selections),
        createdAt: s.createdAt || nowIso(),
        updatedAt: s.updatedAt || nowIso(),
        source: "local"
      }));
    } catch {
      return [];
    }
  }

  function saveLocalSlips(slips) {
    try {
      localStorage.setItem(LS_KEY, safeJsonStringify(slips, "[]"));
      return true;
    } catch {
      return false;
    }
  }

  function localCreateSlip(payload) {
    const slips = loadLocalSlips();
    const slip = Object.assign({}, payload, {
      id: generateLocalId(),
      source: "local"
    });
    slips.unshift(slip);
    saveLocalSlips(slips);
    return slip;
  }

  function localDeleteSlip(id) {
    const slips = loadLocalSlips();
    const next = slips.filter(s => s.id !== id);
    saveLocalSlips(next);
    return true;
  }

  function localDuplicateSlip(id) {
    const slips = loadLocalSlips();
    const found = slips.find(s => s.id === id);
    if (!found) return null;

    const copy = Object.assign({}, found, {
      id: generateLocalId(),
      name: `${found.name} (Copy)`.slice(0, 80),
      createdAt: nowIso(),
      updatedAt: nowIso(),
      source: "local"
    });

    slips.unshift(copy);
    saveLocalSlips(slips);
    return copy;
  }

  // ==========================================================
  // SERVER IMPLEMENTATION
  // ==========================================================

  async function serverListSlips() {
    const res = await authFetch("/api/slips", { method: "GET" });
    if (!res.ok) throw new Error("Failed to load slips");
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data.map(s => ({
      id: s.id,
      name: s.name,
      sport: s.sport,
      competition: s.competition,
      selections: sanitizeSelections(s.selections),
      createdAt: s.created_at || s.createdAt || "",
      updatedAt: s.updated_at || s.updatedAt || "",
      source: "server"
    }));
  }

  async function serverCreateSlip(payload) {
    const res = await authFetch("/api/slips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error("Failed to save slip");
    const s = await res.json();
    return {
      id: s.id,
      name: s.name,
      sport: s.sport,
      competition: s.competition,
      selections: sanitizeSelections(s.selections),
      createdAt: s.created_at || s.createdAt || "",
      updatedAt: s.updated_at || s.updatedAt || "",
      source: "server"
    };
  }

  async function serverDeleteSlip(id) {
    const res = await authFetch(`/api/slips/${encodeURIComponent(id)}`, {
      method: "DELETE"
    });
    if (!res.ok) throw new Error("Failed to delete slip");
    return true;
  }

  async function serverDuplicateSlip(id) {
    const res = await authFetch(`/api/slips/${encodeURIComponent(id)}/duplicate`, {
      method: "POST"
    });
    if (!res.ok) throw new Error("Failed to duplicate slip");
    const s = await res.json();
    return {
      id: s.id,
      name: s.name,
      sport: s.sport,
      competition: s.competition,
      selections: sanitizeSelections(s.selections),
      createdAt: s.created_at || s.createdAt || "",
      updatedAt: s.updated_at || s.updatedAt || "",
      source: "server"
    };
  }

  // ==========================================================
  // PUBLIC API
  // ==========================================================

  window.ppSlips = window.ppSlips || {};

  window.ppSlips.list = async function listSlips() {
    if (isLoggedIn()) {
      try {
        return await serverListSlips();
      } catch (e) {
        console.warn("Slip list (server) failed, falling back to local:", e.message || e);
        return loadLocalSlips();
      }
    }
    return loadLocalSlips();
  };

  window.ppSlips.saveCurrent = async function saveCurrentSlip(name) {
    const selections = Array.isArray(window.accumulatorSelections)
      ? window.accumulatorSelections
      : [];

    const payload = buildSlipPayload({
      name,
      selections,
      sport: window.currentSport,
      competition: window.currentCompetition
    });

    if (!payload.selections.length) {
      return { error: "No selections to save." };
    }

    if (isLoggedIn()) {
      try {
        const created = await serverCreateSlip(payload);
        return { slip: created };
      } catch (e) {
        console.warn("Slip save (server) failed, saving locally:", e.message || e);
        const local = localCreateSlip(Object.assign({}, payload, { source: "local" }));
        return { slip: local, warning: "Saved locally (server unavailable)." };
      }
    }

    const local = localCreateSlip(Object.assign({}, payload, { source: "local" }));
    return { slip: local };
  };

  window.ppSlips.delete = async function deleteSlip(id) {
    if (!id) return { error: "Missing slip id" };

    if (isLoggedIn() && !String(id).startsWith("local_")) {
      try {
        await serverDeleteSlip(id);
        return { ok: true };
      } catch (e) {
        console.warn("Slip delete (server) failed:", e.message || e);
        // do not auto-delete local as it may not exist
        return { error: "Failed to delete slip." };
      }
    }

    localDeleteSlip(id);
    return { ok: true };
  };

  window.ppSlips.duplicate = async function duplicateSlip(id) {
    if (!id) return { error: "Missing slip id" };

    if (isLoggedIn() && !String(id).startsWith("local_")) {
      try {
        const dup = await serverDuplicateSlip(id);
        return { slip: dup };
      } catch (e) {
        console.warn("Slip duplicate (server) failed, duplicating locally:", e.message || e);
        const dupLocal = localDuplicateSlip(id);
        if (!dupLocal) return { error: "Slip not found." };
        return { slip: dupLocal, warning: "Duplicated locally (server unavailable)." };
      }
    }

    const dupLocal = localDuplicateSlip(id);
    if (!dupLocal) return { error: "Slip not found." };
    return { slip: dupLocal };
  };

  window.ppSlips.loadIntoAccumulator = async function loadIntoAccumulator(slip) {
    if (!slip || !Array.isArray(slip.selections)) return { error: "Invalid slip" };

    // Replace selections
    window.accumulatorSelections = sanitizeSelections(slip.selections);

    // Align context (best-effort, no forced changes)
    if (slip.sport && window.DOM && window.DOM.sportSelect) {
      window.currentSport = slip.sport;
      window.DOM.sportSelect.value = slip.sport;
      if (typeof window.updateCompetitionOptions === "function") {
        window.updateCompetitionOptions();
      }
    }

    if (slip.competition && window.DOM && window.DOM.competitionSelect) {
      window.currentCompetition = slip.competition;
      window.DOM.competitionSelect.value = slip.competition;
    }

    if (typeof window.renderAccumulator === "function") window.renderAccumulator();
    if (typeof window.renderTopPicks === "function") window.renderTopPicks();

    return { ok: true };
  };

  // Small helper for UI state
  window.ppSlips.canUseServer = function canUseServer() {
    return isLoggedIn();
  };
})();
