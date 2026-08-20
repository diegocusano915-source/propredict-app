/**
 * ProPredict News Storage Layer
 * File-based JSON persistence for news articles
 * Zero database dependencies — works with existing app
 */

const fs = require('fs');
const path = require('path');

const NEWS_FILE = path.join(__dirname, '..', 'data', 'news-articles.json');
const NEWS_META_FILE = path.join(__dirname, '..', 'data', 'news-meta.json');

// Ensure data directory exists
function ensureDataDir() {
  const dir = path.dirname(NEWS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Load all articles from storage
 */
function loadArticles() {
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

/**
 * Save all articles to storage
 */
function saveArticles(articles) {
  ensureDataDir();
  fs.writeFileSync(NEWS_FILE, JSON.stringify(articles, null, 2));
}

/**
 * Load news metadata (last run, next scheduled run, etc.)
 */
function loadMeta() {
  ensureDataDir();
  if (!fs.existsSync(NEWS_META_FILE)) {
    const defaultMeta = {
      lastRun: null,
      lastArticleCount: 0,
      lastLeaguesScanned: 0,
      lastMatchesFound: 0,
      totalArticlesGenerated: 0,
      totalApiCallsUsed: 0,
      nextScheduledRun: null
    };
    fs.writeFileSync(NEWS_META_FILE, JSON.stringify(defaultMeta, null, 2));
    return defaultMeta;
  }
  try {
    return JSON.parse(fs.readFileSync(NEWS_META_FILE, 'utf8'));
  } catch (err) {
    return { lastRun: null };
  }
}

/**
 * Save news metadata
 */
function saveMeta(meta) {
  ensureDataDir();
  fs.writeFileSync(NEWS_META_FILE, JSON.stringify(meta, null, 2));
}

/**
 * Add a new article (checks for duplicate slugs)
 */
function addArticle(article) {
  const articles = loadArticles();
  const exists = articles.find(a => a.slug === article.slug);
  if (exists) {
    console.log(`  ⏭️ Article already exists: ${article.slug}`);
    return exists;
  }
  articles.unshift(article); // Newest first
  saveArticles(articles);
  return article;
}

/**
 * Get articles with pagination and filtering
 */
function getArticles({ page = 1, limit = 20, league, category, search } = {}) {
  let articles = loadArticles();

  // Filter by league
  if (league) {
    articles = articles.filter(a => 
      a.league?.name?.toLowerCase().includes(league.toLowerCase()) ||
      a.leagues?.some(l => l.name.toLowerCase().includes(league.toLowerCase()))
    );
  }

  // Filter by category
  if (category) {
    articles = articles.filter(a => a.category?.toLowerCase().includes(category.toLowerCase()));
  }

  // Search in title and summary
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
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
}

/**
 * Get a single article by slug
 */
function getArticle(slug) {
  const articles = loadArticles();
  return articles.find(a => a.slug === slug) || null;
}

/**
 * Increment view count for an article
 */
function incrementViews(slug) {
  const articles = loadArticles();
  const article = articles.find(a => a.slug === slug);
  if (article) {
    article.views = (article.views || 0) + 1;
    saveArticles(articles);
    return article.views;
  }
  return 0;
}

/**
 * Delete an article by slug
 */
function deleteArticle(slug) {
  const articles = loadArticles();
  const filtered = articles.filter(a => a.slug !== slug);
  if (filtered.length < articles.length) {
    saveArticles(filtered);
    return true;
  }
  return false;
}

/**
 * Get recent articles for the homepage feed
 */
function getRecentArticles(count = 6) {
  const articles = loadArticles();
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

/**
 * Get all unique leagues that have articles
 */
function getActiveLeagues() {
  const articles = loadArticles();
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
  getActiveLeagues
};
