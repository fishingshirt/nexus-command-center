# 🤖 AGENT GUIDELINES — Nexus Command Center

> **Mandatory reading for every agent wake cycle.**
> These rules are non-negotiable. They exist to protect code quality, user experience, and project sanity.

---

## 1. AGENT BEHAVIOR PRINCIPLES

### 1.1 — Read Before You Act
Every single wake cycle, you MUST read:
1. `WHITEBOARD.md` — current status, task board, bug tracker
2. This file (`AGENT_GUIDELINES.md`) — rules reminder
3. `PROJECT.md` — if you need architectural context

You do NOT act on memory from a previous cycle. The whiteboard is the source of truth.

### 1.2 — One Task Per Cycle
Focus on exactly ONE task at a time. Complete it fully, update the whiteboard, commit, then sleep. Context-switching creates bugs.

### 1.3 — No Silent Work
Everything you do must be documented in `WHITEBOARD.md`:
- Task status updates
- New bugs discovered
- New feature ideas
- Research findings
- Sub-tasks created

### 1.4 — Commit Often
After any meaningful chunk of work (even a single file change), commit:
```bash
git add .
git commit -m "[T-001] Add theme engine base CSS variables"
```
Use the task ID in the commit message.

### 1.5 — Never Break the Build
If you can't finish a task in one cycle, leave the code in a working state. Comment out WIP code if needed. A broken dashboard is worse than a missing feature.

---

## 2. TASK MANAGEMENT RULES

### 2.1 — Task Size Limits
A single task must be completable in **≤ 2 hours** or **≤ 200 lines of code change**.

If a task is larger, you MUST break it down:

```markdown
| ID | Task | Status | Notes |
|----|------|--------|-------|
| T-009 | Calendar app | IN_PROGRESS | Broken into sub-tasks below |
| T-009-a | Calendar month grid renderer | PENDING | |
| T-009-b | Calendar event CRUD modal | PENDING | |
| T-009-c | Calendar localStorage persistence | PENDING | |
| T-009-d | Calendar view switcher (month/week/day) | PENDING | |
```

### 2.2 — Task Breakdown Template
When creating sub-tasks, include:
- Clear acceptance criteria ("what does 'done' look like?")
- Files you expect to touch
- Estimated time
- Dependencies on other sub-tasks

### 2.3 — Priority Overrides
Critical tasks (`🔴`) ALWAYS come before High (`🟡`) and Low (`🟢`).

Exception: If a bug in `🟡` or `🟢` is blocking a `🔴` task, fix the bug first.

### 2.4 — Research Tasks
If a task requires research (e.g. "how to bridge chat to Hermes"), create a dedicated research sub-task:

```markdown
| ID | Task | Status | Notes |
|----|------|--------|-------|
| T-012 | Hermes API bridge | IN_PROGRESS | |
| T-012-a | Research Telegram Bot API for message forwarding | IN_PROGRESS | |
| T-012-b | Implement bridge prototype | PENDING | Blocked by T-012-a |
```

Research findings go in the AGENT NOTES section of `WHITEBOARD.md`.

---

## 3. BUG DETECTION PROTOCOL

### 3.1 — After Every Code Change, Check:

**A. Console Errors**
```javascript
// Open browser DevTools → Console
// Look for:
// - Uncaught TypeError
// - ReferenceError
// - Failed to load resource (404)
// - CORS errors
```
If any error exists, fix it immediately. Do NOT proceed to the next task with console noise.

**B. Responsive Layout**
```
Test at:
- 375px  (iPhone SE — most constrained)
- 768px  (iPad — tablet breakpoint)
- 1440px (laptop — common desktop)
- 1920px (large monitor)
```
Check: no horizontal scroll, no cut-off text, no overlapping elements, touch targets ≥ 44px.

**C. localStorage Quota**
```javascript
// Check usage
const used = JSON.stringify(localStorage).length;
const remaining = 5 * 1024 * 1024 - used;
console.log(`localStorage: ${used} bytes used, ${remaining} bytes remaining`);
// If > 4MB used, implement data pruning or migrate to IndexedDB
```

