// Orbit. Built by build.mjs from src/; edit src/, not this file.

"use strict";
(() => {
  // src/app/version.js
  var APP_VERSION = "2.2.1";

  // src/app/legacy-bridge.js
  function publishBridge(api) {
    window.OrbitNext = Object.freeze({ ...api });
  }

  // src/app/main.js
  publishBridge({ version: APP_VERSION });
})();
