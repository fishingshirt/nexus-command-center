#!/usr/bin/env python3
"""Nexus Command Center — Static SPA Server + IT Hub API
   Serves public/ on port 8080 with SPA fallback.
   Adds /api/* endpoints for IT Hub telemetry.
   Usage: python3 nexus-server.py [--port 8080] [--dir /path/to/public]
"""
import http.server, socketserver, os, sys, argparse, signal, atexit, json, time, subprocess, socket, shutil, hashlib
from pathlib import Path

PIDFILE = os.path.expanduser('~/.hermes/nexus-server.pid')
START_TIME = time.time()
TEMP_PIN = "fullroot88"

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
        with open(_HERMES_STATE_PATH, 'w') as f:
            json.dump(st, f)
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
    if path == '/api/hermes/message':
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
            _save_hermes_state(st)
            _json(handler, 200, {'ok': True, 'message_id': res['result'].get('message_id')})
        else:
            _json(handler, 502, {'ok': False, 'error': res.get('error', 'Telegram API failed'), 'description': res.get('description')})
        return True

    if path == '/api/hermes/poll':
        chat_id = _tg_chat_id()
        if not chat_id:
            _json(handler, 503, {'ok': False, 'error': 'TELEGRAM_HOME_CHANNEL not configured'})
            return True
        st = _load_hermes_state()
        offset = st.get('offset', 0)
        res = _tg_api('getUpdates', {'offset': offset + 1, 'limit': 20})
        messages = []
        if res.get('ok') and isinstance(res.get('result'), list):
            for upd in res['result']:
                msg = upd.get('message') or upd.get('channel_post')
                if not msg:
                    continue
                # Track highest update_id
                if upd.get('update_id', 0) > offset:
                    offset = upd['update_id']
                # Only capture text messages from our chat
                cid = str(msg.get('chat', {}).get('id', ''))
                if cid != str(chat_id):
                    continue
                txt = msg.get('text') or msg.get('caption', '')
                if txt:
                    messages.append({'text': txt, 'from': msg.get('from', {}).get('first_name', 'Hermes'),
                                     'time': msg.get('date'), 'message_id': msg.get('message_id')})
        st['offset'] = offset
        _save_hermes_state(st)
        _json(handler, 200, {'ok': True, 'messages': messages})
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

        if path.startswith('/api/backup/'):
            return _api_backup(self, path, repo)

        if path.startswith('/api/auth/'):
            return _api_auth(self, path)

        if path.startswith('/api/adb/'):
            return _api_adb(self, path)

        if path.startswith('/api/finance/'):
            return _api_finance(self, self.path)

        if path.startswith('/api/hermes/'):
            return _api_hermes(self, path)

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
        self.send_response(405)
        self.end_headers()

    def do_GET(self):
        self.extensions_map['.js'] = 'application/javascript'
        self.extensions_map['.css'] = 'text/css'
        self.extensions_map['.svg'] = 'image/svg+xml'
        self.extensions_map['.json'] = 'application/json'
        # ── TEMP PIN GATE ──
        # Skip PIN check for static assets the gate page needs
        if not self.path.startswith('/api/') and not (self.path.endswith('.css') or self.path.endswith('.js') or self.path.endswith('.ico')):
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
