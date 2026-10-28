@echo off
setlocal EnableExtensions
title PhoneZone - Master Control Panel
cd /d "%~dp0"

rem ============================================================
rem  PHONEZONE MASTER CONTROL PANEL
rem  Double-click this file. It ALWAYS shows a menu first.
rem    - No business data yet : choose NEW SETUP or RESTORE a backup
rem    - Already set up       : full control panel (start, stop,
rem                             backup, restore, ngrok, build...)
rem  App address : http://127.0.0.1:47713   Data folder : .\data
rem ============================================================

set "ROOT=%~dp0"
set "PORT=47713"
set "URL=http://127.0.0.1:%PORT%"
if not defined PHONEZONE_DATA_DIR (
  if exist "%ROOT%data\database\phonezone.db" (
    set "PHONEZONE_DATA_DIR=%ROOT%data"
  ) else if exist "%APPDATA%\PhoneZone\database\phonezone.db" (
    set "PHONEZONE_DATA_DIR=%APPDATA%\PhoneZone"
  ) else (
    set "PHONEZONE_DATA_DIR=%APPDATA%\PhoneZone"
  )
) else (
  if not exist "%PHONEZONE_DATA_DIR%\database\phonezone.db" (
    if exist "%APPDATA%\PhoneZone\database\phonezone.db" (
      set "PHONEZONE_DATA_DIR=%APPDATA%\PhoneZone"
    )
  )
)
set "PHONEZONE_PORT=%PORT%"
set "TOOLS=%ROOT%scripts\pz-tools.mjs"

call :check_node
if errorlevel 1 goto FATAL

:ROUTE
call :is_configured
if errorlevel 1 goto FIRST_RUN_MENU
goto MAIN_MENU

:FATAL
echo.
pause
exit /b 1

rem ------------------------------------------------------------
rem  FIRST RUN MENU  (no business data / setup not finished)
rem ------------------------------------------------------------
:FIRST_RUN_MENU
cls
echo =======================================================
echo           PHONEZONE - FIRST TIME SETUP
echo =======================================================
echo.
echo   No business data was found on this computer.
echo   How do you want to continue?
echo.
echo   [1] Set up a NEW business  - opens the setup wizard
echo   [2] RESTORE from a backup  - bring back old shop data
echo   [3] Exit
echo.
set "CHOICE="
set /p "CHOICE=  Enter your choice 1-3: "
if "%CHOICE%"=="1" goto FIRST_NEW
if "%CHOICE%"=="2" goto FIRST_RESTORE
if "%CHOICE%"=="3" exit /b 0
goto FIRST_RUN_MENU

:FIRST_NEW
cls
call :start_app open
echo.
echo   Finish the setup wizard in your browser.
echo   You can come back here any time to stop the server or make backups.
echo.
pause
goto MAIN_MENU

:FIRST_RESTORE
set "RETURN_TO=ROUTE"
goto RESTORE_FLOW

rem ------------------------------------------------------------
rem  MAIN MENU
rem ------------------------------------------------------------
:MAIN_MENU
cls
call :port_listening
if errorlevel 1 (set "SRV=STOPPED") else (set "SRV=RUNNING")
echo =======================================================
echo           PHONEZONE - MASTER CONTROL PANEL
echo =======================================================
echo   Server : %SRV%      %URL%
echo   Data   : %PHONEZONE_DATA_DIR%
echo.
echo   [1] Start / Restart application
echo   [2] Start with Ngrok - online access
echo   [3] Stop server
echo   [4] Open in browser
echo   [5] Backup now - database, images, settings
echo   [6] Restore from backup
echo   [7] Build frontend after code changes
echo   [8] Install / repair dependencies
echo   [9] Exit
echo =======================================================
set "CHOICE="
set /p "CHOICE=  Enter your choice 1-9: "
if "%CHOICE%"=="1" goto MENU_START
if "%CHOICE%"=="2" goto MENU_NGROK
if "%CHOICE%"=="3" goto MENU_STOP
if "%CHOICE%"=="4" goto MENU_OPEN
if "%CHOICE%"=="5" goto MENU_BACKUP
if "%CHOICE%"=="6" goto MENU_RESTORE
if "%CHOICE%"=="7" goto MENU_BUILD
if "%CHOICE%"=="8" goto MENU_INSTALL
if "%CHOICE%"=="9" goto MENU_EXIT
goto MAIN_MENU

:MENU_START
cls
call :start_app open
echo.
pause
goto MAIN_MENU

:MENU_STOP
cls
call :do_stop
taskkill /F /IM ngrok.exe >nul 2>&1 && echo   Ngrok tunnel closed.
echo.
pause
goto MAIN_MENU

:MENU_OPEN
call :port_listening
if errorlevel 1 (
  echo.
  echo   The server is not running. Use option 1 to start it.
  echo.
  pause
  goto MAIN_MENU
)
start "" "%URL%"
goto MAIN_MENU

