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

  // src/app/main.js
  publishBridge({
    version: APP_VERSION,
    core: Object.freeze({ ...templates_exports, ...destination_exports, ...search_exports, ...rdp_exports, ...schema_exports, ...map_ops_exports, ...bookmarks_exports })
  });
})();
