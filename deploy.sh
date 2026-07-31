#!/bin/bash
set -e

# Non-interactive SSH sessions (like this one) don't source ~/.bashrc, so nvm's PATH
# setup never runs and npm isn't found — load it explicitly and select the default version.
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use default

cd ~/projects/transfer-music

git pull origin main
npm ci
npm run build

rm -rf /var/snap/caddy/common/sites/transfermusic/*
cp -r dist/* /var/snap/caddy/common/sites/transfermusic/

pm2 restart transfermusic-api || pm2 start "npx tsx server.ts" --name transfermusic-api
