# Find Python 3.14 installation
Write-Host "=== Python Registry Search ==="

$keys = @(
    "HKCU:\Software\Python\PythonCore\3.14",
    "HKCU:\Software\Python\PythonCore\3.14\InstallPath",
    "HKCU:\Software\Python\PythonCore\3.14\InstalledFeatures",
    "HKLM:\Software\Python\PythonCore\3.14",
    "HKLM:\Software\Python\PythonCore\3.14\InstallPath"
)

foreach ($k in $keys) {
    if (Test-Path $k) {
        $val = Get-ItemProperty $k -ErrorAction SilentlyContinue
        Write-Host "$k : $($val.PSObject.Properties | Where-Object { $_.Name -ne 'PSPath' } | ForEach-Object { $_.Name + '=' + $_.Value })"
    }
}

# Check the InstallPath
try {
    $ip = Get-ItemProperty "HKCU:\Software\Python\PythonCore\3.14\InstallPath" -ErrorAction SilentlyContinue
    if ($ip) {
        Write-Host "`nInstallPath: $($ip.InstallPath)"
        $pyExe = Join-Path $ip.InstallPath "python.exe"
        Write-Host "Python exe: $pyExe"
        if (Test-Path $pyExe) {
            Write-Host "Found! Running version check..."
            & $pyExe --version
        }
    }
} catch {
    Write-Host "Error: $_"
}

# Also check for venv
try {
    $venv = Get-ItemProperty "HKCU:\Software\Python\PythonCore\3.14\InstallPath" -ErrorAction SilentlyContinue
    if ($venv) {
        $scripts = Join-Path $venv.InstallPath "Scripts"
        Write-Host "`nScripts dir: $scripts"
        Get-ChildItem $scripts -ErrorAction SilentlyContinue | Select-Object Name
    }
} catch {}