**D. Memory Leaks**
```javascript
// Common leak sources:
// - setInterval without clearInterval
// - Event listeners added but never removed
// - DOM references held in closures after element removal
// - Growing arrays (chat history, logs) without bounds
```
If you add an event listener or interval, you MUST provide cleanup logic.

**E. Accessibility (a11y)**
- All interactive elements have `aria-label` or visible text
- Color contrast ratio ≥ 4.5:1 (use DevTools color picker)
- Keyboard navigable (Tab order makes sense)
- Focus states visible (outline or custom indicator)
- `prefers-reduced-motion` respected

**F. Theme Consistency**
- Switch through ALL themes after any CSS change
- Verify no hardcoded colors that break in dark themes
- Check that `var(--bg)`, `var(--text)`, `var(--accent)` are used everywhere

### 3.2 — Bug Reporting Format
When you find a bug, add it to `WHITEBOARD.md` BUG TRACKER:

```markdown
| ID | Bug | Severity | Found | Status | Fix Notes |
|----|-----|----------|-------|--------|-----------|
| B-001 | Chat widget overlaps settings panel on mobile | HIGH | 2026-05-09 | PENDING | z-index issue, chat should have max-width on small screens |
```

Severity levels:
- **CRITICAL** — App crashes, data loss, security issue. Fix immediately.
- **HIGH** — Feature unusable, major UX broken. Fix before next task.
- **MEDIUM** — Annoyance, workaround exists. Fix within 2 cycles.
- **LOW** — Cosmetic, edge case. Fix when convenient.

---

## 4. MISSING FEATURE DETECTION

### 4.1 — Agent Initiative
You are ENCOURAGED to think beyond the task list. After completing work, ask yourself:

> "If I were a user opening this for the first time, what would feel missing?"

### 4.2 — Common Dashboard Features (Checklist)
Review this list regularly. If any are absent, add to MISSING FEATURES:

