<#
.SYNOPSIS
Removes Orbit's per-user Remote Desktop URL handler.

.DESCRIPTION
Deletes the orbit-rdp:// registration from HKCU and the copied launcher script
from %LOCALAPPDATA%\Orbit. Previously generated .rdp files remain available.
No MSRDC or Windows Remote Desktop Connection components are changed.
#>

$ErrorActionPreference = 'Stop'

# Only Orbit's own protocol registration is removed.
[Microsoft.Win32.Registry]::CurrentUser.DeleteSubKeyTree('Software\Classes\orbit-rdp', $false)
$launcher = Join-Path $env:LOCALAPPDATA 'Orbit\OrbitRdpLauncher.ps1'
if (Test-Path -LiteralPath $launcher) {
    Remove-Item -LiteralPath $launcher
}

Write-Host 'Orbit Remote Desktop launcher removed for this Windows user.'
Write-Host 'Previously generated connection files remain in LocalAppData\Orbit\Connections.'
