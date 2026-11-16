<#
.SYNOPSIS
Opens built-in mstsc.exe with an Orbit Remote Desktop target prefilled.

.DESCRIPTION
Receives orbit-rdp://computer[:port]/ from the browser, validates the host,
writes a minimal .rdp file under %LOCALAPPDATA%\Orbit\Connections, and opens
that file with mstsc.exe /edit. The user reviews the target and clicks Connect.
The helper does not store credentials or make the connection itself.
#>

param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$RequestUri
)

$ErrorActionPreference = 'Stop'

try {
    # Treat protocol URLs as untrusted input; any application can invoke them.
    $request = [System.Uri]::new($RequestUri, [System.UriKind]::Absolute)
    if ($request.Scheme -ne 'orbit-rdp' -or $request.AbsolutePath -ne '/' -or
        $request.UserInfo -or $request.Query -or $request.Fragment) {
        throw 'The Remote Desktop link is invalid.'
    }

    $computer = $request.Host
    if (-not $computer -or $computer.Length -gt 253) {
        throw 'The computer name or IP address is invalid.'
    }
    foreach ($label in $computer.Split('.')) {
        if ($label.Length -gt 63 -or
            $label -cnotmatch '^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$') {
            throw 'The computer name or IP address is invalid.'
        }
    }

    $address = $computer
    if ($request.Port -ne -1) {
        if ($request.Port -lt 1 -or $request.Port -gt 65535) {
            throw 'The Remote Desktop port is invalid.'
        }
        $address += ':' + $request.Port
    }

    $connectionDir = Join-Path $env:LOCALAPPDATA 'Orbit\Connections'
    [System.IO.Directory]::CreateDirectory($connectionDir) | Out-Null
    $fileName = ($address -replace '[^A-Za-z0-9.-]', '_') + '.rdp'
    $connectionFile = Join-Path $connectionDir $fileName
    # Keep the file limited to the address and a credential prompt.
    $content = "full address:s:$address`r`nprompt for credentials:i:1`r`n"
    $encoding = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($connectionFile, $content, $encoding)

    $mstsc = Join-Path $env:SystemRoot 'System32\mstsc.exe'
    $fileArgument = '"' + $connectionFile + '"'
    # /edit opens Remote Desktop Connection with the file loaded before Connect.
    Start-Process -FilePath $mstsc -ArgumentList @('/edit', $fileArgument)
} catch {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, 'Orbit Remote Desktop') | Out-Null
    exit 1
}
