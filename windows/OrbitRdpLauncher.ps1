<#
.SYNOPSIS
Opens built-in mstsc.exe with an Orbit Remote Desktop target prefilled.

.DESCRIPTION
Receives orbit-rdp://computer[:port]/ from the browser, with an optional
profile containing connection settings imported from a local .rdp file.
Validates the host and opens host-only links with mstsc.exe /v and /prompt,
without creating a connection file. Imported profiles are validated, written
under %LOCALAPPDATA%\Orbit\Connections, and opened with mstsc.exe /edit so
their settings can be reviewed. Passwords, tokens, and signatures are not
accepted in imported profiles.
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
        $request.UserInfo -or $request.Fragment) {
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

    $mstsc = Join-Path $env:SystemRoot 'System32\mstsc.exe'
    if (-not $request.Query) {
        # /v opens a host-only target without leaving a temporary .rdp file.
        Start-Process -FilePath $mstsc -ArgumentList @("/v:$address", '/prompt')
        return
    }

    $connectionDir = Join-Path $env:LOCALAPPDATA 'Orbit\Connections'
    [System.IO.Directory]::CreateDirectory($connectionDir) | Out-Null
    $fileName = ($address -replace '[^A-Za-z0-9.-]', '_') + '.rdp'
    $connectionFile = Join-Path $connectionDir $fileName
    $content = "full address:s:$address`r`nprompt for credentials:i:1`r`n"
    if ($request.Query) {
        # Browser-imported settings travel as base64url UTF-8; never accept credential fields.
        if (-not ($request.Query -cmatch '^\?profile=([A-Za-z0-9_-]{1,16000})$')) {
            throw 'The Remote Desktop profile link is invalid.'
        }
        $encoded = $Matches[1].Replace('-', '+').Replace('_', '/')
        $encoded += '=' * ((4 - ($encoded.Length % 4)) % 4)
        $profileBytes = [System.Convert]::FromBase64String($encoded)
        if ($profileBytes.Length -gt 12000) {
            throw 'The Remote Desktop profile is too large.'
        }
        $strictUtf8 = [System.Text.UTF8Encoding]::new($false, $true)
        $profileText = $strictUtf8.GetString($profileBytes)
        if ($profileText.Contains([char]0)) {
            throw 'The Remote Desktop profile is invalid.'
        }
        $safeLines = New-Object 'System.Collections.Generic.List[string]'
        $addressFound = $false
        foreach ($line in ($profileText -split "`r`n|`n|`r")) {
            if (-not $line) { continue }
            if (-not ($line -match '^([^:]+):([sib]):(.*)$')) {
                throw 'The Remote Desktop profile has an invalid setting.'
            }
            $key = $Matches[1]
            $kind = $Matches[2]
            $value = $Matches[3]
            if ($key -cnotmatch '^[A-Za-z0-9 _.-]+$' -or
                $key -match 'password|passwd|token|secret|signature|signscope') {
                throw 'The Remote Desktop profile has an unsafe setting.'
            }
            if ($key -ieq 'full address') {
                if ($addressFound -or $kind -ine 's' -or $value -ine $address) {
                    throw 'The Remote Desktop profile computer does not match the link.'
                }
                $addressFound = $true
            }
            $safeLines.Add($line)
        }
        if (-not $addressFound) {
            throw 'The Remote Desktop profile needs a computer address.'
        }
        $content = ($safeLines -join "`r`n") + "`r`n"
    }
    $encoding = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($connectionFile, $content, $encoding)

    $fileArgument = '"' + $connectionFile + '"'
    # /edit opens Remote Desktop Connection with the file loaded before Connect.
    Start-Process -FilePath $mstsc -ArgumentList @('/edit', $fileArgument)
} catch {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, 'Orbit Remote Desktop') | Out-Null
    exit 1
}
