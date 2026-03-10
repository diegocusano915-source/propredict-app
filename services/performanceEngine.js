// ==========================================================
// ProPredict Performance Tracking Engine
// ==========================================================

let performanceLog = [];

/* --------------------------------------------------
   ADD PICK TO LOG
-------------------------------------------------- */
function recordPick({ sport, matchId, market, probability, confidence }) {

    performanceLog.push({
        id: generateId(),
        sport,
        matchId,
        market,
        probability: parseFloat(probability),
        confidence,
        result: null,        // null = pending
        timestamp: new Date().toISOString()
    });

    return performanceLog;
}

/* --------------------------------------------------
   UPDATE RESULT (WIN / LOSS)
-------------------------------------------------- */
function updatePickResult(id, result) {

    const pick = performanceLog.find(p => p.id === id);

    if (!pick) return null;

    pick.result = result === "win" ? "win" : "loss";

    return pick;
}

/* --------------------------------------------------
   CALCULATE PERFORMANCE SUMMARY
-------------------------------------------------- */
function getPerformanceSummary() {

    const settled = performanceLog.filter(p => p.result !== null);

    if (!settled.length) {
        return {
            totalPicks: performanceLog.length,
            settledPicks: 0,
            winRate: 0,
            averageProbability: 0,
            roi: 0
        };
    }

    const wins = settled.filter(p => p.result === "win").length;
    const losses = settled.filter(p => p.result === "loss").length;

    const winRate = (wins / settled.length) * 100;

    const averageProbability =
        settled.reduce((acc, p) => acc + p.probability, 0) / settled.length;

    // ROI Simulation (flat stake model)
    let profit = 0;

    settled.forEach(p => {
        const decimalOdds = 1 / (p.probability / 100);

        if (p.result === "win") {
            profit += decimalOdds - 1;
        } else {
            profit -= 1;
        }
    });

    const roi = (profit / settled.length) * 100;

    return {
        totalPicks: performanceLog.length,
        settledPicks: settled.length,
        wins,
        losses,
        winRate: winRate.toFixed(2),
        averageProbability: averageProbability.toFixed(2),
        roi: roi.toFixed(2)
    };
}

/* --------------------------------------------------
   GET FULL LOG
-------------------------------------------------- */
function getPerformanceLog() {
    return performanceLog;
}

/* --------------------------------------------------
   SIMPLE ID GENERATOR
-------------------------------------------------- */
function generateId() {
    return Math.random().toString(36).substring(2, 10);
}

module.exports = {
    recordPick,
    updatePickResult,
    getPerformanceSummary,
    getPerformanceLog
};
