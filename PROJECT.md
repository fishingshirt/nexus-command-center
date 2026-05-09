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

### X. Phone Bridge (ADB Android Control)
**User directive.** Controls a connected Android phone via ADB from the dashboard and agent.

**Capabilities:**
- Detect ADB connection (USB or wireless) with auto-pair on port 5555
- Display phone status: battery level, charging state, signal strength, carrier, Android version
- Read SMS inbox from connected Android device via `adb shell content query`
- Send SMS text messages to specific phone numbers via `adb shell am start` + broadcast
- One-way message log (inbox read-only) + two-way messaging (send from dashboard)
- Per-contact conversation threads with chat-bubble layout

**Dashboard UI:**
- Connection status dot (green `connected`, amber `pairing`, red `disconnected`)
- Phone info panel: battery percentage (with icon), signal bars, carrier name
- SMS Inbox list: contact name, message snippet, timestamp, unread indicator
- Compose view: To field, message body, send button (only active when connected)
- Thread view: chat-bubble layout with incoming/outgoing colors

**Backend API endpoints** (extend `nexus-server.py`):
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/adb/status` | GET | `{connected: bool, deviceId: string, battery: number,charging:bool,signal:number,carrier:string,androidVersion:string,lastSeenAt:ISO}` |
| `/api/adb/sms/read` | GET | Returns array of SMS objects `{id,address,body,date,read,type}` |
| `/api/adb/sms/send` | POST | Body `{to: string, body: string}` → sends SMS via ADB Intent |
| `/api/adb/contacts` | GET | Returns contact list `{name, phone}` for address-to-name mapping |

**Security/Constraints:**
- ADB daemon runs on host machine; Python server shells out to `adb` binary
- Only local dashboard can reach the API (CORS allow `localhost:8080`)
- SMS send requires explicit user confirmation in UI (no agent-initiated "surprise" texts without user approval)
- Agent can read messages but cannot auto-send without user clicking Send

**Settings Schema addition:**
```json
"phoneBridge": {
  "enabled": false,
  "deviceId": null,
  "connectionMode": "usb",
  "wirelessHost": null,
  "wirelessPort": 5555,
  "autoConnect": true,
  "lastSyncAt": null,
  "status": "disconnected"
}
```

**Agent Note:** `T-024` breaks into `T-024-a` through `T-024-f`. Start with `T-024-b` (API) so dashboard can develop UI against real data.

### XI. Smart PDF Editor
**User directive.** Upload a PDF and tell the agent what to change — it loads PDF skills (`nano-pdf`, `pymupdf`) to edit.

**Capabilities:**
- Drag-and-drop PDF upload with thumbnail preview
- Natural language instruction parser: "change title to X", "merge with doc2.pdf", "extract pages 3-5", "OCR and replace text"
- Backend executes edits via Python `pymupdf` / `nano-pdf` CLI
- Version history: every edit creates a new version, user can rollback
- Preview edited PDF inline (`<iframe>` or `<canvas>`)
- Download final PDF

**Dashboard UI:**
- Upload dropzone: dashed border, file icon, "Drop PDF here"
- PDF library grid: thumbnails of uploaded PDFs with last-edited date
- Instruction input: text area with placeholder "What would you like to change?"
- Status indicator: `queued` → `editing` → `ready` → `error`
- Preview panel: rendered PDF with page flip controls
- Version dropdown: select previous version to restore
- Download button next to preview

**Backend API endpoints** (extend `nexus-server.py`):
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/pdf/upload` | POST | Accepts multipart PDF file, saves to disk, returns `{pdfId}` |
| `/api/pdf/list` | GET | Returns array of uploaded PDFs `{id, name, pages, uploadedAt, versions[]}` |
| `/api/pdf/edit` | POST | Body `{pdfId, instruction}` → agent processes, returns `{editId, status}` |
| `/api/pdf/edit/:id` | GET | Poll status of running edit job |
| `/api/pdf/download/:pdfId/:version` | GET | Download specific version of PDF |
| `/api/pdf/rollback/:pdfId` | POST | Restore to specified version index |

**Agent Note:** `T-025` breaks into `T-025-a` through `T-025-d`. Install `pymupdf` via `uv pip install pymupdf` on the host if missing. PDF files stored in `/tmp/nexus-command-center/data/pdfs/`.

