#!/bin/bash
set -e

# Server-side deploy script (to be placed on the server)
# Usage: sudo bash server_deploy.sh [commit-ish]

DEPLOY_DIR="/home/deploy/tihuashi"
COMMIT=${1:-}

if [ ! -d "$DEPLOY_DIR" ]; then
  mkdir -p "$DEPLOY_DIR"
  git clone https://github.com/wuxixixi/tihuashi.git "$DEPLOY_DIR"
fi

cd "$DEPLOY_DIR"

git fetch --all --prune
if [ -n "$COMMIT" ]; then
  git reset --hard "$COMMIT"
else
  git checkout main || true
  git reset --hard origin/main || true
fi

if [ -f docker-compose.yml ]; then
  docker-compose down || true
  docker-compose pull || true
  docker-compose up -d --build || true
else
  cd backend
  npm ci
  if ! command -v pm2 >/dev/null 2>&1; then
    npm install -g pm2 || true
  fi
  pm2 restart tihuashi || pm2 start server.js --name tihuashi || true
fi
