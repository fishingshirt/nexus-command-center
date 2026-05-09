#!/bin/bash
# Nexus Server — Static file server for the dashboard
# Serves /tmp/nexus-command-center/public on port 8080
# Auto-restarts if already running

REPO_DIR="/tmp/nexus-command-center"
PIDFILE="/tmp/nexus-server.pid"

# Kill existing
if [ -f "$PIDFILE" ]; then
    OLD_PID=$(cat "$PIDFILE" 2>/dev/null)
    if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
        echo "Stopping existing Nexus server (PID $OLD_PID)..."
        kill "$OLD_PID" 2>/dev/null
        sleep 1
    fi
    rm -f "$PIDFILE"
fi

cd "$REPO_DIR/public" || exit 1

echo "Starting Nexus Command Center on http://localhost:8080 ..."
# Use Python http.server for zero dependencies
# Serve from the public/ directory with SPA fallback via a small wrapper
python3 - "$@" <<'PYEOF'
import http.server, socketserver, os, sys
PORT = 8080
DIR = os.path.abspath('.')

class SPAHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=DIR, **k)
    def do_GET(self):
        # SPA fallback: serve index.html for unknown paths (skip assets/api)
        path = os.path.join(DIR, self.path.lstrip('/'))
        if self.path != '/' and '.' not in os.path.basename(self.path) and not os.path.exists(path):
            self.path = '/'
        super().do_GET()
    def log_message(self, fmt, *a):
        # Minimal logging
        print(fmt % a)

with socketserver.TCPServer(("", PORT), SPAHandler, allow_reuse_address=True) as httpd:
    print(f"✓ Nexus running at http://localhost:{PORT}")
    print(f"✓ Serving from {DIR}")
    print(f"✓ Press Ctrl+C to stop")
    httpd.serve_forever()
PYEOF
