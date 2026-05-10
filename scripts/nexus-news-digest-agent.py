#!/usr/bin/env python3
"""
News Hub Digest Agent

Runs on wake / cron to:
1. Read settings from the server-side JSON store.
2. If aiDigestEnabled is true and last digest is >4h old,
   POST /api/news/digest to generate a new digest.
3. POST a notification so the dashboard shows a toast.

Usage: python3 nexus-news-digest-agent.py
"""

import json
import os
import sys
import time
import urllib.request
import urllib.parse

SETTINGS_PATH = os.path.expanduser('~/.hermes/nexus-store/settings.json')
DIGEST_PATH = os.path.expanduser('~/.hermes/nexus-news-digest.json')
BASE_URL = 'http://localhost:8080'
TIMEOUT = 20
STALE_SECONDS = 4 * 3600  # 4 hours

def _load_json(path, default=None):
    try:
        with open(path, 'r') as f:
            return json.load(f)
    except Exception:
        return default

def _request(url, method='GET', data=None, headers=None):
    req = urllib.request.Request(url, method=method)
    if headers:
        for k, v in headers.items():
            req.add_header(k, v)
    if data is not None:
        if isinstance(data, dict):
            data = json.dumps(data).encode('utf-8')
            req.add_header('Content-Type', 'application/json')
        req.data = data
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except Exception as e:
        return {'ok': False, 'error': str(e)}

def should_generate():
    settings = _load_json(SETTINGS_PATH, {})
    hub = settings.get('newsHub', {})
    if not hub.get('aiDigestEnabled', False):
        return False, None
    digest = _load_json(DIGEST_PATH, {})
    last_ts = digest.get('timestamp')
    if last_ts:
        try:
            # ISO 8601 naive parse (strip tz suffix)
            ts = last_ts.replace('Z', '')
            if ts.endswith('+00:00'):
                ts = ts[:-6]
            from datetime import datetime
            last_time = datetime.strptime(ts, '%Y-%m-%dT%H:%M:%S')
            age = (datetime.now() - last_time).total_seconds()
            if age < STALE_SECONDS:
                return False, None
        except Exception:
            pass
    categories = hub.get('digestCategories', ['world', 'politics', 'technology'])
    return True, categories

def generate_digest(categories):
    max_articles = 10
    url = f"{BASE_URL}/api/news/digest"
    return _request(url, method='POST', data={
        'categories': categories,
        'maxArticles': max_articles,
    })

def push_notification():
    url = f"{BASE_URL}/api/notifications"
    return _request(url, method='POST', data={
        'title': '📰 Your daily news digest is ready',
        'body': 'Top headlines have been summarized for you.',
        'app': 'news',
        'priority': 'normal',
    })

def main():
    gen, categories = should_generate()
    if not gen:
        print('[news-agent] Digest not needed.')
        sys.exit(0)

    print(f'[news-agent] Generating digest for categories: {categories}')
    res = generate_digest(categories)
    if res.get('ok') or res.get('ready'):
        print('[news-agent] Digest ready.')
        nres = push_notification()
        if nres.get('ok'):
            print('[news-agent] Notification pushed.')
        else:
            print(f'[news-agent] Notification failed: {nres}')
    else:
        print(f'[news-agent] Digest generation failed: {res}')
        sys.exit(1)

if __name__ == '__main__':
    main()
