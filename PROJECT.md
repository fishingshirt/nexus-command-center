# PROJECT SPEC — Nexus Command Center

> **Personal AI-Powered Dashboard**
> *Adaptive. Scalable. Yours.*

---

## 🎯 Vision

A self-hosted personal dashboard that lives on your devices — computer, phone, tablet — and gets better every day with an AI agent working in the background. It starts simple (calendar, notes, to-do, chat) but is built to grow into your digital command center.

The first time you open it, you're greeted with a cinematic welcome: ambient music, a tagline, and the promise of an AI that adapts, learns, and builds alongside you. From then on, it's your daily driver.

---

## 🏗️ Architecture Principles

| Principle | Implementation |
|-----------|----------------|
| **No Build Step** | Pure HTML/CSS/JS. No webpack, no npm install hell. Any device can edit it. |
| **Mobile-First** | Designed for 375px screens first, then scaled up to desktop. |
| **Pluggable Apps** | Each app (calendar, notes, etc.) is a self-contained module. Add new ones without touching existing code. |
| **Theme Engine** | CSS custom properties drive all visual theming. New themes = one CSS file. |
| **Progressive Web App** | Installable on phone home screen. Works offline. Feels like a native app. |
| **Docker-Hosted** | Single `docker-compose up` deploys everything. Runs on any machine with Docker. |
| **Data Ownership** | All data stored locally first. No external APIs required for core functionality. |
| **Hermes Integration** | Built-in chat widget talks to Hermes agent. `/new` starts fresh conversations. |

---

## 📱 Apps (v1.0)

### 1. Calendar
- Month / Week / Day views
- Create, edit, delete events
- Color-coded categories (work, personal, health, etc.)
- Recurring events (daily, weekly, monthly)
- Notifications / reminders (browser notification API)
- **Google Calendar integration**
  - Settings panel with Google OAuth2 / API key input for auth
  - Manual sync button (pull events from Google Calendar)
  - Auto-sync on interval (configurable, default 15 minutes)
  - Sync status indicator: `unlinked` → `linking` → `linked` / `synced` / `error`
  - Two-way sync: push Nexus events to Google, pull Google events to Nexus
  - Conflict resolution: last-write-wins with visual diff option
  - Falls back to localStorage when offline or unauthenticated
- Persist to `localStorage` (v1), migrate to server DB (v2)

### 2. Notes
- Rich text or Markdown editor
- Folders / notebooks for organization
- Tags for cross-cutting concerns
- Full-text search
- Auto-save with indicator
- Persist to `localStorage` (v1), migrate to server DB (v2)

### 3. To-Do List
- Multiple lists (e.g. "Today", "Work", "Shopping")
- Priorities: Low / Medium / High / Critical
- Due dates with calendar integration
- Sub-tasks (checklist within a task)
- Recurring tasks
- Drag-and-drop reorder
- Progress bars per list
- Persist to `localStorage` (v1), migrate to server DB (v2)

### 4. Hermes Chat
- Fixed bottom-right chat bubble / window
- Message history persists to `localStorage`
- `/new` command clears history and starts fresh
- Sends messages to Hermes (via Telegram bot bridge or webhook — TBD)
- Typing indicator
- Code block formatting
- File attachment (drag-and-drop or paste)

---

## 📱 Apps (v2.0+ — Backlog)

- **Weather Widget** — current + 5-day forecast
- **Music Player** — Spotify integration or local audio
- **RSS Reader** — news / blog aggregator
- **Finance Tracker** — expenses, budgets, charts
- **Habit Tracker** — streaks, visual grids
- **AI Task Suggester** — analyzes patterns, suggests improvements
- **File Manager** — browse server filesystem (if hosted locally)
- **Terminal** — web-based terminal to the host machine (dangerous but useful)

---

## 🎨 Themes

### Default: Professional
- Clean whites, subtle grays, navy accents
- Sans-serif typography (Inter or system-ui)
- Subtle shadows, rounded corners (8px)
- High contrast for readability