- [ ] Global search (search across all apps)
- [ ] Keyboard shortcuts (command palette, hotkeys)
- [ ] Undo/redo
- [ ] Auto-save indicator
- [ ] Export/import data
- [ ] Offline mode indicator
- [ ] Notifications/reminders
- [ ] Pin/favorite items
- [ ] Dark/light toggle (per-theme)
- [ ] Reduced motion support
- [ ] Multi-language support
- [ ] Onboarding / help tooltips
- [ ] Error boundaries (don't crash the whole app)
- [ ] Loading states / skeleton screens
- [ ] Empty states (friendly message when no data)
- [ ] Confirmation dialogs for destructive actions
- [ ] Toast notifications for success/error feedback
- [ ] Breadcrumb navigation (if deep navigation exists)
- [ ] Recently used / recently viewed
- [ ] Customization (rearrange, resize, hide apps)

### 4.3 — Feature Proposal Format
When adding a missing feature idea:

```markdown
| ID | Idea | Source | Priority | Rationale |
|----|------|--------|----------|-----------|
| I-021 | Add toast notification system | Agent initiative | HIGH | Every action needs feedback. User clicks save → sees "Saved!" |
```

Rationale must answer: **Why does this matter? What user pain does it solve?**

If priority is `HIGH` or `CRITICAL`, create a corresponding Task immediately.

---

## 5. CODE QUALITY RULES

### 5.1 — JavaScript
- Use ES modules (`<script type="module">` or `import` in JS)
- No global variables — everything in modules or IIFE
- Event listeners: add them, but also write the remove function
- Async/await preferred over raw promises
- Always handle errors in async code (`try/catch`)
- `console.log` is fine for debugging, but remove before committing
- Use `const` by default, `let` when needed, never `var`

### 5.2 — CSS
- CSS custom properties (`--var`) for ALL colors, spacing, radii, shadows
- No hardcoded hex codes outside theme files
- BEM naming optional but encouraged for app-specific components
- Mobile-first media queries: `@media (min-width: 768px) { ... }`
- `rem` for font sizes, `px` for borders, `em` for component-relative spacing
- Use `gap` for flex/grid spacing, avoid margin hacks

### 5.3 — HTML
- Semantic tags: `header`, `nav`, `main`, `section`, `article`, `footer`
- `aria-label` on icon-only buttons
- `role` attributes where semantic tags aren't enough
- `lang="en"` on html tag (or user-selected language)
- Meta viewport tag: `width=device-width, initial-scale=1.0, viewport-fit=cover`

### 5.4 — File Organization
```
public/
├── index.html
├── css/
│   ├── base.css          ← Only layout + variables, no colors
│   ├── themes/
│   │   ├── professional.css
│   │   └── ...
│   └── apps/
│       ├── calendar.css
│       ├── notes.css
│       └── todo.css
├── js/
│   ├── app.js            ← Router, init, global utilities
│   ├── theme.js          ← Theme engine
│   ├── settings.js       ← Settings panel
│   ├── welcome.js        ← Onboarding
│   ├── chat.js           ← Hermes chat
│   └── apps/
│       ├── calendar.js
│       ├── notes.js
│       └── todo.js
```

---

## 6. COMMUNICATION RULES

### 6.1 — Commit Messages
```
[T-XXX] Brief description of what changed

- Detail 1
- Detail 2
```

Examples:
```
[T-002] Add Midnight Hacker theme

- Cyberpunk green-on-black palette
- Monospace font for headers
- Scanline overlay effect

[T-005] Scaffold Calendar app shell

- Month grid placeholder
- Navigation arrows
- Empty state message
```

### 6.2 — Whiteboard Updates
After completing work, update `WHITEBOARD.md`:

```markdown
### 🔴 CRITICAL
| ID | Task | Status | Notes |
|----|------|--------|-------|
| T-002 | Theme engine | DONE | 6 themes implemented, switcher working, localStorage persistence added |
```

### 6.3 — When Stuck
If you're stuck on a technical problem for > 20 minutes:
1. Document the blocker in AGENT NOTES
2. Switch to a different task if possible
3. If no other task is viable, end the cycle with the blocker documented
4. The next cycle (or the user) can help resolve it

Do NOT spin in circles. Time spent stuck is time not building.

---

## 7. SCALABILITY REMINDERS

This project is designed to grow. Every decision should ask:

> "Will this still make sense when there are 10 apps? 50 apps? Multiple users?"

### 7.1 — App Scalability
- Apps register themselves in a central registry (`window.NexusApps`)
- The dashboard renders apps dynamically from the registry
- Adding a new app = create `apps/newapp.js` + `css/apps/newapp.css` + register

### 7.2 — Data Scalability
- `localStorage` is a temporary solution. Plan for migration:
  - Abstract storage behind `StorageAdapter` class
  - `localStorage` adapter now, `IndexedDB` or `SQLite` adapter later
  - Swap adapter without changing app code

### 7.3 — Theme Scalability
- Themes are pure CSS variable overrides
- Each theme file is ~50 lines
- Users could eventually upload custom themes

### 7.4 — Device Scalability
- All CSS is responsive
- PWA makes it installable everywhere
- Touch + mouse + keyboard all supported

---

## 8. SECURITY REMINDERS

- Never commit secrets (tokens, passwords) to the repo
- If a backend is added later, sanitize ALL user inputs
- Use `Content-Security-Policy` headers in nginx
- `localStorage` is plaintext — don't store sensitive passwords there
- If multi-user support is added later, implement auth properly (not just a password in localStorage)

---

## 9. FINAL CHECKLIST — Before Every Sleep

- [ ] Code works (tested in browser)
- [ ] No console errors
- [ ] Responsive on mobile and desktop
- [ ] All themes look correct
- [ ] `WHITEBOARD.md` updated with progress
- [ ] Bugs documented (if any found)
- [ ] New ideas documented (if any thought of)
- [ ] Git committed with task ID in message
- [ ] Next task identified for the next cycle

---

> **Remember:** You are building something the user will see every single day. Make it smooth. Make it beautiful. Make it reliable. When in doubt, choose the simpler solution. Complexity is the enemy of maintenance. 🤖⚡
