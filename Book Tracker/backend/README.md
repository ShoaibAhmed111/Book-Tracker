# Book Tracker — backend

A small Express server with four endpoints. Its only job is to keep your
API keys off the client. Runs on **Groq** (free tier, fast inference,
no billing card required, no regional gating).

- `POST /api/summarize` `{ text }` → `{ summary }`
- `POST /api/explain` `{ text, context? }` → `{ explanation }`
- `POST /api/define` `{ word, context? }` → `{ definition }`
- `POST /api/translate` `{ text, target }` → `{ translated }`
- `GET /health` → `{ ok: true }`

## Run it locally

```bash
cd backend
npm install
cp .env.example .env
# edit .env and paste in your GROQ_API_KEY (get one free at https://console.groq.com/keys)
npm start
```

It listens on `http://localhost:8787` by default. Open the frontend, go to
Settings inside the app, and paste that URL into "AI backend URL".

Translation uses Groq directly by default, so `GOOGLE_TRANSLATE_API_KEY`
can stay blank — only set it if you specifically want Google's dedicated
Translate API instead.

The model defaults to `llama-3.3-70b-versatile`. You can point at a
different Groq-hosted model by setting `GROQ_MODEL` in `.env` — see
https://console.groq.com/docs/models for what's available.

## Deploying it for real

Any place that can run a small Node process works. Easiest options, roughly
in order of least setup:

- **Render** (render.com) — connect the repo, set it as a "Web Service",
  add the env vars in its dashboard. Free tier sleeps when idle, which
  is fine for personal use.
- **Railway** (railway.app) — similar, very quick from a GitHub repo.
- **Fly.io** — a bit more control, still simple for a single small service.

Whichever you use:
1. Set `GROQ_API_KEY` (and `GOOGLE_TRANSLATE_API_KEY` if you're using it)
   as environment variables in that platform's dashboard — never in code,
   never in the repo.
2. Set `ALLOWED_ORIGIN` to the exact URL your frontend is hosted at, once
   you know it (this stops other websites from riding on your API key).
3. Copy the deployed URL into the app's Settings → AI backend URL field.

## Rate limiting

There's a bare-bones per-IP limiter in `server.js` (20 requests/minute).
It's in-memory, so it resets on every restart and won't work correctly if
you ever run more than one server instance. Fine for one person's use;
swap in a Redis-backed limiter before sharing this with others.

Groq's own free-tier limits are separate and generous, but still finite —
if you hit them, `/api/*` calls will return an error until the quota resets.
