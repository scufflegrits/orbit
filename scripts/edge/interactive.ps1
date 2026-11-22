# Run a command in the signed-in desktop session through a one-off scheduled task.
# Usage: interactive.ps1 -Name <task> -Exe <path> -Arguments <string> [-Wait]
param([string]$Name, [string]$Exe, [string]$Arguments, [switch]$Wait)
$ErrorActionPreference = 'Stop'
$task = "Orbit-$Name"
Unregister-ScheduledTask -TaskName $task -Confirm:$false -ErrorAction SilentlyContinue
$action = New-ScheduledTaskAction -Execute $Exe -Argument $Arguments
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 2)
Register-ScheduledTask -TaskName $task -Action $action -Principal $principal -Settings $settings | Out-Null
Start-ScheduledTask -TaskName $task
if ($Wait) {
    for ($i = 0; $i -lt 60 -and (Get-ScheduledTask -TaskName $task).State -eq 'Running'; $i++) { Start-Sleep -Milliseconds 500 }
    Unregister-ScheduledTask -TaskName $task -Confirm:$false
}
Write-Output "started $task"
