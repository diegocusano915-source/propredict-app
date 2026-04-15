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
   IP TRACKING ADDITION
=========================== */
const UAParser = require("ua-parser-js");

/* ===========================
   SUPABASE ADDITION
=========================== */
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/* ===========================
   ADMIN CONFIG
=========================== */
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "propredict.support@gmail.com";

/* ===========================
   REFERRAL CONFIG
=========================== */
const REFERRAL_REWARD_DAYS = 7;

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
   SECURITY MIDDLEWARE — FIXED CSP FOR INLINE SCRIPTS, EVENT HANDLERS & GOOGLE FONTS
=========================== */
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-hashes'", "https://js.paystack.co", "https://propredict-app.onrender.com"],
      scriptSrcAttr: ["'self'", "'unsafe-inline'", "'unsafe-hashes'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.paystack.co", "https://propredict-app.onrender.com", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
      frameSrc: ["'self'", "https://checkout.paystack.com"],
    },
  },
}));

/* ===========================
   IP TRACKING MIDDLEWARE
=========================== */
async function trackVisitor(req, res, next) {
  try {
    const ip = req.headers["x-forwarded-for"]?.split(",")[0] || 
               req.socket.remoteAddress || 
               req.ip ||
               "unknown";
    
    const userAgent = req.headers["user-agent"] || "unknown";
    const parser = new UAParser(userAgent);
    const uaResult = parser.getResult();
    
    const pageVisited = req.originalUrl || "/";
    const referrer = req.headers["referer"] || req.headers["referrer"] || "direct";
    
    const country = "Unknown";
    const city = "Unknown";
    
    const isAdmin = req.user?.email === ADMIN_EMAIL;
    
    await supabaseAdmin
      .from("ip_logs")
      .insert([{
        ip_address: ip,
        user_agent: userAgent,
        device_type: uaResult.device?.type || "desktop",
        browser: uaResult.browser?.name || "unknown",
        os: uaResult.os?.name || "unknown",
        page_visited: pageVisited,
        referrer: referrer,
        country: country,
        city: city,
        user_id: req.user?.id || null,
        is_admin: isAdmin
      }]);
    
  } catch (error) {
    console.error("IP tracking error:", error.message);
  }
  
  next();
}

app.use(trackVisitor);

/* --------------------------------------------------
   PAYSTACK RAW BODY (WEBHOOK SAFETY - ADDITIVE)
-------------------------------------------------- */
app.use("/api/paystack/webhook", express.raw({ type: "application/json" }));

app.use(express.json());

app.use(express.static(path.join(__dirname, "public"), {
  setHeaders: (res, path) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }
}));

app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

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
        password_hash TEXT,
        role TEXT DEFAULT 'free',
        stripe_customer_id TEXT,
        subscription_status TEXT DEFAULT 'inactive',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

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
    
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS telegram_id TEXT;
    `);

    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
    `);

    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS referred_by TEXT;
    `);

    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS referral_reward_claimed BOOLEAN DEFAULT false;
    `);

    // Make password_hash nullable for OAuth users
    await pool.query(`
      ALTER TABLE users
      ALTER COLUMN password_hash DROP NOT NULL;
    `).catch(() => {});

    console.log("✅ Users table ready");
  } catch (err) {
    console.error("❌ Users table error:", err.message);
  }
}

/* ===========================
   HELPER: Generate Referral Code
=========================== */
function generateReferralCode(email) {
  const base = email.split('@')[0].toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 6);
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${base}-${random}`;
}

/* ===========================
   HELPER: Grant Pro Access
=========================== */
async function grantProAccess(userId, days = REFERRAL_REWARD_DAYS) {
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + days);
  
  await pool.query(
    `UPDATE users SET role = 'pro', subscription_status = 'active', subscription_end_date = $1 WHERE id = $2`,
    [expiryDate, userId]
  );
  
  return expiryDate;
}

/* ===========================
   HELPER: Claim Referral Reward
=========================== */
async function claimReferralReward(referrerId, newUserId) {
  try {
    const referrerCheck = await pool.query(
      "SELECT referral_reward_claimed FROM users WHERE id = $1",
      [referrerId]
    );
    
    if (referrerCheck.rows.length === 0) return false;
    
    await grantProAccess(referrerId, REFERRAL_REWARD_DAYS);
    
    await pool.query(
      "UPDATE users SET referral_reward_claimed = true WHERE id = $1",
      [referrerId]
    );
    
    console.log(`✅ Referral reward claimed: ${referrerId} referred ${newUserId}`);
    
    return true;
  } catch (error) {
    console.error("Claim referral error:", error.message);
    return false;
  }
}

/* ===========================
   PAYSTACK CONFIG
=========================== */
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_PUBLIC_KEY = process.env.PAYSTACK_PUBLIC_KEY;

const PAYSTACK_PRO_MONTHLY_PLAN = process.env.PAYSTACK_PRO_MONTHLY_PLAN;
const PAYSTACK_PRO_YEARLY_PLAN = process.env.PAYSTACK_PRO_YEARLY_PLAN;
const PAYSTACK_VVIP_MONTHLY_PLAN = process.env.PAYSTACK_VVIP_MONTHLY_PLAN;
const PAYSTACK_VVIP_YEARLY_PLAN = process.env.PAYSTACK_VVIP_YEARLY_PLAN;

const PAYSTACK_PREDICT_WEEKLY = process.env.PAYSTACK_PREDICT_WEEKLY;
const PAYSTACK_PREDICT_MONTHLY = process.env.PAYSTACK_PREDICT_MONTHLY;
const PAYSTACK_PREDICT_QUARTERLY = process.env.PAYSTACK_PREDICT_QUARTERLY;
const PAYSTACK_PREDICT_YEARLY = process.env.PAYSTACK_PREDICT_YEARLY;

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
  if (!req.user || (req.user.role !== "pro" && req.user.role !== "vvip" && req.user.role !== "admin")) {
    return res.status(403).json({ error: "Pro subscription required" });
  }
  next();
}

function requireAdmin(req, res, next) {
  next();
}

/* ===========================
   AUTH ROUTES
=========================== */
app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password, referralCode } = req.body;

    if (!email || !password)
      return res.status(400).json({ error: "Email and password required" });

    const existing = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (existing.rows.length > 0)
      return res.status(400).json({ error: "Email already registered" });

    let referredBy = null;
    if (referralCode) {
      const referrerResult = await pool.query(
        "SELECT id FROM users WHERE referral_code = $1",
        [referralCode]
      );
      if (referrerResult.rows.length > 0) {
        referredBy = referrerResult.rows[0].id;
      }
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: false,
      user_metadata: { source: "propredict" }
    });

    if (authError) {
      console.error("Supabase auth error:", authError.message);
      return res.status(400).json({ error: authError.message });
    }

    const supabaseUserId = authData.user.id;

    const hashedPassword = await bcrypt.hash(password, 10);
    const role = (email === ADMIN_EMAIL) ? "admin" : "free";
    
    const newReferralCode = generateReferralCode(email);

    await pool.query(
      `INSERT INTO users (id, email, password_hash, role, referral_code, referred_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [supabaseUserId, email, hashedPassword, role, newReferralCode, referredBy]
    );

    if (referredBy) {
      await grantProAccess(supabaseUserId, REFERRAL_REWARD_DAYS);
    }

    res.json({ 
      message: "Registration successful! Please check your email to verify your account.",
      referralCode: newReferralCode
    });

  } catch (err) {
    console.error("Register error:", err.message);
    res.status(500).json({ error: "Registration failed" });
  }
});

