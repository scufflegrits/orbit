# Silencing the "Unknown remote connection" warning on downloaded .rdp files

Reference notes only; nothing here is implemented in Orbit. Written 2026-11-15.

## What happens

When you double-click an `.rdp` file that Orbit downloaded (Settings → Remote Desktop → Download .rdp file), Windows shows a "Remote Desktop Connection security warning": *Caution: Unknown remote connection*, Publisher: *Unknown publisher*, with unchecked smart card and WebAuthn redirection boxes. Connect still works.

This is Windows' standard prompt for any `.rdp` file that is not signed by a trusted publisher. It is not an Orbit bug. A host-only download is a minimal file (`full address` and `prompt for credentials`), and it is unsigned like any other.

## Why Orbit can't fix it

Only a signed file avoids the prompt. Signing needs a certificate and `rdpsign.exe` on your machine, which a browser page can't run. Orbit also removes signature settings on import by design, so a signature would not carry through.

## Option A (simplest): use native mode

Settings → Remote Desktop → **Open mstsc.exe**. This goes through Orbit's Windows helper (`windows/OrbitRdpLauncher.ps1`) instead of opening a downloaded file. Imported profiles launched this way kept their username. Not yet confirmed: whether this path avoids the warning dialog. If it shows the dialog, that is worth investigating.

## Option B: sign downloaded files yourself

The steps and policy names below were written from memory and have not been tried here. Verify the exact policy wording and thumbprint type (SHA-256 versus SHA-1) on your Windows build, since Microsoft has changed how it treats `.rdp` files recently.

1. **Create a self-signed code-signing certificate** (PowerShell, once):
   ```powershell
   $cert = New-SelfSignedCertificate -Type CodeSigningCert -Subject "CN=Orbit RDP" -CertStoreLocation Cert:\CurrentUser\My
   $cert.Thumbprint
   ```
2. **Trust it.** Export the certificate and import it into both Trusted Root Certification Authorities and Trusted Publishers for your user (`certmgr.msc`). Without this, Windows still reports "Unknown publisher".
3. **List the thumbprint as a trusted `.rdp` publisher.** In `gpedit.msc` go to Computer Configuration → Administrative Templates → Windows Components → Remote Desktop Services → Remote Desktop Connection Client. Enable "Specify SHA1 thumbprints of certificates representing trusted .rdp publishers" and paste the thumbprint. This needs Windows Pro or Enterprise and an administrator.
4. **Sign each downloaded file:**
   ```
   rdpsign.exe /sha256 <THUMBPRINT> .\lab1-server1.rdp
   ```
   A signed file shows the publisher and offers "Don't ask me again for connections from this publisher".

The signing step has to be repeated for every file you download.

## Option C (optional future work): a signing helper

A small `windows/Sign-OrbitRdp.ps1` could sign the newest `.rdp` in Downloads with a thumbprint you give it. It would still depend on the certificate trust and policy setup in Option B. Not built; ask if you want it.

## Notes

- Signed files that carry saved settings must still contain no passwords or tokens. Orbit's importer drops password, token, secret and signature settings before a profile is stored.
- Treat imported profiles such as `tests/rdptest01.rdp` as private connection data. Do not commit them or share them without reviewing the contents.
