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
  function pathsForKey(groups, key) {
    let paths = [];
    return groups.forEach((sun, sunIndex) => sun.links.forEach((planet, planetIndex) => {
      destinationKey(planet) === key && paths.push([sunIndex, planetIndex]), planet.moons.forEach((moon, moonIndex) => {
        destinationKey(moon) === key && paths.push([sunIndex, planetIndex, moonIndex]);
      });
    })), paths;
  }
  function itemAt(groups, path) {
    let planet = groups[
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
    }), routines = validRoutines(data.routines), rdpPresets = validRdpPresets(data.rdpPresets), presetIds = new Set(rdpPresets.map((preset) => preset.id));
    for (let sun of normalized)
      for (let item of sun.links.flatMap((planet) => [planet, ...planet.moons]))
        item.type === "rdp" && item.rdpPreset && !presetIds.has(item.rdpPreset) && delete item.rdpPreset;
    let map = { groups: normalized };
    return routines.length && (map.routines = routines), rdpPresets.length && (map.rdpPresets = rdpPresets), map;
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
    loadWorkspaces: () => loadWorkspaces,
    newWorkspace: () => newWorkspace,
    readActiveWorkspace: () => readActiveWorkspace,
    renameWorkspace: () => renameWorkspace,
    saveActiveWorkspace: () => saveActiveWorkspace,
    saveWorkspaces: () => saveWorkspaces,
    workspaceKey: () => workspaceKey,
    workspaceName: () => workspaceName
  });
  var MAIN = "main", WORKSPACE_KEYS = Object.freeze([KEYS.map, KEYS.undo, KEYS.history]);
  function loadWorkspaces() {
    let list = readJson(KEYS.workspaces, []), valid = Array.isArray(list) ? list.filter((item) => item && typeof item.id == "string" && item.name) : [];
    return valid.some((item) => item.id === MAIN) ? valid : [{ id: MAIN, name: "Main" }, ...valid];
  }
  function saveWorkspaces(list) {
    write(KEYS.workspaces, JSON.stringify(list));
  }
  function readActiveWorkspace() {
    let id = readSafely(KEYS.activeWorkspace);
    return id && loadWorkspaces().some((item) => item.id === id) ? id : MAIN;
  }
  function saveActiveWorkspace(id) {
    writeSafely(KEYS.activeWorkspace, String(id));
  }
  function workspaceKey(base, id) {
    return id === MAIN ? base : `${base}:${id}`;
  }
  function workspaceName(id) {
    return loadWorkspaces().find((item) => item.id === id)?.name || "Main";
  }
  function newWorkspace(name) {
    let list = loadWorkspaces(), clean = String(name || "").trim();
    if (!clean || clean.length > 40) throw new Error("A workspace needs a name of up to 40 characters.");
    if (list.some((item) => item.name.toLocaleLowerCase() === clean.toLocaleLowerCase()))
      throw new Error(`There is already a workspace named ${clean}.`);
    return { id: uniqueSunId(clean, new Set(list.map((item) => item.id))), name: clean };
  }
  function renameWorkspace(id, name) {
    let clean = String(name || "").trim(), list = loadWorkspaces();
    if (!clean || clean.length > 40) throw new Error("A workspace needs a name of up to 40 characters.");
    if (list.some((item) => item.id !== id && item.name.toLocaleLowerCase() === clean.toLocaleLowerCase()))
      throw new Error(`There is already a workspace named ${clean}.`);
    saveWorkspaces(list.map((item) => item.id === id ? { ...item, name: clean } : item));
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
  function searchEntries(groups) {
    let entries = [], fields = (name, path, item) => {
      let list = [{ kind: "name", text: name.toLocaleLowerCase(), weight: 1, anywhere: !0 }];
      return path && list.push({ kind: "path", text: path.toLocaleLowerCase(), weight: 0.7 }), item && (list.push({ kind: "address", text: addressText(item).toLocaleLowerCase(), weight: 0.6 }), item.tags?.length && list.push({ kind: "tag", text: item.tags.join(" "), weight: 0.8 }), item.note && list.push({ kind: "note", text: item.note.toLocaleLowerCase(), weight: 0.5 })), list.map((field) => ({ ...field, words: searchWords(field.text) }));
    };
    return groups.forEach((sun, sunIndex) => {
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
  function findMatches(groups, query) {
    let raw = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean), tagFilters = raw.flatMap((word) => {
      let tag = /^#(.+)$/.exec(word) || /^tag:(.+)$/.exec(word);
      return tag ? [tag[1]] : [];
    }), tokens = raw.filter((word) => !/^#.+$/.test(word) && !/^tag:.+$/.test(word));
    if (!tokens.length && !tagFilters.length) return [];
    let entries = searchEntries(groups).filter((entry) => tagFilters.every((tag) => entry.tags.includes(tag))), strictHits = new Set(tokens.filter((token) => entries.some((entry) => entry.fields.some((field) => wordQuality(token, field.text, field.words || [], !1, field.anywhere))))), scored = [];
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
        if (!loadWorkspaces().some((item) => item.id === id)) return !1;
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
        return write(workspaceKey(KEYS.map, added.id), JSON.stringify(validateMap(map))), saveWorkspaces([...loadWorkspaces(), added]), added.id;
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
        return forgetWorkspace(id), saveWorkspaces(loadWorkspaces().filter((item) => item.id !== id)), state.workspace === id;
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
    openDestination: () => openDestination,
    openLinks: () => openLinks,
    openPlan: () => openPlan,
    openTab: () => openTab,
    planLinks: () => planLinks
  });

  // src/services/rdp-launch.js
  var rdp_launch_exports = {};
  __export(rdp_launch_exports, {
    downloadRdp: () => downloadRdp,
    launchRdp: () => launchRdp
  });
  function downloadRdp(destination, presets) {
    downloadText(rdpFileContent(destination, presets), rdpFileName(destination), "application/x-rdp");
  }
  function launchRdp(destination, presets, mode) {
    mode === "download" ? downloadRdp(destination, presets) : globalThis.location.href = rdpLaunchUrl2(destination, presets);
  }

  // src/services/opener.js
  function openTab(url) {
    let opened = (
      /** @type {any} */
      globalThis.open(url, "_blank")
    );
    return opened && (opened.opener = null), !!opened;
  }
  function openDestination(item, { presets, launchMode }) {
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
  function dueRoutines(routines, offered, date = today()) {
    let time = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
    return routines.filter((routine) => routine.schedule && routine.schedule.days.includes(date.getDay()) && routine.schedule.time <= time && offered[routine.id] !== localDay(date));
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
    state: Object.freeze({ storage: storage_exports, workspaces: workspaces_exports, prefs: prefs_exports, history: history_exports, backup: backup_exports }),
    services: Object.freeze({ sources: sources_exports, opener: opener_exports, rdpLaunch: rdp_launch_exports, linkCheck: link_check_exports, fileIo: file_io_exports, schedule: schedule_exports })
  });
})();
