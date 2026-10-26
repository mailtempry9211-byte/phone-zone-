@echo off
REM ============================================================
REM  PhoneZone VERIFY - double-click this file.
REM
REM  It checks the whole project (files, migrations, backend start
REM  and the stage's assertions) using a throw-away temp folder.
REM  Real customer data in data\ and data11\ is NEVER touched.
REM
REM  When it finishes, read VERIFY_OUTPUT.txt in this folder and
REM  send that file for review.
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

echo.
echo   PhoneZone verification is running. Please wait a few minutes...
echo   A full log is written to VERIFY_OUTPUT.txt
echo.

node "scripts\verify-all.mjs"

echo.
echo   Finished. Open VERIFY_OUTPUT.txt in this folder and send it for review.
echo.
pause
endlocal
