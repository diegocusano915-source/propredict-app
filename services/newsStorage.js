/**
 * ProPredict News Storage Layer — PERSISTENT
 *
 * Articles live in Postgres (DATABASE_URL) so they SURVIVE Render deploys
 * and restarts — the free-tier filesystem is wiped on every deploy, which
 * is why file-stored news kept disappearing.
 *
 * - DATABASE_URL set            → Postgres (news_articles + news_meta tables,
 *                                 auto-created on first use)
 * - No DATABASE_URL (local dev) → file fallback in ./data (old behaviour)
 *
 * NOTE: every function is ASYNC. Callers must await.
 */

const fs = require('fs');
const path = require('path');

const NEWS_FILE = path.join(__dirname, '..', 'data', 'news-articles.json');
const NEWS_META_FILE = path.join(__dirname, '..', 'data', 'news-meta.json');
const COVERED_FILE = path.join(__dirname, '..', 'data', 'news_covered_match_ids.json');

const USE_DB = !!process.env.DATABASE_URL;
let pool = null;

if (USE_DB) {
  const { Pool } = require('pg');
  pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  // A dropped DB connection logs; it must never take the news desk down.
  pool.on('error', (err) => console.error('News storage pool error:', err.message));
  console.log('\u{1F5C4}\uFE0F News storage: Postgres (persistent across deploys)');
} else {
  console.log('\u{1F4C1} News storage: file fallback (set DATABASE_URL for persistence)');
}

let schemaReady = null;
function ensureSchema() {
  if (!USE_DB) return Promise.resolve();
  if (!schemaReady) {
    schemaReady = pool.query(`
      CREATE TABLE IF NOT EXISTS news_articles (
        slug TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        category TEXT,
        date TEXT,
        read_time TEXT,
        summary TEXT,
        content TEXT,
        league JSONB,
        leagues JSONB,
        match_data JSONB,
        tags JSONB,
        cover_image TEXT,
        type TEXT,
        views INTEGER DEFAULT 0,
        generated_at TEXT,
        seq BIGSERIAL
      );
      CREATE INDEX IF NOT EXISTS news_articles_seq_idx ON news_articles (seq DESC);
      CREATE TABLE IF NOT EXISTS news_meta (
        key TEXT PRIMARY KEY,
        value JSONB,
        updated_at TIMESTAMPTZ DEFAULT now()
      );
    `).catch((err) => {
      console.error('News schema init failed:', err.message);
      schemaReady = null; // allow retry on next call
      throw err;
    });
  }
  return schemaReady;
}

// ---------- row <-> article mapping ----------

function rowToArticle(r) {
  return {
    slug: r.slug,
    title: r.title,
    category: r.category,
    date: r.date,
    readTime: r.read_time,
    summary: r.summary,
    content: r.content,
    league: r.league,
    leagues: r.leagues,
    matchData: r.match_data,
    tags: r.tags,
    coverImage: r.cover_image,
    type: r.type,
    views: r.views || 0,
    generatedAt: r.generated_at
  };
}

function articleToRow(a) {
  return [
    a.slug,
    a.title,
    a.category || null,
    a.date || null,
    a.readTime || null,
    a.summary || null,
    a.content || null,
    JSON.stringify(a.league || null),
    JSON.stringify(a.leagues || null),
    JSON.stringify(a.matchData || null),
    JSON.stringify(a.tags || null),
    a.coverImage || null,
    a.type || null,
    a.views || 0,
    a.generatedAt || new Date().toISOString()
  ];
}

const INSERT_SQL = `
  INSERT INTO news_articles (slug, title, category, date, read_time, summary, content, league, leagues, match_data, tags, cover_image, type, views, generated_at)
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
  ON CONFLICT (slug) DO NOTHING
  RETURNING slug;
`;

// ---------- file fallback helpers (local dev only) ----------

