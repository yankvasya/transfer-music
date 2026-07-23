#!/bin/bash
# Run on the server (via .github/workflows/deploy.yml) after every push to main.
# Assumes: this directory is a git clone of this repo, and the API process runs under
# pm2 as "transfermusic-api" (see the Self-hosting section in README.md). If you're using
# a different process manager, swap the last line for whatever restarts your equivalent.
set -e

cd "$(dirname "$0")"
git pull origin main
npm ci
npm run build
pm2 restart transfermusic-api || pm2 start "npx tsx server.ts" --name transfermusic-api