### Alternate Themes
| Theme | Vibe | Color Palette |
|-------|------|---------------|
|| **Midnight Hacker** | Cyberpunk terminal | Black bg, neon green (#00ff41), dark purple accents |
|| **Sakura Garden** | Soft, calming | Pink/rose bg, warm whites, cherry blossom accents |
|| **Space Odyssey** | Cosmic, vast | Deep navy bg, starfield white, orbital gold accents |
|| **Retro Arcade** | 80s nostalgia | Dark bg, hot pink, cyan, grid lines, pixel font accents |
|| **Ocean Breeze** | Fresh, airy | Teal/seafoam bg, sandy beige, wave blues |
|| **Jarvis** | Iron Man HUD, futuristic | Near-black bg, electric arc-blue (#39d0f2), holographic glows, HUD grid lines, monospace accents |

Each theme is a single CSS file that overrides CSS custom properties in `:root`. The base CSS uses variables for every color, spacing, radius, and shadow. Adding a new theme takes 5 minutes.

---

## ⚙️ Settings

Stored in `localStorage` under key `ncc-settings`.

```json
{
  "theme": "professional",
  "reducedMotion": false,
  "showWelcomeOnBoot": false,
  "chatPosition": "bottom-right",
  "pinnedApps": ["calendar", "notes", "todo"],
  "notificationsEnabled": true,
  "language": "en",
  "integrations": {
    "googleCalendar": {
      "enabled": false,
      "clientId": "",
      "apiKey": "",
      "accessToken": "",
      "refreshToken": "",
      "syncIntervalMinutes": 15,
      "lastSyncAt": null,
      "syncStatus": "unlinked"
    }
  }
}
```

### Settings UI
- Slide-out panel from right edge
- Sections: **Appearance**, **Apps**, **Integrations**, **Notifications**, **Data**, **About**
- **Appearance**
  - Theme picker (dropdown)
  - Reduce animations toggle
- **Apps**
  - Pin/favorite apps reordering
  - Per-app notification toggles
- **Integrations** *(new — T-009-e)*
  - **Google Calendar**
    - Status badge: `🔗 Linked` / `⛓️ Unlinked` / `⏳ Syncing…` / `❌ Auth Error`
    - Connect / Disconnect button
    - Manual sync button
    - Auto-sync interval picker (5 / 15 / 30 / 60 minutes)
    - Last sync timestamp
    - Raw Google Calendar API token input (advanced — for users who prefer manual token paste)
    - OAuth2 flow button (preferred — opens Google auth popup)
- **Data**
  - Reset Welcome Screen toggle
  - Export Data (JSON download)
  - Import Data (JSON file picker)
  - Clear All Data (confirmation modal)
- **About**
  - Version, build info

---

## 🎬 Welcome / Onboarding Experience

**Trigger:** First visit (or when "Reset Welcome Screen" is enabled)

**Flow:**
1. Black screen fades in
2. Ambient generative music starts (Web Audio API — 5-10 seconds, looping)
3. Tagline types out: *"Adapt. Learn. Build."*
4. Subtitle fades in: *"Your personal command center. An AI agent works in the background to make it better, every day."*
5. CTA button: *"Enter the Nexus"* — pulses gently
6. On click: music fades, screen transitions to dashboard

**Accessibility:**
- `prefers-reduced-motion` → skip animations, show static version
- `prefers-reduced-motion` → mute audio
- Skip button always visible (top-right "Skip Intro")

---

## 💬 Hermes Chat Integration

### v1: Local-Only Chat
- Chat widget stores conversation in `localStorage`
- Messages are displayed but NOT sent anywhere yet
- User can type, see their messages, and later we'll wire to Hermes

### v2: Hermes Bridge
Options to research:
1. **Telegram Bot API** — dashboard sends messages to a Telegram bot that forwards to Hermes
2. **Hermes Webhook** — if Hermes exposes a webhook endpoint, POST messages directly
3. **Local WebSocket** — Hermes listens on a local port, dashboard connects via WebSocket
4. **Discord DM** — send messages to Hermes via Discord API

**Preferred:** Option 1 or 3. Start with Option 1 (Telegram bot) because it's already connected.

---

## 🐳 Docker Setup

### `Dockerfile`
```dockerfile
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY public /usr/share/nginx/html
EXPOSE 8080
```

### `docker-compose.yml`
```yaml
version: "3.8"
services:
  nexus:
    build: .
    ports:
      - "8080:8080"
    volumes:
      - nexus-data:/usr/share/nginx/html/data
    restart: unless-stopped

volumes:
  nexus-data:
```

### `nginx.conf`
- Serve static files from `/usr/share/nginx/html`
- Gzip compression for CSS/JS
- Cache headers for assets
- SPA fallback: `try_files $uri $uri/ /index.html`

---

## 📱 PWA Checklist

- [x] `manifest.json` with name, icons, theme color, display mode (standalone)
- [x] `theme-color` meta tag matching current theme
- [x] Service worker (`sw.js`) caching static assets
- [x] Icons: 192x192, 512x512 (SVG preferred, PNG fallback)
- [x] Apple touch icon
- [x] `standalone` display mode so it hides browser chrome

---

## 🧪 Quality Gates

Before marking any task complete, verify:

1. **Mobile Test** — Chrome DevTools, iPhone SE (375×667) and iPad (768×1024)
2. **Desktop Test** — 1920×1080 and 2560×1440
3. **Theme Test** — Switch through ALL themes, verify no broken colors
4. **Accessibility Test** — Lighthouse audit ≥ 90, keyboard navigable, color contrast OK
5. **Performance Test** — First Contentful Paint < 1.5s, no layout shift
6. **Console Test** — Zero errors, zero warnings
7. **Storage Test** — `localStorage` doesn't exceed 4MB quota
8. **Offline Test** — Disable network, reload, verify app shell loads

---

## 📋 Tech Stack Summary

| Layer | Technology |
|-------|------------|
| Frontend | HTML5, CSS3 (custom properties), Vanilla JS (ES modules) |
| UI Framework | None — custom lightweight components |
| Icons | Phosphor Icons or Heroicons (CDN, SVG) |
| Fonts | Google Fonts (Inter, JetBrains Mono for code) |
| Storage | `localStorage` (v1) → SQLite/JSON (v2) |
| Backend | nginx static file server (v1) → optional Node/Python API (v2) |
| Container | Docker + docker-compose |
| CI/CD | GitHub Actions (lint, test, build) |

---

## 🗣️ Hermes Agent Responsibilities

The AI agent assigned to this project will:

1. Read `WHITEBOARD.md` every wake cycle
2. Execute highest-priority pending tasks
3. Check for bugs after every change (console, responsive, accessibility)
4. Suggest missing features and add them to the backlog
5. Break large tasks into sub-tasks (max ~2 hours each)
6. Commit with descriptive messages
7. Update `WHITEBOARD.md` with progress
8. Research integrations (Hermes bridge, APIs) when stuck
9. Never compromise on mobile-first design
10. Prioritize user experience over technical cleverness

---

*Version: 1.0*
*Last Updated: 2026-05-09*
