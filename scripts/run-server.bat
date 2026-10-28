@echo off
rem PhoneZone server launcher. Started minimized by PHONEZONE-CONTROL.bat.
rem All output goes to data\logs\server-console.log. This window closes by itself when the server stops.
title PhoneZone Server
cd /d "%~dp0..\backend"
if not defined PHONEZONE_DATA_DIR (
  if exist "%~dp0..\data\database\phonezone.db" (
    set "PHONEZONE_DATA_DIR=%~dp0..\data"
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
if not exist "%PHONEZONE_DATA_DIR%\logs" mkdir "%PHONEZONE_DATA_DIR%\logs"
set "LOG=%PHONEZONE_DATA_DIR%\logs\server-console.log"
echo ---- start %date% %time% ---->> "%LOG%"
node src\server.js >> "%LOG%" 2>&1
echo ---- stopped, exit code %errorlevel% ---->> "%LOG%"