### XII. Mini Games Arcade
**User directive.** A dedicated "Arcade" app tab filled with quick casual games to keep the user busy during downtime.

**Games (launch v1):**
| Game | Controls | Style |
|------|----------|-------|
| **Snake** | Arrow keys / swipe | Canvas, particles on eat, speed ramps |
| **Pong** | Mouse drag / touch | vs CPU, 3 difficulty levels |
| **Tetromino** | Tap rotate, swipe move/drop | 7-bag randomizer, hold piece, next preview, line clear scoring |
| **Minesweeper** | Click reveal, right-click/long-press flag | DOM grid, 3 difficulties, chord reveal, timer |
| **2048** | Arrow keys / swipe | Smooth CSS transforms, undo once, score tracking |
| **Typing Speed** | Keyboard only | WPM + accuracy against timer or sentences |
| **Reaction Time** | Click when green | Average of 5 rounds, anti-cheat for early clicks |

**Dashboard UI:**
- Arcade cabinet header with neon glow title
- 3x3 (or scrollable) grid of game cards
- Each card: game icon, best score, "PLAY" button
- Fullscreen game overlay when launched
- Pause button → mini overlay with Resume / Quit / Settings
- Post-game score screen with "Play Again" and "Back to Arcade"
- High score leaderboard per game in `localStorage` (top 10)

**Tech:** Each game is a self-contained ES module exporting `init(canvas, onScore, onQuit)`. Zero dependencies. Canvas games handle HiDPI scaling.

**Agent Note:** `T-026` breaks into `T-026-a` through `T-026-i`. Start with `T-026-a` (shell) then `T-026-b` through `T-026-i` (one per cycle).

### XIII. Work Simulator
**User directive.** "Paranoia / theater mode" — make it look like you're deep in important work so shoulder surfers leave you alone.

**Simulation Modes:**
| Mode | Visual | Behavior |
|------|--------|----------|
| **Fake IDE** | Full-screen editor with syntax highlighting, file tabs, sidebar with fake errors/warnings | Auto-types realistic code (Python/JS/Rust) with occasional backspace mistakes. Blinking cursor. Green build success flashes in status bar. |
| **Fake Terminal** | Full-screen terminal with green/white text on dark bg | Streams npm install, docker build, git push, pytest output. Auto-scroll. Green checkmarks. Occasional yellow warnings. |
| **Fake Dashboard** | Grid of metric cards, build pipelines, deploy status | CSS bar charts fluctuate randomly. Progress bars fill. "Build #4827 passed" toasts. Red/amber/green health dots. |
| **Fake Spreadsheet** *(Boss Key)* | Excel/Google Sheets clone full of numbers | `Ctrl+B` or `Ctrl+~` instant switch. Fake sales/revenue data. Looks exactly like real work. |

**Shared Features:**
- **Boss Key** (`Ctrl+B` / `Ctrl+~`): instant swap to Fake Spreadsheet
- **Panic/Chill Slider** (1-5): controls typing speed, notification frequency, scroll speed
- **Fake Chat Notifications**: Slack/Discord-style corner toasts: "Build deployed", "PR approved", "CI green"
- **Auto-Rotate**: cycles modes every N minutes
- **Quick toggle**: from dashboard header or Settings — one click to enter Work Sim

**Dashboard UI:**
- Full-screen takeover when activated
- Mode picker overlay on first launch
- Bottom control bar: mode selector, panic slider, boss key hint, exit button
- Exit requires 3-second press-and-hold (prevents accidental exits)

**Agent Note:** `T-027` breaks into `T-027-a` through `T-027-g`. Start with `T-027-a` (launcher shell) then the modes. Pre-baked content lives in `public/assets/work-sim/`.

### XIV. Additional Mini Games Backlog
**User directive.** More games for future Arcade expansion. Lower priority until v1 Arcade is live.

| Game | Desc |
|------|------|
| Breakout | Paddle + bricks, power-ups, levels |
| Space Shooter | Horizontal scroller, enemies, bullets |
| Memory Match | Card flip matching, timer, moves counter |
| Word Scramble | Unscramble words against timer |
| Trivia Quiz | Multiple choice, categories, streak counter |
| Sudoku | Generator + solver hint, 4 difficulties |

**Agent Note:** `T-028` breaks into `T-028-a` through `T-028-f`. Pick up after `T-026` is complete.

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
