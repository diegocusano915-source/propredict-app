// ==========================================================
// ProPredict — Stable Multi-Sport Dashboard (Full Restore)
// ==========================================================

let currentSport = "football";
let currentCompetition = "PL";
let topPicksData = [];
let accumulatorSelections = [];

// ✅ NEW — Performance log cache
let performanceLogCache = [];

// ==========================================================
// DOM REFERENCES
// ==========================================================

const DOM = {
sportSelect: document.getElementById("sportSelect"),
competitionSelect: document.getElementById("competitionSelect"),
eliteToggle: document.getElementById("eliteToggle"),

topPicksContainer: document.getElementById("topPicksContainer"),  

accumulatorContainer: document.getElementById("accumulatorSelections"),  
combinedProbability: document.getElementById("combinedProbability"),  
decimalOdds: document.getElementById("decimalOdds"),  
riskLevel: document.getElementById("riskLevel"),  
clearAccumulatorBtn: document.getElementById("clearAccumulatorBtn"),  

teamSelect: document.getElementById("teamSelect"),  
analyzeBtn: document.getElementById("analyzeBtn"),  
teamAnalysisContainer: document.getElementById("teamAnalysisContainer"),  

perfTotal: document.getElementById("perfTotal"),  
perfSettled: document.getElementById("perfSettled"),  
perfWins: document.getElementById("perfWins"),  
perfLosses: document.getElementById("perfLosses"),  
perfWinRate: document.getElementById("perfWinRate"),  
perfROI: document.getElementById("perfROI"),  

performanceLogContainer: document.getElementById("performanceLogContainer")
};

// ==========================================================
// INIT
// ==========================================================

document.addEventListener("DOMContentLoaded", () => {
bindEvents();
updateCompetitionOptions();
loadTopPicks();
loadPerformanceSummary();
loadPerformanceLog();
});

// ==========================================================
// EVENT BINDING
// ==========================================================

function bindEvents() {

DOM.sportSelect.addEventListener("change", (e) => {  
    currentSport = e.target.value;  
    updateCompetitionOptions();  
    accumulatorSelections = [];  
    renderAccumulator();  
    loadTopPicks();  
});  

DOM.competitionSelect.addEventListener("change", (e) => {  
    currentCompetition = e.target.value;  
    accumulatorSelections = [];  
    renderAccumulator();  
    loadTopPicks();  
});  

DOM.eliteToggle.addEventListener("change", () => {  
    loadTopPicks();  
});  

DOM.clearAccumulatorBtn.addEventListener("click", () => {  
    accumulatorSelections = [];  
    renderAccumulator();  
    renderTopPicks();  
});  

DOM.analyzeBtn.addEventListener("click", () => {  
    if (currentSport !== "football") return;  
    const teamId = DOM.teamSelect.value;  
    if (teamId) analyzeTeam(teamId);  
});

}

// ==========================================================
// COMPETITION OPTIONS PER SPORT
// ==========================================================

function updateCompetitionOptions() {

DOM.competitionSelect.innerHTML = "";  

if (currentSport === "football") {  
    addOption("PL", "Premier League");  
    addOption("PD", "La Liga");  
    addOption("SA", "Serie A");  
    addOption("BL1", "Bundesliga");  
    addOption("FL1", "Ligue 1");  
}  

if (currentSport === "basketball") {  
    addOption("NBA", "NBA");  
    addOption("WNBA", "WNBA");  
    addOption("NCAAB", "NCAAB");  
}  

if (currentSport === "darts") {  
    addOption("PDC", "PDC");  
}  

if (currentSport === "tabletennis") {  
    addOption("ALL", "All Events");  
}  

currentCompetition = DOM.competitionSelect.value;  

if (currentSport === "football") {  
    loadTeams(currentCompetition);  
} else {  
    DOM.teamSelect.innerHTML = `<option value="">Football Only</option>`;  
    DOM.teamAnalysisContainer.innerHTML =  
        `<p class="placeholder">Team analysis available for football only.</p>`;  
}

}

function addOption(value, text) {
const option = document.createElement("option");
option.value = value;
option.textContent = text;
DOM.competitionSelect.appendChild(option);
}

// ==========================================================
// LOAD TOP PICKS
// ==========================================================

