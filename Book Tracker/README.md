# Book Tracker

A reading tracker for PDFs, Word docs, text files, and images: resumes
exactly where you left off, with a highlighter, notes, and optional
AI assist (explain / summarize / translate a selection).

## Structure

```
frontend/    the app itself — open frontend/index.html directly, or serve the folder
backend/     small server that holds your API keys for the AI features
```

## Try it right now (no backend needed)

Open `frontend/index.html` in a browser. Everything works except the
three ✦ AI buttons (Explain / Summarize / Translate) — highlighting,
notes, progress tracking, and reopening books all work fully offline
using the browser's own storage.

## Turning on AI features

1. `cd backend && npm install`
2. `cp .env.example .env` and paste in an Anthropic API key (and a
   Google Cloud Translation key if you want translation too)
3. `npm start`
4. In the app, click the ⚙ icon → paste `http://localhost:8787` into
   "AI backend URL" → Done.

Full deploy instructions (Render/Railway/Fly) are in `backend/README.md`.

## Installing it like an app

Once you're serving `frontend/` over `https://` (localhost also works),
Chrome/Edge/Android will offer an "Install app" prompt automatically —
or use the "Install app" button that appears in the library screen.
That gives you a real icon, offline support, and full-screen mode
without an app store.

## What's real vs. what's still a placeholder

- **Real**: file persistence (IndexedDB — the actual book file is
  stored, not just your progress), highlight/notes with exact-position
  restore, PDF/DOCX/text/image reading, offline app shell via the
  service worker, install-to-home-screen.
- **Placeholder, wired for later**: "Sign in with Google" button is
  visibly disabled — real auth needs an OAuth flow through the backend,
  which is the natural next milestone once this feels solid.
- **Honest limitation**: browser storage isn't infinite. Very large
  files may fail to persist (the app tells you when this happens and
  falls back to "reopen manually").

## Next steps toward Play Store / App Store

See the conversation this was built in for the reasoning — short version:
Android via Bubblewrap/PWABuilder (wraps this as-is), iOS via Capacitor
(same codebase, adds a native bridge for file access, share sheet, and
push notifications when you're ready for those).