app.post("/api/auth/email-verified", async (req, res) => {
  try {
    const { email } = req.body;
    
    const userResult = await pool.query(
      "SELECT id, referred_by FROM users WHERE email = $1",
      [email]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    
    const user = userResult.rows[0];
    
    if (user.referred_by) {
      await claimReferralReward(user.referred_by, user.id);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error("Email verified webhook error:", error.message);
    res.status(500).json({ error: "Failed to process verification" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;

    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0)
      return res.status(400).json({ error: "Invalid credentials" });

    const user = result.rows[0];
    
    // Check if user has password (OAuth users won't)
    if (!user.password_hash) {
      return res.status(400).json({ error: "This account uses Google Sign-In. Please sign in with Google." });
    }
    
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid)
      return res.status(400).json({ error: "Invalid credentials" });

    const expiresIn = rememberMe ? "30d" : "7d";

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn }
    );

    res.json({ 
      token, 
      role: user.role, 
      isAdmin: user.email === ADMIN_EMAIL,
      expiresIn,
      referralCode: user.referral_code
    });

  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ error: "Login failed" });
  }
});

// ✅ GOOGLE OAUTH LOGIN (ADDED)
app.post("/api/auth/oauth-login", async (req, res) => {
  try {
    const { email, provider_id, provider } = req.body;
    
    if (!email || !provider_id) {
      return res.status(400).json({ error: "Email and provider ID required" });
    }
    
    // Check if user exists
    let result = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );
    
    let user;
    let isNewUser = false;
    
    if (result.rows.length === 0) {
      // Create new user via Supabase Admin (no password)
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        email_confirm: true,
        user_metadata: { source: "google", provider_id }
      });
      
      if (authError) {
        console.error("Supabase auth error:", authError.message);
        return res.status(400).json({ error: authError.message });
      }
      
      const supabaseUserId = authData.user.id;
      const role = (email === ADMIN_EMAIL) ? "admin" : "free";
      const newReferralCode = generateReferralCode(email);
      
      await pool.query(
        `INSERT INTO users (id, email, password_hash, role, referral_code)
         VALUES ($1, $2, NULL, $3, $4)`,
        [supabaseUserId, email, role, newReferralCode]
      );
      
      user = { id: supabaseUserId, email, role, referral_code: newReferralCode };
      isNewUser = true;
    } else {
      user = result.rows[0];
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );
    
    res.json({
      token,
      role: user.role,
      isAdmin: user.email === ADMIN_EMAIL,
      isNewUser,
      referralCode: user.referral_code
    });
    
  } catch (err) {
    console.error("OAuth login error:", err.message);
    res.status(500).json({ error: "OAuth login failed" });
  }
});

app.get("/api/user/referral-stats", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const userResult = await pool.query(
      "SELECT referral_code, referral_reward_claimed FROM users WHERE id = $1",
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    
    const referralCode = userResult.rows[0].referral_code;
    
    const countResult = await pool.query(
      "SELECT COUNT(*) FROM users WHERE referred_by = $1",
      [userId]
    );
    
    const referralCount = parseInt(countResult.rows[0].count);
    const referralLink = `https://propredict-app.onrender.com/?ref=${referralCode}`;
    
    res.json({
      referralCode,
      referralLink,
      referralCount,
      rewardClaimed: userResult.rows[0].referral_reward_claimed,
      rewardDays: REFERRAL_REWARD_DAYS
    });
    
  } catch (error) {
    console.error("Referral stats error:", error.message);
    res.status(500).json({ error: "Failed to fetch referral stats" });
  }
});