function ensureDataDir() {
  const dir = path.dirname(NEWS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function fileLoad() {
  ensureDataDir();
  if (!fs.existsSync(NEWS_FILE)) {
    fs.writeFileSync(NEWS_FILE, JSON.stringify([], null, 2));
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(NEWS_FILE, 'utf8'));
  } catch (err) {
    console.error('Failed to load news articles:', err.message);
    return [];
  }
}

function fileSave(articles) {
  ensureDataDir();
  fs.writeFileSync(NEWS_FILE, JSON.stringify(articles, null, 2));
}

// ---------- public API (all async) ----------

/** Load all articles, newest first. */
async function loadArticles() {
  if (!USE_DB) return fileLoad();
  await ensureSchema();
  const res = await pool.query('SELECT * FROM news_articles ORDER BY seq DESC');
  return res.rows.map(rowToArticle);
}

/** Save the full list (replace-all) — file mode + migrations. */
async function saveArticles(articles) {
  if (!USE_DB) { fileSave(articles); return; }
  await ensureSchema();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM news_articles');
    for (const a of articles) {
      await client.query(INSERT_SQL, articleToRow(a));
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/** Load news metadata (scheduler stats). */
async function loadMeta() {
  if (!USE_DB) {
    ensureDataDir();
    if (!fs.existsSync(NEWS_META_FILE)) {
      const defaultMeta = { lastRun: null, lastArticleCount: 0, lastLeaguesScanned: 0, lastMatchesFound: 0, totalArticlesGenerated: 0, totalApiCallsUsed: 0, nextScheduledRun: null };
      fs.writeFileSync(NEWS_META_FILE, JSON.stringify(defaultMeta, null, 2));
      return defaultMeta;
    }
    try { return JSON.parse(fs.readFileSync(NEWS_META_FILE, 'utf8')); } catch { return { lastRun: null }; }
  }
  await ensureSchema();
  const res = await pool.query('SELECT value FROM news_meta WHERE key = $1', ['meta']);
  return res.rows[0]?.value || { lastRun: null };
}

/** Save news metadata. */
async function saveMeta(meta) {
  if (!USE_DB) {
    ensureDataDir();
    fs.writeFileSync(NEWS_META_FILE, JSON.stringify(meta, null, 2));
    return;
  }
  await ensureSchema();
  await pool.query(
    `INSERT INTO news_meta (key, value, updated_at) VALUES ('meta', $1, now())
     ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = now()`,
    [JSON.stringify(meta)]
  );
}

/** Add a new article (duplicate slugs are skipped). */
async function addArticle(article) {
  if (!USE_DB) {
    const articles = fileLoad();
    const exists = articles.find(a => a.slug === article.slug);
    if (exists) {
      console.log(`  \u23ED\uFE0F Article already exists: ${article.slug}`);
      return exists;
    }
    articles.unshift(article);
    fileSave(articles);
    return article;
  }
  await ensureSchema();
  const res = await pool.query(INSERT_SQL, articleToRow(article));
  if (res.rows.length === 0) {
    console.log(`  \u23ED\uFE0F Article already exists: ${article.slug}`);
    return article;
  }
  return article;
}

/** Get articles with pagination and filtering. */
async function getArticles({ page = 1, limit = 20, league, category, search } = {}) {
  let articles = await loadArticles();

  if (league) {
    const lq = league.toLowerCase();
    articles = articles.filter(a =>
      a.league?.name?.toLowerCase().includes(lq) ||
      a.leagues?.some(l => l.name.toLowerCase().includes(lq))
    );
  }
  if (category) {
    articles = articles.filter(a => a.category?.toLowerCase().includes(category.toLowerCase()));
  }
  if (search) {
    const q = search.toLowerCase();
    articles = articles.filter(a =>
      a.title?.toLowerCase().includes(q) ||
      a.summary?.toLowerCase().includes(q)
    );
  }

  const total = articles.length;
  const start = (page - 1) * limit;
  const paged = articles.slice(start, start + limit);

  return {
    articles: paged.map(a => ({
      slug: a.slug,
      title: a.title,
      category: a.category,
      date: a.date,
      readTime: a.readTime,
      summary: a.summary,
      league: a.league,
      leagues: a.leagues,
      coverImage: a.coverImage,
      tags: a.tags,
      views: a.views || 0
    })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  };
}

/** Get a single article by slug. */
async function getArticle(slug) {
  if (!USE_DB) return fileLoad().find(a => a.slug === slug) || null;
  await ensureSchema();
  const res = await pool.query('SELECT * FROM news_articles WHERE slug = $1', [slug]);
  return res.rows[0] ? rowToArticle(res.rows[0]) : null;
}

/** Increment view count (real reads only). */
async function incrementViews(slug) {
  if (!USE_DB) {
    const articles = fileLoad();
    const article = articles.find(a => a.slug === slug);
    if (article) {
      article.views = (article.views || 0) + 1;
      fileSave(articles);
      return article.views;
    }
    return 0;
  }
  await ensureSchema();
  const res = await pool.query(
    'UPDATE news_articles SET views = views + 1 WHERE slug = $1 RETURNING views',
    [slug]
  );
  return res.rows[0]?.views || 0;
}

/** Delete an article by slug. */
async function deleteArticle(slug) {
  if (!USE_DB) {
    const articles = fileLoad();
    const filtered = articles.filter(a => a.slug !== slug);
    if (filtered.length < articles.length) {
      fileSave(filtered);
      return true;
    }
    return false;
  }
  await ensureSchema();
  const res = await pool.query('DELETE FROM news_articles WHERE slug = $1', [slug]);
  return (res.rowCount || 0) > 0;
}

/** Get recent articles for the homepage feed. */
async function getRecentArticles(count = 6) {
  const articles = await loadArticles();
  return articles.slice(0, count).map(a => ({
    slug: a.slug,
    title: a.title,
    category: a.category,
    date: a.date,
    readTime: a.readTime,
    summary: a.summary,
    league: a.league,
    leagues: a.leagues,
    tags: a.tags,
    views: a.views || 0
  }));
}

/** Get all unique leagues that have articles. */
async function getActiveLeagues() {
  const articles = await loadArticles();
  const leaguesMap = new Map();
  for (const a of articles) {
    if (a.league) {
      if (!leaguesMap.has(a.league.name)) {
        leaguesMap.set(a.league.name, { name: a.league.name, country: a.league.country, flag: a.league.flag, count: 0 });
      }
      leaguesMap.get(a.league.name).count++;
    }
    if (a.leagues) {
      for (const l of a.leagues) {
        if (!leaguesMap.has(l.name)) {
          leaguesMap.set(l.name, { name: l.name, country: l.country, flag: l.flag, count: 0 });
        }
        leaguesMap.get(l.name).count++;
      }
    }
  }
  return Array.from(leaguesMap.values()).sort((a, b) => b.count - a.count);
}

/**
 * Match-updater covered set — which finished matches already have a report.
 * Stored alongside articles so dedupe survives restarts too.
 */
async function loadCoveredMatchIds() {
  if (!USE_DB) {
    try {
      if (fs.existsSync(COVERED_FILE)) {
        return new Set(JSON.parse(fs.readFileSync(COVERED_FILE, 'utf8')).ids || []);
      }
    } catch (_) {}
    return new Set();
  }
  await ensureSchema();
  const res = await pool.query('SELECT value FROM news_meta WHERE key = $1', ['covered_match_ids']);
  return new Set(res.rows[0]?.value?.ids || []);
}

async function saveCoveredMatchIds(set) {
  const ids = Array.from(set).slice(-2000);
  if (!USE_DB) {
    try {
      ensureDataDir();
      fs.writeFileSync(COVERED_FILE, JSON.stringify({ ids }));
    } catch (_) {}
    return;
  }
  await ensureSchema();
  await pool.query(
    `INSERT INTO news_meta (key, value, updated_at) VALUES ('covered_match_ids', $1, now())
     ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = now()`,
    [JSON.stringify({ ids })]
  );
}

module.exports = {
  loadArticles,
  saveArticles,
  loadMeta,
  saveMeta,
  addArticle,
  getArticles,
  getArticle,
  incrementViews,
  deleteArticle,
  getRecentArticles,
  getActiveLeagues,
  loadCoveredMatchIds,
  saveCoveredMatchIds
};
