require("dotenv").config();
const express = require("express");
const axios = require("axios");
const path = require("path");

/* ===========================
   PAYSTACK ADDITIONS (SAFE - ADDITIVE ONLY)
=========================== */
const crypto = require("crypto");

/* ===========================
   AUTH + DATABASE ADDITIONS
=========================== */
const { Pool } = require("pg");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const helmet = require("helmet");

/* ===========================
   SUPABASE ADDITION (NEW)
=========================== */
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/* ===========================
   ORIGINAL ENGINE IMPORTS
=========================== */
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

/* ===========================
   EXPRESS INIT
=========================== */
const app = express();
const PORT = process.env.PORT || 3000;

/* ===========================
   SECURITY MIDDLEWARE
=========================== */
app.use(helmet());

/* --------------------------------------------------
   PAYSTACK RAW BODY (WEBHOOK SAFETY - ADDITIVE)
-------------------------------------------------- */
app.use("/api/paystack/webhook", express.raw({ type: "application/json" }));

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/* ===========================
   DATABASE CONNECTION (POSTGRES)
=========================== */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

/* ===========================
   INITIALIZE USERS TABLE (POSTGRES)
=========================== */
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

    /* ==================================================
       PAYSTACK SAFE COLUMN EXTENSIONS (ADDITIVE ONLY)
    ================================================== */

    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS paystack_customer_code TEXT;
    `);

    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS paystack_subscription_code TEXT;
    `);

    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS paystack_plan_code TEXT;
    `);

    console.log("✅ Users table ready");
  } catch (err) {
    console.error("❌ Users table error:", err.message);
  }
}

/* ===========================
   PAYSTACK CONFIG (SAFE)
=========================== */
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_PUBLIC_KEY = process.env.PAYSTACK_PUBLIC_KEY;

const PAYSTACK_PRO_MONTHLY_PLAN = process.env.PAYSTACK_PRO_MONTHLY_PLAN;
const PAYSTACK_PRO_YEARLY_PLAN = process.env.PAYSTACK_PRO_YEARLY_PLAN;
const PAYSTACK_VVIP_MONTHLY_PLAN = process.env.PAYSTACK_VVIP_MONTHLY_PLAN;
const PAYSTACK_VVIP_YEARLY_PLAN = process.env.PAYSTACK_VVIP_YEARLY_PLAN;

/* ===========================
   JWT CONFIG
=========================== */
const JWT_SECRET = process.env.JWT_SECRET || "CHANGE_THIS_SECRET_IMMEDIATELY";

/* ===========================
   AUTH MIDDLEWARE
=========================== */
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

function requirePro(req, res, next) {
  if (!req.user || (req.user.role !== "pro" && req.user.role !== "vvip")) {
    return res.status(403).json({ error: "Pro subscription required" });
  }
  next();
}

/* ===========================
   AUTH ROUTES
=========================== */
app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ error: "Email and password required" });

    const existing = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (existing.rows.length > 0)
      return res.status(400).json({ error: "Email already registered" });

    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      `INSERT INTO users (id, email, password_hash, role)
       VALUES ($1, $2, $3, $4)`,
      [uuidv4(), email, hashedPassword, "free"]
    );

    res.json({ message: "Registration successful" });

  } catch (err) {
    console.error("Register error:", err.message);
    res.status(500).json({ error: "Registration failed" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0)
      return res.status(400).json({ error: "Invalid credentials" });

    const user = result.rows[0];

    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid)
      return res.status(400).json({ error: "Invalid credentials" });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token, role: user.role });

  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ error: "Login failed" });
  }
});

/* --------------------------------------------------
   SAFE AXIOS WRAPPER
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
   TEAM ANALYSIS CACHE
-------------------------------------------------- */
const teamAnalysisCache = {};
const TEAM_CACHE_DURATION = 10 * 60 * 1000;

/* --------------------------------------------------
   LEAGUE TEAMS (FOOTBALL ONLY - LEGACY)
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
   MULTI-SPORT TOP PICKS
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
   ELITE PICKS (PROTECTED)
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
   ACCUMULATOR (MANUAL)
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
   SMART ACCUMULATOR (PROTECTED)
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

/* ==================================================
   ================= PAYSTACK ROUTES =================
   ADDITIVE ONLY — DOES NOT TOUCH EXISTING LOGIC
================================================== */

/* ---------------- INITIALIZE SUBSCRIPTION ---------------- */
app.post("/api/paystack/initialize-subscription", authenticateToken, async (req, res) => {

  try {

    const { tier, interval } = req.body;

    if (!tier || !interval) {
      return res.status(400).json({ error: "Tier and interval required" });
    }

    let selectedPlan = null;

    if (tier === "pro" && interval === "monthly")
      selectedPlan = PAYSTACK_PRO_MONTHLY_PLAN;

    if (tier === "pro" && interval === "yearly")
      selectedPlan = PAYSTACK_PRO_YEARLY_PLAN;

    if (tier === "vvip" && interval === "monthly")
      selectedPlan = PAYSTACK_VVIP_MONTHLY_PLAN;

    if (tier === "vvip" && interval === "yearly")
      selectedPlan = PAYSTACK_VVIP_YEARLY_PLAN;

    if (!selectedPlan)
      return res.status(400).json({ error: "Invalid plan selection" });

    const userResult = await pool.query(
      "SELECT * FROM users WHERE id = $1",
      [req.user.id]
    );

    if (userResult.rows.length === 0)
      return res.status(404).json({ error: "User not found" });

    const user = userResult.rows[0];
    let customerCode = user.paystack_customer_code;

    if (!customerCode) {

      const customerResponse = await axios.post(
        "https://api.paystack.co/customer",
        {
          email: user.email,
          first_name: user.email.split("@")[0]
        },
        {
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
            "Content-Type": "application/json"
          }
        }
      );

      customerCode = customerResponse.data.data.customer_code;

      await pool.query(
        "UPDATE users SET paystack_customer_code = $1 WHERE id = $2",
        [customerCode, user.id]
      );
    }

    const reference = `sub_${uuidv4()}`;

    const subscriptionResponse = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email: user.email,
        plan: selectedPlan,
         amount: 0,
        reference: reference,
        metadata: {
          userId: user.id,
          tier,
          interval
        }
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    return res.json({
      authorization_url: subscriptionResponse.data.data.authorization_url,
      reference
    });

  } catch (error) {
    console.error("Paystack initialize error:", error.response?.data || error.message);
    return res.status(500).json({ error: "Failed to initialize subscription" });
  }
});

/* ---------------- VERIFY SUBSCRIPTION ---------------- */
app.get("/api/paystack/verify/:reference", authenticateToken, async (req, res) => {

  try {

    const { reference } = req.params;

    const verifyResponse = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`
        }
      }
    );

    const data = verifyResponse.data.data;

    if (data.status !== "success")
      return res.status(400).json({ error: "Payment not successful" });

    const metadata = data.metadata || {};
    const tier = metadata.tier;
    const userId = metadata.userId;
    const planCode = data.plan;

    let newRole = "free";
    if (tier === "pro") newRole = "pro";
    if (tier === "vvip") newRole = "vvip";

    await pool.query(
      `UPDATE users
       SET role = $1,
           subscription_status = 'active',
           paystack_plan_code = $2
       WHERE id = $3`,
      [newRole, planCode, userId]
    );

    return res.json({
      message: "Subscription activated",
      role: newRole
    });

  } catch (error) {
    console.error("Paystack verify error:", error.response?.data || error.message);
    return res.status(500).json({ error: "Verification failed" });
  }
});

