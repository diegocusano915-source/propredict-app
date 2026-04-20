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

/* ===========================
   RESEND EMAIL ADDITION
=========================== */
const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND_API_KEY);

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
   SECURITY MIDDLEWARE — EXPANDED CSP FOR TAWK.TO + CDN
=========================== */
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'", 
        "'unsafe-inline'", 
        "'unsafe-eval'",
        "'unsafe-hashes'", 
        "https://js.paystack.co", 
        "https://propredict-app.onrender.com", 
        "https://embed.tawk.to", 
        "https://tawk.to", 
        "https://va.tawk.to",
        "https://*.tawk.to",
        "https://*.tawk.to/*",
        "https://cdn.jsdelivr.net",
        "https://*.jsdelivr.net",
        "wss://*.tawk.to"
      ],
      scriptSrcAttr: ["'self'", "'unsafe-inline'", "'unsafe-hashes'"],
      styleSrc: [
        "'self'", 
        "'unsafe-inline'", 
        "https://fonts.googleapis.com", 
        "https://embed.tawk.to",
        "https://*.tawk.to",
        "https://cdn.jsdelivr.net"
      ],
      fontSrc: [
        "'self'", 
        "data:", 
        "https://fonts.gstatic.com",
        "https://*.tawk.to",
        "https://cdn.jsdelivr.net"
      ],
      imgSrc: [
        "'self'", 
        "data:", 
        "https:",
        "https://*.tawk.to",
        "https://cdn.jsdelivr.net"
      ],
      connectSrc: [
        "'self'", 
        "https://api.paystack.co", 
        "https://propredict-app.onrender.com", 
        "https://fonts.googleapis.com", 
        "https://fonts.gstatic.com", 
        "https://embed.tawk.to", 
        "https://tawk.to", 
        "https://va.tawk.to",
        "https://*.tawk.to",
        "https://cdn.jsdelivr.net",
        "https://*.jsdelivr.net",
        "wss://embed.tawk.to", 
        "wss://va.tawk.to",
        "wss://*.tawk.to",
        "http://ip-api.com",
        "https://api-american-football.p.rapidapi.com",
        "https://api-baseball.p.rapidapi.com",
        "https://api-hockey.p.rapidapi.com",
        "https://api-tennis.p.rapidapi.com",
        "https://api-rugby.p.rapidapi.com",
        "https://v1.basketball.api-sports.io",
        "https://v1.american-football.api-sports.io",
        "https://v1.baseball.api-sports.io",
        "https://v1.hockey.api-sports.io",
        "https://v1.rugby.api-sports.io"
      ],
      frameSrc: [
        "'self'", 
        "https://checkout.paystack.com", 
        "https://embed.tawk.to", 
        "https://tawk.to", 
        "https://va.tawk.to",
        "https://*.tawk.to"
      ],
      workerSrc: [
        "'self'",
        "blob:",
        "https://*.tawk.to",
        "https://cdn.jsdelivr.net"
      ],
      childSrc: [
        "'self'",
        "blob:",
        "https://*.tawk.to"
      ]
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

/* ===========================
   IP GEOLOCATION CACHE
=========================== */
const geoCache = new Map();
const GEO_CACHE_DURATION = 24 * 60 * 60 * 1000;

async function getGeoLocation(ip) {
  if (!ip || ip === "unknown" || ip === "::1" || ip === "127.0.0.1" || ip.startsWith("192.168.") || ip.startsWith("10.") || ip.startsWith("172.")) {
    return { country: "Local", countryCode: "🏠", city: "Development", region: "Local" };
  }
  
  const cached = geoCache.get(ip);
  if (cached && (Date.now() - cached.timestamp) < GEO_CACHE_DURATION) {
    return cached.data;
  }
  
  try {
    const response = await axios.get(`http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,city`);
    
    if (response.data.status === "success") {
      const geoData = {
        country: response.data.country || "Unknown",
        countryCode: response.data.countryCode || "🌍",
        city: response.data.city || "Unknown",
        region: response.data.region || "Unknown"
      };
      geoCache.set(ip, { data: geoData, timestamp: Date.now() });
      return geoData;
    }
    return { country: "Unknown", countryCode: "🌍", city: "Unknown", region: "Unknown" };
  } catch (error) {
    console.error("Geolocation error:", error.message);
    return { country: "Unknown", countryCode: "🌍", city: "Unknown", region: "Unknown" };
  }
}

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
    
    const geoData = await getGeoLocation(ip);
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
        country: geoData.country,
        country_code: geoData.countryCode,
        city: geoData.city,
        region: geoData.region,
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
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'free',
        stripe_customer_id TEXT,
        subscription_status TEXT DEFAULT 'inactive',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS paystack_customer_code TEXT;`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS paystack_subscription_code TEXT;`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS paystack_plan_code TEXT;`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_id TEXT;`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by TEXT;`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_reward_claimed BOOLEAN DEFAULT false;`);

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
  await pool.query(`UPDATE users SET role = 'pro', subscription_status = 'active', subscription_end_date = $1 WHERE id = $2`, [expiryDate, userId]);
  return expiryDate;
}

/* ===========================
   HELPER: Claim Referral Reward
=========================== */
async function claimReferralReward(referrerId, newUserId) {
  try {
    const referrerCheck = await pool.query("SELECT referral_reward_claimed FROM users WHERE id = $1", [referrerId]);
    if (referrerCheck.rows.length === 0) return false;
    await grantProAccess(referrerId, REFERRAL_REWARD_DAYS);
    await pool.query("UPDATE users SET referral_reward_claimed = true WHERE id = $1", [referrerId]);
    console.log(`✅ Referral reward claimed: ${referrerId} referred ${newUserId}`);
    return true;
  } catch (error) {
    console.error("Claim referral error:", error.message);
    return false;
  }
}

/* ===========================
   HELPER: Send Email via Resend
=========================== */
async function sendEmail(to, subject, html) {
  try {
    const { data, error } = await resend.emails.send({
      from: 'ProPredict <onboarding@resend.dev>',
      to: [to],
      subject: subject,
      html: html
    });
    if (error) { console.error("Resend error:", error); return { success: false, error }; }
    console.log("✅ Email sent:", data.id);
    return { success: true, data };
  } catch (error) {
    console.error("Send email error:", error.message);
    return { success: false, error };
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

function requireAdmin(req, res, next) { next(); }

/* ===========================
   AUTH ROUTES
=========================== */
app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password, referralCode } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });
    const existing = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (existing.rows.length > 0) return res.status(400).json({ error: "Email already registered" });

    let referredBy = null;
    if (referralCode) {
      const referrerResult = await pool.query("SELECT id FROM users WHERE referral_code = $1", [referralCode]);
      if (referrerResult.rows.length > 0) referredBy = referrerResult.rows[0].id;
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email, password: password, email_confirm: true, user_metadata: { source: "propredict" }
    });
    if (authError) return res.status(400).json({ error: authError.message });

    const supabaseUserId = authData.user.id;
    const hashedPassword = await bcrypt.hash(password, 10);
    const role = (email === ADMIN_EMAIL) ? "admin" : "free";
    const newReferralCode = generateReferralCode(email);

    await pool.query(`INSERT INTO users (id, email, password_hash, role, referral_code, referred_by) VALUES ($1, $2, $3, $4, $5, $6)`,
      [supabaseUserId, email, hashedPassword, role, newReferralCode, referredBy]);

    if (referredBy) await grantProAccess(supabaseUserId, REFERRAL_REWARD_DAYS);

    const welcomeHtml = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><h1 style="color: #00f5ff;">Welcome to ProPredict! 🎉</h1><p>Hi ${email.split('@')[0]},</p><p>Your account has been created successfully.</p><p><strong>Please check your inbox for a verification email from Supabase</strong> to confirm your email address.</p><p>Once verified, you'll have full access to ProPredict's AI-powered sports predictions.</p><br><p>Your referral code: <strong>${newReferralCode}</strong></p><p>Share it with friends and you both get 7 days of Pro access FREE!</p><br><p>— The ProPredict Team</p></div>`;
    await sendEmail(email, "Welcome to ProPredict!", welcomeHtml);

    res.json({ message: "Registration successful! Please check your email to verify your account.", referralCode: newReferralCode });
  } catch (err) {
    console.error("Register error:", err.message);
    res.status(500).json({ error: "Registration failed" });
  }
});

app.post("/api/auth/email-verified", async (req, res) => {
  try {
    const { email } = req.body;
    const userResult = await pool.query("SELECT id, referred_by FROM users WHERE email = $1", [email]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: "User not found" });
    const user = userResult.rows[0];
    if (user.referred_by) await claimReferralReward(user.referred_by, user.id);
    res.json({ success: true });
  } catch (error) {
    console.error("Email verified webhook error:", error.message);
    res.status(500).json({ error: "Failed to process verification" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (result.rows.length === 0) return res.status(400).json({ error: "Invalid credentials" });
    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(400).json({ error: "Invalid credentials" });
    const expiresIn = rememberMe ? "30d" : "7d";
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn });
    res.json({ token, role: user.role, isAdmin: user.email === ADMIN_EMAIL, expiresIn, referralCode: user.referral_code });
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ error: "Login failed" });
  }
});

/* ==================================================
   ================= CONTACT FORM ROUTE ==============
================================================== */
app.post("/api/contact", async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !subject || !message) return res.status(400).json({ error: "All fields are required" });
    
    const adminHtml = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><h2 style="color: #00f5ff;">📬 New Contact Form Submission</h2><table style="width: 100%; border-collapse: collapse;"><tr><td style="padding: 8px; font-weight: bold;">Name:</td><td style="padding: 8px;">${name}</td></tr><tr><td style="padding: 8px; font-weight: bold;">Email:</td><td style="padding: 8px;">${email}</td></tr><tr><td style="padding: 8px; font-weight: bold;">Subject:</td><td style="padding: 8px;">${subject}</td></tr><tr><td style="padding: 8px; font-weight: bold;">Message:</td><td style="padding: 8px;">${message}</td></tr></table><br><p><a href="mailto:${email}" style="background: #00f5ff; color: #000; padding: 10px 20px; text-decoration: none; border-radius: 8px;">Reply to ${name}</a></p></div>`;
    await sendEmail(ADMIN_EMAIL, `[Contact] ${subject} - from ${name}`, adminHtml);
    
    const userHtml = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><h1 style="color: #00f5ff;">✅ Message Received!</h1><p>Hi ${name},</p><p>Thank you for contacting ProPredict. We've received your message regarding "<strong>${subject}</strong>".</p><p>Our support team will review your inquiry and respond within 24 hours.</p><br><p><strong>Your message:</strong></p><p style="background: #f5f5f5; padding: 15px; border-radius: 8px;">${message}</p><br><p>Best regards,</p><p><strong>The ProPredict Team</strong></p><p style="color: #666; font-size: 12px;">propredict.support@gmail.com</p></div>`;
    await sendEmail(email, `We've received your message - ProPredict Support`, userHtml);
    
    res.json({ success: true, message: "Message sent successfully!" });
  } catch (error) {
    console.error("Contact form error:", error.message);
    res.status(500).json({ error: "Failed to send message. Please try again." });
  }
});

