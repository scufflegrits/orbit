# Leave the Windows test VM as it was found after any Orbit run: stop Edge and
# mstsc, remove the scheduled tasks, the orbit-rdp registration, and every test
# folder and profile, then report what is left. Remote Desktop stays enabled.
# Copied to the VM and run by scripts/edge/env.sh (cleanup_vm); deletes itself.
Get-Process msedge, mstsc -ErrorAction SilentlyContinue | Stop-Process -Force
Get-ScheduledTask -TaskName 'Orbit-*' -ErrorAction SilentlyContinue | Unregister-ScheduledTask -Confirm:$false
Remove-Item -Recurse -Force 'Registry::HKEY_CURRENT_USER\Software\Classes\orbit-rdp' -ErrorAction SilentlyContinue
# Edge holds its profile for a moment after it stops.
Start-Sleep 4
foreach ($p in @(Get-ChildItem C:\ -Filter 'orbit-*' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName) +
               @(Get-ChildItem $HOME -Filter 'orbit*' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName) +
               @((Join-Path $env:LOCALAPPDATA 'Orbit'))) {
    if ($p -and (Test-Path $p)) { Remove-Item -Recurse -Force $p }
}
Write-Output ('C:\ orbit items: ' + ((Get-ChildItem C:\ -Filter 'orbit*' | Select-Object -ExpandProperty Name) -join ', '))
Write-Output ('home orbit files: ' + ((Get-ChildItem $HOME -Filter 'orbit*' | Select-Object -ExpandProperty Name) -join ', '))
Write-Output ('orbit-rdp key: ' + (Test-Path 'Registry::HKEY_CURRENT_USER\Software\Classes\orbit-rdp'))
Write-Output ('LocalAppData\Orbit: ' + (Test-Path (Join-Path $env:LOCALAPPDATA 'Orbit')))
Write-Output ('Orbit tasks: ' + @(Get-ScheduledTask -TaskName 'Orbit-*' -ErrorAction SilentlyContinue).Count)
Write-Output ('edge/mstsc running: ' + @(Get-Process msedge, mstsc -ErrorAction SilentlyContinue).Count)
Write-Output ('RDP still enabled: ' + ((Get-ItemProperty 'HKLM:\System\CurrentControlSet\Control\Terminal Server').fDenyTSConnections -eq 0))
Remove-Item -Force $MyInvocation.MyCommand.Path -ErrorAction SilentlyContinue
