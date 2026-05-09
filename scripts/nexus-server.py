#!/usr/bin/env python3
"""Nexus Command Center — Static SPA Server
   Serves public/ on port 8080 with SPA fallback.
   Usage: python3 nexus-server.py [--port 8080] [--dir /path/to/public]
"""
import http.server, socketserver, os, sys, argparse, signal, atexit

PIDFILE = os.path.expanduser('~/.hermes/nexus-server.pid')

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

def main():
    args = get_args()
    root = os.path.abspath(args.dir)

    kill_existing()
    write_pid(os.getpid())
    atexit.register(remove_pid)

    class SPAHandler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **k):
            super().__init__(*a, directory=root, **k)
        def do_GET(self):
            self.extensions_map['.js'] = 'application/javascript'
            self.extensions_map['.css'] = 'text/css'
            self.extensions_map['.svg'] = 'image/svg+xml'
            self.extensions_map['.json'] = 'application/json'
            path = os.path.join(root, self.path.lstrip('/'))
            if self.path != '/' and '.' not in os.path.basename(self.path) and not os.path.exists(path):
                self.path = '/'
            super().do_GET()
        def log_message(self, fmt, *a):
            # Minimal log
            sys.stderr.write(fmt % a + '\n')

    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(('', args.port), SPAHandler) as httpd:
        print(f'✓ Nexus running at http://localhost:{args.port}')
        print(f'✓ Serving from {root}')
        print(f'✓ PID: {os.getpid()}  (saved to {PIDFILE})')
        httpd.serve_forever()

if __name__ == '__main__':
    main()