:MENU_BACKUP
cls
echo.
echo   ---- BACKUP ----
call :ensure_backend
if errorlevel 1 (
  echo.
  pause
  goto MAIN_MENU
)
echo.
node "%TOOLS%" backup
echo.
pause
goto MAIN_MENU

:MENU_RESTORE
set "RETURN_TO=MAIN_MENU"
goto RESTORE_FLOW

rem  Shared by the first-run menu and the main menu.
:RESTORE_FLOW
cls
echo.
echo   ---- RESTORE FROM BACKUP ----
call :ensure_backend
call :do_stop quiet
node "%TOOLS%" restore
set "RC=%errorlevel%"
echo.
if not "%RC%"=="0" (
  pause
  goto %RETURN_TO%
)
choice /c YN /n /m "  Start the app now? [Y/N] "
if errorlevel 2 goto %RETURN_TO%
call :start_app open
echo.
pause
goto %RETURN_TO%

:MENU_BUILD
cls
echo.
echo   ---- BUILD FRONTEND ----
call :build_frontend
set "RC=%errorlevel%"
echo.
if "%RC%"=="0" echo   [OK] Build finished. If the app is open, refresh the browser page.
echo.
pause
goto MAIN_MENU

:MENU_INSTALL
cls
echo.
echo   ---- INSTALL / REPAIR DEPENDENCIES ----
echo.
choice /c YN /n /m "  Delete backend\node_modules first, clean reinstall? [Y/N] "
if errorlevel 2 goto INST_GO
call :do_stop quiet
if exist "%ROOT%backend\node_modules" rmdir /s /q "%ROOT%backend\node_modules"
:INST_GO
echo.
echo   Installing backend packages...
pushd "%ROOT%backend"
call npm install --no-audit --no-fund
set "RC=%errorlevel%"
popd
if not "%RC%"=="0" goto INST_FAIL
call :ensure_backend
if errorlevel 1 goto INST_FAIL
echo.
echo   Installing frontend packages...
pushd "%ROOT%"
call npm install --ignore-scripts --no-audit --no-fund
set "RC=%errorlevel%"
popd
if not "%RC%"=="0" goto INST_FAIL
echo.
echo   [OK] All dependencies are ready.
echo.
pause
goto MAIN_MENU
:INST_FAIL
echo.
echo   [ERROR] Installation failed. Read the message above.
echo   Tip: Node.js 22 LTS from https://nodejs.org is the most trouble-free version.
echo.
pause
goto MAIN_MENU

:MENU_NGROK
cls
echo.
echo   ---- START WITH NGROK ----
call :is_configured
if errorlevel 1 (
  echo.
  echo   [BLOCKED] Finish the first-time setup first.
  echo   The setup page must never be exposed to the internet.
  echo.
  pause
  goto MAIN_MENU
)
set "NGEXE="
where ngrok >nul 2>&1 && set "NGEXE=ngrok"
if not defined NGEXE if exist "%ROOT%ngrok.exe" set "NGEXE=%ROOT%ngrok.exe"
if not defined NGEXE (
  echo.
  echo   [ERROR] ngrok was not found.
  echo   Download it from https://ngrok.com/download and put ngrok.exe in this folder.
  echo.
  pause
  goto MAIN_MENU
)
set "NGDOMAIN="
if exist "%ROOT%ngrok-domain.txt" set /p NGDOMAIN=<"%ROOT%ngrok-domain.txt"
if not defined NGDOMAIN call :ask_domain
echo.
echo   WARNING: this makes your PhoneZone login page reachable from the internet.
echo   Use a strong password. Option 3 closes the tunnel again.
echo.
call :start_app noopen
if errorlevel 1 (
  echo.
  pause
  goto MAIN_MENU
)
if defined NGDOMAIN (
  start "PhoneZone Ngrok" "%NGEXE%" http --url=%NGDOMAIN% %PORT%
) else (
  start "PhoneZone Ngrok" "%NGEXE%" http %PORT%
)
echo.
echo   An ngrok window was opened. Your public address is shown inside it.
echo.
pause
goto MAIN_MENU

:MENU_EXIT
call :port_listening
if errorlevel 1 exit /b 0
echo.
echo   Note: the PhoneZone server is still running in the background.
echo   Open this panel again and use option 3 to stop it.
echo.
pause
exit /b 0

rem ============================================================
rem  SUBROUTINES
rem ============================================================

:check_node
where node >nul 2>&1
if errorlevel 1 goto cn_missing
set "NODEMAJOR="
for /f %%v in ('node -p "parseInt(process.versions.node)"') do set "NODEMAJOR=%%v"
if not defined NODEMAJOR goto cn_missing
if %NODEMAJOR% LSS 20 goto cn_old
exit /b 0
:cn_missing
echo.
echo   [ERROR] Node.js is not installed or not in PATH.
echo   Install Node.js 22 LTS from https://nodejs.org and run this file again.
exit /b 1
:cn_old
echo.
echo   [ERROR] Node.js %NODEMAJOR% is too old. PhoneZone needs Node 20 or newer.
echo   Install Node.js 22 LTS from https://nodejs.org and run this file again.
exit /b 1

