#!/usr/bin/env python3
"""Nexus Command Center — Static SPA Server + IT Hub API
   Serves public/ on port 8080 with SPA fallback.
   Adds /api/* endpoints for IT Hub telemetry.
   Usage: python3 nexus-server.py [--port 8080] [--dir /path/to/public]
"""
import http.server, socketserver, os, sys, argparse, signal, atexit, json, time, subprocess, socket, shutil, hashlib, base64, uuid
from pathlib import Path
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

PIDFILE = os.path.expanduser('~/.hermes/nexus-server.pid')
START_TIME = time.time()
TEMP_PIN = "fullroot88"

# -- PDF storage root --
PDF_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'pdfs')
os.makedirs(PDF_DIR, exist_ok=True)

def get_args():
    p = argparse.ArgumentParser()
    p.add_argument('--port', type=int, default=8080)
    p.add_argument('--dir', default='/tmp/nexus-command-center/public')
    return p.parse_args()

def write_pid(pid):
    os.makedirs(os.path.dirname(PIDFILE), exist_ok=True)
    with open(PIDFILE, 'w') as f:
        f.write(str(pid))

def remove_pid():
    try:
        os.remove(PIDFILE)
    except FileNotFoundError:
        pass

def kill_existing():
    try:
        with open(PIDFILE) as f:
            old = int(f.read().strip())
        os.kill(old, signal.SIGTERM)
    except (FileNotFoundError, ValueError, ProcessLookupError, PermissionError):
        pass

def _cors(handler):
    handler.send_header('Access-Control-Allow-Origin', '*')
    handler.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    handler.send_header('Access-Control-Allow-Headers', 'Content-Type')

def _json(handler, status, data):
    body = json.dumps(data, default=str).encode('utf-8')
    handler.send_response(status)
    handler.send_header('Content-Type', 'application/json')
    _cors(handler)
    handler.send_header('Content-Length', len(body))
    handler.end_headers()
    handler.wfile.write(body)

# ── API helpers ───────────────────────────────
def _git_info(repo):
    def run(*cmd):
        try:
            return subprocess.check_output(cmd, cwd=repo, stderr=subprocess.DEVNULL, text=True).strip()
        except Exception:
            return ''
    branch = run('git', 'rev-parse', '--abbrev-ref', 'HEAD')
    last_commit = run('git', 'log', '-1', '--format=%h')
    uncommitted = run('git', 'status', '--porcelain')
    last_push = run('git', 'log', '-1', '--format=%ci')
    return {
        'git_branch': branch or 'unknown',
        'last_commit': last_commit or 'unknown',
        'uncommitted_count': len([l for l in uncommitted.splitlines() if l.strip()]),
        'last_push_time': last_push or None
    }

def _health():
    data = {'cpu_percent': None, 'ram_percent': None, 'disk_percent': None,
            'uptime_seconds': int(time.time() - START_TIME), 'load_avg_1m': None}
    try:
        import psutil
        data['cpu_percent'] = psutil.cpu_percent(interval=0.5)
        mem = psutil.virtual_memory()
        data['ram_percent'] = round(mem.percent, 1)
        disk = psutil.disk_usage('/')
        data['disk_percent'] = round(disk.percent, 1)
        data['load_avg_1m'] = round(os.getloadavg()[0], 2)
    except Exception:
        pass
    return data

def _probe_tcp(host, port, timeout=1):
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except Exception:
        return False

def _tail(path, lines=20):
    try:
        with open(path, 'r') as f:
            buf = f.readlines()
            return [l.rstrip('\n') for l in buf[-lines:]]
    except Exception:
        return []

def _api_pdf_upload(handler):
    import cgi, shutil, time, hashlib
    ctype, pdict = cgi.parse_header(handler.headers.get('Content-Type', ''))
    if ctype != 'multipart/form-data':
        _json(handler, 400, {'ok': False, 'error': 'Expected multipart/form-data'})
        return True
    pdict['boundary'] = pdict['boundary'].encode('latin-1') if isinstance(pdict.get('boundary'), str) else pdict.get('boundary')
    fs = cgi.FieldStorage(fp=handler.rfile, headers=handler.headers, environ={'REQUEST_METHOD':'POST', 'CONTENT_TYPE':handler.headers.get('Content-Type')})
    upfile = fs.get('file')
    if not upfile or not upfile.file or not upfile.filename:
        _json(handler, 400, {'ok': False, 'error': 'No file uploaded'})
        return True
    ext = os.path.splitext(upfile.filename)[1].lower()
    if ext != '.pdf':
        _json(handler, 400, {'ok': False, 'error': 'Only PDF files accepted'})
        return True
    safe = hashlib.sha256((upfile.filename + str(time.time())).encode()).hexdigest()[:16] + '.pdf'
    dest = os.path.join(PDF_DIR, safe)
    with open(dest, 'wb') as f:
        shutil.copyfileobj(upfile.file, f)
    pages = 0
    try:
        import fitz
        pages = fitz.open(dest).page_count
    except Exception:
        pass
    _json(handler, 200, {'ok': True, 'filename': safe, 'pages': pages, 'size': os.path.getsize(dest)})
    return True

def _api_pdf_nlp(handler):
    length = int(handler.headers.get('Content-Length', 0))
    body = handler.rfile.read(length).decode('utf-8') if length else '{}'
    try:
        req = json.loads(body)
    except Exception:
        _json(handler, 400, {'ok': False, 'error': 'Invalid JSON'})
        return True
    filename = req.get('filename', '')
    cmd = req.get('command', '').lower().strip()
    if not filename or not cmd:
        _json(handler, 400, {'ok': False, 'error': 'filename and command required'})
        return True
    fp = os.path.join(PDF_DIR, filename.replace('/', '').replace('\\', ''))
    if not os.path.isfile(fp):
        _json(handler, 404, {'ok': False, 'error': 'File not found'})
        return True
    try:
        import fitz
        doc = fitz.open(fp)
    except Exception as e:
        _json(handler, 500, {'ok': False, 'error': f'Cannot open PDF: {e}'})
        return True
    if 'extract text' in cmd or 'ocr' in cmd or 'text' in cmd:
        text = ''
        for page in doc:
            text += page.get_text() + '\n'
        doc.close()
        _json(handler, 200, {'ok': True, 'action': 'extract_text', 'textLength': len(text), 'text': text})
        return True
    if 'extract pages' in cmd or 'pages' in cmd:
        import re
        m = re.search(r'(\d+)\s*-\s*(\d+)', cmd)
        if m:
            s, e = int(m.group(1)) - 1, int(m.group(2))
        else:
            m2 = re.search(r'\b(\d+)\b', cmd)
            s = int(m2.group(1)) - 1 if m2 else 0
            e = s + 1
        s = max(0, min(s, doc.page_count - 1))
        e = max(s + 1, min(e, doc.page_count))
        new_doc = fitz.open()
        new_doc.insert_pdf(doc, from_page=s, to_page=e-1)
        safe = hashlib.sha256((filename + str(time.time())).encode()).hexdigest()[:16] + '.pdf'
        out = os.path.join(PDF_DIR, safe)
        new_doc.save(out)
        new_doc.close(); doc.close()
        _json(handler, 200, {'ok': True, 'action': 'extract_pages', 'newFilename': safe, 'newPages': e - s})
        return True
    if 'merge' in cmd:
        doc.close()
        _json(handler, 200, {'ok': True, 'action': 'merge_pdf', 'newFilename': filename, 'note': 'Merging needs another PDF file selected'})
        return True
    if 'split' in cmd:
        doc.close()
        _json(handler, 200, {'ok': True, 'action': 'split_pdf', 'pages': doc.page_count, 'note': 'Splitting into per-page PDFs not yet implemented'})
        return True
    meta = {'pageCount': doc.page_count, 'title': doc.metadata.get('title',''), 'author': doc.metadata.get('author','')}
    doc.close()
    _json(handler, 200, {'ok': True, 'action': 'metadata', 'metadata': meta})
    return True

def _api_pdf_file(handler, path):
    filename = path.split('/')[-1].replace('/', '').replace('\\', '')
    fp = os.path.join(PDF_DIR, filename)
    if not os.path.isfile(fp):
        handler.send_response(404)
        handler.end_headers()
        return True
    handler.send_response(200)
    handler.send_header('Content-Type', 'application/pdf')
    handler.send_header('Content-Disposition', f'inline; filename="{filename}"')
    handler.end_headers()
    with open(fp, 'rb') as f:
        handler.wfile.write(f.read())
    return True

def _api_pdf(handler, path, raw_path):
    if path == '/api/pdf/upload' and handler.command == 'POST':
        return _api_pdf_upload(handler)
    if path == '/api/pdf/nlp' and handler.command == 'POST':
        return _api_pdf_nlp(handler)
    if path.startswith('/api/pdf/file/'):
        return _api_pdf_file(handler, path)
    _json(handler, 405, {'ok': False, 'error': 'Method not allowed'})
    return True


def _deps():
    services = []
    # PostgreSQL
    services.append({'name': 'PostgreSQL', 'status': 'ok' if _probe_tcp('127.0.0.1', 5432) else 'error', 'message': 'Port 5432 probe'})
    # Redis
    services.append({'name': 'Redis', 'status': 'ok' if _probe_tcp('127.0.0.1', 6379) else 'error', 'message': 'Port 6379 probe'})
    # Tailscale
    try:
        subprocess.check_output(['tailscale', 'status', '--json'], stderr=subprocess.DEVNULL, timeout=3)
        services.append({'name': 'Tailscale', 'status': 'ok', 'message': 'Tailscale daemon responsive'})
    except Exception:
        try:
            subprocess.run(['which', 'tailscale'], check=True, stdout=subprocess.DEVNULL)
            services.append({'name': 'Tailscale', 'status': 'warn', 'message': 'Installed but not connected'})
        except Exception:
            services.append({'name': 'Tailscale', 'status': 'error', 'message': 'tailscale binary not found'})
    # Google API (connectivity check)
    try:
        import urllib.request
        with urllib.request.urlopen('https://www.googleapis.com/calendar/v3', timeout=5) as resp:
            # Expect 403/401 = service reachable
            services.append({'name': 'Google API', 'status': 'ok', 'message': 'Reachable'})
    except urllib.error.HTTPError as e:
        if e.code in (400, 401, 403, 404):
            services.append({'name': 'Google API', 'status': 'ok', 'message': 'Reachable'})
        else:
            services.append({'name': 'Google API', 'status': 'warn', 'message': f'HTTP {e.code}'})
    except Exception:
        services.append({'name': 'Google API', 'status': 'error', 'message': 'Unreachable'})
    # GitHub Push (connectivity to github.com)
    try:
        with socket.create_connection(('github.com', 443), timeout=3):
            services.append({'name': 'GitHub Push', 'status': 'ok', 'message': 'github.com:443 reachable'})
    except Exception:
        services.append({'name': 'GitHub Push', 'status': 'error', 'message': 'github.com unreachable'})
    # DNS
    try:
        socket.getaddrinfo('google.com', None)
        services.append({'name': 'DNS', 'status': 'ok', 'message': 'Resolution working'})
    except Exception:
        services.append({'name': 'DNS', 'status': 'error', 'message': 'DNS unavailable'})
    return {'services': services}

# ── Finance helpers ───────────────────────────
_finance_cache = {'data': {}, 'ts': 0}
CRYPTO_MAP = {
    'BTC': 'bitcoin', 'ETH': 'ethereum', 'SOL': 'solana', 'ADA': 'cardano',
    'XRP': 'ripple', 'DOGE': 'dogecoin', 'DOT': 'polkadot', 'AVAX': 'avalanche-2',
    'LINK': 'chainlink', 'LTC': 'litecoin', 'BCH': 'bitcoin-cash', 'UNI': 'uniswap',
}

def _fetch_yahoo(sym):
    import urllib.request, json
    url = f'https://query1.finance.yahoo.com/v8/finance/chart/{sym.upper()}?interval=1d&range=1d'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64)'})
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode())
            result = data['chart']['result'][0]
            meta = result['meta']
            price = meta.get('regularMarketPrice')
            prev = meta.get('previousClose') or meta.get('regularMarketPreviousClose') or meta.get('chartPreviousClose')
            if price is None and result.get('indicators', {}).get('quote'):
                close = result['indicators']['quote'][0].get('close', [])
                price = close[-1] if close else None
            change = None
            if price is not None and prev:
                change = round(((price - prev) / prev) * 100, 2)
            return {'symbol': sym.upper(), 'price': round(price, 2) if price else None, 'change': change, 'source': 'yahoo'}
    except Exception as e:
        return {'symbol': sym.upper(), 'price': None, 'change': None, 'source': 'yahoo', 'error': str(e)}

def _fetch_coingecko(ids):
    import urllib.request, json
    if not ids:
        return []
    url = f'https://api.coingecko.com/api/v3/simple/price?ids={",".join(ids)}&vs_currencies=usd&include_24hr_change=true'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64)'})
    reverse_map = {v: k for k, v in CRYPTO_MAP.items()}
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode())
            out = []
            for cid, info in data.items():
                sym = reverse_map.get(cid.lower(), cid.upper())
                out.append({'symbol': sym, 'price': info.get('usd'), 'change': round(info.get('usd_24h_change'), 2) if info.get('usd_24h_change') is not None else None, 'source': 'coingecko'})
            return out
    except Exception as e:
        return [{'symbol': reverse_map.get(cid.lower(), cid.upper()), 'price': None, 'change': None, 'source': 'coingecko', 'error': str(e)} for cid in ids]

def _finance_prices(symbols):
    global _finance_cache
    now = time.time()
    if now - _finance_cache['ts'] < 60:
        # serve from cache if symbols subset
        cached = _finance_cache['data']
        if all(s.upper() in cached for s in symbols):
            return {'prices': [cached[s.upper()] for s in symbols]}
    stocks = [s for s in symbols if s.upper() not in CRYPTO_MAP]
    cryptos = [s for s in symbols if s.upper() in CRYPTO_MAP]
    results = {}
    for s in stocks:
        results[s.upper()] = _fetch_yahoo(s)
    if cryptos:
        ids = [CRYPTO_MAP[s.upper()] for s in cryptos]
        cg_results = _fetch_coingecko(ids)
        for r in cg_results:
            results[r['symbol'].upper()] = r
    _finance_cache = {'data': results, 'ts': now}
    return {'prices': list(results.values())}

def _api_finance(handler, fullpath):
    import urllib.parse
    parsed = urllib.parse.urlparse(fullpath)
    qs = urllib.parse.parse_qs(parsed.query)
    symbols = qs.get('symbols', [])
    if symbols:
        symbols = [s.strip() for s in symbols[0].split(',') if s.strip()]
    if not symbols:
        _json(handler, 400, {'ok': False, 'error': 'Missing symbols parameter'})
        return True
    _json(handler, 200, _finance_prices(symbols))
    return True

# ── Finance Tracker (T-019-c) backup helpers ────
_FINANCE_DATA_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'finance.json')

def _api_finance_tracker_read(handler):
    try:
        with open(_FINANCE_DATA_PATH, 'r') as f:
            data = json.load(f)
    except Exception:
        data = {'transactions': []}
    _json(handler, 200, data)
    return True

def _api_finance_tracker_write(handler):
    try:
        length = int(handler.headers.get('Content-Length', 0))
        body = handler.rfile.read(length).decode('utf-8') if length else '{}'
        payload = json.loads(body)
    except Exception:
        _json(handler, 400, {'ok': False, 'error': 'Invalid JSON'})
        return True
    transactions = payload.get('transactions', [])
    os.makedirs(os.path.dirname(_FINANCE_DATA_PATH), exist_ok=True)
    with open(_FINANCE_DATA_PATH, 'w') as f:
        json.dump({'transactions': transactions}, f, indent=2)
    _json(handler, 200, {'ok': True, 'count': len(transactions)})
    return True

