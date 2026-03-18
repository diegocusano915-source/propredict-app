require("dotenv").config();
const express = require("express");
const axios = require("axios");
const path = require("path");

/* -------------------- NEW ADDITIONS: SECURITY + AUTH + DB -------------------- */
const { Pool } = require("pg");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const helmet = require("helmet");

/* -------------------- ORIGINAL ENGINE IMPORTS (UNCHANGED) -------------------- */
const { getFootballOddsTopPicks } = require("./engines/footballOddsEngine");
const { getBasketballTopPicks } = require("./engines/basketballEngine");
const { getNFLTopPicks } = require("./engines/nflEngine");
const { getNHLTopPicks } = require("./engines/nhlEngine");
const { getRugbyLeagueTopPicks } = require("./engines/rugbyLeagueEngine");
const { getRugbyUnionTopPicks } = require("./engines/rugbyUnionEngine");
const { getMLBTopPicks } = require("./engines/mlbEngine");
const { getTennisTopPicks } = require("./engines/tennisEngine");
const { getDartsTopPicks } = require("./engines/dartsEngine");
const { getTableTennisTopPicks } = require("./engines/tableTennisEngine");
const { calculateAccumulator, generateSmartAccumulator } = require("./services/accumulatorEngine");
const {
  recordPick,
  updatePickResult,
  getPerformanceSummary,
  getPerformanceLog
} = require("./services/performanceEngine");

/* -------------------- EXPRESS INIT -------------------- */
const app = express();
const PORT = process.env.PORT || 3000;

/* -------------------- SECURITY MIDDLEWARE (NEW) -------------------- */
app.use(helmet());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/* -------------------- DATABASE CONNECTION (NEW) -------------------- */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

/* -------------------- INITIALIZE USERS TABLE (NEW) -------------------- */
async function initializeAuthTables() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'free',
        stripe_customer_id TEXT,
        subscription_status TEXT DEFAULT 'inactive',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log("✅ Users table ready");
  } catch (err) {
    console.error("❌ Users table error:", err.message);
  }
}

/* -------------------- JWT SECRET -------------------- */
const JWT_SECRET = process.env.JWT_SECRET || "SUPER_SECRET_FALLBACK";

/* -------------------- AUTH MIDDLEWARE (NEW) -------------------- */
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.status(401).json({ error: "Unauthorized" });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Forbidden" });
    req.user = user;
    next();
  });
}

/* -------------------- ROLE CHECK MIDDLEWARE (NEW) -------------------- */
function requirePro(req, res, next) {
  if (req.user.role !== "pro" && req.user.role !== "vvip") {
    return res.status(403).json({ error: "Pro subscription required" });
  }
  next();
}

function requireVVIP(req, res, next) {
  if (req.user.role !== "vvip") {
    return res.status(403).json({ error: "VVIP subscription required" });
  }
  next();
}

/* --------------------------------------------------
   SAFE AXIOS WRAPPER (UNCHANGED)
-------------------------------------------------- */
async function safeRequest(config) {
  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    if (error.response && error.response.status === 429) {
      console.warn("⚠️ Rate limit hit (429)");
      return { rateLimited: true };
    }
    console.error("Request error:", error.message);
    return null;
  }
}

/* --------------------------------------------------
   TEAM ANALYSIS CACHE (UNCHANGED)
-------------------------------------------------- */
const teamAnalysisCache = {};
const TEAM_CACHE_DURATION = 10 * 60 * 1000;

/* --------------------------------------------------
   LEAGUE TEAMS (FOOTBALL ONLY - LEGACY) (UNCHANGED)
-------------------------------------------------- */
app.get("/api/league-teams/:leagueCode", async (req, res) => {
  try {
    const leagueCode = req.params.leagueCode;

    const response = await safeRequest({
      method: "GET",
      url: `https://api.football-data.org/v4/competitions/${leagueCode}/teams`,
      headers: { "X-Auth-Token": process.env.FOOTBALL_DATA_KEY }
    });

    if (!response || response.rateLimited) {
      return res.json([]);
    }

    const teams = response.teams.map(team => ({
      id: team.id,
      name: team.name
    }));

    res.json(teams);

  } catch (error) {
    console.error("League teams error:", error.message);
    res.json([]);
  }
});
/* --------------------------------------------------
   AUTH ROUTES (NEW - ADDITIVE ONLY)
-------------------------------------------------- */

