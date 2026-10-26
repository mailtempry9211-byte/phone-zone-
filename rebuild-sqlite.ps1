# Rebuild better-sqlite3 for Electron 28 using found Python
Set-Location "C:\Users\ASUS INDIA\Desktop\phonezonestp-mainv2"

$pythonExe = "C:\Users\ASUS INDIA\AppData\Local\Python\pythoncore-3.14-64\python.exe"
$electronPath = "node_modules\electron\dist\electron.exe"

Write-Host "Python found: $pythonExe"
if (Test-Path $pythonExe) {
    Write-Host "Python version:"
    & $pythonExe --version
} else {
    Write-Host "Python NOT found at expected path!"
    exit 1
}

Write-Host "`nElectron path:"
if (Test-Path $electronPath) {
    Write-Host "Found: $electronPath"
} else {
    Write-Host "Electron NOT found!"
    exit 1
}

Write-Host "`n=== Setting up npm config for Python ==="
npm config set python $pythonExe
Write-Host "npm config python set"

Write-Host "`n=== Running electron-rebuild ==="
Write-Host "This may take a few minutes..."

# Set PYTHON env var
$env:PYTHON = $pythonExe

# Run electron-rebuild
$rebuildCmd = ".\node_modules\.bin\electron-rebuild.cmd"
Write-Host "Running: $rebuildCmd"
Write-Host "  -w better-sqlite3"
Write-Host "  --version=28.3.3"
Write-Host "  --electron-prebuilt-dir=node_modules/electron"
Write-Host "  --force"
Write-Host "  --build-from-source"

& $rebuildCmd -w better-sqlite3 --version=28.3.3 --electron-prebuilt-dir=node_modules/electron --force --build-from-source 2>&1

Write-Host "`n=== Checking result ==="
$nodeFile = "backend/node_modules/better-sqlite3/build/Release/better_sqlite3.node"
if (Test-Path $nodeFile) {
    $fi = Get-Item $nodeFile
    Write-Host "SUCCESS! better_sqlite3.node rebuilt:"
    Write-Host "  Path: $($fi.FullName)"
    Write-Host "  Size: $($fi.Length) bytes"
    Write-Host "  Modified: $($fi.LastWriteTime)"
} else {
    Write-Host "FAILED! better_sqlite3.node NOT found at $nodeFile"
    Get-ChildItem "backend/node_modules/better-sqlite3/build" -Recurse -ErrorAction SilentlyContinue | Select-Object FullName
}
