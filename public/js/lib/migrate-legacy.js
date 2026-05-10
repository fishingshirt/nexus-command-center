/**
 * migrate-legacy.js — T-013-b
 * One-time migration: pushes all known localStorage app data to server store.
 */

const MIGRATE_FLAG = 'ncc-migrated-v1';
const KNOWN_KEYS = [
  'ncc-calendar', 'ncc-notes', 'ncc-todo', 'ncc-finance',
  'ncc-weather', 'ncc-phone', 'ncc-backup', 'ncc-auth',
  'ncc-settings', 'ncc-worldclock', 'ncc-pomodoro',
  'ncc-gcal-sync', 'ncc-arcade',
];

export async function runMigration() {
  if (localStorage.getItem(MIGRATE_FLAG) === 'true') return; /* already ran */

  let pushed = 0;
  for (const lsKey of KNOWN_KEYS) {
    const raw = localStorage.getItem(lsKey);
    if (!raw) continue;
    const app = lsKey.slice(4); /* strip 'ncc-' prefix */
    try {
      const res = await fetch('/api/store/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app, data: JSON.parse(raw) }),
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) pushed++;
    } catch { /* server down — skip; will retry next boot */ }
  }

  localStorage.setItem(MIGRATE_FLAG, 'true');
  if (pushed > 0) {
    /* Use global toast if available */
    if (typeof window !== 'undefined' && typeof window.toast === 'function') {
      window.toast(`Migration complete — ${pushed} app(s) synced to server`);
    }
  }
}
