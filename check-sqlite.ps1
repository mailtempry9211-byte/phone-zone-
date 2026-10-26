# Script to check and fix better-sqlite3 for Electron 28
Set-Location "C:\Users\ASUS INDIA\Desktop\phonezonestp-mainv2"

# Check better-sqlite3 version
$pkg = Get-Content "backend/node_modules/better-sqlite3/package.json" | ConvertFrom-Json
Write-Host "better-sqlite3 version: $($pkg.version)"

# Check node-abi for Electron 28
$nodeAbiPath = "node_modules/node-abi"
if (Test-Path $nodeAbiPath) {
    $nodeAbi = & node -e "const a = require('node-abi'); console.log(JSON.stringify(a.getSupportedTargets && a.getSupportedTargets().find(t => t.runtime === 'electron' && t.target === '28.3.3') || 'not found'))" 2>&1
    Write-Host "node-abi result: $nodeAbi"
}

# Check if there's a way to get Python
$pythonPaths = @(
    "C:\Python*",
    "C:\Program Files\Python*",
    "$env:LOCALAPPDATA\Programs\Python\Python*",
    "$env:APPDATA\Python\Python*"
)
foreach ($p in $pythonPaths) {
    $found = Get-ChildItem $p -ErrorAction SilentlyContinue
    if ($found) {
        Write-Host "Found Python at: $($found.FullName)"
    }
}

# Check for portable Python or other options
Write-Host "`nChecking for prebuilds directory..."
Get-ChildItem "backend/node_modules/better-sqlite3/prebuilds" -Recurse -ErrorAction SilentlyContinue | ForEach-Object { Write-Host $_.FullName }

# Check what the current better_sqlite3.node ABI is
Write-Host "`nCurrent better_sqlite3.node details:"
$nodeFile = "backend/node_modules/better-sqlite3/build/Release/better_sqlite3.node"
if (Test-Path $nodeFile) {
    $fi = Get-Item $nodeFile
    Write-Host "  Path: $($fi.FullName)"
    Write-Host "  Size: $($fi.Length) bytes"
    Write-Host "  Modified: $($fi.LastWriteTime)"
}

# Check the dist-electron version
$distNode = "dist-electron/win-unpacked/resources/backend/node_modules/better-sqlite3/build/Release/better_sqlite3.node"
if (Test-Path $distNode) {
    $fi = Get-Item $distNode
    Write-Host "`nDist-electron better_sqlite3.node:"
    Write-Host "  Path: $($fi.FullName)"
    Write-Host "  Size: $($fi.Length) bytes"
    Write-Host "  Modified: $($fi.LastWriteTime)"
}
