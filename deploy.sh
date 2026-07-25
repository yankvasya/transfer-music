#!/bin/bash
set -e

cd ~/projects/transfer-music

git pull origin main
npm ci
npm run build

rm -rf /var/snap/caddy/common/sites/transfermusic/*
cp -r dist/* /var/snap/caddy/common/sites/transfermusic/

pm2 restart transfermusic-api || pm2 start "npx tsx server.ts" --name transfermusic-api
