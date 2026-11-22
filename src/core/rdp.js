// Remote Desktop rules: computer names, .rdp profiles, preset settings, and
// what a link launches with. Pure: reading a file and starting a download are
// in services/ (phase 4). Moved from rdp.js and storage.js (2.2.1).

/** @typedef {import('./types.js').RdpDestination} RdpDestination */
/** @typedef {import('./types.js').RdpPreset} RdpPreset */

/** Largest .rdp file Orbit reads, in bytes. */
export const RDP_FILE_LIMIT = 64000;
/** Largest cleaned profile Orbit keeps, in bytes (it travels in a URL). */
export const RDP_PROFILE_LIMIT = 12000;

const SETTING = /^([^:]+):([sib]):(.*)$/i;
const SETTING_NAME = /^[a-z0-9 _.-]+$/i;
const SECRET = /(?:password|passwd|token|secret|signature|signscope)/i;

/**
 * A computer name or IP address with an optional port, which is normalized (`:03389` → `:3389`).
 * @param {string} host
 * @param {string} label How the error names the item, such as "Planet 2 in Work".
 * @returns {string}
 */
export function validRdpHost(host, label) {
  const match = /^([^:]+)(?::([0-9]{1,5}))?$/.exec(host);
  const computer = match?.[1];
  if (!match || !computer || computer.length > 253 || computer.split('.').some(part =>
    part.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(part)) ||
    (match[2] && (Number(match[2]) < 1 || Number(match[2]) > 65535))) {
    throw new Error(`${label} needs a computer name or IP address, with an optional port.`);
  }
  return match[2] ? `${computer}:${Number(match[2])}` : computer;
}

/**
 * Clean an .rdp file's text: secrets are dropped silently, and the computer
 * address is replaced with `targetHost` when given.
 * @param {unknown} text
 * @param {string|null} [targetHost]
 * @returns {{host: string, content: string, removed: number, settings: number}}
 */
export function parseRdpProfile(text, targetHost = null) {
  if (typeof text !== 'string' || text.includes('\0')) throw new Error('The .rdp file is not valid text.');
  const rows = [];
  let sourceHost = null;
  let removed = 0;
  for (const line of text.replace(/^﻿/, '').split(/\r\n|\n|\r/)) {
    if (!line) continue;
    const match = SETTING.exec(line);
    if (!match || !SETTING_NAME.test(match[1])) throw new Error('The .rdp file has an invalid setting line.');
    const key = match[1].toLowerCase();
    if (SECRET.test(key)) {
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
  if (new TextEncoder().encode(content).length > RDP_PROFILE_LIMIT) {
    throw new Error('The .rdp file is too large to launch through Orbit.');
  }
  return { host: sourceHost, content, removed, settings: rows.length };
}

/**
 * A preset's settings: trimmed lines without the computer address. Unlike a
 * profile, a secret is refused, not dropped.
 * @param {unknown} text
 * @param {string} name The preset's name, for errors.
 * @returns {string}
 */
export function presetSettings(text, name) {
  const rows = [];
  for (const line of String(text || '').replace(/^﻿/, '').split(/\r\n|\n|\r/)) {
    if (!line.trim()) continue;
    const match = SETTING.exec(line.trim());
    if (!match || !SETTING_NAME.test(match[1])) throw new Error(`${name} has an invalid setting line: ${line.trim()}`);
    const key = match[1].toLowerCase();
    if (SECRET.test(key)) throw new Error(`${name} cannot keep ${match[1]}; Orbit never stores credentials.`);
    if (key === 'full address') continue;
    rows.push(line.trim());
  }
  if (rows.length > 100) throw new Error(`${name} has too many settings.`);
  return rows.join('\r\n');
}

/**
 * Decode an .rdp file's bytes: UTF-16 by byte-order mark, or little-endian
 * UTF-16 when the first odd bytes are zero; otherwise UTF-8. Invalid text
 * throws a TypeError. The size limit is checked by the caller.
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function decodeRdpBytes(bytes) {
  const utf16Le = bytes[0] === 0xff && bytes[1] === 0xfe;
  const utf16Be = bytes[0] === 0xfe && bytes[1] === 0xff;
  const likelyUtf16Le = !utf16Le && !utf16Be && bytes.length > 8 && bytes[1] === 0 && bytes[3] === 0 && bytes[5] === 0;
  const encoding = utf16Le || likelyUtf16Le ? 'utf-16le' : utf16Be ? 'utf-16be' : 'utf-8';
  return new TextDecoder(encoding, { fatal: true }).decode(bytes);
}

/**
 * The settings a link opens with: its preset (with the link's own computer),
 * else its imported profile, else null.
 * @param {RdpDestination} destination
 * @param {RdpPreset[]} [presets]
 * @returns {string|null}
 */
export function effectiveRdpProfile(destination, presets = []) {
  const preset = destination.rdpPreset ? presets.find(item => item.id === destination.rdpPreset) : null;
  if (preset) return `full address:s:${destination.host}\r\n${preset.settings ? `${preset.settings}\r\n` : ''}`;
  return destination.rdpProfile || null;
}

/**
 * The text of the .rdp file Orbit downloads for a link.
 * @param {RdpDestination} destination
 * @param {RdpPreset[]} [presets]
 */
export function rdpFileContent(destination, presets = []) {
  return effectiveRdpProfile(destination, presets) || `full address:s:${destination.host}\r\nprompt for credentials:i:1\r\n`;
}

/** @param {{name: string}} destination */
export function rdpFileName(destination) {
  return `${destination.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'remote-desktop'}.rdp`;
}

/**
 * The orbit-rdp:// URL the Windows helper opens, with the profile as unpadded base64url.
 * @param {RdpDestination} destination
 * @param {RdpPreset[]} [presets]
 */
export function rdpLaunchUrl(destination, presets = []) {
  const profileText = effectiveRdpProfile(destination, presets);
  if (!profileText) return `orbit-rdp://${destination.host}/`;
  let binary = '';
  for (const byte of new TextEncoder().encode(profileText)) binary += String.fromCharCode(byte);
  const profile = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `orbit-rdp://${destination.host}/?profile=${profile}`;
}