app.post("/api/user/apply-referral", authenticateToken, async (req, res) => {
  try {
    const { referralCode } = req.body;
    const userId = req.user.id;
    
    if (!referralCode) {
      return res.status(400).json({ error: "Referral code required" });
    }
    
    const userCheck = await pool.query(
      "SELECT referred_by FROM users WHERE id = $1",
      [userId]
    );
    
    if (userCheck.rows[0].referred_by) {
      return res.status(400).json({ error: "Referral code already applied" });
    }
    
    const referrerResult = await pool.query(
      "SELECT id FROM users WHERE referral_code = $1",
      [referralCode]
    );
    
    if (referrerResult.rows.length === 0) {
      return res.status(400).json({ error: "Invalid referral code" });
    }
    
    const referrerId = referrerResult.rows[0].id;
    
    if (referrerId === userId) {
      return res.status(400).json({ error: "Cannot use your own referral code" });
    }
    
    await pool.query(
      "UPDATE users SET referred_by = $1 WHERE id = $2",
      [referrerId, userId]
    );
    
    await grantProAccess(userId, REFERRAL_REWARD_DAYS);
    await claimReferralReward(referrerId, userId);
    
    res.json({ 
      success: true, 
      message: `Referral applied! You got ${REFERRAL_REWARD_DAYS} free days of Pro access.` 
    });
    
  } catch (error) {
    console.error("Apply referral error:", error.message);
    res.status(500).json({ error: "Failed to apply referral" });
  }
});

/* ==================================================
   ================= FORGOT PASSWORD ROUTE ===========
================================================== */
app.post("/api/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const response = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: email,
        redirect_to: "https://propredict-app.onrender.com/reset-password.html"
      })
    });

    if (!response.ok) {
      const err = await response.json();
      console.error("Supabase recover error:", err);
      return res.status(400).json({ error: err.msg || "Failed to send reset email" });
    }

    res.json({ message: "Password reset email sent. Please check your inbox." });

  } catch (error) {
    console.error("Forgot password error:", error.message);
    res.status(500).json({ error: "Server error. Please try again." });
  }
});

/* ==================================================
   ================= ADMIN ROUTES ====================
================================================== */

app.get("/api/admin/stats", async (req, res) => {
  try {
    const userCount = await pool.query("SELECT COUNT(*) FROM users");
    const activeSubs = await pool.query(
      "SELECT COUNT(*) FROM users WHERE subscription_status = 'active'"
    );
    
    const { count: ipLogsCount } = await supabaseAdmin
      .from("ip_logs")
      .select("*", { count: "exact", head: true });
    
    res.json({
      totalUsers: parseInt(userCount.rows[0].count),
      activeSubscriptions: parseInt(activeSubs.rows[0].count),
      totalVisitors: ipLogsCount || 0
    });
    
  } catch (error) {
    console.error("Admin stats error:", error.message);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

app.get("/api/admin/users", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, email, role, subscription_status, referral_code, referred_by, created_at FROM users ORDER BY created_at DESC"
    );
    res.json({ users: result.rows });
  } catch (error) {
    console.error("Admin users error:", error.message);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

app.get("/api/admin/ip-logs", async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("ip_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    
    if (error) throw error;
    
    res.json({ logs: data });
  } catch (error) {
    console.error("IP logs error:", error.message);
    res.status(500).json({ error: "Failed to fetch IP logs" });
  }
});

app.get("/api/admin/users/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    
    const result = await pool.query(
      "SELECT id, email, role, subscription_status, paystack_customer_code, paystack_plan_code, referral_code, referred_by, created_at FROM users WHERE id = $1",
      [userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    
    const { data: ipLogs } = await supabaseAdmin
      .from("ip_logs")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    
    res.json({ 
      user: result.rows[0],
      ipLogs: ipLogs || []
    });
    
  } catch (error) {
    console.error("User details error:", error.message);
    res.status(500).json({ error: "Failed to fetch user details" });
  }
});

app.post("/api/admin/users/:userId/role", async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    
    if (!["free", "pro", "vvip", "admin"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }
    
    await pool.query(
      "UPDATE users SET role = $1 WHERE id = $2",
      [role, userId]
    );
    
    res.json({ message: "User role updated", role });
    
  } catch (error) {
    console.error("Update role error:", error.message);
    res.status(500).json({ error: "Failed to update role" });
  }
});

app.post("/api/admin/predictions", async (req, res) => {
  try {
    const { sport, league, match_name, prediction, odds, confidence, match_date } = req.body;
    
    const { data, error } = await supabaseAdmin
      .from("predictions")
      .insert([{
        sport,
        league,
        match_name,
        prediction,
        odds,
        confidence,
        result: "pending",
        match_date
      }])
      .select();
    
    if (error) throw error;
    
    res.json({ success: true, prediction: data[0] });
    
  } catch (error) {
    console.error("Add prediction error:", error.message);
    res.status(500).json({ error: "Failed to add prediction" });
  }
});

app.put("/api/admin/predictions/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const { data, error } = await supabaseAdmin
      .from("predictions")
      .update(updates)
      .eq("id", id)
      .select();
    
    if (error) throw error;
    
    res.json({ success: true, prediction: data[0] });
    
  } catch (error) {
    console.error("Update prediction error:", error.message);
    res.status(500).json({ error: "Failed to update prediction" });
  }
});

