<#
.SYNOPSIS
Registers Orbit's per-user URL handler for built-in Windows Remote Desktop Connection.

.DESCRIPTION
Copies OrbitRdpLauncher.ps1 to %LOCALAPPDATA%\Orbit and registers orbit-rdp://
under HKCU\Software\Classes. It uses the executable running this installer:
Windows PowerShell 5.1 or PowerShell 7. No administrator rights or MSRDC
installation are needed. The registered command uses execution-policy bypass
only for its own process; this script does not change Windows execution policy.
Running this installer again replaces the per-user protocol command and copied
helper, leaving Orbit browser settings and generated .rdp files in place.
#>

$ErrorActionPreference = 'Stop'

$source = Join-Path $PSScriptRoot 'OrbitRdpLauncher.ps1'
if (-not (Test-Path -LiteralPath $source)) {
    throw 'OrbitRdpLauncher.ps1 must be beside this installer.'
}

# Register the same supported PowerShell executable that is running this script.
# Windows passes the clicked orbit-rdp:// URL as the quoted %1 argument.
if ($PSVersionTable.PSVersion.Major -ge 7) {
    $engineName = 'pwsh.exe'
} elseif ($PSVersionTable.PSVersion.Major -eq 5 -and $PSVersionTable.PSVersion.Minor -ge 1) {
    $engineName = 'powershell.exe'
} else {
    throw 'Orbit requires Windows PowerShell 5.1 or PowerShell 7 or newer.'
}
$powerShell = Join-Path $PSHOME $engineName
if (-not (Test-Path -LiteralPath $powerShell)) {
    throw "PowerShell executable not found: $powerShell"
}

$installDir = Join-Path $env:LOCALAPPDATA 'Orbit'
[System.IO.Directory]::CreateDirectory($installDir) | Out-Null
$launcher = Join-Path $installDir 'OrbitRdpLauncher.ps1'
Copy-Item -LiteralPath $source -Destination $launcher -Force

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
Write-Host "Registered PowerShell: $powerShell"
Write-Host 'In Orbit Settings, choose Remote Desktop > Open mstsc.exe.'
