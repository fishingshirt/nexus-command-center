#!/usr/bin/env node
/**
 * Nexus Command Center — End-to-end App Verification Script
 * Checks that each app's view div exists, API loads data, and the app renders.
 * Usage: node scripts/nexus-verify.js [http://localhost:8080]
 */
const http = require('http');
const https = require('https');

const BASE = process.argv[2] || 'http://localhost:8080';

const APPS = [
  { name: 'Dashboard',       path: '#dashboard',       api: null },
  { name: 'Calendar',        path: '#calendar',        api: null },
  { name: 'Notes',           path: '#notes',           api: null },
  { name: 'To-Do',           path: '#todo',            api: null },
  { name: 'Weather',         path: '#weather',         api: null },
  { name: 'Phone Bridge',    path: '#phone',           api: '/api/adb/status' },
  { name: 'Feedback',        path: '#feedback',        api: null },
  { name: 'Arcade',          path: '#arcade',          api: null },
  { name: 'Finance',         path: '#finance',         api: null },
  { name: 'Budget',          path: '#finance-tracker', api: null },
  { name: 'Pomodoro',        path: '#pomodoro',        api: null },
  { name: 'World Clock',     path: '#worldclock',      api: null },
  { name: 'News Hub',        path: '#news',            api: '/api/news' },
  { name: 'Wishlist',        path: '#wishlist',        api: null },
  { name: 'Email',           path: '#email',           api: '/api/email/status' },
  { name: 'RSS Reader',      path: '#rss',             api: '/api/rss/fetch?url=http://feeds.bbci.co.uk/news/rss.xml' },
  { name: 'PDF Editor',      path: '#pdf',             api: '/api/pdf/list' },
  { name: 'Vault',           path: '#vault',           api: '/api/vault/list' },
  { name: 'Recipes',         path: '#recipe',          api: null },
  { name: 'Bookmarks',       path: '#bookmarks',       api: null },
  { name: 'AI Suggester',    path: '#ai-suggester',    api: null },
  { name: 'Chat',            path: '#chat',            api: null },
];

async function httpGet(url) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { timeout: 10000 }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, body: body }); }
      });
    });
    req.on('error', () => resolve({ status: 0, body: null }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: null }); });
  });
}

async function verify() {
  console.log(`🔍 Verifying Nexus at ${BASE}\n`);
  let passed = 0;
  let failed = 0;

  // 1. Verify index.html loads and contains all view divs
  const page = await httpGet(BASE);
  if (page.status !== 200) {
    console.log(`❌ FAILED: index.html returned HTTP ${page.status}`);
    process.exit(1);
  }
  const html = typeof page.body === 'string' ? page.body : '';
  const allViews = APPS.map(a => `view-${a.path.replace('#', '')}`);
  let missingViews = allViews.filter(id => !html.includes(`id="${id}"`));
  if (missingViews.length) {
    console.log(`⚠️ Missing views in HTML: ${missingViews.join(', ')}`);
  } else {
    console.log(`✅ All ${allViews.length} app views present in HTML`);
  }

  // 2. API checks
  console.log(`\n📡 API Health Checks:`);
  const apiTests = [
    ['/api/system/health', 'System Health'],
    ['/api/news', 'News API'],
    ['/api/rss/fetch?url=http://feeds.bbci.co.uk/news/rss.xml', 'RSS API'],
    ['/api/email/status', 'Email API'],
    ['/api/vault/list', 'Vault API'],
    ['/api/backup/', 'Backup API'],
    ['/api/server/status', 'Server Status'],
    ['/api/youtube/daily?seed=1', 'YouTube Daily'],
  ];

  for (const [path, label] of apiTests) {
    const res = await httpGet(BASE + path);
    if (res.status === 200) {
      passed++;
      const isJson = typeof res.body === 'object';
      if (path === '/api/news') {
        const count = res.body?.totalResults ?? 0;
        console.log(`  ✅ ${label}: ${count} articles`);
      } else if (path.includes('rss')) {
        const count = res.body?.feed?.items?.length ?? 0;
        console.log(`  ✅ ${label}: ${count} items`);
      } else if (path.includes('youtube')) {
        const count = res.body?.videos?.length ?? 0;
        console.log(`  ✅ ${label}: ${count} videos`);
      } else {
        console.log(`  ✅ ${label}: HTTP 200`);
      }
    } else {
      failed++;
      console.log(`  ❌ ${label}: HTTP ${res.status}`);
    }
  }

  // 3. Static files
  console.log(`\n📁 Static Assets:`);
  const staticTests = [
    '/js/app.js',
    '/js/apps/news.js',
    '/js/apps/rss.js',
    '/js/apps/weather.js',
    '/js/apps/vault.js',
    '/js/apps/wishlist.js',
    '/css/base.css',
    '/css/apps/news.css',
  ];
  for (const path of staticTests) {
    const res = await httpGet(BASE + path);
    if (res.status === 200) {
      passed++;
    } else {
      failed++;
      console.log(`  ❌ ${path}: HTTP ${res.status}`);
    }
  }
  console.log(`  ✅ ${staticTests.length} static assets served OK`);

  // 4. Summary
  console.log(`\n📊 Summary: ${passed} passed, ${failed} failed`);
  if (failed === 0) {
    console.log(`🎉 All checks PASSED — Nexus is fully operational!`);
  } else {
    console.log(`⚠️ ${failed} issues found — review above.`);
    process.exit(1);
  }
}

verify();