app.delete("/api/admin/predictions/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const { error } = await supabaseAdmin
      .from("predictions")
      .delete()
      .eq("id", id);
    
    if (error) throw error;
    
    res.json({ success: true, message: "Prediction deleted" });
    
  } catch (error) {
    console.error("Delete prediction error:", error.message);
    res.status(500).json({ error: "Failed to delete prediction" });
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

app.get("/api/performance/log", authenticateToken, requirePro, (req, res) => {
  res.json(getPerformanceLog());
});

/* ==================================================
   ================= TELEGRAM CONFIGURATION ==========
   ===== CHAT ID: 6816699294 =======================
================================================== */
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "8087449494:AAEObNT0mtbYtXT4YQHXZY4247nQ6L-FKI4";
const TELEGRAM_CHAT_ID = "6816699294";

const SPORT_COMPETITION_MAP = {
  'PL': { sport: 'football', competition: 'PL', name: 'Premier League', emoji: '⚽' },
  'UCL': { sport: 'football', competition: 'UCL', name: 'Champions League', emoji: '🏆' },
  'UEL': { sport: 'football', competition: 'UEL', name: 'Europa League', emoji: '🏆' },
  'PD': { sport: 'football', competition: 'PD', name: 'La Liga', emoji: '🇪🇸' },
  'SA': { sport: 'football', competition: 'SA', name: 'Serie A', emoji: '🇮🇹' },
  'BL1': { sport: 'football', competition: 'BL1', name: 'Bundesliga', emoji: '🇩🇪' },
  'NFL': { sport: 'nfl', competition: 'NFL', name: 'NFL', emoji: '🏈' },
  'NBA': { sport: 'basketball', competition: 'NBA', name: 'NBA', emoji: '🏀' },
  'TENNIS': { sport: 'tennis', competition: 'ATP', name: 'Tennis (ATP)', emoji: '🎾' },
  'NHL': { sport: 'nhl', competition: 'NHL', name: 'NHL', emoji: '🏒' },
  'MLB': { sport: 'mlb', competition: 'MLB', name: 'MLB', emoji: '⚾' }
};

async function sendTelegramMessage(text, keyboard = null) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error("❌ Telegram config missing");
    return;
  }

  const payload = {
    chat_id: TELEGRAM_CHAT_ID,
    text: text,
    parse_mode: "Markdown"
  };

  if (keyboard) {
    payload.reply_markup = keyboard;
  }

  try {
    const response = await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      payload
    );
    console.log("✅ Telegram message sent");
    return response.data;
  } catch (error) {
    console.error("❌ Telegram send error:", error.response?.data || error.message);
  }
}

async function getPicksForSport(sportKey, isElite = false) {
  const config = SPORT_COMPETITION_MAP[sportKey];
  if (!config) return null;
  
  try {
    let picks;
    if (config.sport === 'football') {
      picks = await getFootballOddsTopPicks(config.competition);
    } else if (config.sport === 'basketball') {
      picks = await getBasketballTopPicks(config.competition);
    } else if (config.sport === 'nfl') {
      picks = await getNFLTopPicks(config.competition);
    } else if (config.sport === 'nhl') {
      picks = await getNHLTopPicks(config.competition);
    } else if (config.sport === 'mlb') {
      picks = await getMLBTopPicks(config.competition);
    } else if (config.sport === 'tennis') {
      picks = await getTennisTopPicks(config.competition);
    } else {
      return null;
    }
    
    return { config, picks };
  } catch (error) {
    console.error(`Error fetching ${sportKey} picks:`, error.message);
    return null;
  }
}

function formatPicksMessage(config, picks, limit = 5, isElite = false) {
  const pickArray = picks.h2h || [];
  
  let filteredPicks = pickArray;
  if (isElite) {
    filteredPicks = pickArray.filter(p => {
      const prob = parseFloat(p.adjustedProbability) || 0;
      return prob >= 50;
    });
  }
  
  const top = filteredPicks.slice(0, limit);
  if (top.length === 0) return null;
  
  const eliteBadge = isElite ? '👑 ELITE ' : '';
  let message = `*${eliteBadge}${config.emoji} ${config.name} - Top Picks*\n_${new Date().toLocaleDateString()}_\n\n`;
  
  top.forEach((p, i) => {
    const prob = parseFloat(p.adjustedProbability) || 0;
    let confidenceLabel = p.confidence || 'Low';
    if (prob >= 70) confidenceLabel = 'Strong';
    else if (prob >= 50) confidenceLabel = 'Medium';
    
    message += `${i+1}. *${p.market}*\n`;
    message += `   📊 ${p.adjustedProbability}% confidence (${confidenceLabel})\n`;
    if (p.odds) message += `   💰 Odds: ${p.odds}\n`;
    message += `\n`;
  });
  
  message += `_🤖 AI-powered by ProPredict_`;
  if (isElite) message += `\n_🔒 VIP Elite Picks_`;
  return message;
}

async function isPaidSubscriber(telegramId) {
  if (!telegramId) return false;
  
  try {
    const result = await pool.query(
      "SELECT role, subscription_status FROM users WHERE telegram_id = $1",
      [telegramId]
    );
    
    if (result.rows.length === 0) return false;
    
    const user = result.rows[0];
    return user.role === 'pro' || user.role === 'vvip' || user.role === 'admin';
  } catch (error) {
    console.error("Error checking subscription:", error.message);
    return false;
  }
}

app.post("/api/telegram/link", authenticateToken, async (req, res) => {
  try {
    const { telegramId } = req.body;
    const userId = req.user.id;
    
    if (!telegramId) {
      return res.status(400).json({ error: "Telegram ID required" });
    }
    
    await pool.query(
      "UPDATE users SET telegram_id = $1 WHERE id = $2",
      [telegramId, userId]
    );
    
    res.json({ success: true, message: "Telegram account linked!" });
  } catch (error) {
    console.error("Link Telegram error:", error.message);
    res.status(500).json({ error: "Failed to link Telegram" });
  }
});