# ── Hermes Bridge helpers ───────────────────────
_HERMES_STATE_PATH = os.path.expanduser('~/.hermes/nexus-hermes-bridge.json')

def _load_hermes_state():
    defaults = {'offset': 0, 'pending': []}
    try:
        with open(_HERMES_STATE_PATH, 'r') as f:
            return {**defaults, **json.load(f)}
    except Exception:
        return defaults

def _save_hermes_state(st):
    try:
        os.makedirs(os.path.dirname(_HERMES_STATE_PATH), exist_ok=True)
        tmp = _HERMES_STATE_PATH + '.tmp'
        with open(tmp, 'w') as f:
            json.dump(st, f)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, _HERMES_STATE_PATH)
    except Exception:
        pass

def _tg_token():
    # Pull token from environment or ~/.hermes/.env
    import re
    tok = os.environ.get('TELEGRAM_BOT_TOKEN', '')
    if tok:
        return tok
    env_path = os.path.expanduser('~/.hermes/.env')
    try:
        with open(env_path, 'r') as f:
            for line in f:
                m = re.match(r'^TELEGRAM_BOT_TOKEN=(.+)$', line.strip())
                if m:
                    return m.group(1).strip()
    except Exception:
        pass
    return ''

def _tg_chat_id():
    import re
    cid = os.environ.get('TELEGRAM_HOME_CHANNEL', '')
    if cid:
        return cid
    env_path = os.path.expanduser('~/.hermes/.env')
    try:
        with open(env_path, 'r') as f:
            for line in f:
                m = re.match(r'^TELEGRAM_HOME_CHANNEL=(.+)$', line.strip())
                if m:
                    return m.group(1).strip()
    except Exception:
        pass
    return ''

def _tg_api(method, params=None):
    import urllib.request, urllib.parse, json, ssl
    token = _tg_token()
    if not token:
        return {'ok': False, 'error': 'No TELEGRAM_BOT_TOKEN'}
    url = f'https://api.telegram.org/bot{token}/{method}'
    data = None
    if params:
        data = urllib.parse.urlencode(params).encode('utf-8')
    req = urllib.request.Request(url, data=data, method='POST' if data else 'GET',
                                 headers={'Content-Type': 'application/x-www-form-urlencoded'} if data else {})
    try:
        with urllib.request.urlopen(req, timeout=15, context=ssl.create_default_context()) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except Exception as e:
        return {'ok': False, 'error': str(e)}

def _api_hermes(handler, path):
    if path == '/api/hermes/status':
        st = _load_hermes_state()
        token_ok = bool(_tg_token())
        chat_cfg = bool(_tg_chat_id())
        resolved = bool(st.get('resolved_chat_ids'))
        last_poll = st.get('last_poll_ts', 0)
        poll_age = int(time.time() - last_poll) if last_poll else None
        _json(handler, 200, {
            'ok': True,
            'bridge': 'ready' if (token_ok and chat_cfg and resolved) else 'partial',
            'token_ok': token_ok,
            'chat_configured': chat_cfg,
            'chat_resolved': resolved,
            'last_poll_seconds_ago': poll_age,
            'resolved_chat_ids': st.get('resolved_chat_ids', [])
        })
        return True

    if path == '/api/hermes/message':
        print(f"[hermes] /api/hermes/message request")
        try:
            length = int(handler.headers.get('Content-Length', 0))
            body = handler.rfile.read(length).decode('utf-8') if length else '{}'
            req = json.loads(body)
        except Exception:
            _json(handler, 400, {'ok': False, 'error': 'Invalid JSON'})
            return True
        text = (req.get('text') or '').strip()
        if not text:
            _json(handler, 400, {'ok': False, 'error': 'Missing text'})
            return True
        chat_id = _tg_chat_id()
        if not chat_id:
            _json(handler, 503, {'ok': False, 'error': 'TELEGRAM_HOME_CHANNEL not configured'})
            return True
        # Send via Telegram Bot API
        res = _tg_api('sendMessage', {'chat_id': chat_id, 'text': text, 'parse_mode': 'HTML'})
        if res.get('ok'):
            st = _load_hermes_state()
            st.setdefault('sent', []).append({'text': text, 'time': time.time()})
            st['sent'] = st['sent'][-200:]
            # Capture numeric chat.id from Telegram response so we know the real target chat
            result = res.get('result', {})
            numeric_cid = result.get('chat', {}).get('id')
            if numeric_cid:
                resolved = set(st.get('resolved_chat_ids', []))
                resolved.add(str(numeric_cid))
                st['resolved_chat_ids'] = list(resolved)
            st['last_poll_ts'] = time.time()
            # Store outbound message so webhook push doesn't lose reply context
            st.setdefault('outbound', []).append({'text': text, 'time': time.time(), 'chat_id': str(numeric_cid) if numeric_cid else str(chat_id)})
            st['outbound'] = st['outbound'][-200:]
            _save_hermes_state(st)
            print(f"[hermes] pushed message queue for chat={numeric_cid or chat_id}")
            _json(handler, 200, {'ok': True, 'message_id': result.get('message_id'), 'chat_id': numeric_cid})
        else:
            print(f"[hermes] sendMessage failed: {res}")
            _json(handler, 502, {'ok': False, 'error': res.get('error', 'Telegram API failed'), 'description': res.get('description')})
        return True

    if path == '/api/hermes/poll':
        print(f"[hermes] /api/hermes/poll request")
        chat_id = _tg_chat_id()
        if not chat_id:
            _json(handler, 503, {'ok': False, 'error': 'TELEGRAM_HOME_CHANNEL not configured'})
            return True
        st = _load_hermes_state()
        offset = st.get('offset', 0)
        messages = []
        seen = set(str(x) for x in st.get('last_seen_ids', []))
        # ── Strategy A: poll Telegram directly (may race with gateway) ──
        res = _tg_api('getUpdates', {'offset': offset + 1, 'limit': 20})
        allowed_ids = set()
        if chat_id:
            allowed_ids.add(str(chat_id))
        allowed_ids.update(str(x) for x in st.get('resolved_chat_ids', []))
        if res.get('ok') and isinstance(res.get('result'), list):
            for upd in res['result']:
                msg = upd.get('message') or upd.get('channel_post')
                if not msg:
                    continue
                if upd.get('update_id', 0) > offset:
                    offset = upd['update_id']
                cid = str(msg.get('chat', {}).get('id', ''))
                if cid not in allowed_ids:
                    continue
                txt = msg.get('text') or msg.get('caption', '')
                mid = str(msg.get('message_id', ''))
                if mid and mid in seen:
                    continue
                if mid:
                    seen.add(mid)
                if txt:
                    sender = msg.get('from', {})
                    # bot messages from Telegram have is_bot=true; we discard those.
                    # We also discard messages whose sender id matches the chat id (outbound echo)
                    is_me = bool(sender.get('is_bot') or str(sender.get('id', '')) == cid)
                    if not is_me:
                        messages.append({'text': txt, 'from': sender.get('first_name', 'Hermes'),
                                         'time': msg.get('date'), 'message_id': msg.get('message_id')})
        # ── Strategy B: fallback to Hermes session files if poll is empty ──
        if not messages:
            try:
                import glob, hashlib, re
                sessions_dir = os.path.expanduser('~/.hermes/sessions')
                files = sorted(glob.glob(os.path.join(sessions_dir, '*.jsonl')), key=os.path.getmtime, reverse=True)[:3]
                outbound = st.get('outbound', [])
                cutoff = outbound[-1]['time'] if outbound else (time.time() - 3600)
                for f in files:
                    try:
                        with open(f, 'r') as fh:
                            lines = fh.readlines()
                    except Exception:
                        continue
                    for line in lines:
                        try:
                            obj = json.loads(line)
                        except Exception:
                            continue
                        if obj.get('role') != 'assistant':
                            continue
                        ts_str = obj.get('timestamp', '')
                        ts = 0
                        try:
                            # ISO 8601 with optional fractional seconds and optional timezone
                            m = re.match(r'(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?', ts_str)
                            if m:
                                ts = time.mktime(time.strptime(m.group(1), '%Y-%m-%dT%H:%M:%S'))
                        except Exception:
                            continue
                        if ts < cutoff:
                            continue
                        body_text = obj.get('content', '')
                        if not body_text or not body_text.strip():
                            continue
                        h = hashlib.md5(body_text.encode()).hexdigest()
                        if h in seen:
                            continue
                        seen.add(h)
                        messages.append({'text': body_text.strip(), 'from': 'Hermes',
                                         'time': int(ts), 'message_id': h})
                        break
            except Exception:
                pass
        # ── Strategy C: serve pending webhook-pushed messages ──
        pending = st.get('pending', [])
        for m in pending:
            mid = str(m.get('message_id', ''))
            if mid and mid in seen:
                continue
            if mid:
                seen.add(mid)
            messages.append(m)
        if pending:
            st['pending'] = []
        st['offset'] = offset
        st['last_seen_ids'] = list(seen)[-500:]
        st['last_poll_ts'] = time.time()
        _save_hermes_state(st)
        _json(handler, 200, {'ok': True, 'messages': messages})
        return True

    if path == '/api/hermes/webhook':
        try:
            length = int(handler.headers.get('Content-Length', 0))
            body = handler.rfile.read(length).decode('utf-8') if length else '{}'
            payload = json.loads(body)
        except Exception:
            _json(handler, 400, {'ok': False, 'error': 'Invalid JSON'})
            return True
        st = _load_hermes_state()
        msg = payload.get('message') or payload.get('channel_post')
        text = ''
        mid = None
        sender_name = 'Hermes'
        msg_time = int(time.time())
        if msg:
            txt = msg.get('text') or msg.get('caption', '')
            if txt:
                text = txt
            mid = str(msg.get('message_id', ''))
            sender = msg.get('from', {})
            if not sender.get('is_bot') or sender.get('id') != int(_tg_chat_id() or 0):
                sender_name = sender.get('first_name', 'Hermes')
            msg_time = msg.get('date', msg_time)
        else:
            text = payload.get('text', '')
            mid = payload.get('message_id')
            sender_name = payload.get('from', 'Hermes')
        if text:
            seen = set(str(x) for x in st.get('last_seen_ids', []))
            key = mid or str(msg_time) + '_' + text[:32]
            if key not in seen:
                seen.add(key)
                st.setdefault('pending', []).append({
                    'text': text, 'from': sender_name,
                    'time': msg_time, 'message_id': key
                })
                st['pending'] = st['pending'][-500:]
                st['last_seen_ids'] = list(seen)[-500:]
                _save_hermes_state(st)
                _json(handler, 200, {'ok': True, 'message_id': key})
                return True
        _json(handler, 200, {'ok': True, 'note': 'duplicate or empty'})
        return True

    _json(handler, 404, {'ok': False, 'error': 'Unknown hermes endpoint'})
    return True

def _network():
    result = {'tailscale_ip': None, 'tailscale_status': 'not_installed', 'peers_count': 0, 'magic_dns': False, 'error': None}
    try:
        import json
        out = subprocess.check_output(['tailscale', 'status', '--json'], stderr=subprocess.DEVNULL, timeout=5)
        data = json.loads(out)
        # tailscale status json has Self with TailscaleIPs and Peer entries
        self_obj = data.get('Self', {})
        ips = self_obj.get('TailscaleIPs', [])
        result['tailscale_ip'] = ips[0] if ips else None
        result['tailscale_status'] = 'up' if self_obj.get('Online') else 'down'
        result['peers_count'] = len(data.get('Peer', {}))
        result['magic_dns'] = data.get('MagicDNSSuffix') is not None
    except FileNotFoundError:
        result['tailscale_status'] = 'not_installed'
        result['error'] = 'tailscale binary not found'
    except subprocess.TimeoutExpired:
        result['tailscale_status'] = 'error'
        result['error'] = 'Timed out querying tailscale status'
    except Exception as e:
        result['tailscale_status'] = 'error'
        result['error'] = str(e)
    return result

def _logs():
    errors_path = os.path.expanduser('~/.hermes/logs/errors.log')
    return {
        'errors_log_tail': _tail(errors_path, 20),
        'gateway_running': _probe_tcp('127.0.0.1', 7379),  # hermes gateway default port
        'cron_enabled': True  # cron job invoking us implies it's enabled
    }

# ── Agent Status helpers ──────────────────────
def agent_status():
    pidfile = os.path.expanduser('~/.hermes/nexus-agent.pid')
    pid = None
    try:
        with open(pidfile) as f:
            pid = int(f.read().strip())
    except FileNotFoundError:
        pass
    except ValueError:
        pass
    running = False
    if pid:
        try:
            import signal
            os.kill(pid, 0)
            running = True
        except (OSError, ProcessLookupError):
            pass
    last_heartbeat = None
    try:
        hb_path = os.path.expanduser('~/.hermes/nexus-agent-heartbeat.json')
        with open(hb_path) as f:
            h = json.load(f)
            last_heartbeat = h.get('timestamp')
    except FileNotFoundError:
        pass
    except ValueError:
        pass
    if last_heartbeat:
        try:
            # Parse ISO 8601 with optional timezone offset
            from datetime import datetime
            # Strip timezone for Python 3.10 compatibility
            ts = last_heartbeat.replace('Z', '+00:00')
            if ts.endswith('+00:00'):
                ts = ts[:-6]
            hb_time = datetime.strptime(ts, '%Y-%m-%dT%H:%M:%S')
            age = int((datetime.utcnow() - hb_time).total_seconds())
            if age > 1200:  # > 20 min old
                running = False
        except Exception:
            pass
    stats = {}
    try:
        with open(os.path.expanduser('~/.hermes/nexus-agent-stats.json')) as f:
            stats = json.load(f)
    except FileNotFoundError:
        pass
    except ValueError:
        pass
    return {
        'running': running,
        'pid': pid,
        'last_heartbeat': last_heartbeat,
        'stats': stats,
        'uptime_seconds': int(time.time() - START_TIME)
    }

def agent_heartbeat():
    hb_path = os.path.expanduser('~/.hermes/nexus-agent-heartbeat.json')
    ts = time.strftime('%Y-%m-%dT%H:%M:%S')
    with open(hb_path, 'w') as f:
        json.dump({'timestamp': ts}, f)
    return {'timestamp': ts, 'ok': True}

# ── PIN Auth helpers ──────────────────────────
AUTH_FILE = os.path.expanduser('~/.hermes/nexus-auth.json')
def _load_auth():
    try:
        with open(AUTH_FILE, 'r') as f:
            return json.load(f)
    except (FileNotFoundError, ValueError):
        return {}

def _pin_hash(pin, salt=None):
    import secrets
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac('sha256', pin.encode(), salt.encode(), 500_000)
    return salt, hashlib.sha256(digest).hexdigest()  # double hash storage

