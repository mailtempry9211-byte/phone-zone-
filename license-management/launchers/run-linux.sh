#!/bin/bash
# ========================================================
# PhoneZone / Multi-Software 1-Click Linux / Kali Launcher
# ========================================================

clear
echo "========================================================"
echo "    PhoneZone Linux / Kali Server Launcher              "
echo "========================================================"
echo ""

# 1. Check Node.js
if ! command -v node &> /dev/null; then
    echo "[!] Node.js is not installed."
    echo "[*] Attempting to install Node.js via apt..."
    sudo apt update && sudo apt install -y nodejs npm
fi

echo "[*] Node version: $(node -v)"

# 2. Check dependencies
if [ ! -d "node_modules" ]; then
    echo "[*] First time setup: Installing npm dependencies..."
    npm install --omit=dev
fi

# 3. Check frontend build
if [ ! -f "dist/index.html" ]; then
    echo "[*] Compiling frontend bundle..."
    npm run build
fi

# 4. Start Server
echo ""
echo "========================================================"
echo " [*] Starting Server on http://localhost:47713..."
echo " [*] Press Ctrl+C anytime to stop."
echo "========================================================"
echo ""

if command -v xdg-open &> /dev/null; then
    (sleep 2 && xdg-open http://localhost:47713) &
fi

node backend/src/server.js