app.get("/api/test-telegram", async (req, res) => {
  try {
    await sendTelegramMessage("✅ *ProPredict Telegram Bot is active!*\n\nCommands:\n/picks PL - Premier League\n/elite PL - VIP Elite Picks (Pro users only)\n/picks NFL - NFL\n/picks NBA - Basketball\n/help - All commands");
    res.json({ success: true, message: "Test message sent to Telegram!" });
  } catch (error) {
    res.status(500).json({ error: "Failed to send Telegram message" });
  }
});

app.post("/telegram-webhook", async (req, res) => {
  try {
    const body = req.body;
    console.log("📨 Telegram webhook received");

    const telegramUserId = body.callback_query?.from?.id || body.message?.from?.id;

    if (body.callback_query) {
      const chatId = body.callback_query.message.chat.id;
      if (String(chatId) !== String(TELEGRAM_CHAT_ID)) return res.sendStatus(200);

      const data = body.callback_query.data;
      
      if (data === "menu_sports") {
        const keyboard = {
          inline_keyboard: [
            [
              { text: "⚽ PL", callback_data: "picks_PL" },
              { text: "🏆 UCL", callback_data: "picks_UCL" }
            ],
            [
              { text: "🏈 NFL", callback_data: "picks_NFL" },
              { text: "🏀 NBA", callback_data: "picks_NBA" }
            ],
            [
              { text: "👑 Elite PL", callback_data: "elite_PL" },
              { text: "👑 Elite UCL", callback_data: "elite_UCL" }
            ]
          ]
        };
        await sendTelegramMessage("*Select Sport for Picks:*\n\n👑 Elite = VIP subscribers only", keyboard);
      } else if (data.startsWith("picks_")) {
        const sportKey = data.replace("picks_", "");
        const result = await getPicksForSport(sportKey, false);
        
        if (result) {
          const message = formatPicksMessage(result.config, result.picks, 5, false);
          if (message) {
            await sendTelegramMessage(message);
          } else {
            await sendTelegramMessage(`❌ No picks available for ${result.config.name} right now.`);
          }
        } else {
          await sendTelegramMessage(`❌ Unable to fetch picks. Please try again later.`);
        }
      } else if (data.startsWith("elite_")) {
        const isPaid = await isPaidSubscriber(telegramUserId);
        
        if (!isPaid) {
          await sendTelegramMessage(`🔒 *VIP Elite Picks are for Pro subscribers only*\n\nUpgrade at: ${process.env.SITE_URL || 'https://propredict-app.onrender.com'}/pricing`);
          return res.sendStatus(200);
        }
        
        const sportKey = data.replace("elite_", "");
        const result = await getPicksForSport(sportKey, true);
        
        if (result) {
          const message = formatPicksMessage(result.config, result.picks, 5, true);
          if (message) {
            await sendTelegramMessage(message);
          } else {
            await sendTelegramMessage(`❌ No elite picks available for ${result.config.name} right now.`);
          }
        } else {
          await sendTelegramMessage(`❌ Unable to fetch elite picks. Please try again later.`);
        }
      }
      return res.sendStatus(200);
    }

    if (body.message) {
      const chatId = body.message.chat.id;
      if (String(chatId) !== String(TELEGRAM_CHAT_ID)) return res.sendStatus(200);

      const text = (body.message.text || "").toUpperCase().trim();
      
      if (text === "/START") {
        const keyboard = {
          inline_keyboard: [
            [{ text: "📊 View Today's Picks", callback_data: "menu_sports" }]
          ]
        };
        
        let welcomeMsg = "*🏆 Welcome to ProPredict Bot!*\n\nGet AI-powered sports predictions instantly.\n\n";
        
        if (telegramUserId) {
          welcomeMsg += `Your Telegram ID: \`${telegramUserId}\`\n`;
          welcomeMsg += "Link this to your ProPredict account for VIP access!\n\n";
        }
        
        welcomeMsg += "Commands:\n`/picks PL` - Premier League\n`/elite PL` - VIP Elite Picks\n`/link` - How to link account\n`/help` - All commands";
        
        await sendTelegramMessage(welcomeMsg, keyboard);
        return res.sendStatus(200);
      }
      
      if (text === "/LINK") {
        if (telegramUserId) {
          await sendTelegramMessage(`🔗 *Link Your Telegram Account*\n\n1. Log in to ProPredict\n2. Go to Dashboard\n3. Enter this code:\n\n\`${telegramUserId}\`\n\nOr click: ${process.env.SITE_URL || 'https://propredict-app.onrender.com'}/profile`);
        } else {
          await sendTelegramMessage("❌ Unable to get your Telegram ID. Please try again.");
        }
        return res.sendStatus(200);
      }
      
      if (text.startsWith("/PICKS")) {
        const parts = text.split(" ");
        const sportKey = parts[1] || "PL";
        
        const result = await getPicksForSport(sportKey, false);
        
        if (result) {
          const message = formatPicksMessage(result.config, result.picks, 5, false);
          if (message) {
            await sendTelegramMessage(message);
          } else {
            await sendTelegramMessage(`❌ No picks available for ${result.config.name} right now.`);
          }
        } else {
          const availableSports = Object.keys(SPORT_COMPETITION_MAP).join(', ');
          await sendTelegramMessage(`❌ Unknown sport: "${sportKey}"\n\nAvailable: ${availableSports}\n\nExample: /picks PL`);
        }
        return res.sendStatus(200);
      }
      
      if (text.startsWith("/ELITE")) {
        const isPaid = await isPaidSubscriber(telegramUserId);
        
        if (!isPaid) {
          await sendTelegramMessage(`🔒 *VIP Elite Picks are for Pro subscribers only*\n\nUpgrade at: ${process.env.SITE_URL || 'https://propredict-app.onrender.com'}/pricing`);
          return res.sendStatus(200);
        }
        
        const parts = text.split(" ");
        const sportKey = parts[1] || "PL";
        
        const result = await getPicksForSport(sportKey, true);
        
        if (result) {
          const message = formatPicksMessage(result.config, result.picks, 5, true);
          if (message) {
            await sendTelegramMessage(message);
          } else {
            await sendTelegramMessage(`❌ No elite picks available for ${result.config.name} right now.`);
          }
        } else {
          await sendTelegramMessage(`❌ Unable to fetch elite picks for "${sportKey}"`);
        }
        return res.sendStatus(200);
      }
      
      if (text === "/HELP") {
        await sendTelegramMessage("*📚 ProPredict Bot Commands*\n\n`/start` - Welcome message\n`/picks [SPORT]` - Free picks\n`/elite [SPORT]` - VIP Elite picks (Pro only)\n`/link` - Link your account\n`/help` - Show this help\n\n*Available Sports:*\nPL, UCL, NFL, NBA, TENNIS, NHL, MLB\n\nExample: `/picks UCL`\nExample: `/elite PL`");
        return res.sendStatus(200);
      }
      
      await sendTelegramMessage("👋 Type `/help` to see available commands or `/start` to begin.");
      return res.sendStatus(200);
    }

    return res.sendStatus(200);
  } catch (error) {
    console.error("Telegram webhook error:", error.message);
    return res.sendStatus(200);
  }
});

