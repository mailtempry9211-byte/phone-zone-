@echo off
setlocal enabledelayedexpansion
title PhoneZone Server Launcher

echo ========================================================
echo        PhoneZone Store ^& Repair Manager Server
echo ========================================================
echo.

:: 1. Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed on this computer!
    echo Please download and install Node.js from https://nodejs.org
    echo Then run this launcher again.
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo [*] Node.js detected: %NODE_VER%

:: 2. Check and auto-install npm dependencies
if not exist "node_modules\" (
    echo [*] First run detected: Installing required dependencies...
    echo [*] This will only happen once. Please wait 1-2 minutes...
    call npm install --omit=dev
    if %errorlevel% neq 0 (
        echo [ERROR] npm install encountered an error. Retrying with full install...
        call npm install
    )
)

:: 3. Check frontend build
if not exist "dist\index.html" (
    echo [*] Compiling production web bundle...
    call npm run build
)

:: 4. Start Server
echo.
echo [*] Starting PhoneZone Server on port 47713...
echo [*] Opening your browser in 2 seconds...
echo [*] Press Ctrl+C anytime to stop the server.
echo ========================================================
echo.

:: Launch browser after 2 seconds in background
start "" cmd /c "timeout /t 2 >nul & start http://localhost:47713"

:: Start the backend server
node backend/src/server.js

pause