def _api_auth(handler, path):
    # GET /api/auth/status
    if path == '/api/auth/status':
        auth = _load_auth()
        _json(handler, 200, {'pinEnabled': bool(auth.get('pinHash'))})
        return True

    if path == '/api/auth/register':
        try:
            length = int(handler.headers.get('Content-Length', 0))
            body = handler.rfile.read(length).decode('utf-8') if length else '{}'
            req = json.loads(body)
        except Exception:
            _json(handler, 400, {'ok': False, 'error': 'Invalid JSON'})
            return True
        pin = (req.get('pin') or '').strip()
        if not pin.isdigit() or not (4 <= len(pin) <= 6):
            _json(handler, 400, {'ok': False, 'error': 'PIN must be 4-6 digits'})
            return True
        salt, phash = _pin_hash(pin)
        os.makedirs(os.path.dirname(AUTH_FILE), exist_ok=True)
        with open(AUTH_FILE, 'w') as f:
            json.dump({'pinHash': phash, 'salt': salt, 'updatedAt': time.strftime('%Y-%m-%dT%H:%M:%S')}, f)
        _json(handler, 200, {'ok': True})
        return True

    if path == '/api/auth/verify':
        try:
            length = int(handler.headers.get('Content-Length', 0))
            body = handler.rfile.read(length).decode('utf-8') if length else '{}'
            req = json.loads(body)
        except Exception:
            _json(handler, 400, {'ok': False, 'error': 'Invalid JSON'})
            return True
        auth = _load_auth()
        if not auth.get('pinHash'):
            _json(handler, 403, {'ok': False, 'error': 'PIN not configured'})
            return True
        pin = (req.get('pin') or '').strip()
        _, phash = _pin_hash(pin, auth.get('salt'))
        _json(handler, 200, {'ok': phash == auth.get('pinHash')})
        return True

    if path == '/api/auth/remove':
        try:
            length = int(handler.headers.get('Content-Length', 0))
            body = handler.rfile.read(length).decode('utf-8') if length else '{}'
            req = json.loads(body)
        except Exception:
            _json(handler, 400, {'ok': False, 'error': 'Invalid JSON'})
            return True
        auth = _load_auth()
        if not auth.get('pinHash'):
            _json(handler, 403, {'ok': False, 'error': 'PIN not configured'})
            return True
        pin = (req.get('pin') or '').strip()
        _, phash = _pin_hash(pin, auth.get('salt'))
        if phash != auth.get('pinHash'):
            _json(handler, 403, {'ok': False, 'error': 'Incorrect PIN'})
            return True
        try:
            os.remove(AUTH_FILE)
        except FileNotFoundError:
            pass
        _json(handler, 200, {'ok': True})
        return True

    return False

# ── Agent Calendar Queue ──────────────────────
_AGENT_CALENDAR_QUEUE_PATH = os.path.expanduser('~/.hermes/nexus-agent-calendar-queue.json')

def _load_agent_queue():
    try:
        with open(_AGENT_CALENDAR_QUEUE_PATH, 'r') as f:
            return json.load(f)
    except Exception:
        return []

def _save_agent_queue(q):
    os.makedirs(os.path.dirname(_AGENT_CALENDAR_QUEUE_PATH), exist_ok=True)
    with open(_AGENT_CALENDAR_QUEUE_PATH, 'w') as f:
        json.dump(q, f)

def _parse_agent_event(text):
    """Lightweight heuristic parser for natural-language event strings.
    Returns {title, date, start, end} or None if unparseable.
    """
    import re, datetime
    text = text.strip()
    if not text:
        return None
    # Quick date extraction
    date_expr = re.compile(
        r'(\b(?:tomorrow|today|next\s+(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*)\b|'
        r'\b\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*(?:\s+\d{4})?\b|'
        r'\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}(?:,\s+\d{4})?\b)',
        re.IGNORECASE
    )
    time_expr = re.compile(
        r'((?:at|from)\s+)?(\d{1,2}:\d{2}(?:\s*[ap]\.?m\.?)?|\d{1,2}\s*[ap]\.?m\.?)',
        re.IGNORECASE
    )
    # Find time phrases
    times = []
    for m in time_expr.finditer(text):
        times.append(m.group(2))
    # Find date phrase
    date_match = date_expr.search(text)
    date_phrase = date_match.group(1) if date_match else None
    now = datetime.datetime.now()
    parsed_date = None
    if date_phrase:
        dp = date_phrase.lower().strip()
        if dp == 'tomorrow':
            parsed_date = now.date() + datetime.timedelta(days=1)
        elif dp == 'today':
            parsed_date = now.date()
        elif dp.startswith('next '):
            weekday_map = {'mon':0,'tue':1,'wed':2,'thu':3,'fri':4,'sat':5,'sun':6}
            wd = weekday_map.get(dp.split()[1][:3])
            if wd is not None:
                d = now.date() + datetime.timedelta(days=1)
                while d.weekday() != wd:
                    d += datetime.timedelta(days=1)
                parsed_date = d
        else:
            # Try dateutil if available
            try:
                import dateutil.parser
                parsed_date = dateutil.parser.parse(date_phrase).date()
            except Exception:
                pass
    # If still no date, default to today
    if not parsed_date:
        parsed_date = now.date()
    # Time parsing (naive)
    start_time = None
    end_time = None
    if times:
        def _parse(t):
            t = t.strip().upper().replace('.','')
            try:
                if 'M' in t and ':' not in t:
                    return datetime.datetime.strptime(t, '%I%p').strftime('%H:%M')
                elif 'M' in t:
                    return datetime.datetime.strptime(t, '%I:%M%p').strftime('%H:%M')
                else:
                    return datetime.datetime.strptime(t, '%H:%M').strftime('%H:%M')
            except Exception:
                return t
        start_time = _parse(times[0])
        end_time = _parse(times[1]) if len(times) > 1 else None
    # Build title: remove date + time markers, keep remainder
    title = text
    if date_match:
        title = re.sub(re.escape(date_match.group(0)), '', title, flags=re.IGNORECASE, count=1)
    for t in times:
        title = re.sub(r'(?:at\s+)?' + re.escape(t), '', title, flags=re.IGNORECASE, count=1)
    title = re.sub(r'\s+', ' ', title).strip('.,:;!? ')
    # Remove common prefixes like "add event" or "reminder to"
    title = re.sub(r'^(add\s+(?:event|appointment|meeting)\s*)', '', title, flags=re.IGNORECASE)
    title = re.sub(r'^(reminder\s+(?:to|for)\s*)', '', title, flags=re.IGNORECASE)
    # Fallback title
    if not title:
        title = text
    return {
        'title': title,
        'date': parsed_date.strftime('%Y-%m-%d'),
        'start': start_time,
        'end': end_time,
    }

# ── Google Calendar helpers ───────────────────
_GCAL_TOKEN_PATH = os.path.expanduser('~/.hermes/nexus-gcal-tokens.json')

def _load_gcal_tokens():
    try:
        with open(_GCAL_TOKEN_PATH, 'r') as f:
            return json.load(f)
    except Exception:
        return {}

def _save_gcal_tokens(tokens):
    os.makedirs(os.path.dirname(_GCAL_TOKEN_PATH), exist_ok=True)
    with open(_GCAL_TOKEN_PATH, 'w') as f:
        json.dump(tokens, f)

def _refresh_gcal_token():
    tokens = _load_gcal_tokens()
    rt = tokens.get('refresh_token')
    if not rt:
        return None
    import urllib.request, urllib.parse
    cid = os.environ.get('GOOGLE_CLIENT_ID', '')
    csec = os.environ.get('GOOGLE_CLIENT_SECRET', '')
    if not cid or not csec:
        env_path = os.path.expanduser('~/.hermes/.env')
        try:
            with open(env_path) as f:
                for line in f:
                    if line.startswith('GOOGLE_CLIENT_ID='):
                        cid = line.split('=',1)[1].strip()
                    if line.startswith('GOOGLE_CLIENT_SECRET='):
                        csec = line.split('=',1)[1].strip()
        except Exception:
            pass
    if not cid or not csec:
        return None
    data = urllib.parse.urlencode({
        'client_id': cid, 'client_secret': csec,
        'refresh_token': rt, 'grant_type': 'refresh_token'
    }).encode()
    req = urllib.request.Request('https://oauth2.googleapis.com/token', data=data,
                                 headers={'Content-Type': 'application/x-www-form-urlencoded'})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            j = json.loads(resp.read().decode())
            tokens['access_token'] = j.get('access_token')
            if 'expires_in' in j:
                tokens['expires_at'] = time.time() + j['expires_in']
            _save_gcal_tokens(tokens)
            return tokens['access_token']
    except Exception:
        return None

def _gcal_access_token():
    tokens = _load_gcal_tokens()
    at = tokens.get('access_token')
    exp = tokens.get('expires_at', 0)
    if at and time.time() < exp - 60:
        return at
    return _refresh_gcal_token()


# ── Gmail helpers ─────────────────────────────
_GMAIL_TOKEN_PATH = os.path.expanduser('~/.hermes/nexus-gmail-tokens.json')

def _load_gmail_tokens():
    try:
        with open(_GMAIL_TOKEN_PATH, 'r') as f:
            return json.load(f)
    except Exception:
        return {}

def _save_gmail_tokens(tokens):
    os.makedirs(os.path.dirname(_GMAIL_TOKEN_PATH), exist_ok=True)
    with open(_GMAIL_TOKEN_PATH, 'w') as f:
        json.dump(tokens, f)

def _refresh_gmail_token():
    tokens = _load_gmail_tokens()
    rt = tokens.get('refresh_token')
    if not rt:
        return None
    import urllib.request, urllib.parse
    cid = os.environ.get('GOOGLE_CLIENT_ID', '')
    csec = os.environ.get('GOOGLE_CLIENT_SECRET', '')
    if not cid or not csec:
        env_path = os.path.expanduser('~/.hermes/.env')
        try:
            with open(env_path) as f:
                for line in f:
                    if line.startswith('GOOGLE_CLIENT_ID='):
                        cid = line.split('=',1)[1].strip()
                    if line.startswith('GOOGLE_CLIENT_SECRET='):
                        csec = line.split('=',1)[1].strip()
        except Exception:
            pass
    if not cid or not csec:
        return None
    data = urllib.parse.urlencode({
        'client_id': cid, 'client_secret': csec,
        'refresh_token': rt, 'grant_type': 'refresh_token'
    }).encode()
    req = urllib.request.Request('https://oauth2.googleapis.com/token', data=data,
                                 headers={'Content-Type': 'application/x-www-form-urlencoded'})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            j = json.loads(resp.read().decode())
            tokens['access_token'] = j.get('access_token')
            if 'expires_in' in j:
                tokens['expires_at'] = time.time() + j['expires_in']
            _save_gmail_tokens(tokens)
            return tokens['access_token']
    except Exception:
        return None

def _build_email_ai_prompt(messages, to, subject):
    history = []
    for m in messages[-6:]:
        history.append(f"From: {m.get('from','')}\nSubject: {m.get('subject','')}\n{m.get('body','')[:500]}")
    ctx = '\n---\n'.join(history)
    prompt = (
        f"You are a helpful email assistant. Based on the following email thread, "
        f"draft a concise, polite, professional reply. Do NOT include a subject line or sign-off meta commentary. "
        f"Write only the body of the reply email.\n\n"
        f"Recipients: {to}\n"
        f"Subject: {subject}\n"
        f"Thread:\n{ctx}\n\n"
        f"Reply body:"
    )
    return prompt

