#!/usr/bin/env bash
# PhoneZone - start the local offline app (Linux / macOS / Termux)
set -e
cd "$(dirname "$0")/.."

[ -d backend/node_modules ] || (cd backend && npm install)
[ -d dist ] || { npm install && npm run build; }

echo "Starting PhoneZone on http://127.0.0.1:47713"
cd backend && node src/server.js
