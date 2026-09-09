#!/usr/bin/env bash
# ============================================================
# SwarLekh — one-shot local deploy script (Netlify CLI)
# Usage:
#   chmod +x deploy.sh
#   ./deploy.sh            # deploys a DRAFT preview (safe, review link)
#   ./deploy.sh --prod     # deploys to PRODUCTION (live URL)
# ============================================================
set -euo pipefail   # stop immediately on any error — no silent half-deploys

echo "==> 1. Checking Node & npm..."
command -v node >/dev/null || { echo "Node.js not found. Install Node 18+ first."; exit 1; }
node -v

echo "==> 2. Installing dependencies (clean install)..."
npm ci || npm install   # npm ci is stricter/faster if package-lock.json is in sync

echo "==> 3. Type-checking (fails fast if any TS error)..."
npx tsc --noEmit

echo "==> 4. Building production bundle..."
npm run build

echo "==> 5. Checking Netlify CLI..."
if ! command -v netlify >/dev/null; then
  echo "Netlify CLI not found — installing globally..."
  npm install -g netlify-cli
fi

echo "==> 6. Deploying..."
if [[ "${1:-}" == "--prod" ]]; then
  netlify deploy --dir=dist --prod
else
  netlify deploy --dir=dist
  echo ""
  echo "This was a DRAFT deploy. Review the preview link above."
  echo "If it looks good, run:  ./deploy.sh --prod"
fi

echo "==> Done."