async function loadTopPicks() {

DOM.topPicksContainer.innerHTML = "Loading projections...";  

try {  

    const route = DOM.eliteToggle.checked  
        ? `/api/elite/${currentSport}/${currentCompetition}`  
        : `/api/top-picks/${currentSport}/${currentCompetition}`;  

    const res = await fetch(route);  
    const data = await res.json();  

    const rawPicks = DOM.eliteToggle.checked  
        ? data.elitePicks  
        : data.topPicks;  

    topPicksData = normalizePicks(rawPicks);  

    renderTopPicks();  

} catch (err) {  
    DOM.topPicksContainer.innerHTML = "Failed to load fixtures.";  
}

}

// ==========================================================
// NORMALIZE PICKS (UPDATED – PRESERVE BASKETBALL GROUPING)
// ==========================================================

function normalizePicks(raw) {

if (!raw) return [];  

if (Array.isArray(raw)) {  

    return raw.map(pick => {  

        const match = pick.match || "";  
        const parts = match.split(" vs ");  

        return {  
            matchId: match,  
            homeTeam: parts[0] || "",  
            awayTeam: parts[1] || "",  
            market: "Over 2.5 Goals",  
            probability: parseFloat(pick.over25) / 100 || 0,  
            confidence: pick.confidence || "Low"  
        };  
    });  
}  

if (typeof raw === "object") {  

    // ✅ Preserve grouped markets for basketball
    if (currentSport === "basketball") {
        return raw;
    }

    const combined = [];  

    Object.keys(raw).forEach(marketKey => {  

        raw[marketKey].forEach(pick => {  

            combined.push({  
                matchId: pick.matchId,  
                homeTeam: pick.homeTeam,  
                awayTeam: pick.awayTeam,  
                market: pick.market,  
                probability:  
                    parseFloat(  
                        pick.adjustedProbability ||  
                        pick.impliedProbability ||  
                        pick.probability  
                    ) / 100,  
                confidence: pick.confidence || "Low"  
            });  

        });  

    });  

    return combined;  
}  

return [];

}
// ==========================================================
// RENDER TOP PICKS
// ==========================================================

