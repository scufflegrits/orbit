<#
.SYNOPSIS
Registers Orbit's per-user URL handler for built-in Windows Remote Desktop Connection.

.DESCRIPTION
Copies OrbitRdpLauncher.ps1 to %LOCALAPPDATA%\Orbit and registers orbit-rdp://
under HKCU\Software\Classes. No administrator rights or MSRDC installation are
needed. The registered command uses execution-policy bypass only for its own
PowerShell process; this script does not change Windows execution policy.
#>

$ErrorActionPreference = 'Stop'

$source = Join-Path $PSScriptRoot 'OrbitRdpLauncher.ps1'
if (-not (Test-Path -LiteralPath $source)) {
    throw 'OrbitRdpLauncher.ps1 must be beside this installer.'
}

$installDir = Join-Path $env:LOCALAPPDATA 'Orbit'
[System.IO.Directory]::CreateDirectory($installDir) | Out-Null
$launcher = Join-Path $installDir 'OrbitRdpLauncher.ps1'
Copy-Item -LiteralPath $source -Destination $launcher -Force

# Windows passes the clicked orbit-rdp:// URL as the quoted %1 argument.
$powerShell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$command = '"' + $powerShell + '" -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "' +
    $launcher + '" "%1"'
$root = [Microsoft.Win32.Registry]::CurrentUser
# HKCU keeps the protocol registration scoped to the current Windows account.
$protocol = $root.CreateSubKey('Software\Classes\orbit-rdp')
try {
    $protocol.SetValue('', 'URL:Orbit Remote Desktop', [Microsoft.Win32.RegistryValueKind]::String)
    $protocol.SetValue('URL Protocol', '', [Microsoft.Win32.RegistryValueKind]::String)
} finally {
    $protocol.Close()
}
$openCommand = $root.CreateSubKey('Software\Classes\orbit-rdp\shell\open\command')
try {
    $openCommand.SetValue('', $command, [Microsoft.Win32.RegistryValueKind]::String)
} finally {
    $openCommand.Close()
}

Write-Host 'Orbit Remote Desktop launcher installed for this Windows user.'
Write-Host 'In Orbit Settings, choose Remote Desktop > Open mstsc.exe.'