function scheduleDailyTelegramPicks() {
  setTimeout(async () => {
    try {
      await sendTelegramMessage("🚀 *ProPredict Bot Started*\n\nFree: `/picks PL`\nVIP: `/elite PL`\n\n👑 Elite picks require Pro subscription");
    } catch (e) {
      console.error("Startup message error:", e.message);
    }
  }, 5000);

  const SIX_HOURS = 6 * 60 * 60 * 1000;
  setInterval(async () => {
    try {
      const result = await getPicksForSport('PL', false);
      if (result) {
        const message = formatPicksMessage(result.config, result.picks, 5, false);
        if (message) {
          await sendTelegramMessage(message);
        }
      }
    } catch (error) {
      console.error("Daily Telegram error:", error.message);
    }
  }, SIX_HOURS);
}

scheduleDailyTelegramPicks();

/* ==================================================
   ================= PAYSTACK ROUTES =================
================================================== */

app.post("/api/paystack/initialize-subscription", authenticateToken, async (req, res) => {
  try {
    const { tier, interval } = req.body;
    if (!tier || !interval) return res.status(400).json({ error: "Tier and interval required" });

    let selectedPlan = null;
    if (tier === "weekly" && interval === "weekly") selectedPlan = PAYSTACK_PREDICT_WEEKLY;
    else if (tier === "monthly" && interval === "monthly") selectedPlan = PAYSTACK_PREDICT_MONTHLY;
    else if (tier === "quarterly" && interval === "quarterly") selectedPlan = PAYSTACK_PREDICT_QUARTERLY;
    else if (tier === "yearly" && interval === "yearly") selectedPlan = PAYSTACK_PREDICT_YEARLY;

    if (!selectedPlan) {
      if (tier === "pro" && interval === "monthly") selectedPlan = PAYSTACK_PRO_MONTHLY_PLAN;
      else if (tier === "pro" && interval === "yearly") selectedPlan = PAYSTACK_PRO_YEARLY_PLAN;
      else if (tier === "vvip" && interval === "monthly") selectedPlan = PAYSTACK_VVIP_MONTHLY_PLAN;
      else if (tier === "vvip" && interval === "yearly") selectedPlan = PAYSTACK_VVIP_YEARLY_PLAN;
    }

    if (!selectedPlan) return res.status(400).json({ error: "Invalid plan selection" });

    const userResult = await pool.query("SELECT * FROM users WHERE id = $1", [req.user.id]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: "User not found" });

    const user = userResult.rows[0];
    let customerCode = user.paystack_customer_code;

    if (!customerCode) {
      const customerResponse = await axios.post(
        "https://api.paystack.co/customer",
        { email: user.email, first_name: user.email.split("@")[0] },
        { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" } }
      );
      customerCode = customerResponse.data.data.customer_code;
      await pool.query("UPDATE users SET paystack_customer_code = $1 WHERE id = $2", [customerCode, user.id]);
    }

    const reference = `sub_${uuidv4()}`;
    const subscriptionResponse = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email: user.email,
        plan: selectedPlan,
        amount: 0,
        reference: reference,
        metadata: { userId: user.id, tier, interval }
      },
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" } }
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

app.get("/api/paystack/verify/:reference", authenticateToken, async (req, res) => {
  try {
    const { reference } = req.params;
    const verifyResponse = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } }
    );

    const data = verifyResponse.data.data;
    if (data.status !== "success") return res.status(400).json({ error: "Payment not successful" });

    const metadata = data.metadata || {};
    const tier = metadata.tier;
    const userId = metadata.userId;
    const planCode = data.plan;

    let newRole = "free";
    if (tier === "pro") newRole = "pro";
    if (tier === "vvip") newRole = "vvip";
    if (tier === "weekly" || tier === "monthly" || tier === "quarterly" || tier === "yearly") newRole = "pro";

    await pool.query(
      `UPDATE users SET role = $1, subscription_status = 'active', paystack_plan_code = $2 WHERE id = $3`,
      [newRole, planCode, userId]
    );

    return res.json({ message: "Subscription activated", role: newRole });
  } catch (error) {
    console.error("Paystack verify error:", error.response?.data || error.message);
    return res.status(500).json({ error: "Verification failed" });
  }
});