function renderTopPicks() {

DOM.topPicksContainer.innerHTML = "";  

if (!topPicksData || (Array.isArray(topPicksData) && !topPicksData.length)) {  

    if (currentSport === "darts" || currentSport === "tabletennis") {  
        DOM.topPicksContainer.innerHTML =  
            `<p class="placeholder">  
                ℹ️ No bookmaker markets currently available for this sport.  
            </p>`;  
    } else {  
        DOM.topPicksContainer.innerHTML = "No projections available.";  
    }  

    return;  
}  

// ✅ Basketball grouped rendering with category sections
if (currentSport === "basketball") {  

    // topPicksData is grouped by backend keys:
    // h2h, spreads, totals, team_totals, player_points, player_rebounds, player_assists

    const matches = {};

    Object.keys(topPicksData).forEach(marketKey => {

        topPicksData[marketKey].forEach(pick => {

            if (!matches[pick.matchId]) {
                matches[pick.matchId] = {
                    homeTeam: pick.homeTeam,
                    awayTeam: pick.awayTeam,
                    markets: {}
                };
            }

            if (!matches[pick.matchId].markets[marketKey]) {
                matches[pick.matchId].markets[marketKey] = [];
            }

            matches[pick.matchId].markets[marketKey].push(pick);
        });
    });

    Object.keys(matches).forEach(matchId => {

        const match = matches[matchId];

        const wrapper = document.createElement("div");
        wrapper.className = "match-accordion";

        const header = document.createElement("div");
        header.className = "match-header";
        header.innerHTML = `
            <strong>${match.homeTeam} vs ${match.awayTeam}</strong>
            <span class="toggle-indicator">▼</span>
        `;

        const body = document.createElement("div");
        body.className = "match-body";
        body.style.display = "none";

        header.addEventListener("click", () => {
            const isOpen = body.style.display === "block";
            body.style.display = isOpen ? "none" : "block";
        });

        Object.keys(match.markets).forEach(marketKey => {

            const section = document.createElement("div");
            section.className = "market-section";

            const title = document.createElement("h4");
            title.textContent = marketKey.toUpperCase();
            section.appendChild(title);

            match.markets[marketKey].forEach(pick => {

                const added = accumulatorSelections.some(sel =>  
                    sel.matchId === pick.matchId &&  
                    sel.market === pick.market  
                );

                const card = document.createElement("div");
                card.className = "pick-card";

                const probabilityValue = pick.adjustedProbability
                    ? parseFloat(pick.adjustedProbability)
                    : pick.probability * 100;

                card.innerHTML = `
                    <div>${pick.market}</div>
                    <div>${probabilityValue.toFixed(1)}%</div>
                    <div>${pick.confidence}</div>
                    <button ${added ? "disabled" : ""}>
                        ${added ? "Added" : "Add"}
                    </button>
                `;

                card.querySelector("button").addEventListener("click", async () => {

                    accumulatorSelections.push({
                        matchId: pick.matchId,
                        homeTeam: pick.homeTeam,
                        awayTeam: pick.awayTeam,
                        market: pick.market,
                        probability: probabilityValue / 100,
                        confidence: pick.confidence
                    });

                    await fetch("/api/performance/record", {  
                        method: "POST",  
                        headers: { "Content-Type": "application/json" },  
                        body: JSON.stringify({  
                            sport: currentSport,  
                            matchId: pick.matchId,  
                            market: pick.market,  
                            probability: probabilityValue,  
                            confidence: pick.confidence  
                        })  
                    });  

                    renderAccumulator();  
                    renderTopPicks();  
                    loadPerformanceSummary();  
                    loadPerformanceLog();  
                });

                section.appendChild(card);
            });

            body.appendChild(section);
        });

        wrapper.appendChild(header);
        wrapper.appendChild(body);

        DOM.topPicksContainer.appendChild(wrapper);
    });

    return;
}  

// ✅ Default rendering for other sports (unchanged behavior)  
topPicksData.forEach((pick) => {  

    const added = accumulatorSelections.some(sel =>  
        sel.matchId === pick.matchId &&  
        sel.market === pick.market  
    );  

    const card = document.createElement("div");  
    card.className = "pick-card";  

    card.innerHTML = `  
        <div><strong>${pick.homeTeam} vs ${pick.awayTeam}</strong></div>  
        <div>${pick.market}</div>  
        <div>${(pick.probability * 100).toFixed(1)}%</div>  
        <div>${pick.confidence}</div>  
        <button ${added ? "disabled" : ""}>  
            ${added ? "Added" : "Add"}  
        </button>  
    `;  

    card.querySelector("button").addEventListener("click", async () => {  

        accumulatorSelections.push(pick);  

        await fetch("/api/performance/record", {  
            method: "POST",  
            headers: { "Content-Type": "application/json" },  
            body: JSON.stringify({  
                sport: currentSport,  
                matchId: pick.matchId,  
                market: pick.market,  
                probability: pick.probability * 100,  
                confidence: pick.confidence  
            })  
        });  

        renderAccumulator();  
        renderTopPicks();  
        loadPerformanceSummary();  
        loadPerformanceLog();  
    });  

    DOM.topPicksContainer.appendChild(card);  
});

}

// ==========================================================
// ACCUMULATOR
// ==========================================================

function renderAccumulator() {

DOM.accumulatorContainer.innerHTML = "";  

if (!accumulatorSelections.length) {  
    DOM.accumulatorContainer.innerHTML =  
        `<p class="builder-empty">No selections added.</p>`;  
    updateMetrics(0);  
    return;  
}  

accumulatorSelections.forEach((pick, index) => {  

    const row = document.createElement("div");  
    row.className = "builder-item";  

    row.innerHTML = `  
        <div>  
            <div>${pick.homeTeam} vs ${pick.awayTeam}</div>  
            <div>${pick.market}</div>  
            <div>${(pick.probability * 100).toFixed(1)}%</div>  
        </div>  
        <button>Remove</button>  
    `;  

    row.querySelector("button").addEventListener("click", () => {  
        accumulatorSelections.splice(index, 1);  
        renderAccumulator();  
        renderTopPicks();  
    });  

    DOM.accumulatorContainer.appendChild(row);  
});  

const combinedProbability = accumulatorSelections.reduce(  
    (acc, pick) => acc * pick.probability,  
    1  
);  

updateMetrics(combinedProbability);

}

function updateMetrics(probabilityDecimal) {

const percentage = probabilityDecimal * 100;  

DOM.combinedProbability.textContent =  
    percentage.toFixed(2) + "%";  

DOM.decimalOdds.textContent =  
    probabilityDecimal > 0  
        ? (1 / probabilityDecimal).toFixed(2)  
        : "-";  

let risk = "High";  
if (percentage >= 60) risk = "Low";  
else if (percentage >= 35) risk = "Medium";  

DOM.riskLevel.textContent =  
    probabilityDecimal ? risk : "-";

}

