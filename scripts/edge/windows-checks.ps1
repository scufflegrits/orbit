# Windows Remote Desktop helper checks B01, B02, B07 (docs/TEST_MATRIX.md), run on the test VM by
# scripts/edge/windows-checks.sh against C:\orbit-test\windows. Prints PASS or FAIL per check, then 'end:'.
$ErrorActionPreference = 'Stop'
$root = 'C:\orbit-test'
$orbit = Join-Path $env:LOCALAPPDATA 'Orbit'
$key = 'Registry::HKEY_CURRENT_USER\Software\Classes\orbit-rdp'
$commandKey = "$key\shell\open\command"
function Backups { @(Get-ChildItem $orbit -Filter 'orbit-rdp-*.reg' -ErrorAction SilentlyContinue | Sort-Object Name) }
function Result($id, $ok, $detail) { Write-Output ("{0} {1} {2}" -f ($(if ($ok) { 'PASS' } else { 'FAIL' })), $id, $detail) }
function Install { (& powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$root\windows\Install-OrbitRdp.ps1" 2>&1) -join ' | ' }
function Uninstall { (& powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$root\windows\Uninstall-OrbitRdp.ps1" 2>&1) -join ' | ' }
function Mstsc { @(Get-CimInstance Win32_Process -Filter "Name='mstsc.exe'") }

$hadOrbit = Test-Path $orbit
if ((Test-Path $key) -or $hadOrbit) { throw 'The guest already has an Orbit registration or folder; stopping without changes.' }
Write-Output ("start: key={0} orbitDir={1} mstsc={2}" -f (Test-Path $key), $hadOrbit, (Mstsc).Count)

# B01: a fresh install writes no backup; a re-install over an existing key backs it up first.
$first = Install
$afterFirst = (Backups).Count
$installed = (Get-ItemProperty $commandKey).'(default)'
Set-ItemProperty $commandKey -Name '(default)' -Value 'B01-PREVIOUS-COMMAND'
$second = Install
$backups = Backups
$backup = $backups | Select-Object -Last 1
$backupText = if ($backup) { Get-Content -LiteralPath $backup.FullName -Raw } else { '' }
$updated = (Get-ItemProperty $commandKey).'(default)'
Result 'B01-fresh' ($afterFirst -eq 0 -and $installed -like '*OrbitRdpLauncher.ps1*') "backups=$afterFirst command=$installed"
Result 'B01-backup' ($backups.Count -eq 1 -and $backupText.Contains('B01-PREVIOUS-COMMAND')) "file=$($backup.Name)"
Result 'B01-reported' ($backup -and $second.Contains($backup.FullName)) $second
Result 'B01-updated' ($updated -eq $installed) "command=$updated"

# B07: Windows opens orbit-rdp links through the registered command, as it does for the browser.
$connections = Join-Path $orbit 'Connections'
$hostOnly = 'orbit-rdp://b07-host.lab:3390/'
Start-Process $hostOnly
$proc = $null
for ($i = 0; $i -lt 40 -and -not $proc; $i++) { Start-Sleep -Milliseconds 250; $proc = Mstsc | Select-Object -First 1 }
$line = if ($proc) { $proc.CommandLine } else { '<no mstsc>' }
Result 'B07-host-only' ($line -match '/v:b07-host\.lab:3390' -and $line -match '/prompt' -and -not (Test-Path $connections)) "cmd=$line connectionsDir=$(Test-Path $connections)"
Mstsc | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Start-Sleep 1

$profileUrl = 'orbit-rdp://b07-profile.lab:3390/?profile=ZnVsbCBhZGRyZXNzOnM6YjA3LXByb2ZpbGUubGFiOjMzOTANCnNjcmVlbiBtb2RlIGlkOmk6MQ0KZGVza3RvcHdpZHRoOmk6MTI4MA0K'
Start-Process $profileUrl
$proc = $null
for ($i = 0; $i -lt 40 -and -not $proc; $i++) { Start-Sleep -Milliseconds 250; $proc = Mstsc | Select-Object -First 1 }
$line = if ($proc) { $proc.CommandLine } else { '<no mstsc>' }
$file = Join-Path $connections 'b07-profile.lab_3390.rdp'
$fileText = if (Test-Path $file) { Get-Content -LiteralPath $file -Raw } else { '' }
Result 'B07-profile' ($line -match '/edit' -and $line.Contains($file) -and $fileText.Contains('screen mode id:i:1') -and $fileText.Contains('desktopwidth:i:1280') -and $fileText.Contains('full address:s:b07-profile.lab:3390')) "cmd=$line"
Mstsc | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }

# A 12,000-byte payload reaches the helper through the registered protocol.
$boundaryHost = 'b07-boundary.lab'
$prefix = "full address:s:$boundaryHost`r`nusername:s:"
$boundaryText = $prefix + ('x' * (12000 - $prefix.Length - 2)) + "`r`n"
$boundaryBytes = [System.Text.Encoding]::UTF8.GetBytes($boundaryText)
$boundaryProfile = [Convert]::ToBase64String($boundaryBytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
$boundaryFile = Join-Path $connections "$boundaryHost.rdp"
$launchError = $null
try { Start-Process "orbit-rdp://$boundaryHost/?profile=$boundaryProfile" } catch { $launchError = $_.Exception.Message }
if (-not $launchError) {
    for ($i = 0; $i -lt 40 -and -not (Test-Path $boundaryFile); $i++) { Start-Sleep -Milliseconds 250 }
}
$boundarySize = if (Test-Path $boundaryFile) { (Get-Item -LiteralPath $boundaryFile).Length } else { 0 }
Result 'B07-profile-boundary' ($boundarySize -eq 12000) "bytes=$boundarySize launchError=$launchError"
Mstsc | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }

# B02: uninstall backs up the current key before removing it and the launcher.
$before = (Backups).Count
$out = Uninstall
$after = Backups
$newest = $after | Select-Object -Last 1
$newText = Get-Content -LiteralPath $newest.FullName -Raw
Result 'B02-backup' ($after.Count -eq $before + 1 -and $newText.Contains('OrbitRdpLauncher.ps1')) "file=$($newest.Name)"
Result 'B02-reported' ($out.Contains($newest.FullName)) $out
Result 'B02-removed' (-not (Test-Path $key) -and -not (Test-Path (Join-Path $orbit 'OrbitRdpLauncher.ps1'))) "key=$(Test-Path $key)"

# Leave the guest as it was found: no key, no Orbit folder.
Remove-Item -Recurse -Force $orbit
Write-Output ("end: key={0} orbitDir={1} mstsc={2}" -f (Test-Path $key), (Test-Path $orbit), (Mstsc).Count)