def _ollama_generate(prompt, model='llama3.2', timeout=30):
    try:
        data = json.dumps({'model': model, 'prompt': prompt, 'stream': False}).encode('utf-8')
        req = urllib.request.Request('http://localhost:11434/api/generate',
                                     data=data,
                                     headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            r = json.loads(resp.read().decode())
            return r.get('response', '').strip()
    except Exception:
        return None

def _gmail_access_token():
    tokens = _load_gmail_tokens()
    at = tokens.get('access_token')
    exp = tokens.get('expires_at', 0)
    if at and time.time() < exp - 60:
        return at
    return _refresh_gmail_token()

def _api_email(handler, raw_path):
    import urllib.parse, urllib.request, base64
    path = raw_path.split('?')[0]

    if path == '/api/email/oauth/start':
        cid = os.environ.get('GOOGLE_CLIENT_ID', '')
        if not cid:
            env_path = os.path.expanduser('~/.hermes/.env')
            try:
                with open(env_path) as f:
                    for line in f:
                        if line.startswith('GOOGLE_CLIENT_ID='):
                            cid = line.split('=',1)[1].strip()
            except Exception:
                pass
        if not cid:
            _json(handler, 503, {'ok': False, 'error': 'GOOGLE_CLIENT_ID not configured'})
            return True
        redirect_uri = f'http://localhost:{handler.server.server_address[1]}/api/email/oauth/callback'
        url = 'https://accounts.google.com/o/oauth2/v2/auth?' + urllib.parse.urlencode({
            'client_id': cid,
            'redirect_uri': redirect_uri,
            'response_type': 'code',
            'scope': 'https://www.googleapis.com/auth/gmail.modify',
            'access_type': 'offline',
            'prompt': 'consent'
        })
        _json(handler, 200, {'ok': True, 'url': url})
        return True

    if path == '/api/email/oauth/callback':
        parsed = urllib.parse.urlparse(raw_path)
        qs = urllib.parse.parse_qs(parsed.query)
        code = qs.get('code', [''])[0]
        if not code:
            _json(handler, 400, {'ok': False, 'error': 'Missing authorization code'})
            return True
        cid = os.environ.get('GOOGLE_CLIENT_ID', '')
        csec = os.environ.get('GOOGLE_CLIENT_SECRET', '')
        if not cid or not csec:
            env_path = os.path.expanduser('~/.hermes/.env')
            try:
                with open(env_path) as f:
                    for line in f:
                        if line.startswith('GOOGLE_CLIENT_ID='):
                            cid = line.split('=',1)[1].strip()
                        if line.startswith('GOOGLE_CLIENT_SECRET='):
                            csec = line.split('=',1)[1].strip()
            except Exception:
                pass
        if not cid or not csec:
            _json(handler, 503, {'ok': False, 'error': 'Client credentials not configured'})
            return True
        redirect_uri = f'http://localhost:{handler.server.server_address[1]}/api/email/oauth/callback'
        data = urllib.parse.urlencode({
            'code': code, 'client_id': cid, 'client_secret': csec,
            'redirect_uri': redirect_uri, 'grant_type': 'authorization_code'
        }).encode()
        req = urllib.request.Request('https://oauth2.googleapis.com/token', data=data,
                                       headers={'Content-Type': 'application/x-www-form-urlencoded'})
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                j = json.loads(resp.read().decode())
                tokens = {
                    'access_token': j.get('access_token'),
                    'refresh_token': j.get('refresh_token'),
                    'expires_at': time.time() + j.get('expires_in', 3600),
                    'scope': j.get('scope', ''),
                    'token_type': j.get('token_type', 'Bearer')
                }
                _save_gmail_tokens(tokens)
                _json(handler, 200, {'ok': True, 'status': 'connected'})
                return True
        except urllib.error.HTTPError as e:
            body = e.read().decode()
            _json(handler, 502, {'ok': False, 'error': f'Token exchange failed: {body}'})
            return True
        except Exception as e:
            _json(handler, 502, {'ok': False, 'error': str(e)})
            return True

    if path == '/api/email/status':
        tokens = _load_gmail_tokens()
        at = _gmail_access_token()
        email = None
        if at:
            try:
                r = urllib.request.Request('https://www.googleapis.com/gmail/v1/users/me/profile',
                                           headers={'Authorization': f'Bearer {at}'})
                with urllib.request.urlopen(r, timeout=10) as resp:
                    profile = json.loads(resp.read().decode())
                    email = profile.get('emailAddress')
            except Exception:
                pass
        _json(handler, 200, {'linked': bool(at), 'email': email})
        return True

    if path == '/api/email/unlink':
        try:
            os.remove(_GMAIL_TOKEN_PATH)
        except FileNotFoundError:
            pass
        _json(handler, 200, {'ok': True})
        return True

    if path == '/api/email/threads':
        at = _gmail_access_token()
        if not at:
            _json(handler, 503, {'ok': False, 'error': 'Not authenticated', 'status': 'not_linked'})
            return True
        parsed = urllib.parse.urlparse(raw_path)
        qs = urllib.parse.parse_qs(parsed.query)
        max_results = int(qs.get('maxResults', ['25'])[0])
        label = qs.get('label', ['INBOX'])[0]
        page_token = qs.get('pageToken', [''])[0]
        api_qs = {'maxResults': max_results, 'labelIds': label}
        if page_token:
            api_qs['pageToken'] = page_token
        url = 'https://www.googleapis.com/gmail/v1/users/me/threads?' + urllib.parse.urlencode(api_qs)
        req = urllib.request.Request(url, headers={'Authorization': f'Bearer {at}'})
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode())
                threads = data.get('threads', [])
                threads_out = []
                for t in threads:
                    tid = t.get('id')
                    if not tid:
                        continue
                    # fetch minimal thread snippet
                    turl = f'https://www.googleapis.com/gmail/v1/users/me/threads/{urllib.parse.quote(tid)}?format=metadata&metadataHeaders=Subject&metadataHeaders=From'
                    treq = urllib.request.Request(turl, headers={'Authorization': f'Bearer {at}'})
                    try:
                        with urllib.request.urlopen(treq, timeout=10) as tresp:
                            td = json.loads(tresp.read().decode())
                            msgs = td.get('messages', [])
                            first = msgs[0] if msgs else {}
                            headers = {h['name']: h['value'] for h in first.get('payload', {}).get('headers', [])}
                            threads_out.append({
                                'id': tid,
                                'snippet': td.get('snippet', ''),
                                'subject': headers.get('Subject', 'No subject'),
                                'from': headers.get('From', ''),
                                'historyId': td.get('historyId'),
                                'messageCount': len(msgs)
                            })
                    except Exception:
                        threads_out.append({'id': tid, 'snippet': t.get('snippet', ''), 'subject': 'Unknown', 'from': ''})
                _json(handler, 200, {
                    'ok': True,
                    'threads': threads_out,
                    'nextPageToken': data.get('nextPageToken'),
                    'status': 'synced'
                })
                return True
        except urllib.error.HTTPError as e:
            _json(handler, 502, {'ok': False, 'error': f'Gmail API error {e.code}', 'status': 'error'})
            return True
        except Exception as e:
            _json(handler, 502, {'ok': False, 'error': str(e), 'status': 'error'})
            return True

    m = __import__('re').match(r'^/api/email/threads/([^/]+)$', path)
    if m and handler.command == 'GET':
        at = _gmail_access_token()
        if not at:
            _json(handler, 503, {'ok': False, 'error': 'Not authenticated', 'status': 'not_linked'})
            return True
        tid = urllib.parse.unquote(m.group(1))
        url = f'https://www.googleapis.com/gmail/v1/users/me/threads/{urllib.parse.quote(tid)}?format=full'
        req = urllib.request.Request(url, headers={'Authorization': f'Bearer {at}'})
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode())
                messages = []
                for msg in data.get('messages', []):
                    payload = msg.get('payload', {})
                    headers = {h['name']: h['value'] for h in payload.get('headers', [])}
                    parts = payload.get('parts', [])
                    body_text = ''
                    for part in parts:
                        if part.get('mimeType') == 'text/plain':
                            bd = part.get('body', {}).get('data', '')
                            if bd:
                                body_text += base64.urlsafe_b64decode(bd).decode('utf-8', errors='replace')
                        elif part.get('mimeType') == 'text/html' and not body_text:
                            bd = part.get('body', {}).get('data', '')
                            if bd:
                                body_text = base64.urlsafe_b64decode(bd).decode('utf-8', errors='replace')
                    if not body_text and payload.get('body', {}).get('data'):
                        body_text = base64.urlsafe_b64decode(payload['body']['data']).decode('utf-8', errors='replace')
                    messages.append({
                        'id': msg.get('id'),
                        'threadId': msg.get('threadId'),
                        'labelIds': msg.get('labelIds', []),
                        'snippet': msg.get('snippet', ''),
                        'subject': headers.get('Subject', ''),
                        'from': headers.get('From', ''),
                        'to': headers.get('To', ''),
                        'date': headers.get('Date', ''),
                        'body': body_text
                    })
                _json(handler, 200, {'ok': True, 'id': tid, 'messages': messages})
                return True
        except urllib.error.HTTPError as e:
            _json(handler, 502, {'ok': False, 'error': f'Gmail API error {e.code}'})
            return True
        except Exception as e:
            _json(handler, 502, {'ok': False, 'error': str(e)})
            return True

    if path == '/api/email/send':
        at = _gmail_access_token()
        if not at:
            _json(handler, 503, {'ok': False, 'error': 'Not authenticated', 'status': 'not_linked'})
            return True
        try:
            length = int(handler.headers.get('Content-Length', 0))
            body = handler.rfile.read(length).decode('utf-8') if length else '{}'
            req = json.loads(body)
        except Exception:
            _json(handler, 400, {'ok': False, 'error': 'Invalid JSON'})
            return True
        to = req.get('to', '')
        subject = req.get('subject', '')
        msg_body = req.get('body', '')
        thread_id = req.get('threadId')
        if not to or not subject:
            _json(handler, 400, {'ok': False, 'error': 'Missing to or subject'})
            return True
        raw_msg = f"To: {to}\nSubject: {subject}\n\n{msg_body}"
        encoded = base64.urlsafe_b64encode(raw_msg.encode('utf-8')).decode('ascii')
        payload = {'raw': encoded}
        if thread_id:
            payload['threadId'] = thread_id
        data = json.dumps(payload).encode('utf-8')
        url = 'https://www.googleapis.com/gmail/v1/users/me/messages/send'
        hreq = urllib.request.Request(url, data=data, headers={'Authorization': f'Bearer {at}', 'Content-Type': 'application/json'}, method='POST')
        try:
            with urllib.request.urlopen(hreq, timeout=15) as resp:
                rdata = json.loads(resp.read().decode())
                _json(handler, 200, {'ok': True, 'id': rdata.get('id'), 'threadId': rdata.get('threadId')})
                return True
        except urllib.error.HTTPError as e:
            _json(handler, 502, {'ok': False, 'error': f'Gmail API error {e.code}'})
            return True
        except Exception as e:
            _json(handler, 502, {'ok': False, 'error': str(e)})
            return True

    if path == '/api/email/draft':
        at = _gmail_access_token()
        if not at:
            _json(handler, 503, {'ok': False, 'error': 'Not authenticated', 'status': 'not_linked'})
            return True
        try:
            length = int(handler.headers.get('Content-Length', 0))
            body = handler.rfile.read(length).decode('utf-8') if length else '{}'
            req = json.loads(body)
        except Exception:
            _json(handler, 400, {'ok': False, 'error': 'Invalid JSON'})
            return True
        to = req.get('to', '')
        subject = req.get('subject', '')
        msg_body = req.get('body', '')
        thread_id = req.get('threadId')
        if not to or not subject:
            _json(handler, 400, {'ok': False, 'error': 'Missing to or subject'})
            return True
        raw_msg = f"To: {to}\nSubject: {subject}\n\n{msg_body}"
        encoded = base64.urlsafe_b64encode(raw_msg.encode('utf-8')).decode('ascii')
        draft_data = {'message': {'raw': encoded}}
        if thread_id:
            draft_data['message']['threadId'] = thread_id
        data = json.dumps(draft_data).encode('utf-8')
        url = 'https://www.googleapis.com/gmail/v1/users/me/drafts'
        hreq = urllib.request.Request(url, data=data, headers={'Authorization': f'Bearer {at}', 'Content-Type': 'application/json'}, method='POST')
        try:
            with urllib.request.urlopen(hreq, timeout=15) as resp:
                rdata = json.loads(resp.read().decode())
                _json(handler, 200, {'ok': True, 'id': rdata.get('id'), 'message': rdata.get('message')})
                return True
        except urllib.error.HTTPError as e:
            _json(handler, 502, {'ok': False, 'error': f'Gmail API error {e.code}'})
            return True
        except Exception as e:
            _json(handler, 502, {'ok': False, 'error': str(e)})
            return True

    if path == '/api/email/ai-draft':
        try:
            length = int(handler.headers.get('Content-Length', 0))
            body = handler.rfile.read(length).decode('utf-8') if length else '{}'
            req = json.loads(body)
        except Exception:
            _json(handler, 400, {'ok': False, 'error': 'Invalid JSON'})
            return True
        messages = req.get('messages', [])
        to = req.get('to', '')
        subject = req.get('subject', '')
        if not messages:
            _json(handler, 400, {'ok': False, 'error': 'No thread context provided'})
            return True
        prompt = _build_email_ai_prompt(messages, to, subject)
        draft_text = _ollama_generate(prompt)
        if draft_text:
            _json(handler, 200, {'ok': True, 'draft': draft_text})
        else:
            _json(handler, 503, {'ok': False, 'error': 'AI service unavailable or no models installed. Run `ollama pull llama3.2` locally.'})
        return True

    return False

def _api_calendar(handler, raw_path):
    import urllib.parse, urllib.request, datetime
    path = raw_path.split('?')[0]
    if path == '/api/calendar/oauth/start':
        cid = os.environ.get('GOOGLE_CLIENT_ID', '')
        if not cid:
            env_path = os.path.expanduser('~/.hermes/.env')
            try:
                with open(env_path) as f:
                    for line in f:
                        if line.startswith('GOOGLE_CLIENT_ID='):
                            cid = line.split('=',1)[1].strip()
            except Exception:
                pass
        if not cid:
            _json(handler, 503, {'ok': False, 'error': 'GOOGLE_CLIENT_ID not configured'})
            return True
        redirect_uri = f'http://localhost:{handler.server.server_address[1]}/api/calendar/oauth/callback'
        url = 'https://accounts.google.com/o/oauth2/v2/auth?' + urllib.parse.urlencode({
            'client_id': cid,
            'redirect_uri': redirect_uri,
            'response_type': 'code',
            'scope': 'https://www.googleapis.com/auth/calendar',
            'access_type': 'offline',
            'prompt': 'consent'
        })
        _json(handler, 200, {'ok': True, 'url': url})
        return True

    if path == '/api/calendar/oauth/callback':
        parsed = urllib.parse.urlparse(raw_path)
        qs = urllib.parse.parse_qs(parsed.query)
        code = qs.get('code', [''])[0]
        if not code:
            _json(handler, 400, {'ok': False, 'error': 'Missing authorization code'})
            return True
        cid = os.environ.get('GOOGLE_CLIENT_ID', '')
        csec = os.environ.get('GOOGLE_CLIENT_SECRET', '')
        if not cid or not csec:
            env_path = os.path.expanduser('~/.hermes/.env')
            try:
                with open(env_path) as f:
                    for line in f:
                        if line.startswith('GOOGLE_CLIENT_ID='):
                            cid = line.split('=',1)[1].strip()
                        if line.startswith('GOOGLE_CLIENT_SECRET='):
                            csec = line.split('=',1)[1].strip()
            except Exception:
                pass
        if not cid or not csec:
            _json(handler, 503, {'ok': False, 'error': 'Client credentials not configured'})
            return True
        redirect_uri = f'http://localhost:{handler.server.server_address[1]}/api/calendar/oauth/callback'
        data = urllib.parse.urlencode({
            'code': code, 'client_id': cid, 'client_secret': csec,
            'redirect_uri': redirect_uri, 'grant_type': 'authorization_code'
        }).encode()
        req = urllib.request.Request('https://oauth2.googleapis.com/token', data=data,
                                       headers={'Content-Type': 'application/x-www-form-urlencoded'})
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                j = json.loads(resp.read().decode())
                tokens = {
                    'access_token': j.get('access_token'),
                    'refresh_token': j.get('refresh_token'),
                    'expires_at': time.time() + j.get('expires_in', 3600),
                    'scope': j.get('scope', ''),
                    'token_type': j.get('token_type', 'Bearer')
                }
                _save_gcal_tokens(tokens)
                html = b'''<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Calendar Connected</title>
<style>
  body { background: #0a0a0f; color: #10b981; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
  .gate { text-align: center; }
  h2 { margin-bottom: 0.5rem; }
  p { color: #94a3b8; }
</style>
</head>
<body>
<div class="gate"><h2>Calendar connected!</h2><p>You can close this window.</p></div>
<script>
  if (window.opener) { window.opener.postMessage({ type: 'nexus-gcal-connected' }, '*'); }
  setTimeout(function() { window.close(); }, 2500);
</script>
</body>
</html>'''
                handler.send_response(200)
                handler.send_header('Content-Type', 'text/html')
                _cors(handler)
                handler.end_headers()
                handler.wfile.write(html)
                return True
        except urllib.error.HTTPError as e:
            body = e.read().decode()
            _json(handler, 502, {'ok': False, 'error': f'Token exchange failed: {body}'})
            return True
        except Exception as e:
            _json(handler, 502, {'ok': False, 'error': str(e)})
            return True

    if path == '/api/calendar/sync':
        at = _gcal_access_token()
        if not at:
            _json(handler, 503, {'ok': False, 'error': 'Not authenticated', 'status': 'not_linked'})
            return True
        timeMin = (datetime.datetime.utcnow() - datetime.timedelta(days=30)).isoformat() + 'Z'
        timeMax = (datetime.datetime.utcnow() + datetime.timedelta(days=90)).isoformat() + 'Z'
        url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events?' + urllib.parse.urlencode({
            'singleEvents': 'true', 'orderBy': 'startTime',
            'timeMin': timeMin, 'timeMax': timeMax, 'maxResults': '250'
        })
        req = urllib.request.Request(url, headers={'Authorization': f'Bearer {at}'})
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode())
                _json(handler, 200, {'ok': True, 'events': data.get('items', []), 'status': 'synced'})
                return True
        except urllib.error.HTTPError as e:
            if e.code == 401:
                _json(handler, 401, {'ok': False, 'error': 'Token expired or revoked', 'status': 'error'})
            else:
                _json(handler, 502, {'ok': False, 'error': f'Google API error {e.code}', 'status': 'error'})
            return True
        except Exception as e:
            _json(handler, 502, {'ok': False, 'error': str(e), 'status': 'error'})
            return True

    if path == '/api/calendar/status':
        tokens = _load_gcal_tokens()
        at = _gcal_access_token()
        scope = tokens.get('scope', '')
        _json(handler, 200, {
            'linked': bool(at),
            'scope': scope,
            'readOnly': 'readonly' in scope and 'auth/calendar' not in scope
        })
        return True

    if path == '/api/calendar/unlink':
        try:
            os.remove(_GCAL_TOKEN_PATH)
        except FileNotFoundError:
            pass
        _json(handler, 200, {'ok': True})
        return True

    # ── Outbound write endpoints (POST / PATCH / DELETE) ──
    if path == '/api/calendar/events':
        at = _gcal_access_token()
        if not at:
            _json(handler, 503, {'ok': False, 'error': 'Not authenticated', 'status': 'not_linked'})
            return True
        try:
            length = int(handler.headers.get('Content-Length', 0))
            body = handler.rfile.read(length).decode('utf-8') if length else '{}'
            req = json.loads(body)
        except Exception:
            _json(handler, 400, {'ok': False, 'error': 'Invalid JSON'})
            return True
        url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
        data = json.dumps(req).encode('utf-8')
        hreq = urllib.request.Request(url, data=data, headers={'Authorization': f'Bearer {at}', 'Content-Type': 'application/json'}, method='POST')
        try:
            with urllib.request.urlopen(hreq, timeout=15) as resp:
                rdata = json.loads(resp.read().decode())
                _json(handler, 200, {'ok': True, 'eventId': rdata.get('id')})
                return True
        except urllib.error.HTTPError as e:
            _json(handler, 502, {'ok': False, 'error': f'Google API error {e.code}'})
            return True
        except Exception as e:
            _json(handler, 502, {'ok': False, 'error': str(e)})
            return True

    import re
    m = re.match(r'^/api/calendar/events/([^/]+)$', path)
    if m and handler.command == 'PATCH':
        at = _gcal_access_token()
        if not at:
            _json(handler, 503, {'ok': False, 'error': 'Not authenticated', 'status': 'not_linked'})
            return True
        event_id = urllib.parse.unquote(m.group(1))
        try:
            length = int(handler.headers.get('Content-Length', 0))
            body = handler.rfile.read(length).decode('utf-8') if length else '{}'
            req = json.loads(body)
        except Exception:
            _json(handler, 400, {'ok': False, 'error': 'Invalid JSON'})
            return True
        url = f'https://www.googleapis.com/calendar/v3/calendars/primary/events/{urllib.parse.quote(event_id)}'
        data = json.dumps(req).encode('utf-8')
        hreq = urllib.request.Request(url, data=data, headers={'Authorization': f'Bearer {at}', 'Content-Type': 'application/json'}, method='PATCH')
        try:
            with urllib.request.urlopen(hreq, timeout=15) as resp:
                rdata = json.loads(resp.read().decode())
                _json(handler, 200, {'ok': True, 'eventId': rdata.get('id')})
                return True
        except urllib.error.HTTPError as e:
            _json(handler, 502, {'ok': False, 'error': f'Google API error {e.code}'})
            return True
        except Exception as e:
            _json(handler, 502, {'ok': False, 'error': str(e)})
            return True

    if m and handler.command == 'DELETE':
        at = _gcal_access_token()
        if not at:
            _json(handler, 503, {'ok': False, 'error': 'Not authenticated', 'status': 'not_linked'})
            return True
        event_id = urllib.parse.unquote(m.group(1))
        url = f'https://www.googleapis.com/calendar/v3/calendars/primary/events/{urllib.parse.quote(event_id)}'
        hreq = urllib.request.Request(url, headers={'Authorization': f'Bearer {at}'}, method='DELETE')
        try:
            with urllib.request.urlopen(hreq, timeout=15) as resp:
                _json(handler, 200, {'ok': True})
                return True
        except urllib.error.HTTPError as e:
            if e.code == 410:
                _json(handler, 200, {'ok': True, 'note': 'Already deleted'})
                return True
            _json(handler, 502, {'ok': False, 'error': f'Google API error {e.code}'})
            return True
        except Exception as e:
            _json(handler, 502, {'ok': False, 'error': str(e)})
            return True

    if m and handler.command == 'GET':
        at = _gcal_access_token()
        if not at:
            _json(handler, 503, {'ok': False, 'error': 'Not authenticated', 'status': 'not_linked'})
            return True
        event_id = urllib.parse.unquote(m.group(1))
        url = f'https://www.googleapis.com/calendar/v3/calendars/primary/events/{urllib.parse.quote(event_id)}'
        hreq = urllib.request.Request(url, headers={'Authorization': f'Bearer {at}'})
        try:
            with urllib.request.urlopen(hreq, timeout=15) as resp:
                _json(handler, 200, json.loads(resp.read().decode()))
                return True
        except urllib.error.HTTPError as e:
            _json(handler, 502, {'ok': False, 'error': f'Google API error {e.code}'})
            return True
        except Exception as e:
            _json(handler, 502, {'ok': False, 'error': str(e)})
            return True

    # ── Agent Calendar Command endpoints ──
    if path == '/api/calendar/agent/add':
        try:
            length = int(handler.headers.get('Content-Length', 0))
            body = handler.rfile.read(length).decode('utf-8') if length else '{}'
            req = json.loads(body)
        except Exception:
            _json(handler, 400, {'ok': False, 'error': 'Invalid JSON'})
            return True
        text = (req.get('text') or '').strip()
        if not text:
            _json(handler, 400, {'ok': False, 'error': 'Missing text'})
            return True
        parsed = _parse_agent_event(text)
        if not parsed or not parsed.get('title'):
            _json(handler, 400, {'ok': False, 'error': 'Could not parse date/time'})
            return True
        event_id = 'evt_' + str(int(time.time() * 1000)) + '_' + __import__('secrets').token_hex(4)
        event = {
            'id': event_id,
            'title': parsed['title'],
            'date': parsed['date'],
            'start': parsed.get('start') or '',
            'end': parsed.get('end') or '',
            'category': 'other',
            'recurrence': 'none',
            'description': '',
        }
        if req.get('force'):
            at = _gcal_access_token()
            if not at:
                _json(handler, 503, {'ok': False, 'error': 'Google Calendar not connected'})
                return True
            tz = 'UTC'
            try:
                tz = __import__('datetime').datetime.now(__import__('zoneinfo').ZoneInfo(__import__('time').tzname[0])).strftime('%z')
            except Exception:
                pass
            gbody = {
                'summary': event['title'],
                'description': '',
                'start': {'dateTime': f"{event['date']}T{event['start'] or '00:00'}:00", 'timeZone': tz} if event['start'] else {'date': event['date']},
                'end': {'dateTime': f"{event['date']}T{event['end'] or '23:59'}:00", 'timeZone': tz} if event['end'] else {'date': event['date']},
            }
            url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
            data = json.dumps(gbody).encode('utf-8')
            hreq = urllib.request.Request(url, data=data, headers={'Authorization': f'Bearer {at}', 'Content-Type': 'application/json'}, method='POST')
            try:
                with urllib.request.urlopen(hreq, timeout=15) as resp:
                    rdata = json.loads(resp.read().decode())
                    event['gcalId'] = rdata.get('id')
                    event['lastSyncedAt'] = int(time.time() * 1000)
            except urllib.error.HTTPError as e:
                _json(handler, 502, {'ok': False, 'error': f'Google Calendar rejected event: HTTP {e.code}'})
                return True
            except Exception as e:
                _json(handler, 502, {'ok': False, 'error': str(e)})
                return True
        else:
            # Queue for dashboard pick-up
            q = _load_agent_queue()
            q.append(event)
            if len(q) > 100:
                q = q[-100:]
            _save_agent_queue(q)
        _json(handler, 200, {'ok': True, 'event': event})
        return True

    if path == '/api/calendar/agent/poll':
        q = _load_agent_queue()
        # Return events then clear queue (acknowledged)
        _json(handler, 200, {'events': q, 'count': len(q)})
        if q:
            _save_agent_queue([])
        return True

    return False

