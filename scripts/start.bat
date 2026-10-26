@echo off
REM PhoneZone - start the local offline app (Windows, development / server mode)
cd /d "%~dp0.."
if not exist backend\node_modules (
  echo Installing backend dependencies...
  pushd backend && call npm install && popd
)
if not exist dist (
  echo Building frontend...
  call npm install
  call npm run build
)
echo Verifying backend native dependencies...
pushd backend
call node ensure-native.cjs
if errorlevel 1 (
  echo.
  echo Failed to prepare the native SQLite module. Run manually:
  echo   cd backend ^&^& npm rebuild better-sqlite3
  popd
  pause
  exit /b 1
)
popd
echo Starting PhoneZone on http://127.0.0.1:47713
set PHONEZONE_DATA_DIR=%cd%\data
pushd backend
node src/server.js
popd
pause
