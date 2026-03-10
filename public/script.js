// =====================================================
// GLOBAL STATE
// =====================================================

let currentSport = null;
let currentCompetition = null;
let accumulatorSelections = [];

const API_BASE = "/api";

// =====================================================
// SPORT SELECTION
// =====================================================

document.getElementById("sportSelect").addEventListener("change", async (e) => {
    currentSport = e.target.value;
    currentCompetition = null;

    if (!currentSport) return;

    await loadCompetitions(currentSport);
});

// =====================================================
// COMPETITION SELECTION
// =====================================================

document.getElementById("competitionSelect").addEventListener("change", async (e) => {
    currentCompetition = e.target.value;

    if (!currentCompetition) return;

    await loadTopPicks();
});

// =====================================================
// LOAD COMPETITIONS PER SPORT
// =====================================================

async function loadCompetitions(sport) {
    const competitionSelect = document.getElementById("competitionSelect");
    competitionSelect.innerHTML = `<option>Loading...</option>`;

    try {
        const response = await fetch(`${API_BASE}/league-teams/${sport}`);
        const data = await response.json();

        competitionSelect.innerHTML = `<option value="">-- Choose Competition --</option>`;

        data.forEach(comp => {
            const option = document.createElement("option");
            option.value = comp.code;
            option.textContent = comp.name;
            competitionSelect.appendChild(option);
        });

    } catch (error) {
        console.error("Competition load error:", error);
        competitionSelect.innerHTML = `<option>Error loading competitions</option>`;
    }
}

// =====================================================
// LOAD TOP PICKS
// =====================================================

async function loadTopPicks() {
    if (!currentSport || !currentCompetition) return;

    const eliteEnabled = document.getElementById("eliteToggle").checked;

    const endpoint = eliteEnabled
        ? `${API_BASE}/elite/${currentSport}/${currentCompetition}`
        : `${API_BASE}/top-picks/${currentSport}/${currentCompetition}`;

    try {
        const response = await fetch(endpoint);
        const data = await response.json();
        renderPicks(data);
    } catch (error) {
        console.error("Top picks load error:", error);
    }
}

// =====================================================
// RENDER PICKS
// =====================================================

function renderPicks(picks) {
    const container = document.getElementById("picksContainer");
    container.innerHTML = "";

    if (!Array.isArray(picks) || picks.length === 0) {
        container.innerHTML = "<p>No picks available.</p>";
        return;
    }

    picks.forEach(pick => {
        const card = document.createElement("div");
        card.className = "pick-card";

        card.innerHTML = `
            <h4>${pick.match}</h4>
            <p><strong>Market:</strong> ${pick.market}</p>
            <p><strong>Odds:</strong> ${pick.odds}</p>
            <p><strong>Model Probability:</strong> ${pick.modelProbability}%</p>
            <p><strong>Confidence:</strong> ${pick.confidence}</p>
            <button class="add-button">Add</button>
        `;

        const addButton = card.querySelector(".add-button");
        addButton.addEventListener("click", () => {
            addToAccumulator(pick);
        });

        container.appendChild(card);
    });
}

// =====================================================
// ACCUMULATOR LOGIC
// =====================================================

function addToAccumulator(pick) {
    accumulatorSelections.push(pick);
    renderAccumulator();

    // ✅ PHASE 6 STEP 1: AUTO RECORD PERFORMANCE
    recordPick(pick);
}

function renderAccumulator() {
    const container = document.getElementById("accumulatorContainer");
    container.innerHTML = "";

    if (accumulatorSelections.length === 0) {
        container.innerHTML = "<p>No selections added.</p>";
        return;
    }

    accumulatorSelections.forEach((pick, index) => {
        const item = document.createElement("div");
        item.className = "acc-item";

        item.innerHTML = `
            ${pick.match} - ${pick.market} @ ${pick.odds}
            <button class="remove-button">Remove</button>
        `;

        const removeButton = item.querySelector(".remove-button");
        removeButton.addEventListener("click", () => {
            removeFromAccumulator(index);
        });

        container.appendChild(item);
    });
}

function removeFromAccumulator(index) {
    accumulatorSelections.splice(index, 1);
    renderAccumulator();
}
// =====================================================
// PERFORMANCE TRACKING INTEGRATION
// =====================================================

async function recordPick(pick) {
    try {
        await fetch(`${API_BASE}/performance/record`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                sport: currentSport,
                match: pick.match,
                market: pick.market,
                odds: pick.odds,
                confidence: pick.confidence
            })
        });

        await loadPerformanceSummary();

    } catch (error) {
        console.error("Performance record error:", error);
    }
}

// =====================================================
// LOAD PERFORMANCE SUMMARY
// =====================================================

async function loadPerformanceSummary() {
    try {
        const response = await fetch(`${API_BASE}/performance/summary`);
        const summary = await response.json();

        document.getElementById("totalPicks").textContent = summary.totalPicks;
        document.getElementById("settledPicks").textContent = summary.settledPicks;
        document.getElementById("winRate").textContent = summary.winRate + "%";
        document.getElementById("roi").textContent = summary.roi + "%";

        await loadPerformanceLog();

    } catch (error) {
        console.error("Performance summary error:", error);
    }
}

// =====================================================
// LOAD PERFORMANCE LOG
// =====================================================

async function loadPerformanceLog() {
    try {
        const response = await fetch(`${API_BASE}/performance/log`);
        const log = await response.json();

        const container = document.getElementById("performanceLog");
        container.innerHTML = "";

        if (!Array.isArray(log) || log.length === 0) {
            container.innerHTML = "<p>No recorded picks yet.</p>";
            return;
        }

        log.forEach(entry => {
            const item = document.createElement("div");
            item.className = "perf-item";

            item.innerHTML = `
                <strong>${entry.match}</strong> (${entry.market}) @ ${entry.odds}
                - Status: ${entry.status || "Pending"}
                <button class="win-button">Win</button>
                <button class="loss-button">Loss</button>
            `;

            const winButton = item.querySelector(".win-button");
            const lossButton = item.querySelector(".loss-button");

            winButton.addEventListener("click", () => {
                markResult(entry.id, "win");
            });

            lossButton.addEventListener("click", () => {
                markResult(entry.id, "loss");
            });

            container.appendChild(item);
        });

    } catch (error) {
        console.error("Performance log error:", error);
    }
}

// =====================================================
// MARK RESULT (WIN / LOSS)
// =====================================================

async function markResult(id, result) {
    try {
        await fetch(`${API_BASE}/performance/result`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                id: id,
                result: result
            })
        });

        await loadPerformanceSummary();

    } catch (error) {
        console.error("Result marking error:", error);
    }
}

// =====================================================
// INITIALIZE PERFORMANCE PANEL ON LOAD
// =====================================================

document.addEventListener("DOMContentLoaded", () => {
    loadPerformanceSummary();
});
