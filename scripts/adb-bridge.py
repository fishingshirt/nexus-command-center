#!/usr/bin/env python3
"""ADB Bridge — detect Android device, query battery/signal, read SMS, send SMS.
   Writes state to ~/.hermes/nexus-adb-state.json for the dashboard to poll.
"""
import json, os, re, shutil, subprocess, sys, time

STATE_PATH = os.path.expanduser('~/.hermes/nexus-adb-state.json')
SENT_LOG_PATH = os.path.expanduser('~/.hermes/nexus-adb-sent.json')

def _run(cmd, timeout=8):
    try:
        out = subprocess.check_output(cmd, stderr=subprocess.STDOUT, text=True, timeout=timeout)
        return out.strip()
    except Exception as e:
        return str(e)

def _adb_cmd(args, timeout=8):
    adb = shutil.which('adb')
    if not adb:
        return None, 'adb not found in PATH'
    return _run([adb] + args, timeout), None

def detect_device():
    out, err = _adb_cmd(['devices', '-l'])
    if err:
        return {'connected': False, 'error': err, 'adbInstalled': False}
    lines = [l for l in out.splitlines() if l.strip() and not l.startswith('*')]
    devs = []
    for line in lines[1:]:
        parts = line.split(None, 1)
        if len(parts) >= 2 and parts[1] != 'offline':
            devs.append(parts[0])
    if not devs:
        return {'connected': False, 'error': 'No device found', 'adbInstalled': True}
    return {'connected': True, 'serial': devs[0], 'adbInstalled': True}

def battery(serial):
    out, _ = _adb_cmd(['-s', serial, 'shell', 'dumpsys', 'battery'])
    m = re.search(r'level: (\d+)', out)
    return int(m.group(1)) if m else None

def signal_strength(serial):
    out, _ = _adb_cmd(['-s', serial, 'shell', 'dumpsys', 'telephony.registry'])
    # LTE signal strength sometimes shown as mLte=SignalStrength:...
    m = re.search(r'mSignalStrength=.*?(\d+)', out)
    return int(m.group(1)) if m else None

def read_sms(serial, limit=50):
    out, err = _adb_cmd([
        '-s', serial, 'shell', 'content', 'query',
        '--uri', 'content://sms/inbox',
        '--projection', 'address,date,body',
        '--limit', str(limit)
    ])
    if err or not out:
        return []
    msgs = []
    for line in out.splitlines():
        # format: Row: N address=..., date=..., body=...
        addr = re.search(r'address=([^,]+)', line)
        date = re.search(r'date=(\d+)', line)
        body = re.search(r'body=(.+)', line)
        if addr and body:
            msgs.append({
                'from': addr.group(1).strip(),
                'date': int(date.group(1)) if date else 0,
                'body': body.group(1).strip(),
                'type': 'inbox'
            })
    return sorted(msgs, key=lambda x: x['date'], reverse=True)

def send_sms(serial, number, text):
    # Try service call (works on many devices without root)
    out, err = _adb_cmd([
        '-s', serial, 'shell', 'service', 'call', 'isms', '5',
        'i32', '0', 's16', 'com.android.mms',
        's16', number, 's16', 'null', 's16', text, 's16', 'null',
        'i32', '0', 'i64', '0'
    ])
    if err:
        # Fallback: open messaging app with intent
        _adb_cmd([
            '-s', serial, 'shell', 'am', 'start',
            '-a', 'android.intent.action.SENDTO',
            '-d', f'sms:{number}',
            '--es', 'sms_body', text
        ])
        return {'ok': True, 'method': 'intent', 'note': 'Messaging app opened. Tap send on device.'}
    return {'ok': True, 'method': 'service_call'}

def refresh_state():
    state = detect_device()
    state['timestamp'] = int(time.time())
    if state['connected']:
        serial = state['serial']
        state['battery'] = battery(serial)
        state['signal'] = signal_strength(serial)
        state['inbox'] = read_sms(serial, limit=30)
    os.makedirs(os.path.dirname(STATE_PATH), exist_ok=True)
    with open(STATE_PATH, 'w') as f:
        json.dump(state, f, indent=2)
    return state

def load_state():
    try:
        with open(STATE_PATH) as f:
            return json.load(f)
    except Exception:
        return refresh_state()

def log_sent(number, text):
    log = []
    try:
        with open(SENT_LOG_PATH) as f:
            log = json.load(f)
    except Exception:
        pass
    log.append({'to': number, 'body': text, 'time': int(time.time())})
    log = log[-200:]
    with open(SENT_LOG_PATH, 'w') as f:
        json.dump(log, f, indent=2)
    return log

if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'refresh'
    if cmd == 'refresh':
        print(json.dumps(refresh_state()))
    elif cmd == 'state':
        print(json.dumps(load_state()))
    elif cmd == 'send' and len(sys.argv) >= 4:
        st = load_state()
        if not st.get('connected'):
            print(json.dumps({'ok': False, 'error': 'No device connected'}))
            sys.exit(1)
        res = send_sms(st['serial'], sys.argv[2], sys.argv[3])
        log_sent(sys.argv[2], sys.argv[3])
        print(json.dumps(res))
    else:
        print('Usage: adb-bridge.py [refresh|state|send <number> <text>]')
