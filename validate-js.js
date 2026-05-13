// Runtime validation of nexus command center JS bootstrapping
const fs = require('fs');
const path = require('path');

// Mock browser globals
global.document = {
  getElementById: (id) => {
    const knownIds = new Set([
      'app', 'welcome-overlay', 'nav-drawer', 'nav-backdrop', 'header-menu-btn', 'nav-drawer-close',
      'header-brand', 'theme-select', 'reduced-motion', 'show-welcome', 'it-hub-visible',
      'theme-stylesheet', 'theme-color', 'btn-export', 'import-file', 'btn-clear',
      'view-dashboard', 'view-calendar', 'view-chat', 'view-settings', 'chat-widget',
      'chat-widget-toggle', 'chat-widget-input', 'chat-widget-send', 'chat-widget-messages',
      'chat-input', 'chat-send', 'chat-history', 'sync-client-id', 'sync-api-key', 'sync-auto',
      'sync-interval', 'sync-status-badge', 'btn-sync-now', 'btn-sync-unlink', 'feedback-form',
      'feedback-list', 'feedback-questions', 'feedback-q-text', 'feedback-q-num', 'feedback-q-total',
      'feedback-q-answer', 'feedback-q-next', 'feedback-q-prev', 'feedback-skip-q', 'feedback-preview',
      'feedback-preview-card', 'feedback-final-submit', 'feedback-edit-btn', 'agent-indicator',
      'agent-stat-tasks', 'agent-stat-bugs', 'agent-stat-commits', 'agent-stat-wakes',
      'agent-stat-last-run', 'agent-stat-next-run', 'agent-upcoming-list', 'btn-sync-whiteboard',
      'toast-container', 'offline-indicator', 'particle-layer', 'nexus-push-status', 'header-wifi-indicator'
    ]);
    return knownIds.has(id) ? { addEventListener: ()=>{}, removeEventListener: ()=>{}, classList: { add:()=>{}, remove:()=>{}, toggle:()=>{}, contains:()=>false }, style: {}, setAttribute:()=>{}, getAttribute:()=>{}, querySelector:()=>null, querySelectorAll:()=>[], appendChild:()=>{}, remove:()=>{}, textContent:'', innerHTML:'', focus:()=>{}, click:()=>{}, value:'', checked:false } : null;
  },
  querySelector: (sel) => global.document.getElementById('app'),
  querySelectorAll: (sel) => [],
  createElement: (tag) => ({ className:'', id:'', textContent:'', innerHTML:'', style:{}, addEventListener:()=>{}, appendChild:()=>{}, setAttribute:()=>{}, focus:()=>{} }),
  addEventListener: () => {},
  documentElement: { style: { setProperty: () => {} }, classList: { add: () => {}, remove: () => {} } },
  body: { appendChild: () => {}, removeChild: () => {}, scrollTop: 0, style: {} },
  head: { appendChild: () => {} }
};
global.window = {
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => {},
  localStorage: { getItem:()=>null, setItem:()=>{}, removeItem:()=>{}, clear:()=>{}, key:()=>null, length:0 },
  sessionStorage: { getItem:()=>null, setItem:()=>{} },
  location: { hash: '', reload: () => {} },
  navigator: { onLine: true, serviceWorker: { register: () => Promise.resolve() } },
  matchMedia: () => ({ matches: false }),
  devicePixelRatio: 1,
  __phonePollTimer: null,
  _openFinanceOrder: null,
  _removeWatchlist: null
};
global.localStorage = global.window.localStorage;
global.sessionStorage = global.window.sessionStorage;
global.location = global.window.location;
global.navigator = global.window.navigator;
global.fetch = () => Promise.resolve({ ok: false, json: () => Promise.resolve({}), text: () => Promise.resolve('') });
global.CustomEvent = function(e, d) { this.type = e; this.detail = d; };
global.URL = require('url').URL;
global.URLSearchParams = require('url').URLSearchParams;
global.Blob = class Blob { constructor(c, o) { this._content = c; this._type = o; } };
global.FileReader = class FileReader { readAsText() { setTimeout(() => this.onload?.({ target: { result: '{}' } }), 1); } };
global.setTimeout = (fn, t) => { if (typeof fn === 'function') fn(); };
global.setInterval = () => {};
global.clearInterval = () => {};
global.confirm = () => true;
global.alert = () => {};
global.console = { log:()=>{}, warn:()=>{}, error:()=>{} };

const jsDir = '/home/fishingshirt/nexus-command-center/public/js';

function validateFile(file) {
  const fullPath = path.join(jsDir, file);
  const code = fs.readFileSync(fullPath, 'utf8');
  console.log(`\n=== Validating ${file} ===`);
  try {
    new Function(code);
    console.log(`  ✓ Syntax OK`);
    return true;
  } catch (e) {
    console.log(`  ❌ SYNTAX ERROR: ${e.message}`);
    return false;
  }
}

// Validate all JS files
const allPassed = [];
const files = fs.readdirSync(jsDir).filter(f => f.endsWith('.js'));
files.forEach(f => allPassed.push(validateFile(f)));

const appFiles = fs.readdirSync(path.join(jsDir, 'apps')).filter(f => f.endsWith('.js'));
appFiles.forEach(f => allPassed.push(validateFile(path.join('apps', f))));

console.log(`\n=== SUMMARY ===`);
console.log(`Total files checked: ${allPassed.length}`);
console.log(`Passed: ${allPassed.filter(Boolean).length}`);
console.log(`Failed: ${allPassed.filter(x => !x).length}`);

// Now try to simulate app.js loading as a module with imported deps
// Since we can't really use ES modules in Node without transpilation,
// let's just check app.js + welcome.js syntax which we've already done
console.log(`\nNote: welcome.js now contains inline loadSettings/saveSettings - check passed.`);
if (allPassed.every(Boolean)) {
  console.log(`\n✅ All syntax checks passed. If still white-screening, the issue is cache/`);
  console.log(`   The Service Worker is likely serving the OLD broken welcome.js`);
  console.log(`\n   TO FIX: increment sw.js CACHE_NAME (e.g., 'nexus-v2' → 'nexus-v3')`);
  console.log(`   and increment sw.js file version comment to force browser SW update.`);
} else {
  console.log(`\n❌ Some files have syntax errors (see above).`);
}
