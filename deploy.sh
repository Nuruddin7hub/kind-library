#!/bin/bash
# Build frontend and deploy dist/ to KS. Usage: deploy.sh
set -e
cd /home/hatch/workspace/kind-library-v3/frontend
echo "== building =="
npm run build 2>&1 | tail -3
echo "== rsync to KS =="
rsync -az --delete \
  -e "ssh -i /home/hatch/.ssh/id_ed25519 -o BatchMode=yes -o ConnectTimeout=15 -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no -o ProxyCommand=\"nc -X connect -x hatch-egress-proxy:3130 %h %p\"" \
  dist/ kind@100.73.179.14:kind-library-v3/frontend/dist/
echo "== verify =="
BUNDLE=$(curl -s --max-time 25 --proxy http://127.0.0.1:8888 "https://kind-server.taile8af1a.ts.net/" | grep -o 'assets/index-[^"]*\.js' | head -1)
LOCAL=$(grep -o 'assets/index-[^"]*\.js' dist/index.html | head -1)
echo "live:  $BUNDLE"
echo "local: $LOCAL"
if [ "$BUNDLE" = "$LOCAL" ] && [ -n "$BUNDLE" ]; then
  echo "DEPLOY OK"
else
  echo "DEPLOY MISMATCH — investigate"
  exit 1
fi