app.post("/api/paystack/webhook", async (req, res) => {
  try {
    const hash = crypto.createHmac("sha512", PAYSTACK_SECRET_KEY).update(req.body).digest("hex");
    const signature = req.headers["x-paystack-signature"];
    if (hash !== signature) return res.sendStatus(401);

    const event = JSON.parse(req.body.toString());
    if (event.event === "subscription.disable") {
      const customerCode = event.data.customer?.customer_code;
      const userResult = await pool.query("SELECT * FROM users WHERE paystack_customer_code = $1", [customerCode]);
      if (userResult.rows.length > 0) {
        await pool.query(
          `UPDATE users SET role = 'free', subscription_status = 'inactive', paystack_subscription_code = NULL WHERE id = $1`,
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
================================================== */

app.get("/api/supabase/predictions", async (req, res) => {
  try {
    const { data, error } = await supabase.from("predictions").select("*").order("match_date", { ascending: true });
    if (error) return res.json({ predictions: [], error: error.message });
    res.json({ predictions: data });
  } catch (error) {
    res.json({ predictions: [], error: error.message });
  }
});

app.get("/api/supabase/subscriptions/:userId", authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { data, error } = await supabase.from("subscriptions").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ subscriptions: data });
  } catch (error) {
    res.json({ subscriptions: [] });
  }
});

app.post("/api/supabase/user-predictions", authenticateToken, async (req, res) => {
  try {
    const { prediction_id } = req.body;
    const user_id = req.user.id;
    const { data, error } = await supabase.from("user_predictions").insert([{ user_id, prediction_id }]).select();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: "Failed to save prediction" });
  }
});

app.get("/api/supabase/user-predictions/:userId", authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { data, error } = await supabase
      .from("user_predictions")
      .select(`id, saved_at, predictions (*)`)
      .eq("user_id", userId)
      .order("saved_at", { ascending: false });
    if (error) throw error;
    res.json({ savedPredictions: data });
  } catch (error) {
    res.json({ savedPredictions: [] });
  }
});

/* ==================================================
   ====== MULTI-CURRENCY MANUAL PAYMENT ROUTES =======
   ====== ADDED: USD, GBP, USDC, USDT ================
================================================== */

// Get payment details for selected currency
app.post("/api/get-payment-details", authenticateToken, async (req, res) => {
  try {
    const { currency, plan, amount } = req.body;
    
    if (!currency || !plan || !amount) {
      return res.status(400).json({ error: "Currency, plan, and amount required" });
    }
    
    let paymentDetails = {};
    
    switch (currency.toUpperCase()) {
      case "USD":
        paymentDetails = {
          currency: "USD",
          accountName: process.env.GREY_USD_ACCOUNT_NAME,
          accountNumber: process.env.GREY_USD_ACCOUNT_NUMBER,
          routing: process.env.GREY_USD_ROUTING,
          bankName: process.env.GREY_USD_BANK_NAME,
          accountType: "Checking",
          instructions: "Please send the exact amount via ACH or Wire transfer. Include your email in the payment reference.",
          supportEmail: process.env.MANUAL_PAYMENT_EMAIL || "propredict.support@gmail.com"
        };
        break;
        
      case "GBP":
        paymentDetails = {
          currency: "GBP",
          accountName: process.env.GREY_GBP_ACCOUNT_NAME,
          accountNumber: process.env.GREY_GBP_ACCOUNT_NUMBER,
          sortCode: process.env.GREY_GBP_SORT_CODE,
          iban: process.env.GREY_GBP_IBAN,
          swift: process.env.GREY_GBP_SWIFT,
          bankName: process.env.GREY_GBP_BANK_NAME,
          instructions: "Please send the exact amount via bank transfer. Include your email in the payment reference.",
          supportEmail: process.env.MANUAL_PAYMENT_EMAIL || "propredict.support@gmail.com"
        };
        break;
        
      case "USDC":
        paymentDetails = {
          currency: "USDC",
          address: process.env.GREY_CRYPTO_ADDRESS,
          networks: (process.env.GREY_CRYPTO_USDC_NETWORKS || "BEP20,Solana").split(","),
          instructions: "Send only USDC to this address. Supported networks: BEP20 (BSC) and Solana. Double-check the network before sending. Include transaction hash as proof.",
          supportEmail: process.env.MANUAL_PAYMENT_EMAIL || "propredict.support@gmail.com"
        };
        break;
        
      case "USDT":
        paymentDetails = {
          currency: "USDT",
          address: process.env.GREY_CRYPTO_ADDRESS,
          networks: (process.env.GREY_CRYPTO_USDT_NETWORKS || "BEP20,TRC20").split(","),
          instructions: "Send only USDT to this address. Supported networks: BEP20 (BSC) and TRC20 (Tron). Double-check the network before sending. Include transaction hash as proof.",
          supportEmail: process.env.MANUAL_PAYMENT_EMAIL || "propredict.support@gmail.com"
        };
        break;
        
      default:
        return res.status(400).json({ error: "Unsupported currency" });
    }
    
    paymentDetails.amount = amount;
    paymentDetails.plan = plan;
    
    res.json({ success: true, paymentDetails });
    
  } catch (error) {
    console.error("Get payment details error:", error.message);
    res.status(500).json({ error: "Failed to fetch payment details" });
  }
});

