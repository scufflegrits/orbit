// Orbit. Built by build.mjs from src/; edit src/, not this file.

"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: !0 });
  };

  // src/app/version.js
  var APP_VERSION = "2.2.1";

  // src/app/legacy-bridge.js
  function publishBridge(api) {
    window.OrbitNext = Object.freeze({ ...api });
  }
  function publishPageGlobals(names) {
    for (let [name, value] of Object.entries(names))
      Object.defineProperty(window, name, { value, writable: !0, configurable: !0, enumerable: !1 });
  }

  // src/core/destination.js
  var destination_exports = {};
  __export(destination_exports, {
    destinationKey: () => destinationKey,
    itemAt: () => itemAt,
    pathsForKey: () => pathsForKey
  });
  function destinationKey(item) {
    if (!item) return "";
    if (item.type === "rdp") return `rdp:${String(item.host || "").toLowerCase()}`;
    try {
      let url = new URL(item.url), path = url.pathname.replace(/\/+$/, "");
      return `${url.protocol}//${url.host.toLowerCase()}${path}${url.search}`;
    } catch {
      return `url:${item.url}`;
    }
  }
  function pathsForKey(groups2, key) {
    let paths = [];
    return groups2.forEach((sun, sunIndex) => sun.links.forEach((planet, planetIndex) => {
      destinationKey(planet) === key && paths.push([sunIndex, planetIndex]), planet.moons.forEach((moon, moonIndex) => {
        destinationKey(moon) === key && paths.push([sunIndex, planetIndex, moonIndex]);
      });
    })), paths;
  }
  function itemAt(groups2, path) {
    let planet = groups2[
      /** @type {number} */
      path[0]
    ]?.links[
      /** @type {number} */
      path[1]
    ];
    return path.length === 3 ? planet?.moons[
      /** @type {number} */
      path[2]
    ] : planet;
  }

  // src/core/map-ops.js
  var map_ops_exports = {};
  __export(map_ops_exports, {
    duplicateGroups: () => duplicateGroups,
    itemExport: () => itemExport,
    mapItemAt: () => mapItemAt,
    mergeMaps: () => mergeMaps,
    mergeRoutines: () => mergeRoutines,
    moveMapItem: () => moveMapItem,
    packLink: () => packLink,
    personalGroups: () => personalGroups,
    plainCopy: () => plainCopy,
    samePath: () => samePath,
    uniqueSunId: () => uniqueSunId
  });

  // src/core/schema.js
  var schema_exports = {};
  __export(schema_exports, {
    DEFAULT_SUN_COLOR: () => DEFAULT_SUN_COLOR,
    uniqueSunId: () => uniqueSunId,
    validDestination: () => validDestination,
    validItemExport: () => validItemExport,
    validPack: () => validPack,
    validRdpPresets: () => validRdpPresets,
    validRoutines: () => validRoutines,
    validTags: () => validTags,
    validateMap: () => validateMap
  });

  // src/core/templates.js
  var templates_exports = {};
  __export(templates_exports, {
    PLACEHOLDER: () => PLACEHOLDER,
    fillTemplate: () => fillTemplate,
    templateNames: () => templateNames
  });
  var PLACEHOLDER = /\{([A-Za-z0-9_-]{1,30})\}/g;
  function templateNames(url) {
    return [...new Set([...String(url || "").matchAll(PLACEHOLDER)].map((match) => String(match[1])))];
  }
  function fillTemplate(url, values) {
    return url.replace(PLACEHOLDER, (_, name) => encodeURIComponent(values[name] ?? ""));
  }

  // src/core/rdp.js
  var rdp_exports = {};
  __export(rdp_exports, {
    RDP_FILE_LIMIT: () => RDP_FILE_LIMIT,
    RDP_PROFILE_LIMIT: () => RDP_PROFILE_LIMIT,
    decodeRdpBytes: () => decodeRdpBytes,
    effectiveRdpProfile: () => effectiveRdpProfile2,
    parseRdpProfile: () => parseRdpProfile,
    presetSettings: () => presetSettings,
    rdpFileContent: () => rdpFileContent,
    rdpFileName: () => rdpFileName,
    rdpLaunchUrl: () => rdpLaunchUrl2,
    validRdpHost: () => validRdpHost
  });
  var RDP_FILE_LIMIT = 64e3, RDP_PROFILE_LIMIT = 12e3, SETTING = /^([^:]+):([sib]):(.*)$/i, SETTING_NAME = /^[a-z0-9 _.-]+$/i, SECRET = /(?:password|passwd|token|secret|signature|signscope)/i;
  function validRdpHost(host, label) {
    let match = /^([^:]+)(?::([0-9]{1,5}))?$/.exec(host), computer = match?.[1];
    if (!match || !computer || computer.length > 253 || computer.split(".").some((part) => part.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(part)) || match[2] && (Number(match[2]) < 1 || Number(match[2]) > 65535))
      throw new Error(`${label} needs a computer name or IP address, with an optional port.`);
    return match[2] ? `${computer}:${Number(match[2])}` : computer;
  }
  function parseRdpProfile(text, targetHost = null) {
    if (typeof text != "string" || text.includes("\0")) throw new Error("The .rdp file is not valid text.");
    let rows = [], sourceHost = null, removed = 0;
    for (let line of text.replace(/^﻿/, "").split(/\r\n|\n|\r/)) {
      if (!line) continue;
      let match = SETTING.exec(line);
      if (!match || !SETTING_NAME.test(match[1])) throw new Error("The .rdp file has an invalid setting line.");
      let key = match[1].toLowerCase();
      if (SECRET.test(key)) {
        removed++;
        continue;
      }
      if (key === "full address") {
        if (sourceHost || match[2].toLowerCase() !== "s") throw new Error("The .rdp file has more than one computer address.");
        sourceHost = validRdpHost(match[3].trim(), "The .rdp file"), rows.push(`full address:s:${targetHost || sourceHost}`);
      } else
        rows.push(line);
    }
    if (!sourceHost) throw new Error("The .rdp file needs a full address setting.");
    let content = rows.join(`\r
`) + `\r
`;
    if (new TextEncoder().encode(content).length > 12e3)
      throw new Error("The .rdp file is too large to launch through Orbit.");
    return { host: sourceHost, content, removed, settings: rows.length };
  }
  function presetSettings(text, name) {
    let rows = [];
    for (let line of String(text || "").replace(/^﻿/, "").split(/\r\n|\n|\r/)) {
      if (!line.trim()) continue;
      let match = SETTING.exec(line.trim());
      if (!match || !SETTING_NAME.test(match[1])) throw new Error(`${name} has an invalid setting line: ${line.trim()}`);
      let key = match[1].toLowerCase();
      if (SECRET.test(key)) throw new Error(`${name} cannot keep ${match[1]}; Orbit never stores credentials.`);
      key !== "full address" && rows.push(line.trim());
    }
    if (rows.length > 100) throw new Error(`${name} has too many settings.`);
    return rows.join(`\r
`);
  }
  function decodeRdpBytes(bytes) {
    let utf16Le = bytes[0] === 255 && bytes[1] === 254, utf16Be = bytes[0] === 254 && bytes[1] === 255, likelyUtf16Le = !utf16Le && !utf16Be && bytes.length > 8 && bytes[1] === 0 && bytes[3] === 0 && bytes[5] === 0, encoding = utf16Le || likelyUtf16Le ? "utf-16le" : utf16Be ? "utf-16be" : "utf-8";
    return new TextDecoder(encoding, { fatal: !0 }).decode(bytes);
  }
  function effectiveRdpProfile2(destination, presets = []) {
    let preset = destination.rdpPreset ? presets.find((item) => item.id === destination.rdpPreset) : null;
    return preset ? `full address:s:${destination.host}\r
${preset.settings ? `${preset.settings}\r
` : ""}` : destination.rdpProfile || null;
  }
  function rdpFileContent(destination, presets = []) {
    return effectiveRdpProfile2(destination, presets) || `full address:s:${destination.host}\r
prompt for credentials:i:1\r
`;
  }
  function rdpFileName(destination) {
    return `${destination.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "remote-desktop"}.rdp`;
  }
  function rdpLaunchUrl2(destination, presets = []) {
    let profileText = effectiveRdpProfile2(destination, presets);
    if (!profileText) return `orbit-rdp://${destination.host}/`;
    let binary = "";
    for (let byte of new TextEncoder().encode(profileText)) binary += String.fromCharCode(byte);
    let profile = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    return `orbit-rdp://${destination.host}/?profile=${profile}`;
  }

  // src/core/schema.js
  var DEFAULT_SUN_COLOR = "#79d9f8";
  function validTags(value, label) {
    if (value == null || value === "") return [];
    let list = Array.isArray(value) ? value : String(value).split(","), tags = [];
    for (let raw of list) {
      let tag = String(raw).trim().toLowerCase().replace(/\s+/g, " ");
      if (tag) {
        if (!/^[a-z0-9][a-z0-9 -]{0,23}$/.test(tag))
          throw new Error(`${label} has an invalid tag “${tag}”. Use up to 24 letters, digits, spaces, or hyphens.`);
        tags.includes(tag) || tags.push(tag);
      }
    }
    if (tags.length > 8) throw new Error(`${label} can have at most 8 tags.`);
    return tags;
  }
  function destinationExtras(value, label) {
    let extras = {}, tags = validTags(value.tags, label);
    tags.length && (extras.tags = tags), value.favorite === !0 && (extras.favorite = !0);
    let note = String(value.note ?? "").trim();
    if (note.length > 500) throw new Error(`${label} has a note longer than 500 characters.`);
    return note && (extras.note = note), extras;
  }
  function validDestination(value, label) {
    if (!value || typeof value != "object") throw new Error(`${label} needs a name and destination.`);
    let name = String(value.name || "").trim();
    if (!name) throw new Error(`${label} needs a name.`);
    let extras = destinationExtras(value, label);
    if (value.type === "rdp") {
      let host = validRdpHost(String(value.host || "").trim(), label), preset = value.rdpPreset ? { rdpPreset: String(value.rdpPreset) } : {};
      return value.rdpProfile === void 0 ? { name, type: "rdp", host, ...preset, ...extras } : { name, type: "rdp", host, rdpProfile: parseRdpProfile(value.rdpProfile, host).content, ...preset, ...extras };
    }
    if (value.type !== void 0 && value.type !== "web") throw new Error(`${label} has an unsupported destination type.`);
    let url = String(value.url || "").trim();
    if (templateNames(url).length > 5) throw new Error(`${label} can have at most five {placeholders}.`);
    let sample = url.replace(PLACEHOLDER, "x");
    try {
      if (/[{}]/.test(sample)) throw new Error("unmatched brace");
      let parsed = new URL(sample);
      if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password)
        throw new Error("unsupported URL");
    } catch {
      throw new Error(`${label} needs an http or https URL.`);
    }
    return { name, url, ...extras };
  }
  function validSunIcon(value, name) {
    let icon = String(value ?? "").trim();
    if (!icon) return "";
    if ([...new Intl.Segmenter(void 0, { granularity: "grapheme" }).segment(icon)].length > 2 || /[<>&"']/.test(icon)) throw new Error(`${name} needs an icon of one or two characters.`);
    return icon;
  }
  function uniqueSunId(name, used) {
    let base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "sun", id = base, suffix = 2;
    for (; used.has(id); ) id = `${base}-${suffix++}`;
    return id;
  }
  function validateMap(data) {
    if (!data || !Array.isArray(data.groups)) throw new Error('The link map needs a "groups" array.');
    let used = /* @__PURE__ */ new Set(), normalized = data.groups.map((group, groupIndex) => {
      if (!group || typeof group != "object") throw new Error(`Sun ${groupIndex + 1} is invalid.`);
      let name = String(group.name || "").trim();
      if (!name) throw new Error(`Sun ${groupIndex + 1} needs a name.`);
      let color = group.color === void 0 ? DEFAULT_SUN_COLOR : String(group.color).trim();
      if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error(`${name} needs a six-digit hex color.`);
      if (!Array.isArray(group.links)) throw new Error(`${name} needs a planets array.`);
      let id = group.id === void 0 || group.id === null || group.id === "" ? uniqueSunId(name, used) : String(group.id);
      if (used.has(id)) throw new Error(`Duplicate sun ID: ${id}`);
      used.add(id);
      let links = group.links.map((link, linkIndex) => {
        let planet = validDestination(link, `Planet ${linkIndex + 1} in ${name}`);
        if (link.moons !== void 0 && !Array.isArray(link.moons))
          throw new Error(`${planet.name} needs a moons array.`);
        let moons = (link.moons || []).map((moon, moonIndex) => validDestination(moon, `Moon ${moonIndex + 1} around ${planet.name}`));
        return { ...planet, moons };
      }), icon = validSunIcon(group.icon, name);
      return { id, name, description: String(group.description || ""), color, ...icon ? { icon } : {}, links };
    }), routines2 = validRoutines(data.routines), rdpPresets2 = validRdpPresets(data.rdpPresets), presetIds = new Set(rdpPresets2.map((preset) => preset.id));
    for (let sun of normalized)
      for (let item of sun.links.flatMap((planet) => [planet, ...planet.moons]))
        item.type === "rdp" && item.rdpPreset && !presetIds.has(item.rdpPreset) && delete item.rdpPreset;
    let map = { groups: normalized };
    return routines2.length && (map.routines = routines2), rdpPresets2.length && (map.rdpPresets = rdpPresets2), map;
  }
  function validRdpPresets(value) {
    if (value == null) return [];
    if (!Array.isArray(value)) throw new Error("Remote Desktop presets need to be a list.");
    let used = /* @__PURE__ */ new Set(), names = /* @__PURE__ */ new Set();
    return value.map((preset, index) => {
      let name = String(preset?.name || "").trim();
      if (!name || name.length > 60) throw new Error(`Remote Desktop preset ${index + 1} needs a name of up to 60 characters.`);
      if (names.has(name.toLocaleLowerCase())) throw new Error(`There is already a preset named ${name}.`);
      names.add(name.toLocaleLowerCase());
      let settings = presetSettings(preset.settings, name), id = preset.id && !used.has(String(preset.id)) ? String(preset.id) : uniqueSunId(name, used);
      return used.add(id), { id, name, settings };
    });
  }
  function validRoutines(value) {
    if (value == null) return [];
    if (!Array.isArray(value)) throw new Error("Routines need to be a list.");
    let used = /* @__PURE__ */ new Set(), names = /* @__PURE__ */ new Set();
    return value.map((routine, index) => {
      if (!routine || typeof routine != "object") throw new Error(`Routine ${index + 1} is invalid.`);
      let name = String(routine.name || "").trim();
      if (!name || name.length > 60) throw new Error(`Routine ${index + 1} needs a name of up to 60 characters.`);
      if (names.has(name.toLocaleLowerCase())) throw new Error(`There is already a routine named ${name}.`);
      if (names.add(name.toLocaleLowerCase()), !Array.isArray(routine.links)) throw new Error(`${name} needs a links list.`);
      let keys = /* @__PURE__ */ new Set(), links = [];
      for (let link of routine.links) {
        let key = String(link?.key || "").trim();
        if (!key || key.length > 2e3) throw new Error(`${name} has an invalid link.`);
        keys.has(key) || (keys.add(key), links.push({ key, name: String(link.name || "").trim().slice(0, 200) || key }));
      }
      if (links.length > 100) throw new Error(`${name} can have at most 100 links.`);
      let id = routine.id && !used.has(String(routine.id)) ? String(routine.id) : uniqueSunId(name, used);
      used.add(id);
      let result = { id, name, links };
      if (routine.schedule) {
        let time = String(routine.schedule.time || "");
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error(`${name} needs a time such as 08:00.`);
        let days = [...new Set((routine.schedule.days || []).map(Number))].sort();
        if (!days.length || days.some((day) => !Number.isInteger(day) || day < 0 || day > 6))
          throw new Error(`${name} needs at least one day for its schedule.`);
        result.schedule = { time, days };
      }
      return result;
    });
  }
  function validPack(data) {
    if (!data || data.format !== "orbit-pack-v1" || !Array.isArray(data.links))
      throw new Error("This is not an Orbit link pack.");
    let name = String(data.name || "").trim().slice(0, 60) || "Shared links", links = data.links.map((link, index) => validDestination(link, `Link ${index + 1} in the pack`));
    if (!links.length) throw new Error("The pack has no links.");
    return { name, links, routine: data.routine ? {
      name: String(data.routine.name || name).trim().slice(0, 60) || name,
      schedule: data.routine.schedule
    } : null };
  }
  function validItemExport(data, kind, sourceKind = kind) {
    if (!data || data.format !== "orbit-item-v1" || data.kind !== sourceKind || !data.item)
      throw new Error(`Choose an Orbit ${sourceKind} export file.`);
    return kind === "sun" && sourceKind === "planet" ? validateMap({ groups: [{ name: data.item.name, links: [data.item] }] }).groups[0] : kind === "sun" ? validateMap({ groups: [data.item] }).groups[0] : kind === "planet" ? validateMap({ groups: [{ name: "Import", links: [data.item] }] }).groups[0].links[0] : validDestination(data.item, "Moon");
  }

  // src/core/map-ops.js
  var clone = (value) => JSON.parse(JSON.stringify(value));
  function mapItemAt(list, path) {
    let sun = list[path.sun];
    if (path.kind === "sun") return sun || null;
    let planet = sun?.links[path.planet];
    return path.kind === "planet" ? planet || null : path.kind === "moon" && planet?.moons[path.moon] || null;
  }
  function samePath(a, b) {
    return a.kind === b.kind && a.sun === b.sun && a.planet === b.planet && a.moon === b.moon;
  }
  function moveMapItem(list, source, target) {
    let key = source.kind, parentKind = (
      /** @type {Record<string, string>} */
      { planet: "sun", moon: "planet" }[key]
    ), sibling = target.kind === key && (target.place === "before" || target.place === "after");
    if (!["sun", "planet", "moon"].includes(key)) return { status: "invalid" };
    if (!sibling && (!parentKind || target.kind !== parentKind)) return { status: "invalid" };
    if (!mapItemAt(list, source) || !mapItemAt(list, target)) return { status: "invalid" };
    if (sibling && samePath(source, target)) return { status: "invalid" };
    if (list[source.sun]?.team || list[target.sun]?.team) return { status: "invalid" };
    let next = clone(list), siblingsAt = (path2) => key === "sun" ? next : key === "planet" ? next[path2.sun].links : next[path2.sun].links[path2.planet].moons, from = siblingsAt(source), to = siblingsAt(target), index = sibling ? target[key] + (target.place === "after" ? 1 : 0) : to.length;
    if (from === to) {
      if (!sibling) return { status: "same" };
      if (source[key] < index && index--, index === source[key]) return { status: "same" };
    }
    let [moved] = from.splice(source[key], 1);
    to.splice(index, 0, moved);
    let path = { kind: key, sun: key === "sun" ? index : target.sun };
    return key !== "sun" && (path.planet = key === "planet" ? index : target.planet), key === "moon" && (path.moon = index), { status: "moved", groups: next, path, total: to.length };
  }
  function plainCopy(item) {
    let copy = clone(item);
    return delete copy.team, typeof copy.id == "string" && copy.id.startsWith("team:") && (copy.id = copy.id.slice(5)), copy;
  }
  function personalGroups(list) {
    return list.filter((sun) => !sun.team);
  }
  function mergeMaps(personal, incoming) {
    let next = clone(personal), added = { suns: 0, planets: 0, moons: 0 }, skipped = { suns: 0, planets: 0, moons: 0 }, usedIds = new Set(next.map((sun) => sun.id));
    for (let source of incoming) {
      let sun = next.find((item) => item.id === source.id) || next.find((item) => item.name.toLocaleLowerCase() === source.name.toLocaleLowerCase());
      if (!sun) {
        let copy = plainCopy(source);
        usedIds.has(copy.id) && (copy.id = uniqueSunId(copy.name, usedIds)), usedIds.add(copy.id), next.push(copy), added.suns++, added.planets += copy.links.length, added.moons += copy.links.reduce((sum, planet) => sum + planet.moons.length, 0);
        continue;
      }
      skipped.suns++;
      for (let sourcePlanet of source.links) {
        let key = destinationKey(sourcePlanet), planet = sun.links.find((item) => destinationKey(item) === key);
        if (!planet) {
          sun.links.push(plainCopy(sourcePlanet)), added.planets++, added.moons += sourcePlanet.moons.length;
          continue;
        }
        skipped.planets++;
        for (let moon of sourcePlanet.moons) {
          let moonKey = destinationKey(moon);
          planet.moons.some((item) => destinationKey(item) === moonKey) ? skipped.moons++ : (planet.moons.push(plainCopy(moon)), added.moons++);
        }
      }
    }
    return { groups: next, added, skipped };
  }
  function mergeRoutines(current, incoming) {
    let names = new Set(current.map((routine) => routine.name.toLocaleLowerCase())), used = new Set(current.map((routine) => routine.id)), next = [...current];
    for (let routine of incoming) {
      if (names.has(routine.name.toLocaleLowerCase())) continue;
      names.add(routine.name.toLocaleLowerCase());
      let copy = clone(routine);
      used.has(copy.id) && (copy.id = uniqueSunId(copy.name, used)), used.add(copy.id), next.push(copy);
    }
    return next;
  }
  function duplicateGroups(list) {
    let byKey = /* @__PURE__ */ new Map();
    return list.forEach((sun, sunIndex) => sun.links.forEach((planet, planetIndex) => {
      let entries = [[planet, [sunIndex, planetIndex]], ...planet.moons.map((moon, moonIndex) => (
        /** @type {[Destination, number[]]} */
        [moon, [sunIndex, planetIndex, moonIndex]]
      ))];
      for (let [item, path] of entries) {
        let key = destinationKey(item), found = byKey.get(key) || [];
        found.push({ item, path }), byKey.set(key, found);
      }
    })), [...byKey.values()].filter((found) => found.length > 1);
  }
  function packLink(item) {
    let copy = plainCopy(item);
    return delete copy.moons, delete copy.favorite, delete copy.rdpPreset, copy;
  }
  function itemExport(kind, item) {
    return { format: "orbit-item-v1", kind, item: plainCopy(item) };
  }

  // src/state/history.js
  var history_exports = {};
  __export(history_exports, {
    HISTORY_LIMIT: () => HISTORY_LIMIT,
    loadHistory: () => loadHistory,
    recordHistory: () => recordHistory
  });

  // src/state/storage.js
  var storage_exports = {};
  __export(storage_exports, {
    KEYS: () => KEYS,
    MIGRATIONS: () => MIGRATIONS,
    STORAGE_VERSION_KEY: () => STORAGE_VERSION_KEY,
    memoryStorage: () => memoryStorage,
    migrate: () => migrate,
    onExternalChange: () => onExternalChange,
    read: () => read,
    readJson: () => readJson,
    readSafely: () => readSafely,
    remove: () => remove,
    useBackend: () => useBackend,
    write: () => write,
    writeSafely: () => writeSafely
  });
  var KEYS = Object.freeze({
    map: "orbit:map:v1",
    undo: "orbit:undo-removal:v1",
    history: "orbit:history:v1",
    backup: "orbit:backup:v1",
    workspaces: "orbit:workspaces:v1",
    activeWorkspace: "orbit:workspace",
    recent: "orbit:recent:v1",
    variables: "orbit:variables:v1",
    routineOffered: "orbit:routine-offered:v1",
    teamFavorites: "orbit:team-favorites",
    teamHidden: "orbit:team-hidden",
    teamSeen: "orbit:team-seen:v1"
  }), override = null;
  function backend() {
    return override ? override() : globalThis.localStorage;
  }
  function useBackend(storage) {
    override = storage ? () => storage : null;
  }
  function memoryStorage(initial = {}) {
    let data = new Map(Object.entries(initial));
    return {
      data,
      failWrites: !1,
      /** @param {string} key */
      getItem(key) {
        return data.has(key) ? (
          /** @type {string} */
          data.get(key)
        ) : null;
      },
      /** @param {string} key @param {string} value */
      setItem(key, value) {
        if (this.failWrites) throw new Error("The quota has been exceeded.");
        data.set(key, String(value));
      },
      /** @param {string} key */
      removeItem(key) {
        data.delete(key);
      }
    };
  }
  function read(key) {
    return backend().getItem(key);
  }
  function readSafely(key) {
    try {
      return backend().getItem(key);
    } catch {
      return null;
    }
  }
  function readJson(key, fallback) {
    try {
      let text = backend().getItem(key);
      return text === null ? fallback : JSON.parse(text);
    } catch {
      return fallback;
    }
  }
  function write(key, value) {
    backend().setItem(key, value);
  }
  function writeSafely(key, value) {
    try {
      return backend().setItem(key, value), !0;
    } catch {
      return !1;
    }
  }
  function remove(key) {
    backend().removeItem(key);
  }
  var MIGRATIONS = [], STORAGE_VERSION_KEY = "orbit:storage-version";
  function migrate() {
    if (!MIGRATIONS.length) return [];
    let current = Number(readSafely(STORAGE_VERSION_KEY) || 0), applied = [];
    for (let migration of MIGRATIONS)
      migration.version <= current || (migration.up(), write(STORAGE_VERSION_KEY, String(migration.version)), applied.push(migration.version));
    return applied;
  }
  function onExternalChange(listener, target = globalThis) {
    let handler = (event) => {
      (event.key === null || String(event.key).startsWith("orbit:")) && listener(event.key);
    };
    return target.addEventListener("storage", handler), () => target.removeEventListener("storage", handler);
  }

  // src/state/history.js
  var HISTORY_LIMIT = 20;
  function loadHistory(key) {
    let list = readJson(key, []);
    return Array.isArray(list) ? list.filter((entry) => entry && Array.isArray(entry.groups)) : [];
  }
  function recordHistory(key, previousGroups, label, previousRoutines = [], previousPresets = [], time = Date.now()) {
    let entry = { time, label: String(label || "Change"), groups: previousGroups };
    previousRoutines.length && (entry.routines = previousRoutines), previousPresets.length && (entry.rdpPresets = previousPresets);
    let list = [entry, ...loadHistory(key)].slice(0, HISTORY_LIMIT);
    for (; list.length; )
      try {
        write(key, JSON.stringify(list));
        return;
      } catch {
        list.pop();
      }
  }

  // src/state/workspaces.js
  var workspaces_exports = {};
  __export(workspaces_exports, {
    MAIN: () => MAIN,
    WORKSPACE_KEYS: () => WORKSPACE_KEYS,
    loadWorkspaces: () => loadWorkspaces2,
    newWorkspace: () => newWorkspace,
    readActiveWorkspace: () => readActiveWorkspace,
    renameWorkspace: () => renameWorkspace,
    saveActiveWorkspace: () => saveActiveWorkspace,
    saveWorkspaces: () => saveWorkspaces,
    workspaceKey: () => workspaceKey,
    workspaceName: () => workspaceName2
  });
  var MAIN = "main", WORKSPACE_KEYS = Object.freeze([KEYS.map, KEYS.undo, KEYS.history]);
  function loadWorkspaces2() {
    let list = readJson(KEYS.workspaces, []), valid = Array.isArray(list) ? list.filter((item) => item && typeof item.id == "string" && item.name) : [];
    return valid.some((item) => item.id === MAIN) ? valid : [{ id: MAIN, name: "Main" }, ...valid];
  }
  function saveWorkspaces(list) {
    write(KEYS.workspaces, JSON.stringify(list));
  }
  function readActiveWorkspace() {
    let id = readSafely(KEYS.activeWorkspace);
    return id && loadWorkspaces2().some((item) => item.id === id) ? id : MAIN;
  }
  function saveActiveWorkspace(id) {
    writeSafely(KEYS.activeWorkspace, String(id));
  }
  function workspaceKey(base, id) {
    return id === MAIN ? base : `${base}:${id}`;
  }
  function workspaceName2(id) {
    return loadWorkspaces2().find((item) => item.id === id)?.name || "Main";
  }
  function newWorkspace(name) {
    let list = loadWorkspaces2(), clean = String(name || "").trim();
    if (!clean || clean.length > 40) throw new Error("A workspace needs a name of up to 40 characters.");
    if (list.some((item) => item.name.toLocaleLowerCase() === clean.toLocaleLowerCase()))
      throw new Error(`There is already a workspace named ${clean}.`);
    return { id: uniqueSunId(clean, new Set(list.map((item) => item.id))), name: clean };
  }
  function renameWorkspace(id, name) {
    let clean = String(name || "").trim(), list = loadWorkspaces2();
    if (!clean || clean.length > 40) throw new Error("A workspace needs a name of up to 40 characters.");
    if (list.some((item) => item.id !== id && item.name.toLocaleLowerCase() === clean.toLocaleLowerCase()))
      throw new Error(`There is already a workspace named ${clean}.`);
    saveWorkspaces(list.map((item) => item.id === id ? { ...item, name: clean } : item));
  }

  // src/core/search.js
  var search_exports = {};
  __export(search_exports, {
    addressText: () => addressText,
    editDistance: () => editDistance,
    findMatches: () => findMatches,
    searchEntries: () => searchEntries,
    searchWords: () => searchWords
  });
  function editDistance(a, b, limit) {
    if (Math.abs(a.length - b.length) > limit) return limit + 1;
    let before = [], previous = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      let current = [i], best = i;
      for (let j = 1; j <= b.length; j++)
        current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)), i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1] && (current[j] = Math.min(current[j], before[j - 2] + 1)), best = Math.min(best, current[j]);
      if (best > limit) return limit + 1;
      before = previous, previous = current;
    }
    return previous[b.length];
  }
  var SHORT_FORM = /^([a-z]+)(\d+)$/;
  function wordQuality(token, text, words, loose, anywhere) {
    let best = 0;
    for (let word of words) {
      if (word === token) return 1;
      word.startsWith(token) ? best = Math.max(best, 0.85) : token.length >= 3 && word.includes(token) && (best = Math.max(best, 0.6));
      let short = SHORT_FORM.exec(token), long = SHORT_FORM.exec(word);
      if (short && long && short[2] === long[2] && long[1].startsWith(short[1]) && (best = Math.max(best, 0.55)), loose && !best && token.length >= 5) {
        let limit = token.length >= 9 ? 2 : 1;
        editDistance(token, word, limit) <= limit && (best = Math.max(best, 0.4));
      }
    }
    return !best && (anywhere || token.length >= 3) && text.includes(token) && (best = 0.5), best;
  }
  function searchWords(text) {
    return text.toLocaleLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  }
  function addressText(item) {
    if (item.type === "rdp") return item.host;
    try {
      let url = new URL(item.url);
      return `${url.hostname}${url.pathname === "/" ? "" : url.pathname}`;
    } catch {
      return item.url || "";
    }
  }
  function searchEntries(groups2) {
    let entries = [], fields = (name, path, item) => {
      let list = [{ kind: "name", text: name.toLocaleLowerCase(), weight: 1, anywhere: !0 }];
      return path && list.push({ kind: "path", text: path.toLocaleLowerCase(), weight: 0.7 }), item && (list.push({ kind: "address", text: addressText(item).toLocaleLowerCase(), weight: 0.6 }), item.tags?.length && list.push({ kind: "tag", text: item.tags.join(" "), weight: 0.8 }), item.note && list.push({ kind: "note", text: item.note.toLocaleLowerCase(), weight: 0.5 })), list.map((field) => ({ ...field, words: searchWords(field.text) }));
    };
    return groups2.forEach((sun, sunIndex) => {
      entries.push({
        match: { kind: "Sun", name: sun.name, path: sun.team ? "Team Galaxy" : "Galaxy", id: sun.id, icon: sun.icon },
        tags: [],
        fields: fields(sun.name)
      }), sun.links.forEach((planet, planetIndex) => {
        entries.push({
          match: {
            kind: "Planet",
            name: planet.name,
            path: sun.name,
            destination: planet,
            indices: [sunIndex, planetIndex],
            tags: planet.tags || []
          },
          tags: planet.tags || [],
          fields: fields(planet.name, sun.name, planet)
        }), planet.moons.forEach((moon, moonIndex) => {
          entries.push({
            match: {
              kind: "Moon",
              name: moon.name,
              path: `${sun.name} / ${planet.name}`,
              destination: moon,
              indices: [sunIndex, planetIndex, moonIndex],
              tags: moon.tags || []
            },
            tags: moon.tags || [],
            fields: fields(moon.name, `${sun.name} ${planet.name}`, moon)
          });
        });
      });
    }), entries;
  }
  function findMatches(groups2, query) {
    let raw = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean), tagFilters = raw.flatMap((word) => {
      let tag = /^#(.+)$/.exec(word) || /^tag:(.+)$/.exec(word);
      return tag ? [tag[1]] : [];
    }), tokens = raw.filter((word) => !/^#.+$/.test(word) && !/^tag:.+$/.test(word));
    if (!tokens.length && !tagFilters.length) return [];
    let entries = searchEntries(groups2).filter((entry) => tagFilters.every((tag) => entry.tags.includes(tag))), strictHits = new Set(tokens.filter((token) => entries.some((entry) => entry.fields.some((field) => wordQuality(token, field.text, field.words || [], !1, field.anywhere))))), scored = [];
    return entries.forEach((entry, order) => {
      let score = 0, reasons = /* @__PURE__ */ new Set();
      for (let token of tokens) {
        let best = 0, bestKind = "";
        for (let field of entry.fields) {
          let quality = wordQuality(token, field.text, field.words || [], !strictHits.has(token), field.anywhere) * field.weight;
          quality > best && (best = quality, bestKind = field.kind);
        }
        if (!best) return;
        score += best, reasons.add(bestKind);
      }
      if (tokens.length && ![...reasons].some((kind) => kind !== "path")) return;
      tokens.length || (score = 1);
      let match = { ...entry.match, score };
      reasons.has("name") || (reasons.has("address") ? match.why = `Address: ${addressText(entry.match.destination)}` : reasons.has("tag") ? match.why = "Matched a tag" : reasons.has("note") && (match.why = "Matched the note")), scored.push({ match, order });
    }), scored.sort((a, b) => b.match.score - a.match.score || a.order - b.order), scored.map((item) => item.match);
  }

  // src/core/words.js
  var words_exports = {};
  __export(words_exports, {
    counted: () => counted
  });
  function counted(amount, word, plural = `${word}s`) {
    return `${amount} ${amount === 1 ? word : plural}`;
  }

  // src/ui/dom.js
  function element(tag, className, text) {
    let node = document.createElement(tag);
    return className && (node.className = className), text !== void 0 && (node.textContent = /** @type {string} */
    text), node;
  }
  function safeColor(value) {
    return typeof value == "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : "#79d9f8";
  }
  function tagPath(node, kind, sun, planet, moon) {
    return node.dataset.kind = kind, node.dataset.sun = String(sun), planet !== void 0 && (node.dataset.planet = String(planet)), moon !== void 0 && (node.dataset.moon = String(moon)), node;
  }
  function tagChips(tags) {
    let list = element("span", "tag-chips");
    return tags.forEach((tag) => list.append(element("span", "tag-chip", `#${tag}`))), list;
  }
  function descriptionNode(className, description) {
    let node = element("p", className), pattern = /\[([^\[\]]+)\]\(([^()\s]+)\)/g, cursor = 0;
    for (let match of description.matchAll(pattern)) {
      let index = (
        /** @type {number} */
        match.index
      );
      node.append(document.createTextNode(description.slice(cursor, index)));
      let href = null;
      try {
        let url = new URL(match[2]);
        ["http:", "https:"].includes(url.protocol) && url.hostname && !url.username && !url.password && (href = url.href);
      } catch {
      }
      if (href) {
        let link = element("a", "description-link", match[1]);
        link.href = href, link.target = "_blank", link.rel = "noopener noreferrer", node.append(link);
      } else
        node.append(document.createTextNode(match[0]));
      cursor = index + match[0].length;
    }
    return node.append(document.createTextNode(description.slice(cursor))), node;
  }

  // src/ui/modes.js
  function initialModes({ view = "galaxy" } = {}) {
    return Object.freeze({ overlay: "none", mode: "browsing", view, find: "empty" });
  }
  var inEditMode = (state) => state.mode !== "browsing", menuOpen = (state) => state.overlay === "menu" || state.overlay === "menuPanel" || state.overlay === "menuEditor", holding = (state) => state.mode === "pressed" || state.mode === "dragging";
  function escapeTarget(state) {
    return state.overlay !== "none" ? "overlay" : holding(state) ? "drag" : state.mode === "editIdle" ? "edit" : state.find === "filtering" ? "find" : state.view === "system" ? "view" : null;
  }
  function keyAllowed(state, key) {
    return key === "escape" ? !0 : state.overlay === "placeholder" ? !1 : key === "commandK" ? !menuOpen(state) && state.view !== "error" : key === "slash" ? !menuOpen(state) : !0;
  }
  function linkOpensEditor(state, where) {
    return inEditMode(state) && where !== "notice";
  }
  var routineOffersAllowed = (state) => !inEditMode(state);
  function transition(state, event) {
    let to = (changes) => {
      let next = { ...state, ...changes };
      return next.overlay === state.overlay && next.mode === state.mode && next.view === state.view && next.find === state.find ? state : Object.freeze(next);
    }, dropHold = holding(state) ? { mode: (
      /** @type {Mode} */
      "editIdle"
    ) } : {};
    switch (event) {
      case "openPalette":
        return keyAllowed(state, "commandK") && state.overlay === "none" ? to({ overlay: "palette", ...dropHold }) : state;
      case "openPlaceholder":
        return state.overlay === "none" || state.overlay === "palette" ? to({ overlay: "placeholder", ...dropHold }) : state;
      case "openMenu":
        return state.overlay === "none" ? to({ overlay: "menu", ...dropHold }) : state;
      case "openEditor":
        return state.overlay === "placeholder" ? state : to({ overlay: "menuEditor", ...dropHold });
      case "choosePanel":
        return state.overlay === "menu" || state.overlay === "menuPanel" || state.overlay === "menuEditor" || state.overlay === "palette" ? to({ overlay: "menuPanel", ...dropHold }) : state;
      case "backToPanels":
        return state.overlay === "menuEditor" ? to({ overlay: "menuPanel" }) : state;
      case "closeOverlay":
        return to({ overlay: "none" });
      case "runEntry":
        return state.overlay === "palette" ? to({ overlay: "none" }) : state;
      case "editOn":
        return state.mode === "browsing" ? to({ mode: "editIdle" }) : state;
      case "editOff":
        return to({ mode: "browsing" });
      case "press":
        return state.mode === "editIdle" && state.overlay === "none" && state.view !== "error" ? to({ mode: "pressed" }) : state;
      case "passThreshold":
        return state.mode === "pressed" ? to({ mode: "dragging" }) : state;
      case "release":
      case "drop":
      case "cancelDrag":
      case "render":
      case "switchWorkspace":
        return holding(state) ? to({ mode: "editIdle" }) : state;
      case "pageChange":
        return to({ ...dropHold, ...menuOpen(state) ? { overlay: "none" } : {} });
      case "openSystem":
        return state.view === "galaxy" ? to({ view: "system" }) : state;
      case "toGalaxy":
        return state.view === "system" ? to({ view: "galaxy" }) : state;
      case "loadFailed":
        return to({ view: "error", overlay: "none", mode: "browsing" });
      case "type":
        return to({ find: "filtering", ...state.view === "system" ? { view: "galaxy" } : {} });
      case "clearFind":
        return to({ find: "empty" });
      case "escape": {
        let target = escapeTarget(state);
        return target === "overlay" ? to({ overlay: "none" }) : target === "drag" ? to({ mode: "editIdle" }) : target === "edit" ? to({ mode: "browsing" }) : target === "find" ? to({ find: "empty" }) : target === "view" ? to({ view: "galaxy" }) : state;
      }
      default:
        return state;
    }
  }

  // src/ui/mode-store.js
  function createModeStore(start) {
    let state = initialModes(start), listeners = [], queue = [], reporting = !1;
    return {
      /** The current state (frozen). */
      state: () => state,
      /**
       * Apply an event. Listeners run only when something changed. An event
       * sent from inside a listener is applied at once, and reported after the
       * current change has reached every listener, so each listener hears the
       * changes in the order they happened.
       * @param {ModeEvent} event
       * @returns {boolean} Whether the state changed.
       */
      send(event) {
        let previous = state, next = transition(state, event);
        if (next === previous) return !1;
        if (state = next, queue.push([next, previous, event]), !reporting) {
          reporting = !0;
          try {
            for (; queue.length; ) {
              let change = (
                /** @type {[Modes, Modes, ModeEvent]} */
                queue.shift()
              );
              for (let listener of [...listeners]) listener(...change);
            }
          } finally {
            reporting = !1, queue.length = 0;
          }
        }
        return !0;
      },
      /**
       * @param {ModeListener} listener
       * @returns {() => void} Unsubscribe.
       */
      subscribe(listener) {
        return listeners.push(listener), () => {
          let index = listeners.indexOf(listener);
          index !== -1 && listeners.splice(index, 1);
        };
      },
      // Queries; each reads the current state.
      inEditMode: () => inEditMode(state),
      menuOpen: () => menuOpen(state),
      /** Pressing or dragging an item. */
      holding: () => state.mode === "pressed" || state.mode === "dragging",
      dragging: () => state.mode === "dragging",
      /** @param {import('./modes.js').Overlay} overlay */
      overlayIs: (overlay) => state.overlay === overlay,
      escapeTarget: () => escapeTarget(state),
      /** @param {'commandK'|'slash'|'escape'|'other'} key */
      keyAllowed: (key) => keyAllowed(state, key),
      /** @param {'app'|'palette'|'notice'} where */
      linkOpensEditor: (where) => linkOpensEditor(state, where),
      routineOffersAllowed: () => routineOffersAllowed(state)
    };
  }

  // src/ui/page-modes.js
  var modes = createModeStore();

  // src/ui/layout/orbits.js
  function labelFit(names, totalLimit, wordLimit) {
    let longest = Math.max(1, ...names.map((name) => name.length)), word = Math.max(1, ...names.flatMap((name) => name.split(/[\s/-]+/).map((part) => part.length)));
    return Math.max(0.8, Math.min(1, totalLimit / longest, wordLimit / word));
  }
  function updateMapLabelSizes() {
    document.documentElement.style.setProperty(
      "--sun-label-fit",
      String(labelFit(groups.map((sun) => sun.name), 18, 10))
    );
  }
  var ORBIT_LEVELS = {
    home: {
      selector: ".home-satellite",
      variable: "--home-planet-size",
      base: () => 72,
      max: 112,
      names: () => groups.flatMap((sun) => sun.links.slice(0, 5))
    },
    detail: {
      selector: ".detail-satellite",
      variable: "--detail-planet-size",
      base: () => Math.min(100, Math.max(70, window.innerWidth * 0.16)),
      max: 140,
      names: () => groups.flatMap((sun) => sun.links.slice(0, 8))
    },
    moon: {
      selector: ".moon-link",
      variable: "--moon-size",
      base: () => 72,
      max: 88,
      names: () => groups.flatMap((sun) => sun.links.flatMap((planet) => planet.moons.slice(0, 6)))
    },
    more: {
      selector: ".more-link",
      variable: "--more-planet-size",
      base: () => 90,
      max: 130,
      names: () => groups.flatMap((sun) => sun.links.slice(8))
    },
    overflowMoon: {
      selector: ".overflow-moon-link",
      variable: "--overflow-moon-size",
      base: () => 76,
      max: 110,
      names: () => groups.flatMap((sun) => sun.links.flatMap((planet) => planet.moons))
    }
  }, orbitSizes = {}, canvas = null, measureContext = () => (
    /** @type {CanvasRenderingContext2D} */
    canvas ?? (canvas = document.createElement("canvas").getContext("2d"))
  );
  function labelFits(name, diameter, padding, lineHeight, measure, extra = 0) {
    let width = diameter - padding * 2, space = measure(" "), lines = [];
    for (let word of name.split(/\s+/).filter(Boolean)) {
      let wordWidth = measure(word);
      if (wordWidth > width) return !1;
      let last = lines.length - 1;
      last >= 0 && lines[last] + space + wordWidth <= width ? lines[last] += space + wordWidth : lines.push(wordWidth);
    }
    let radius = diameter / 2 - 3, half = (lines.length * lineHeight + extra) / 2;
    return lines.every((lineWidth, line) => {
      let y = Math.abs(extra + (line + 0.5) * lineHeight - half);
      return y < radius && lineWidth / 2 <= Math.sqrt(radius * radius - y * y);
    });
  }
  function fitOrbitSizes() {
    let root = document.documentElement.style, context = measureContext();
    for (let [key, level] of Object.entries(ORBIT_LEVELS)) {
      let sample = app.querySelector(level.selector), base = level.base();
      if (!sample) {
        orbitSizes[key] || (orbitSizes[key] = base);
        continue;
      }
      let style = getComputedStyle(sample);
      context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      let cache = /* @__PURE__ */ new Map(), measure = (text) => (cache.has(text) || cache.set(text, context.measureText(text).width), cache.get(text)), padding = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.borderLeftWidth) || 0), lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2, names = [...new Set(level.names().map((item) => item.name))], extra = showSiteIcons ? 19 : 0, size = Math.round(base);
      for (; size < level.max && !names.every((name) => labelFits(name, size, padding, lineHeight, measure, extra)); ) size += 2;
      orbitSizes[key] = Math.min(size, level.max), root.setProperty(
        /** @type {string} */
        level.variable,
        `${orbitSizes[key]}px`
      ), shrinkLongLabels(level.selector, orbitSizes[key], style, padding, extra);
    }
  }
  function shrinkLongLabels(selector, size, style, padding, extra = 0) {
    let context = measureContext(), fontSize = parseFloat(style.fontSize), lineHeight = parseFloat(style.lineHeight) || fontSize * 1.2;
    for (
      let node of
      /** @type {NodeListOf<HTMLElement>} */
      app.querySelectorAll(selector)
    ) {
      node.style.removeProperty("font-size");
      for (let step = 20; step >= 12; step--) {
        let scale = step / 20;
        context.font = `${style.fontWeight} ${fontSize * scale}px ${style.fontFamily}`;
        let measure = (text) => context.measureText(text).width;
        if (step === 12 || labelFits(
          /** @type {string} */
          node.textContent,
          size,
          padding,
          lineHeight * scale,
          measure,
          extra
        )) {
          scale < 1 && (node.style.fontSize = `${(fontSize * scale).toFixed(2)}px`);
          break;
        }
      }
    }
  }
  function circleHull(circles, margin) {
    let points = circles.flatMap(({ x, y, r }) => Array.from({ length: 24 }, (_, i) => {
      let turn = i * Math.PI / 12;
      return { x: x + Math.cos(turn) * (r + margin), y: y + Math.sin(turn) * (r + margin) };
    })).sort((a, b) => a.x - b.x || a.y - b.y), cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x), half = (list) => list.reduce((hull, point) => {
      for (; hull.length >= 2 && cross(
        /** @type {Point} */
        hull.at(-2),
        /** @type {Point} */
        hull.at(-1),
        point
      ) <= 0; ) hull.pop();
      return hull.push(point), hull;
    }, []), lower = half(points), upper = half([...points].reverse());
    return [...lower.slice(0, -1), ...upper.slice(0, -1)];
  }
  function moonSpokes(points, origin, size) {
    let svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "moon-spokes"), svg.setAttribute("viewBox", `0 0 ${size} ${size}`), svg.setAttribute("aria-hidden", "true");
    for (let point of points) {
      let line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", String(origin.x)), line.setAttribute("y1", String(origin.y)), line.setAttribute("x2", String(point.x)), line.setAttribute("y2", String(point.y)), svg.append(line);
    }
    return svg;
  }
  function layoutMoonField(field) {
    let angle = Number(field.dataset.angle), home = field.dataset.context === "home", planet = orbitSizes[home ? "home" : "detail"] || (home ? 72 : 100), moon = orbitSizes.moon || 72, moons = (
      /** @type {HTMLElement[]} */
      [...field.querySelectorAll(".moon-link")]
    ), crowded = moons.length > 4, spread = (crowded ? 150 : 130) * Math.PI / 180, step = moons.length > 1 ? spread / (moons.length - 1) : 0, extra = crowded ? 28 : 0, radius = Math.max((home ? 98 : 108) + extra, planet / 2 + moon / 2 + 26 + extra);
    step && (radius = Math.max(radius, (moon + 6) / (2 * Math.sin(step / 2))));
    let positions = moons.map((_, index) => {
      let moonAngle = angle - spread / 2 * (moons.length > 1 ? 1 : 0) + step * index;
      return { x: Math.cos(moonAngle) * radius, y: Math.sin(moonAngle) * radius };
    }), lift = Math.sin(angle) * Math.max(108, 71 + planet / 2);
    field.dataset.rise = String(Math.round(Math.max(...positions.map((point) => -(lift + point.y))) + moon / 2)), field.dataset.drop = String(Math.round(Math.max(...positions.map((point) => point.y)) + moon / 2));
    let hull = circleHull([
      { x: 0, y: 0, r: planet / 2 },
      ...positions.map((point) => ({ ...point, r: moon / 2 }))
    ], 12), out = radius * 0.5, center = { x: Math.cos(angle) * out, y: Math.sin(angle) * out }, size = Math.ceil(2 * Math.max(...hull.map((point) => Math.hypot(point.x - center.x, point.y - center.y))));
    field.style.width = field.style.height = `${size}px`, field.style.clipPath = `polygon(${hull.map((point) => `${(point.x - center.x + size / 2).toFixed(1)}px ${(point.y - center.y + size / 2).toFixed(1)}px`).join(", ")})`, field.style.setProperty("--out-x", `${center.x}px`), field.style.setProperty("--out-y", `${center.y}px`), moons.forEach((node, index) => {
      node.style.setProperty("--mx", `${positions[index].x - center.x}px`), node.style.setProperty("--my", `${positions[index].y - center.y}px`);
    });
    let origin = { x: size / 2 - center.x, y: size / 2 - center.y };
    field.querySelector(".moon-spokes")?.remove(), field.prepend(moonSpokes(positions.map((point) => ({
      x: origin.x + point.x,
      y: origin.y + point.y
    })), origin, size));
  }
  function layoutOrbits() {
    fitOrbitSizes(), app.querySelectorAll(".moon-field").forEach(layoutMoonField);
    let firstRow = (
      /** @type {HTMLElement | null} */
      app.querySelector(".group-card")?.offsetTop
    ), fans = (
      /** @type {HTMLElement[]} */
      [...app.querySelectorAll(".home-orbit .moon-field")].filter((field) => (
        /** @type {HTMLElement} */
        field.closest(".group-card").offsetTop === firstRow
      )).map((field) => Number(field.dataset.rise))
    ), extra = Math.max(0, ...fans) - 242;
    document.documentElement.style.setProperty("--galaxy-fan-room", `${Math.max(0, Math.ceil(extra))}px`);
    let stage = (
      /** @type {HTMLElement | null} */
      app.querySelector(".detail-stage")
    ), note = (
      /** @type {HTMLElement | null} */
      app.querySelector(".detail-note")
    );
    if (stage && note) {
      let overhang = Math.max(0, .../** @type {HTMLElement[]} */
      [...stage.querySelectorAll(".moon-field")].map((field) => (
        /** @type {HTMLElement} */
        field.closest(".planet-cluster").offsetTop + Number(field.dataset.drop) - stage.offsetHeight
      )));
      note.style.marginTop = overhang > 0 ? `${Math.ceil(overhang + 12)}px` : "";
    }
  }
  function installLayout() {
    let frame = 0;
    window.addEventListener("resize", () => {
      cancelAnimationFrame(frame), frame = requestAnimationFrame(layoutOrbits);
    }), window.addEventListener("load", () => document.fonts?.ready.then(layoutOrbits));
  }

  // src/services/rdp-launch.js
  var rdp_launch_exports = {};
  __export(rdp_launch_exports, {
    downloadRdp: () => downloadRdp,
    launchRdp: () => launchRdp
  });

  // src/services/file-io.js
  var file_io_exports = {};
  __export(file_io_exports, {
    downloadJson: () => downloadJson2,
    downloadText: () => downloadText,
    pickFile: () => pickFile,
    readBookmarksHtml: () => readBookmarksHtml,
    readJsonFile: () => readJsonFile,
    readRdpText: () => readRdpText
  });
  function downloadText(text, filename, type) {
    let page = (
      /** @type {any} */
      globalThis
    ), blob = new Blob([text], { type }), url = page.URL.createObjectURL(blob), anchor = page.document.createElement("a");
    anchor.href = url, anchor.download = filename, page.document.body.append(anchor), anchor.click(), anchor.remove(), setTimeout(() => page.URL.revokeObjectURL(url), 1e3);
  }
  function downloadJson2(data, filename) {
    downloadText(JSON.stringify(data, null, 2) + `
`, filename, "application/json");
  }
  function pickFile(accept, onFile) {
    let input = (
      /** @type {HTMLInputElement} */
      /** @type {any} */
      globalThis.document.createElement("input")
    );
    input.type = "file", input.accept = accept, input.addEventListener("change", () => {
      input.files?.length && onFile(input.files[0]);
    }), input.click();
  }
  async function readJsonFile(file) {
    return JSON.parse(await file.text());
  }
  async function readRdpText(file) {
    if (file.size > 64e3) throw new Error("The .rdp file is too large to import.");
    return decodeRdpBytes(new Uint8Array(await file.arrayBuffer()));
  }
  function readBookmarkFolder(list, name) {
    let folder = { name, links: [], folders: [] };
    for (let entry of list.querySelectorAll(":scope > dt, :scope > p > dt")) {
      let heading = entry.querySelector(":scope > h3"), anchor = entry.querySelector(":scope > a");
      if (heading) {
        let sub = entry.querySelector(":scope > dl") || (entry.nextElementSibling?.tagName === "DL" ? entry.nextElementSibling : null);
        sub && folder.folders.push(readBookmarkFolder(sub, heading.textContent?.trim() || "Folder"));
      } else anchor && folder.links.push({ name: anchor.textContent?.trim() ?? "", url: anchor.getAttribute("href") || "" });
    }
    return folder;
  }
  function readBookmarksHtml(text) {
    let list = new /** @type {any} */
    globalThis.DOMParser().parseFromString(text, "text/html").querySelector("dl");
    if (!list) throw new Error("This is not a bookmarks file. Export bookmarks from your browser as HTML.");
    return readBookmarkFolder(list, "Bookmarks");
  }

  // src/services/rdp-launch.js
  function downloadRdp(destination, presets) {
    downloadText(rdpFileContent(destination, presets), rdpFileName(destination), "application/x-rdp");
  }
  function launchRdp(destination, presets, mode) {
    mode === "download" ? downloadRdp(destination, presets) : globalThis.location.href = rdpLaunchUrl2(destination, presets);
  }

  // src/ui/find/results.js
  function findCopy(match) {
    let copy = element("span", "find-copy");
    return copy.append(element("strong", "", `${match.icon ? `${match.icon} ` : ""}${match.name}`), element("small", "", match.path)), match.why && copy.append(element("small", "find-why", match.why)), match.destination?.note && copy.append(element("small", "find-note", match.destination.note)), match.tags?.length && copy.append(tagChips(match.tags)), copy;
  }
  function editFindResult(match) {
    let node = element("button", "find-item find-item-edit");
    return node.type = "button", node.title = `Edit ${match.name} in Edit links`, node.addEventListener("click", () => openEditorAt(match.indices)), node.append(element("span", "find-kind", match.kind), findCopy(match)), node.append(element("span", "find-arrow find-edit-label", "Edit")), node;
  }
  function findResult(match) {
    if (modes.inEditMode() && match.indices) return editFindResult(match);
    let isRdp = match.destination?.type === "rdp", download = isRdp && rdpLaunchMode === "download", template = match.destination && !isRdp && templateNames(match.destination.url).length > 0, node = (
      /** @type {HTMLAnchorElement & HTMLButtonElement} */
      element(match.id || download || template ? "button" : "a", "find-item")
    );
    return match.id ? (node.type = "button", node.addEventListener("click", () => {
      location.hash = `group/${encodeURIComponent(match.id)}`;
    })) : template ? (node.type = "button", node.dataset.template = "true", node.addEventListener("click", () => askForVariables(match.destination))) : download ? (node.type = "button", node.addEventListener("click", () => downloadRdp(match.destination, rdpPresets)), node.title = `Download Remote Desktop connection for ${match.name}`) : isRdp ? (node.href = rdpLaunchUrl2(match.destination, rdpPresets), node.title = `Open Remote Desktop Connection for ${match.name}`) : (node.href = match.destination.url, node.target = "_blank", node.rel = "noopener noreferrer"), match.indices && (node.dataset.destination = match.indices.join(":")), node.append(element("span", "find-kind", match.kind), findCopy(match)), node.append(element("span", "find-arrow", match.id ? "→" : download ? "↓" : "↗")), node;
  }
  function findRow(match) {
    let result = findResult(match);
    if (!match.indices) return result;
    let row = element("div", "find-row"), sun = groups[match.indices[0]], on = isFavorite(match.destination, sun), star = element("button", `favorite-toggle${on ? " is-favorite" : ""}`, on ? "★" : "☆");
    return star.type = "button", star.setAttribute("aria-pressed", String(on)), star.setAttribute("aria-label", `${on ? "Remove" : "Add"} ${match.name} ${on ? "from" : "to"} favorites`), star.title = /** @type {string} */
    star.getAttribute("aria-label"), star.addEventListener("click", () => {
      setFavorite(match.indices, !on), app.querySelector(`.find-row [data-star="${match.indices.join(":")}"]`)?.focus();
    }), star.dataset.star = match.indices.join(":"), row.append(result, star), row;
  }

  // src/ui/views/nodes.js
  function siteIcon(link) {
    if (!showSiteIcons || link.type === "rdp") return null;
    let origin;
    try {
      origin = new URL(link.url.replace(PLACEHOLDER, "x")).origin;
    } catch {
      return null;
    }
    let image = document.createElement("img");
    return image.className = "site-icon", image.alt = "", image.loading = "lazy", image.referrerPolicy = "no-referrer", image.src = `${origin}/favicon.ico`, image.addEventListener("error", () => image.remove()), image;
  }
  function destinationNode(link, className, path) {
    let isRdp = link.type === "rdp", download = isRdp && rdpLaunchMode === "download", template = !isRdp && templateNames(link.url).length > 0, node = (
      /** @type {HTMLAnchorElement | HTMLButtonElement} */
      element(download || template ? "button" : "a", className, link.name)
    );
    path && (node.dataset.destination = path.join(":"));
    let icon = siteIcon(link);
    icon && node.prepend(icon);
    let button = (
      /** @type {HTMLButtonElement} */
      node
    ), anchor = (
      /** @type {HTMLAnchorElement} */
      node
    );
    return template ? (button.type = "button", node.dataset.template = "true", node.addEventListener("click", () => askForVariables(link)), node.title = `Open ${link.name} (asks for ${templateNames(link.url).join(", ")})`, node.setAttribute("aria-label", node.title)) : download ? (button.type = "button", node.addEventListener("click", () => downloadRdp(link, rdpPresets)), node.title = `Download Remote Desktop connection for ${link.name}`, node.setAttribute("aria-label", node.title)) : isRdp ? (anchor.href = rdpLaunchUrl2(link, rdpPresets), node.title = `Open Remote Desktop Connection for ${link.name}`, node.setAttribute("aria-label", node.title)) : (anchor.href = link.url, anchor.target = "_blank", anchor.rel = "noopener noreferrer", node.title = `Open ${link.name} in a new tab`, node.setAttribute("aria-label", node.title)), link.note && (node.title = `${node.title}
${link.note}`), node;
  }
  function linkNode(link, className, path) {
    let node = destinationNode(link, className, path);
    return path && (tagPath(node, path.length === 3 ? "moon" : "planet", path[0], path[1], path[2]), modes.inEditMode() && (node.title = `Drag ${link.name} to move it`, node.setAttribute("aria-label", `${link.name}. Links are paused in Edit mode.`))), node;
  }
  function orbitLines(points, center, size) {
    let svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "orbit-lines"), svg.setAttribute("viewBox", `0 0 ${size} ${size}`), svg.setAttribute("aria-hidden", "true");
    for (let point of points) {
      let line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", String(center)), line.setAttribute("y1", String(center)), line.setAttribute("x2", String(point.x)), line.setAttribute("y2", String(point.y)), svg.append(line);
    }
    return svg;
  }
  function planetNode(link, context, point, size, index, sunIndex) {
    let cluster = element("div", `planet-cluster ${context}-planet-cluster`);
    if (cluster.style.setProperty("--x", `${point.x / size * 100}%`), cluster.style.setProperty("--y", `${point.y / size * 100}%`), cluster.style.setProperty("--cos", Math.cos(point.angle).toFixed(4)), cluster.style.setProperty("--sin", Math.sin(point.angle).toFixed(4)), cluster.style.setProperty("--delay", `${index * (context === "home" ? 35 : 50)}ms`), cluster.append(linkNode(link, context === "home" ? "home-satellite" : "detail-satellite", [sunIndex, index])), link.moons.length) {
      let field = element("div", "moon-field");
      field.dataset.angle = String(point.angle), field.dataset.context = context, link.moons.slice(0, 6).forEach((moon, moonIndex) => field.append(linkNode(moon, "moon-link", [sunIndex, index, moonIndex]))), cluster.append(field), cluster.append(element("span", "moon-badge", counted(link.moons.length, "moon")));
    }
    return cluster;
  }
  function overflowPlanetNode(link, sunIndex, planetIndex) {
    let item = element("div", "overflow-planet");
    if (item.append(linkNode(link, "more-link", [sunIndex, planetIndex])), link.moons.length) {
      let moons = element("div", "overflow-moons");
      link.moons.forEach((moon, moonIndex) => moons.append(
        linkNode(moon, "overflow-moon-link", [sunIndex, planetIndex, moonIndex])
      )), item.append(moons);
    }
    return item;
  }
  function homeGroup(group, index) {
    let card = element("section", "group-card");
    card.style.setProperty("--sun-accent", safeColor(group.color)), card.style.setProperty("--card-index", String(index));
    let orbit = element("div", "home-orbit");
    orbit.dataset.sun = String(index);
    let visible = group.links.slice(0, 5), center = 160, radius = 108, points = visible.map((_, i) => {
      let angle = (-90 + 360 / visible.length * i) * Math.PI / 180;
      return { x: center + Math.cos(angle) * radius, y: center + Math.sin(angle) * radius, angle };
    });
    orbit.append(orbitLines(points, center, 320));
    let hub = element("button", "home-hub");
    return hub.type = "button", tagPath(hub, "sun", index), hub.setAttribute("aria-label", `Open ${group.team ? "team " : ""}${group.name} system with ${counted(group.links.length, "planet")}`), group.icon && hub.append(element("span", "hub-icon", group.icon)), hub.append(element("span", "hub-name", group.name)), hub.append(element("span", "hub-count", counted(group.links.length, "planet").toUpperCase())), group.team && (card.classList.add("team-card"), hub.append(element("span", "team-mark", "TEAM"))), hub.addEventListener("click", () => {
      location.hash = `group/${encodeURIComponent(group.id)}`;
    }), orbit.append(hub), visible.forEach((link, i) => orbit.append(planetNode(link, "home", points[i], 320, i, index))), card.append(orbit, descriptionNode("group-description", group.description)), card;
  }

  // src/ui/views/galaxy.js
  function quickChip(entry) {
    let node = destinationNode(entry.item, "quick-chip", entry.path);
    return node.dataset.editPath = entry.path.join(":"), node.title = `${node.title} (${entry.path.length === 3 ? "moon" : "planet"} in ${groups[entry.path[0]].name})`, node;
  }
  function routineChip(routine, index) {
    let { items } = routineItems(routine), chip = element("button", "quick-chip routine-chip", routine.name);
    return chip.type = "button", chip.title = `Open the ${routine.name} routine (${counted(items.length, "link")})`, chip.addEventListener("click", () => {
      modes.inEditMode() ? (openMenu(), openEditorPage(), showRoutineEditor(index)) : runRoutine(routine);
    }), chip;
  }
  function quickBar() {
    if (!showQuickBar) return null;
    let favorites = favoriteItems(), recent = recentItems();
    if (!favorites.length && !recent.length && !routines.length) return null;
    let bar = element("section", "quick-bar");
    bar.setAttribute("aria-label", "Routines, favorites, and recent links");
    for (
      let [label, list] of
      /** @type {[string, any[]][]} */
      [["Routines", routines], ["Favorites", favorites], ["Recent", recent]]
    ) {
      if (!list.length) continue;
      let row = element("div", "quick-row");
      row.append(element("h2", "quick-label", label));
      let chips = element("div", "quick-chips");
      if (label === "Routines" ? list.forEach((routine, index) => chips.append(routineChip(routine, index))) : list.forEach((entry) => chips.append(quickChip(entry))), label === "Favorites" && list.length > 1 && !modes.inEditMode()) {
        let all = element("button", "quick-open-all", `Open all (${list.length})`);
        all.type = "button", all.title = "Open every favorite in new tabs", all.addEventListener("click", openAllFavorites), chips.append(all);
      }
      row.append(chips), bar.append(row);
    }
    return bar;
  }
  function listLink(item, path, sun) {
    let node = destinationNode(item, "list-link", path);
    return node.dataset.editPath = path.join(":"), isFavorite(item, sun) && node.append(element("span", "list-favorite", " ★")), item.note && node.append(element("span", "list-note-text", ` — ${item.note}`)), item.tags?.length && node.append(tagChips(item.tags)), node;
  }
  function galaxyList() {
    let list = element("div", "galaxy-list");
    return modes.inEditMode() && list.append(element("p", "list-note", "Dragging works in the Orbits view. Use Edit links, or switch back to Orbits, to rearrange.")), groups.forEach((sun, sunIndex) => {
      let section = element("details", "list-sun");
      section.open = !0, section.style.setProperty("--sun-accent", safeColor(sun.color));
      let summary = element("summary", "list-sun-head");
      summary.append(element("span", "list-sun-name", `${sun.icon ? `${sun.icon} ` : ""}${sun.name}`)), summary.append(element("span", "list-count", counted(sun.links.length, "planet"))), sun.team && summary.append(element("span", "team-mark", "TEAM"));
      let open = element("a", "list-open", "Open System");
      open.href = `#group/${encodeURIComponent(sun.id)}`, summary.append(open), section.append(summary), sun.description && section.append(descriptionNode("list-description", sun.description));
      let planets = element("ul", "list-planets");
      sun.links.forEach((planet, planetIndex) => {
        let row = element("li", "list-planet");
        if (row.append(listLink(planet, [sunIndex, planetIndex], sun)), planet.moons.length) {
          let moons = element("ul", "list-moons");
          planet.moons.forEach((moon, moonIndex) => {
            let item = element("li", "list-moon");
            item.append(listLink(moon, [sunIndex, planetIndex, moonIndex], sun)), moons.append(item);
          }), row.append(moons);
        }
        planets.append(row);
      }), sun.links.length || planets.append(element("li", "list-empty", "No planets yet.")), section.append(planets), list.append(section);
    }), list;
  }
  function renderHome() {
    app.replaceChildren(), app.className = "home-view", settingsTrigger.hidden = !1, topbarSearch.hidden = !1, quickFind.value = findQuery;
    let results = element("section", "find-results");
    results.setAttribute("aria-live", "polite");
    let listView = galaxyView === "list";
    listView && app.classList.add("list-view");
    let grid = listView ? galaxyList() : element("div", "group-grid");
    listView || groups.forEach((group, index) => grid.append(homeGroup(group, index)));
    let bar = quickBar(), updateFind = () => {
      setFindQuery(quickFind.value);
      let active = !!findQuery.trim();
      grid.hidden = active;
      let currentBar = (
        /** @type {HTMLElement | null} */
        app.querySelector(":scope > .quick-bar")
      );
      if (currentBar && (currentBar.hidden = active), results.hidden = !active, !active) return;
      let matches = findMatches(groups, findQuery), address = typedAddress(findQuery);
      if (results.replaceChildren(element("p", "find-summary", `${matches.length} result${matches.length === 1 ? "" : "s"} for “${findQuery.trim()}”`)), address && results.append(quickAddResult(address)), matches.length) {
        let list = element("div", "find-list");
        matches.forEach((match) => list.append(findRow(match))), results.append(list);
      } else address || results.append(element("p", "find-empty", "No matching suns, planets, or moons. Try another name, an address, or #tag."));
    };
    if (quickFind.oninput = updateFind, app.append(results), bar && app.append(bar), !groups.length) {
      let empty = element("section", "empty-galaxy");
      empty.append(element("h1", "", `${workspaceName()} is empty`)), empty.append(element("p", "", "Add a sun in Edit links, paste a web address into Quick find, or import a map or a link pack."));
      let open = element("button", "editor-primary", "Open Edit links");
      open.type = "button", open.addEventListener("click", () => {
        openMenu(), openEditorPage();
      }), empty.append(open), app.append(empty);
    }
    app.append(grid), updateFind();
  }

  // src/ui/views/system.js
  function openAllActions(group, sunIndex) {
    if (modes.inEditMode()) return null;
    let planets = group.links.map((planet, planetIndex) => ({ planet, planetIndex })).filter(({ planet }) => planet.moons.length);
    if (!planets.length) return null;
    let row = element("div", "open-all-row");
    return row.append(element("span", "open-all-label", "Open a planet with all its moons:")), planets.forEach(({ planet, planetIndex }) => {
      let button = element("button", "open-all-button", `${planet.name} + ${counted(planet.moons.length, "moon")}`);
      button.type = "button", button.title = `Open ${planet.name} and its moons in new tabs (Shift+click a planet does the same)`, button.addEventListener("click", () => openAll(sunIndex, planetIndex)), row.append(button);
    }), row;
  }
  function renderDetail(group) {
    app.replaceChildren(), app.className = "detail-view", settingsTrigger.hidden = !1, topbarSearch.hidden = !1, quickFind.value = findQuery, quickFind.oninput = () => {
      setFindQuery(quickFind.value), location.hash = "";
    };
    let top = element("div", "detail-top"), back = element("a", "back-link", "←  Return to Galaxy");
    back.href = "#", top.append(back, element("span", "detail-index", `${String(groups.indexOf(group) + 1).padStart(2, "0")} / ${String(groups.length).padStart(2, "0")}`));
    let heading = element("div", "detail-heading");
    heading.append(element("p", "eyebrow", "EXPLORE THIS SYSTEM")), heading.append(element("h1", "", group.name)), heading.append(descriptionNode("intro-copy", group.description));
    let stage = element("div", "detail-stage");
    stage.style.setProperty("--sun-accent", safeColor(group.color));
    let visible = group.links.slice(0, 8), center = 320, radius = 205, points = visible.map((_, i) => {
      let angle = (-90 + 360 / visible.length * i) * Math.PI / 180;
      return { x: center + Math.cos(angle) * radius, y: center + Math.sin(angle) * radius, angle };
    });
    stage.append(orbitLines(points, center, 640));
    let sunIndex = groups.indexOf(group);
    stage.dataset.sun = String(sunIndex);
    let hub = tagPath(element("div", "detail-hub"), "sun", sunIndex);
    group.icon && hub.append(element("span", "hub-icon", group.icon)), hub.append(element("span", "detail-hub-name", group.name)), hub.append(element("span", "detail-hub-sub", counted(group.links.length, "planet"))), group.team && hub.append(element("span", "team-mark", "TEAM")), stage.append(hub), visible.forEach((link, i) => stage.append(planetNode(link, "detail", points[i], 640, i, sunIndex)));
    let note = element("p", "detail-note", modes.inEditMode() ? "Edit mode is on. Drag a planet or moon to move or reorder it; links stay closed until you turn Edit mode off." : group.links.some((link) => link.type === "rdp") ? rdpLaunchMode === "client" ? "Select a lab to open Remote Desktop Connection with its target loaded. Your browser may ask to open the helper." : "Select a lab to download its Remote Desktop connection file. Open the file on Windows to connect." : "Select a planet to open its destination in a new tab.");
    app.append(top, heading, stage, note);
    let openAllRow = openAllActions(group, sunIndex);
    if (openAllRow && app.append(openAllRow), group.links.length > visible.length) {
      let more = element("section", "more-links");
      more.append(element("h2", "", "More planets in this system"));
      let list = element("div", "more-grid");
      group.links.slice(visible.length).forEach((link, i) => list.append(overflowPlanetNode(link, sunIndex, visible.length + i))), more.append(list), app.append(more);
    }
    let extraMoons = group.links.filter((link) => link.moons.length > 6);
    if (extraMoons.length) {
      let section = element("section", "moon-overflow");
      section.append(element("h2", "", "More moons")), extraMoons.forEach((planet) => {
        let planetIndex = group.links.indexOf(planet), row = element("div", "moon-overflow-row");
        row.append(element("h3", "", `Around ${planet.name}`));
        let links = element("div", "moon-overflow-links");
        planet.moons.slice(6).forEach((moon, i) => links.append(
          linkNode(moon, "overflow-moon-link", [sunIndex, planetIndex, 6 + i])
        )), row.append(links), section.append(row);
      }), app.append(section);
    }
  }

  // src/ui/views/render.js
  function render() {
    modes.send("render"), updateMapLabelSizes();
    let route = decodeURIComponent(location.hash.slice(1)), id = route.startsWith("group/") ? route.slice(6) : null, group = groups.find((item) => item.id === id);
    modes.send(group ? "openSystem" : "toGalaxy"), group ? renderDetail(group) : renderHome(), layoutOrbits(), editToggle.hidden = !1, updateEditBar(), window.scrollTo({ top: 0, behavior: "instant" });
  }

  // src/ui/find/palette.js
  var palette = (
    /** @type {any} */
    null
  ), paletteOpener = null;
  function paletteCommands() {
    return [
      { label: modes.inEditMode() ? "Turn off Edit mode" : "Turn on Edit mode", run: () => setEditMode(!modes.inEditMode()) },
      { label: "Open Settings", run: () => {
        openMenu(), showMenuPanel("Settings");
      } },
      { label: "Edit links", run: () => {
        openMenu(), openEditorPage();
      } },
      { label: "Help", run: () => {
        openMenu(), showMenuPanel("Help");
      } },
      {
        label: galaxyView === "list" ? "Show the Galaxy as orbits" : "Show the Galaxy as a list",
        run: () => setGalaxyView(galaxyView === "list" ? "orbits" : "list")
      },
      { label: "Return to Galaxy", run: () => {
        location.hash = "";
      } },
      { label: "Clear recent links", run: () => {
        clearRecent(), render();
      } },
      ...favoriteItems().length > 1 && !modes.inEditMode() ? [{ label: "Open all favorites", run: openAllFavorites }] : [],
      ...routines.map((routine, index) => ({
        label: `Run routine: ${routine.name}`,
        run: () => modes.inEditMode() ? (openMenu(), openEditorPage(), showRoutineEditor(index)) : runRoutine(routine)
      })),
      { label: "Edit routines", run: () => {
        openMenu(), openEditorPage(), showRoutines();
      } },
      { label: "Add a link", run: () => showQuickAdd("") },
      ...loadWorkspaces().filter((item) => item.id !== activeWorkspace).map((item) => ({
        label: `Switch to workspace: ${item.name}`,
        run: () => switchWorkspace(item.id)
      }))
    ];
  }
  function runMatch(match) {
    match.id ? location.hash = `group/${encodeURIComponent(match.id)}` : modes.linkOpensEditor("palette") ? openEditorAt(match.indices) : openDestination(match.destination);
  }
  function paletteEntries(query) {
    let words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean), commands = paletteCommands().filter((command) => words.every((word) => command.label.toLocaleLowerCase().includes(word))), matches = query.trim() ? findMatches(groups, query).slice(0, 40) : [], entries = commands.map((command) => ({ kind: "Command", label: command.label, run: command.run })), address = typedAddress(query);
    address && entries.unshift({ kind: "Command", label: `Add ${address}`, run: () => showQuickAdd(address) });
    for (
      let match of
      /** @type {any[]} */
      matches
    )
      if (entries.push({ kind: match.kind, label: match.name, detail: match.why || match.path, match, run: () => runMatch(match) }), match.kind === "Planet" && !modes.inEditMode()) {
        let planet = match.destination;
        planet.moons.length && entries.push({
          kind: "Command",
          label: `Open all: ${planet.name} + ${counted(planet.moons.length, "moon")}`,
          detail: match.path,
          run: () => openAll(match.indices[0], match.indices[1])
        });
      }
    return entries;
  }
  function openPalette() {
    paletteOpener = document.activeElement instanceof HTMLElement ? document.activeElement : null, modes.send("openPalette");
  }
  function paletteOpened() {
    let opener = paletteOpener;
    paletteOpener = null;
    let overlay = element("div", "palette-overlay"), scrim = element("div", "palette-scrim"), dialog = element("section", "palette");
    dialog.setAttribute("role", "dialog"), dialog.setAttribute("aria-modal", "true"), dialog.setAttribute("aria-label", "Command palette");
    let input = element("input", "palette-input");
    input.type = "text", input.placeholder = "Search links and commands", input.setAttribute("role", "combobox"), input.setAttribute("aria-expanded", "true"), input.setAttribute("aria-controls", "palette-list"), input.setAttribute("aria-autocomplete", "list"), input.setAttribute("aria-label", "Search links and commands"), input.autocomplete = "off";
    let list = element("ul", "palette-list");
    list.id = "palette-list", list.setAttribute("role", "listbox");
    let status = element("p", "palette-status");
    status.setAttribute("role", "status");
    let hint = element("p", "palette-hint", "↑ ↓ to move · Enter to open · Esc to close");
    dialog.append(input, list, status, hint), overlay.append(scrim, dialog), document.body.append(overlay), palette = { overlay, input, list, status, opener, entries: [], active: 0 }, scrim.addEventListener("click", closePalette), input.addEventListener("input", updatePalette), updatePalette(), input.focus();
  }
  function closePalette() {
    modes.overlayIs("palette") && modes.send("closeOverlay");
  }
  function paletteClosed() {
    let { overlay, opener } = palette;
    palette = /** @type {any} */
    null, overlay.remove(), opener && document.contains(opener) && opener.focus();
  }
  function updatePalette() {
    palette.entries = paletteEntries(palette.input.value), palette.active = 0, palette.list.replaceChildren(), palette.entries.forEach((entry, index) => {
      let option = element("li", "palette-option");
      option.id = `palette-option-${index}`, option.setAttribute("role", "option"), option.append(element("span", "palette-kind", entry.kind));
      let copy = element("span", "palette-copy");
      copy.append(element("strong", "", entry.label)), entry.detail && copy.append(element("small", "", entry.detail)), entry.match?.tags?.length && copy.append(tagChips(entry.match.tags)), option.append(copy), option.addEventListener("mousemove", () => setPaletteActive(index)), option.addEventListener("click", () => runPaletteEntry(index)), palette.list.append(option);
    }), palette.status.textContent = palette.entries.length ? `${counted(palette.entries.length, "result")}.` : "No matching links or commands.", setPaletteActive(0);
  }
  function setPaletteActive(index) {
    let options = palette.list.children;
    if (!options.length) {
      palette.input.removeAttribute("aria-activedescendant");
      return;
    }
    palette.active = Math.max(0, Math.min(index, options.length - 1)), [...options].forEach((option, i) => option.setAttribute("aria-selected", String(i === palette.active)));
    let active = options[palette.active];
    palette.input.setAttribute("aria-activedescendant", active.id), active.scrollIntoView({ block: "nearest" });
  }
  function runPaletteEntry(index) {
    if (!modes.overlayIs("palette")) return;
    let entry = palette.entries[index];
    entry && (modes.send("runEntry"), entry.run());
  }
  function handlePaletteKey(event) {
    if (!modes.overlayIs("palette")) return !1;
    let moves = { ArrowDown: 1, ArrowUp: -1, PageDown: 8, PageUp: -8 };
    if (event.key === "Escape")
      event.preventDefault(), closePalette();
    else if (event.key in moves)
      event.preventDefault(), setPaletteActive(palette.active + moves[event.key]);
    else if (event.key === "Home" && event.ctrlKey)
      event.preventDefault(), setPaletteActive(0);
    else if (event.key === "End" && event.ctrlKey)
      event.preventDefault(), setPaletteActive(palette.entries.length - 1);
    else if (event.key === "Enter")
      event.preventDefault(), runPaletteEntry(palette.active);
    else if (event.key === "Tab")
      event.preventDefault();
    else
      return !1;
    return !0;
  }
  function handlePaletteShortcut(event) {
    return event.key.toLowerCase() !== "k" || !(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey || !modes.keyAllowed("commandK") ? !1 : (event.preventDefault(), openPalette(), !0);
  }

  // src/core/bookmarks.js
  var bookmarks_exports = {};
  __export(bookmarks_exports, {
    BOOKMARK_BARS: () => BOOKMARK_BARS,
    BOOKMARK_LIMIT: () => BOOKMARK_LIMIT,
    bookmarksToMap: () => bookmarksToMap
  });
  var BOOKMARK_LIMIT = 2e3, BOOKMARK_BARS = /^(bookmarks bar|bookmarks toolbar|favorites bar|favourites bar|other bookmarks|other favorites|mobile bookmarks)$/i;
  function flattenFolder(folder) {
    return [...folder.links, ...folder.folders.flatMap(flattenFolder)];
  }
  function bookmarksToMap(root) {
    let stats = { links: 0, skipped: 0, truncated: !1 }, destination = (link) => {
      if (stats.links >= BOOKMARK_LIMIT)
        return stats.truncated = !0, null;
      try {
        let url = new URL(link.url);
        if (!["http:", "https:"].includes(url.protocol)) throw new Error("not web");
        let item = validDestination({ name: link.name || url.hostname, url: link.url }, "Bookmark");
        return stats.links++, item;
      } catch {
        return stats.skipped++, null;
      }
    }, tops = [];
    for (let folder of root.folders)
      BOOKMARK_BARS.test(folder.name) ? (tops.push(...folder.folders), folder.links.length && tops.push({ name: folder.name, links: folder.links, folders: [] })) : tops.push(folder);
    root.links.length && tops.push({ name: "Bookmarks", links: [...root.links], folders: [] });
    let suns = tops.map((folder) => {
      let links = folder.links.map(destination).filter(Boolean).map((item) => ({ ...item, moons: [] }));
      for (let sub of folder.folders) {
        let items = (
          /** @type {any[]} */
          flattenFolder(sub).map(destination).filter(Boolean)
        );
        items.length && links.push({ name: sub.name, url: items[0].url, moons: items.slice(1) });
      }
      return { name: folder.name, description: "Imported from browser bookmarks", links };
    }).filter((sun) => sun.links.length);
    return { map: validateMap({ groups: suns }), stats };
  }

  // src/state/backup.js
  var backup_exports = {};
  __export(backup_exports, {
    countChange: () => countChange,
    forgetWorkspace: () => forgetWorkspace,
    noteBackupMade: () => noteBackupMade,
    readBackupState: () => readBackupState,
    writeBackupState: () => writeBackupState
  });
  function readBackupState() {
    let value = readJson(KEYS.backup, {});
    return value && typeof value == "object" ? value : {};
  }
  function writeBackupState(state) {
    writeSafely(KEYS.backup, JSON.stringify(state));
  }
  function countChange(workspace, now2 = Date.now()) {
    let state = readBackupState(), entry = state[workspace] || {};
    entry.changes = (entry.changes || 0) + 1, entry.since = entry.since || entry.lastExport || now2, state[workspace] = entry, writeBackupState(state);
  }
  function noteBackupMade(workspace, now2 = Date.now()) {
    let state = readBackupState();
    state[workspace] = { changes: 0, lastExport: now2 }, writeBackupState(state);
  }
  function forgetWorkspace(workspace) {
    let state = readBackupState();
    delete state[workspace], writeBackupState(state);
  }

  // src/state/prefs.js
  var prefs_exports = {};
  __export(prefs_exports, {
    hiddenTeamSuns: () => hiddenTeamSuns,
    markOffered: () => markOffered,
    readBoolean: () => readBoolean,
    readFontSize: () => readFontSize,
    readGalaxyView: () => readGalaxyView,
    readOffered: () => readOffered,
    readRdpLaunch: () => readRdpLaunch,
    readStoredSet: () => readStoredSet,
    readTeamSeen: () => readTeamSeen,
    readTheme: () => readTheme,
    readVariables: () => readVariables,
    rememberTeam: () => rememberTeam,
    savePreference: () => savePreference,
    saveVariables: () => saveVariables,
    writeStoredSet: () => writeStoredSet
  });
  function readBoolean(key, fallback) {
    let value = readSafely(key);
    return value === null ? fallback : value === "true";
  }
  function savePreference(key, value) {
    writeSafely(key, String(value));
  }
  function readChoice(key, allowed, fallback) {
    let value = (
      /** @type {T} */
      readSafely(key)
    );
    return allowed.includes(value) ? value : fallback;
  }
  var readTheme = () => readChoice("orbit:theme", ["default", "alabama", "auburn"], "default"), readFontSize = () => readChoice("orbit:font-size", ["small", "standard", "large", "extra"], "standard"), readGalaxyView = () => readSafely("orbit:galaxy-view") === "list" ? "list" : "orbits", readRdpLaunch = () => readSafely("orbit:rdp-launch") === "client" ? "client" : "download";
  function readStoredSet(key) {
    let list = readJson(key, []);
    return new Set(Array.isArray(list) ? list.map(String) : []);
  }
  function writeStoredSet(key, set) {
    writeSafely(key, JSON.stringify([...set]));
  }
  var hiddenTeamSuns = () => readStoredSet(KEYS.teamHidden);
  function readObject(key) {
    let value = readJson(key, {});
    return value && typeof value == "object" ? value : {};
  }
  var readVariables = () => readObject(KEYS.variables);
  function saveVariables(values) {
    writeSafely(KEYS.variables, JSON.stringify({ ...readVariables(), ...values }));
  }
  var readOffered = () => readObject(KEYS.routineOffered);
  function markOffered(id, day) {
    let offered = readOffered();
    offered[id] = day, writeSafely(KEYS.routineOffered, JSON.stringify(offered));
  }
  function readTeamSeen() {
    let value = readJson(KEYS.teamSeen, null);
    return Array.isArray(value) ? value : null;
  }
  function rememberTeam(entries) {
    writeSafely(KEYS.teamSeen, JSON.stringify(entries.map(({ key, name }) => ({ key, name }))));
  }

  // src/state/store.js
  function createStore() {
    let state = {
      groups: [],
      routines: [],
      rdpPresets: [],
      revision: 0,
      workspace: MAIN,
      source: "bundled",
      warning: "",
      seed: null,
      team: []
    }, subscribers = /* @__PURE__ */ new Set(), set = (changes) => {
      state = Object.freeze({ ...state, ...changes });
    }, notify = (kind) => {
      for (let subscriber of [...subscribers]) subscriber(state, kind);
    }, key = (base) => workspaceKey(base, state.workspace), visibleTeam = () => {
      let hidden = hiddenTeamSuns();
      return state.team.filter((sun) => !hidden.has(sun.id));
    };
    function loadBrowserMap() {
      try {
        let text = read(key(KEYS.map));
        return text ? validateMap(JSON.parse(text)) : null;
      } catch (error) {
        return set({ warning: `Saved browser data could not be loaded: ${/** @type {Error} */
        error.message}` }), null;
      }
    }
    let store2 = {
      /** @returns {Readonly<StoreState>} */
      state: () => state,
      /**
       * @param {Subscriber} subscriber
       * @returns {() => void} Unsubscribes.
       */
      subscribe(subscriber) {
        return subscribers.add(subscriber), () => {
          subscribers.delete(subscriber);
        };
      },
      /**
       * Load the active workspace at start-up. `seed` is the validated project
       * data; `team` the team suns (ids with `team:`, `team: true`).
       * @param {{seed: MapData, team?: Sun[]}} input
       */
      start({ seed, team = [] }) {
        set({ seed, team, workspace: readActiveWorkspace(), warning: "" });
        let browserMap = loadBrowserMap(), map = browserMap || (state.workspace === MAIN ? seed : { groups: [] });
        set({
          groups: [...visibleTeam(), ...map.groups],
          routines: map.routines || [],
          rdpPresets: map.rdpPresets || [],
          source: browserMap ? "browser" : "bundled"
        }), notify("start");
      },
      /**
       * Save a map (team suns may be included; they're never stored or changed).
       * Routines and presets are kept unless `data` replaces them. The previous
       * version goes into history under `label` unless it's false or nothing
       * changed. Throws, with nothing changed, if the map is invalid or can't be
       * written.
       * @param {{groups: Sun[], routines?: Routine[], rdpPresets?: RdpPreset[]}} data
       * @param {string|false} [label]
       * @param {SaveOptions} [options]
       */
      saveMap(data, label = "Change", options = {}) {
        if (options.expectRevision !== void 0 && options.expectRevision !== state.revision)
          throw new Error("The link map changed, so nothing was saved.");
        let undoKey = key(KEYS.undo), previousUndo;
        try {
          options.undoRecord && (previousUndo = read(undoKey), write(undoKey, JSON.stringify(options.undoRecord)));
          let normalized = validateMap({
            groups: personalGroups(data.groups),
            routines: data.routines !== void 0 ? data.routines : state.routines,
            rdpPresets: data.rdpPresets !== void 0 ? data.rdpPresets : state.rdpPresets
          }), previous = personalGroups(state.groups);
          write(key(KEYS.map), JSON.stringify(normalized));
          let changed = JSON.stringify([previous, state.routines, state.rdpPresets]) !== JSON.stringify([normalized.groups, normalized.routines || [], normalized.rdpPresets || []]);
          label !== !1 && changed && recordHistory(key(KEYS.history), previous, label, state.routines, state.rdpPresets), changed && countChange(state.workspace), set({
            groups: [...visibleTeam(), ...normalized.groups],
            routines: normalized.routines || [],
            rdpPresets: normalized.rdpPresets || [],
            revision: state.revision + 1,
            source: "browser"
          });
        } catch (error) {
          if (options.undoRecord)
            try {
              previousUndo === null ? remove(undoKey) : previousUndo !== void 0 && write(undoKey, previousUndo);
            } catch {
            }
          throw error;
        }
        if (options.clearUndo)
          try {
            remove(undoKey);
          } catch {
          }
        notify("save");
      },
      /** Forget the load warning (after a successful edit, as 2.2.1's editor does). */
      clearWarning() {
        set({ warning: "" });
      },
      /**
       * Replace the map with the project's link data. In Main the saved map is
       * removed, so Main follows the project files again; elsewhere the file data
       * is saved under the workspace's key (2.2.1, check F27). History keeps the
       * map as it was; the removal undo is cleared.
       */
      resetToBundled() {
        let fileData = validateMap(state.seed);
        recordHistory(key(KEYS.history), personalGroups(state.groups), "Reset to file data", state.routines, state.rdpPresets), state.workspace === MAIN ? remove(key(KEYS.map)) : write(key(KEYS.map), JSON.stringify(fileData)), remove(key(KEYS.undo)), set({
          groups: [...visibleTeam(), ...fileData.groups],
          routines: fileData.routines || [],
          rdpPresets: fileData.rdpPresets || [],
          revision: state.revision + 1,
          source: state.workspace === MAIN ? "bundled" : "browser",
          warning: ""
        }), notify("reset");
      },
      /** The workspace's last removal, if it can be undone. @returns {UndoRecord|null} */
      loadUndoRecord() {
        try {
          let saved = readSafely(key(KEYS.undo));
          if (!saved) return null;
          let record = JSON.parse(saved);
          return record && ["sun", "planet", "moon"].includes(record.kind) && Number.isInteger(record.index) && record.index >= 0 && record.item ? record : null;
        } catch {
          return null;
        }
      },
      /**
       * Put the last removed sun, planet, or moon back. Returns false when there
       * is nothing to undo; throws when it can't be put back.
       */
      undoRemoval() {
        let record = store2.loadUndoRecord();
        if (!record) return !1;
        let next = JSON.parse(JSON.stringify(state.groups));
        if (record.kind === "sun")
          next.some((sun) => sun.id === record.item.id) && (record.item.id = uniqueSunId(record.item.name, new Set(next.map((sun) => sun.id)))), next.splice(Math.min(record.index, next.length), 0, record.item);
        else {
          let sun = next.find((item) => item.id === record.sunId);
          if (!sun) throw new Error("The parent sun no longer exists.");
          if (record.kind === "planet")
            sun.links.splice(Math.min(record.index, sun.links.length), 0, record.item);
          else {
            let planet = sun.links.find((planet2) => (
              /** @type {any} */
              planet2.url === record.planetUrl && /** @type {any} */
              planet2.host === record.planetHost && planet2.name === record.planetName
            )) || sun.links[
              /** @type {number} */
              record.planetIndex
            ];
            if (!planet) throw new Error("The parent planet no longer exists.");
            planet.moons.splice(Math.min(record.index, planet.moons.length), 0, record.item);
          }
        }
        return store2.saveMap({ groups: next }, `Undid removal of ${record.label}`, { clearUndo: !0 }), !0;
      },
      /**
       * Hide or show a team sun. Stored as a shared preference; the revision goes up.
       * @param {string} id With its `team:` prefix.
       * @param {boolean} hidden
       */
      setTeamSunHidden(id, hidden) {
        let ids = hiddenTeamSuns();
        hidden ? ids.add(id) : ids.delete(id), writeStoredSet(KEYS.teamHidden, ids), set({ groups: [...visibleTeam(), ...personalGroups(state.groups)], revision: state.revision + 1 }), notify("team");
      },
      /**
       * Open another workspace. Returns false if it doesn't exist. Never touches
       * another workspace's keys.
       * @param {string} id
       */
      switchWorkspace(id) {
        if (!loadWorkspaces2().some((item) => item.id === id)) return !1;
        set({ workspace: id, warning: "" }), saveActiveWorkspace(id);
        let browserMap = loadBrowserMap(), map = browserMap || (id === MAIN ? state.seed || { groups: [] } : { groups: [] });
        return set({
          groups: [...visibleTeam(), ...map.groups],
          routines: map.routines || [],
          rdpPresets: map.rdpPresets || [],
          source: browserMap ? "browser" : id === MAIN ? "bundled" : "browser",
          revision: state.revision + 1
        }), notify("switch"), !0;
      },
      /**
       * Add a workspace and save its first map: 'empty', 'copy' (of this
       * workspace), or 'bundled'. Doesn't switch to it. Returns its id.
       * @param {unknown} name
       * @param {'empty'|'copy'|'bundled'|string} start
       */
      addWorkspace(name, start) {
        let added = newWorkspace(name), map = start === "copy" ? { groups: personalGroups(state.groups), routines: state.routines, rdpPresets: state.rdpPresets } : start === "bundled" ? state.seed : { groups: [] };
        return write(workspaceKey(KEYS.map, added.id), JSON.stringify(validateMap(map))), saveWorkspaces([...loadWorkspaces2(), added]), added.id;
      },
      /**
       * Remove a workspace (never Main): its map, undo, and history keys, and its
       * backup entry. Returns true if it was the open one; the caller then
       * switches to Main.
       * @param {string} id
       */
      removeWorkspace(id) {
        if (id === MAIN) return !1;
        for (let base of WORKSPACE_KEYS) remove(workspaceKey(base, id));
        return forgetWorkspace(id), saveWorkspaces(loadWorkspaces2().filter((item) => item.id !== id)), state.workspace === id;
      },
      /**
       * Where a combined index points: a team sun or a personal one.
       * @param {number} index
       * @returns {{team: boolean, index: number}}
       */
      locate(index) {
        let teamCount = state.groups.filter((sun) => sun.team).length;
        return index < teamCount ? { team: !0, index } : { team: !1, index: index - teamCount };
      },
      /**
       * The combined index of a team or personal sun.
       * @param {{team: boolean, index: number}} place
       */
      combinedIndex(place) {
        return place.team ? place.index : place.index + state.groups.filter((sun) => sun.team).length;
      }
    };
    return store2;
  }

  // src/ui/views/clicks.js
  function trackDestinationClicks(event) {
    if (event.type === "auxclick" && event.button !== 1) return;
    let node = event.target instanceof Element ? (
      /** @type {HTMLElement | null} */
      event.target.closest("[data-destination]")
    ) : null;
    if (!node || event.defaultPrevented || node.dataset.template) return;
    let path = (
      /** @type {string} */
      node.dataset.destination.split(":").map(Number)
    );
    noteOpened(itemAt(groups, path));
  }
  function installClicks() {
    document.addEventListener("click", trackDestinationClicks), document.addEventListener("auxclick", trackDestinationClicks), document.addEventListener("click", (event) => {
      if (!event.shiftKey || modes.inEditMode() || !(event.target instanceof Element)) return;
      let node = (
        /** @type {HTMLElement | null} */
        event.target.closest('[data-kind="planet"]')
      );
      !node || !app.contains(node) || (event.preventDefault(), event.stopPropagation(), openAll(Number(node.dataset.sun), Number(node.dataset.planet)));
    }, !0);
  }

  // src/services/link-check.js
  var link_check_exports = {};
  __export(link_check_exports, {
    BATCH_SIZE: () => BATCH_SIZE,
    checkLinks: () => checkLinks
  });
  var BATCH_SIZE = 50;
  async function checkLinks(urls, { onProgress = () => {
  }, fetch = (url, init) => globalThis.fetch(url, init) } = {}) {
    let answers = {};
    for (let index = 0; index < urls.length; index += 50) {
      onProgress(index, urls.length);
      let response = await fetch("./api/check-links", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Orbit-Check": "1" },
        body: JSON.stringify({ urls: urls.slice(index, index + 50) })
      });
      if (response.status === 404 || response.status === 501)
        throw new Error("This server cannot check links. Start Orbit with python3 serve.py from this version.");
      if (!response.ok) throw new Error(`The server answered HTTP ${response.status}.`);
      Object.assign(answers, await response.json());
    }
    return answers;
  }

  // src/services/opener.js
  var opener_exports = {};
  __export(opener_exports, {
    openDestination: () => openDestination2,
    openLinks: () => openLinks,
    openPlan: () => openPlan,
    openTab: () => openTab,
    planLinks: () => planLinks
  });
  function openTab(url) {
    let opened = (
      /** @type {any} */
      globalThis.open(url, "_blank")
    );
    return opened && (opened.opener = null), !!opened;
  }
  function openDestination2(item, { presets, launchMode }) {
    return item.type === "rdp" ? (launchRdp(item, presets, launchMode), "rdp") : templateNames(item.url).length ? "ask" : openTab(item.url) ? "opened" : "blocked";
  }
  function planLinks(items, label, { question = null, extra = "", values = readVariables() } = {}) {
    let filled = (item) => item.type !== "rdp" && templateNames(item.url).every((name) => values[name]), all = items.filter((item) => item.type !== "rdp"), web = all.filter(filled).map((item) => ({ item, url: fillTemplate(
      /** @type {any} */
      item.url,
      values
    ) })), skipped = items.length - all.length, unfilled = all.length - web.length, note = `${skipped ? ` ${counted(skipped, "Remote Desktop link")} left out.` : ""}${unfilled ? ` ${counted(unfilled, "link")} with {placeholders} left out until you open ${unfilled === 1 ? "it" : "them"} once.` : ""}${extra}`;
    return {
      web,
      note,
      label,
      question: question ? question(web.length) : `Open ${web.length} tabs for ${label}?`,
      empty: web.length ? null : `${label} has no website links to open.${note}`
    };
  }
  function openPlan(plan, onOpened = () => {
  }) {
    let blocked = 0;
    for (let { item, url } of plan.web)
      openTab(url) ? onOpened(item) : blocked++;
    let message = blocked ? `Your browser blocked ${counted(blocked, "tab")}. Allow pop-ups for Orbit in the browser's address bar, then try again.${plan.note}` : `Opened ${counted(plan.web.length, "tab")} for ${plan.label}.${plan.note}`;
    return { opened: plan.web.length - blocked, blocked, message, isError: blocked > 0 };
  }
  function openLinks(items, label, { confirm = !0, question = null, extra = "", ask, onOpened }) {
    let plan = planLinks(items, label, { question, extra });
    if (plan.empty !== null) return { message: plan.empty, isError: !1 };
    if (confirm && plan.web.length > 1 && !ask(plan.question)) return null;
    let { message, isError } = openPlan(plan, onOpened);
    return { message, isError };
  }

  // src/services/schedule.js
  var schedule_exports = {};
  __export(schedule_exports, {
    BACKUP_CHANGES: () => BACKUP_CHANGES,
    BACKUP_DAYS: () => BACKUP_DAYS,
    DAY_MS: () => DAY_MS,
    SNOOZE_MS: () => SNOOZE_MS,
    backupDue: () => backupDue,
    dueRoutines: () => dueRoutines,
    localDay: () => localDay,
    now: () => now,
    setNow: () => setNow,
    teamChanges: () => teamChanges,
    teamEntries: () => teamEntries,
    today: () => today
  });
  var BACKUP_CHANGES = 20, BACKUP_DAYS = 14, DAY_MS = 1440 * 60 * 1e3, SNOOZE_MS = 3 * DAY_MS, fixedNow = null, now = () => fixedNow === null ? Date.now() : fixedNow, today = () => new Date(now());
  function setNow(ms) {
    fixedNow = ms == null ? null : Number(ms);
  }
  function localDay(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }
  function dueRoutines(routines2, offered, date = today()) {
    let time = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
    return routines2.filter((routine) => routine.schedule && routine.schedule.days.includes(date.getDay()) && routine.schedule.time <= time && offered[routine.id] !== localDay(date));
  }
  function backupDue(entry, enabled, time = now()) {
    if (!enabled || !entry?.changes || entry.snoozeUntil && time < entry.snoozeUntil) return null;
    let days = Math.floor((time - (entry.since || time)) / DAY_MS);
    return entry.changes >= BACKUP_CHANGES || days >= BACKUP_DAYS ? { changes: entry.changes, days } : null;
  }
  function teamEntries(teamGroups) {
    return teamGroups.flatMap((sun) => sun.links.flatMap((planet) => [
      { key: destinationKey(planet), name: planet.name, path: sun.name },
      ...planet.moons.map((moon) => ({ key: destinationKey(moon), name: moon.name, path: `${sun.name} → ${planet.name}` }))
    ]));
  }
  function teamChanges(seen, current) {
    if (!Array.isArray(seen)) return { first: !0 };
    let seenKeys = new Set(seen.map((entry) => entry.key)), currentKeys = new Set(current.map((entry) => entry.key));
    return {
      first: !1,
      added: current.filter((entry) => !seenKeys.has(entry.key)),
      removed: seen.filter((entry) => !currentKeys.has(entry.key))
    };
  }

  // src/services/sources.js
  var sources_exports = {};
  __export(sources_exports, {
    loadBundledMap: () => loadBundledMap,
    loadTeamMap: () => loadTeamMap,
    pageEnv: () => pageEnv
  });
  function pageEnv() {
    let page = (
      /** @type {any} */
      globalThis
    );
    return {
      protocol: page.location.protocol,
      fetch: (url, init) => page.fetch(url, init),
      bundledData: page.ORBIT_DATA,
      teamData: page.ORBIT_TEAM_DATA
    };
  }
  async function loadBundledMap(env = pageEnv()) {
    let data;
    if (env.protocol === "file:")
      data = env.bundledData;
    else {
      let response = await env.fetch("./links.json", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      data = await response.json();
    }
    if (!data) throw new Error("Run `python3 sync.py` to generate links-data.js.");
    return validateMap(data);
  }
  async function fetchTeamData(env) {
    if (env.protocol !== "file:")
      try {
        let response = await env.fetch("./team.json", { cache: "no-store" });
        if (response.ok) return { data: await response.json(), source: "team.json from serve.py --team" };
        if (response.status !== 404) throw new Error(`HTTP ${response.status}`);
      } catch (error) {
        if (!env.teamData) throw error;
      }
    return env.teamData ? { data: env.teamData, source: "team-data.js" } : null;
  }
  async function loadTeamMap(env = pageEnv()) {
    try {
      let loaded = await fetchTeamData(env);
      return loaded ? { groups: validateMap(loaded.data).groups.map((sun) => ({ ...sun, id: `team:${sun.id}`, team: !0 })), source: loaded.source, error: "" } : { groups: [], source: "", error: "" };
    } catch (error) {
      return { groups: [], source: "", error: `The team map could not be loaded: ${/** @type {Error} */
      error.message}` };
    }
  }

  // src/app/main.js
  var store = createStore();
  publishBridge({
    version: APP_VERSION,
    core: Object.freeze({ ...templates_exports, ...destination_exports, ...search_exports, ...rdp_exports, ...schema_exports, ...map_ops_exports, ...bookmarks_exports, ...words_exports }),
    store,
    modes,
    state: Object.freeze({ storage: storage_exports, workspaces: workspaces_exports, prefs: prefs_exports, history: history_exports, backup: backup_exports }),
    services: Object.freeze({ sources: sources_exports, opener: opener_exports, rdpLaunch: rdp_launch_exports, linkCheck: link_check_exports, fileIo: file_io_exports, schedule: schedule_exports })
  });
  publishPageGlobals({
    element,
    counted,
    tagPath,
    tagChips,
    descriptionNode,
    siteIcon,
    destinationNode,
    quickBar,
    render,
    layoutOrbits,
    fitOrbitSizes,
    addressText,
    /** @param {string} query */
    findMatches: (query) => findMatches(groups, query),
    openPalette,
    closePalette,
    paletteOpened,
    paletteClosed,
    handlePaletteKey,
    handlePaletteShortcut
  });
  installLayout();
  installClicks();
})();
