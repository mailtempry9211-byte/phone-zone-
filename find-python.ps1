# Search for Python on this system
Write-Host "=== Searching for Python ==="

# Common locations
$locations = @(
    "C:\Python*",
    "C:\Program Files\Python*",
    "$env:LOCALAPPDATA\Programs\Python\Python*",
    "$env:APPDATA\Python\Python*",
    "C:\Users\ASUS INDIA\AppData\Local\Programs\Python"
)

foreach ($loc in $locations) {
    $found = Get-ChildItem $loc -ErrorAction SilentlyContinue
    if ($found) {
        Write-Host "FOUND at: $($found.FullName)"
    }
}

# Check registry for Python
try {
    $reg = Get-ItemProperty "HKCU:\Software\Python\PythonCore\*" -ErrorAction SilentlyContinue
    $reg | ForEach-Object { Write-Host "Registry: $($_.PSPath)" }
} catch {}

# Check all Python executables on PATH
Write-Host "`n=== PATH Search ==="
$paths = $env:PATH -split ';'
foreach ($p in $paths) {
    $py = Join-Path $p "python.exe"
    if (Test-Path $py) {
        Write-Host "Found python.exe at: $py"
        & $py --version
    }
    $py3 = Join-Path $p "python3.exe"
    if (Test-Path $py3) {
        Write-Host "Found python3.exe at: $py3"
        & $py3 --version
    }
}

# Check node_modules for any Python-related packages
Write-Host "`n=== node_modules Python search ==="
$npm = Get-ChildItem "node_modules" -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "*python*" -or $_.Name -like "*node-gyp*" }
$npm | ForEach-Object { Write-Host $_.FullName }

# Check node-gyp local python
Write-Host "`n=== node-gyp config ==="
npm config get python 2>&1
