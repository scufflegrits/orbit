// Remote Desktop helpers: host validation, .rdp profile parsing, file download,
// and protocol URLs. Loaded as a classic script before app.js (no modules, so
// Orbit keeps working from file://).

// Host and profile rules moved to src/core/rdp.js in rewrite phase 2.
function validRdpHost(host, label) { return window.OrbitNext.core.validRdpHost(host, label); }
function parseRdpProfile(text, targetHost = null) { return window.OrbitNext.core.parseRdpProfile(text, targetHost); }

// Reading and downloading moved to src/services/ in rewrite phase 4.
function readRdpText(file) { return window.OrbitNext.services.fileIo.readRdpText(file); }

// The settings a Remote Desktop link opens with: its preset (with its own
// computer), else its imported profile, else none.
function effectiveRdpProfile(destination) {
  return window.OrbitNext.core.effectiveRdpProfile(destination, typeof rdpPresets !== 'undefined' ? rdpPresets : []);
}

function downloadRdp(destination) {
  window.OrbitNext.services.rdpLaunch.downloadRdp(destination, typeof rdpPresets !== 'undefined' ? rdpPresets : []);
}

function rdpLaunchUrl(destination) {
  return window.OrbitNext.core.rdpLaunchUrl(destination, typeof rdpPresets !== 'undefined' ? rdpPresets : []);
}
