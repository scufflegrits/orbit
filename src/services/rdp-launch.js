// Starting a Remote Desktop connection (2.2.1 rdp.js, favorites.js): a .rdp
// download, or an orbit-rdp:// URL for the Windows helper. The file content
// and URL come from core/rdp.js.
import { rdpFileContent, rdpFileName, rdpLaunchUrl } from '../core/rdp.js';
import { downloadText } from './file-io.js';

/**
 * @param {import('../core/types.js').RdpDestination} destination
 * @param {import('../core/types.js').RdpPreset[]} presets
 */
export function downloadRdp(destination, presets) {
  downloadText(rdpFileContent(destination, presets), rdpFileName(destination), 'application/x-rdp');
}

/**
 * Launch as the user chose in Settings: 'download' saves a .rdp file;
 * otherwise the orbit-rdp:// helper is asked to connect.
 * @param {import('../core/types.js').RdpDestination} destination
 * @param {import('../core/types.js').RdpPreset[]} presets
 * @param {'download'|'client'} mode
 */
export function launchRdp(destination, presets, mode) {
  if (mode === 'download') downloadRdp(destination, presets);
  else /** @type {any} */ (globalThis).location.href = rdpLaunchUrl(destination, presets);
}
