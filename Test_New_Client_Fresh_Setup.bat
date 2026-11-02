@echo off
title PhoneZone - Fresh New Client Simulation Mode
echo ======================================================================
echo    PhoneZone ERP - Brand New Customer / Fresh Machine Simulator
echo ======================================================================
echo.
echo [1/3] Creating a 100%% isolated temporary data sandbox in %%TEMP%%...
set PHONEZONE_DATA_DIR=%TEMP%\PhoneZone_Fresh_Client_Test
set PHONEZONE_FORCE_EMPTY_DIR=1

if exist "%PHONEZONE_DATA_DIR%" (
  echo [2/3] Clearing previous sandbox data...
  rmdir /s /q "%PHONEZONE_DATA_DIR%" >nul 2>&1
)

echo [3/3] Locating PhoneZone executable...
set EXE_PATH=""
if exist "%~dp0dist-electron\win-unpacked\PhoneZone.exe" set EXE_PATH="%~dp0dist-electron\win-unpacked\PhoneZone.exe"
if %EXE_PATH%=="" if exist "G:\PHONEZONE\PhoneZone.exe" set EXE_PATH="G:\PHONEZONE\PhoneZone.exe"
if %EXE_PATH%=="" if exist "%LOCALAPPDATA%\Programs\PhoneZone\PhoneZone.exe" set EXE_PATH="%LOCALAPPDATA%\Programs\PhoneZone\PhoneZone.exe"
if %EXE_PATH%=="" if exist "C:\Program Files\PhoneZone\PhoneZone.exe" set EXE_PATH="C:\Program Files\PhoneZone\PhoneZone.exe"

if %EXE_PATH%=="" (
  echo [ERROR] PhoneZone.exe not found! Please build the installer first.
  pause
  exit /b 1
)

echo Launching PhoneZone fresh client test via %EXE_PATH%...
echo Your real data in AppData is 100%% SAFE and untouched!
start "" %EXE_PATH% --fresh --new-client
exit
