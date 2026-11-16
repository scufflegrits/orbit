$ErrorActionPreference = 'Stop'

$source = Join-Path $PSScriptRoot 'OrbitRdpLauncher.ps1'
if (-not (Test-Path -LiteralPath $source)) {
    throw 'OrbitRdpLauncher.ps1 must be beside this installer.'
}

$installDir = Join-Path $env:LOCALAPPDATA 'Orbit'
[System.IO.Directory]::CreateDirectory($installDir) | Out-Null
$launcher = Join-Path $installDir 'OrbitRdpLauncher.ps1'
Copy-Item -LiteralPath $source -Destination $launcher -Force

$powerShell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$command = '"' + $powerShell + '" -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "' +
    $launcher + '" "%1"'
$root = [Microsoft.Win32.Registry]::CurrentUser
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
Write-Host 'In Orbit Settings, choose Remote Desktop > Open Windows client.'
