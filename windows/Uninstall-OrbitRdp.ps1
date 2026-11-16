$ErrorActionPreference = 'Stop'

[Microsoft.Win32.Registry]::CurrentUser.DeleteSubKeyTree('Software\Classes\orbit-rdp', $false)
$launcher = Join-Path $env:LOCALAPPDATA 'Orbit\OrbitRdpLauncher.ps1'
if (Test-Path -LiteralPath $launcher) {
    Remove-Item -LiteralPath $launcher
}

Write-Host 'Orbit Remote Desktop launcher removed for this Windows user.'
Write-Host 'Previously generated connection files remain in LocalAppData\Orbit\Connections.'