# ── ADB Bridge helpers ──────────────────────
def _api_adb(handler, path):
    import json, os, subprocess, sys
    STATE_PATH = os.path.expanduser('~/.hermes/nexus-adb-state.json')
    SENT_PATH = os.path.expanduser('~/.hermes/nexus-adb-sent.json')

    def load_state():
        try:
            with open(STATE_PATH) as f:
                return json.load(f)
        except Exception:
            return {'connected': False, 'error': 'State file missing'}

    if path == '/api/adb/status':
        st = load_state()
        age = int(time.time()) - st.get('timestamp', 0)
        payload = {
            'connected': st.get('connected', False),
            'serial': st.get('serial'),
            'battery': st.get('battery'),
            'signal': st.get('signal'),
            'adbInstalled': st.get('adbInstalled', False),
            'lastUpdateAgeSec': age,
            'error': st.get('error')
        }
        _json(handler, 200, payload)
        return True

    if path == '/api/adb/sms/read':
        st = load_state()
        inbox = st.get('inbox', [])
        _json(handler, 200, {'messages': inbox, 'count': len(inbox)})
        return True

    if path == '/api/adb/sms/send':
        try:
            length = int(handler.headers.get('Content-Length', 0))
            body = handler.rfile.read(length).decode('utf-8') if length else '{}'
            req = json.loads(body)
        except Exception:
            _json(handler, 400, {'ok': False, 'error': 'Invalid JSON'})
            return True
        st = load_state()
        if not st.get('connected'):
            _json(handler, 503, {'ok': False, 'error': 'No ADB device connected'})
            return True
        serial = st['serial']
        number = (req.get('to') or '').strip()
        text = (req.get('body') or '').strip()
        if not number or not text:
            _json(handler, 400, {'ok': False, 'error': 'Missing to or body'})
            return True
        script = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'adb-bridge.py')
        try:
            out = subprocess.check_output(
                [sys.executable, script, 'send', number, text],
                stderr=subprocess.STDOUT, text=True, timeout=15
            )
            res = json.loads(out)
            _json(handler, 200, res)
        except Exception as e:
            _json(handler, 500, {'ok': False, 'error': str(e)})
        return True

    return False

# ── Store helpers ─────────────────────────────
STORE_ROOT = os.path.expanduser('~/.hermes/nexus-store')

def _store_path(app):
    return os.path.join(STORE_ROOT, f"{app}.json")

def _store_read(app):
    try:
        with open(_store_path(app), 'r') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}

def _store_write(app, data):
    os.makedirs(STORE_ROOT, exist_ok=True)
    temp = _store_path(app) + '.tmp'
    try:
        with open(temp, 'w') as f:
            json.dump(data, f, indent=2)
        os.rename(temp, _store_path(app))
        return True
    except Exception:
        try: os.remove(temp)
        except FileNotFoundError: pass
        return False

def _deep_merge(base, patch):
    if not isinstance(base, dict) or not isinstance(patch, dict):
        return patch
    merged = dict(base)
    for k, v in patch.items():
        if isinstance(v, dict) and isinstance(merged.get(k), dict):
            merged[k] = _deep_merge(merged[k], v)
        else:
            merged[k] = v
    return merged

def _api_store_get(handler, path):
    """Handle GET /api/store/read?app=xxx"""
    import urllib.parse
    parsed = urllib.parse.urlparse(path)
    qs = urllib.parse.parse_qs(parsed.query)
    app = (qs.get('app', [''])[0] or '').replace('/', '').replace('\\', '')
    if not app:
        _json(handler, 400, {'ok': False, 'error': 'Missing app'})
        return True
    data = _store_read(app)
    _json(handler, 200, {'ok': True, 'data': data})
    return True

def _api_store_post(handler, path):
    """Handle POST /api/store/write and POST /api/store/merge"""
    try:
        length = int(handler.headers.get('Content-Length', 0))
        body = handler.rfile.read(length).decode('utf-8') if length else '{}'
        req = json.loads(body)
    except Exception:
        _json(handler, 400, {'ok': False, 'error': 'Invalid JSON'})
        return True
    app = str(req.get('app', '')).replace('/', '').replace('\\', '')
    if not app:
        _json(handler, 400, {'ok': False, 'error': 'Missing app'})
        return True
    if path.endswith('/merge'):
        patch = req.get('patch', {})
        existing = _store_read(app)
        merged = _deep_merge(existing, patch)
        ok = _store_write(app, merged)
        _json(handler, 200, {'ok': ok, 'data': merged})
        return True
    data = req.get('data', {})
    ok = _store_write(app, data)
    _json(handler, 200, {'ok': ok})
    return True

def _api_feedback(handler, raw_path):
    import urllib.parse, datetime
    path = raw_path.split('?')[0]
    repo = os.path.dirname(os.path.abspath(handler.args_dir))
    fp = os.path.join(repo, 'data', 'feedback-queue.jsonl')
    os.makedirs(os.path.dirname(fp), exist_ok=True)
    if not os.path.exists(fp):
        open(fp, 'w').close()

    def _read_all():
        items = []
        try:
            with open(fp, 'r') as f:
                for line in f:
                    line = line.strip()
                    if line:
                        items.append(json.loads(line))
        except Exception:
            pass
        return items

    def _write_all(items):
        with open(fp, 'w') as f:
            for it in items:
                f.write(json.dumps(it, default=str) + '\n')

    def _next_id():
        return 'fb-' + str(int(time.time() * 1000))

    # GET /api/feedback/list
    if path == '/api/feedback/list':
        qs = urllib.parse.parse_qs(urllib.parse.urlparse(raw_path).query)
        status_filter = qs.get('status', [''])[0]
        items = _read_all()
        if status_filter:
            items = [it for it in items if it.get('status') == status_filter]
        _json(handler, 200, {'items': items, 'total': len(items)})
        return True

    # GET /api/feedback/:id
    if path.startswith('/api/feedback/') and handler.command == 'GET':
        fid = path.split('/')[-1]
        items = _read_all()
        for it in items:
            if it.get('id') == fid:
                _json(handler, 200, it)
                return True
        _json(handler, 404, {'ok': False, 'error': 'Not found'})
        return True

    # POST /api/feedback
    if path == '/api/feedback' and handler.command == 'POST':
        try:
            length = int(handler.headers.get('Content-Length', 0))
            body = handler.rfile.read(length).decode('utf-8') if length else '{}'
            req = json.loads(body)
        except Exception:
            _json(handler, 400, {'ok': False, 'error': 'Invalid JSON'})
            return True
        title = str(req.get('title', '')).strip()
        description = str(req.get('description', '')).strip()
        if not title:
            _json(handler, 400, {'ok': False, 'error': 'Title is required'})
            return True
        if not description:
            _json(handler, 400, {'ok': False, 'error': 'Description is required'})
            return True
        if len(title) > 200:
            _json(handler, 400, {'ok': False, 'error': 'Title max 200 chars'})
            return True
        entry = {
            'id': _next_id(),
            'type': req.get('type', 'general'),
            'title': title,
            'description': description,
            'priority': req.get('priority', 'normal'),
            'answers': req.get('answers', []),
            'userId': req.get('userId'),
            'timestamp': datetime.datetime.now().isoformat(),
            'status': 'pending',
            'linkedTask': None,
            'note': None,
        }
        items = _read_all()
        items.append(entry)
        _write_all(items)
        _json(handler, 200, {'ok': True, 'id': entry['id']})
        return True

    # PATCH /api/feedback/:id/status
    if path.startswith('/api/feedback/') and path.endswith('/status') and handler.command in ('POST', 'PATCH'):
        fid = path.split('/')[3]
        try:
            length = int(handler.headers.get('Content-Length', 0))
            body = handler.rfile.read(length).decode('utf-8') if length else '{}'
            req = json.loads(body)
        except Exception:
            _json(handler, 400, {'ok': False, 'error': 'Invalid JSON'})
            return True
        new_status = req.get('status')
        if new_status not in ('pending', 'review', 'tasked', 'closed'):
            _json(handler, 400, {'ok': False, 'error': 'Invalid status'})
            return True
        items = _read_all()
        found = False
        for it in items:
            if it.get('id') == fid:
                it['status'] = new_status
                if 'linkedTask' in req:
                    it['linkedTask'] = req['linkedTask']
                if 'note' in req:
                    it['note'] = req['note']
                found = True
                break
        if not found:
            _json(handler, 404, {'ok': False, 'error': 'Not found'})
            return True
        _write_all(items)
        _json(handler, 200, {'ok': True})
        return True

    return False

