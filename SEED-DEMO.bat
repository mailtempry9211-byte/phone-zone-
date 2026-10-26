@echo off
REM ============================================================
REM  PhoneZone SEED-DEMO - double-click this file.
REM
REM  Builds a separate database full of FAKE demo data (5 sellers,
REM  5 customers, 6 phones, sales, and repair jobs when that module
REM  exists) in a temporary folder, so you can try screens safely.
REM
REM  Your real data in data\ and data11\ is never read or changed.
REM ============================================================
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js was not found on this computer.
  echo   Install the LTS version from https://nodejs.org and run this file again.
  echo.
  pause
  exit /b 1
)

node "scripts\seed-demo.mjs"

echo.
pause
endlocal
