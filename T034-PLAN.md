# T-034 Plan: Settings App Refactor

## What we're doing
Converting Settings from a fixed slide-out panel (top-right gear icon) into a proper app that:
1. Lives in the nav drawer (hamburger menu)
2. Opens as a full view (like Calendar, Notes, etc.)
3. Has its own dashboard card

## Steps
1. ✅ Add Settings nav link in drawer (done)
2. ✅ Remove settings gear icon from header-right (done)
3. Remove old `<aside id="settings-panel">` from top-level, move it into `<main>` as `#view-settings`
4. Add Settings card to dashboard grid
5. Add `#view-settings` as a `.view` container with header + content
6. Update `app.js` — `initSettings()` opens as a normal view instead of slide-out panel
7. Remove `.settings-panel` CSS, convert to `.view-body` based layout
8. Update `initApp()` — settings is no longer a separate init
9. Update `APP_REGISTRY` 
10. Update router whitelist if needed
11. Handle auth check for settings
12. Commit + update WHITEBOARD.md