/* -------------------- REGISTER -------------------- */
app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    const existing = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = {
      id: uuidv4(),
      email,
      password_hash: hashedPassword,
      role: "free",
      subscription_status: "inactive"
    };

    await pool.query(
      `INSERT INTO users (id, email, password_hash, role, subscription_status)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        newUser.id,
        newUser.email,
        newUser.password_hash,
        newUser.role,
        newUser.subscription_status
      ]
    );

    res.json({ message: "Registration successful" });

  } catch (error) {
    console.error("Register error:", error.message);
    res.status(500).json({ error: "Registration failed" });
  }
});

/* -------------------- LOGIN -------------------- */
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const userResult = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const user = userResult.rows[0];

    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful",
      token,
      role: user.role
    });

  } catch (error) {
    console.error("Login error:", error.message);
    res.status(500).json({ error: "Login failed" });
  }
});

/* -------------------- GET PROFILE -------------------- */
app.get("/api/auth/profile", authenticateToken, async (req, res) => {
  try {
    const userResult = await pool.query(
      "SELECT id, email, role, subscription_status, created_at FROM users WHERE id = $1",
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(userResult.rows[0]);

  } catch (error) {
    console.error("Profile error:", error.message);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

/* --------------------------------------------------
   FULL MARKET TEAM ANALYSIS (RESTORED + CACHED)
-------------------------------------------------- */
app.get("/api/team-analysis/:teamId", async (req, res) => {

  const teamId = req.params.teamId;
  const cacheKey = `team-${teamId}`;
  const now = Date.now();

  if (teamAnalysisCache[cacheKey]) {
    const age = now - teamAnalysisCache[cacheKey].timestamp;
    if (age < TEAM_CACHE_DURATION) {
      return res.json(teamAnalysisCache[cacheKey].data);
    }
  }

  try {

    const response = await safeRequest({
      method: "GET",
      url: `https://api.football-data.org/v4/teams/${teamId}/matches`,
      headers: { "X-Auth-Token": process.env.FOOTBALL_DATA_KEY },
      params: { status: "FINISHED", limit: 10 }
    });

    if (!response || response.rateLimited) {
      return res.json({});
    }

    const matches = response.matches || [];
    if (!matches.length) return res.json({});

    let totalWeight = 0;
    const weights = [1.5,1.4,1.3,1.2,1.1,1.0,0.9,0.8,0.7,0.6];

    let wins = 0, draws = 0, losses = 0;
    let over05 = 0, over15 = 0, over25 = 0, over35 = 0;
    let btts = 0;
    let cleanSheets = 0, failedToScore = 0;
    let goalsScored = 0, goalsConceded = 0;

    let fhOver05 = 0, fhOver15 = 0, fhBTTS = 0;
    let fhWins = 0, fhDraws = 0, fhLosses = 0;

    matches.forEach((match, index) => {

      const weight = weights[index] || 0.6;
      totalWeight += weight;

      if (!match.score || !match.score.fullTime) return;

      const isHome = match.homeTeam.id == teamId;

      const ftHome = match.score.fullTime.home ?? 0;
      const ftAway = match.score.fullTime.away ?? 0;

      const fhHome = match.score.halfTime?.home ?? 0;
      const fhAway = match.score.halfTime?.away ?? 0;

      const ftScored = isHome ? ftHome : ftAway;
      const ftConceded = isHome ? ftAway : ftHome;

      const fhScored = isHome ? fhHome : fhAway;
      const fhConceded = isHome ? fhAway : fhHome;

      const totalGoals = ftHome + ftAway;
      const totalFHGoals = fhHome + fhAway;

      goalsScored += ftScored * weight;
      goalsConceded += ftConceded * weight;

      if (ftScored > ftConceded) wins += weight;
      else if (ftScored === ftConceded) draws += weight;
      else losses += weight;

      if (totalGoals > 0) over05 += weight;
      if (totalGoals > 1) over15 += weight;
      if (totalGoals > 2) over25 += weight;
      if (totalGoals > 3) over35 += weight;

      if (ftHome > 0 && ftAway > 0) btts += weight;
      if (ftConceded === 0) cleanSheets += weight;
      if (ftScored === 0) failedToScore += weight;

      if (totalFHGoals > 0) fhOver05 += weight;
      if (totalFHGoals > 1) fhOver15 += weight;
      if (fhHome > 0 && fhAway > 0) fhBTTS += weight;

      if (fhScored > fhConceded) fhWins += weight;
      else if (fhScored === fhConceded) fhDraws += weight;
      else fhLosses += weight;
    });

    const result = {
      fullTime: {
        "Win %": ((wins / totalWeight) * 100).toFixed(1),
        "Draw %": ((draws / totalWeight) * 100).toFixed(1),
        "Loss %": ((losses / totalWeight) * 100).toFixed(1),
        "Over 0.5 %": ((over05 / totalWeight) * 100).toFixed(1),
        "Over 1.5 %": ((over15 / totalWeight) * 100).toFixed(1),
        "Over 2.5 %": ((over25 / totalWeight) * 100).toFixed(1),
        "Over 3.5 %": ((over35 / totalWeight) * 100).toFixed(1),
        "BTTS %": ((btts / totalWeight) * 100).toFixed(1),
        "Clean Sheet %": ((cleanSheets / totalWeight) * 100).toFixed(1),
        "Failed To Score %": ((failedToScore / totalWeight) * 100).toFixed(1),
        "Avg Goals Scored": (goalsScored / totalWeight).toFixed(2),
        "Avg Goals Conceded": (goalsConceded / totalWeight).toFixed(2)
      },
      firstHalf: {
        "FH Win %": ((fhWins / totalWeight) * 100).toFixed(1),
        "FH Draw %": ((fhDraws / totalWeight) * 100).toFixed(1),
        "FH Loss %": ((fhLosses / totalWeight) * 100).toFixed(1),
        "FH Over 0.5 %": ((fhOver05 / totalWeight) * 100).toFixed(1),
        "FH Over 1.5 %": ((fhOver15 / totalWeight) * 100).toFixed(1),
        "FH BTTS %": ((fhBTTS / totalWeight) * 100).toFixed(1)
      }
    };

    teamAnalysisCache[cacheKey] = { data: result, timestamp: now };
    res.json(result);

  } catch (error) {
    console.error("Team analysis error:", error.message);
    res.json({});
  }
});

