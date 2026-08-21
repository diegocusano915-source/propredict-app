/**
 * ProPredict — News Social Distribution (Telegram)
 *
 * Every newly published article is announced to your Telegram channel —
 * free, no API costs, no rate-limit games. This is the traction loop:
 * real article published -> channel post -> readers -> views.
 *
 * Setup (one time, ~3 minutes):
 *   1. In Telegram, talk to @BotFather -> /newbot -> get the token.
 *   2. Create a public channel (e.g. @ProPredictNews), add your bot as
 *      an ADMIN with "Post messages" permission.
 *   3. Set env vars on Render:
 *       TELEGRAM_BOT_TOKEN=123456:ABC...
 *       TELEGRAM_CHANNEL=@ProPredictNews   (or -100... numeric id)
 *
 * Without these vars the module is a silent no-op.
 */

const axios = require('axios');
const { loadArticles, loadMeta, saveMeta } = require('./newsStorage');

const ANNOUNCED_KEY = 'announced_article_slugs';

function stripHtml(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Telegram message: punchy headline + first lines of the summary + link */
function buildMessage(a, siteUrl) {
  const url = `${siteUrl}/news-article.html?slug=${a.slug}`;
  const flag = a.league?.flag || '\u26BD';
  const league = a.league?.name || 'Football';
  const teaser = stripHtml(a.summary).substring(0, 160);
  return (
    `${flag} *${a.title.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1')}*\n\n` +
    `${league} \u00b7 ${a.category || 'News'} \u00b7 ${a.readTime || '5 min'}\n\n` +
    `${teaser}${teaser.length >= 160 ? '\u2026' : ''}\n\n` +
    `\u{1F517} ${url}\n\n` +
    `_Real match data. Real scores. Zero fabrication._`
  );
}

/**
 * Announce every not-yet-announced article (newest first, max 3 per run).
 * Called after each generation run and after each match-updater publish.
 */
async function announceNewArticles() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const channel = process.env.TELEGRAM_CHANNEL;
  if (!token || !channel) return { posted: 0, skipped: true };

  try {
    const meta = await loadMeta();
    const announced = new Set(meta[ANNOUNCED_KEY] || []);
    const articles = (await loadArticles()).filter(a => !announced.has(a.slug)).slice(0, 3);

    const siteUrl = process.env.SITE_URL || 'https://propredict-app.onrender.com';
    let posted = 0;

    for (const a of articles) {
      try {
        await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
          chat_id: channel,
          text: buildMessage(a, siteUrl),
          parse_mode: 'MarkdownV2',
          disable_web_page_preview: false
        }, { timeout: 15000 });
        announced.add(a.slug);
        posted++;
        console.log(`\u{1F4E3} Announced to Telegram: ${a.slug}`);
      } catch (err) {
        const desc = err.response?.data?.description || err.message;
        console.error(`Telegram announce failed (${a.slug}): ${desc}`);
        // 400/403 = bad chat id or markdown issue — do not retry-spam; mark tried once
        if (err.response?.status === 400 || err.response?.status === 403) {
          announced.add(a.slug);
        } else {
          break; // network issue — stop, next run retries
        }
      }
    }

    if (posted > 0 || announced.size !== (meta[ANNOUNCED_KEY] || []).length) {
      meta[ANNOUNCED_KEY] = Array.from(announced).slice(-500);
      await saveMeta(meta);
    }
    return { posted };
  } catch (err) {
    console.error('Telegram announce run error:', err.message);
    return { posted: 0, error: err.message };
  }
}

module.exports = { announceNewArticles };
