# ◈ Nexus Command Center

Your personal AI-powered dashboard. Adaptive, scalable, and yours.

Built to run on your own hardware, accessible from any device — computer, phone, tablet. An AI agent works in the background to improve it every day.

---

## Quick Start

```bash
# Clone
git clone https://github.com/fishingshirt/nexus-command-center.git
cd nexus-command-center

# Run with Docker
docker-compose up -d

# Open in browser
open http://localhost:8080
```

---

## What It Is

A self-hosted progressive web app that starts as a simple dashboard and grows with you:

- **Calendar** — plan your days, events, recurring items
- **Notes** — capture ideas, organize with folders/tags
- **To-Do** — track tasks, priorities, sub-tasks
- **Hermes Chat** — talk to your AI agent, start fresh with `/new`
- **Themes** — 6 built-in themes, from professional to retro arcade
- **PWA** — install on your phone's home screen
- **Settings** — export/import data, reset welcome screen, accessibility toggles

---

## Architecture

| Layer | Tech |
|-------|------|
| Frontend | HTML5, CSS3 (custom properties), Vanilla ES modules |
| Icons | Inline SVG (no icon library dependency) |
| Fonts | Inter + JetBrains Mono via Google Fonts |
| Storage | `localStorage` (v1) → server-side JSON/SQLite (v2) |
| Server | nginx static file serve |
| Container | Docker + docker-compose |

---

## Project Files

| File | Purpose |
|------|---------|
| `WHITEBOARD.md` | Agent command center — tasks, bugs, ideas |
| `PROJECT.md` | Full product specification |
| `AGENT_GUIDELINES.md` | Rules for the AI agent working on this project |
| `public/index.html` | Main dashboard shell |
| `public/css/base.css` | Core layout, components, utilities |
| `public/css/themes/*.css` | Theme variable overrides |
| `public/js/app.js` | Router, theme engine, settings, welcome, chat |
| `public/sw.js` | Service worker for offline/PWA |
| `public/manifest.json` | PWA manifest |
| `Dockerfile` | nginx container build |
| `docker-compose.yml` | One-command deploy |
| `nginx.conf` | Static file server + SPA fallback |

---

## Themes

| Theme | Vibe |
|-------|------|
| `professional` | Clean, modern, default |
| `midnight-hacker` | Cyberpunk terminal |
| `sakura-garden` | Soft, calming, pink |
| `space-odyssey` | Cosmic, vast, gold |
| `retro-arcade` | 80s neon nostalgia |
| `ocean-breeze` | Fresh, airy, teal |

---

## Development

No build step. Edit files directly, refresh browser.

```bash
# Live server for development (optional)
npx serve public
```

---

## Agent Workflow

1. Read `WHITEBOARD.md`
2. Pick highest-priority pending task
3. Implement, test, commit
4. Update `WHITEBOARD.md`
5. Sleep

See `AGENT_GUIDELINES.md` for full rules.

---

*Built by AI, for you.*
