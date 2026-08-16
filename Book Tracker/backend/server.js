// Book Tracker backend
// Holds API keys server-side and proxies requests from the frontend.
// The frontend NEVER sees GROQ_API_KEY or GOOGLE_TRANSLATE_API_KEY —
// that's the whole reason this server exists.

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(express.json({ limit: '2mb' }));

const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
app.use(cors({ origin: allowedOrigin }));

const GROQ_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

async function askGroq(prompt, maxTokens) {
  const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_KEY}`
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens
    })
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error?.message || 'Groq API error');
  const text = data?.choices?.[0]?.message?.content || '';
  if (!text) throw new Error('Groq returned an empty response.');
  return text;
}

// ---- very small in-memory rate limiter (per IP) ----
// Good enough for a personal project. Swap for a real store (Redis) before
// this has more than a handful of users.
const hits = new Map();
function rateLimit(req, res, next) {
  const ip = req.ip;
  const now = Date.now();
  const windowMs = 60_000;
  const max = 20;
  const entry = hits.get(ip) || { count: 0, reset: now + windowMs };
  if (now > entry.reset) { entry.count = 0; entry.reset = now + windowMs; }
  entry.count += 1;
  hits.set(ip, entry);
  if (entry.count > max) {
    return res.status(429).json({ error: 'Too many requests — slow down a little.' });
  }
  next();
}
app.use(rateLimit);

function badRequest(res, msg) { return res.status(400).json({ error: msg }); }

// ---------- AI: summarize ----------
app.post('/api/summarize', async (req, res) => {
  const { text } = req.body || {};
  if (!text || typeof text !== 'string') return badRequest(res, 'Missing "text"');
  if (text.length > 20000) return badRequest(res, 'Selection too long — try a shorter passage.');
  try {
    const summary = await askGroq(
      `Summarize the following passage in 3-5 concise sentences. Do not add commentary before or after the summary.\n\n${text}`,
      400
    );
    res.json({ summary });
  } catch (err) {
    console.error('summarize error', err);
    res.status(502).json({ error: 'Summarization failed. Try again in a moment.' });
  }
});

// ---------- AI: explain ----------
app.post('/api/explain', async (req, res) => {
  const { text, context } = req.body || {};
  if (!text || typeof text !== 'string') return badRequest(res, 'Missing "text"');
  if (text.length > 20000) return badRequest(res, 'Selection too long — try a shorter passage.');
  try {
    const prompt = context
      ? `Explain the following passage clearly, in plain language, as if to someone unfamiliar with the topic. Use this surrounding context if it helps: "${context.slice(0, 1000)}"\n\nPassage to explain:\n${text}`
      : `Explain the following passage clearly, in plain language, as if to someone unfamiliar with the topic:\n\n${text}`;
    const explanation = await askGroq(prompt, 500);
    res.json({ explanation });
  } catch (err) {
    console.error('explain error', err);
    res.status(502).json({ error: 'Explanation failed. Try again in a moment.' });
  }
});

// ---------- AI: define ----------
app.post('/api/define', async (req, res) => {
  const { word, context } = req.body || {};
  if (!word || typeof word !== 'string') return badRequest(res, 'Missing "word"');
  if (word.length > 200) return badRequest(res, 'That\'s too long for a definition — try a shorter word or phrase.');
  try {
    const prompt = context
      ? `Give a short dictionary-style definition of "${word}" as used in this context: "${context.slice(0, 400)}". Format: part of speech, then a one-sentence definition, then a short example sentence. No preamble.`
      : `Give a short dictionary-style definition of "${word}". Format: part of speech, then a one-sentence definition, then a short example sentence. No preamble.`;
    const definition = await askGroq(prompt, 200);
    res.json({ definition });
  } catch (err) {
    console.error('define error', err);
    res.status(502).json({ error: 'Definition lookup failed. Try again in a moment.' });
  }
});

// ---------- AI: image prompt (for cover-art generation) ----------
app.post('/api/image-prompt', async (req, res) => {
  const { text, title } = req.body || {};
  if (!text || typeof text !== 'string') return badRequest(res, 'Missing "text"');
  const sample = text.slice(0, 4000);
  try {
    const prompt = await askGroq(
      `You are writing a prompt for an AI image generator to create cover art for a document titled "${title||'Untitled'}". ` +
      `Based on its themes and content below, write ONE vivid, evocative image-generation prompt (under 60 words). ` +
      `Describe mood, subject, color palette, and art style (e.g. "digital painting", "minimalist poster", "cinematic illustration"). ` +
      `Do NOT ask for any text, words, letters, or titles to appear in the image — image models render text badly. ` +
      `Do NOT reference real, named public figures. Return ONLY the prompt text, nothing else.\n\nDocument excerpt:\n${sample}`,
      150
    );
    res.json({ prompt: prompt.trim() });
  } catch (err) {
    console.error('image-prompt error', err);
    res.status(502).json({ error: 'Prompt generation failed. Try again in a moment.' });
  }
});

// ---------- Translate ----------
app.post('/api/translate', async (req, res) => {
  const { text, target } = req.body || {};
  if (!text || typeof text !== 'string') return badRequest(res, 'Missing "text"');
  if (!target || typeof target !== 'string') return badRequest(res, 'Missing "target" language code');
  if (text.length > 20000) return badRequest(res, 'Selection too long — try a shorter passage.');

  const key = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (!key) {
    // Fall back to Groq itself for translation, so this still works with
    // just the one free Groq key and no separate Translate API billing.
    try {
      const translated = await askGroq(
        `Translate the following text into language code "${target}". Return ONLY the translated text, nothing else.\n\n${text}`,
        1000
      );
      return res.json({ translated });
    } catch (err) {
      console.error('gemini translate fallback error', err);
      return res.status(502).json({ error: 'Translation failed. Try again in a moment.' });
    }
  }

  try {
    const resp = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: text, target, format: 'text' })
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data?.error?.message || 'Translate API error');
    const translated = data.data.translations[0].translatedText;
    res.json({ translated });
  } catch (err) {
    console.error('translate error', err);
    res.status(502).json({ error: 'Translation failed. Try again in a moment.' });
  }
});

// ---------- Auth: verify a Google Sign-In ID token ----------
// Uses Google's tokeninfo endpoint for verification — simplest option with
// zero new dependencies. Fine for personal/small-scale use; if this app
// ever serves many users, swap to the google-auth-library package instead
// (tokeninfo has lower rate limits and is meant for debugging more than
// high-volume production verification).
app.post('/api/auth/google', async (req, res) => {
  const { idToken } = req.body || {};
  if (!idToken) return badRequest(res, 'Missing "idToken"');
  try {
    const resp = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
    const data = await resp.json();
    if (!resp.ok || data.error) throw new Error(data.error_description || 'Invalid token');

    // If GOOGLE_CLIENT_ID is set, enforce that the token was actually issued
    // for THIS app (not some other Google-signed token) — real security.
    // If unset, this check is skipped (fine for early local testing, but
    // set it before this ever leaves your machine).
    if (process.env.GOOGLE_CLIENT_ID && data.aud !== process.env.GOOGLE_CLIENT_ID) {
      return res.status(401).json({ error: 'Token was not issued for this app.' });
    }
    if (data.email_verified !== 'true' && data.email_verified !== true) {
      return res.status(401).json({ error: 'Google account email is not verified.' });
    }

    res.json({ email: data.email, name: data.name, picture: data.picture, sub: data.sub });
  } catch (err) {
    console.error('google auth verify failed', err);
    res.status(401).json({ error: 'Could not verify Google sign-in.' });
  }
});

app.get('/health', (req, res) => res.json({ ok: true }));

const port = process.env.PORT || 8787;
app.listen(port, () => console.log(`Book Tracker backend listening on :${port}`));