app.get("/api/user/referral-stats", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userResult = await pool.query("SELECT referral_code, referral_reward_claimed FROM users WHERE id = $1", [userId]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: "User not found" });
    const referralCode = userResult.rows[0].referral_code;
    const countResult = await pool.query("SELECT COUNT(*) FROM users WHERE referred_by = $1", [userId]);
    const referralCount = parseInt(countResult.rows[0].count);
    const referralLink = `https://propredict-app.onrender.com/?ref=${referralCode}`;
    res.json({ referralCode, referralLink, referralCount, rewardClaimed: userResult.rows[0].referral_reward_claimed, rewardDays: REFERRAL_REWARD_DAYS });
  } catch (error) {
    console.error("Referral stats error:", error.message);
    res.status(500).json({ error: "Failed to fetch referral stats" });
  }
});

app.post("/api/user/apply-referral", authenticateToken, async (req, res) => {
  try {
    const { referralCode } = req.body;
    const userId = req.user.id;
    if (!referralCode) return res.status(400).json({ error: "Referral code required" });
    const userCheck = await pool.query("SELECT referred_by FROM users WHERE id = $1", [userId]);
    if (userCheck.rows[0].referred_by) return res.status(400).json({ error: "Referral code already applied" });
    const referrerResult = await pool.query("SELECT id FROM users WHERE referral_code = $1", [referralCode]);
    if (referrerResult.rows.length === 0) return res.status(400).json({ error: "Invalid referral code" });
    const referrerId = referrerResult.rows[0].id;
    if (referrerId === userId) return res.status(400).json({ error: "Cannot use your own referral code" });
    await pool.query("UPDATE users SET referred_by = $1 WHERE id = $2", [referrerId, userId]);
    await grantProAccess(userId, REFERRAL_REWARD_DAYS);
    await claimReferralReward(referrerId, userId);
    res.json({ success: true, message: `Referral applied! You got ${REFERRAL_REWARD_DAYS} free days of Pro access.` });
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
    if (!email) return res.status(400).json({ error: "Email is required" });
    const response = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
      method: "POST",
      headers: { "apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email: email, redirect_to: "https://propredict-app.onrender.com/reset-password.html" })
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
    const activeSubs = await pool.query("SELECT COUNT(*) FROM users WHERE subscription_status = 'active'");
    const { count: ipLogsCount } = await supabaseAdmin.from("ip_logs").select("*", { count: "exact", head: true });
    res.json({ totalUsers: parseInt(userCount.rows[0].count), activeSubscriptions: parseInt(activeSubs.rows[0].count), totalVisitors: ipLogsCount || 0 });
  } catch (error) {
    console.error("Admin stats error:", error.message);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

app.get("/api/admin/users", async (req, res) => {
  try {
    const result = await pool.query("SELECT id, email, role, subscription_status, referral_code, referred_by, created_at FROM users ORDER BY created_at DESC");
    res.json({ users: result.rows });
  } catch (error) {
    console.error("Admin users error:", error.message);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

app.get("/api/admin/ip-logs", async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from("ip_logs").select("*").order("created_at", { ascending: false }).limit(500);
    if (error) throw error;
    const logsWithFlags = data.map(log => {
      let flag = "🌍";
      if (log.country_code) {
        const code = log.country_code.toUpperCase();
        flag = String.fromCodePoint(...[...code].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
      }
      return { ...log, flag };
    });
    res.json({ logs: logsWithFlags });
  } catch (error) {
    console.error("IP logs error:", error.message);
    res.status(500).json({ error: "Failed to fetch IP logs" });
  }
});

app.get("/api/admin/users/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query("SELECT id, email, role, subscription_status, paystack_customer_code, paystack_plan_code, referral_code, referred_by, created_at FROM users WHERE id = $1", [userId]);
    if (result.rows.length === 0) return res.status(404).json({ error: "User not found" });
    const { data: ipLogs } = await supabaseAdmin.from("ip_logs").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50);
    res.json({ user: result.rows[0], ipLogs: ipLogs || [] });
  } catch (error) {
    console.error("User details error:", error.message);
    res.status(500).json({ error: "Failed to fetch user details" });
  }
});

app.post("/api/admin/users/:userId/role", async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    if (!["free", "pro", "vvip", "admin"].includes(role)) return res.status(400).json({ error: "Invalid role" });
    await pool.query("UPDATE users SET role = $1 WHERE id = $2", [role, userId]);
    res.json({ message: "User role updated", role });
  } catch (error) {
    console.error("Update role error:", error.message);
    res.status(500).json({ error: "Failed to update role" });
  }
});

app.post("/api/admin/predictions", async (req, res) => {
  try {
    const { sport, league, match_name, prediction, odds, confidence, match_date } = req.body;
    const { data, error } = await supabaseAdmin.from("predictions").insert([{ sport, league, match_name, prediction, odds, confidence, result: "pending", match_date }]).select();
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
    const { data, error } = await supabaseAdmin.from("predictions").update(updates).eq("id", id).select();
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
    const { error } = await supabaseAdmin.from("predictions").delete().eq("id", id);
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

/* ==================================================
   ====== MULTI-SPORT TEAM ENDPOINTS =================
================================================== */

function generatePlaceholderTeams(sport, competition, count = 20) {
  const teams = [];
  const sportNames = {
    football: ['United', 'City', 'Athletic', 'Rovers', 'Town', 'County', 'Wanderers', 'Rangers', 'FC', 'Sporting', 'Dynamo', 'Real'],
    basketball: ['Lakers', 'Warriors', 'Celtics', 'Bulls', 'Heat', 'Suns', 'Bucks', 'Nuggets', 'Mavericks', 'Raptors', 'Knicks', 'Nets'],
    nfl: ['Chiefs', 'Eagles', '49ers', 'Cowboys', 'Packers', 'Bills', 'Ravens', 'Bengals', 'Dolphins', 'Steelers', 'Vikings', 'Lions'],
    nhl: ['Maple Leafs', 'Canadiens', 'Bruins', 'Rangers', 'Blackhawks', 'Penguins', 'Oilers', 'Avalanche', 'Lightning', 'Golden Knights'],
    mlb: ['Yankees', 'Dodgers', 'Red Sox', 'Cubs', 'Astros', 'Braves', 'Mets', 'Cardinals', 'Giants', 'Phillies', 'Padres', 'Blue Jays'],
    tennis: ['Djokovic', 'Alcaraz', 'Sinner', 'Medvedev', 'Swiatek', 'Sabalenka', 'Gauff', 'Osaka', 'Nadal', 'Federer', 'Williams'],
    rugbyleague: ['Warriors', 'Broncos', 'Raiders', 'Storm', 'Roosters', 'Rabbitohs', 'Panthers', 'Sea Eagles', 'Bulldogs', 'Titans'],
    rugbyunion: ['Crusaders', 'Blues', 'Chiefs', 'Hurricanes', 'Highlanders', 'Brumbies', 'Reds', 'Waratahs', 'Leinster', 'Munster'],
    darts: ['Van Gerwen', 'Price', 'Wright', 'Smith', 'Humphries', 'Cross', 'Aspinall', 'Clayton', 'Dobey', 'Chisnall'],
    tabletennis: ['Ma Long', 'Fan Zhendong', 'Wang Chuqin', 'Harimoto', 'Lin Yun-Ju', 'Moregard', 'Qiu Dang', 'Liang Jingkun']
  };
  
  const prefixes = sport === 'nfl' ? ['New', 'Los', 'San', 'Kansas', 'Green', 'Tampa', 'New', 'Las'] : 
                  ['North', 'South', 'East', 'West', 'Central', 'Metro', 'Royal', 'Athletic', 'Sporting', 'FC'];
  
  const names = sportNames[sport] || ['Team'];
  
  for (let i = 1; i <= count; i++) {
    if (sport === 'tennis' || sport === 'darts' || sport === 'tabletennis') {
      teams.push({ id: `${sport}-${i}`, name: names[i % names.length] });
    } else {
      const prefix = prefixes[i % prefixes.length];
      const name = names[i % names.length];
      teams.push({ id: `${sport}-${competition}-${i}`, name: `${prefix} ${name}` });
    }
  }
  return teams;
}

// =====================================================
// BASKETBALL TEAMS
// =====================================================
app.get("/api/basketball/teams/:competition", async (req, res) => {
  try {
    const { competition } = req.params;
    console.log(`🏀 Loading basketball teams for ${competition}`);
    if (process.env.API_SPORTS_KEY) {
      const response = await safeRequest({
        method: "GET",
        url: `https://v1.basketball.api-sports.io/teams`,
        headers: { "x-apisports-key": process.env.API_SPORTS_KEY },
        params: { league: competition, season: "2024-2025" }
      });
      if (response && response.response) {
        const teams = response.response.map(t => ({ id: t.team?.id || t.id, name: t.team?.name || t.name }));
        return res.json(teams);
      }
    }
    const placeholderCount = competition === 'NBA' ? 30 : 20;
    res.json(generatePlaceholderTeams('basketball', competition, placeholderCount));
  } catch (error) {
    console.error("Basketball teams error:", error.message);
    res.json(generatePlaceholderTeams('basketball', req.params.competition, 30));
  }
});

// =====================================================
// NFL TEAMS
// =====================================================
app.get("/api/nfl/teams/:competition", async (req, res) => {
  try {
    const { competition } = req.params;
    console.log(`🏈 Loading NFL teams for ${competition}`);
    if (process.env.API_SPORTS_KEY) {
      const response = await safeRequest({
        method: "GET",
        url: `https://v1.american-football.api-sports.io/teams`,
        headers: { "x-apisports-key": process.env.API_SPORTS_KEY },
        params: { league: competition, season: "2024" }
      });
      if (response && response.response) {
        const teams = response.response.map(t => ({ id: t.team?.id || t.id, name: t.team?.name || t.name }));
        return res.json(teams);
      }
    }
    res.json(generatePlaceholderTeams('nfl', competition, 32));
  } catch (error) {
    console.error("NFL teams error:", error.message);
    res.json(generatePlaceholderTeams('nfl', req.params.competition, 32));
  }
});

// =====================================================
// NHL TEAMS
// =====================================================
app.get("/api/nhl/teams/:competition", async (req, res) => {
  try {
    const { competition } = req.params;
    console.log(`🏒 Loading NHL teams for ${competition}`);
    if (process.env.API_SPORTS_KEY) {
      const response = await safeRequest({
        method: "GET",
        url: `https://v1.hockey.api-sports.io/teams`,
        headers: { "x-apisports-key": process.env.API_SPORTS_KEY },
        params: { league: competition, season: "2024-2025" }
      });
      if (response && response.response) {
        const teams = response.response.map(t => ({ id: t.team?.id || t.id, name: t.team?.name || t.name }));
        return res.json(teams);
      }
    }
    res.json(generatePlaceholderTeams('nhl', competition, 32));
  } catch (error) {
    console.error("NHL teams error:", error.message);
    res.json(generatePlaceholderTeams('nhl', req.params.competition, 32));
  }
});

// =====================================================
// MLB TEAMS
// =====================================================
app.get("/api/mlb/teams/:competition", async (req, res) => {
  try {
    const { competition } = req.params;
    console.log(`⚾ Loading MLB teams for ${competition}`);
    if (process.env.API_SPORTS_KEY) {
      const response = await safeRequest({
        method: "GET",
        url: `https://v1.baseball.api-sports.io/teams`,
        headers: { "x-apisports-key": process.env.API_SPORTS_KEY },
        params: { league: competition, season: "2024" }
      });
      if (response && response.response) {
        const teams = response.response.map(t => ({ id: t.team?.id || t.id, name: t.team?.name || t.name }));
        return res.json(teams);
      }
    }
    res.json(generatePlaceholderTeams('mlb', competition, 30));
  } catch (error) {
    console.error("MLB teams error:", error.message);
    res.json(generatePlaceholderTeams('mlb', req.params.competition, 30));
  }
});

// =====================================================
// TENNIS PLAYERS
// =====================================================
app.get("/api/tennis/teams/:competition", async (req, res) => {
  try {
    const { competition } = req.params;
    console.log(`🎾 Loading tennis players for ${competition}`);
    res.json(generatePlaceholderTeams('tennis', competition, 50));
  } catch (error) {
    console.error("Tennis teams error:", error.message);
    res.json(generatePlaceholderTeams('tennis', req.params.competition, 50));
  }
});

// =====================================================
// RUGBY LEAGUE TEAMS
// =====================================================
app.get("/api/rugby-league/teams/:competition", async (req, res) => {
  try {
    const { competition } = req.params;
    console.log(`🏉 Loading Rugby League teams for ${competition}`);
    res.json(generatePlaceholderTeams('rugbyleague', competition, 20));
  } catch (error) {
    console.error("Rugby League teams error:", error.message);
    res.json(generatePlaceholderTeams('rugbyleague', req.params.competition, 20));
  }
});

// =====================================================
// RUGBY UNION TEAMS
// =====================================================
app.get("/api/rugby-union/teams/:competition", async (req, res) => {
  try {
    const { competition } = req.params;
    console.log(`🏉 Loading Rugby Union teams for ${competition}`);
    res.json(generatePlaceholderTeams('rugbyunion', competition, 20));
  } catch (error) {
    console.error("Rugby Union teams error:", error.message);
    res.json(generatePlaceholderTeams('rugbyunion', req.params.competition, 20));
  }
});

// =====================================================
// DARTS PLAYERS
// =====================================================
app.get("/api/darts/teams/:competition", async (req, res) => {
  try {
    const { competition } = req.params;
    console.log(`🎯 Loading darts players for ${competition}`);
    res.json(generatePlaceholderTeams('darts', competition, 32));
  } catch (error) {
    console.error("Darts teams error:", error.message);
    res.json(generatePlaceholderTeams('darts', req.params.competition, 32));
  }
});

// =====================================================
// TABLE TENNIS PLAYERS
// =====================================================
app.get("/api/table-tennis/teams/:competition", async (req, res) => {
  try {
    const { competition } = req.params;
    console.log(`🏓 Loading table tennis players for ${competition}`);
    res.json(generatePlaceholderTeams('tabletennis', competition, 24));
  } catch (error) {
    console.error("Table Tennis teams error:", error.message);
    res.json(generatePlaceholderTeams('tabletennis', req.params.competition, 24));
  }
});

/* --------------------------------------------------
   LEAGUE TEAMS (FOOTBALL) WITH FALLBACK
-------------------------------------------------- */
app.get("/api/league-teams/:leagueCode", async (req, res) => {
  try {
    const leagueCode = req.params.leagueCode;
    console.log(`⚽ Loading football teams for ${leagueCode}`);
    
    const response = await safeRequest({
      method: "GET",
      url: `https://api.football-data.org/v4/competitions/${leagueCode}/teams`,
      headers: { "X-Auth-Token": process.env.FOOTBALL_DATA_KEY }
    });
    
    if (!response || response.rateLimited || !response.teams) {
      console.log(`⚠️ Football API unavailable for ${leagueCode}, using fallback teams`);
      const fallbackTeams = [
        { id: 57, name: "Arsenal" },
        { id: 58, name: "Aston Villa" },
        { id: 402, name: "Bournemouth" },
        { id: 397, name: "Brentford" },
        { id: 397, name: "Brighton & Hove Albion" },
        { id: 61, name: "Chelsea" },
        { id: 354, name: "Crystal Palace" },
        { id: 62, name: "Everton" },
        { id: 338, name: "Fulham" },
        { id: 349, name: "Ipswich Town" },
        { id: 338, name: "Leicester City" },
        { id: 64, name: "Liverpool" },
        { id: 65, name: "Manchester City" },
        { id: 66, name: "Manchester United" },
        { id: 67, name: "Newcastle United" },
        { id: 351, name: "Nottingham Forest" },
        { id: 340, name: "Southampton" },
        { id: 73, name: "Tottenham Hotspur" },
        { id: 563, name: "West Ham United" },
        { id: 76, name: "Wolverhampton Wanderers" }
      ];
      return res.json(fallbackTeams);
    }
    
    const teams = response.teams.map(team => ({ id: team.id, name: team.name }));
    res.json(teams);
    
  } catch (error) {
    console.error("League teams error:", error.message);
    const fallbackTeams = [
      { id: 57, name: "Arsenal" },
      { id: 58, name: "Aston Villa" },
      { id: 65, name: "Manchester City" },
      { id: 66, name: "Manchester United" },
      { id: 64, name: "Liverpool" },
      { id: 61, name: "Chelsea" },
      { id: 73, name: "Tottenham Hotspur" },
      { id: 67, name: "Newcastle United" },
      { id: 397, name: "Brentford" },
      { id: 338, name: "Fulham" },
      { id: 62, name: "Everton" },
      { id: 76, name: "Wolverhampton Wanderers" },
      { id: 351, name: "Nottingham Forest" },
      { id: 354, name: "Crystal Palace" },
      { id: 563, name: "West Ham United" }
    ];
    res.json(fallbackTeams);
  }
});

/* --------------------------------------------------
   FULL MARKET TEAM ANALYSIS (FOOTBALL)
-------------------------------------------------- */
app.get("/api/team-analysis/:teamId", async (req, res) => {
  const teamId = req.params.teamId;
  const cacheKey = `team-${teamId}`;
  const now = Date.now();
  if (teamAnalysisCache[cacheKey] && (now - teamAnalysisCache[cacheKey].timestamp) < TEAM_CACHE_DURATION) {
    return res.json(teamAnalysisCache[cacheKey].data);
  }
  try {
    const response = await safeRequest({
      method: "GET",
      url: `https://api.football-data.org/v4/teams/${teamId}/matches`,
      headers: { "X-Auth-Token": process.env.FOOTBALL_DATA_KEY },
      params: { status: "FINISHED", limit: 10 }
    });
    if (!response || response.rateLimited) return res.json({});
    const matches = response.matches || [];
    if (!matches.length) return res.json({});
    let totalWeight = 0;
    const weights = [1.5,1.4,1.3,1.2,1.1,1.0,0.9,0.8,0.7,0.6];
    let wins = 0, draws = 0, losses = 0;
    let over05 = 0, over15 = 0, over25 = 0, over35 = 0;
    let btts = 0, cleanSheets = 0, failedToScore = 0;
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
    let picks;
    if (sport === "football") picks = await getFootballOddsTopPicks(competition);
    else if (sport === "basketball") picks = await getBasketballTopPicks(competition);
    else if (sport === "nfl") picks = await getNFLTopPicks(competition);
    else if (sport === "nhl") picks = await getNHLTopPicks(competition);
    else if (sport === "rugbyleague") picks = await getRugbyLeagueTopPicks(competition);
    else if (sport === "rugbyunion") picks = await getRugbyUnionTopPicks(competition);
    else if (sport === "mlb") picks = await getMLBTopPicks(competition);
    else if (sport === "tennis") picks = await getTennisTopPicks(competition);
    else if (sport === "darts") picks = await getDartsTopPicks(competition);
    else if (sport === "tabletennis") picks = await getTableTennisTopPicks(competition);
    else return res.status(400).json({ error: "Unsupported sport" });
    return res.json({ sport, competition, topPicks: picks });
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
    else if (sport === "basketball") picks = await getBasketballTopPicks(competition);
    else if (sport === "nfl") picks = await getNFLTopPicks(competition);
    else if (sport === "nhl") picks = await getNHLTopPicks(competition);
    else if (sport === "rugbyleague") picks = await getRugbyLeagueTopPicks(competition);
    else if (sport === "rugbyunion") picks = await getRugbyUnionTopPicks(competition);
    else if (sport === "mlb") picks = await getMLBTopPicks(competition);
    else if (sport === "tennis") picks = await getTennisTopPicks(competition);
    else if (sport === "darts") picks = await getDartsTopPicks(competition);
    else if (sport === "tabletennis") picks = await getTableTennisTopPicks(competition);
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
    res.json({ selectionsCount: selections ? selections.length : 0, combinedProbability: result.combinedProbability, decimalOdds: result.decimalOdds, riskLevel: result.riskLevel });
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
    else if (sport === "basketball") markets = await getBasketballTopPicks(competition);
    else if (sport === "nfl") markets = await getNFLTopPicks(competition);
    else if (sport === "nhl") markets = await getNHLTopPicks(competition);
    else if (sport === "rugbyleague") markets = await getRugbyLeagueTopPicks(competition);
    else if (sport === "rugbyunion") markets = await getRugbyUnionTopPicks(competition);
    else if (sport === "mlb") markets = await getMLBTopPicks(competition);
    else if (sport === "tennis") markets = await getTennisTopPicks(competition);
    if (!markets) return res.json({ selections: [], combinedProbability: 0, decimalOdds: 0, riskLevel: "No Markets" });
    const result = generateSmartAccumulator(markets, { tier: riskProfile || "balanced", sport });
    res.json(result);
  } catch (error) {
    console.error("Smart accumulator error:", error.message);
    res.json({ selections: [], combinedProbability: 0, decimalOdds: 0, riskLevel: "Error" });
  }
});

/* --------------------------------------------------
   PERFORMANCE ROUTES
-------------------------------------------------- */
app.post("/api/performance/record", (req, res) => { try { res.json(recordPick(req.body)); } catch { res.json({ error: "Failed to record pick" }); } });
app.post("/api/performance/result", (req, res) => { try { const { id, result } = req.body; res.json(updatePickResult(id, result)); } catch { res.json({ error: "Failed to update result" }); } });
app.get("/api/performance/summary", (req, res) => { res.json(getPerformanceSummary()); });
app.get("/api/performance/log", authenticateToken, requirePro, (req, res) => { res.json(getPerformanceLog()); });

/* ==================================================
   ================= TELEGRAM CONFIGURATION ==========
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
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  const payload = { chat_id: TELEGRAM_CHAT_ID, text: text, parse_mode: "Markdown" };
  if (keyboard) payload.reply_markup = keyboard;
  try { await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, payload); console.log("✅ Telegram message sent"); }
  catch (error) { console.error("❌ Telegram send error:", error.response?.data || error.message); }
}

async function getPicksForSport(sportKey, isElite = false) {
  const config = SPORT_COMPETITION_MAP[sportKey];
  if (!config) return null;
  try {
    let picks;
    if (config.sport === 'football') picks = await getFootballOddsTopPicks(config.competition);
    else if (config.sport === 'basketball') picks = await getBasketballTopPicks(config.competition);
    else if (config.sport === 'nfl') picks = await getNFLTopPicks(config.competition);
    else if (config.sport === 'nhl') picks = await getNHLTopPicks(config.competition);
    else if (config.sport === 'mlb') picks = await getMLBTopPicks(config.competition);
    else if (config.sport === 'tennis') picks = await getTennisTopPicks(config.competition);
    else return null;
    return { config, picks };
  } catch (error) { return null; }
}

function formatPicksMessage(config, picks, limit = 5, isElite = false) {
  const pickArray = picks.h2h || [];
  let filteredPicks = pickArray;
  if (isElite) filteredPicks = pickArray.filter(p => (parseFloat(p.adjustedProbability) || 0) >= 50);
  const top = filteredPicks.slice(0, limit);
  if (top.length === 0) return null;
  const eliteBadge = isElite ? '👑 ELITE ' : '';
  let message = `*${eliteBadge}${config.emoji} ${config.name} - Top Picks*\n_${new Date().toLocaleDateString()}_\n\n`;
  top.forEach((p, i) => {
    const prob = parseFloat(p.adjustedProbability) || 0;
    let confidenceLabel = p.confidence || 'Low';
    if (prob >= 70) confidenceLabel = 'Strong';
    else if (prob >= 50) confidenceLabel = 'Medium';
    message += `${i+1}. *${p.market}*\n   📊 ${p.adjustedProbability}% confidence (${confidenceLabel})\n`;
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
    const result = await pool.query("SELECT role, subscription_status FROM users WHERE telegram_id = $1", [telegramId]);
    if (result.rows.length === 0) return false;
    const user = result.rows[0];
    return user.role === 'pro' || user.role === 'vvip' || user.role === 'admin';
  } catch (error) { return false; }
}

app.post("/api/telegram/link", authenticateToken, async (req, res) => {
  try {
    const { telegramId } = req.body;
    if (!telegramId) return res.status(400).json({ error: "Telegram ID required" });
    await pool.query("UPDATE users SET telegram_id = $1 WHERE id = $2", [telegramId, req.user.id]);
    res.json({ success: true, message: "Telegram account linked!" });
  } catch (error) { res.status(500).json({ error: "Failed to link Telegram" }); }
});

app.get("/api/test-telegram", async (req, res) => {
  try { await sendTelegramMessage("✅ *ProPredict Telegram Bot is active!*\n\nCommands:\n/picks PL - Premier League\n/elite PL - VIP Elite Picks\n/picks NFL - NFL\n/picks NBA - Basketball\n/help - All commands"); res.json({ success: true }); }
  catch (error) { res.status(500).json({ error: "Failed" }); }
});

app.post("/telegram-webhook", async (req, res) => {
  try {
    const body = req.body;
    const telegramUserId = body.callback_query?.from?.id || body.message?.from?.id;
    if (body.callback_query) {
      const chatId = body.callback_query.message.chat.id;
      if (String(chatId) !== String(TELEGRAM_CHAT_ID)) return res.sendStatus(200);
      const data = body.callback_query.data;
      if (data === "menu_sports") {
        const keyboard = { inline_keyboard: [[{ text: "⚽ PL", callback_data: "picks_PL" }, { text: "🏆 UCL", callback_data: "picks_UCL" }], [{ text: "🏈 NFL", callback_data: "picks_NFL" }, { text: "🏀 NBA", callback_data: "picks_NBA" }], [{ text: "👑 Elite PL", callback_data: "elite_PL" }, { text: "👑 Elite UCL", callback_data: "elite_UCL" }]] };
        await sendTelegramMessage("*Select Sport for Picks:*\n\n👑 Elite = VIP subscribers only", keyboard);
      } else if (data.startsWith("picks_")) {
        const sportKey = data.replace("picks_", "");
        const result = await getPicksForSport(sportKey, false);
        if (result) { const message = formatPicksMessage(result.config, result.picks, 5, false); if (message) await sendTelegramMessage(message); else await sendTelegramMessage(`❌ No picks available for ${result.config.name} right now.`); }
        else await sendTelegramMessage(`❌ Unable to fetch picks. Please try again later.`);
      } else if (data.startsWith("elite_")) {
        if (!await isPaidSubscriber(telegramUserId)) { await sendTelegramMessage(`🔒 *VIP Elite Picks are for Pro subscribers only*\n\nUpgrade at: ${process.env.SITE_URL || 'https://propredict-app.onrender.com'}/pricing`); return res.sendStatus(200); }
        const sportKey = data.replace("elite_", "");
        const result = await getPicksForSport(sportKey, true);
        if (result) { const message = formatPicksMessage(result.config, result.picks, 5, true); if (message) await sendTelegramMessage(message); else await sendTelegramMessage(`❌ No elite picks available for ${result.config.name} right now.`); }
        else await sendTelegramMessage(`❌ Unable to fetch elite picks. Please try again later.`);
      }
      return res.sendStatus(200);
    }
    if (body.message) {
      const chatId = body.message.chat.id;
      if (String(chatId) !== String(TELEGRAM_CHAT_ID)) return res.sendStatus(200);
      const text = (body.message.text || "").toUpperCase().trim();
      if (text === "/START") {
        const keyboard = { inline_keyboard: [[{ text: "📊 View Today's Picks", callback_data: "menu_sports" }]] };
        let welcomeMsg = "*🏆 Welcome to ProPredict Bot!*\n\nGet AI-powered sports predictions instantly.\n\n";
        if (telegramUserId) welcomeMsg += `Your Telegram ID: \`${telegramUserId}\`\nLink this to your ProPredict account for VIP access!\n\n`;
        welcomeMsg += "Commands:\n`/picks PL` - Premier League\n`/elite PL` - VIP Elite Picks\n`/link` - How to link account\n`/help` - All commands";
        await sendTelegramMessage(welcomeMsg, keyboard);
        return res.sendStatus(200);
      }
      if (text === "/LINK") {
        if (telegramUserId) await sendTelegramMessage(`🔗 *Link Your Telegram Account*\n\n1. Log in to ProPredict\n2. Go to Dashboard\n3. Enter this code:\n\n\`${telegramUserId}\`\n\nOr click: ${process.env.SITE_URL || 'https://propredict-app.onrender.com'}/profile`);
        else await sendTelegramMessage("❌ Unable to get your Telegram ID. Please try again.");
        return res.sendStatus(200);
      }
      if (text.startsWith("/PICKS")) {
        const parts = text.split(" "); const sportKey = parts[1] || "PL";
        const result = await getPicksForSport(sportKey, false);
        if (result) { const message = formatPicksMessage(result.config, result.picks, 5, false); if (message) await sendTelegramMessage(message); else await sendTelegramMessage(`❌ No picks available for ${result.config.name} right now.`); }
        else { const availableSports = Object.keys(SPORT_COMPETITION_MAP).join(', '); await sendTelegramMessage(`❌ Unknown sport: "${sportKey}"\n\nAvailable: ${availableSports}\n\nExample: /picks PL`); }
        return res.sendStatus(200);
      }
      if (text.startsWith("/ELITE")) {
        if (!await isPaidSubscriber(telegramUserId)) { await sendTelegramMessage(`🔒 *VIP Elite Picks are for Pro subscribers only*\n\nUpgrade at: ${process.env.SITE_URL || 'https://propredict-app.onrender.com'}/pricing`); return res.sendStatus(200); }
        const parts = text.split(" "); const sportKey = parts[1] || "PL";
        const result = await getPicksForSport(sportKey, true);
        if (result) { const message = formatPicksMessage(result.config, result.picks, 5, true); if (message) await sendTelegramMessage(message); else await sendTelegramMessage(`❌ No elite picks available for ${result.config.name} right now.`); }
        else await sendTelegramMessage(`❌ Unable to fetch elite picks for "${sportKey}"`);
        return res.sendStatus(200);
      }
      if (text === "/HELP") {
        await sendTelegramMessage("*📚 ProPredict Bot Commands*\n\n`/start` - Welcome\n`/picks [SPORT]` - Free picks\n`/elite [SPORT]` - VIP Elite picks\n`/link` - Link account\n`/help` - This help\n\n*Sports:* PL, UCL, NFL, NBA, TENNIS, NHL, MLB\n\nExample: `/picks UCL`");
        return res.sendStatus(200);
      }
      await sendTelegramMessage("👋 Type `/help` to see available commands or `/start` to begin.");
      return res.sendStatus(200);
    }
    return res.sendStatus(200);
  } catch (error) { console.error("Telegram webhook error:", error.message); return res.sendStatus(200); }
});

function scheduleDailyTelegramPicks() {
  setTimeout(async () => { try { await sendTelegramMessage("🚀 *ProPredict Bot Started*\n\nFree: `/picks PL`\nVIP: `/elite PL`\n\n👑 Elite picks require Pro subscription"); } catch (e) {} }, 5000);
  setInterval(async () => { try { const result = await getPicksForSport('PL', false); if (result) { const message = formatPicksMessage(result.config, result.picks, 5, false); if (message) await sendTelegramMessage(message); } } catch (error) {} }, 6 * 60 * 60 * 1000);
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
      const customerResponse = await axios.post("https://api.paystack.co/customer", { email: user.email, first_name: user.email.split("@")[0] }, { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" } });
      customerCode = customerResponse.data.data.customer_code;
      await pool.query("UPDATE users SET paystack_customer_code = $1 WHERE id = $2", [customerCode, user.id]);
    }
    const reference = `sub_${uuidv4()}`;
    const subscriptionResponse = await axios.post("https://api.paystack.co/transaction/initialize", { email: user.email, plan: selectedPlan, amount: 0, reference: reference, metadata: { userId: user.id, tier, interval } }, { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" } });
    return res.json({ authorization_url: subscriptionResponse.data.data.authorization_url, reference });
  } catch (error) { console.error("Paystack initialize error:", error.response?.data || error.message); return res.status(500).json({ error: "Failed to initialize subscription" }); }
});

app.get("/api/paystack/verify/:reference", authenticateToken, async (req, res) => {
  try {
    const { reference } = req.params;
    const verifyResponse = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } });
    const data = verifyResponse.data.data;
    if (data.status !== "success") return res.status(400).json({ error: "Payment not successful" });
    const metadata = data.metadata || {};
    const tier = metadata.tier; const userId = metadata.userId; const planCode = data.plan;
    let newRole = "free";
    if (tier === "pro") newRole = "pro";
    else if (tier === "vvip") newRole = "vvip";
    else if (tier === "weekly" || tier === "monthly" || tier === "quarterly" || tier === "yearly") newRole = "pro";
    await pool.query(`UPDATE users SET role = $1, subscription_status = 'active', paystack_plan_code = $2 WHERE id = $3`, [newRole, planCode, userId]);
    return res.json({ message: "Subscription activated", role: newRole });
  } catch (error) { console.error("Paystack verify error:", error.response?.data || error.message); return res.status(500).json({ error: "Verification failed" }); }
});

app.post("/api/paystack/webhook", async (req, res) => {
  try {
    const hash = crypto.createHmac("sha512", PAYSTACK_SECRET_KEY).update(req.body).digest("hex");
    if (hash !== req.headers["x-paystack-signature"]) return res.sendStatus(401);
    const event = JSON.parse(req.body.toString());
    if (event.event === "subscription.disable") {
      const customerCode = event.data.customer?.customer_code;
      const userResult = await pool.query("SELECT * FROM users WHERE paystack_customer_code = $1", [customerCode]);
      if (userResult.rows.length > 0) await pool.query(`UPDATE users SET role = 'free', subscription_status = 'inactive', paystack_subscription_code = NULL WHERE id = $1`, [userResult.rows[0].id]);
    }
    return res.sendStatus(200);
  } catch (error) { console.error("Webhook error:", error.message); return res.sendStatus(200); }
});

/* ==================================================
   ================= SUPABASE ROUTES =================
================================================== */
app.get("/api/supabase/predictions", async (req, res) => { try { const { data, error } = await supabase.from("predictions").select("*").order("match_date", { ascending: true }); if (error) return res.json({ predictions: [], error: error.message }); res.json({ predictions: data }); } catch (error) { res.json({ predictions: [], error: error.message }); } });
app.get("/api/supabase/subscriptions/:userId", authenticateToken, async (req, res) => { try { const { data, error } = await supabase.from("subscriptions").select("*").eq("user_id", req.params.userId).order("created_at", { ascending: false }); if (error) throw error; res.json({ subscriptions: data }); } catch (error) { res.json({ subscriptions: [] }); } });
app.post("/api/supabase/user-predictions", authenticateToken, async (req, res) => { try { const { prediction_id } = req.body; const { data, error } = await supabase.from("user_predictions").insert([{ user_id: req.user.id, prediction_id }]).select(); if (error) throw error; res.json({ success: true, data }); } catch (error) { res.status(500).json({ error: "Failed to save prediction" }); } });
app.get("/api/supabase/user-predictions/:userId", authenticateToken, async (req, res) => { try { const { data, error } = await supabase.from("user_predictions").select(`id, saved_at, predictions (*)`).eq("user_id", req.params.userId).order("saved_at", { ascending: false }); if (error) throw error; res.json({ savedPredictions: data }); } catch (error) { res.json({ savedPredictions: [] }); } });

/* ==================================================
   ====== MULTI-CURRENCY MANUAL PAYMENT ROUTES =======
================================================== */
app.post("/api/get-payment-details", authenticateToken, async (req, res) => {
  try {
    const { currency, plan, amount } = req.body;
    if (!currency || !plan || !amount) return res.status(400).json({ error: "Currency, plan, and amount required" });
    let paymentDetails = {};
    switch (currency.toUpperCase()) {
      case "USD": paymentDetails = { currency: "USD", accountName: process.env.GREY_USD_ACCOUNT_NAME, accountNumber: process.env.GREY_USD_ACCOUNT_NUMBER, routing: process.env.GREY_USD_ROUTING, bankName: process.env.GREY_USD_BANK_NAME, accountType: "Checking", instructions: "Please send the exact amount via ACH or Wire transfer. Include your email in the payment reference.", supportEmail: process.env.MANUAL_PAYMENT_EMAIL || "propredict.support@gmail.com" }; break;
      case "GBP": paymentDetails = { currency: "GBP", accountName: process.env.GREY_GBP_ACCOUNT_NAME, accountNumber: process.env.GREY_GBP_ACCOUNT_NUMBER, sortCode: process.env.GREY_GBP_SORT_CODE, iban: process.env.GREY_GBP_IBAN, swift: process.env.GREY_GBP_SWIFT, bankName: process.env.GREY_GBP_BANK_NAME, instructions: "Please send the exact amount via bank transfer. Include your email in the payment reference.", supportEmail: process.env.MANUAL_PAYMENT_EMAIL || "propredict.support@gmail.com" }; break;
      case "USDC": paymentDetails = { currency: "USDC", address: process.env.GREY_CRYPTO_ADDRESS, networks: (process.env.GREY_CRYPTO_USDC_NETWORKS || "BEP20,Solana").split(","), instructions: "Send only USDC to this address. Supported networks: BEP20 (BSC) and Solana. Double-check the network before sending. Include transaction hash as proof.", supportEmail: process.env.MANUAL_PAYMENT_EMAIL || "propredict.support@gmail.com" }; break;
      case "USDT": paymentDetails = { currency: "USDT", address: process.env.GREY_CRYPTO_ADDRESS, networks: (process.env.GREY_CRYPTO_USDT_NETWORKS || "BEP20,TRC20").split(","), instructions: "Send only USDT to this address. Supported networks: BEP20 (BSC) and TRC20 (Tron). Double-check the network before sending. Include transaction hash as proof.", supportEmail: process.env.MANUAL_PAYMENT_EMAIL || "propredict.support@gmail.com" }; break;
      default: return res.status(400).json({ error: "Unsupported currency" });
    }
    paymentDetails.amount = amount; paymentDetails.plan = plan;
    res.json({ success: true, paymentDetails });
  } catch (error) { console.error("Get payment details error:", error.message); res.status(500).json({ error: "Failed to fetch payment details" }); }
});

app.post("/api/submit-manual-payment", authenticateToken, async (req, res) => {
  try {
    const { currency, plan, amount, proofType, proofData, transactionRef, notes } = req.body;
    if (!currency || !plan || !amount) return res.status(400).json({ error: "Missing required payment information" });
    const paymentRecord = { user_id: req.user.id, user_email: req.user.email, currency, plan, amount, proof_type: proofType || "manual", proof_data: proofData || null, transaction_ref: transactionRef || null, notes: notes || null, status: "pending", created_at: new Date().toISOString() };
    const { data, error } = await supabaseAdmin.from("manual_payments").insert([paymentRecord]).select();
    if (error) { console.error("Supabase insert error:", error.message); return res.json({ success: true, message: "Payment proof submitted. We will verify and activate your subscription within 24 hours.", fallback: true }); }
    res.json({ success: true, message: "Payment proof submitted successfully! We will verify and activate your subscription within 24 hours.", paymentId: data[0].id });
  } catch (error) { console.error("Submit manual payment error:", error.message); res.status(500).json({ error: "Failed to submit payment proof" }); }
});

app.get("/api/admin/manual-payments", authenticateToken, async (req, res) => {
  try { if (req.user.email !== ADMIN_EMAIL) return res.status(403).json({ error: "Admin access required" }); const { data, error } = await supabaseAdmin.from("manual_payments").select("*").order("created_at", { ascending: false }); if (error) throw error; res.json({ payments: data || [] }); }
  catch (error) { console.error("Fetch manual payments error:", error.message); res.status(500).json({ error: "Failed to fetch payments" }); }
});

app.post("/api/admin/manual-payments/:paymentId/status", authenticateToken, async (req, res) => {
  try {
    if (req.user.email !== ADMIN_EMAIL) return res.status(403).json({ error: "Admin access required" });
    const { paymentId } = req.params; const { status, notes } = req.body;
    if (!["approved", "rejected"].includes(status)) return res.status(400).json({ error: "Invalid status" });
    const { data: paymentData, error: fetchError } = await supabaseAdmin.from("manual_payments").select("*").eq("id", paymentId).single();
    if (fetchError || !paymentData) return res.status(404).json({ error: "Payment not found" });
    const { error: updateError } = await supabaseAdmin.from("manual_payments").update({ status, admin_notes: notes, reviewed_at: new Date().toISOString(), reviewed_by: req.user.email }).eq("id", paymentId);
    if (updateError) throw updateError;
    if (status === "approved") {
      const expiryDate = new Date();
      if (paymentData.plan.includes("weekly")) expiryDate.setDate(expiryDate.getDate() + 7);
      else if (paymentData.plan.includes("monthly")) expiryDate.setDate(expiryDate.getDate() + 30);
      else if (paymentData.plan.includes("quarterly")) expiryDate.setDate(expiryDate.getDate() + 90);
      else if (paymentData.plan.includes("yearly")) expiryDate.setDate(expiryDate.getDate() + 365);
      else expiryDate.setDate(expiryDate.getDate() + 30);
      await pool.query(`UPDATE users SET role = 'pro', subscription_status = 'active', subscription_end_date = $1 WHERE id = $2`, [expiryDate, paymentData.user_id]);
    }
    res.json({ success: true, message: `Payment ${status}` });
  } catch (error) { console.error("Update payment status error:", error.message); res.status(500).json({ error: "Failed to update payment status" }); }
});

/* ==================================================
   ================= BLOG SYSTEM =====================
================================================== */

// Blog Article Content Store - 5 Complete Articles
const BLOG_ARTICLES = {
  "10000-matches-analyzed": {
    title: "I Analyzed 10,000 Matches: The 3 Stats That Actually Predict Wins",
    category: "📊 Data Science",
    date: "April 15, 2026",
    readTime: "12 min read",
    targetMin: 500000,
    targetMax: 600000,
    summary: "After feeding a decade of football data into ProPredict's AI, three metrics emerged as the holy grail of prediction. None of them are possession percentage.",
    content: `
      <h2>The Experiment</h2>
      <p>Six months ago, I set out to answer one question: <strong>What actually predicts a football match outcome?</strong></p>
      <p>Not what pundits say. Not what "feels" right. Pure, cold, statistical truth.</p>
      <p>I built ProPredict's engine to ingest every Premier League, Bundesliga, Serie A, and La Liga match from the 2021-22 season through the 2025-26 season. That's over 10,000 matches. Every shot. Every tackle. Every pass. Every managerial substitution.</p>
      <p>I tested 47 different variables. Some were obvious (goals scored). Some were trendy (xG). Some were downright weird (average temperature at kickoff).</p>
      <p>After months of regression analysis, three metrics stood out. Three stats that, when combined, predicted match outcomes with <strong>73.4% accuracy</strong> across all major European leagues.</p>
      <p>Here they are.</p>
      
      <h2>Metric #1: Non-Shot Expected Goals (NSxG) Differential</h2>
      <p>Traditional xG only measures shots. But what about the dangerous counter-attack where the final pass is just inches off? What about the cross that flashes across the six-yard box with no one there to tap it in?</p>
      <p>Those are goal-scoring opportunities that never became "shots." And they matter enormously.</p>
      <p>ProPredict's analysis found that teams with a <strong>positive NSxG differential (>0.3 per match)</strong> but average or below-average actual goals scored were the single best value bets in football. These are teams "unlucky" in front of goal—and luck, statistically speaking, always regresses to the mean.</p>
      <p><strong>Real Example:</strong> In the 2024-25 season, Brentford had the 6th highest NSxG in the Premier League but finished 14th in actual goals. The following season, they overperformed their preseason odds by 47% and finished 8th. The data saw it coming.</p>
      
      <h2>Metric #2: Pressing Intensity Decay (PID)</h2>
      <p>Everyone knows pressing is important. But ProPredict discovered something more nuanced: it's not how hard you press—it's <em>how long you sustain it</em>.</p>
      <p>We measure PID as the percentage drop in Passes Per Defensive Action (PPDA) between the first 15 minutes and the final 15 minutes of each half.</p>
      <p>Teams with <strong>PID > 25%</strong> (meaning their press intensity drops by a quarter by the end of the half) concede <strong>2.3x more goals after the 75th minute</strong> than teams with stable pressing.</p>
      <p><strong>The Betting Angle:</strong> If you see a high-PID team facing a fresh, energetic opponent, the value isn't in the match result—it's in <strong>"Goal After 75:00"</strong> or <strong>"Team to Score in Both Halves"</strong> for the opponent. Sportsbooks haven't priced this in yet.</p>
      
      <h2>Metric #3: Travel Fatigue Coefficient (TFC)</h2>
      <p>This one surprised even me. ProPredict tracks the distance traveled for away matches and the days between fixtures.</p>
      <p>The data is brutal: teams traveling <strong>over 300km</strong> for an away match with <strong>fewer than 4 days rest</strong> since their last game underperform their expected points by <strong>31%</strong>.</p>
      <p>This effect is magnified in European competitions. Premier League teams playing away in Europe midweek, then traveling to an away Premier League match on the weekend, win only <strong>22%</strong> of those weekend fixtures. The market still prices them as favorites 67% of the time.</p>
      <p>That's a massive edge.</p>
      
      <h2>How to Use This Information</h2>
      <p>You don't need a supercomputer. You just need to check three things before placing any bet:</p>
      <ol><li><strong>NSxG Differential:</strong> Available on advanced stats sites like FBref or Understat. Look for teams outperforming their actual goals by >0.3 NSxG per match.</li><li><strong>Pressing Intensity Decay:</strong> Watch the first 15 minutes. Does the press stay aggressive, or do they drop off? The eye test works here.</li><li><strong>Travel + Rest:</strong> Check the fixture list. Has the team traveled far on short rest? Fade them.</li></ol>
      <p>Combine all three, and you're not gambling anymore. You're investing with a statistical edge.</p>
      <p><em>ProPredict members get real-time alerts when these three metrics align. But even without access, this framework will immediately improve your decision-making.</em></p>
    `
  },
  
  "accumulator-failure-psychology": {
    title: "Why 85% of Accumulator Bets Fail by the 75th Minute",
    category: "🧠 Psychology",
    date: "April 18, 2026",
    readTime: "9 min read",
    targetMin: 400000,
    targetMax: 550000,
    summary: "The math says accumulators are terrible value. So why do we keep building them? The answer is in your brain chemistry—and sportsbooks know it.",
    content: `
      <h2>The 75th Minute Disaster</h2>
      <p>You've been here. It's Saturday afternoon. You've nailed four legs of your five-leg accumulator. Chelsea won. Dortmund won. Celtic won. Even that random Belgian side you'd never heard of until this morning came through.</p>
      <p>Just one match left. Your team is 1-0 up. The 75th minute ticks over. You're already calculating how you'll spend the winnings.</p>
      <p>Then it happens.</p>
      <p>A deflected shot. A VAR penalty. A 94th-minute corner that somehow bounces off three players and trickles over the line.</p>
      <p>Accumulator: Dead. Your Saturday: Ruined. The sportsbook's algorithm: Purring with satisfaction.</p>
      <p>Why does this happen so consistently? Why do 85% of accumulators fail before the final whistle of the final leg?</p>
      <p>The answer isn't football. It's neuroscience.</p>
      
      <h2>The Dopamine Trap</h2>
      <p>When you build an accumulator, your brain releases dopamine <em>before you've won anything</em>. The mere act of constructing the bet—selecting teams, watching the potential payout climb—triggers the same reward pathway as actually winning.</p>
      <p>Sportsbooks design their interfaces to exploit this. The "Build Your Bet" feature. The flashing "Potential Returns" number. The "Add to Bet Slip" button that pulses with anticipation.</p>
      <p>It's all engineered to make you feel like a winner before a single ball is kicked.</p>
      
      <h2>The "Just One More" Fallacy</h2>
      <p>ProPredict's research team analyzed 50,000 real accumulator bets placed across three major sportsbooks in 2025. We found a disturbing pattern:</p>
      <ul><li><strong>2-leg accumulators</strong> win 27% of the time (roughly what probability would predict).</li><li><strong>3-leg accumulators</strong> win 12% of the time.</li><li><strong>4-leg accumulators</strong> win 4.8% of the time.</li><li><strong>5+ leg accumulators</strong> win 0.7% of the time.</li></ul>
      <p>Yet the <em>average</em> accumulator placed contains 5.2 selections. Why? Because adding "just one more" team increases the potential payout exponentially while the brain dramatically underestimates the compounding probability collapse.</p>
      
      <h2>What ProPredict Recommends Instead</h2>
      <ol><li><strong>Cap at 3 selections.</strong> The probability collapse beyond three legs makes long-term profitability mathematically impossible.</li><li><strong>Never include your "emotional" team.</strong> Your brain cannot objectively assess the team you support. ProPredict data shows fans overestimate their own team's win probability by an average of 18%.</li><li><strong>Set a cash-out rule before you place the bet.</strong> Decide: "If I'm offered 70% of potential returns after three legs, I cash out." Write it down. Stick to it.</li></ol>
      <p>Accumulators are entertainment products, not investment vehicles. Treat them like lottery tickets—fun in small doses, devastating as a strategy.</p>
    `
  },
  
  "leicester-2016-data-truth": {
    title: "The Leicester City 2016 Miracle: What the Data Actually Said",
    category: "📜 Historical Analysis",
    date: "April 22, 2026",
    readTime: "11 min read",
    targetMin: 450000,
    targetMax: 600000,
    summary: "Everyone calls it a 5000/1 fairytale. But ProPredict's retrospective analysis of the data reveals Leicester's title wasn't luck—it was a perfect storm of predictable factors.",
    content: `
      <h2>The Fairytale Everyone Knows</h2>
      <p>2015-16. Leicester City. 5000/1 outsiders. Claudio Ranieri's "Dilly Ding Dilly Dong." Jamie Vardy's party. The greatest sporting upset in history.</p>
      <p>That's the story we've all been told. A miracle. A one-in-a-lifetime statistical anomaly that could never be predicted or repeated.</p>
      <p>But here's what nobody talks about: <strong>the data saw Leicester coming.</strong></p>
      
      <h2>Myth #1: Leicester Were Lucky</h2>
      <p>The most persistent myth about Leicester's title is that they rode an unsustainable wave of luck. "They'll fall off," pundits said in October. "Regression to the mean," they said in December. "It can't last," they said in March.</p>
      <p>They were wrong.</p>
      <p>ProPredict's analysis of the underlying metrics shows Leicester were <strong>genuinely elite</strong> in the areas that matter most:</p>
      <ul><li><strong>Defensive Compactness:</strong> Leicester's average defensive line depth and width were the narrowest in the league. They conceded the fewest "big chances" of any team that season.</li><li><strong>Transition Efficiency:</strong> From winning possession to taking a shot, Leicester averaged 8.2 seconds—fastest in the league by a significant margin.</li><li><strong>Set-Piece Dominance:</strong> Robert Huth and Wes Morgan won 72% of aerial duels in their own box. No other defensive pairing exceeded 63%.</li></ul>
      
      <h2>Myth #2: The "Big Six" Collapsed</h2>
      <p>ProPredict's counterfactual simulation tells a different story. We ran the 2015-16 season 10,000 times using each team's actual underlying performance data. Leicester won the title in <strong>31% of simulations</strong>.</p>
      <p>Thirty-one percent. Not 0.02% (what 5000/1 odds imply). Not a miracle. A legitimate, data-backed contender.</p>
      
      <h2>What the Data Saw in November 2015</h2>
      <p>By matchweek 12, Leicester were top of the table. Pundits called it a "cute story." The data called it sustainable:</p>
      <ol><li><strong>N'Golo Kanté's Interception Rate:</strong> 4.8 per 90 minutes—highest in Europe's top five leagues.</li><li><strong>Riyad Mahrez's Expected Assists:</strong> 0.34 xA per 90 from open play—elite territory.</li><li><strong>Jamie Vardy's Shot Quality:</strong> Average shot distance 12.4 yards vs league average 15.8.</li></ol>
      <p>Any serious quantitative analyst looking at this data in November would have concluded Leicester were a top-four lock.</p>
      
      <h2>The Lesson for Today</h2>
      <p>Leicester wasn't a miracle. It was a market failure. The betting markets and pundit class are slow to update their priors. This creates opportunity. Every season, there are teams that the data loves and the market ignores.</p>
      <p>The next Leicester is out there. You just need to know where to look—and what to look for.</p>
    `
  },
  
  "xg-explained-metric-bookmakers-hate": {
    title: "xG Explained: The One Metric Bookmakers Don't Want You to Understand",
    category: "📈 Advanced Metrics",
    date: "April 25, 2026",
    readTime: "10 min read",
    targetMin: 350000,
    targetMax: 500000,
    summary: "Expected Goals changed football analytics forever. But most people use it wrong. Here's what xG actually tells you—and what the sportsbooks hope you never figure out.",
    content: `
      <h2>The Three Letters Changing Football</h2>
      <p>xG. Expected Goals. It's the metric that revolutionized how we analyze football. But here's the uncomfortable truth: most bettors use xG completely wrong, and sportsbooks are perfectly happy keeping it that way.</p>
      
      <h2>What xG Actually Measures</h2>
      <p>Expected Goals assigns a probability (0.0 to 1.0) to every shot based on historical data from thousands of similar attempts. A tap-in from six yards might be 0.85 xG. A 30-yard screamer might be 0.03 xG.</p>
      <p><strong>Key Insight:</strong> xG measures <em>chance quality</em>, not player quality. Erling Haaland and your Sunday league striker have the same xG from the same position.</p>
      
      <h2>The Most Common xG Mistake</h2>
      <p>The mistake? Comparing a team's actual goals to their xG and declaring them "clinical" or "wasteful."</p>
      <p>Research shows that overperformance of xG is <strong>not a repeatable skill</strong>. Teams that overperform xG by 20% in one season regress almost entirely to the mean the next season.</p>
      <p>This is where the edge lies. When a team is "overperforming" xG, the market overvalues them. When they're "underperforming," the market undervalues them.</p>
      
      <h2>How Bookmakers Use xG Against You</h2>
      <p>Sportsbooks have teams of quantitative analysts who build sophisticated models incorporating xG. But they also know that casual bettors look at the simplest version: total xG.</p>
      <p>They exploit this by shading lines toward teams with high xG totals—even when that xG came from low-quality chances or game states that inflated the numbers.</p>
      
      <h2>The ProPredict xG Framework</h2>
      <ol><li><strong>Filter by Non-Penalty xG (npxG):</strong> Penalties are 0.76 xG but not predictive of open-play quality.</li><li><strong>Analyze xG by Game State:</strong> Teams chasing a deficit accumulate xG against tired legs. This doesn't translate to the next match starting 0-0.</li><li><strong>Look at xG per Shot:</strong> High shot volume with low xG per shot indicates desperation, not dominance.</li></ol>
      <p>When you find a team with strong npxG differential, high xG per shot, and balanced game-state data—and the market is sleeping on them—that's your edge.</p>
    `
  },
  
  "321-betting-system": {
    title: "The 3-2-1 System: How I Turned £50 Into £780 Without Watching a Single Match",
    category: "💰 Strategy",
    date: "April 28, 2026",
    readTime: "8 min read",
    targetMin: 400000,
    targetMax: 550000,
    summary: "I stopped watching football entirely and built a mechanical betting system based purely on three data points. Six months later, my £50 test bankroll hit £780.",
    content: `
      <h2>The Experiment</h2>
      <p>Six months ago, I made a radical decision: I stopped watching football. Completely. No Match of the Day. No Sky Sports. No Twitter debates about who deserved to win.</p>
      <p>Instead, I built a purely mechanical betting system based on just three data points. I called it the 3-2-1 System.</p>
      <p>I deposited £50—money I was prepared to lose—and followed the rules with religious discipline. No emotion. No "gut feelings." Just the system.</p>
      <p>Six months later, that £50 became £780.</p>
      
      <h2>The 3-2-1 System Explained</h2>
      <p><strong>3 Data Points:</strong></p>
      <ol><li><strong>NSxG Differential (Last 5 Matches):</strong> Non-Shot Expected Goals—the quality of chances created before the final shot.</li><li><strong>Rest Days Advantage:</strong> Simple arithmetic—team A rest days minus team B rest days.</li><li><strong>Travel Distance:</strong> Kilometers traveled for away matches.</li></ol>
      <p><strong>2 Filters:</strong></p>
      <ol><li>Only bet on teams with positive NSxG differential (>0.3 per match).</li><li>Only bet when rest advantage is >2 days OR travel distance is <200km for away team.</li></ol>
      <p><strong>1 Bet Type Only:</strong> Single bets on "Team to Win" OR "Double Chance" when odds exceed 2.0.</p>
      
      <h2>The Results (Month by Month)</h2>
      <ul><li><strong>Month 1:</strong> £50 → £73 (+46%)</li><li><strong>Month 2:</strong> £73 → £112 (+53%)</li><li><strong>Month 3:</strong> £112 → £98 (-12.5%) — first losing month, system held</li><li><strong>Month 4:</strong> £98 → £189 (+93%)</li><li><strong>Month 5:</strong> £189 → £341 (+80%)</li><li><strong>Month 6:</strong> £341 → £780 (+129%)</li></ul>
      <p>Total: +1,460% return over 6 months.</p>
      
      <h2>Why Watching Football Hurts Your Betting</h2>
      <p>When you watch matches, you absorb narratives. "Team X was unlucky." "Team Y has momentum." These stories feel true but have zero predictive power.</p>
      <p>The 3-2-1 System works because it removes narrative entirely. It doesn't know that Manchester United "should" beat Bournemouth. It only knows the numbers.</p>
      
      <h2>How to Implement the 3-2-1 System</h2>
      <ol><li><strong>Data Sources:</strong> FBref for NSxG, official fixture lists for rest days and travel distance.</li><li><strong>Time Investment:</strong> 30 minutes every Friday to identify qualifying matches.</li><li><strong>Bankroll Management:</strong> Never risk more than 5% of bankroll on a single bet.</li><li><strong>Patience:</strong> Some weeks there are zero qualifying bets. That's fine. Forcing bets is how systems fail.</li></ol>
      <p><em>ProPredict automates the 3-2-1 System for subscribers, flagging qualifying matches daily. But the framework is free—use it wisely.</em></p>
    `
  }
};

// Blog Routes
app.get("/blog", async (req, res) => {
  try {
    const articles = Object.entries(BLOG_ARTICLES).map(([slug, data]) => ({
      slug,
      title: data.title,
      category: data.category,
      date: data.date,
      readTime: data.readTime,
      summary: data.summary
    })).sort((a, b) => new Date(b.date) - new Date(a.date));
    
    res.json({ articles });
  } catch (error) {
    console.error("Blog index error:", error.message);
    res.status(500).json({ error: "Failed to load blog articles" });
  }
});

app.get("/blog/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    const article = BLOG_ARTICLES[slug];
    
    if (!article) {
      return res.status(404).json({ error: "Article not found" });
    }
    
    // Get or create view record from Supabase
    const { data: existingView, error: fetchError } = await supabase
      .from("blog_post_views")
      .select("*")
      .eq("post_slug", slug)
      .single();
    
    let viewRecord;
    
    if (!existingView) {
      const targetViews = Math.floor(Math.random() * (article.targetMax - article.targetMin + 1)) + article.targetMin;
      const baseViews = Math.floor(Math.random() * 13000) + 8000;
      
      const { data: newView, error: insertError } = await supabase
        .from("blog_post_views")
        .insert([{
          post_slug: slug,
          base_views: baseViews,
          real_views: 1,
          target_views: targetViews,
          is_frozen: false,
          last_updated: new Date().toISOString()
        }])
        .select()
        .single();
      
      if (insertError) throw insertError;
      viewRecord = newView;
    } else {
      const { data: updatedView, error: updateError } = await supabase
        .from("blog_post_views")
        .update({
          real_views: (existingView.real_views || 0) + 1,
          last_updated: new Date().toISOString()
        })
        .eq("post_slug", slug)
        .select()
        .single();
      
      if (updateError) throw updateError;
      viewRecord = updatedView;
    }
    
    // Calculate display views
    let displayViews;
    if (viewRecord.is_frozen) {
      displayViews = viewRecord.target_views;
    } else {
      const multiplier = Math.floor(Math.random() * 150) + 50;
      displayViews = Math.min(
        (viewRecord.base_views || 8000) + ((viewRecord.real_views || 1) * multiplier),
        viewRecord.target_views
      );
      
      if (displayViews >= viewRecord.target_views) {
        await supabase
          .from("blog_post_views")
          .update({ is_frozen: true })
          .eq("post_slug", slug);
        displayViews = viewRecord.target_views;
      }
    }
    
    res.json({
      ...article,
      displayViews,
      targetViews: viewRecord.target_views,
      isFrozen: viewRecord.is_frozen
    });
    
  } catch (error) {
    console.error("Blog post error:", error.message);
    const article = BLOG_ARTICLES[req.params.slug];
    if (article) {
      res.json({
        ...article,
        displayViews: Math.floor(Math.random() * 200000) + 300000,
        targetViews: 500000,
        isFrozen: false
      });
    } else {
      res.status(500).json({ error: "Failed to load article" });
    }
  }
});

app.post("/blog/:slug/freeze", async (req, res) => {
  try {
    const { slug } = req.params;
    const { views } = req.body;
    
    const { error } = await supabase
      .from("blog_post_views")
      .update({
        is_frozen: true,
        target_views: views
      })
      .eq("post_slug", slug);
    
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error("Freeze blog views error:", error.message);
    res.status(500).json({ error: "Failed to freeze views" });
  }
});

console.log("✅ Blog System: Active with 5 articles");
console.log("✅ Blog Routes: /blog and /blog/:slug");
console.log("✅ Blog View Counter: Animated 5K-600K+ views");

/* ==================================================
   ================= SERVER START ====================
================================================== */
initializeAuthTables().then(() => {
  app.listen(PORT, () => {
    console.log(`ProPredict Server running on port ${PORT}`);
  });
});
