<#
.SYNOPSIS
Removes Orbit's per-user Remote Desktop URL handler.

.DESCRIPTION
Deletes the orbit-rdp:// registration from HKCU and the copied launcher script
from %LOCALAPPDATA%\Orbit. Previously generated .rdp files remain available.
If a protocol registration exists, it is exported to a timestamped .reg file
in %LOCALAPPDATA%\Orbit before deletion. No MSRDC or Windows Remote Desktop
Connection components are changed.
#>

$ErrorActionPreference = 'Stop'

# Only Orbit's own protocol registration is removed.
$registryPath = 'HKCU\Software\Classes\orbit-rdp'
if (Test-Path -LiteralPath 'Registry::HKEY_CURRENT_USER\Software\Classes\orbit-rdp') {
    $installDir = Join-Path $env:LOCALAPPDATA 'Orbit'
    [System.IO.Directory]::CreateDirectory($installDir) | Out-Null
    $backupName = 'orbit-rdp-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' +
        [guid]::NewGuid().ToString('N').Substring(0, 8) + '.reg'
    $backupPath = Join-Path $installDir $backupName
    & reg.exe export $registryPath $backupPath
    if ($LASTEXITCODE -ne 0) {
        throw "Could not back up $registryPath. No registration was removed. Check $backupPath."
    }
    Write-Host "Existing protocol registration backed up to: $backupPath"
}
[Microsoft.Win32.Registry]::CurrentUser.DeleteSubKeyTree('Software\Classes\orbit-rdp', $false)
$launcher = Join-Path $env:LOCALAPPDATA 'Orbit\OrbitRdpLauncher.ps1'
if (Test-Path -LiteralPath $launcher) {
    Remove-Item -LiteralPath $launcher
}

Write-Host 'Orbit Remote Desktop launcher removed for this Windows user.'
Write-Host 'Previously generated connection files remain in LocalAppData\Orbit\Connections.'
