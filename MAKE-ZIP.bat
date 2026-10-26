@echo off
REM ============================================================
REM  PhoneZone MAKE-ZIP - double-click this file.
REM
REM  Creates a clean shareable zip in this folder:
REM    PhoneZone_clean_<date-time>.zip
REM
REM  It refuses to build the zip if it finds real customer data
REM  (data\, data11\, *.db, .env, tar.gz) or a secret-looking
REM  string anywhere inside, and it writes ZIP_MANIFEST.txt
REM  (every file + sha256) into the zip.
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
echo   Building the clean zip. This can take a minute...
echo.

node "scripts\make-clean-zip.mjs"

echo.
echo   Finished. Look for PhoneZone_clean_*.zip in this folder.
echo.
pause
endlocal
