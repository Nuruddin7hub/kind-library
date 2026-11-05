#!/usr/bin/env python3
"""127.0.0.1:8888 CONNECT relay for the kind-library QA rig (pw_shots12.py).

Forwards through the runtime egress proxy, injecting the CURRENT credential from
$HTTPS_PROXY (it rotates; never hardcode). Tailscale destinations (*.ts.net,
100.64.0.0/10) go via the tunnel port 3130 on the same proxy host
(per ~/docs/devices/tailscale.md: tunnel_proxy="${HTTPS_PROXY%:*}:3130").

Run:  python3 ~/workspace/kind-library-v3/tools/relay8888.py   (backgrounded exec)
Then: playwright with proxy={"server": "http://127.0.0.1:8888"}

NOTE: lives in the workspace (not /tmp) because VM resets wipe /tmp AND
pip-installed packages. Reinstall at run start:
  pip install --break-system-packages playwright==1.64.1   (~5s; binaries survive in ~/.cache/ms-playwright)
"""
import os, socket, threading, base64
from urllib.parse import urlparse

UP = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")
if not UP:
    raise SystemExit("HTTPS_PROXY not set")
u = urlparse(UP)
UP_HOST, UP_PORT = u.hostname, u.port
TS_PORT = 3130  # tunnel port for Tailscale destinations
AUTH = "Basic " + base64.b64encode(f"{u.username}:{u.password}".encode()).decode() if u.username else None
BUF = 65536

def is_tailscale(host):
    h = host.lower().split(":")[0]
    if h.endswith(".ts.net"):
        return True
    try:
        parts = [int(x) for x in h.split(".")]
        return len(parts) == 4 and parts[0] == 100 and 64 <= parts[1] <= 127
    except ValueError:
        return False

def pipe(a, b):
    try:
        while True:
            d = a.recv(BUF)
            if not d:
                break
            b.sendall(d)
    except OSError:
        pass
    finally:
        for s in (a, b):
            try:
                s.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass
            s.close()

def handle(c):
    try:
        req = b""
        while b"\r\n\r\n" not in req:
            d = c.recv(4096)
            if not d:
                c.close()
                return
            req += d
        head = req.split(b"\r\n\r\n", 1)[0].decode("latin1")
        line = head.split("\r\n")[0]
        method, target, _ = line.split(" ", 2)
        # CONNECT target is "host:port"; plain-HTTP target is an absolute URI
        host = target.split("/")[2] if "://" in target else target
        port = TS_PORT if is_tailscale(host) else UP_PORT
        up = socket.create_connection((UP_HOST, port), timeout=30)
        lines = [f"{method} {target} HTTP/1.1",
                 f"Host: {target}",
                 "Proxy-Connection: keep-alive"]
        if AUTH:
            lines.append(f"Proxy-Authorization: {AUTH}")
        up.sendall(("\r\n".join(lines) + "\r\n\r\n").encode())
        resp = b""
        while b"\r\n\r\n" not in resp:
            d = up.recv(4096)
            if not d:
                break
            resp += d
        c.sendall(resp)
        status = resp.split(b"\r\n", 1)[0].decode("latin1", "replace")
        if "200" not in status:
            c.close()
            up.close()
            return
        t1 = threading.Thread(target=pipe, args=(c, up), daemon=True)
        t2 = threading.Thread(target=pipe, args=(up, c), daemon=True)
        t1.start()
        t2.start()
        t1.join()
        t2.join()
    except Exception:
        try:
            c.close()
        except OSError:
            pass

srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
srv.bind(("127.0.0.1", 8888))
srv.listen(64)
print("relay up on 127.0.0.1:8888", flush=True)
while True:
    c, _ = srv.accept()
    threading.Thread(target=handle, args=(c,), daemon=True).start()