/* ---------------- PAYSTACK WEBHOOK ---------------- */
app.post("/api/paystack/webhook", async (req, res) => {

  try {

    const hash = crypto
      .createHmac("sha512", PAYSTACK_SECRET_KEY)
      .update(req.body)
      .digest("hex");

    const signature = req.headers["x-paystack-signature"];

    if (hash !== signature)
      return res.sendStatus(401);

    const event = JSON.parse(req.body.toString());

    if (event.event === "subscription.disable") {

      const customerCode = event.data.customer?.customer_code;

      const userResult = await pool.query(
        "SELECT * FROM users WHERE paystack_customer_code = $1",
        [customerCode]
      );

      if (userResult.rows.length > 0) {
        await pool.query(
          `UPDATE users
           SET role = 'free',
               subscription_status = 'inactive',
               paystack_subscription_code = NULL
           WHERE id = $1`,
          [userResult.rows[0].id]
        );
      }
    }

    return res.sendStatus(200);

  } catch (error) {
    console.error("Webhook error:", error.message);
    return res.sendStatus(200);
  }
});

/* ==================================================
   ================= SUPABASE ROUTES =================
   NEW ADDITIONS ONLY — NOTHING REMOVED
================================================== */

/* ---------------- SUPABASE PREDICTIONS ---------------- */
app.get("/api/supabase/predictions", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("predictions")
      .select("*")
      .order("match_date", { ascending: true });

    if (error) throw error;

    res.json({ predictions: data });
  } catch (error) {
    console.error("Supabase predictions error:", error.message);
    res.json({ predictions: [] });
  }
});

/* ---------------- SUPABASE USER SUBSCRIPTIONS ---------------- */
app.get("/api/supabase/subscriptions/:userId", authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    const { data, error } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json({ subscriptions: data });
  } catch (error) {
    console.error("Supabase subscriptions error:", error.message);
    res.json({ subscriptions: [] });
  }
});

/* ---------------- SUPABASE SAVE USER PREDICTION ---------------- */
app.post("/api/supabase/user-predictions", authenticateToken, async (req, res) => {
  try {
    const { prediction_id } = req.body;
    const user_id = req.user.id;

    const { data, error } = await supabase
      .from("user_predictions")
      .insert([{ user_id, prediction_id }])
      .select();

    if (error) throw error;

    res.json({ success: true, data });
  } catch (error) {
    console.error("Supabase save prediction error:", error.message);
    res.status(500).json({ error: "Failed to save prediction" });
  }
});

/* ---------------- SUPABASE GET USER SAVED PREDICTIONS ---------------- */
app.get("/api/supabase/user-predictions/:userId", authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    const { data, error } = await supabase
      .from("user_predictions")
      .select(`
        id,
        saved_at,
        predictions (*)
      `)
      .eq("user_id", userId)
      .order("saved_at", { ascending: false });

    if (error) throw error;

    res.json({ savedPredictions: data });
  } catch (error) {
    console.error("Supabase get saved predictions error:", error.message);
    res.json({ savedPredictions: [] });
  }
});

console.log("✅ Supabase client initialized");

/* --------------------------------------------------
   SERVER START (UNCHANGED)
-------------------------------------------------- */
initializeAuthTables().then(() => {
  app.listen(PORT, () => {
    console.log(`ProPredict Server running on port ${PORT}`);
  });
});
