#!/data/data/com.termux/files/usr/bin/bash
# ========================================================
# PhoneZone / Multi-Software 1-Click Termux Launcher
# ========================================================

clear
echo "========================================================"
echo "    PhoneZone / Multi-App Termux Android Launcher       "
echo "========================================================"
echo ""

# 1. Check & Install Node.js if missing
if ! command -v node &> /dev/null; then
    echo "[*] Node.js not found. Installing nodejs via pkg..."
    pkg update -y
    pkg install -y nodejs build-essential python
    echo "[*] Node.js installed successfully!"
fi

echo "[*] Node version: $(node -v)"

# 2. Check dependencies
if [ ! -d "node_modules" ]; then
    echo "[*] First time setup: Installing npm dependencies..."
    npm install --omit=dev
fi

# 3. Check frontend build
if [ ! -f "dist/index.html" ]; then
    echo "[*] Building frontend assets..."
    npm run build
fi

# 4. Get Device Local IP
LOCAL_IP=$(ip -4 addr show wlan0 2>/dev/null | grep -oP '(?<=inet\s)\d+(\.\d+){3}' || echo "127.0.0.1")

echo ""
echo "========================================================"
echo " [*] Starting Server on Port 47713..."
echo " [*] Open Chrome on this phone: http://localhost:47713"
echo " [*] Or from other devices on Wi-Fi: http://${LOCAL_IP}:47713"
echo " [*] Press Ctrl+C to stop the server."
echo "========================================================"
echo ""

# Auto open browser if termux-open-url available
if command -v termux-open-url &> /dev/null; then
    (sleep 2 && termux-open-url http://localhost:47713) &
fi

export TERMUX_VERSION=${TERMUX_VERSION:-"1.0"}
node backend/src/server.js