# ── Request Handler ─────────────────────────────
def _api_backup(handler, path, repo):
    import tempfile, glob, re

    BACKUP_DIR = os.path.expanduser('~/.hermes/backups')
    os.makedirs(BACKUP_DIR, exist_ok=True)

    if path == '/api/backup/usb':
        drives = []
        try:
            # Try lsblk for removable block devices
            out = subprocess.check_output(
                ['lsblk', '-J', '-o', 'NAME,SIZE,TYPE,MOUNTPOINT,LABEL,FSTYPE,RM'],
                stderr=subprocess.DEVNULL, text=True, timeout=5
            )
            blk = json.loads(out)
            for dev in blk.get('blockdevices', []):
                if dev.get('rm') != True:
                    continue
                # Children partitions
                for child in dev.get('children', []):
                    drives.append({
                        'path': child.get('mountpoint') or f'/dev/{child.get("name")}',
                        'label': child.get('label') or dev.get('name'),
                        'size': child.get('size') or dev.get('size'),
                        'fstype': child.get('fstype') or '',
                        'mounted': bool(child.get('mountpoint'))
                    })
                if not dev.get('children'):
                    drives.append({
                        'path': f'/dev/{dev.get("name")}',
                        'label': dev.get('label') or dev.get('name'),
                        'size': dev.get('size'),
                        'fstype': dev.get('fstype') or '',
                        'mounted': bool(dev.get('mountpoint'))
                    })
        except Exception:
            # Fallback: scan /media and /mnt for mount points
            for base in ['/media', '/mnt', '/run/media']:
                if os.path.isdir(base):
                    for user in os.listdir(base):
                        up = os.path.join(base, user)
                        if os.path.isdir(up):
                            for d in os.listdir(up):
                                dp = os.path.join(up, d)
                                if os.path.ismount(dp):
                                    try:
                                        st = shutil.disk_usage(dp)
                                        size = f"{st.total // (1024**3)} GB"
                                    except Exception:
                                        size = '?'
                                    drives.append({
                                        'path': dp, 'label': d, 'size': size,
                                        'fstype': '', 'mounted': True
                                    })
        _json(handler, 200, {'drives': drives})
        return True

    if path == '/api/backup/run':
        import hashlib, datetime
        try:
            length = int(handler.headers.get('Content-Length', 0))
            body = handler.rfile.read(length).decode('utf-8') if length else '{}'
            req = json.loads(body)
        except Exception:
            _json(handler, 400, {'ok': False, 'error': 'Invalid JSON'})
            return True

        btype = req.get('type', 'full')
        cfg = req.get('config', {})
        target = req.get('target')
        timestamp = datetime.datetime.now().strftime('%Y%m%d-%H%M%S')

        # Gather ncc localStorage keys plus settings
        export_data = {'_meta': {'exported_at': timestamp, 'version': 1, 'type': btype}}
        for k in list(os.environ.keys()):
            if k.startswith('ncc-'):
                pass  # no env fallback; we only read browser localStorage via frontend
        # Since we cannot read browser localStorage from server, we accept it in the request
        payload_data = req.get('data', {})
        if payload_data:
            export_data['data'] = payload_data
        else:
            export_data['data'] = {}

        # Write to server backup dir
        arc_name = f"nexus-backup-{timestamp}.json"
        arc_path = os.path.join(BACKUP_DIR, arc_name)
        with open(arc_path, 'w') as f:
            json.dump(export_data, f, indent=2)

        # If gpg + passphrase, encrypt in place
        passphrase = cfg.get('passphrase', '')
        if passphrase and len(passphrase) >= 8:
            enc_path = arc_path + '.gpg'
            try:
                subprocess.run(
                    ['gpg', '--batch', '--passphrase-fd', '0', '--symmetric',
                     '--cipher-algo', 'AES256', '-o', enc_path, arc_path],
                    input=passphrase.encode(), check=True, timeout=60
                )
                os.remove(arc_path)
                arc_path = enc_path
                arc_name += '.gpg'
            except Exception:
                pass  # leave unencrypted if gpg unavailable

        # If local target (USB path), copy there too
        final_target = 'server'
        if btype in ('local', 'full') and target:
            if os.path.isdir(target):
                try:
                    dest = os.path.join(target, arc_name)
                    shutil.copy2(arc_path, dest)
                    final_target = target
                except Exception as e:
                    _json(handler, 200, {'ok': False, 'error': f'USB copy failed: {e}'})
                    return True

        # Cloud
        if btype == 'cloud' and cfg.get('provider'):
            # Placeholder: we only store locally; real cloud sync is future work
            final_target = f"cloud({cfg['provider']})→server"

        size = '—'
        try:
            size = f"{os.path.getsize(arc_path):,} bytes"
        except Exception:
            pass

        _json(handler, 200, {
            'ok': True, 'file': arc_name, 'path': arc_path,
            'target': final_target, 'size': size,
            'summary': f'Backed up to {final_target}'
        })
        return True

    if path == '/api/backup/history':
        entries = []
        try:
            for fn in sorted(os.listdir(BACKUP_DIR), reverse=True):
                if not fn.startswith('nexus-backup-'):
                    continue
                fp = os.path.join(BACKUP_DIR, fn)
                st = os.stat(fp)
                entries.append({
                    'filename': fn,
                    'size': f"{st.st_size:,} bytes",
                    'created': datetime.datetime.fromtimestamp(st.st_mtime).isoformat(),
                    'encrypted': fn.endswith('.gpg')
                })
        except Exception:
            pass
        _json(handler, 200, {'ok': True, 'backups': entries})
        return True

    if path == '/api/backup/download':
        import urllib.parse
        qs = handler.path.split('?', 1)[1] if '?' in handler.path else ''
        params = urllib.parse.parse_qs(qs)
        filename = (params.get('file', [''])[0] or '').replace('/', '').replace('\\', '')
        if not filename or not filename.startswith('nexus-backup-'):
            _json(handler, 400, {'ok': False, 'error': 'Invalid filename'})
            return True
        fp = os.path.join(BACKUP_DIR, filename)
        if not os.path.isfile(fp) or not os.path.realpath(fp).startswith(os.path.realpath(BACKUP_DIR)):
            _json(handler, 404, {'ok': False, 'error': 'Not found'})
            return True
        handler.send_response(200)
        handler.send_header('Content-Type', 'application/octet-stream')
        handler.send_header('Content-Disposition', f'attachment; filename="{filename}"')
        handler.send_header('Content-Length', str(os.path.getsize(fp)))
        _cors(handler)
        handler.end_headers()
        with open(fp, 'rb') as f:
            handler.wfile.write(f.read())
        return True

    if path == '/api/backup/restore':
        import tempfile, urllib.parse
        try:
            length = int(handler.headers.get('Content-Length', 0))
            body = handler.rfile.read(length).decode('utf-8') if length else '{}'
            req = json.loads(body)
        except Exception:
            _json(handler, 400, {'ok': False, 'error': 'Invalid JSON'})
            return True
        filename = (req.get('filename') or '').replace('/', '').replace('\\', '')
        passphrase = req.get('passphrase', '')
        if not filename or not filename.startswith('nexus-backup-'):
            _json(handler, 400, {'ok': False, 'error': 'Invalid filename'})
            return True

        fp = os.path.join(BACKUP_DIR, filename)
        if not os.path.isfile(fp) or not os.path.realpath(fp).startswith(os.path.realpath(BACKUP_DIR)):
            _json(handler, 404, {'ok': False, 'error': 'Not found'})
            return True

        # Decrypt if needed
        is_encrypted = filename.endswith('.gpg')
        work_path = fp
        if is_encrypted:
            if not passphrase:
                _json(handler, 400, {'ok': False, 'error': 'Passphrase required for encrypted backup'})
                return True
            try:
                fd, tmp = tempfile.mkstemp(suffix='.json')
                os.close(fd)
                subprocess.run(
                    ['gpg', '--batch', '--passphrase-fd', '0', '--decrypt',
                     '-o', tmp, fp],
                    input=passphrase.encode(), check=True, timeout=60
                )
                work_path = tmp
            except subprocess.CalledProcessError:
                try: os.remove(tmp)
                except: pass
                _json(handler, 400, {'ok': False, 'error': 'Decryption failed — wrong passphrase?'})
                return True
            except Exception as e:
                try: os.remove(tmp)
                except: pass
                _json(handler, 500, {'ok': False, 'error': f'Decryption error: {e}'})
                return True

        # Read backup payload
        try:
            with open(work_path, 'r') as f:
                payload = json.load(f)
        except Exception as e:
            if is_encrypted:
                try: os.remove(tmp)
                except: pass
            _json(handler, 500, {'ok': False, 'error': f'Failed to read backup: {e}'})
            return True
        finally:
            if is_encrypted:
                try: os.remove(tmp)
                except: pass

        data = payload.get('data', {})
        meta = payload.get('_meta', {})
        _json(handler, 200, {
            'ok': True,
            'filename': filename,
            'meta': meta,
            'keys': list(data.keys()),
            'data': data
        })
        return True

    _json(handler, 404, {'ok': False, 'error': 'Unknown backup endpoint'})
    return True

# ── Quality API helpers ───────────────────────
_QUALITY_QUEUE_PATH = os.path.expanduser('~/.hermes/nexus-quality-queue.json')

def _load_quality_queue():
    try:
        with open(_QUALITY_QUEUE_PATH, 'r') as f:
            return json.load(f)
    except Exception:
        return {'queue': []}

def _api_quality(handler, path):
    """Quality queue endpoints."""
    if path == '/api/quality/queue':
        data = _load_quality_queue()
        queue = data.get('queue', [])
        counts = {}
        for item in queue:
            s = item.get('status', 'UNKNOWN')
            counts[s] = counts.get(s, 0) + 1
        last_audit = None
        for item in sorted(queue, key=lambda x: x.get('created', ''), reverse=True):
            if item.get('created'):
                last_audit = item['created']
                break
        _json(handler, 200, {
            'ok': True,
            'counts': counts,
            'total': len(queue),
            'lastAudit': last_audit,
            'recent': queue[-10:][::-1]
        })
        return True

    if path.startswith('/api/quality/result/'):
        qid = path.split('/api/quality/result/')[-1]
        data = _load_quality_queue()
        item = next((i for i in data.get('queue', []) if i.get('id') == qid), None)
        if item:
            _json(handler, 200, {'ok': True, 'item': item})
        else:
            _json(handler, 404, {'ok': False, 'error': 'Not found'})
        return True

    if path == '/api/quality/approve':
        _json(handler, 200, {'ok': True, 'note': 'Approval recorded (stub)'})
        return True

    return False

# ── News Hub digest helpers ───────────────────────
_DIGEST_PATH = os.path.expanduser('~/.hermes/nexus-news-digest.json')

def _load_digest():
    try:
        with open(_DIGEST_PATH, 'r') as f:
            return json.load(f)
    except Exception:
        return None

def _save_digest(content):
    os.makedirs(os.path.dirname(_DIGEST_PATH), exist_ok=True)
    with open(_DIGEST_PATH, 'w') as f:
        json.dump(content, f, default=str)

# ── News Hub helpers ──────────────────────────
_NEWS_CACHE_PATH = os.path.expanduser('~/.hermes/nexus-news-cache.json')
_NEWS_CACHE_TTL = 900  # 15 minutes
_NEWS_FEEDS = {
    'world': 'http://feeds.bbci.co.uk/news/world/rss.xml',
    '_default': 'http://feeds.bbci.co.uk/news/rss.xml',
}

import time, re, xml.etree.ElementTree as ET, urllib.request, email.utils

def _parse_rfc822(ts):
    try:
        dt = email.utils.parsedate_to_datetime(ts)
        return dt.isoformat()
    except Exception:
        return None

def _guess_category(title, desc):
    txt = f"{title or ''} {desc or ''}".lower()
    scores = {
        'world': ['world', 'global', 'international', 'war', 'conflict', 'diplomacy'],
        'politics': ['politics', 'minister', 'mp ', 'mps', 'labour', 'conservative', 'starmer', 'sunak', 'parliament', 'election', 'government'],
        'technology': ['technology', ' tech ', ' ai ', 'artificial intelligence', 'digital', 'internet', 'smartphone', 'robot', 'cyber'],
        'business': ['business', 'economy', 'market', 'firms', 'company', 'profit', 'shares', 'trade', 'inflation', 'recession'],
        'sports': ['sport', 'football', 'cricket', 'rugby', 'tennis', 'golf', 'racing', 'olympic', 'fifa', 'uefa', 'nfl', 'nba'],
        'entertainment': ['entertainment', 'film', 'movie', 'music', 'tv', 'television', 'celeb', 'arts', 'fashion', 'theatre'],
        'science': ['science', 'space', 'climate', 'medical research', 'research', 'study', 'dna', 'species'],
        'health': ['health', 'hospital', 'medical', 'nhs', 'doctor', 'virus', 'disease', 'covid', 'cancer'],
    }
    best = 'world'
    best_score = 0
    for cat, keywords in scores.items():
        sc = sum(1 for k in keywords if k in txt)
        if sc > best_score:
            best_score = sc
            best = cat
    return best

def _fetch_bbc_news():
    try:
        req = urllib.request.Request('http://feeds.bbci.co.uk/news/rss.xml', headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = resp.read()
        root = ET.fromstring(data)
        items = []
        for item in root.findall('.//item'):
            title = item.find('title')
            link = item.find('link')
            desc = item.find('description')
            pub = item.find('pubDate')
            thumb = item.find('{http://search.yahoo.com/mrss/}thumbnail')
            if title is not None and link is not None:
                t = (title.text or '').strip()
                d = (desc.text or '').strip() if desc is not None else ''
                items.append({
                    'title': t,
                    'description': d,
                    'url': link.text.strip(),
                    'publishedAt': _parse_rfc822(pub.text) if pub is not None else None,
                    'urlToImage': thumb.get('url') if thumb is not None else None,
                    'source': {'name': 'BBC News'},
                    'category': _guess_category(t, d),
                })
        return items[:50]
    except Exception as e:
        return []

def _load_news_cache():
    try:
        with open(_NEWS_CACHE_PATH, 'r') as f:
            return json.load(f)
    except Exception:
        return {}

def _save_news_cache(data):
    os.makedirs(os.path.dirname(_NEWS_CACHE_PATH), exist_ok=True)
    with open(_NEWS_CACHE_PATH, 'w') as f:
        json.dump(data, f, default=str)

def _api_news(handler, path):
    import urllib.parse
    parsed = urllib.parse.urlparse(path)
    qs = urllib.parse.parse_qs(parsed.query)
    category = qs.get('category', [''])[0].strip().lower()
    q = qs.get('q', [''])[0].strip().lower()
    page = int(qs.get('page', ['1'])[0])
    page_size = min(int(qs.get('pageSize', ['20'])[0]), 50)

    cache = _load_news_cache()
    if cache.get('cachedAt') and time.time() - cache['cachedAt'] < _NEWS_CACHE_TTL and cache.get('articles'):
        articles = cache['articles']
    else:
        articles = _fetch_bbc_news()
        if articles:
            _save_news_cache({'cachedAt': time.time(), 'articles': articles})
        else:
            articles = cache.get('articles', [])

    if category:
        articles = [a for a in articles if a.get('category') == category]
    if q:
        articles = [a for a in articles if q in (a.get('title') or '').lower() or q in (a.get('description') or '').lower()]

    total = len(articles)
    start = (page - 1) * page_size
    end = start + page_size
    paged = articles[start:end]

    _json(handler, 200, {'articles': paged, 'totalResults': total})
    return True

def _api_rss_fetch(handler, path):
    import urllib.parse
    parsed = urllib.parse.urlparse(path)
    qs = urllib.parse.parse_qs(parsed.query)
    url = qs.get('url', [''])[0].strip()
    if not url:
        _json(handler, 400, {'ok': False, 'error': 'url required'})
        return True
    if not url.startswith('http://') and not url.startswith('https://'):
        _json(handler, 400, {'ok': False, 'error': 'invalid url scheme'})
        return True
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) Chrome/120.0.0.0'})
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = resp.read()
        root = ET.fromstring(data)
        ns = ''
        if root.tag.startswith('{'):
            ns = root.tag.split('}')[0] + '}'
        channel = root.find('.//{0}channel'.format(ns.replace('}', '') + '}') if ns else 'channel')
        if channel is None:
            channel = root
        feed_title = ''
        if channel is not None:
            t = channel.find('{0}title'.format(ns) if ns else 'title')
            if t is not None:
                feed_title = _html_mod.unescape(t.text or '')
        items = root.findall('.//{0}item'.format(ns) if ns else 'item')
        if not items:
            atom_ns = ''
            if root.tag.startswith('{'):
                atom_ns = root.tag.split('}')[0] + '}'
            items = root.findall('.//{0}entry'.format(atom_ns) if atom_ns else 'entry')
            feed_title = feed_title or 'Atom Feed'
        parsed_items = []
        for item in items[:30]:
            title_el = item.find('{0}title'.format(ns) if ns else 'title')
            link_el = item.find('{0}link'.format(ns) if ns else 'link')
            desc_el = item.find('{0}description'.format(ns) if ns else 'description') or item.find('{0}summary'.format(ns) if ns else 'summary')
            pub_el = item.find('{0}pubDate'.format(ns) if ns else 'pubDate') or item.find('{0}published'.format(ns) if ns else 'published') or item.find('{0}updated'.format(ns) if ns else 'updated')
            enclosure = item.find('{0}enclosure'.format(ns) if ns else 'enclosure')
            thumb = item.find('{http://search.yahoo.com/mrss/}thumbnail')
            title_str = _html_mod.unescape(title_el.text or '') if title_el is not None else ''
            if link_el is not None:
                link_str = link_el.text or link_el.get('href') or ''
            else:
                link_str = ''
            desc_str = ''
            if desc_el is not None:
                desc_str = _html_mod.unescape(desc_el.text or '')
            pub_str = ''
            if pub_el is not None:
                pub_str = pub_el.text or ''
            img = None
            if thumb is not None:
                img = thumb.get('url') or None
            if not img and enclosure is not None:
                img = enclosure.get('url') or None
            if not img and desc_str:
                m = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', desc_str, re.I)
                if m:
                    img = m.group(1)
            parsed_items.append({
                'title': title_str,
                'link': link_str,
                'description': desc_str,
                'published': pub_str,
                'image': img,
            })
        _json(handler, 200, {'ok': True, 'feed': {'title': feed_title, 'items': parsed_items}})
    except Exception as e:
        _json(handler, 200, {'ok': False, 'error': str(e)[:200]})
    return True