rem  exit 0 = business setup finished, exit 1 = first-time setup needed
:is_configured
if not exist "%PHONEZONE_DATA_DIR%\database\phonezone.db" (
  if exist "%APPDATA%\PhoneZone\database\phonezone.db" (
    set "PHONEZONE_DATA_DIR=%APPDATA%\PhoneZone"
  ) else (
    exit /b 1
  )
)
node "%TOOLS%" status >nul 2>&1
if errorlevel 2 exit /b 0
exit /b %errorlevel%

rem  exit 0 = something is listening on the app port
:port_listening
netstat -ano | findstr /R /C:":%PORT% .*LISTENING" >nul
exit /b %errorlevel%

:ask_domain
echo.
echo   Enter your ngrok static domain, for example: my-shop.ngrok-free.app
echo   Press Enter to use a random temporary address instead.
set "NGDOMAIN="
set /p "NGDOMAIN=  Domain: "
if defined NGDOMAIN >"%ROOT%ngrok-domain.txt" echo %NGDOMAIN%
exit /b 0

rem  Stops whatever is listening on the app port. Argument "quiet" hides messages.
:do_stop
set "KILLED="
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /R /C:":%PORT% .*LISTENING"') do (
  taskkill /F /T /PID %%p >nul 2>&1
  set "KILLED=1"
)
if defined KILLED timeout /t 1 /nobreak >nul
if /i "%~1"=="quiet" exit /b 0
if defined KILLED (echo   Server stopped.) else (echo   Server was not running.)
exit /b 0

rem  Backend packages + a better-sqlite3 binary that matches this Node version.
:ensure_backend
if exist "%ROOT%backend\node_modules\better-sqlite3\package.json" goto eb_native
echo   Installing backend packages, first time only...
pushd "%ROOT%backend"
call npm install --no-audit --no-fund
set "RC=%errorlevel%"
popd
if not "%RC%"=="0" goto eb_fail
:eb_native
pushd "%ROOT%backend"
node ensure-native.cjs
set "RC=%errorlevel%"
popd
if not "%RC%"=="0" goto eb_fail
exit /b 0
:eb_fail
echo.
echo   [ERROR] The database module could not be prepared.
echo   Use menu option 8 and answer Y for a clean reinstall.
echo   If that fails too, install Node.js 22 LTS from https://nodejs.org
exit /b 1

rem  Builds dist\ only when it is missing or older than the source files.
:ensure_ready
call :ensure_backend
if errorlevel 1 exit /b 1
node "%TOOLS%" needsbuild
if not errorlevel 1 exit /b 0
echo   Frontend is missing or out of date - building it now, this can take a minute...
call :build_frontend
exit /b %errorlevel%

:build_frontend
if exist "%ROOT%node_modules\vite\package.json" goto bf_build
echo   Installing frontend packages, first time only...
pushd "%ROOT%"
call npm install --ignore-scripts --no-audit --no-fund
set "RC=%errorlevel%"
popd
if not "%RC%"=="0" goto bf_fail
:bf_build
pushd "%ROOT%"
call npm run build
set "RC=%errorlevel%"
popd
if not "%RC%"=="0" goto bf_fail
exit /b 0
:bf_fail
echo.
echo   [ERROR] Frontend build failed. Read the message above.
exit /b 1

rem  Starts (or restarts) the server. Argument "open" also opens the browser.
:start_app
call :do_stop quiet
call :ensure_ready
if errorlevel 1 exit /b 1
echo.
echo   Starting PhoneZone server...
if not exist "%PHONEZONE_DATA_DIR%\logs" mkdir "%PHONEZONE_DATA_DIR%\logs"
start "PhoneZone Server" /min "%ROOT%scripts\run-server.bat"
call :wait_ready
if errorlevel 1 goto sa_fail
echo   [OK] PhoneZone is running at %URL%
if /i "%~1"=="open" start "" "%URL%"
exit /b 0
:sa_fail
echo.
echo   [ERROR] The server did not start. Last lines of the log:
echo   -------------------------------------------------------
powershell -NoProfile -Command "Get-Content -Tail 25 -LiteralPath '%PHONEZONE_DATA_DIR%\logs\server-console.log'"
echo   -------------------------------------------------------
exit /b 1

rem  Waits up to 40 seconds for the server to start listening.
:wait_ready
set /a TRIES=0
:wr_loop
call :port_listening
if not errorlevel 1 exit /b 0
set /a TRIES+=1
if %TRIES% GEQ 40 exit /b 1
timeout /t 1 /nobreak >nul
goto wr_loop
