// FROZEN ORACLE: Orbit 2.2.1 rdp.js, copied unchanged from tag v2.2.1 (REWRITE_PLAN.md, "Differential test").
// Never edit. Loaded in Node vm by tests/oracle/oracle.mjs.
// Remote Desktop helpers: host validation, .rdp profile parsing, file download,
// and protocol URLs. Loaded as a classic script before app.js (no modules, so
// Orbit keeps working from file://).

function validRdpHost(host, label) {
  const match = /^([^:]+)(?::([0-9]{1,5}))?$/.exec(host);
  const computer = match?.[1];
  if (!computer || computer.length > 253 || computer.split('.').some(part =>
    part.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(part)) ||
    (match[2] && (Number(match[2]) < 1 || Number(match[2]) > 65535))) {
    throw new Error(`${label} needs a computer name or IP address, with an optional port.`);
  }
  return match[2] ? `${computer}:${Number(match[2])}` : computer;
}

function parseRdpProfile(text, targetHost = null) {
  if (typeof text !== 'string' || text.includes('\0')) throw new Error('The .rdp file is not valid text.');
  const rows = [];
  let sourceHost = null;
  let removed = 0;
  for (const line of text.replace(/^\uFEFF/, '').split(/\r\n|\n|\r/)) {
    if (!line) continue;
    const match = /^([^:]+):([sib]):(.*)$/i.exec(line);
    if (!match || !/^[a-z0-9 _.-]+$/i.test(match[1])) {
      throw new Error('The .rdp file has an invalid setting line.');
    }
    const key = match[1].toLowerCase();
    if (/(?:password|passwd|token|secret|signature|signscope)/i.test(key)) {
      removed++;
      continue;
    }
    if (key === 'full address') {
      if (sourceHost || match[2].toLowerCase() !== 's') throw new Error('The .rdp file has more than one computer address.');
      sourceHost = validRdpHost(match[3].trim(), 'The .rdp file');
      rows.push(`full address:s:${targetHost || sourceHost}`);
    } else {
      rows.push(line);
    }
  }
  if (!sourceHost) throw new Error('The .rdp file needs a full address setting.');
  const content = rows.join('\r\n') + '\r\n';
  if (new TextEncoder().encode(content).length > 12000) {
    throw new Error('The .rdp file is too large to launch through Orbit.');
  }
  return { host: sourceHost, content, removed, settings: rows.length };
}

async function readRdpText(file) {
  if (file.size > 64000) throw new Error('The .rdp file is too large to import.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const utf16Le = bytes[0] === 0xff && bytes[1] === 0xfe;
  const utf16Be = bytes[0] === 0xfe && bytes[1] === 0xff;
  const likelyUtf16Le = !utf16Le && !utf16Be && bytes.length > 8 &&
    bytes[1] === 0 && bytes[3] === 0 && bytes[5] === 0;
  const encoding = utf16Le || likelyUtf16Le ? 'utf-16le' : utf16Be ? 'utf-16be' : 'utf-8';
  return new TextDecoder(encoding, { fatal: true }).decode(bytes);
}

// The settings a Remote Desktop link opens with: its preset (with its own
// computer), else its imported profile, else none.
function effectiveRdpProfile(destination) {
  const preset = destination.rdpPreset && typeof rdpPresets !== 'undefined'
    ? rdpPresets.find(item => item.id === destination.rdpPreset) : null;
  if (preset) return `full address:s:${destination.host}\r\n${preset.settings ? `${preset.settings}\r\n` : ''}`;
  return destination.rdpProfile || null;
}

function downloadRdp(destination) {
  const content = effectiveRdpProfile(destination) ||
    `full address:s:${destination.host}\r\nprompt for credentials:i:1\r\n`;
  const blob = new Blob([content], { type: 'application/x-rdp' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${destination.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'remote-desktop'}.rdp`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function rdpLaunchUrl(destination) {
  const profileText = effectiveRdpProfile(destination);
  if (!profileText) return `orbit-rdp://${destination.host}/`;
  const bytes = new TextEncoder().encode(profileText);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const profile = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `orbit-rdp://${destination.host}/?profile=${profile}`;
}