def _api_fetch_link(handler, path):
    import urllib.parse, re, html as _html_mod
    parsed = urllib.parse.urlparse(path)
    qs = urllib.parse.parse_qs(parsed.query)
    url = qs.get('url', [''])[0].strip()
    if not url:
        _json(handler, 400, {'ok': False, 'error': 'url required'})
        return True
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) Chrome/120.0.0.0'})
        with urllib.request.urlopen(req, timeout=10) as resp:
            html = resp.read().decode('utf-8', errors='replace')[:50000]
    except Exception as e:
        _json(handler, 200, {'ok': False, 'title': None, 'image': None, 'price': None, 'description': None, 'error': str(e)})
        return True

    title = None
    image = None
    description = None
    price = None

    og_title = re.search(r'<meta[^>]+property=["\']?og:title["\']?[^>]+content=["\']([^"\']+)["\']', html, re.I)
    og_image = re.search(r'<meta[^>]+property=["\']?og:image["\']?[^>]+content=["\']([^"\']+)["\']', html, re.I)
    og_desc = re.search(r'<meta[^>]+property=["\']?og:description["\']?[^>]+content=["\']([^"\']+)["\']', html, re.I)
    title_tag = re.search(r'<title[^>]*>([^<]+)</title>', html, re.I)

    if og_title:
        title = _html_mod.unescape(og_title.group(1).strip())
    elif title_tag:
        title = _html_mod.unescape(title_tag.group(1).strip())

    if og_image:
        image = og_image.group(1).strip()
    if og_desc:
        description = _html_mod.unescape(og_desc.group(1).strip())

    # Price heuristics
    price_candidates = []
    for pat in (
        r'["\']price["\']\s*[:=]\s*["\']?([0-9,.]+)["\']?',
        r'class=["\'][^"\']*price[^"\']*["\'][^>]*>([^<]+)',
        r'\$([0-9,.]+(?:\.[0-9]{1,2})?)',
        r'€([0-9,.]+(?:\.[0-9]{1,2})?)',
        r'£([0-9,.]+(?:\.[0-9]{1,2})?)',
    ):
        m = re.search(pat, html, re.I)
        if m:
            s = m.group(1).replace(',', '')
            try:
                if s.count('.') > 1:
                    s = s.replace('.', '', s.count('.') - 1).replace('.', '')
                price_candidates.append(round(float(s), 2))
            except ValueError:
                continue
    if price_candidates:
        price = price_candidates[0]

    _json(handler, 200, {
        'ok': True,
        'title': title,
        'image': image,
        'price': price,
        'description': description,
    })
    return True

_YOUTUBE_POOL = [
    {'title':'The Future of AI in 2025','channel':'Tech Insider','thumbnail':'https://picsum.photos/seed/ai2025/320/180.jpg','url':'https://www.youtube.com/results?search_query=ai+2025','category':'technology'},
    {'title':'Top Gear: Electric Road Trip','channel':'BBC Top Gear','thumbnail':'https://picsum.photos/seed/evroad/320/180.jpg','url':'https://www.youtube.com/results?search_query=top+gear+electric','category':'entertainment'},
    {'title':'How to Stay Productive','channel':'Better Humans','thumbnail':'https://picsum.photos/seed/productive/320/180.jpg','url':'https://www.youtube.com/results?search_query=stay+productive','category':'lifestyle'},
    {'title':'SpaceX Starship Launch','channel':'NASA','thumbnail':'https://picsum.photos/seed/starship/320/180.jpg','url':'https://www.youtube.com/results?search_query=spacex+starship','category':'science'},
    {'title':'Premier League Highlights','channel':'Sky Sports','thumbnail':'https://picsum.photos/seed/epl/320/180.jpg','url':'https://www.youtube.com/results?search_query=premier+league+highlights','category':'sports'},
    {'title':'Healthy Morning Routine','channel':'Wellness Weekly','thumbnail':'https://picsum.photos/seed/health morning/320/180.jpg','url':'https://www.youtube.com/results?search_query=healthy+morning+routine','category':'health'},
    {'title':'Crypto Market Weekly','channel':'Coin Bureau','thumbnail':'https://picsum.photos/seed/crypto weekly/320/180.jpg','url':'https://www.youtube.com/results?search_query=crypto+weekly','category':'technology'},
    {'title':'Behind the Scenes: Dune 3','channel':'Warner Bros','thumbnail':'https://picsum.photos/seed/dune3/320/180.jpg','url':'https://www.youtube.com/results?search_query=dune+3+behind+the+scenes','category':'entertainment'},
    {'title':'Minimalist Desk Setup 2025','channel':'Setup Wars','thumbnail':'https://picsum.photos/seed/desksetup/320/180.jpg','url':'https://www.youtube.com/results?search_query=minimalist+desk+setup+2025','category':'technology'},
    {'title':'Championship Final Recap','channel':'ESPN','thumbnail':'https://picsum.photos/seed/champ final/320/180.jpg','url':'https://www.youtube.com/results?search_query=championship+final','category':'sports'},
    {'title':'Deep Sea Exploration','channel':'Nat Geo','thumbnail':'https://picsum.photos/seed/deepsea/320/180.jpg','url':'https://www.youtube.com/results?search_query=deep+sea+exploration','category':'science'},
    {'title':'Mindful Meditation Guide','channel':'Headspace','thumbnail':'https://picsum.photos/seed/meditate/320/180.jpg','url':'https://www.youtube.com/results?search_query=mindful+meditation+guide','category':'health'},
]

def _get_youtube_batch(seed=0, size=6):
    n = len(_YOUTUBE_POOL)
    s = int(seed) % max(n, 1)
    out = []
    for i in range(size):
        out.append(_YOUTUBE_POOL[(s + i) % n])
    return out

# ── Vault API + AES-256-GCM encryption ──
VAULT_DIR = os.path.expanduser('~/.hermes/data/vault')
os.makedirs(VAULT_DIR, exist_ok=True)
VAULT_INDEX = os.path.expanduser('~/.hermes/data/vault-index.json')

def _get_vault_key():
    raw = os.environ.get('ENCRYPTION_KEY') or TEMP_PIN
    if isinstance(raw, str):
        raw = raw.encode('utf-8')
    # Derive 32-byte key via SHA-256
    return hashlib.sha256(raw).digest()

def _encrypt(data_bytes, key):
    aes = AESGCM(key)
    iv = os.urandom(12)
    ct = aes.encrypt(iv, data_bytes, None)
    return base64.b64encode(iv + ct).decode('utf-8')

def _decrypt(enc_b64, key):
    aes = AESGCM(key)
    raw = base64.b64decode(enc_b64)
    iv, ct = raw[:12], raw[12:]
    return aes.decrypt(iv, ct, None)

def _load_vault_index():
    try:
        with open(VAULT_INDEX, 'r') as f:
            return json.load(f)
    except Exception:
        return {'items': []}

def _save_vault_index(idx):
    tmp = VAULT_INDEX + '.tmp'
    with open(tmp, 'w') as f:
        json.dump(idx, f, indent=2, default=str)
    shutil.move(tmp, VAULT_INDEX)

def _api_vault(handler, raw_path):
    import urllib.parse, email, re
    key = _get_vault_key()
    parsed = urllib.parse.urlparse(raw_path)
    path = parsed.path
    qs = urllib.parse.parse_qs(parsed.query)

    if path == '/api/vault/list':
        idx = _load_vault_index()
        folder = qs.get('folder', [''])[0]
        items = idx.get('items', [])
        if folder:
            items = [i for i in items if i.get('folder') == folder]
        _json(handler, 200, {'items': items})
        return True

    if path == '/api/vault/download':
        fid = qs.get('id', [''])[0]
        if not fid:
            _json(handler, 400, {'ok': False, 'error': 'id required'})
            return True
        idx = _load_vault_index()
        item = next((i for i in idx.get('items', []) if i['id'] == fid), None)
        if not item:
            _json(handler, 404, {'ok': False, 'error': 'file not found'})
            return True
        storage_path = os.path.join(VAULT_DIR, fid + '.enc')
        try:
            with open(storage_path, 'rb') as f:
                enc = f.read().decode('utf-8')
            data = _decrypt(enc, key)
        except Exception as e:
            _json(handler, 500, {'ok': False, 'error': 'decrypt failed: ' + str(e)})
            return True
        handler.send_response(200)
        handler.send_header('Content-Type', item.get('mime', 'application/octet-stream'))
        handler.send_header('Content-Disposition', 'attachment; filename="' + item.get('filename', 'download') + '"')
        handler.send_header('Content-Length', len(data))
        _cors(handler)
        handler.end_headers()
        handler.wfile.write(data)
        return True

    if handler.command != 'POST':
        _json(handler, 405, {'ok': False, 'error': 'method not allowed'})
        return True

    if path == '/api/vault/upload':
        length = int(handler.headers.get('Content-Length', 0))
        body = b''
        if length:
            body = handler.rfile.read(length)
        ctype = handler.headers.get('Content-Type', '')
        # Parse multipart using email module (zero-dep)
        boundary = ''
        m = re.search(r'boundary=([^;\s]+)', ctype)
        if m:
            boundary = m.group(1).strip().strip("'""")
        if not boundary:
            _json(handler, 400, {'ok': False, 'error': 'cannot parse multipart'})
            return True
        msg = email.message_from_bytes(
            (b'Content-Type: multipart/form-data; boundary=' + boundary.encode() + b'\n\n' + body)
        )
        uploaded = None
        uploaded_name = ''
        for part in msg.walk():
            cd = part.get('Content-Disposition', '')
            if 'form-data' in cd and 'name="file"' in cd:
                uploaded = part.get_payload(decode=True)
                uploaded_name = ''
                fnm = re.search(r'filename="([^"]+)"', cd)
                if fnm:
                    uploaded_name = fnm.group(1)
                break
        if not uploaded:
            _json(handler, 400, {'ok': False, 'error': 'no file'})
            return True
        fid = str(uuid.uuid4())
        folder = 'Other'
        mime = 'application/octet-stream'
        # Re-parse form fields for folder/meta
        folder_val = None
        for part in msg.walk():
            cd = part.get('Content-Disposition', '')
            if 'form-data' in cd and 'name="folder"' in cd:
                folder_val = part.get_payload(decode=True)
                if folder_val:
                    folder = folder_val.decode('utf-8', errors='replace').strip()
            if 'form-data' in cd and 'name="mime"' in cd:
                mv = part.get_payload(decode=True)
                if mv:
                    mime = mv.decode('utf-8', errors='replace').strip()
        enc_str = _encrypt(uploaded, key)
        storage_path = os.path.join(VAULT_DIR, fid + '.enc')
        with open(storage_path, 'w') as f:
            f.write(enc_str)
        item = {
            'id': fid,
            'filename': uploaded_name or 'unknown',
            'folder': folder,
            'size': len(uploaded),
            'ts': time.strftime('%Y-%m-%dT%H:%M:%S'),
            'mime': mime,
        }
        idx = _load_vault_index()
        idx.setdefault('items', []).append(item)
        _save_vault_index(idx)
        _json(handler, 200, {'ok': True, 'id': fid, 'filename': item['filename'], 'size': item['size']})
        return True

    if path == '/api/vault/delete':
        try:
            length = int(handler.headers.get('Content-Length', 0))
            body = handler.rfile.read(length).decode('utf-8') if length else '{}'
            req = json.loads(body)
        except Exception:
            _json(handler, 400, {'ok': False, 'error': 'bad json'})
            return True
        fid = req.get('id')
        if not fid:
            _json(handler, 400, {'ok': False, 'error': 'id required'})
            return True
        idx = _load_vault_index()
        before = len(idx.get('items', []))
        idx['items'] = [i for i in idx.get('items', []) if i['id'] != fid]
        _save_vault_index(idx)
        spath = os.path.join(VAULT_DIR, fid + '.enc')
        try:
            os.remove(spath)
        except Exception:
            pass
        _json(handler, 200, {'ok': True, 'removed': before - len(idx['items'])})
        return True

    if path == '/api/vault/move':
        try:
            length = int(handler.headers.get('Content-Length', 0))
            body = handler.rfile.read(length).decode('utf-8') if length else '{}'
            req = json.loads(body)
        except Exception:
            _json(handler, 400, {'ok': False, 'error': 'bad json'})
            return True
        fid = req.get('id')
        new_folder = req.get('newFolder')
        if not fid or not new_folder:
            _json(handler, 400, {'ok': False, 'error': 'id and newFolder required'})
            return True
        idx = _load_vault_index()
        item = next((i for i in idx.get('items', []) if i['id'] == fid), None)
        if not item:
            _json(handler, 404, {'ok': False, 'error': 'file not found'})
            return True
        item['folder'] = new_folder
        _save_vault_index(idx)
        _json(handler, 200, {'ok': True})
        return True

    _json(handler, 404, {'ok': False, 'error': 'unknown vault endpoint'})
    return True

def _api_ai_suggester(handler, path):
    if path == '/api/ai/suggest':
        try:
            length = int(handler.headers.get('Content-Length', 0))
            body = handler.rfile.read(length).decode('utf-8') if length else '{}'
            payload = json.loads(body)
        except Exception:
            payload = {}

        model = payload.get('model', 'llama3.2')
        context = payload.get('context', {})

        prompt = (
            "You are a productivity assistant. Given the user's recent dashboard data, suggest 3-5 actionable tasks or improvements.\n"
            "Respond ONLY in valid JSON with no markdown formatting. Format exactly:\n"
            '{ "suggestions": [ { "id": "suggest-1", "title": "...", "description": "...", "priority": "HIGH|MEDIUM|LOW", "category": "work|personal|health|learning|chores" } ] }\n'
            f"Dashboard context: upcoming events={context.get('recentEvents', 0)}, pending todos={context.get('pendingTodos', 0)}, notes count={context.get('notesCount', 0)}.\n"
            "Provide the JSON response now."
        )

        generated = _ollama_generate(prompt, model=model, timeout=45)
        suggestions = []
        if generated:
            try:
                raw = generated.strip()
                if raw.startswith('```'):
                    lines = raw.splitlines()
                    if lines[0].startswith('```'):
                        lines = lines[1:]
                    if lines and lines[-1].startswith('```'):
                        lines = lines[:-1]
                    raw = '\n'.join(lines).strip()
                parsed = json.loads(raw)
                if isinstance(parsed, dict) and isinstance(parsed.get('suggestions'), list):
                    suggestions = parsed['suggestions']
            except Exception:
                pass

        if not suggestions:
            suggestions = [
                {'id': 'suggest-1', 'title': 'Review open tasks', 'description': 'High-priority items are pending', 'priority': 'HIGH', 'category': 'work'},
                {'id': 'suggest-2', 'title': 'Check calendar', 'description': 'Upcoming events today', 'priority': 'MEDIUM', 'category': 'personal'},
                {'id': 'suggest-3', 'title': 'Browse news digest', 'description': 'Top stories are ready', 'priority': 'LOW', 'category': 'personal'},
            ]

        _json(handler, 200, {'ok': True, 'suggestions': suggestions})
        return True
    return False

class SPAHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        self.args_dir = k.pop('args_dir')
        super().__init__(*a, directory=self.args_dir, **k)

    def _api_handler(self):
        path = self.path.split('?')[0]
        repo = os.path.dirname(os.path.abspath(self.args_dir))

        if path == '/api/server/status':
            info = {'pid': os.getpid(), 'port': self.server.server_address[1],
                    'uptime_seconds': int(time.time() - START_TIME)}
            info.update(_git_info(repo))
            _json(self, 200, info)
            return True

        if path == '/api/system/health':
            _json(self, 200, _health())
            return True

        if path == '/api/system/deps':
            _json(self, 200, _deps())
            return True

        if path == '/api/system/network':
            _json(self, 200, _network())
            return True

        if path == '/api/system/logs':
            _json(self, 200, _logs())
            return True

        if path == '/api/agent/status':
            _json(self, 200, agent_status())
            return True

        if path == '/api/agent/heartbeat':
            _json(self, 200, agent_heartbeat())
            return True

        if path == '/api/agent/notify':
            import datetime
            try:
                length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(length).decode('utf-8') if length else '{}'
                req = json.loads(body)
            except Exception:
                _json(self, 400, {'ok': False, 'error': 'Invalid JSON'})
                return True
            note = {
                'id': 'agent-' + str(int(time.time() * 1000)),
                'title': req.get('title', 'Build Update'),
                'message': req.get('message', ''),
                'type': req.get('type', 'info'),
                'timestamp': datetime.datetime.now().isoformat()
            }
            # Save to server-side notification queue file
            queue_path = os.path.expanduser('~/.hermes/nexus-notifications.json')
            queue = []
            try:
                with open(queue_path, 'r') as f:
                    queue = json.load(f)
            except Exception:
                pass
            queue.append(note)
            # keep last 50
            queue = queue[-50:]
            try:
                with open(queue_path, 'w') as f:
                    json.dump(queue, f, indent=2)
            except Exception:
                pass
            _json(self, 200, {'ok': True, 'notification': note, 'queued': len(queue)})
            return True

        if path == '/api/agent/notifications':
            queue_path = os.path.expanduser('~/.hermes/nexus-notifications.json')
            queue = []
            try:
                with open(queue_path, 'r') as f:
                    queue = json.load(f)
            except Exception:
                pass
            _json(self, 200, {'notifications': queue[-20:]})
            return True

        if path == '/api/notifications':
            queue_path = os.path.expanduser('~/.hermes/nexus-notifications.json')
            queue = []
            try:
                with open(queue_path, 'r') as f:
                    queue = json.load(f)
            except Exception:
                pass
            _json(self, 200, {'notifications': queue[-50:]})
            return True

        if path == '/api/backup/':
            _json(self, 200, {'ok': True})
            return True

        if path.startswith('/api/backup/'):
            return _api_backup(self, path, repo)

        if path.startswith('/api/vault/'):
            return _api_vault(self, self.path)

        if path.startswith('/api/auth/'):
            return _api_auth(self, path)

        if path.startswith('/api/adb/'):
            return _api_adb(self, path)

        if path.startswith('/api/finance/'):
            if path == '/api/finance/read' and self.command == 'GET':
                return _api_finance_tracker_read(self)
            if path == '/api/finance/write' and self.command == 'POST':
                return _api_finance_tracker_write(self)
            return _api_finance(self, self.path)

        if path.startswith('/api/hermes/'):
            return _api_hermes(self, path)

        if path.startswith('/api/calendar/'):
            return _api_calendar(self, self.path)

        if path.startswith('/api/email/'):
            return _api_email(self, self.path)

        if path.startswith('/api/pdf/'):
            return _api_pdf(self, path, self.path)

        if path.startswith('/api/store/'):
            if self.command == 'GET':
                return _api_store_get(self, self.path)
            elif self.command == 'POST':
                return _api_store_post(self, self.path)
            return False

        if path.startswith('/api/quality/'):
            return _api_quality(self, path)

        if path.startswith('/api/rss/fetch'):
            return _api_rss_fetch(self, self.path)

        if path.startswith('/api/feedback/'):
            return _api_feedback(self, self.path)

        if path == '/api/fetch-link':
            return _api_fetch_link(self, self.path)

        # --- News Hub ---
        if path == '/api/news':
            return _api_news(self, self.path)
        if path == '/api/news/categories':
            _json(self, 200, ['world','politics','technology','business','sports','entertainment','science','health'])
            return True
        if path == '/api/youtube/daily':
            import urllib.parse
            parsed = urllib.parse.urlparse(self.path)
            qs = urllib.parse.parse_qs(parsed.query)
            seed = int(qs.get('seed', ['0'])[0])
            _json(self, 200, {'videos': _get_youtube_batch(seed)})
            return True
        if path == '/api/news/digest/latest':
            d = _load_digest()
            if d and d.get('ready'):
                _json(self, 200, {'ready': True, 'content': d.get('content')})
            else:
                _json(self, 200, {'ready': False, 'content': None})
            return True
        if path.startswith('/api/news/digest/'):
            # poll for a specific digest (older stub kept for compat)
            d = _load_digest()
            if d and d.get('ready'):
                _json(self, 200, {'ready': True, 'content': d.get('content')})
            else:
                _json(self, 200, {'ready': False, 'content': None})
            return True

        if path.startswith('/api/pdf/'):
            if _api_pdf(self, path, self.path):
                return True

        return False

    def do_OPTIONS(self):
        self.send_response(204)
        _cors(self)
        self.end_headers()

    def do_POST(self):
        self.extensions_map['.js'] = 'application/javascript'
        self.extensions_map['.css'] = 'text/css'
        self.extensions_map['.svg'] = 'image/svg+xml'
        self.extensions_map['.json'] = 'application/json'
        # ── TEMP PIN AUTH ──
        if self.path == '/pin-auth':
            import cgi
            ctype, pdict = cgi.parse_header(self.headers.get('Content-Type', ''))
            length = int(self.headers.get('Content-Length', 0))
            if length:
                body = self.rfile.read(length).decode('utf-8')
                pin = body.strip()
                if pin == TEMP_PIN:
                    self.send_response(200)
                    self.send_header('Set-Cookie', 'nexus_pin=fullroot88; Path=/; SameSite=Strict')
                    _cors(self)
                    self.end_headers()
                    self.wfile.write(b'{"ok":true}')
                else:
                    self.send_response(401)
                    _cors(self)
                    self.end_headers()
                    self.wfile.write(b'{"ok":false}')
            else:
                self.send_response(400)
                _cors(self)
                self.end_headers()
            return
        if self.path.startswith('/api/'):
            path = self.path.split('?')[0]
            repo = os.path.dirname(os.path.abspath(self.args_dir))
            if path.startswith('/api/backup/'):
                if _api_backup(self, path, repo):
                    return
            if path.startswith('/api/auth/'):
                if _api_auth(self, path):
                    return
            if path.startswith('/api/hermes/'):
                if _api_hermes(self, path):
                    return
            if path.startswith('/api/calendar/'):
                if _api_calendar(self, self.path):
                    return
            if path.startswith('/api/email/'):
                if _api_email(self, self.path):
                    return
            if path.startswith('/api/feedback/'):
                if _api_feedback(self, self.path):
                    return
            if path.startswith('/api/vault/'):
                if _api_vault(self, self.path):
                    return
            if path == '/api/finance/write':
                if _api_finance_tracker_write(self):
                    return
            if path.startswith('/api/ai/'):
                if _api_ai_suggester(self, path):
                    return
            if path == '/api/notifications':
                queue_path = os.path.expanduser('~/.hermes/nexus-notifications.json')
                queue = []
                try:
                    with open(queue_path, 'r') as f:
                        queue = json.load(f)
                except Exception:
                    pass
                try:
                    length = int(self.headers.get('Content-Length', 0))
                    body = self.rfile.read(length).decode('utf-8') if length else '{}'
                    payload = json.loads(body)
                except Exception:
                    _json(self, 400, {'ok': False, 'error': 'Invalid JSON'})
                    return
                import datetime
                note = {
                    'id': 'ui-' + str(int(time.time() * 1000)),
                    'title': payload.get('title', ''),
                    'body': payload.get('body', ''),
                    'app': payload.get('app', 'system'),
                    'priority': payload.get('priority', 'normal'),
                    'timestamp': datetime.datetime.now().isoformat()
                }
                queue.append(note)
                queue = queue[-50:]
                try:
                    with open(queue_path, 'w') as f:
                        json.dump(queue, f, indent=2)
                except Exception:
                    pass
                _json(self, 200, {'ok': True, 'notification': note, 'queued': len(queue)})
                return
            if path.startswith('/api/store/'):
                if _api_store_post(self, path):
                    return
            # -- News Hub POST stubs --
            if path == '/api/news/digest':
                try:
                    length = int(self.headers.get('Content-Length', 0))
                    body = self.rfile.read(length).decode('utf-8') if length else '{}'
                    payload = json.loads(body)
                except Exception:
                    payload = {}
                categories = payload.get('categories', ['world','politics','technology'])
                max_articles = min(int(payload.get('maxArticles', 10)), 20)
                cache = _load_news_cache()
                articles = cache.get('articles', [])
                if not articles:
                    articles = _fetch_bbc_news()
                    if articles:
                        _save_news_cache({'cachedAt': time.time(), 'articles': articles})
                # build digest
                top_story = None
                groups = {}
                for a in articles:
                    cat = a.get('category', 'world')
                    if cat in categories:
                        if top_story is None:
                            top_story = a
                        groups.setdefault(cat, []).append(a)
                digest = {
                    'ready': True,
                    'timestamp': datetime.datetime.now().isoformat() if 'datetime' in globals() else time.strftime('%Y-%m-%dT%H:%M:%S'),
                    'content': {
                        'topStory': {
                            'title': top_story.get('title',''),
                            'source': top_story.get('source',{}).get('name',''),
                        } if top_story else None,
                        'groups': [
                            {
                                'category': cat,
                                'items': [a.get('title','') for a in items[:max_articles]]
                            }
                            for cat, items in groups.items() if items
                        ],
                    },
                    'categories': categories,
                }
                _save_digest(digest)
                _json(self, 200, {'digestId': 'digest-' + str(int(time.time())), 'status': 'ready', 'ready': True})
                return
        self.send_response(405)
        self.end_headers()

    def do_GET(self):
        self.extensions_map['.js'] = 'application/javascript'
        self.extensions_map['.css'] = 'text/css'
        self.extensions_map['.svg'] = 'image/svg+xml'
        self.extensions_map['.json'] = 'application/json'
        # ── TEMP PIN GATE ──
        # Skip PIN check for static assets (files that exist on disk)
        static_path = os.path.join(self.args_dir, self.path.lstrip('/'))
        is_static = os.path.isfile(static_path)
        if not self.path.startswith('/api/') and not is_static and not (self.path.endswith('.css') or self.path.endswith('.js') or self.path.endswith('.ico')):
            cookies = self.headers.get('Cookie', '')
            if 'nexus_pin=fullroot88' not in cookies:
                self.send_response(200)
                self.send_header('Content-Type', 'text/html')
                _cors(self)
                self.end_headers()
                self.wfile.write(f'''
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Nexus Command Center</title>
<style>
  * {{ margin:0; padding:0; box-sizing:border-box; }}
  body {{ background:#0a0a0f; display:flex; justify-content:center; align-items:center; height:100vh; font-family:'Segoe UI',system-ui,sans-serif; overflow:hidden; }}
  .gate {{ text-align:center; z-index:10; }}
  .gate h1 {{ color:#39d0f2; font-size:2rem; margin-bottom:0.5rem; text-shadow:0 0 20px rgba(57,208,242,.5); letter-spacing:2px; }}
  .gate p {{ color:#888; margin-bottom:2rem; font-size:.95rem; }}
  .pin-wrap {{ margin:0 auto; max-width:320px; }}
  .pin-wrap input {{ width:100%; padding:.85rem 1rem; font-size:1.1rem; background:#11111a; border:2px solid #1f1f2e; border-radius:8px; color:#fff; outline:none; caret-color:#39d0f2; transition:border-color .2s,box-shadow .2s; }}
  .pin-wrap input:focus {{ border-color:#39d0f2; box-shadow:0 0 10px rgba(57,208,242,.3); }}
  .shield {{ position:absolute; inset:0; background:radial-gradient(circle at center,#0a1925 0%,#000 100%); opacity:.9; }}
  .scanline {{ position:absolute; inset:0; background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,255,200,.02) 2px,rgba(0,255,200,.02) 4px); pointer-events:none; }}
  .pulse {{ animation: gatePulse 3s ease-in-out infinite; }}
  @keyframes gatePulse {{ 0%,100% {{ opacity:.6; }} 50% {{ opacity:1; }} }}
</style>
</head>
<body>
<div class="shield"></div>
<div class="scanline"></div>
<div class="gate">
  <h1 class="pulse">NEXUS COMMAND CENTER</h1>
  <p>Please enter your access code to continue</p>
  <div class="pin-wrap">
    <input id="pinInp" type="text" placeholder="Enter access code" autocomplete="off">
  </div>
  <p id="msg" style="margin-top:1.5rem;color:#c44;font-size:.9rem;min-height:1.2rem;"></p>
</div>
<script>
  const pinInp=document.getElementById('pinInp');
  const msg=document.getElementById('msg');
  pinInp.addEventListener('keydown',e=>{{
    if(e.key==='Enter'){{
      e.preventDefault();
      const pin=pinInp.value.trim();
      if(!pin){{pinInp.focus();return;}}
      msg.textContent='Verifying...';
      msg.style.color='#39d0f2';
      fetch('/pin-auth',{{method:'POST',headers:{{'Content-Type':'text/plain'}},body:pin}})
      .then(r=>r.json())
      .then(j=>{{
        if(j.ok){{location.reload();}}
        else{{msg.textContent='ACCESS DENIED';msg.style.color='#c44';pinInp.style.borderColor='#c44';setTimeout(()=>{{pinInp.style.borderColor='#1f1f2e';pinInp.value='';pinInp.focus();}},800);}}
      }});
    }}
  }});
  pinInp.focus();
</script>
</body>
</html>
'''.encode('utf-8'))
                return
        # ── NORMAL SPA LOGIC ──
        if self.path.startswith('/api/'):
            if self._api_handler():
                return
        path = os.path.join(self.args_dir, self.path.lstrip('/'))
        if self.path != '/' and '.' not in os.path.basename(self.path) and not os.path.exists(path):
            self.path = '/'
        super().do_GET()

    def log_message(self, fmt, *a):
        sys.stderr.write(fmt % a + '\n')

# ── Main ────────────────────────────────────────
def main():
    args = get_args()
    root = os.path.abspath(args.dir)

    kill_existing()
    write_pid(os.getpid())
    atexit.register(remove_pid)

    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(('', args.port), lambda *a, **k: SPAHandler(*a, args_dir=root, **k)) as httpd:
        print(f'✓ Nexus running at http://localhost:{args.port}')
        print(f'✓ Serving from {root}')
        print(f'✓ PID: {os.getpid()}  (saved to {PIDFILE})')
        httpd.serve_forever()

if __name__ == '__main__':
    main()