/* --------------------------------------------------
   MULTI-SPORT TOP PICKS (UNCHANGED)
-------------------------------------------------- */
app.get("/api/top-picks/:sport/:competition", async (req, res) => {
  const { sport, competition } = req.params;

  try {

    if (sport === "football") {
      const picks = await getFootballOddsTopPicks(competition);
      return res.json({ sport, competition, topPicks: picks });
    }

    if (sport === "basketball") {
      const picks = await getBasketballTopPicks(competition);
      return res.json({ sport, competition, topPicks: picks });
    }

    if (sport === "nfl") {
      const picks = await getNFLTopPicks(competition);
      return res.json({ sport, competition, topPicks: picks });
    }

    if (sport === "nhl") {
      const picks = await getNHLTopPicks(competition);
      return res.json({ sport, competition, topPicks: picks });
    }

    if (sport === "rugbyleague") {
      const picks = await getRugbyLeagueTopPicks(competition);
      return res.json({ sport, competition, topPicks: picks });
    }

    if (sport === "rugbyunion") {
      const picks = await getRugbyUnionTopPicks(competition);
      return res.json({ sport, competition, topPicks: picks });
    }

    if (sport === "mlb") {
      const picks = await getMLBTopPicks(competition);
      return res.json({ sport, competition, topPicks: picks });
    }

    if (sport === "tennis") {
      const picks = await getTennisTopPicks(competition);
      return res.json({ sport, competition, topPicks: picks });
    }

    if (sport === "darts") {
      const picks = await getDartsTopPicks(competition);
      return res.json({ sport, competition, topPicks: picks });
    }

    if (sport === "tabletennis") {
      const picks = await getTableTennisTopPicks(competition);
      return res.json({ sport, competition, topPicks: picks });
    }

    return res.status(400).json({ error: "Unsupported sport" });

  } catch (error) {
    console.error("Multi-sport error:", error.message);
    res.json({ sport, competition, topPicks: [] });
  }
});
/* --------------------------------------------------
   ELITE PICKS (PROTECTED - ADDITIVE WRAP ONLY)
-------------------------------------------------- */
app.get("/api/elite/:sport/:competition", authenticateToken, requirePro, async (req, res) => {

  const { sport, competition } = req.params;

  try {

    let picks;

    if (sport === "football") picks = await getFootballOddsTopPicks(competition);
    if (sport === "basketball") picks = await getBasketballTopPicks(competition);
    if (sport === "nfl") picks = await getNFLTopPicks(competition);
    if (sport === "nhl") picks = await getNHLTopPicks(competition);
    if (sport === "rugbyleague") picks = await getRugbyLeagueTopPicks(competition);
    if (sport === "rugbyunion") picks = await getRugbyUnionTopPicks(competition);
    if (sport === "mlb") picks = await getMLBTopPicks(competition);
    if (sport === "tennis") picks = await getTennisTopPicks(competition);
    if (sport === "darts") picks = await getDartsTopPicks(competition);
    if (sport === "tabletennis") picks = await getTableTennisTopPicks(competition);

    return res.json({ sport, competition, elitePicks: picks || [] });

  } catch (error) {
    console.error("Elite route error:", error.message);
    res.json({ sport, competition, elitePicks: [] });
  }
});

