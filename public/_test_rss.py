#!/usr/bin/env python3
import json, urllib.request, sys
try:
    req = urllib.request.Request('http://localhost:8080/api/rss/fetch?url=http://feeds.bbci.co.uk/news/rss.xml')
    with urllib.request.urlopen(req, timeout=20) as resp:
        d = json.load(resp)
    feed = d.get('feed', {})
    print('ok:', d.get('ok'))
    print('title:', feed.get('title'))
    print('items:', len(feed.get('items', [])))
except Exception as e:
    print('error:', e)
