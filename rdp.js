// Remote Desktop helpers: host validation, .rdp profile parsing, file download,
// and protocol URLs. Loaded as a classic script before app.js (no modules, so
// Orbit keeps working from file://).

// Host and profile rules moved to src/core/rdp.js in rewrite phase 2.
function validRdpHost(host, label) { return window.OrbitNext.core.validRdpHost(host, label); }
function parseRdpProfile(text, targetHost = null) { return window.OrbitNext.core.parseRdpProfile(text, targetHost); }

async function readRdpText(file) {
  if (file.size > window.OrbitNext.core.RDP_FILE_LIMIT) throw new Error('The .rdp file is too large to import.');
  return window.OrbitNext.core.decodeRdpBytes(new Uint8Array(await file.arrayBuffer()));
}

// The settings a Remote Desktop link opens with: its preset (with its own
// computer), else its imported profile, else none.
function effectiveRdpProfile(destination) {
  return window.OrbitNext.core.effectiveRdpProfile(destination, typeof rdpPresets !== 'undefined' ? rdpPresets : []);
}

function downloadRdp(destination) {
  const content = window.OrbitNext.core.rdpFileContent(destination, typeof rdpPresets !== 'undefined' ? rdpPresets : []);
  const blob = new Blob([content], { type: 'application/x-rdp' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = window.OrbitNext.core.rdpFileName(destination);
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function rdpLaunchUrl(destination) {
  return window.OrbitNext.core.rdpLaunchUrl(destination, typeof rdpPresets !== 'undefined' ? rdpPresets : []);
}