// ==========================================================
// PERFORMANCE SUMMARY
// ==========================================================

async function loadPerformanceSummary() {

try {  
    const res = await fetch("/api/performance/summary");  
    const data = await res.json();  

    DOM.perfTotal.textContent = data.totalPicks || 0;  
    DOM.perfSettled.textContent = data.settledPicks || 0;  
    DOM.perfWins.textContent = data.wins || 0;  
    DOM.perfLosses.textContent = data.losses || 0;  
    DOM.perfWinRate.textContent =  
        data.winRate ? data.winRate + "%" : "0%";  
    DOM.perfROI.textContent =  
        data.roi ? data.roi + "%" : "0%";  

} catch (error) {  
    console.error("Performance summary failed");  
}

}

// ==========================================================
// PERFORMANCE LOG RENDERING + RESULT CONTROLS
// ==========================================================

async function loadPerformanceLog() {

if (!DOM.performanceLogContainer) return;  

try {  
    const res = await fetch("/api/performance/log");  
    const data = await res.json();  

    performanceLogCache = data || [];  
    renderPerformanceLog();  

} catch (error) {  
    console.error("Performance log load failed");  
}

}

function renderPerformanceLog() {

if (!DOM.performanceLogContainer) return;  

DOM.performanceLogContainer.innerHTML = "";  

if (!performanceLogCache.length) {  
    DOM.performanceLogContainer.innerHTML =  
        `<p class="builder-empty">No recorded picks yet.</p>`;  
    return;  
}  

performanceLogCache.forEach(pick => {  

    const row = document.createElement("div");  
    row.className = "builder-item";  

    row.innerHTML = `  
        <div>  
            <div><strong>${pick.sport.toUpperCase()}</strong></div>  
            <div>${pick.market}</div>  
            <div>${parseFloat(pick.probability).toFixed(1)}%</div>  
            <div>Status: ${pick.status}</div>  
        </div>  
    `;  

    if (pick.status === "pending") {  

        const winBtn = document.createElement("button");  
        winBtn.textContent = "✅ Win";  

        const lossBtn = document.createElement("button");  
        lossBtn.textContent = "❌ Loss";  

        winBtn.addEventListener("click", () =>  
            updatePickResultFrontend(pick.id, "win")  
        );  

        lossBtn.addEventListener("click", () =>  
            updatePickResultFrontend(pick.id, "loss")  
        );  

        row.appendChild(winBtn);  
        row.appendChild(lossBtn);  
    }  

    DOM.performanceLogContainer.appendChild(row);  
});

}

async function updatePickResultFrontend(id, result) {

try {  

    await fetch("/api/performance/result", {  
        method: "POST",  
        headers: { "Content-Type": "application/json" },  
        body: JSON.stringify({ id, result })  
    });  

    await loadPerformanceSummary();  
    await loadPerformanceLog();  

} catch (error) {  
    console.error("Result update failed");  
}

}

// ==========================================================
// FOOTBALL TEAM ANALYSIS
// ==========================================================

async function loadTeams(league) {

DOM.teamSelect.innerHTML =  
    `<option value="">Loading teams...</option>`;  

try {  

    const res = await fetch(`/api/league-teams/${league}`);  
    const teams = await res.json();  

    DOM.teamSelect.innerHTML =  
        `<option value="">Select Team</option>`;  

    teams.forEach(team => {  
        const option = document.createElement("option");  
        option.value = team.id;  
        option.textContent = team.name;  
        DOM.teamSelect.appendChild(option);  
    });  

} catch {  
    DOM.teamSelect.innerHTML =  
        `<option value="">Select Team</option>`;  
}

}

async function analyzeTeam(teamId) {

try {  

    const res = await fetch(`/api/team-analysis/${teamId}`);  
    const data = await res.json();  

    DOM.teamAnalysisContainer.innerHTML = "";  

    Object.keys(data.fullTime || {}).forEach(key => {  

        const div = document.createElement("div");  
        div.textContent = `${key}: ${data.fullTime[key]}%`;  
        DOM.teamAnalysisContainer.appendChild(div);  
    });  

} catch {  
    DOM.teamAnalysisContainer.innerHTML =  
        `<p class="placeholder">Analysis failed.</p>`;  
}

}