/* --------------------------------------------------
   ACCUMULATOR (MANUAL) (UNCHANGED)
-------------------------------------------------- */
app.post("/api/accumulator", (req, res) => {
  try {
    const { selections } = req.body;
    const result = calculateAccumulator(selections);

    res.json({
      selectionsCount: selections ? selections.length : 0,
      combinedProbability: result.combinedProbability,
      decimalOdds: result.decimalOdds,
      riskLevel: result.riskLevel
    });
  } catch (error) {
    console.error("Accumulator error:", error.message);
    res.json({ combinedProbability: 0, decimalOdds: 0, riskLevel: "Error" });
  }
});

/* --------------------------------------------------
   SMART ACCUMULATOR (PROTECTED - ADDITIVE WRAP)
-------------------------------------------------- */
app.post("/api/accumulator/smart", authenticateToken, requirePro, async (req, res) => {
  try {

    const { sport, competition, riskProfile } = req.body;

    let markets;

    if (sport === "football") markets = await getFootballOddsTopPicks(competition);
    if (sport === "basketball") markets = await getBasketballTopPicks(competition);
    if (sport === "nfl") markets = await getNFLTopPicks(competition);
    if (sport === "nhl") markets = await getNHLTopPicks(competition);
    if (sport === "rugbyleague") markets = await getRugbyLeagueTopPicks(competition);
    if (sport === "rugbyunion") markets = await getRugbyUnionTopPicks(competition);
    if (sport === "mlb") markets = await getMLBTopPicks(competition);
    if (sport === "tennis") markets = await getTennisTopPicks(competition);

    if (!markets) {
      return res.json({
        selections: [],
        combinedProbability: 0,
        decimalOdds: 0,
        riskLevel: "No Markets"
      });
    }

    const result = generateSmartAccumulator(markets, {
      tier: riskProfile || "balanced",
      sport
    });

    res.json(result);

  } catch (error) {
    console.error("Smart accumulator error:", error.message);
    res.json({
      selections: [],
      combinedProbability: 0,
      decimalOdds: 0,
      riskLevel: "Error"
    });
  }
});

