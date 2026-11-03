#!/bin/bash
# Build frontend and deploy dist/ to KS. Usage: deploy.sh
set -e
cd ~/workspace/kind-library-v3/frontend
echo "== building =="
npm run build 2>&1 | tail -3
echo "== rsync to KS =="
rsync -az --delete \
  -e "ssh -i ~/.ssh/id_ed25519 -o BatchMode=yes -o ConnectTimeout=15 -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no -o ProxyCommand=\"nc -X connect -x <YOUR_EGRESS_PROXY> %h %p\"" \
  dist/ kind@<KS_TAILSCALE_IP>:kind-library-v3/frontend/dist/
echo "== verify =="
# Tailnet is reachable only through the egress proxy on port 3130 (3128 = public
# internet only; the 127.0.0.1:8888 relay needs its upstream on 3130 too).
# Proxy credentials come from the environment (HTTPS_PROXY).
PROXY_USER=$(printf '%s' "${HTTPS_PROXY:-}" | sed 's|^http://||; s|@.*||')
BUNDLE=$(curl -s --max-time 25 --proxy "http://<YOUR_EGRESS_PROXY>" ${PROXY_USER:+--proxy-user "$PROXY_USER"} "https://kind-server.taile8af1a.ts.net/" | grep -o 'assets/index-[^"]*\.js' | head -1)
LOCAL=$(grep -o 'assets/index-[^"]*\.js' dist/index.html | head -1)
echo "live:  $BUNDLE"
echo "local: $LOCAL"
if [ "$BUNDLE" = "$LOCAL" ] && [ -n "$BUNDLE" ]; then
  echo "DEPLOY OK"
else
  echo "DEPLOY MISMATCH — investigate"
  exit 1
fi