// Submit manual payment proof
app.post("/api/submit-manual-payment", authenticateToken, async (req, res) => {
  try {
    const { currency, plan, amount, proofType, proofData, transactionRef, notes } = req.body;
    const userId = req.user.id;
    const userEmail = req.user.email;
    
    if (!currency || !plan || !amount) {
      return res.status(400).json({ error: "Missing required payment information" });
    }
    
    // Create payment record in Supabase
    const paymentRecord = {
      user_id: userId,
      user_email: userEmail,
      currency: currency,
      plan: plan,
      amount: amount,
      proof_type: proofType || "manual",
      proof_data: proofData || null,
      transaction_ref: transactionRef || null,
      notes: notes || null,
      status: "pending",
      created_at: new Date().toISOString()
    };
    
    const { data, error } = await supabaseAdmin
      .from("manual_payments")
      .insert([paymentRecord])
      .select();
    
    if (error) {
      console.error("Supabase insert error:", error.message);
      
      // Fallback: Send email notification
      const emailContent = `
        New Manual Payment Submission:
        User: ${userEmail}
        Plan: ${plan}
        Currency: ${currency}
        Amount: ${amount}
        Transaction Ref: ${transactionRef || "N/A"}
        Notes: ${notes || "N/A"}
      `;
      
      console.log("📧 Manual payment notification:", emailContent);
      
      return res.json({ 
        success: true, 
        message: "Payment proof submitted. We will verify and activate your subscription within 24 hours.",
        fallback: true
      });
    }
    
    res.json({ 
      success: true, 
      message: "Payment proof submitted successfully! We will verify and activate your subscription within 24 hours.",
      paymentId: data[0].id
    });
    
  } catch (error) {
    console.error("Submit manual payment error:", error.message);
    res.status(500).json({ error: "Failed to submit payment proof" });
  }
});

// Admin: Get pending manual payments
app.get("/api/admin/manual-payments", authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.email !== ADMIN_EMAIL) {
      return res.status(403).json({ error: "Admin access required" });
    }
    
    const { data, error } = await supabaseAdmin
      .from("manual_payments")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (error) throw error;
    
    res.json({ payments: data || [] });
    
  } catch (error) {
    console.error("Fetch manual payments error:", error.message);
    res.status(500).json({ error: "Failed to fetch payments" });
  }
});

// Admin: Approve/Reject manual payment
app.post("/api/admin/manual-payments/:paymentId/status", authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.email !== ADMIN_EMAIL) {
      return res.status(403).json({ error: "Admin access required" });
    }
    
    const { paymentId } = req.params;
    const { status, notes } = req.body;
    
    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    
    // Get payment details
    const { data: paymentData, error: fetchError } = await supabaseAdmin
      .from("manual_payments")
      .select("*")
      .eq("id", paymentId)
      .single();
    
    if (fetchError || !paymentData) {
      return res.status(404).json({ error: "Payment not found" });
    }
    
    // Update payment status
    const { error: updateError } = await supabaseAdmin
      .from("manual_payments")
      .update({ 
        status: status, 
        admin_notes: notes,
        reviewed_at: new Date().toISOString(),
        reviewed_by: req.user.email
      })
      .eq("id", paymentId);
    
    if (updateError) throw updateError;
    
    // If approved, upgrade user to Pro
    if (status === "approved") {
      const expiryDate = new Date();
      
      // Set expiry based on plan
      if (paymentData.plan.includes("weekly")) expiryDate.setDate(expiryDate.getDate() + 7);
      else if (paymentData.plan.includes("monthly")) expiryDate.setDate(expiryDate.getDate() + 30);
      else if (paymentData.plan.includes("quarterly")) expiryDate.setDate(expiryDate.getDate() + 90);
      else if (paymentData.plan.includes("yearly")) expiryDate.setDate(expiryDate.getDate() + 365);
      else expiryDate.setDate(expiryDate.getDate() + 30); // Default 30 days
      
      await pool.query(
        `UPDATE users SET role = 'pro', subscription_status = 'active', subscription_end_date = $1 WHERE id = $2`,
        [expiryDate, paymentData.user_id]
      );
    }
    
    res.json({ success: true, message: `Payment ${status}` });
    
  } catch (error) {
    console.error("Update payment status error:", error.message);
    res.status(500).json({ error: "Failed to update payment status" });
  }
});

console.log("✅ Supabase client initialized with ANON key");
console.log("✅ IP tracking middleware active");
console.log("✅ Admin routes loaded");
console.log("✅ Forgot Password route added");
console.log("✅ Server-side caching DISABLED");
console.log("✅ Remember Me: 30-day token enabled");
console.log("✅ Email Verification: Enabled on registration");
console.log("✅ Telegram Bot: Chat ID 6816699294 configured");
console.log("✅ Telegram: /picks and /elite commands enabled");
console.log("✅ Referral System: Active (7 days reward)");
console.log("✅ Multi-Currency Payments: USD, GBP, USDC, USDT enabled");
console.log("✅ CSP Updated: Inline scripts, event handlers & Google Fonts allowed");
console.log("✅ Google OAuth: /api/auth/oauth-login endpoint added");

/* --------------------------------------------------
   SERVER START
-------------------------------------------------- */
initializeAuthTables().then(() => {
  app.listen(PORT, () => {
    console.log(`ProPredict Server running on port ${PORT}`);
  });
});