/* --------------------------------------------------
   PERFORMANCE ROUTES
-------------------------------------------------- */
app.post("/api/performance/record", (req, res) => {
  try {
    const log = recordPick(req.body);
    res.json(log);
  } catch {
    res.json({ error: "Failed to record pick" });
  }
});

app.post("/api/performance/result", (req, res) => {
  try {
    const { id, result } = req.body;
    const updated = updatePickResult(id, result);
    res.json(updated);
  } catch {
    res.json({ error: "Failed to update result" });
  }
});

app.get("/api/performance/summary", (req, res) => {
  res.json(getPerformanceSummary());
});

/* PROTECTED PERFORMANCE LOG */
app.get("/api/performance/log", authenticateToken, requirePro, (req, res) => {
  res.json(getPerformanceLog());
});

/* --------------------------------------------------
   TELEGRAM CONFIGURATION (UNCHANGED)
-------------------------------------------------- */
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

/* --------------------------------------------------
   TELEGRAM SEND FUNCTION (UNCHANGED)
-------------------------------------------------- */
async function sendTelegramMessage(text, keyboard = null) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;

  const payload = {
    chat_id: TELEGRAM_CHAT_ID,
    text: text,
    parse_mode: "Markdown"
  };

  if (keyboard) {
    payload.reply_markup = keyboard;
  }

  try {
    await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      payload
    );
  } catch (error) {
    console.error("Telegram send error:", error.message);
  }
}

/* --------------------------------------------------
   TELEGRAM WEBHOOK ROUTE (UNCHANGED)
-------------------------------------------------- */
app.post("/telegram-webhook", async (req, res) => {

  try {

    const body = req.body;

    if (body.callback_query) {
      const chatId = body.callback_query.message.chat.id;

      if (String(chatId) !== String(TELEGRAM_CHAT_ID)) {
        return res.sendStatus(200);
      }

      const data = body.callback_query.data;

      if (data === "menu_sports") {
        const keyboard = {
          inline_keyboard: [
            [
              { text: "⚽ Football", callback_data: "sport_football" },
              { text: "🏀 Basketball", callback_data: "sport_basketball" }
            ],
            [
              { text: "🏈 NFL", callback_data: "sport_nfl" },
              { text: "🎾 Tennis", callback_data: "sport_tennis" }
            ]
          ]
        };

        await sendTelegramMessage("*Select Sport:*", keyboard);
      }

      return res.sendStatus(200);
    }

    if (body.message) {
      const chatId = body.message.chat.id;

      if (String(chatId) !== String(TELEGRAM_CHAT_ID)) {
        return res.sendStatus(200);
      }

      const text = body.message.text || "";

      if (text === "/start") {
        const keyboard = {
          inline_keyboard: [
            [{ text: "Open Menu", callback_data: "menu_sports" }]
          ]
        };

        await sendTelegramMessage("*Welcome to ProPredict Bot*", keyboard);
      }

      return res.sendStatus(200);
    }

    return res.sendStatus(200);

  } catch (error) {
    console.error("Telegram webhook error:", error.message);
    return res.sendStatus(200);
  }
});

/* --------------------------------------------------
   DAILY AUTOMATIC PICKS (UNCHANGED)
-------------------------------------------------- */
function scheduleDailyTelegramPicks() {

  const SIX_HOURS = 6 * 60 * 60 * 1000;

  setInterval(async () => {

    try {

      const picks = await getFootballOddsTopPicks("PL");
      const top = picks.h2h.slice(0, 3);

      let message = `*Daily Football Picks*\n\n`;

      top.forEach(p => {
        message += `${p.market}\n${p.adjustedProbability}% (${p.confidence})\n\n`;
      });

      await sendTelegramMessage(message);

    } catch (error) {
      console.error("Daily Telegram error:", error.message);
    }

  }, SIX_HOURS);
}

scheduleDailyTelegramPicks();

/* --------------------------------------------------
   SERVER START (UPDATED ADDITIVE INIT)
-------------------------------------------------- */
initializeAuthTables().then(() => {
  app.listen(PORT, () => {
    console.log(`ProPredict Server running on port ${PORT}`);
  });
});
