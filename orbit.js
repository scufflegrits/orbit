// Orbit. Built by scripts/build.mjs from src/; edit src/, not this file.

"use strict";
(() => {
  // src/app/version.js
  var APP_VERSION = "3.0.3";

  // src/core/destination.js
  function isGroup(item) {
    return item?.type === "group";
  }
  function destinationKey(item) {
    if (isGroup(item)) return null;
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
      !isGroup(planet) && destinationKey(planet) === key && paths.push([sunIndex, planetIndex]), planet.moons.forEach((moon, moonIndex) => {
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

  // src/core/words.js
  function counted(amount, word, plural = `${word}s`) {
    return `${amount} ${amount === 1 ? word : plural}`;
  }

  // src/core/templates.js
  var PLACEHOLDER = /\{([A-Za-z0-9_-]{1,30})\}/g;
  function templateNames(url) {
    return [...new Set([...String(url || "").matchAll(PLACEHOLDER)].map((match) => String(match[1])))];
  }
  function fillTemplate(url, values) {
    return url.replace(PLACEHOLDER, (_, name) => encodeURIComponent(values[name] ?? ""));
  }

  // src/core/rdp.js
  var SETTING = /^([^:]+):([sib]):(.*)$/i, SETTING_NAME = /^[a-z0-9 _.-]+$/i, SECRET = /(?:password|passwd|token|secret|signature|signscope)/i;
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
  function effectiveRdpProfile(destination, presets = []) {
    let preset = destination.rdpPreset ? presets.find((item) => item.id === destination.rdpPreset) : null;
    return preset ? `full address:s:${destination.host}\r
${preset.settings ? `${preset.settings}\r
` : ""}` : destination.rdpProfile || null;
  }
  function rdpFileContent(destination, presets = []) {
    return effectiveRdpProfile(destination, presets) || `full address:s:${destination.host}\r
prompt for credentials:i:1\r
`;
  }
  function rdpFileName(destination) {
    return `${destination.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "remote-desktop"}.rdp`;
  }
  function rdpLaunchUrl(destination, presets = []) {
    let profileText = effectiveRdpProfile(destination, presets);
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
    if (isGroup(value)) throw new Error(`${label} can't be a group; only a planet can.`);
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
  function validPlanet(value, label) {
    let planet = isGroup(value) ? validGroup(value, label) : validDestination(value, label);
    if (value.moons !== void 0 && !Array.isArray(value.moons))
      throw new Error(`${planet.name} needs a moons array.`);
    let moons = (value.moons || []).map((moon, index) => validDestination(moon, `Moon ${index + 1} around ${planet.name}`));
    return { ...planet, moons };
  }
  function validGroup(value, label) {
    let name = String(value.name || "").trim();
    if (!name) throw new Error(`${label} needs a name.`);
    let { tags, note } = destinationExtras(value, label);
    return { name, type: (
      /** @type {const} */
      "group"
    ), ...tags ? { tags } : {}, ...note ? { note } : {} };
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
      let links = group.links.map((link, linkIndex) => validPlanet(link, `Planet ${linkIndex + 1} in ${name}`)), icon = validSunIcon(group.icon, name);
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

  // src/services/sources.js
  function pageEnv() {
    let page = (
      /** @type {any} */
      globalThis
    );
    return {
      protocol: page.location.protocol,
      fetch: (url, init2) => page.fetch(url, init2),
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
        let key = destinationKey(sourcePlanet), planet = isGroup(sourcePlanet) ? sun.links.find((item) => isGroup(item) && item.name.toLocaleLowerCase() === sourcePlanet.name.toLocaleLowerCase()) : sun.links.find((item) => destinationKey(item) === key);
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
  function sunAdditions(personal, incoming) {
    return incoming.map((source) => {
      let { added } = mergeMaps(personal, [source]);
      return { isNew: added.suns === 1, planets: added.planets, moons: added.moons };
    });
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
      let entries = planet.moons.map((moon, moonIndex) => (
        /** @type {[Destination, number[]]} */
        [moon, [sunIndex, planetIndex, moonIndex]]
      ));
      isGroup(planet) || entries.unshift([planet, [sunIndex, planetIndex]]);
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

  // src/state/storage.js
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
  var MIGRATIONS = [{ version: 1, up() {
  } }], STORAGE_VERSION_KEY = "orbit:storage-version";
  function migrate() {
    let current = Number(readSafely(STORAGE_VERSION_KEY) || 0), applied = [];
    for (let migration of MIGRATIONS)
      migration.version <= current || (migration.up(), write(STORAGE_VERSION_KEY, String(migration.version)), applied.push(migration.version));
    return applied;
  }

  // src/state/workspaces.js
  var MAIN = "main", UNREADABLE = "unreadable", WORKSPACE_KEYS = Object.freeze([KEYS.map, KEYS.undo, KEYS.history]);
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
    return { id: uniqueSunId(clean, /* @__PURE__ */ new Set([UNREADABLE, ...list.map((item) => item.id)])), name: clean };
  }
  function renameWorkspace(id, name) {
    let clean = String(name || "").trim(), list = loadWorkspaces();
    if (!clean || clean.length > 40) throw new Error("A workspace needs a name of up to 40 characters.");
    if (list.some((item) => item.id !== id && item.name.toLocaleLowerCase() === clean.toLocaleLowerCase()))
      throw new Error(`There is already a workspace named ${clean}.`);
    saveWorkspaces(list.map((item) => item.id === id ? { ...item, name: clean } : item));
  }

  // src/state/prefs.js
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
  var readButtonTips = () => readChoice("orbit:button-tips", ["normal", "slow", "off"], "normal"), readTheme = () => readChoice("orbit:theme", ["default", "alabama", "auburn"], "default"), readFontSize = () => readChoice("orbit:font-size", ["small", "standard", "large", "extra"], "standard"), readGalaxyView = () => readSafely("orbit:galaxy-view") === "list" ? "list" : "orbits", readRdpLaunch = () => readSafely("orbit:rdp-launch") === "client" ? "client" : "download";
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
  function offeredIn(workspace) {
    let all = readOffered();
    if (workspace === MAIN) return all;
    let suffix = `:${workspace}`;
    return Object.fromEntries(Object.entries(all).filter(([key]) => key.endsWith(suffix)).map(([key, day]) => [key.slice(0, -suffix.length), day]));
  }
  function markOffered(id, day, workspace = MAIN) {
    let offered2 = readOffered();
    offered2[workspaceKey(id, workspace)] = day, writeSafely(KEYS.routineOffered, JSON.stringify(offered2));
  }
  function forgetOffered(workspace) {
    let suffix = `:${workspace}`, offered2 = readOffered(), kept = Object.fromEntries(Object.entries(offered2).filter(([key]) => !key.endsWith(suffix)));
    Object.keys(kept).length !== Object.keys(offered2).length && writeSafely(KEYS.routineOffered, JSON.stringify(kept));
  }
  function readTeamSeen() {
    let value = readJson(KEYS.teamSeen, null);
    return Array.isArray(value) ? value : null;
  }
  function rememberTeam(entries) {
    writeSafely(KEYS.teamSeen, JSON.stringify(entries.map(({ key, name }) => ({ key, name }))));
  }
  var RECENT_LIMIT = 10;
  function readRecent() {
    let list = readJson(KEYS.recent, []);
    return Array.isArray(list) ? list.filter((entry) => entry && typeof entry.key == "string") : [];
  }
  function recordRecent(key, name, time) {
    let list = [{ key, name, time }, ...readRecent().filter((entry) => entry.key !== key)];
    writeSafely(KEYS.recent, JSON.stringify(list.slice(0, RECENT_LIMIT)));
  }
  function clearRecent() {
    try {
      remove(KEYS.recent);
    } catch {
    }
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

  // src/state/backup.js
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
        return text === null ? null : validateMap(JSON.parse(text));
      } catch (error) {
        return set({ warning: `Saved browser data could not be loaded: ${/** @type {Error} */
        error.message}` }), null;
      }
    }
    function backupUnreadableMap(mapKey) {
      let text = read(mapKey);
      if (text !== null)
        try {
          validateMap(JSON.parse(text));
        } catch {
          let suffix = mapKey === KEYS.map && loadWorkspaces().some((item) => item.id === UNREADABLE) ? `:${UNREADABLE}` : UNREADABLE;
          write(`${mapKey}:${suffix}`, text);
        }
    }
    function writeMap(mapKey, map) {
      backupUnreadableMap(mapKey), map.groups.some((sun) => sun.links.some(isGroup)) && migrate(), write(mapKey, JSON.stringify(map));
    }
    let store7 = {
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
      start({ seed, team: team2 = [] }) {
        set({ seed, team: team2, workspace: readActiveWorkspace(), warning: "" });
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
          writeMap(key(KEYS.map), normalized);
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
        state.workspace === MAIN ? (backupUnreadableMap(key(KEYS.map)), remove(key(KEYS.map))) : writeMap(key(KEYS.map), fileData), recordHistory(key(KEYS.history), personalGroups(state.groups), "Reset to file data", state.routines, state.rdpPresets), remove(key(KEYS.undo)), set({
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
        let record = store7.loadUndoRecord();
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
        return store7.saveMap({ groups: next }, `Undid removal of ${record.label}`, { clearUndo: !0 }), !0;
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
      addWorkspace(name, start2) {
        let added = newWorkspace(name), map = start2 === "copy" ? { groups: personalGroups(state.groups), routines: state.routines, rdpPresets: state.rdpPresets } : start2 === "bundled" ? state.seed : { groups: [] };
        return writeMap(workspaceKey(KEYS.map, added.id), validateMap(map)), saveWorkspaces([...loadWorkspaces(), added]), added.id;
      },
      /**
       * Remove a workspace (never Main): its map, undo, and history keys, its
       * backup entry, and its routine offer marks. Returns true if it was the open one; the caller then
       * switches to Main.
       * @param {string} id
       */
      removeWorkspace(id) {
        if (id === MAIN) return !1;
        for (let base of WORKSPACE_KEYS) remove(workspaceKey(base, id));
        return forgetWorkspace(id), forgetOffered(id), saveWorkspaces(loadWorkspaces().filter((item) => item.id !== id)), state.workspace === id;
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
    return store7;
  }

  // src/state/page-store.js
  var store = createStore();
  function activeWorkspace() {
    return store.state().seed ? store.state().workspace : readActiveWorkspace();
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

  // src/services/file-io.js
  function downloadText(text, filename, type) {
    let page = (
      /** @type {any} */
      globalThis
    ), blob = new Blob([text], { type }), url = page.URL.createObjectURL(blob), anchor2 = page.document.createElement("a");
    anchor2.href = url, anchor2.download = filename, page.document.body.append(anchor2), anchor2.click(), anchor2.remove(), setTimeout(() => page.URL.revokeObjectURL(url), 1e3);
  }
  var jsonSink = null;
  function downloadJson(data, filename) {
    if (jsonSink) return jsonSink(data);
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
  async function readImportFile(file) {
    let text = await file.text();
    try {
      return { text, data: JSON.parse(text) };
    } catch {
      return { text, data: void 0 };
    }
  }
  async function readRdpText(file) {
    if (file.size > 64e3) throw new Error("The .rdp file is too large to import.");
    return decodeRdpBytes(new Uint8Array(await file.arrayBuffer()));
  }
  function readBookmarkFolder(list, name) {
    let folder = { name, links: [], folders: [] };
    for (let entry of list.querySelectorAll(":scope > dt, :scope > p > dt")) {
      let heading = entry.querySelector(":scope > h3"), anchor2 = entry.querySelector(":scope > a");
      if (heading) {
        let sub = entry.querySelector(":scope > dl") || (entry.nextElementSibling?.tagName === "DL" ? entry.nextElementSibling : null);
        sub && folder.folders.push(readBookmarkFolder(sub, heading.textContent?.trim() || "Folder"));
      } else anchor2 && folder.links.push({ name: anchor2.textContent?.trim() ?? "", url: anchor2.getAttribute("href") || "" });
    }
    return folder;
  }
  function readBookmarksHtml(text) {
    let list = new /** @type {any} */
    globalThis.DOMParser().parseFromString(text, "text/html").querySelector("dl");
    if (!list) throw new Error("This is not a bookmarks file. Export bookmarks from your browser as HTML.");
    return readBookmarkFolder(list, "Bookmarks");
  }

  // src/ui/hooks.js
  var hooks = {
    /** Redraw the page (ui/views/render.js). */
    render: () => {
    },
    /** Redraw only the Galaxy's quick bar (ui/views/galaxy.js). */
    refreshQuickBar: () => {
    },
    /** Open the menu (ui/menu/menu.js). */
    openMenu: () => {
    },
    /** Show a menu panel (ui/menu/menu.js). @type {(name: string) => void} */
    showMenuPanel: () => {
    },
    /** Export the personal map as JSON (ui/editor/screens.js). */
    exportMap: () => {
    }
  };

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
  function createModeStore(start2) {
    let state = initialModes(start2), listeners = [], queue = [], reporting = !1;
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

  // src/ui/page.js
  var APP_VERSION2 = "";
  function setVersion(version) {
    APP_VERSION2 = version;
  }
  var app = (
    /** @type {HTMLElement} */
    /** @type {unknown} */
    null
  ), quickFind = (
    /** @type {HTMLInputElement} */
    /** @type {unknown} */
    null
  ), settingsTrigger = (
    /** @type {HTMLElement} */
    /** @type {unknown} */
    null
  ), topbarSearch = (
    /** @type {HTMLElement} */
    /** @type {unknown} */
    null
  ), menuOverlay = (
    /** @type {HTMLElement} */
    /** @type {unknown} */
    null
  ), menuRoot = (
    /** @type {HTMLElement} */
    /** @type {unknown} */
    null
  ), viewToggle = (
    /** @type {HTMLElement} */
    /** @type {unknown} */
    null
  ), linkCount = (
    /** @type {HTMLElement} */
    /** @type {unknown} */
    null
  ), menuContent = (
    /** @type {HTMLElement} */
    /** @type {unknown} */
    null
  );
  function setMenuContent(node) {
    menuContent = node;
  }
  var find = (selector) => (
    /** @type {HTMLElement} */
    document.querySelector(selector)
  );
  function findPageElements() {
    app = find("#app"), linkCount = find("#link-count"), settingsTrigger = find("#settings-trigger"), topbarSearch = find("#topbar-search"), quickFind = /** @type {HTMLInputElement} */
    find("#quick-find"), menuOverlay = find("#menu-overlay"), menuRoot = find("#menu-content"), viewToggle = find("#view-toggle"), menuContent = menuRoot;
  }
  var groups = [], routines = [], rdpPresets = [], storageWarning = "", activeMapSource = "bundled";
  function showStoreState(state) {
    groups = state.groups, routines = state.routines, rdpPresets = state.rdpPresets, activeMapSource = state.source, storageWarning = state.warning;
  }
  function setStorageWarning(text) {
    storageWarning = text;
  }
  function dataSourceLabel() {
    return activeMapSource === "browser" ? "Browser edits" : "Bundled project data";
  }
  var animationsEnabled = !0, alwaysShowMoons = !1, buttonTips = "normal", showEditButtons = !0, activeTheme = "default", activeFontSize = "standard", rdpLaunchMode = "download", showQuickBar = !0, showSiteIcons = !1, galaxyView = "orbits";
  function readPreferences() {
    animationsEnabled = readBoolean("orbit:animations", !0), alwaysShowMoons = readBoolean("orbit:always-show-moons", !1), activeTheme = readTheme(), buttonTips = readButtonTips(), showEditButtons = readBoolean("orbit:edit-buttons", !0), activeFontSize = readFontSize(), rdpLaunchMode = readRdpLaunch(), showQuickBar = readBoolean("orbit:quick-bar", !0), showSiteIcons = readBoolean("orbit:site-icons", !1), galaxyView = readGalaxyView();
    let root = document.documentElement.dataset;
    root.animations = animationsEnabled ? "on" : "off", root.moons = alwaysShowMoons ? "always" : "hover", root.theme = activeTheme, root.fontSize = activeFontSize;
  }
  function setAnimationsEnabled(on) {
    animationsEnabled = on;
  }
  function setAlwaysShowMoons(on) {
    alwaysShowMoons = on;
  }
  function setButtonTips(value) {
    buttonTips = value === "slow" || value === "off" ? value : "normal", savePreference("orbit:button-tips", buttonTips);
  }
  function setShowEditButtons(on) {
    showEditButtons = on, savePreference("orbit:edit-buttons", on);
  }
  function setActiveTheme(theme) {
    activeTheme = theme;
  }
  function setActiveFontSize(size) {
    activeFontSize = size;
  }
  function setRdpLaunchMode(mode) {
    rdpLaunchMode = mode;
  }
  function setShowQuickBar(on) {
    showQuickBar = on;
  }
  function setShowSiteIcons(on) {
    showSiteIcons = on;
  }
  function updateViewToggle() {
    let list = galaxyView === "list";
    viewToggle.setAttribute("aria-pressed", String(list)), viewToggle.title = list ? "Show the Galaxy as orbits" : "Show the Galaxy as a list", viewToggle.setAttribute("aria-label", viewToggle.title), viewToggle.textContent = list ? "◎" : "☰";
  }
  function setGalaxyView(view) {
    galaxyView = view === "list" ? "list" : "orbits", savePreference("orbit:galaxy-view", galaxyView), updateViewToggle(), location.hash && location.hash !== "#" ? location.hash = "" : hooks.render();
  }
  var findQuery = "";
  function setFindQuery(text) {
    findQuery = text, modes.send(text ? "type" : "clearFind");
  }

  // src/ui/tooltip.js
  var nextDescription = 0, tooltip, anchor = null, timer = 0;
  function tip(node, text) {
    let description = element("span", "", text);
    return description.id = `orbit-tip-description-${++nextDescription}`, description.hidden = !0, node.append(description), node.dataset.tip = description.id, node.setAttribute("aria-describedby", description.id), node;
  }
  function buttonTipsDelay() {
    return buttonTips === "off" ? null : buttonTips === "slow" ? 1500 : 800;
  }
  function hideTooltip() {
    window.clearTimeout(timer);
    let wasVisible = !!(tooltip && !tooltip.hidden);
    return anchor && wasVisible && (anchor.setAttribute(
      "aria-describedby",
      /** @type {string} */
      anchor.dataset.tip
    ), tooltip.hidden = !0), anchor = null, wasVisible;
  }
  function canShow(node) {
    return node.isConnected && !modes.holding() && !modes.overlayIs("placeholder") && !modes.overlayIs("palette") && (!modes.menuOpen() || menuOverlay.contains(node));
  }
  function scheduleTip(node) {
    if (anchor === node) return;
    hideTooltip();
    let delay = buttonTipsDelay();
    delay === null || !canShow(node) || (anchor = node, timer = window.setTimeout(() => {
      if (!canShow(node) || !node.getClientRects().length) return void hideTooltip();
      tooltip.textContent = document.getElementById(node.dataset.tip || "")?.textContent || "", tooltip.hidden = !1;
      let box = node.getBoundingClientRect(), { offsetWidth: width, offsetHeight: height } = tooltip, { clientWidth, clientHeight } = document.documentElement, left = box.left + (box.width - width) / 2, above = box.top - height - 8;
      tooltip.style.left = `${Math.max(8, Math.min(left, clientWidth - width - 8))}px`, tooltip.style.top = `${Math.max(8, Math.min(above >= 8 ? above : box.bottom + 8, clientHeight - height - 8))}px`, node.setAttribute("aria-describedby", tooltip.id);
    }, delay));
  }
  function tippedElement(target) {
    return target instanceof Element ? (
      /** @type {HTMLElement | null} */
      target.closest("[data-tip]")
    ) : null;
  }
  function installTooltip() {
    tooltip = element("div", "tooltip"), tooltip.id = "orbit-tooltip", tooltip.setAttribute("role", "tooltip"), tooltip.hidden = !0, document.body.append(tooltip), document.addEventListener("pointerover", (event) => {
      let node = tippedElement(event.target);
      event.pointerType !== "touch" && node && node !== tippedElement(event.relatedTarget) && scheduleTip(node);
    }), document.addEventListener("pointerout", (event) => {
      anchor && anchor === tippedElement(event.target) && anchor !== tippedElement(event.relatedTarget) && hideTooltip();
    }), document.addEventListener("focusin", (event) => {
      let node = tippedElement(event.target);
      node?.matches(":focus-visible") && scheduleTip(node);
    }), document.addEventListener("focusout", (event) => {
      anchor && anchor === tippedElement(event.target) && hideTooltip();
    }), document.addEventListener("pointerdown", hideTooltip, !0), document.addEventListener("click", hideTooltip, !0), window.addEventListener("scroll", (event) => {
      anchor && (event.target === document || event.target instanceof Element && event.target.contains(anchor)) && hideTooltip();
    }, !0), window.addEventListener("resize", hideTooltip), modes.subscribe(() => {
      anchor && !canShow(anchor) && hideTooltip();
    }), new MutationObserver(() => {
      anchor && !anchor.isConnected && hideTooltip();
    }).observe(document.body, { childList: !0, subtree: !0 });
  }

  // src/ui/dialogs/confirm.js
  function confirmed(question) {
    return (
      /** @type {any} */
      globalThis.confirm(question)
    );
  }

  // src/ui/remove-item.js
  var CONFIRM_DELETE_KEY = "orbit:confirm-before-delete";
  function removeMapItem(path) {
    let [sunIndex, planetIndex, moonIndex] = path, { groups: groups2, revision } = store.state(), sun = groups2[sunIndex], planet = sun?.links[planetIndex], kind = path.length === 1 ? "sun" : path.length === 2 ? "planet" : "moon", item = kind === "sun" ? sun : kind === "planet" ? planet : planet?.moons[moonIndex];
    if (!item || sun.team) return !1;
    if (readBoolean(CONFIRM_DELETE_KEY, !0)) {
      let contents = "";
      if (kind === "sun" && sun.links.length) {
        let moons = sun.links.reduce((total, link) => total + link.moons.length, 0);
        contents = ` and its ${counted(sun.links.length, "planet")}${moons ? ` and ${counted(moons, "moon")}` : ""}`;
      } else kind === "planet" && planet.moons.length && (contents = ` and its ${counted(planet.moons.length, isGroup(planet) ? "link" : "moon")}`);
      if (!confirmed(`Remove ${item.name}${contents}?`)) return !1;
    }
    let next = JSON.parse(JSON.stringify(groups2)), undoRecord = {
      kind,
      item,
      label: `${item.name} ${kind}`,
      sunId: sun.id,
      index: path[path.length - 1]
    };
    if (kind === "sun" ? next.splice(sunIndex, 1) : kind === "planet" ? next[sunIndex].links.splice(planetIndex, 1) : (undoRecord.planetIndex = planetIndex, undoRecord.planetName = planet.name, "url" in planet && (undoRecord.planetUrl = planet.url), "host" in planet && (undoRecord.planetHost = planet.host), next[sunIndex].links[planetIndex].moons.splice(moonIndex, 1)), store.saveMap({ groups: next }, `Removed ${kind} ${item.name}`, { undoRecord, expectRevision: revision }), store.clearWarning(), setStorageWarning(""), kind === "sun" && location.hash === `#group/${encodeURIComponent(sun.id)}`) {
      let url = new URL(location.href);
      url.hash = "", history.replaceState(history.state, "", url);
    }
    return !0;
  }

  // src/ui/editor/nav.js
  var nav = {
    /** @type {() => void} */
    showSunList: () => {
    },
    /** @type {(index: number | null) => void} */
    showSunEditor: () => {
    },
    /** @type {(sunIndex: number, planetIndex: number | null) => void} */
    showPlanetEditor: () => {
    },
    /** @type {(sunIndex: number, planetIndex: number, moonIndex: number | null) => void} */
    showMoonEditor: () => {
    },
    /** @type {(data: any, options?: any) => void} */
    showImportReview: () => {
    },
    /** @type {() => void} */
    renderEditorTree: () => {
    }
  };

  // src/ui/editor/kit.js
  var editorTree = null;
  function setEditorTree(tree) {
    editorTree = tree;
  }
  var linkCheckResults = /* @__PURE__ */ new Map();
  function editorButton(label, action, className = "editor-button") {
    let button = element("button", className, label);
    return button.type = "button", button.addEventListener("click", action), button;
  }
  function editorIcon(glyph) {
    let icon = element("span", "editor-icon", glyph);
    return icon.setAttribute("aria-hidden", "true"), icon;
  }
  function editorIconButton(label, glyph, action, className = "editor-button", description = label) {
    let button = editorButton("", action, `${className} editor-icon-button`);
    return button.append(editorIcon(glyph)), button.setAttribute("aria-label", label), tip(button, description);
  }
  function itemMoveMenu({ kind, index, count, reorder, move }) {
    let choices = element("details", "editor-move-menu"), label = `Move ${kind}`, trigger = element("summary", "editor-button editor-icon-button");
    trigger.setAttribute("role", "button"), trigger.setAttribute("aria-label", label), trigger.append(editorIcon("↕")), tip(trigger, label);
    let panel = element("div", "editor-move-choices");
    return editorMoveControls(panel, index, count, reorder), panel.append(editorButton(kind === "planet" ? "Move to another sun" : "Move to another planet", move)), choices.append(trigger, panel), choices.addEventListener("focusout", (event) => {
      let next = event.relatedTarget;
      (!(next instanceof Node) || !choices.contains(next)) && (choices.open = !1);
    }), choices.addEventListener("keydown", (event) => {
      event.key !== "Escape" || !choices.open || (event.preventDefault(), !hideTooltip() && (choices.open = !1, trigger.focus()));
    }), choices;
  }
  function attachItemToolbar(header, form, label, options) {
    form.id = "item-editor-form";
    let actions = element("div", "editor-item-actions");
    actions.setAttribute("role", "group"), actions.setAttribute("aria-label", "Item actions");
    let save = element("button", "editor-primary editor-save-button", label);
    if (save.type = "submit", save.setAttribute("form", form.id), options && save.prepend(editorIcon("💾")), actions.append(save), options) {
      let { kind, item, extra, remove: remove2 } = options;
      actions.append(editorIconButton(`Export ${kind}`, "⤓", () => exportItem(kind, item)), itemMoveMenu(options)), extra && actions.append(editorIconButton(extra.label, extra.glyph, extra.action)), actions.append(editorIconButton(`Remove ${kind}`, "🗑︎", remove2, "editor-danger editor-item-remove"));
    }
    header.classList.add("editor-header-sticky"), header.append(actions), menuContent.scrollTop = 0;
  }
  function editorField(label, value, type = "text") {
    let wrapper = element("label", "editor-field");
    wrapper.append(element("span", "", label));
    let input = (
      /** @type {HTMLInputElement} */
      type === "textarea" ? document.createElement("textarea") : document.createElement("input")
    );
    return type !== "textarea" && (input.type = type), input.value = value, wrapper.append(input), { wrapper, input };
  }
  function editorError(message) {
    let previous = menuContent.querySelector(".editor-error");
    previous && previous.remove();
    let error = element("p", "editor-error", message), stickyHeader = menuContent.querySelector(".editor-header-sticky");
    stickyHeader ? (stickyHeader.after(error), menuContent.scrollTop = 0) : menuContent.prepend(error);
  }
  var directEditorPath = null, restoreFocus = null;
  function rememberEditorOrigin(indices, restore) {
    directEditorPath = indices.join(":"), restoreFocus = restore;
  }
  function restoreEditorOrigin() {
    let restore = restoreFocus;
    return restoreFocus = null, directEditorPath = null, restore?.() ?? !1;
  }
  function editorHeader(title, back, path) {
    let direct = directEditorPath !== null && path?.join(":") === directEditorPath;
    direct || (directEditorPath = null), menuContent.replaceChildren();
    let header = element("div", "editor-header");
    header.append(editorButton("← Back", direct ? () => modes.send("closeOverlay") : back, "editor-back")), header.append(element("h3", "", title)), menuContent.append(header);
    let undo = store.loadUndoRecord();
    if (undo) {
      let notice = element("div", "editor-undo");
      notice.append(element("span", "", `Last removed: ${undo.label}`)), notice.append(editorButton("Undo removal", undoRemoval)), menuContent.append(notice);
    }
    return header;
  }
  function copyGroups() {
    return JSON.parse(JSON.stringify(groups));
  }
  function applyEditorChange(nextGroups, showNext, options = {}) {
    try {
      store.saveMap(
        {
          groups: nextGroups,
          ...options.routines !== void 0 ? { routines: options.routines } : {},
          ...options.rdpPresets !== void 0 ? { rdpPresets: options.rdpPresets } : {}
        },
        options.label || "Edit links change",
        { undoRecord: options.undoRecord, clearUndo: options.clearUndo }
      ), store.clearWarning(), setStorageWarning(""), showNext(), nav.renderEditorTree();
    } catch (error) {
      editorError(
        /** @type {any} */
        error.message
      );
    }
  }
  function moveEntry(items, index, amount) {
    let target = index + amount;
    return target < 0 || target >= items.length ? !1 : ([items[index], items[target]] = [items[target], items[index]], !0);
  }
  function editorMoveControls(actions, index, count, onMove) {
    let up = editorButton("Move up", () => onMove(-1));
    up.disabled = index === 0;
    let down = editorButton("Move down", () => onMove(1));
    down.disabled = index === count - 1, actions.append(up, element("span", "editor-position", `${index + 1} of ${count}`), down);
  }
  function editorActions() {
    let actions = element("div", "editor-actions");
    return menuContent.append(actions), actions;
  }
  function selectJsonFile(onData) {
    pickFile(".json,application/json", async (file) => {
      try {
        onData(await readJsonFile(file));
      } catch (error) {
        editorError(`Import failed: ${/** @type {any} */
        error.message}`);
      }
    });
  }
  function exportItem(kind, item) {
    let slug = item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || kind;
    downloadJson(itemExport(kind, item), `orbit-${kind}-${slug}.json`);
  }
  function editorExportRow(kind, item, summary, actionLabel, open) {
    let row = element("div", "editor-list-row editor-export-row"), actions = element("div", "editor-row-actions");
    return actions.append(
      editorIconButton(actionLabel, actionLabel === "Edit" ? "✎" : "👁︎", open, "editor-button", `${actionLabel} ${item.name}`),
      editorIconButton(`Export ${item.name}`, "⤓", () => exportItem(kind, item))
    ), row.append(element("span", "", summary), actions), row;
  }
  function pathLabel(path) {
    let sun = groups[path[0]], planet = sun?.links[path[1]];
    return planet ? path.length === 3 ? `${sun.name} → ${planet.name} → ${planet.moons[path[2]]?.name}` : `${sun.name} → ${planet.name}` : "";
  }
  function duplicateNote(item, path) {
    if (!item?.name) return null;
    let key = destinationKey(item);
    if (key === null) return null;
    let others = pathsForKey(groups, key).filter((other) => other.join(":") !== path.join(":"));
    if (!others.length) return null;
    let where = others.slice(0, 3).map((other) => pathLabel(other)).join("; ");
    return element("p", "editor-note", `Also in ${where}${others.length > 3 ? `, and ${others.length - 3} more` : ""}. This is fine for a deliberate copy.`);
  }
  function moveTargetField(options) {
    let field = element("label", "editor-field");
    field.append(element("span", "", "Move to"));
    let select = document.createElement("select");
    return select.setAttribute("aria-label", "Move to"), options.forEach(([value, label]) => {
      let option = element("option", "", label);
      option.value = value, select.append(option);
    }), field.append(select), menuContent.append(field), select;
  }
  function movePositionField(targetSelect, siblingNames) {
    let field = element("label", "editor-field");
    field.append(element("span", "", "Position"));
    let select = document.createElement("select");
    select.setAttribute("aria-label", "Position");
    let refresh = () => {
      select.replaceChildren();
      let end = element("option", "", "At the end");
      end.value = "end", select.append(end), siblingNames(targetSelect.value).forEach((name, index) => {
        let option = element("option", "", `Before ${name}`);
        option.value = index, select.append(option);
      });
    };
    return targetSelect.addEventListener("change", refresh), refresh(), field.append(select), menuContent.append(field), select;
  }
  function profileRows(text) {
    return text.split(/\r\n|\n|\r/).filter(Boolean);
  }
  function editPath(path) {
    path.length === 3 ? nav.showMoonEditor(path[0], path[1], path[2]) : nav.showPlanetEditor(path[0], path[1]);
  }
  function removeEditorItem(path, after) {
    try {
      if (!removeMapItem(path)) return;
      after(), nav.renderEditorTree();
    } catch (error) {
      editorError(
        /** @type {Error} */
        error.message
      );
    }
  }
  function undoRemoval() {
    try {
      if (!store.undoRemoval()) return editorError("There is no removal to undo.");
      nav.showSunList();
    } catch (error) {
      editorError(`Could not undo removal: ${/** @type {Error} */
      error.message}`);
    }
  }

  // src/ui/editor/page.js
  function openEditorPage() {
    modes.send("openEditor");
    let sheet = (
      /** @type {HTMLElement} */
      menuOverlay.querySelector(".menu-sheet")
    );
    sheet.classList.add("editor-page-mode"), sheet.querySelector(".menu-top h2").textContent = "Edit your Galaxy";
    let layout = element("div", "editor-page-layout"), tree = element("nav", "editor-tree");
    setEditorTree(tree), tree.setAttribute("aria-label", "Galaxy link tree");
    let pane = element("section", "editor-pane");
    layout.append(tree, pane), menuRoot.replaceChildren(layout), setMenuContent(pane), renderEditorTree(), nav.showSunList(), tree.querySelector("button")?.focus();
  }
  function openEditorAt(indices, options = {}) {
    hooks.openMenu(), openEditorPage(), options.restoreFocus && rememberEditorOrigin(indices, options.restoreFocus), indices.length === 1 ? nav.showSunEditor(indices[0]) : indices.length === 3 ? nav.showMoonEditor(indices[0], indices[1], indices[2]) : nav.showPlanetEditor(indices[0], indices[1]), options.restoreFocus && menuContent.querySelector("button")?.focus();
  }
  function leaveEditorPage() {
    modes.send("backToPanels"), menuOverlay.querySelector(".menu-sheet").classList.remove("editor-page-mode"), menuOverlay.querySelector(".menu-top h2").textContent = "Explore the menu", setEditorTree(null), setMenuContent(menuRoot), hooks.showMenuPanel("Settings"), menuRoot.querySelector(".editor-open")?.focus();
  }
  function renderEditorTree() {
    let tree = editorTree;
    tree && (tree.replaceChildren(element("h3", "", "Galaxy")), groups.forEach((sun, sunIndex) => {
      let sunButton = editorButton(
        `${sun.icon ? `${sun.icon} ` : ""}${sun.name} · ${counted(sun.links.length, "planet")}${sun.team ? " · team" : ""}`,
        () => nav.showSunEditor(sunIndex),
        "editor-tree-item editor-tree-sun"
      );
      tree.append(sunButton), sun.links.forEach((planet, planetIndex) => {
        let planetButton = editorButton(
          `${planet.name} · ${counted(planet.moons.length, "moon")}`,
          () => nav.showPlanetEditor(sunIndex, planetIndex),
          "editor-tree-item editor-tree-planet"
        );
        decorateTreeItem(planetButton, planet), tree.append(planetButton), planet.moons.forEach((moon, moonIndex) => {
          let moonButton = editorButton(
            moon.name,
            () => nav.showMoonEditor(sunIndex, planetIndex, moonIndex),
            "editor-tree-item editor-tree-moon"
          );
          decorateTreeItem(moonButton, moon), tree.append(moonButton);
        });
      });
    }));
  }
  function decorateTreeItem(button, item) {
    let group = isGroup(item);
    if (group) {
      let marker = element("span", "editor-tree-group", "📁 ");
      marker.setAttribute("role", "img"), marker.setAttribute("aria-label", "Group"), button.prepend(marker);
    }
    let result = group ? void 0 : linkCheckResults.get(destinationKey(item));
    result && !result.ok && (button.classList.add("editor-tree-broken"), button.prepend(element("span", "broken-mark", "⚠ ")), button.title = `Last check: ${result.status ? `HTTP ${result.status}` : result.error}`), item.tags?.length && button.append(tagChips(item.tags));
  }
  function showMovePlanet(sunIndex, planetIndex) {
    let sun = groups[sunIndex], planet = sun.links[planetIndex];
    editorHeader(`Move ${planet.name}`, () => nav.showPlanetEditor(sunIndex, planetIndex)), menuContent.append(element("p", "", `From ${sun.name} sun. Its moons move with it.`));
    let options = groups.flatMap((target, index) => index === sunIndex || target.team ? [] : [[String(index), target.name]]);
    if (!options.length) {
      menuContent.append(element("p", "", "Add another sun before moving this planet."));
      return;
    }
    let select = moveTargetField(options), position = movePositionField(select, (value) => groups[Number(value)].links.map((item) => item.name));
    editorActions().append(editorButton("Move planet", () => {
      let sun2 = Number(select.value), moved = (
        /** @type {any} */
        moveMapItem(
          groups,
          { kind: "planet", sun: sunIndex, planet: planetIndex },
          position.value === "end" ? { kind: "sun", sun: sun2 } : { kind: "planet", sun: sun2, planet: Number(position.value), place: "before" }
        )
      );
      if (moved.status !== "moved") return editorError("That planet could not be moved.");
      applyEditorChange(
        moved.groups,
        () => nav.showPlanetEditor(moved.path.sun, moved.path.planet),
        { label: `Moved planet ${planet.name} to ${groups[sun2].name}` }
      );
    }, "editor-primary"));
  }
  function showMoveMoon(sunIndex, planetIndex, moonIndex) {
    let sun = groups[sunIndex], planet = sun.links[planetIndex], moon = planet.moons[moonIndex];
    editorHeader(`Move ${moon.name}`, () => nav.showMoonEditor(sunIndex, planetIndex, moonIndex)), menuContent.append(element("p", "", `From ${sun.name} sun → ${planet.name} planet.`));
    let options = groups.flatMap((targetSun, targetSunIndex) => targetSun.links.flatMap(
      (targetPlanet, targetPlanetIndex) => targetSunIndex === sunIndex && targetPlanetIndex === planetIndex || targetSun.team ? [] : [[`${targetSunIndex}:${targetPlanetIndex}`, `${targetSun.name} → ${targetPlanet.name}`]]
    ));
    if (!options.length) {
      menuContent.append(element("p", "", "Add another planet before moving this moon."));
      return;
    }
    let select = moveTargetField(options), position = movePositionField(select, (value) => {
      let [targetSun, targetPlanet] = value.split(":").map(Number);
      return groups[targetSun].links[targetPlanet].moons.map((item) => item.name);
    });
    editorActions().append(editorButton("Move moon", () => {
      let [targetSunIndex, targetPlanetIndex] = select.value.split(":").map(Number), parent = { sun: targetSunIndex, planet: targetPlanetIndex }, moved = (
        /** @type {any} */
        moveMapItem(
          groups,
          { kind: "moon", sun: sunIndex, planet: planetIndex, moon: moonIndex },
          position.value === "end" ? { kind: "planet", ...parent } : { kind: "moon", ...parent, moon: Number(position.value), place: "before" }
        )
      );
      if (moved.status !== "moved") return editorError("That moon could not be moved.");
      applyEditorChange(
        moved.groups,
        () => nav.showMoonEditor(moved.path.sun, moved.path.planet, moved.path.moon),
        { label: `Moved moon ${moon.name}` }
      );
    }, "editor-primary"));
  }
  async function droppedFiles(dataTransfer) {
    let entries = [...dataTransfer.items].map((item) => item.webkitGetAsEntry?.()).filter(Boolean);
    if (!entries.length) return [...dataTransfer.files];
    let visit = async (entry) => {
      if (entry.isFile)
        return [await new Promise((resolve, reject) => entry.file(resolve, reject))];
      if (!entry.isDirectory) return [];
      let reader = entry.createReader(), files2 = [];
      for (; ; ) {
        let children = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
        if (!children.length) break;
        for (let child of children) files2.push(...await visit(child));
      }
      return files2;
    }, files = [];
    for (let entry of entries) files.push(...await visit(entry));
    return files;
  }
  function showRdpBatchImport(kind, sunIndex, planetIndex = null) {
    let sun = groups[sunIndex], parent = kind === "moon" ? sun.links[planetIndex] : sun, back = kind === "moon" ? () => nav.showPlanetEditor(sunIndex, planetIndex) : () => nav.showSunEditor(sunIndex);
    editorHeader("Import .rdp files", back), menuContent.append(element("p", "", `Add ${kind}s under ${sun.name}${kind === "moon" ? ` → ${parent.name}` : ""}. Existing links stay in place.`)), menuContent.append(element("p", "", "Pick multiple .rdp files or a folder, or drop them here. Orbit reads the files in this browser and excludes password, token, and signature settings."));
    let dropZone = element("div", "rdp-dropzone", "Drop .rdp files or a folder here"), preview = element("div", "rdp-batch-preview"), actions = editorActions(), add = editorButton("Add imported links", () => {
      let next = copyGroups();
      (kind === "moon" ? next[sunIndex].links[planetIndex].moons : next[sunIndex].links).push(...prepared), applyEditorChange(next, back, { label: `Imported ${counted(prepared.length, kind)} from .rdp files` });
    }, "editor-primary");
    add.disabled = !0;
    let prepared = [], selectionVersion = 0, prepare = async (files) => {
      let version = ++selectionVersion;
      prepared = [], add.disabled = !0, preview.replaceChildren(), menuContent.querySelector(".editor-error")?.remove();
      try {
        let selected = files.filter((file) => /\.rdp$/i.test(file.name));
        if (!selected.length) throw new Error("Choose at least one .rdp file.");
        if (selected.length > 100) throw new Error("Choose at most 100 .rdp files at once.");
        let imported = [], excluded = 0;
        for (let file of selected) {
          let parsed;
          try {
            parsed = parseRdpProfile(await readRdpText(file));
          } catch (error) {
            throw new Error(`${file.name}: ${/** @type {any} */
            error.message}`);
          }
          imported.push({
            name: file.name.replace(/\.rdp$/i, "") || "Remote Desktop",
            type: "rdp",
            host: parsed.host,
            rdpProfile: parsed.content
          }), excluded += parsed.removed;
        }
        if (version !== selectionVersion || !menuContent.contains(dropZone)) return;
        prepared = imported, preview.append(element("p", "", `${imported.length} ${kind}${imported.length === 1 ? "" : "s"} ready · ${excluded} sensitive settings excluded · ${files.length - selected.length} other files skipped.`));
        let list = element("ul", "rdp-batch-list");
        imported.forEach((item) => list.append(element("li", "", `${item.name} → ${item.host}`))), preview.append(list), add.disabled = !1;
      } catch (error) {
        version === selectionVersion && menuContent.contains(dropZone) && editorError(`RDP import failed: ${/** @type {any} */
        error.message}`);
      }
    }, choose = (folder) => {
      let input = document.createElement("input");
      input.type = "file", folder ? input.setAttribute("webkitdirectory", "") : (input.multiple = !0, input.accept = ".rdp,application/x-rdp"), input.addEventListener("change", () => {
        input.files?.length && prepare([...input.files]);
      }), input.click();
    };
    dropZone.addEventListener("dragover", (event) => event.preventDefault()), dropZone.addEventListener("drop", async (event) => {
      event.preventDefault();
      try {
        await prepare(await droppedFiles(event.dataTransfer));
      } catch (error) {
        editorError(`RDP import failed: ${/** @type {any} */
        error.message}`);
      }
    }), menuContent.append(dropZone), actions.append(editorButton("Choose .rdp files", () => choose(!1))), actions.append(editorButton("Choose folder", () => choose(!0))), actions.append(add), menuContent.append(preview);
  }

  // src/services/schedule.js
  var BACKUP_CHANGES = 20, BACKUP_DAYS = 14, DAY_MS = 1440 * 60 * 1e3, SNOOZE_MS = 3 * DAY_MS, fixedNow = null, now = () => fixedNow === null ? Date.now() : fixedNow, today = () => new Date(now());
  function localDay(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }
  function dueRoutines(routines2, offered2, date = today()) {
    let time = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
    return routines2.filter((routine) => routine.schedule && routine.schedule.days.includes(date.getDay()) && routine.schedule.time <= time && offered2[routine.id] !== localDay(date));
  }
  function backupDue(entry, enabled, time = now()) {
    if (!enabled || !entry?.changes || entry.snoozeUntil && time < entry.snoozeUntil) return null;
    let days = Math.floor((time - (entry.since || time)) / DAY_MS);
    return entry.changes >= BACKUP_CHANGES || days >= BACKUP_DAYS ? { changes: entry.changes, days } : null;
  }
  function teamEntries(teamGroups) {
    return teamGroups.flatMap((sun) => sun.links.flatMap((planet) => [
      ...isGroup(planet) ? [] : [{ key: destinationKey(planet), name: planet.name, path: sun.name }],
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

  // src/ui/notices/area.js
  function noticeArea() {
    let area = document.querySelector("#notice-area");
    return area || (area = element("section", "notice-area"), area.id = "notice-area", area.setAttribute("aria-label", "Notices"), document.querySelector(".app-shell").insertBefore(area, app)), area;
  }
  function showOpenAllNotice(message, isError = !1) {
    let notice = (
      /** @type {(HTMLElement & {hideTimer?: number}) | null} */
      document.querySelector("#open-all-notice")
    );
    notice || (notice = element("p", "open-all-notice"), notice.id = "open-all-notice", notice.setAttribute("role", "status"), document.body.append(notice));
    let shown = notice;
    return shown.textContent = message, shown.classList.toggle("open-all-error", isError), shown.hidden = !1, clearTimeout(shown.hideTimer), shown.hideTimer = setTimeout(() => {
      shown.hidden = !0;
    }, isError ? 9e3 : 4e3), message;
  }

  // src/ui/notices/backup.js
  function noteBackupMade2() {
    noteBackupMade(activeWorkspace()), document.querySelector("#backup-reminder")?.remove();
  }
  function backupDue2(time = now()) {
    return backupDue(readBackupState()[activeWorkspace()], readBoolean("orbit:backup-reminders", !0), time);
  }
  function backupReminder(due) {
    let box = element("div", "routine-offer backup-reminder"), where = loadWorkspaces().length > 1 ? ` in ${workspaceName(activeWorkspace())}` : "";
    box.append(element("p", "routine-offer-copy", `Back up your map${where}: ${counted(due.changes, "change")} since your last export${due.days ? `, ${counted(due.days, "day")} ago` : ""}.`));
    let save = element("button", "routine-offer-open", "Back up now");
    save.type = "button", save.addEventListener("click", () => {
      hooks.exportMap(), box.remove();
    });
    let later = element("button", "routine-offer-dismiss", "Remind me later");
    return later.type = "button", later.addEventListener("click", () => {
      let state = readBackupState();
      state[activeWorkspace()] = { ...state[activeWorkspace()], snoozeUntil: now() + SNOOZE_MS }, writeBackupState(state), document.querySelector("#backup-reminder")?.remove(), box.remove();
    }), box.append(save, later), box;
  }
  function showBackupReminder() {
    document.querySelector("#backup-reminder")?.remove();
    let due = backupDue2();
    if (!due) return;
    let box = backupReminder(due);
    box.id = "backup-reminder", noticeArea().append(box);
  }

  // src/ui/team-map.js
  var team = {
    /** @type {any[]} */
    groups: [],
    source: "",
    error: ""
  };
  async function loadTeamMap2() {
    let loaded = await loadTeamMap();
    team.groups = loaded.groups, team.source = loaded.source, team.error = loaded.error;
  }

  // src/services/rdp-launch.js
  function downloadRdp(destination, presets) {
    downloadText(rdpFileContent(destination, presets), rdpFileName(destination), "application/x-rdp");
  }
  function launchRdp(destination, presets, mode) {
    mode === "download" ? downloadRdp(destination, presets) : globalThis.location.href = rdpLaunchUrl(destination, presets);
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
    return isGroup(item) ? "skipped" : item.type === "rdp" ? (launchRdp(item, presets, launchMode), "rdp") : templateNames(item.url).length ? "ask" : openTab(item.url) ? "opened" : "blocked";
  }
  function planLinks(items, label, { question = null, extra = "", values = readVariables() } = {}) {
    let all = items.filter((item) => item.type === void 0), web = all.filter((item) => templateNames(item.url).every((name) => values[name])).map((item) => ({ item, url: fillTemplate(item.url, values) })), skipped = items.filter((item) => item.type === "rdp").length, unfilled = all.length - web.length, note = `${skipped ? ` ${counted(skipped, "Remote Desktop link")} left out.` : ""}${unfilled ? ` ${counted(unfilled, "link")} with {placeholders} left out until you open ${unfilled === 1 ? "it" : "them"} once.` : ""}${extra}`;
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

  // src/ui/views/favorites.js
  function isFavorite(item, sun) {
    if (!item || isGroup(item)) return !1;
    if (!sun?.team) return item.favorite === !0;
    let key = destinationKey(item);
    return key !== null && readStoredSet(KEYS.teamFavorites).has(key);
  }
  function favoriteItems() {
    let list = [];
    return groups.forEach((sun, sunIndex) => sun.links.forEach((planet, planetIndex) => {
      isFavorite(planet, sun) && list.push({ path: [sunIndex, planetIndex], item: planet }), planet.moons.forEach((moon, moonIndex) => {
        isFavorite(moon, sun) && list.push({ path: [sunIndex, planetIndex, moonIndex], item: moon });
      });
    })), list;
  }
  function setFavorite(path, on) {
    let sun = groups[path[0]], item = itemAt(groups, path);
    if (!item || isGroup(item)) return;
    if (sun.team) {
      let set = readStoredSet(KEYS.teamFavorites);
      on ? set.add(destinationKey(item)) : set.delete(destinationKey(item)), writeStoredSet(KEYS.teamFavorites, set), hooks.render();
      return;
    }
    let next = copyGroups(), target = path.length === 3 ? next[path[0]].links[path[1]].moons[path[2]] : next[path[0]].links[path[1]];
    on ? target.favorite = !0 : delete target.favorite, store.saveMap({ groups: next }, `${on ? "Added" : "Removed"} favorite ${item.name}`);
  }
  function recentItems() {
    return readRecent().flatMap((entry) => {
      let path = pathsForKey(groups, entry.key)[0];
      return path ? [{ path, item: itemAt(groups, path) }] : [];
    });
  }
  function noteOpened(item) {
    if (!item || modes.inEditMode()) return;
    let key = destinationKey(item);
    key !== null && (recordRecent(key, item.name, Date.now()), setTimeout(() => hooks.refreshQuickBar(), 0));
  }

  // src/ui/dialogs/placeholder.js
  var variableDialog = (
    /** @type {any} */
    null
  ), variableItem = (
    /** @type {any} */
    null
  );
  function askForVariables(item) {
    modes.overlayIs("placeholder") && closeVariableDialog(), variableItem = item, modes.send("openPlaceholder");
  }
  function variableFormOpened() {
    let item = variableItem;
    variableItem = null;
    let names = templateNames(item.url), remembered = readVariables(), opener = document.activeElement instanceof HTMLElement ? document.activeElement : null, overlay = element("div", "palette-overlay variable-overlay"), scrim = element("div", "palette-scrim"), form = element("form", "palette variable-form");
    form.setAttribute("role", "dialog"), form.setAttribute("aria-modal", "true"), form.setAttribute("aria-label", `Open ${item.name}`), form.append(element("h2", "variable-title", `Open ${item.name}`)), form.append(element("p", "variable-address", item.url));
    let inputs = names.map((name) => {
      let field = editorField(name, remembered[name] || "");
      return field.input.setAttribute("aria-label", name), field.input.required = !0, field.input.autocomplete = "off", form.append(field.wrapper), /** @type {[string, HTMLInputElement]} */
      [name, field.input];
    }), preview = element("p", "variable-preview"), update = () => {
      preview.textContent = fillTemplate(item.url, Object.fromEntries(inputs.map(([name, input]) => [name, input.value.trim()])));
    };
    inputs.forEach(([, input]) => input.addEventListener("input", update)), update();
    let actions = element("div", "editor-actions"), open = element("button", "editor-primary", "Open");
    open.type = "submit";
    let cancel = editorButton("Cancel", closeVariableDialog);
    actions.append(open, cancel), form.append(preview, actions), form.addEventListener("submit", (event) => {
      event.preventDefault();
      let values = Object.fromEntries(inputs.map(([name, input]) => [name, input.value.trim()]));
      Object.values(values).some((value) => !value) || (saveVariables(values), closeVariableDialog(), openTab(fillTemplate(item.url, values)), noteOpened(item));
    }), form.addEventListener("keydown", (event) => {
      event.key === "Escape" && (event.preventDefault(), event.stopPropagation(), closeVariableDialog());
    }), scrim.addEventListener("click", closeVariableDialog), overlay.append(scrim, form), document.body.append(overlay), variableDialog = { overlay, opener }, (inputs.find(([, input]) => !input.value)?.[1] || inputs[0]?.[1])?.focus();
  }
  function closeVariableDialog() {
    modes.overlayIs("placeholder") && modes.send("closeOverlay");
  }
  function variableFormClosed() {
    let { overlay, opener } = variableDialog;
    variableDialog = /** @type {any} */
    null, overlay.remove(), opener && document.contains(opener) && opener.focus();
  }

  // src/ui/views/open.js
  function openDestination2(item) {
    let result = openDestination(item, { presets: rdpPresets, launchMode: rdpLaunchMode });
    if (result === "ask") return askForVariables(item);
    result !== "skipped" && noteOpened(item);
  }
  function openLinks2(items, label, { confirm = !0, question = null, extra = "" } = {}) {
    let result = openLinks(items, label, { confirm, question, extra, ask: confirmed, onOpened: noteOpened });
    return result ? showOpenAllNotice(result.message, result.isError) : null;
  }
  function openAll(sunIndex, planetIndex) {
    let planet = groups[sunIndex]?.links[planetIndex];
    return planet ? isGroup(planet) ? openLinks2(planet.moons, planet.name) : openLinks2(
      [planet, ...planet.moons],
      planet.name,
      { question: (count) => `Open ${count} tabs for ${planet.name} and its moons?` }
    ) : null;
  }
  function openAllFavorites() {
    return openLinks2(favoriteItems().map((entry) => entry.item), "your favorites");
  }
  function routineItems(routine) {
    let items = [], missing = 0;
    for (let link of routine.links) {
      let path = pathsForKey(groups, link.key)[0], item = path && itemAt(groups, path);
      item && !isGroup(item) ? items.push({ path, item }) : missing++;
    }
    return { items, missing };
  }
  function runRoutine(routine) {
    let { items, missing } = routineItems(routine), extra = missing ? ` ${counted(missing, "link")} in this routine ${missing === 1 ? "is" : "are"} no longer on the map.` : "";
    return items.length ? openLinks2(items.map((entry) => entry.item), routine.name, { confirm: !1, extra }) : showOpenAllNotice(`${routine.name} has no links on the map.${extra}`, !0);
  }

  // src/ui/notices/routine-offer.js
  var offered = (id) => markOffered(id, localDay(today()), activeWorkspace());
  function offerDueRoutines() {
    if (document.querySelector("#routine-banner")?.remove(), !modes.routineOffersAllowed()) return;
    let due = dueRoutines(routines, offeredIn(activeWorkspace()));
    if (!due.length) return;
    let banner = element("section", "routine-banner");
    banner.id = "routine-banner", banner.setAttribute("role", "region"), banner.setAttribute("aria-label", "Routines ready to open");
    for (let routine of due) {
      let { items } = routineItems(routine), row = element("div", "routine-offer");
      row.append(element("p", "routine-offer-copy", `Time for ${routine.name}: ${counted(items.length, "link")}.`));
      let open = element("button", "routine-offer-open", `Open ${routine.name}`);
      open.type = "button", open.addEventListener("click", () => {
        offered(routine.id), row.remove(), banner.querySelector(".routine-offer") || banner.remove(), runRoutine(routine);
      });
      let later = element("button", "routine-offer-dismiss", "Not today");
      later.type = "button", later.addEventListener("click", () => {
        offered(routine.id), row.remove(), banner.querySelector(".routine-offer") || banner.remove();
      }), row.append(open, later), banner.append(row);
    }
    noticeArea().prepend(banner);
  }
  function installRoutineOffers() {
    document.addEventListener("visibilitychange", () => {
      document.visibilityState === "visible" && groups.length && offerDueRoutines();
    });
  }

  // src/ui/menu/workspaces.js
  function switchWorkspace(id) {
    loadWorkspaces().some((item) => item.id === id) && (modes.send("switchWorkspace"), store.switchWorkspace(id) && (updateWorkspaceSwitch(), location.hash && location.hash !== "#" && !groups.some((sun) => location.hash.includes(encodeURIComponent(sun.id))) ? location.hash = "" : hooks.render(), offerDueRoutines(), showBackupReminder()));
  }
  function addWorkspace(name, start2) {
    return store.addWorkspace(name, start2);
  }
  function renameWorkspace2(id, name) {
    renameWorkspace(id, name), updateWorkspaceSwitch();
  }
  function removeWorkspace(id) {
    id !== "main" && (store.removeWorkspace(id) ? switchWorkspace("main") : updateWorkspaceSwitch());
  }
  function updateWorkspaceSwitch() {
    let select = (
      /** @type {HTMLSelectElement | null} */
      document.querySelector("#workspace-switch")
    ), list = loadWorkspaces();
    if (list.length < 2) {
      select?.remove();
      return;
    }
    if (!select) {
      select = document.createElement("select"), select.id = "workspace-switch", select.className = "workspace-switch", select.setAttribute("aria-label", "Workspace"), select.title = "Switch workspace";
      let created = select;
      created.addEventListener("change", () => switchWorkspace(created.value)), document.querySelector(".topbar-right").prepend(created);
    }
    select.replaceChildren(...list.map((item) => {
      let option = element("option", "", item.name);
      return option.value = item.id, option;
    })), select.value = activeWorkspace();
  }
  function workspaceSettings() {
    let section = element("div", "team-settings workspace-settings");
    section.append(element("strong", "", "Workspaces")), section.append(element("p", "workspace-hint", "Separate maps, such as Work and Home, each with their own suns, favorites, routines, and history. The team map and these settings are shared.")), loadWorkspaces().forEach((item) => {
      let row = element("div", "editor-list-row workspace-row");
      row.append(element("span", "", `${item.name}${item.id === activeWorkspace() ? " (open)" : ""}`)), item.id !== activeWorkspace() && row.append(editorButton("Switch", () => {
        switchWorkspace(item.id), hooks.showMenuPanel("Settings");
      })), row.append(editorButton("Rename", () => {
        let name2 = window.prompt("New name for this workspace", item.name);
        if (name2 !== null)
          try {
            renameWorkspace2(item.id, name2), hooks.showMenuPanel("Settings");
          } catch (error) {
            editorError(
              /** @type {any} */
              error.message
            );
          }
      })), item.id !== "main" && row.append(editorButton("Remove", () => {
        confirmed(`Remove the ${item.name} workspace and its map? Export it first if you want a copy.`) && (removeWorkspace(item.id), hooks.showMenuPanel("Settings"));
      }, "editor-danger")), section.append(row);
    });
    let form = element("form", "workspace-add"), name = editorField("New workspace", "");
    name.input.setAttribute("aria-label", "New workspace name"), name.input.placeholder = "For example: Home";
    let start2 = document.createElement("select");
    start2.setAttribute("aria-label", "Start the new workspace with");
    for (let [value, label] of [["empty", "An empty map"], ["copy", "A copy of this workspace"], ["bundled", "The sample map"]]) {
      let option = element("option", "", label);
      option.value = value, start2.append(option);
    }
    let add = element("button", "editor-button", "Add workspace");
    return add.type = "submit", form.append(name.wrapper, start2, add), form.addEventListener("submit", (event) => {
      event.preventDefault();
      try {
        let id = addWorkspace(name.input.value, start2.value);
        switchWorkspace(id), hooks.showMenuPanel("Settings");
      } catch (error) {
        editorError(
          /** @type {any} */
          error.message
        );
      }
    }), section.append(form), section;
  }

  // src/ui/menu/menu.js
  var menuOpener = null;
  function closeMenu() {
    modes.menuOpen() && modes.send("closeOverlay");
  }
  function menuHidden() {
    menuOverlay.querySelector(".menu-sheet").classList.remove("editor-page-mode"), menuOverlay.querySelector(".menu-top h2").textContent = "Explore the menu", setMenuContent(menuRoot), setEditorTree(null);
    let target = menuOpener && document.contains(menuOpener) ? menuOpener : settingsTrigger;
    menuOpener = null, restoreEditorOrigin() || target.focus();
  }
  function openMenu() {
    if (modes.send("openMenu"), !!modes.menuOpen()) {
      menuOpener = document.activeElement instanceof HTMLElement ? document.activeElement : null, setMenuContent(menuRoot), menuContent.replaceChildren();
      for (let option of document.querySelectorAll("[data-menu-panel]")) option.classList.remove("active");
      document.querySelector("[data-menu-panel]").focus();
    }
  }
  function showMenuPanel(name) {
    modes.send("choosePanel"), menuContent.replaceChildren();
    for (
      let option of
      /** @type {NodeListOf<HTMLElement>} */
      document.querySelectorAll("[data-menu-panel]")
    )
      option.classList.toggle("active", option.dataset.menuPanel === name);
    if (menuContent.append(element("h3", "", name)), name === "Settings") {
      let edit = element("button", "editor-open", "Edit links");
      edit.type = "button", edit.addEventListener("click", openEditorPage), menuContent.append(edit), menuContent.append(element("p", "data-source", `Active link map: ${dataSourceLabel()}`)), storageWarning && menuContent.append(element("p", "editor-error", storageWarning));
      let themeRow = element("label", "setting-row"), themeCopy = element("span", "setting-copy");
      themeCopy.append(element("strong", "", "Theme")), themeCopy.append(element("small", "", "Choose the colors for your Galaxy"));
      let themeSelect = document.createElement("select");
      themeSelect.setAttribute("aria-label", "Theme");
      for (let [value, label] of [
        ["default", "Default"],
        ["alabama", "Red"],
        ["auburn", "Blue"]
      ]) {
        let option = element("option", "", label);
        option.value = value, themeSelect.append(option);
      }
      themeSelect.value = activeTheme, themeSelect.addEventListener("change", () => {
        setActiveTheme(
          /** @type {any} */
          themeSelect.value
        ), document.documentElement.dataset.theme = activeTheme, savePreference("orbit:theme", activeTheme);
      }), themeRow.append(themeCopy, themeSelect), menuContent.append(themeRow);
      let fontRow = element("label", "setting-row"), fontCopy = element("span", "setting-copy");
      fontCopy.append(element("strong", "", "Font size")), fontCopy.append(element("small", "", "Text size throughout Orbit"));
      let fontSelect = document.createElement("select");
      fontSelect.setAttribute("aria-label", "Font size");
      for (let [value, label] of [
        ["small", "Small (90%)"],
        ["standard", "Standard (100%)"],
        ["large", "Large (115%)"],
        ["extra", "Extra large (130%)"]
      ]) {
        let option = element("option", "", label);
        option.value = value, fontSelect.append(option);
      }
      fontSelect.value = activeFontSize, fontSelect.addEventListener("change", () => {
        setActiveFontSize(
          /** @type {any} */
          fontSelect.value
        ), document.documentElement.dataset.fontSize = activeFontSize, savePreference("orbit:font-size", activeFontSize);
      }), fontRow.append(fontCopy, fontSelect), menuContent.append(fontRow);
      let rdpRow = element("label", "setting-row"), rdpCopy = element("span", "setting-copy");
      rdpCopy.append(element("strong", "", "Remote Desktop")), rdpCopy.append(element("small", "", "Opening the client requires the Orbit Windows helper"));
      let rdpSelect = document.createElement("select");
      rdpSelect.setAttribute("aria-label", "Remote Desktop launch");
      for (let [value, label] of [
        ["download", "Download .rdp file"],
        ["client", "Open mstsc.exe"]
      ]) {
        let option = element("option", "", label);
        option.value = value, rdpSelect.append(option);
      }
      rdpSelect.value = rdpLaunchMode;
      let rdpSetup = element("div", "rdp-setup");
      rdpSetup.append(element("strong", "", "Windows setup required")), rdpSetup.append(element("p", "", "This opens built-in mstsc.exe. Installing Microsoft Remote Desktop Client (MSRDC) does not install the Orbit helper.")), rdpSetup.append(element("p", "", "From the Orbit project folder, run with Windows PowerShell 5.1:")), rdpSetup.append(element("code", "", "powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\\windows\\Install-OrbitRdp.ps1")), rdpSetup.append(element("p", "", "If only PowerShell 7 is available, run:")), rdpSetup.append(element("code", "", "pwsh.exe -NoProfile -ExecutionPolicy Bypass -File .\\windows\\Install-OrbitRdp.ps1")), rdpSetup.append(element("p", "", "Run the installer again after updating Orbit to refresh the helper. Host-only links open with mstsc.exe /v without a connection file; imported profiles still use a file."));
      let updateRdpSetup = () => {
        rdpSetup.hidden = rdpSelect.value !== "client";
      };
      updateRdpSetup(), rdpSelect.addEventListener("change", () => {
        setRdpLaunchMode(
          /** @type {any} */
          rdpSelect.value
        ), savePreference("orbit:rdp-launch", rdpLaunchMode), updateRdpSetup(), hooks.render();
      }), rdpRow.append(rdpCopy, rdpSelect), menuContent.append(rdpRow, rdpSetup);
      let row = element("label", "setting-row"), copy = element("span", "setting-copy");
      copy.append(element("strong", "", "Animations")), copy.append(element("small", "", "Movement and reveal effects throughout Orbit"));
      let input = document.createElement("input");
      input.type = "checkbox", input.checked = animationsEnabled, input.setAttribute("aria-label", "Animations"), input.addEventListener("change", () => {
        setAnimationsEnabled(input.checked), document.documentElement.dataset.animations = animationsEnabled ? "on" : "off", savePreference("orbit:animations", animationsEnabled);
      }), row.append(copy, input), menuContent.append(row);
      let moonRow = element("label", "setting-row"), moonCopy = element("span", "setting-copy");
      moonCopy.append(element("strong", "", "Always show moons")), moonCopy.append(element("small", "", "Show moons around visible planets without hovering"));
      let moonInput = document.createElement("input");
      moonInput.type = "checkbox", moonInput.checked = alwaysShowMoons, moonInput.setAttribute("aria-label", "Always show moons"), moonInput.addEventListener("change", () => {
        setAlwaysShowMoons(moonInput.checked), document.documentElement.dataset.moons = alwaysShowMoons ? "always" : "hover", savePreference("orbit:always-show-moons", alwaysShowMoons);
      }), moonRow.append(moonCopy, moonInput), menuContent.append(moonRow);
      let tipsRow = element("label", "setting-row"), tipsCopy = element("span", "setting-copy");
      tipsCopy.append(element("strong", "", "Button tips"));
      let tipsSelect = document.createElement("select");
      tipsSelect.setAttribute("aria-label", "Button tips");
      for (let [value, label] of [["slow", "After 1.5 seconds"], ["normal", "After 0.8 seconds"], ["off", "Off"]]) {
        let option = element("option", "", label);
        option.value = value, tipsSelect.append(option);
      }
      tipsSelect.value = buttonTips, tipsSelect.addEventListener("change", () => setButtonTips(tipsSelect.value)), tipsRow.append(tipsCopy, tipsSelect), menuContent.append(tipsRow), menuContent.append(settingToggle(
        "Edit buttons on hover",
        "Show editing and removal controls when you rest the pointer on a map item",
        showEditButtons,
        setShowEditButtons
      )), menuContent.append(settingToggle(
        "Confirm before deleting",
        "Ask before removing a sun, planet, or moon from the map or editor",
        readBoolean(CONFIRM_DELETE_KEY, !0),
        (checked) => savePreference(CONFIRM_DELETE_KEY, checked)
      )), menuContent.append(settingToggle(
        "Show favorites and recent",
        "A row of your favorite and recently opened links above the Galaxy",
        showQuickBar,
        (checked) => {
          setShowQuickBar(checked), savePreference("orbit:quick-bar", checked), hooks.render();
        }
      ));
      let recentActions = element("div", "editor-actions"), clear = editorButton("Clear recent links", () => {
        clearRecent(), hooks.render(), clear.textContent = "Recent links cleared";
      });
      recentActions.append(clear), menuContent.append(recentActions);
      let viewRow = element("label", "setting-row"), viewCopy = element("span", "setting-copy");
      viewCopy.append(element("strong", "", "Galaxy view")), viewCopy.append(element("small", "", "Orbits, or a compact list of every sun, planet, and moon"));
      let viewSelect = document.createElement("select");
      viewSelect.setAttribute("aria-label", "Galaxy view");
      for (let [value, label] of [["orbits", "Orbits"], ["list", "List"]]) {
        let option = element("option", "", label);
        option.value = value, viewSelect.append(option);
      }
      viewSelect.value = galaxyView, viewSelect.addEventListener("change", () => setGalaxyView(viewSelect.value)), viewRow.append(viewCopy, viewSelect), menuContent.append(viewRow), menuContent.append(settingToggle(
        "Show site icons",
        "Loads each website’s own icon from that site (its /favicon.ico). Off keeps Orbit from contacting sites until you open them.",
        showSiteIcons,
        (checked) => {
          setShowSiteIcons(checked), savePreference("orbit:site-icons", checked), hooks.render();
        }
      )), menuContent.append(settingToggle(
        "Backup reminders",
        "Suggest a backup (Edit links → Export → Whole map (JSON)) after 20 changes or 14 days without one",
        readBoolean("orbit:backup-reminders", !0),
        (checked) => {
          savePreference("orbit:backup-reminders", checked), showBackupReminder();
        }
      )), menuContent.append(workspaceSettings()), menuContent.append(teamSettings());
    } else name === "Help" ? (menuContent.append(element("p", "", "Explore your Galaxy. Hover over a sun to see its first five planets, then hover over a planet to reveal its moons.")), menuContent.append(element("p", "", "Click a sun to open its System and find more planets. Web planets and moons open in a new tab.")), menuContent.append(element("p", "", "Windows Remote Desktop entries download an .rdp file by default. After installing the Orbit Windows helper, choose Open mstsc.exe in Settings to open Remote Desktop Connection with the target loaded.")), menuContent.append(element("p", "", "In Edit links, open a planet or moon and use Import .rdp file to keep a saved connection profile with that link. Save the link after importing.")), menuContent.append(element("p", "", "Your browser may ask before opening the helper. Orbit does not store credentials.")), menuContent.append(element("p", "", "Use Quick find to search any sun, planet, or moon. It matches names, the sun or planet a link sits in, web addresses and computer names, and small typos; every word must match. Short forms work too: “lab1 s3” finds lab1-server3. Type #tag (or tag:name) to show only links with that tag.")), menuContent.append(element("p", "", "Press Ctrl+K (Cmd+K on a Mac) for the command palette: search links and commands, then press Enter to open the highlighted one straight away.")), menuContent.append(element("p", "", "Routines, favorites, and recently opened links appear above the Galaxy. Star a link in Quick find results, or tick Favorite in Edit links; Open all opens every favorite at once.")), menuContent.append(element("p", "", "A routine is a named set of links, such as the sites you open every morning. Create one in Edit links → Routines, then click its chip above the Galaxy to open them all. Give it a time and days, and Orbit offers to open it when you arrive. Set Orbit as your browser’s startup page and allow pop-ups for it, and your day starts with one click.")), menuContent.append(element("p", "", "Shift+click a planet, or use “Open a planet with all its moons” in a System, to open a planet and its website moons in new tabs. If only one tab opens, allow pop-ups for Orbit in your browser.")), menuContent.append(element("p", "", "The ☰ button in the top bar switches the Galaxy between orbits and a compact list.")), menuContent.append(element("p", "", "Edit links has tools for version history (restore an earlier map), finding duplicates, checking for broken links (needs python3 serve.py), and importing files. Import a file accepts whole maps, individual suns, planets as suns, and browser bookmarks. Whole maps merge by default.")), menuContent.append(element("p", "", "A team map, if one is set up, adds read-only team suns marked TEAM. Copy anything from them into your own map in Edit links. When the team map changes, Orbit lists what is new.")), menuContent.append(element("p", "", "Paste a web address into Quick find (or use Add a link in the command palette) to add it to a sun as a planet or to a planet as a moon. A link can have a note, shown on hover and in search; never put passwords in notes.")), menuContent.append(element("p", "", "A web address can contain {placeholders}, such as https://jira.example.com/browse/{ticket}. Opening the link asks for each value and remembers the last one.")), menuContent.append(element("p", "", "Workspaces in Settings keep separate maps, such as Work and Home. Link packs share a routine or your favorites as a small file. Remote Desktop presets save connection settings, such as full screen on all monitors, for many links at once. Orbit reminds you to export a backup after many changes.")), menuContent.append(element("h4", "editor-section-title", "Rearranging by dragging")), menuContent.append(element("p", "", "Turn on Edit mode in the top bar to rearrange the map with a mouse or pen. While it is on, planets and moons do not open; a sun still opens its System.")), menuContent.append(element("p", "", "Drag a planet onto another sun to move it there with all its moons. Drag a moon onto another planet; in the Galaxy, pause on a sun to show its planets.")), menuContent.append(element("p", "", "To set the order, drag onto a sibling: a planet onto a planet, a moon onto a moon, or a sun onto a sun. Choose Before or After, and the hint shows the position it will take. Pause on a planet to show its moons.")), menuContent.append(element("p", "", "In a System, a list of the other suns and planets appears while you drag; pause on an entry to open it. Undo last drag reverses the most recent move until the map changes again.")), menuContent.append(element("p", "", "Use Edit links to reach any item, including links outside the visible orbits. In a planet or moon editor, the top toolbar has Save, Export, Move, and Remove. Open Move to change the order or pick another sun or planet and a position. In Edit mode, a Quick find result opens that planet or moon in Edit links.")), menuContent.append(element("h4", "editor-section-title", "Keyboard")), menuContent.append(element("p", "", "Press / to jump to Quick find. Down Arrow moves into the results, Up and Down Arrow move between them, and Enter opens one.")), menuContent.append(element("p", "", "Press E on a focused sun, planet, or moon to open its editor. You can also rest the pointer on an item and click its pencil or use the trash button to remove it. Undo removal restores the last removed item.")), menuContent.append(element("p", "", "Tab moves through the page. Focusing a sun reveals its planets, and focusing a planet reveals its moons.")), menuContent.append(element("p", "", "Arrow keys move between suns, and between sibling planets or moons. Down Arrow on a planet enters its moons, and Up Arrow goes back out.")), menuContent.append(element("p", "", "Escape dismisses a visible button tip, closes the menu, then cancels a drag, then turns Edit mode off, then clears Quick find, then returns from a System to the Galaxy.")), menuContent.append(element("p", "", "Ctrl+K or Cmd+K opens the command palette. Up and Down Arrow move through it, Enter runs or opens the highlighted entry, and Escape closes it first."))) : name === "About" && (menuContent.append(element("p", "", "Orbit is a local link map that keeps your favorite destinations in a visual Galaxy.")), menuContent.append(element("p", "", "Your link map runs on this computer, without an account or hosted service.")), menuContent.append(element("p", "", `Version ${APP_VERSION2}`)));
  }
  function settingToggle(title, hint, checked, onChange) {
    let row = element("label", "setting-row"), copy = element("span", "setting-copy");
    copy.append(element("strong", "", title), element("small", "", hint));
    let input = document.createElement("input");
    return input.type = "checkbox", input.checked = checked, input.setAttribute("aria-label", title), input.addEventListener("change", () => onChange(input.checked)), row.append(copy, input), row;
  }
  function teamSettings() {
    let section = element("div", "team-settings");
    if (section.append(element("strong", "", "Team map")), team.error && section.append(element("p", "editor-error", team.error)), !team.groups.length)
      return team.error || section.append(element("p", "team-source", "No team map is set up. Start Orbit with python3 serve.py --team PATH, or run python3 sync.py --team PATH for file use.")), section;
    section.append(element("p", "team-source", `${counted(team.groups.length, "team sun")} from ${team.source}. Team suns are read-only and never saved with your map.`));
    let hidden = hiddenTeamSuns();
    return team.groups.filter((sun) => hidden.has(sun.id)).forEach((sun) => {
      let row = element("div", "editor-list-row");
      row.append(element("span", "", `${sun.name} (hidden)`)), row.append(editorButton("Show", () => {
        store.setTeamSunHidden(sun.id, !1), showMenuPanel("Settings");
      })), section.append(row);
    }), section;
  }

  // src/ui/drag/drag.js
  var editToggle = () => (
    /** @type {HTMLButtonElement} */
    document.querySelector("#edit-toggle")
  ), editBar = () => (
    /** @type {HTMLElement} */
    document.querySelector("#edit-bar")
  ), editStatus = () => (
    /** @type {HTMLElement} */
    document.querySelector("#edit-status")
  ), editUndo = () => (
    /** @type {HTMLButtonElement} */
    document.querySelector("#edit-undo")
  );
  var DRAG_THRESHOLD = 6, DWELL_MS = 350, drag = null, cancelMessage = null, dragUndo = null, suppressNextClick = !1;
  var DRAG_HELP = {
    sun: "Drop beside another sun",
    planet: "Drop on a sun, or beside a planet",
    moon: "Drop on a planet, or beside a moon"
  };
  function storageToken() {
    try {
      return localStorage.getItem(workspaceKey(KEYS.map, activeWorkspace()));
    } catch {
      return;
    }
  }
  function announce(message, isError = !1) {
    editStatus().textContent = message, editStatus().classList.toggle("edit-status-error", isError);
  }
  function keepingScroll(action) {
    let top = window.scrollY;
    action(), app.classList.add("no-intro"), window.scrollTo({ top, behavior: "instant" });
  }
  function dragUndoValid() {
    return !!dragUndo && dragUndo.revision === store.state().revision && dragUndo.token === storageToken();
  }
  function updateEditBar() {
    dragUndo && !dragUndoValid() && (dragUndo = null), editUndo().hidden = !dragUndo;
  }
  function setEditMode(on) {
    modes.inEditMode() !== on && (cancelDrag(), modes.send(on ? "editOn" : "editOff"));
  }
  function showEditMode(on) {
    document.documentElement.dataset.edit = on ? "on" : "off", editToggle().setAttribute("aria-pressed", String(on)), editToggle().querySelector(".edit-toggle-state").textContent = on ? "On" : "Off", editBar().hidden = !on, announce(""), app.classList.contains("error-view") || keepingScroll(hooks.render), offerDueRoutines();
  }
  function pathOf(node) {
    let data = node.dataset, path = { kind: data.kind, sun: Number(data.sun) };
    return data.planet !== void 0 && (path.planet = Number(data.planet)), data.moon !== void 0 && (path.moon = Number(data.moon)), path;
  }
  function pathSelector(path) {
    let selector = `[data-kind="${path.kind}"][data-sun="${path.sun}"]`;
    return path.planet !== void 0 && (selector += `[data-planet="${path.planet}"]`), path.moon !== void 0 && (selector += `[data-moon="${path.moon}"]`), selector;
  }
  function focusPath(path) {
    for (
      let node of
      /** @type {NodeListOf<HTMLElement>} */
      app.querySelectorAll(pathSelector(path))
    ) {
      let holders = (
        /** @type {Element[]} */
        [node.closest(".home-orbit"), path.kind === "moon" && node.closest(".planet-cluster")].filter(Boolean)
      );
      if (holders.forEach((holder) => holder.classList.add("drag-open")), node.focus({ preventScroll: !0 }), holders.forEach((holder) => holder.classList.remove("drag-open")), document.activeElement === node) return;
    }
    editStatus().focus({ preventScroll: !0 });
  }
  function nameAt(path) {
    return mapItemAt(groups, path).name;
  }
  function trayRow(className, name, count, kind, ...indices) {
    let row = element("div", className);
    return kind && tagPath(row, kind, indices[0], indices[1], indices[2]), row.append(element("span", "tray-name", name)), count && row.append(element("span", "tray-count", count)), row;
  }
  function buildTray(pointerX) {
    let tray = element("aside", "drag-tray");
    tray.classList.add(pointerX > window.innerWidth / 2 ? "drag-tray-left" : "drag-tray-right");
    let current = Number(
      /** @type {HTMLElement} */
      app.querySelector(".detail-stage").dataset.sun
    ), forPlanet = drag.path.kind === "planet";
    return tray.append(element("h2", "", forPlanet ? "Move to another sun" : "Move to a planet")), groups.forEach((sun, sunIndex) => {
      if (forPlanet && sunIndex === current || sun.team) return;
      let group = element("div", "tray-group");
      !forPlanet && sunIndex === current && group.classList.add("open");
      let count = counted(sun.links.length, "planet");
      group.append(forPlanet ? trayRow("tray-row tray-head", sun.name, count, "sun", sunIndex) : trayRow("tray-head", sunIndex === current ? `${sun.name} (this System)` : sun.name, count));
      let list = element("div", "tray-list");
      sun.links.forEach((planet, planetIndex) => {
        let item = element("div", "tray-item");
        if (item.append(trayRow(
          "tray-row",
          planet.name,
          forPlanet ? "" : counted(planet.moons.length, "moon"),
          "planet",
          sunIndex,
          planetIndex
        )), !forPlanet && planet.moons.length) {
          item.classList.add("tray-expandable");
          let moons = element("div", "tray-sublist");
          planet.moons.forEach((moon, moonIndex) => moons.append(
            trayRow("tray-row tray-moon", moon.name, "", "moon", sunIndex, planetIndex, moonIndex)
          )), item.append(moons);
        }
        list.append(item);
      }), sun.links.length || list.append(element("p", "tray-empty", "No planets yet.")), group.append(list), tray.append(group);
    }), tray.append(element("p", "tray-hint", forPlanet ? "Pause on a sun to place the planet beside one of its planets." : "Pause on a sun to show its planets, and on a planet to show its moons.")), document.body.append(tray), tray;
  }
  function startDrag(event) {
    modes.send("passThreshold");
    try {
      drag.node.setPointerCapture(drag.pointerId);
    } catch {
    }
    window.getSelection()?.removeAllRanges(), document.documentElement.classList.add("dragging"), drag.node.classList.add("drag-source"), drag.path.kind !== "sun" && drag.node.closest(".home-orbit")?.classList.add("drag-open"), drag.path.kind === "moon" && drag.node.closest(".planet-cluster, .overflow-planet")?.classList.add("drag-open"), drag.preview = element("div", "drag-preview"), drag.preview.append(element("strong", "", drag.item.name), element("span", "drag-hint", "")), document.body.append(drag.preview), app.classList.contains("detail-view") && (drag.tray = buildTray(event.clientX)), announce(`Moving ${drag.path.kind} ${drag.item.name}. ${DRAG_HELP[drag.path.kind]}.`);
  }
  function showChoices(sibling, path) {
    if (drag.choices?.sibling === sibling) return;
    hideChoices();
    let box = element("div", "drop-choices");
    for (let [place, word] of [["before", "Before"], ["after", "After"]]) {
      let choice = element("div", "drop-choice", `${word} ${nameAt(path)}`);
      choice.dataset.place = place, box.append(choice);
    }
    document.body.append(box);
    let rect = sibling.getBoundingClientRect(), x = rect.left + rect.width / 2, y = rect.top + rect.height / 2, planet = path.kind === "moon" && sibling.closest(".planet-cluster")?.querySelector(":scope > :is(.home-satellite, .detail-satellite)");
    if (planet) {
      let from = planet.getBoundingClientRect(), dx = x - (from.left + from.width / 2), dy = y - (from.top + from.height / 2), length = Math.hypot(dx, dy) || 1, shift = rect.width * 0.15 + Math.abs(dx / length) * box.offsetWidth / 2 + Math.abs(dy / length) * box.offsetHeight / 2;
      x += dx / length * shift, y += dy / length * shift;
    }
    let clamp = (value, size, limit) => Math.max(8, Math.min(value, limit - size - 8));
    box.style.left = `${clamp(x - box.offsetWidth / 2, box.offsetWidth, window.innerWidth)}px`, box.style.top = `${clamp(y - box.offsetHeight / 2, box.offsetHeight, window.innerHeight)}px`, drag.choices = { box, sibling, path };
  }
  function hideChoices() {
    drag.choices?.box.remove(), drag.choices = null;
  }
  function siblingTarget(choice) {
    let { sibling } = drag.choices, path = { ...drag.choices.path, place: choice.dataset.place }, result = moveMapItem(groups, drag.path, path);
    if (result.status !== "moved") return { status: result.status === "same" ? "same" : "none", node: choice, path, sibling };
    let index = (
      /** @type {any} */
      result.path[drag.path.kind]
    );
    return { status: "valid", node: choice, path, sibling, position: `position ${index + 1} of ${result.total}` };
  }
  function resolveTarget(under) {
    if (!under) return { status: "none" };
    let kind = drag.path.kind;
    if (drag.choices && under.closest(".drop-choices")) {
      let choice = under.closest(".drop-choice");
      return choice ? siblingTarget(choice) : { status: "choose", node: drag.choices.sibling, path: drag.choices.path };
    }
    let tagged = under.closest("[data-kind]");
    if (tagged && groups[Number(tagged.dataset.sun)]?.team) return { status: "none" };
    let node = tagged;
    if (kind === "sun" && (node = under.closest(".group-card")?.querySelector(".home-hub") || null), node?.dataset.kind === kind) {
      let path2 = pathOf(node);
      return samePath(path2, drag.path) ? { status: "none" } : { status: "choose", node, path: path2 };
    }
    let want = (
      /** @type {Record<string, string>} */
      { planet: "sun", moon: "planet" }[kind]
    );
    if (node = want && tagged?.dataset.kind === want ? tagged : null, !node && want === "sun" && (node = under.closest(".home-orbit, .detail-stage")?.querySelector(".home-hub, .detail-hub") || null), !node) return { status: "none" };
    let path = pathOf(node);
    return { status: path.sun === drag.path.sun && (want === "sun" || path.planet === drag.path.planet) ? "same" : "valid", node, path };
  }
  function openDwell(node) {
    if (!(!modes.holding() || drag.dwellNode !== node)) {
      if (node.matches(".tray-group, .tray-item")) {
        let scope = node.matches(".tray-group") ? ".tray-group.open" : ".tray-item.open";
        for (let other of drag.tray.querySelectorAll(scope)) other.classList.remove("open");
        node.classList.add("open");
      } else
        node.classList.add("drag-open", "drag-reveal");
      drag.dwellNode = null, refreshDrag(), setTimeout(refreshDrag, 450);
    }
  }
  function dwellCandidate(under) {
    let branch = under.closest(".tray-expandable:not(.open), .tray-group:not(.open)");
    return branch || drag.path.kind === "sun" || under.closest(".drag-tray, .drop-choices") ? branch : (drag.path.kind === "moon" ? under.closest(".planet-cluster:not(.drag-open), .overflow-planet:not(.drag-open)") : null) || under.closest(".home-orbit:not(.drag-open)");
  }
  function updateDwell(under) {
    for (let reveal of app.querySelectorAll(".drag-reveal"))
      under && (reveal.contains(under) || under.closest(".drop-choices")) ? (clearTimeout(drag.closing.get(reveal)), drag.closing.delete(reveal)) : drag.closing.has(reveal) || drag.closing.set(reveal, setTimeout(() => {
        reveal.classList.remove("drag-open", "drag-reveal"), modes.holding() && drag.closing.delete(reveal), refreshDrag();
      }, DWELL_MS));
    let node = under ? dwellCandidate(under) : null;
    node !== drag.dwellNode && (clearTimeout(drag.dwellTimer), drag.dwellNode = node, node && (drag.dwellTimer = setTimeout(() => openDwell(node), DWELL_MS)));
  }
  function placePreview(x, y) {
    let left = x + 14, top = y + 16;
    if (drag.choices) {
      let box = drag.choices.box.getBoundingClientRect();
      left = box.right + 10, left + drag.preview.offsetWidth > window.innerWidth - 8 && (left = box.left - drag.preview.offsetWidth - 10), top = box.top;
    }
    drag.preview.style.transform = `translate(${left}px, ${top}px)`;
  }
  function updateDrag(x, y) {
    drag.x = x, drag.y = y;
    let under = document.elementFromPoint(x, y);
    updateDwell(under);
    let target = (
      /** @type {any} */
      resolveTarget(under)
    );
    if (target.status === "choose" ? showChoices(target.node, target.path) : target.sibling || hideChoices(), placePreview(x, y), !(target.node !== drag.target?.node || target.status !== drag.target?.status)) return;
    drag.target?.node?.classList.remove("drop-target", "drop-same"), drag.target?.sibling?.classList.remove("insert-before", "insert-after");
    let leftTarget = drag.target?.status === "valid";
    drag.target = target;
    let hint = drag.preview.querySelector(".drag-hint");
    drag.preview.classList.toggle("drag-preview-valid", target.status === "valid"), target.status === "valid" && target.sibling ? (target.node.classList.add("drop-target"), target.sibling.classList.add(`insert-${target.path.place}`), hint.textContent = `Insert ${target.path.place} ${nameAt(target.path)}, ${target.position}`, announce(`Insert ${drag.item.name} ${target.path.place} ${nameAt(target.path)}, ${target.position}. Release to place it.`)) : target.status === "valid" ? (target.node.classList.add("drop-target"), hint.textContent = `Drop to move to ${nameAt(target.path)}`, announce(`Over ${target.path.kind} ${nameAt(target.path)}. Release to move ${drag.item.name} here.`)) : target.status === "same" ? (target.node.classList.add("drop-same"), hint.textContent = target.sibling ? "Already in this position" : `Already in ${nameAt(target.path)}`) : target.status === "choose" ? (hint.textContent = `Choose Before or After ${nameAt(target.path)}`, announce(`Beside ${target.path.kind} ${nameAt(target.path)}. Choose Before or After.`)) : hint.textContent = DRAG_HELP[drag.path.kind], leftTarget && target.status !== "valid" && announce(`No drop target. ${hint.textContent}.`);
  }
  function refreshDrag() {
    modes.dragging() && updateDrag(drag.x, drag.y);
  }
  function endGesture(wasDragging) {
    let gesture = drag;
    clearTimeout(gesture.dwellTimer);
    for (let timer3 of gesture.closing.values()) clearTimeout(timer3);
    if (wasDragging && hideChoices(), drag = null, !wasDragging) return gesture;
    try {
      gesture.node.releasePointerCapture(gesture.pointerId);
    } catch {
    }
    gesture.preview.remove(), gesture.tray?.remove(), document.documentElement.classList.remove("dragging");
    let marks = ["drag-open", "drag-reveal", "drop-target", "drop-same", "drag-source", "insert-before", "insert-after"];
    for (let node of document.querySelectorAll(marks.map((mark) => `.${mark}`).join(", ")))
      node.classList.remove(...marks);
    return suppressNextClick = !0, gesture;
  }
  function cancelDrag(message = "Move cancelled. Nothing changed.") {
    return modes.holding() ? (cancelMessage = message, modes.send("cancelDrag"), !0) : !1;
  }
  function gestureEnded(wasDragging, event) {
    endGesture(wasDragging);
    let message = cancelMessage || "Move cancelled. Nothing changed.";
    cancelMessage = null, wasDragging && event !== "drop" && announce(message);
  }
  function commitMove(gesture, target) {
    if (gesture.token !== storageToken())
      return announce("The link map changed in another tab, so nothing was moved. Reload this page to pick up the latest map.", !0);
    if (gesture.revision !== store.state().revision || mapItemAt(groups, gesture.path) !== gesture.item)
      return announce("The link map changed during the drag, so nothing was moved.", !0);
    let result = moveMapItem(groups, gesture.path, target.path);
    if (result.status !== "moved") return announce("That is not a place this item can go. Nothing changed.");
    let previous = groups, where = target.path.place ? `${target.path.place} ${nameAt(target.path)}` : `to ${nameAt(target.path)}`, label = `${gesture.path.kind} ${gesture.item.name} ${where}`;
    try {
      keepingScroll(() => store.saveMap({ groups: result.groups }, `Moved ${label}`));
    } catch (error) {
      return announce(`The move could not be saved, so nothing changed. ${/** @type {any} */
      error.message}`, !0);
    }
    dragUndo = { groups: previous, revision: store.state().revision, token: storageToken(), label }, updateEditBar(), announce(`Moved ${label}.`), focusPath(result.path);
  }
  function undoDrag() {
    let record = dragUndo;
    if (!dragUndoValid())
      return dragUndo = null, updateEditBar(), announce("The link map has changed since that drag, so it can no longer be undone.", !0);
    try {
      keepingScroll(() => store.saveMap({ groups: record.groups }, `Undid the move of ${record.label}`));
    } catch (error) {
      return announce(`Undo could not be saved, so nothing changed. ${/** @type {any} */
      error.message}`, !0);
    }
    dragUndo = null, updateEditBar(), announce(`Undid the move of ${record.label}.`), editStatus().focus({ preventScroll: !0 });
  }
  function guardActivation(event) {
    if (suppressNextClick) {
      suppressNextClick = !1, event.preventDefault(), event.stopPropagation();
      return;
    }
    if (!modes.linkOpensEditor("app") || !(event.target instanceof Element)) return;
    let shortcut = event.target.closest("[data-edit-path]");
    if (shortcut && app.contains(shortcut)) {
      event.preventDefault(), event.stopPropagation(), event.type === "click" && openEditorAt(shortcut.dataset.editPath.split(":").map(Number));
      return;
    }
    let node = event.target.closest('[data-kind="planet"], [data-kind="moon"]');
    !node || !app.contains(node) || (event.preventDefault(), event.stopPropagation(), announce(`Links are closed in Edit mode. Drag ${node.textContent} to move it, or turn Edit mode off to open it.`));
  }
  function installDrag() {
    document.addEventListener("pointerdown", (event) => {
      if (suppressNextClick = !1, modes.state().mode !== "editIdle" || modes.menuOpen() || event.button !== 0 || !event.isPrimary || event.pointerType === "touch") return;
      let node = event.target instanceof Element ? event.target.closest("[data-kind]") : null;
      if (!node || !app.contains(node)) return;
      let path = pathOf(node);
      if (groups[path.sun]?.team) {
        announce("Team suns are read-only. Copy an item to your map in Edit links to rearrange it.");
        return;
      }
      let item = mapItemAt(groups, path);
      !item || path.kind === "sun" && !node.classList.contains("home-hub") || modes.send("press") && (drag = {
        pointerId: event.pointerId,
        node,
        path,
        item,
        closing: /* @__PURE__ */ new Map(),
        revision: store.state().revision,
        token: storageToken(),
        startX: event.clientX,
        startY: event.clientY
      });
    }), document.addEventListener("pointermove", (event) => {
      if (!(!modes.holding() || event.pointerId !== drag.pointerId)) {
        if (!modes.dragging()) {
          if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < DRAG_THRESHOLD) return;
          startDrag(event);
        }
        updateDrag(event.clientX, event.clientY);
      }
    }), document.addEventListener("pointerup", (event) => {
      if (!modes.holding() || event.pointerId !== drag.pointerId) return;
      let dragging = modes.dragging();
      dragging && updateDrag(event.clientX, event.clientY);
      let target = drag.target, gesture = drag;
      modes.send(dragging ? "drop" : "release"), dragging && (target?.status === "valid" ? commitMove(gesture, target) : target?.status === "same" ? announce(target.sibling ? `${gesture.item.name} is already in that position. Nothing changed.` : `${gesture.item.name} is already in ${nameAt(target.path)}. Nothing changed.`) : target?.status === "choose" ? announce(`Choose Before or After to place ${gesture.item.name} beside ${nameAt(target.path)}. Nothing changed.`) : announce("That was not a drop target. Nothing changed."));
    }), document.addEventListener("pointerup", () => setTimeout(() => {
      suppressNextClick = !1;
    }, 0)), document.addEventListener("pointercancel", (event) => {
      modes.holding() && event.pointerId === drag.pointerId && cancelDrag();
    }), document.addEventListener("lostpointercapture", (event) => {
      modes.dragging() && event.target === drag.node && event.pointerId === drag.pointerId && cancelDrag();
    }), window.addEventListener("blur", () => cancelDrag("Move cancelled because the window lost focus. Nothing changed.")), window.addEventListener("scroll", () => {
      modes.dragging() && hideChoices(), refreshDrag();
    }, { passive: !0 }), window.addEventListener("resize", refreshDrag), window.addEventListener("storage", updateEditBar), document.addEventListener("click", guardActivation, !0), document.addEventListener("auxclick", guardActivation, !0), document.addEventListener("dragstart", (event) => {
      modes.inEditMode() && event.target instanceof Node && app.contains(event.target) && event.preventDefault();
    });
    let editBarButtons = () => {
      editToggle().addEventListener("click", () => setEditMode(!modes.inEditMode())), editUndo().addEventListener("click", undoDrag), document.querySelector("#edit-done").addEventListener("click", () => {
        setEditMode(!1), editToggle().focus();
      }), document.querySelector("#edit-open-editor").addEventListener("click", () => {
        openMenu(), openEditorPage();
      });
    };
    document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", editBarButtons) : editBarButtons();
  }

  // src/core/search.js
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
    if (isGroup(item)) return "";
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
      return path && list.push({ kind: "path", text: path.toLocaleLowerCase(), weight: 0.7 }), item && (isGroup(item) || list.push({ kind: "address", text: addressText(item).toLocaleLowerCase(), weight: 0.6 }), item.tags?.length && list.push({ kind: "tag", text: item.tags.join(" "), weight: 0.8 }), item.note && list.push({ kind: "note", text: item.note.toLocaleLowerCase(), weight: 0.5 })), list.map((field) => ({ ...field, words: searchWords(field.text) }));
    };
    return groups2.forEach((sun, sunIndex) => {
      entries.push({
        match: { kind: "Sun", name: sun.name, path: sun.team ? "Team Galaxy" : "Galaxy", id: sun.id, icon: sun.icon },
        tags: [],
        fields: fields(sun.name)
      }), sun.links.forEach((planet, planetIndex) => {
        entries.push({
          match: {
            kind: isGroup(planet) ? "Group" : "Planet",
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

  // src/ui/editor/quick-add.js
  function typedAddress(text) {
    let value = String(text || "").trim();
    if (/\s/.test(value) || !value) return null;
    let candidate = /^https?:\/\//i.test(value) ? value : /^www\.[^.\s]+\.[^\s]+$/i.test(value) ? `https://${value}` : null;
    if (!candidate) return null;
    try {
      let url = new URL(candidate);
      return url.hostname.includes(".") || url.hostname === "localhost" ? candidate : null;
    } catch {
      return null;
    }
  }
  function suggestedName(address) {
    try {
      let host = new URL(address.replace(PLACEHOLDER, "x")).hostname.replace(/^www\./, ""), word = host.split(".")[0];
      return word ? word[0].toUpperCase() + word.slice(1) : host;
    } catch {
      return "";
    }
  }
  function quickAddResult(address) {
    let node = element("button", "find-item find-add");
    node.type = "button", node.append(element("span", "find-kind", "Add"));
    let copy = element("span", "find-copy");
    return copy.append(element("strong", "", "Add this link to your map"), element("small", "", address)), node.append(copy, element("span", "find-arrow", "+")), node.addEventListener("click", () => showQuickAdd(address)), node;
  }
  function showQuickAdd(address = "") {
    modes.menuOpen() || openMenu(), editorTree || openEditorPage(), editorHeader("Add a link", nav.showSunList);
    let targets = [];
    if (groups.forEach((sun, sunIndex) => {
      sun.team || (targets.push([`sun:${sunIndex}`, `${sun.name} (as a planet)`]), sun.links.forEach((planet, planetIndex) => targets.push([`planet:${sunIndex}:${planetIndex}`, `${sun.name} → ${planet.name} (as a moon)`])));
    }), !targets.length) {
      menuContent.append(element("p", "editor-note", "Add a sun to your map first; links are added to a sun as planets or to a planet as moons.")), editorActions().append(editorButton("Add sun", () => nav.showSunEditor(null), "editor-primary"));
      return;
    }
    menuContent.append(element("p", "", "Add a website to a sun as a planet, or to a planet as a moon."));
    let form = element("form", "editor-form"), url = editorField("Address", address, "url");
    url.input.setAttribute("aria-label", "Address");
    let name = editorField("Name", address ? suggestedName(address) : "");
    name.input.setAttribute("aria-label", "Name");
    let nameEdited = !1;
    name.input.addEventListener("input", () => {
      nameEdited = !0;
    }), url.input.addEventListener("input", () => {
      nameEdited || (name.input.value = suggestedName(url.input.value));
    });
    let paste = editorButton("Paste from clipboard", async () => {
      try {
        let text = (await navigator.clipboard.readText()).trim();
        url.input.value = typedAddress(text) || text, url.input.dispatchEvent(new Event("input"));
      } catch {
        editorError("The browser did not allow Orbit to read the clipboard. Click in Address and press Ctrl+V instead.");
      }
    }), target = element("label", "editor-field");
    target.append(element("span", "", "Add to"));
    let select = document.createElement("select");
    select.setAttribute("aria-label", "Add to"), targets.forEach(([value, label]) => {
      let option = element("option", "", label);
      option.value = value, select.append(option);
    }), target.append(select);
    let actions = element("div", "editor-actions"), save = element("button", "editor-primary", "Add link");
    save.type = "submit", actions.append(save), form.append(url.wrapper, paste, name.wrapper, target, actions), form.addEventListener("submit", (event) => {
      event.preventDefault();
      let address2 = typedAddress(url.input.value) || url.input.value.trim(), value = { name: name.input.value.trim() || suggestedName(address2), url: address2 }, next = copyGroups(), [kind, sunIndex, planetIndex] = select.value.split(":");
      if (kind === "sun")
        next[Number(sunIndex)].links.push({ ...value, moons: [] }), applyEditorChange(
          next,
          () => nav.showPlanetEditor(Number(sunIndex), next[Number(sunIndex)].links.length - 1),
          { label: `Added planet ${value.name}` }
        );
      else {
        let moons = next[Number(sunIndex)].links[Number(planetIndex)].moons;
        moons.push(value), applyEditorChange(
          next,
          () => nav.showMoonEditor(Number(sunIndex), Number(planetIndex), moons.length - 1),
          { label: `Added moon ${value.name}` }
        );
      }
    }), menuContent.append(form), (address ? name.input : url.input).focus();
  }

  // src/ui/editor/tools/packs.js
  function exportPack(name, items, routine = null) {
    let slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "pack", pack = { format: "orbit-pack-v1", name, links: items.map(packLink) };
    routine && (pack.routine = { name: routine.name, ...routine.schedule ? { schedule: routine.schedule } : {} }), downloadJson(pack, `orbit-pack-${slug}.json`);
  }
  function shareRoutine(routine) {
    exportPack(routine.name, routineItems(routine).items.map((entry) => entry.item), routine);
  }
  function shareGroup(group) {
    exportPack(group.name, group.moons);
  }
  function shareFavorites() {
    let items = favoriteItems().map((entry) => entry.item);
    if (!items.length) return editorError("You have no favorites to share yet.");
    exportPack("Favorites", items);
  }
  function showPackImport() {
    editorHeader("Link pack", nav.showSunList), menuContent.append(element("p", "", "A link pack is a small file someone shared from their Orbit: a routine or their favorites. Choose the file, or paste its text."));
    let text = editorField("Pack text", "", "textarea");
    text.input.setAttribute("aria-label", "Pack text"), text.input.placeholder = '{"format": "orbit-pack-v1", …}', editorActions().append(editorButton("Choose pack file", () => selectJsonFile((data) => showPackReview(validPack(data))))), menuContent.append(text.wrapper), editorActions().append(editorButton("Review pasted pack", () => {
      try {
        showPackReview(validPack(JSON.parse(text.input.value)));
      } catch (error) {
        editorError(`Import failed: ${/** @type {Error} */
        error.message}`);
      }
    }, "editor-primary"));
  }
  function showPackReview(pack) {
    editorHeader(`Review ${pack.name}`, showPackImport);
    let known = pack.links.filter((link) => pathsForKey(groups, destinationKey(link)).length), fresh = pack.links.filter((link) => !pathsForKey(groups, destinationKey(link)).length);
    menuContent.append(element("p", "import-merge-summary", `${counted(pack.links.length, "link")}: ${counted(fresh.length, "new link")} to add${known.length ? `, ${known.length} already on your map` : ""}.`));
    let list = element("ul", "rdp-batch-list");
    pack.links.forEach((link) => list.append(element("li", "", `${link.name} → ${link.type === "rdp" ? link.host : link.url}${known.includes(link) ? " (already on your map)" : ""}`))), menuContent.append(list);
    let target = element("label", "editor-field");
    target.append(element("span", "", "Add new links to"));
    let select = document.createElement("select");
    select.setAttribute("aria-label", "Add new links to");
    let option = element("option", "", `A new sun named ${pack.name}`);
    option.value = "new", select.append(option), groups.forEach((sun, index) => {
      if (sun.team) return;
      let item = element("option", "", `${sun.name} (as planets)`);
      item.value = String(index), select.append(item);
    }), target.append(select), menuContent.append(target);
    let withRoutine = null;
    if (pack.routine) {
      let row = element("label", "editor-check");
      withRoutine = document.createElement("input"), withRoutine.type = "checkbox", withRoutine.checked = !0, withRoutine.setAttribute("aria-label", "Also add the routine"), row.append(withRoutine, element("span", "", `Also add the routine “${pack.routine.name}”`)), menuContent.append(row);
    }
    editorActions().append(editorButton("Add to my map", () => {
      let next = copyGroups();
      if (fresh.length) {
        let planets = fresh.map((link) => ({ ...link, moons: [] }));
        select.value === "new" ? next.push({
          id: uniqueSunId(pack.name, new Set(next.map((sun) => sun.id))),
          name: pack.name,
          description: "Shared link pack",
          color: "#79d9f8",
          links: planets
        }) : next[Number(select.value)].links.push(...planets);
      }
      let nextRoutines;
      if (withRoutine?.checked && pack.routine) {
        let taken = new Set(routines.map((routine) => routine.name.toLocaleLowerCase())), name = pack.routine.name;
        for (let n = 2; taken.has(name.toLocaleLowerCase()); n++) name = `${pack.routine.name} ${n}`;
        nextRoutines = [...routines, {
          name,
          links: pack.links.map((link) => ({ key: destinationKey(link), name: link.name })),
          ...pack.routine.schedule ? { schedule: pack.routine.schedule } : {}
        }];
      }
      applyEditorChange(next, nav.showSunList, {
        label: `Imported link pack ${pack.name}`,
        ...nextRoutines ? { routines: nextRoutines } : {}
      });
    }, "editor-primary"));
  }

  // src/ui/editor/tools/routines.js
  var DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], WEEKDAYS = [1, 2, 3, 4, 5];
  function scheduleText(schedule2) {
    if (!schedule2) return "No schedule";
    let days = schedule2.days.join(",") === WEEKDAYS.join(",") ? "weekdays" : schedule2.days.length === 7 ? "every day" : schedule2.days.map((day) => DAY_NAMES[day]).join(", ");
    return `Offered at ${schedule2.time}, ${days}`;
  }
  function showRoutines() {
    editorHeader("Routines", nav.showSunList), menuContent.append(element("p", "", "A routine opens a set of links together, such as the sites you start every morning with. It can also offer itself when Orbit opens at a set time, which works well with Orbit as your browser’s startup page.")), routines.length || menuContent.append(element("p", "editor-note", "No routines yet."));
    let list = element("div", "editor-list");
    routines.forEach((routine, index) => {
      let { items, missing } = routineItems(routine), row = element("div", "editor-list-row routine-row"), copy = element("span", "history-copy");
      copy.append(element("strong", "", routine.name)), copy.append(element("small", "", `${counted(items.length, "link")}${missing ? ` (${missing} no longer on the map)` : ""} · ${scheduleText(routine.schedule)}`)), row.append(copy), row.append(editorButton("Open", () => runRoutine(routine))), row.append(editorButton("Share", () => shareRoutine(routine))), row.append(editorButton("Edit", () => showRoutineEditor(index))), list.append(row);
    }), menuContent.append(list), editorActions().append(editorButton("New routine", () => showRoutineEditor(null), "editor-primary"));
  }
  function routineCheckbox(item, label, key, checked) {
    let row = element("label", "editor-check routine-choice"), box = document.createElement("input");
    return box.type = "checkbox", box.value = key, box.checked = checked, box.dataset.name = item.name, row.append(box, element("span", "", label)), row.dataset.search = label.toLocaleLowerCase(), row;
  }
  function showRoutineEditor(index) {
    let isNew = index === null, routine = isNew ? { name: "", links: [], schedule: null } : routines[index];
    editorHeader(isNew ? "New routine" : `Edit ${routine.name}`, showRoutines);
    let form = element("form", "editor-form"), name = editorField("Routine name", routine.name);
    name.input.setAttribute("aria-label", "Routine name"), name.input.placeholder = "For example: Morning", form.append(name.wrapper);
    let offer = element("label", "editor-check"), offerBox = document.createElement("input");
    offerBox.type = "checkbox", offerBox.checked = !!routine.schedule, offerBox.setAttribute("aria-label", "Offer this routine when Orbit opens"), offer.append(offerBox, element("span", "", "Offer this routine when Orbit opens"));
    let schedule2 = element("div", "routine-schedule"), time = editorField("From", routine.schedule?.time || "08:00", "time");
    time.input.setAttribute("aria-label", "Offer from");
    let days = element("div", "routine-days");
    days.setAttribute("role", "group"), days.setAttribute("aria-label", "Days");
    let dayBoxes = DAY_NAMES.map((label, day) => {
      let option = element("label", "editor-check routine-day"), box = document.createElement("input");
      return box.type = "checkbox", box.checked = (routine.schedule?.days || WEEKDAYS).includes(day), box.setAttribute("aria-label", label), option.append(box, element("span", "", label)), days.append(option), box;
    });
    schedule2.append(time.wrapper, days, element("small", "editor-hint", "Browsers open tabs only after a click, so Orbit asks with an Open button instead of opening them by itself. It asks once a day."));
    let updateSchedule = () => {
      schedule2.hidden = !offerBox.checked;
    };
    offerBox.addEventListener("change", updateSchedule), updateSchedule(), form.append(offer, schedule2), form.append(element("h4", "editor-section-title", "Links"));
    let chosen = new Set(routine.links.map((link) => link.key)), summary = element("p", "data-source routine-summary"), filter = editorField("Filter", "");
    filter.input.setAttribute("aria-label", "Filter links"), filter.input.placeholder = "Type to narrow the list";
    let choices = element("div", "routine-choices"), seen = /* @__PURE__ */ new Set();
    groups.forEach((sun) => {
      let block = element("fieldset", "routine-sun");
      block.append(element("legend", "", `${sun.name}${sun.team ? " (team)" : ""}`)), sun.links.forEach((planet) => {
        [[planet, planet.name], ...planet.moons.map((moon) => [moon, `${planet.name} → ${moon.name}`])].forEach(([item, label]) => {
          if (isGroup(item)) return;
          let key = destinationKey(item);
          seen.has(key) || (seen.add(key), block.append(routineCheckbox(item, `${label}${item.type === "rdp" ? " (Remote Desktop, not opened)" : ""}`, key, chosen.has(key))));
        });
      }), block.querySelector("input") && choices.append(block);
    });
    let updateSummary = () => {
      let count = choices.querySelectorAll("input:checked").length;
      summary.textContent = `${counted(count, "link")} chosen. They open in map order; links you already had keep their place.`;
    };
    choices.addEventListener("change", updateSummary), filter.input.addEventListener("input", () => {
      let needle = filter.input.value.trim().toLocaleLowerCase();
      for (
        let row of
        /** @type {NodeListOf<HTMLElement>} */
        choices.querySelectorAll(".routine-choice")
      ) row.hidden = !!needle && !/** @type {string} */
      row.dataset.search.includes(needle);
    }), updateSummary(), form.append(summary, filter.wrapper, choices);
    let actions = element("div", "editor-actions"), save = element("button", "editor-primary", isNew ? "Add routine" : "Save routine");
    save.type = "submit", actions.append(save), isNew || actions.append(editorButton("Remove routine", () => {
      if (!confirmed(`Remove the ${routine.name} routine? The links stay on your map.`)) return;
      let next = routines.filter((_, i) => i !== index);
      applyEditorChange(copyGroups(), showRoutines, { routines: next, label: `Removed routine ${routine.name}` });
    }, "editor-danger")), form.append(actions), form.addEventListener("submit", (event) => {
      event.preventDefault();
      let boxes = [.../** @type {NodeListOf<HTMLInputElement>} */
      choices.querySelectorAll("input:checked")], picked = new Map(boxes.map((box) => [box.value, box.dataset.name])), links = routine.links.filter((link) => picked.has(link.key));
      for (let [key, linkName] of picked)
        links.some((link) => link.key === key) || links.push({ key, name: linkName });
      if (!links.length) return editorError("Choose at least one link for this routine.");
      let value = { name: name.input.value.trim(), links };
      isNew || (value.id = routine.id), offerBox.checked && (value.schedule = { time: time.input.value, days: dayBoxes.flatMap((box, day) => box.checked ? [day] : []) });
      let next = [...routines];
      isNew ? next.push(value) : next[index] = value, applyEditorChange(copyGroups(), showRoutines, { routines: next, label: `${isNew ? "Added" : "Saved"} routine ${value.name}` });
    }), menuContent.append(form);
  }

  // src/ui/views/group-planets.js
  var pendingGroup = null;
  function setGroupExpanded(cluster, expanded = !0) {
    cluster.classList.toggle("pinned", expanded), cluster.querySelector(".group-planet")?.setAttribute("aria-expanded", String(expanded));
  }
  function collapseGroup() {
    let cluster = app.querySelector(".pinned");
    return cluster ? (cluster.contains(document.activeElement) && !document.activeElement?.matches(".group-planet") && cluster.querySelector(".group-planet")?.focus(), setGroupExpanded(cluster, !1), !0) : !1;
  }
  function openGroup(sun, planet) {
    let id = groups[sun]?.id;
    if (!id) return;
    let route = `group/${encodeURIComponent(id)}`;
    pendingGroup = { id, planet }, setFindQuery(""), quickFind.value = "", location.hash === `#${route}` ? revealPendingGroup(id) : location.hash = route;
  }
  function revealPendingGroup(id) {
    let next = pendingGroup;
    if (pendingGroup = null, !next || id !== next.id) return;
    let button = (
      /** @type {HTMLButtonElement|null} */
      app.querySelector(`.group-planet[data-planet="${next.planet}"]`)
    ), cluster = button?.parentElement;
    !button || !cluster || (collapseGroup(), setGroupExpanded(cluster), button.focus(), button.scrollIntoView({ block: "nearest" }));
  }

  // src/ui/layout/orbits.js
  var GALAXY_PLANETS = 5, SYSTEM_PLANETS = 8, VISIBLE_MOONS = 6, galaxyReach = (planet) => 91 + planet / 2, SITE_ICON_ROOM = 19;
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
      names: () => groups.flatMap((sun) => sun.links.slice(0, GALAXY_PLANETS))
    },
    detail: {
      selector: ".detail-satellite",
      variable: "--detail-planet-size",
      base: () => Math.min(100, Math.max(70, window.innerWidth * 0.16)),
      max: 140,
      names: () => groups.flatMap((sun) => sun.links.slice(0, SYSTEM_PLANETS))
    },
    moon: {
      selector: ".moon-link",
      variable: "--moon-size",
      base: () => 72,
      max: 88,
      names: () => groups.flatMap((sun) => sun.links.flatMap((planet) => planet.moons.slice(0, VISIBLE_MOONS)))
    },
    more: {
      selector: ".more-link",
      variable: "--more-planet-size",
      base: () => 90,
      max: 130,
      names: () => groups.flatMap((sun) => sun.links.slice(SYSTEM_PLANETS))
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
      let cache = /* @__PURE__ */ new Map(), measure = (text) => (cache.has(text) || cache.set(text, context.measureText(text).width), cache.get(text)), padding = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.borderLeftWidth) || 0), lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2, names = [...new Set(level.names().map((item) => item.name))], extra = showSiteIcons ? SITE_ICON_ROOM : 0, size = Math.round(base);
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
    }), lift = Math.sin(angle) * galaxyReach(planet);
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
  function markCaptionFans() {
    let planet = orbitSizes.home || 72;
    for (
      let orbit of
      /** @type {NodeListOf<HTMLElement>} */
      app.querySelectorAll(".home-orbit")
    ) {
      let caption = (
        /** @type {HTMLElement | null} */
        orbit.parentElement?.querySelector(":scope > .group-description") ?? null
      ), center = orbit.offsetTop + orbit.offsetHeight / 2;
      for (
        let field of
        /** @type {NodeListOf<HTMLElement>} */
        orbit.querySelectorAll(".moon-field")
      ) {
        let bottom = center + Math.sin(Number(field.dataset.angle)) * galaxyReach(planet) + Number(field.dataset.drop);
        field.closest(".planet-cluster")?.toggleAttribute(
          "data-covers-caption",
          !!caption?.textContent && bottom > /** @type {HTMLElement} */
          caption.offsetTop
        );
      }
    }
  }
  function layoutOrbits() {
    fitOrbitSizes(), app.querySelectorAll(".moon-field").forEach(layoutMoonField);
    let firstCard = (
      /** @type {HTMLElement | null} */
      app.querySelector(".group-card")
    ), firstRow = firstCard?.offsetTop, orbitMargin = parseFloat(getComputedStyle(firstCard?.querySelector(".home-orbit") ?? document.body).marginTop) || 0, fans = (
      /** @type {HTMLElement[]} */
      [...app.querySelectorAll(".home-orbit .moon-field")].filter((field) => (
        /** @type {HTMLElement} */
        field.closest(".group-card").offsetTop === firstRow
      )).map((field) => Number(field.dataset.rise))
    ), extra = Math.max(0, ...fans) - 242 - (firstCard ? orbitMargin : 0);
    document.documentElement.style.setProperty("--galaxy-fan-room", `${Math.max(0, Math.ceil(extra))}px`), markCaptionFans();
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

  // src/ui/find/results.js
  function findCopy(match) {
    let copy = element("span", "find-copy");
    return copy.append(element("strong", "", `${match.icon ? `${match.icon} ` : ""}${match.name}`), element("small", "", match.kind === "Group" ? `Group in ${match.path}` : match.path)), match.why && copy.append(element("small", "find-why", match.why)), match.destination?.note && copy.append(element("small", "find-note", match.destination.note)), match.tags?.length && copy.append(tagChips(match.tags)), copy;
  }
  function editFindResult(match) {
    let node = element("button", "find-item find-item-edit");
    return node.type = "button", node.title = `Edit ${match.name} in Edit links`, node.addEventListener("click", () => openEditorAt(match.indices)), node.append(element("span", "find-kind", match.kind), findCopy(match)), node.append(element("span", "find-arrow find-edit-label", "Edit")), node;
  }
  function findResult(match) {
    if (modes.inEditMode() && match.indices) return editFindResult(match);
    let group = match.kind === "Group", isRdp = match.destination?.type === "rdp", download = isRdp && rdpLaunchMode === "download", template = match.destination && !group && !isRdp && templateNames(match.destination.url).length > 0, node = (
      /** @type {HTMLAnchorElement & HTMLButtonElement} */
      element(match.id || group || download || template ? "button" : "a", "find-item")
    );
    return match.id ? (node.type = "button", node.addEventListener("click", () => {
      location.hash = `group/${encodeURIComponent(match.id)}`;
    })) : group ? (node.type = "button", node.addEventListener("click", () => openGroup(match.indices[0], match.indices[1]))) : template ? (node.type = "button", node.dataset.template = "true", node.addEventListener("click", () => askForVariables(match.destination))) : download ? (node.type = "button", node.addEventListener("click", () => downloadRdp(match.destination, rdpPresets)), node.title = `Download Remote Desktop connection for ${match.name}`) : isRdp ? (node.href = rdpLaunchUrl(match.destination, rdpPresets), node.title = `Open Remote Desktop Connection for ${match.name}`) : (node.href = match.destination.url, node.target = "_blank", node.rel = "noopener noreferrer"), match.indices && !group && (node.dataset.destination = match.indices.join(":")), node.append(element("span", "find-kind", match.kind), findCopy(match)), node.append(element("span", "find-arrow", match.id || group ? "→" : download ? "↓" : "↗")), node;
  }
  function findRow(match) {
    let result = findResult(match);
    if (!match.indices) return result;
    let row = element("div", "find-row");
    if (match.kind === "Group")
      return row.append(result), row;
    let sun = groups[match.indices[0]], on = isFavorite(match.destination, sun), star = element("button", `favorite-toggle${on ? " is-favorite" : ""}`, on ? "★" : "☆");
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
    ), anchor2 = (
      /** @type {HTMLAnchorElement} */
      node
    );
    return template ? (button.type = "button", node.dataset.template = "true", node.addEventListener("click", () => askForVariables(link)), node.title = `Open ${link.name} (asks for ${templateNames(link.url).join(", ")})`, node.setAttribute("aria-label", node.title)) : download ? (button.type = "button", node.addEventListener("click", () => downloadRdp(link, rdpPresets)), node.title = `Download Remote Desktop connection for ${link.name}`, node.setAttribute("aria-label", node.title)) : isRdp ? (anchor2.href = rdpLaunchUrl(link, rdpPresets), node.title = `Open Remote Desktop Connection for ${link.name}`, node.setAttribute("aria-label", node.title)) : (anchor2.href = link.url, anchor2.target = "_blank", anchor2.rel = "noopener noreferrer", node.title = `Open ${link.name} in a new tab`, node.setAttribute("aria-label", node.title)), link.note && (node.title = `${node.title}
${link.note}`), node;
  }
  function linkNode(link, className, path) {
    let node = isGroup(link) ? groupButton(link, className) : destinationNode(link, className, path);
    return path && (tagPath(node, path.length === 3 ? "moon" : "planet", path[0], path[1], path[2]), modes.inEditMode() ? (node.title = `Drag ${link.name} to move it`, node.setAttribute("aria-label", `${link.name}. Links are paused in Edit mode.`)) : node.setAttribute("aria-keyshortcuts", "E")), node;
  }
  function groupButton(group, className) {
    let button = element("button", `${className} group-planet`, group.name);
    button.type = "button";
    let count = counted(group.moons.length, "link");
    return button.title = `${group.name}: a group of ${count}`, group.note && (button.title += `
${group.note}`), button.setAttribute("aria-label", `${group.name}, a group of ${count}`), button.setAttribute("aria-expanded", "false"), button;
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
    let cluster = element("div", `planet-cluster ${context}-planet-cluster`), group = isGroup(link);
    if (group && cluster.classList.add("group-cluster"), cluster.style.setProperty("--x", `${point.x / size * 100}%`), cluster.style.setProperty("--y", `${point.y / size * 100}%`), cluster.style.setProperty("--cos", Math.cos(point.angle).toFixed(4)), cluster.style.setProperty("--sin", Math.sin(point.angle).toFixed(4)), cluster.style.setProperty("--delay", `${index * (context === "home" ? 35 : 50)}ms`), cluster.append(linkNode(link, context === "home" ? "home-satellite" : "detail-satellite", [sunIndex, index])), link.moons.length) {
      let field = element("div", "moon-field");
      field.dataset.angle = String(point.angle), field.dataset.context = context, link.moons.slice(0, VISIBLE_MOONS).forEach((moon, moonIndex) => field.append(linkNode(moon, "moon-link", [sunIndex, index, moonIndex]))), cluster.append(field);
    }
    if (link.moons.length || group) {
      let label = link.moons.length ? counted(link.moons.length, group ? "link" : "moon") : "No links yet";
      cluster.append(element("span", "moon-badge", label));
    }
    return cluster;
  }
  function overflowPlanetNode(link, sunIndex, planetIndex) {
    let item = element("div", "overflow-planet"), group = isGroup(link);
    if (group && item.classList.add("group-cluster"), item.append(linkNode(link, "more-link", [sunIndex, planetIndex])), link.moons.length) {
      let moons = element("div", "overflow-moons");
      link.moons.forEach((moon, moonIndex) => moons.append(
        linkNode(moon, "overflow-moon-link", [sunIndex, planetIndex, moonIndex])
      )), item.append(moons);
    }
    return group && item.append(element(
      "span",
      "overflow-group-count",
      link.moons.length ? counted(link.moons.length, "link") : "No links yet"
    )), item;
  }
  function homeGroup(group, index) {
    let card = element("section", "group-card");
    card.style.setProperty("--sun-accent", safeColor(group.color)), card.style.setProperty("--card-index", String(index));
    let orbit = element("div", "home-orbit");
    orbit.dataset.sun = String(index);
    let visible = group.links.slice(0, GALAXY_PLANETS), center = 160, radius = 108, points = visible.map((_, i) => {
      let angle = (-90 + 360 / visible.length * i) * Math.PI / 180;
      return { x: center + Math.cos(angle) * radius, y: center + Math.sin(angle) * radius, angle };
    });
    orbit.append(orbitLines(points, center, 320));
    let hub = element("button", "home-hub");
    return hub.type = "button", tagPath(hub, "sun", index), modes.inEditMode() || hub.setAttribute("aria-keyshortcuts", "E"), hub.setAttribute("aria-label", `Open ${group.team ? "team " : ""}${group.name} system with ${counted(group.links.length, "planet")}`), group.icon && hub.append(element("span", "hub-icon", group.icon)), hub.append(element("span", "hub-name", group.name)), hub.append(element("span", "hub-count", counted(group.links.length, "planet").toUpperCase())), group.team && (card.classList.add("team-card"), hub.append(element("span", "team-mark", "TEAM"))), hub.addEventListener("click", () => {
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
    let group = isGroup(item), node = group ? element("h3", "list-link list-group") : destinationNode(item, "list-link", path);
    if (node.dataset.editPath = path.join(":"), group)
      if (modes.inEditMode()) {
        let edit = element("button", "list-link", item.name);
        edit.type = "button", node.append(edit);
      } else node.textContent = item.name;
    return isFavorite(item, sun) && node.append(element("span", "list-favorite", " ★")), item.note && node.append(element("span", "list-note-text", ` — ${item.note}`)), item.tags?.length && node.append(tagChips(item.tags)), node;
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
        isGroup(planet) && !planet.moons.length && row.append(element("p", "list-empty", "No links yet")), planets.append(row);
      }), sun.links.length || planets.append(element("li", "list-empty", "No planets yet.")), section.append(planets), list.append(section);
    }), list;
  }
  function refreshQuickBar() {
    if (!app.classList.contains("home-view")) return;
    let old = app.querySelector(":scope > .quick-bar"), next = quickBar(), searching = !!quickFind.value.trim();
    next && (next.hidden = searching), old && next ? old.replaceWith(next) : old ? old.remove() : next && app.querySelector(":scope > .find-results")?.after(next);
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
      empty.append(element("h1", "", `${workspaceName(activeWorkspace())} is empty`)), empty.append(element("p", "", "Add a sun in Edit links, paste a web address into Quick find, or import a map or a link pack."));
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
    return row.append(element("span", "open-all-label", planets.some(({ planet }) => isGroup(planet)) ? "Open all links for a planet:" : "Open a planet with all its moons:")), planets.forEach(({ planet, planetIndex }) => {
      let groupPlanet = isGroup(planet), button = element("button", "open-all-button", groupPlanet ? `${planet.name} · ${counted(planet.moons.length, "link")}` : `${planet.name} + ${counted(planet.moons.length, "moon")}`);
      button.type = "button", button.title = groupPlanet ? `Open links in ${planet.name} in new tabs (Shift+click the group does the same)` : `Open ${planet.name} and its moons in new tabs (Shift+click a planet does the same)`, button.addEventListener("click", () => openAll(sunIndex, planetIndex)), row.append(button);
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
    let visible = group.links.slice(0, SYSTEM_PLANETS), center = 320, radius = 205, points = visible.map((_, i) => {
      let angle = (-90 + 360 / visible.length * i) * Math.PI / 180;
      return { x: center + Math.cos(angle) * radius, y: center + Math.sin(angle) * radius, angle };
    });
    stage.append(orbitLines(points, center, 640));
    let sunIndex = groups.indexOf(group);
    stage.dataset.sun = String(sunIndex);
    let hub = tagPath(element("div", "detail-hub"), "sun", sunIndex);
    hub.tabIndex = 0, hub.setAttribute("role", "group"), hub.setAttribute("aria-label", `${group.name} sun`), modes.inEditMode() || hub.setAttribute("aria-keyshortcuts", "E"), group.icon && hub.append(element("span", "hub-icon", group.icon)), hub.append(element("span", "detail-hub-name", group.name)), hub.append(element("span", "detail-hub-sub", counted(group.links.length, "planet"))), group.team && hub.append(element("span", "team-mark", "TEAM")), stage.append(hub), visible.forEach((link, i) => stage.append(planetNode(link, "detail", points[i], 640, i, sunIndex)));
    let note = element("p", "detail-note", modes.inEditMode() ? "Edit mode is on. Drag a planet or moon to move or reorder it; links stay closed until you turn Edit mode off." : group.links.some((link) => link.type === "rdp") ? rdpLaunchMode === "client" ? "Select a lab to open Remote Desktop Connection with its target loaded. Your browser may ask to open the helper." : "Select a lab to download its Remote Desktop connection file. Open the file on Windows to connect." : "Select a planet to open its destination in a new tab.");
    !modes.inEditMode() && group.links.some(isGroup) && (note.textContent = "Select a group planet to show its links. Select a linked planet to open its destination."), app.append(top, heading, stage, note);
    let openAllRow = openAllActions(group, sunIndex);
    if (openAllRow && app.append(openAllRow), group.links.length > visible.length) {
      let more = element("section", "more-links");
      more.append(element("h2", "", "More planets in this system"));
      let list = element("div", "more-grid");
      group.links.slice(visible.length).forEach((link, i) => list.append(overflowPlanetNode(link, sunIndex, visible.length + i))), more.append(list), app.append(more);
    }
    let extraMoons = group.links.filter((link, index) => link.moons.length > VISIBLE_MOONS && (!isGroup(link) || index < visible.length));
    if (extraMoons.length) {
      let section = element("section", "moon-overflow");
      section.append(element("h2", "", "More moons")), extraMoons.forEach((planet) => {
        let planetIndex = group.links.indexOf(planet), row = element("div", "moon-overflow-row");
        row.append(element("h3", "", `Around ${planet.name}`));
        let links = element("div", "moon-overflow-links");
        planet.moons.slice(VISIBLE_MOONS).forEach((moon, i) => links.append(
          linkNode(moon, "overflow-moon-link", [sunIndex, planetIndex, VISIBLE_MOONS + i])
        )), row.append(links), section.append(row);
      }), app.append(section);
    }
  }

  // src/ui/views/render.js
  function render() {
    modes.send("render"), updateMapLabelSizes();
    let route = decodeURIComponent(location.hash.slice(1)), id = route.startsWith("group/") ? route.slice(6) : null, group = groups.find((item) => item.id === id);
    modes.send(group ? "openSystem" : "toGalaxy"), group ? renderDetail(group) : renderHome(), layoutOrbits(), editToggle().hidden = !1, updateEditBar(), window.scrollTo({ top: 0, behavior: "instant" }), revealPendingGroup(group?.id ?? null);
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
      ...loadWorkspaces().filter((item) => item.id !== activeWorkspace()).map((item) => ({
        label: `Switch to workspace: ${item.name}`,
        run: () => switchWorkspace(item.id)
      }))
    ];
  }
  function runMatch(match) {
    match.id ? location.hash = `group/${encodeURIComponent(match.id)}` : modes.linkOpensEditor("palette") ? openEditorAt(match.indices) : match.kind === "Group" ? openGroup(match.indices[0], match.indices[1]) : openDestination2(match.destination);
  }
  function paletteEntries(query) {
    let words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean), commands = paletteCommands().filter((command) => words.every((word) => command.label.toLocaleLowerCase().includes(word))), matches = query.trim() ? findMatches(groups, query).slice(0, 40) : [], entries = commands.map((command) => ({ kind: "Command", label: command.label, run: command.run })), address = typedAddress(query);
    address && entries.unshift({ kind: "Command", label: `Add ${address}`, run: () => showQuickAdd(address) });
    for (
      let match of
      /** @type {any[]} */
      matches
    )
      if (entries.push({ kind: match.kind, label: match.name, detail: match.why || match.path, match, run: () => runMatch(match) }), ["Planet", "Group"].includes(match.kind) && !modes.inEditMode()) {
        let planet = match.destination;
        if (planet.moons.length) {
          let label = match.kind === "Group" ? `Open all: ${planet.name} · ${counted(planet.moons.length, "link")}` : `Open all: ${planet.name} + ${counted(planet.moons.length, "moon")}`;
          entries.push({
            kind: "Command",
            label,
            detail: match.path,
            run: () => openAll(match.indices[0], match.indices[1])
          });
        }
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

  // src/ui/notices/removal.js
  var lastRecord = "";
  function updateRemovalNotice() {
    let undo = store.loadUndoRecord(), key = undo ? JSON.stringify([store.state().workspace, undo]) : "";
    if (key === lastRecord || (lastRecord = key, dismissRemovalNotice(), !undo)) return;
    let notice = element("div", "map-removal-notice");
    notice.id = "map-removal-notice";
    let status = element("span", "", `Removed ${undo.label}.`);
    status.setAttribute("role", "status");
    let restore = element("button", "editor-button", "Undo removal");
    restore.type = "button", restore.addEventListener("click", () => {
      try {
        store.undoRemoval() || dismissRemovalNotice();
      } catch (error) {
        status.textContent = `Could not undo removal: ${/** @type {Error} */
        error.message}`;
      }
    });
    let dismiss = element("button", "editor-button", "Dismiss");
    dismiss.type = "button", dismiss.addEventListener("click", dismissRemovalNotice), notice.append(status, restore, dismiss), document.body.append(notice), syncRemovalNoticeVisibility();
  }
  function syncRemovalNoticeVisibility() {
    document.querySelector("#map-removal-notice")?.toggleAttribute("hidden", !modes.overlayIs("none"));
  }
  function dismissRemovalNotice() {
    let notice = document.querySelector("#map-removal-notice");
    notice?.contains(document.activeElement) && settingsTrigger.focus({ preventScroll: !0 }), notice?.remove();
  }

  // src/ui/notices/team-updates.js
  function checkTeamUpdates() {
    if (document.querySelector("#team-updates")?.remove(), !team.groups.length) return;
    let current = teamEntries(team.groups), changes = teamChanges(readTeamSeen(), current);
    if (changes.first) return rememberTeam(current);
    let { added, removed } = changes;
    if (!added.length && !removed.length) return;
    let box = element("div", "routine-offer team-updates");
    box.id = "team-updates", box.append(element("p", "routine-offer-copy", `Team map updated: ${added.length} new, ${removed.length} removed.`));
    let details = element("div", "team-update-list");
    if (details.hidden = !0, added.length) {
      details.append(element("strong", "", "New"));
      let list = element("ul", "");
      added.forEach((entry) => {
        let item = element("li", ""), path = pathsForKey(groups, entry.key)[0];
        item.append(
          path ? destinationNode(itemAt(groups, path), "team-update-link", path) : element("span", "", entry.name),
          element("small", "", ` in ${entry.path}`)
        ), list.append(item);
      }), details.append(list);
    }
    if (removed.length) {
      details.append(element("strong", "", "Removed"));
      let list = element("ul", "");
      removed.forEach((entry) => list.append(element("li", "", entry.name))), details.append(list);
    }
    let show = element("button", "routine-offer-open", "Show what’s new");
    show.type = "button", show.setAttribute("aria-expanded", "false"), show.addEventListener("click", () => {
      details.hidden = !details.hidden, show.setAttribute("aria-expanded", String(!details.hidden));
    });
    let dismiss = element("button", "routine-offer-dismiss", "Dismiss");
    dismiss.type = "button", dismiss.addEventListener("click", () => {
      rememberTeam(current), box.remove();
    }), box.append(show, dismiss, details), noticeArea().append(box);
  }

  // src/app/start.js
  function countDestinations() {
    let destinations = groups.reduce((total, group) => total + group.links.reduce(
      (sum, link) => sum + +!isGroup(link) + link.moons.length,
      0
    ), 0);
    linkCount.textContent = `${counted(destinations, "link")} · ${counted(groups.length, "sun")}`.toUpperCase();
  }
  async function init() {
    try {
      let seed = await loadBundledMap();
      await loadTeamMap2(), store.start({ seed, team: team.groups }), offerDueRoutines(), checkTeamUpdates(), showBackupReminder();
    } catch (error) {
      modes.send("loadFailed"), app.className = "error-view", app.replaceChildren(element("h1", "", "Could not load your links.")), app.append(element("p", "", "Run `python3 sync.py`, then open index.html. You can also use `python3 serve.py` for automatic updates on refresh.")), app.append(element("pre", "", String(
        /** @type {Error} */
        error.message
      )));
    }
  }
  function start() {
    findPageElements(), readPreferences(), store.subscribe((state, kind) => {
      showStoreState(state), countDestinations(), kind !== "switch" && render(), updateRemovalNotice();
    }), modes.subscribe((next, previous, event) => {
      let held = (state) => state.mode === "pressed" || state.mode === "dragging";
      if (held(previous) && !held(next) && gestureEnded(previous.mode === "dragging", event), previous.overlay !== next.overlay) {
        syncRemovalNoticeVisibility();
        let menu = (state) => ["menu", "menuPanel", "menuEditor"].includes(state.overlay);
        previous.overlay === "palette" && paletteClosed(), previous.overlay === "placeholder" && variableFormClosed(), menu(previous) !== menu(next) && (menuOverlay.hidden = !menu(next), menu(next) || menuHidden()), next.overlay === "palette" && paletteOpened(), next.overlay === "placeholder" && variableFormOpened();
      }
      let editing = (state) => state.mode !== "browsing";
      editing(previous) !== editing(next) && showEditMode(editing(next));
    }), window.addEventListener("hashchange", () => {
      modes.send("pageChange"), render();
    }), document.querySelector(".brand").addEventListener("click", (event) => {
      event.preventDefault(), quickFind.value = "", setFindQuery(""), location.hash && location.hash !== "#" ? location.hash = "" : render();
    }), settingsTrigger.addEventListener("click", openMenu), viewToggle.addEventListener("click", () => setGalaxyView(galaxyView === "list" ? "orbits" : "list")), document.querySelector("#menu-close").addEventListener("click", closeMenu), document.querySelector("#menu-scrim").addEventListener("click", closeMenu);
    for (
      let option of
      /** @type {NodeListOf<HTMLElement>} */
      document.querySelectorAll("[data-menu-panel]")
    )
      option.addEventListener("click", () => showMenuPanel(
        /** @type {string} */
        option.dataset.menuPanel
      ));
    updateViewToggle(), updateWorkspaceSwitch(), init();
  }

  // src/core/import-kind.js
  function importKind(data, fileName = "") {
    if (/\.html?$/i.test(fileName) || typeof data == "string" && (/^\s*<!doctype netscape-bookmark-file/i.test(data) || /<dl\s*>/i.test(data)))
      return "bookmarks";
    if (!data || typeof data != "object") return "unknown";
    if (!("format" in data) && "groups" in data && Array.isArray(data.groups)) return "map";
    if ("format" in data && data.format === "orbit-item-v1" && "kind" in data) {
      let { kind } = data;
      if (kind === "sun" || kind === "planet" || kind === "moon") return kind;
    }
    return "unknown";
  }

  // src/core/bookmarks.js
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
        items.length && links.push({ name: sub.name, type: "group", moons: items });
      }
      return { name: folder.name, description: "Imported from browser bookmarks", links };
    }).filter((sun) => sun.links.length);
    return { map: validateMap({ groups: suns }), stats };
  }

  // src/ui/editor/tools/bookmarks.js
  function reviewBookmarks(text) {
    let { map, stats } = bookmarksToMap(readBookmarksHtml(text));
    if (!map.groups.length) throw new Error("The file has no website bookmarks.");
    let note = `Read ${counted(stats.links, "website bookmark")}${stats.skipped ? `; skipped ${counted(stats.skipped, "other link")} (not http or https)` : ""}${stats.truncated ? `; stopped at ${BOOKMARK_LIMIT}` : ""}. Each folder becomes a sun; a subfolder becomes a group planet with all its links as moons.`;
    nav.showImportReview(map, { title: "Review bookmarks", replace: !1, label: "Imported browser bookmarks", note });
  }

  // src/ui/editor/tools/bulk-rdp.js
  function showBulkRdp(sunIndex, planetIndex) {
    let planet = groups[sunIndex].links[planetIndex], back = () => nav.showPlanetEditor(sunIndex, planetIndex);
    editorHeader(`RDP settings for ${planet.name}`, back), menuContent.append(element("p", "", "Apply one set of Remote Desktop settings to several links at once. Each link keeps its own computer; passwords, tokens, and signatures are never kept."));
    let targets = [];
    planet.type === "rdp" && targets.push({ label: `${planet.name} (this planet)`, path: [sunIndex, planetIndex], item: planet }), planet.moons.forEach((moon, moonIndex) => {
      moon.type === "rdp" && targets.push({ label: moon.name, path: [sunIndex, planetIndex, moonIndex], item: moon });
    });
    let profile = null, sourceField = element("label", "editor-field");
    sourceField.append(element("span", "", "Settings from"));
    let source = document.createElement("select");
    source.setAttribute("aria-label", "Settings from");
    let fileOption = element("option", "", "An .rdp file…");
    fileOption.value = "file", source.append(fileOption), targets.forEach((target, index) => {
      if (!target.item.rdpProfile) return;
      let option = element("option", "", `${target.item.name}’s imported settings`);
      option.value = String(index), source.append(option);
    }), rdpPresets.forEach((preset) => {
      let option = element("option", "", `Preset: ${preset.name}`);
      option.value = `preset:${preset.id}`, source.append(option);
    }), sourceField.append(source);
    let preview = element("div", "rdp-bulk-preview"), chooseFile = editorButton("Choose .rdp file", () => {
      let input = document.createElement("input");
      input.type = "file", input.accept = ".rdp,application/x-rdp", input.addEventListener("change", async () => {
        let files = input.files;
        if (files?.length)
          try {
            let parsed = parseRdpProfile(await readRdpText(files[0]));
            setProfile(parsed.content, `${files[0].name}${parsed.removed ? ` (${counted(parsed.removed, "sensitive setting")} excluded)` : ""}`);
          } catch (error) {
            editorError(`RDP import failed: ${/** @type {any} */
            error.message}`);
          }
      }), input.click();
    }), apply = editorButton("Apply to selected links", () => {
      let chosen = targets.filter((_, index) => boxes[index].checked);
      if (!profile || !chosen.length) return;
      let next = copyGroups(), preset = source.value.startsWith("preset:") ? source.value.slice(7) : null;
      for (let target of chosen) {
        let item = target.path.length === 3 ? next[target.path[0]].links[target.path[1]].moons[target.path[2]] : next[target.path[0]].links[target.path[1]];
        preset ? item.rdpPreset = preset : (item.rdpProfile = parseRdpProfile(profile, item.host).content, delete item.rdpPreset);
      }
      applyEditorChange(next, back, { label: `Applied RDP settings to ${counted(chosen.length, "link")} in ${planet.name}` });
    }, "editor-primary");
    apply.disabled = !0;
    let setProfile = (content, from) => {
      profile = content, preview.replaceChildren(element("p", "data-source", `Settings from ${from}:`));
      let rows = element("ul", "rdp-bulk-settings");
      profileRows(content).filter((row) => !/^full address:/i.test(row)).forEach((row) => rows.append(element("li", "", row))), rows.children.length || rows.append(element("li", "", "Only the computer address (no other settings).")), preview.append(rows), apply.disabled = !1;
    }, update = () => {
      if (chooseFile.hidden = source.value !== "file", source.value === "file")
        profile = null, preview.replaceChildren(element("p", "data-source", "Choose an .rdp file to see its settings.")), apply.disabled = !0;
      else if (source.value.startsWith("preset:")) {
        let preset = rdpPresets.find((item) => item.id === source.value.slice(7));
        setProfile(`full address:s:example\r
${preset.settings}`, `the ${preset.name} preset`);
      } else
        setProfile(targets[Number(source.value)].item.rdpProfile, `${targets[Number(source.value)].item.name}`);
    };
    source.addEventListener("change", update), menuContent.append(sourceField), editorActions().append(chooseFile), menuContent.append(preview), menuContent.append(element("h4", "editor-section-title", "Apply to"));
    let boxes = targets.map((target) => {
      let row = element("label", "editor-check"), box = document.createElement("input");
      return box.type = "checkbox", box.checked = !0, row.append(box, element("span", "", `${target.label} → ${target.item.host}${target.item.rdpProfile ? " (has settings)" : ""}`)), menuContent.append(row), box;
    }), actions = editorActions();
    actions.append(apply), actions.append(editorButton("Clear imported settings", () => {
      let chosen = targets.filter((_, index) => boxes[index].checked && targets[index].item.rdpProfile);
      if (!chosen.length) return editorError("None of the selected links has imported settings.");
      if (!confirmed(`Remove imported settings from ${counted(chosen.length, "link")}?`)) return;
      let next = copyGroups();
      for (let target of chosen) {
        let item = target.path.length === 3 ? next[target.path[0]].links[target.path[1]].moons[target.path[2]] : next[target.path[0]].links[target.path[1]];
        delete item.rdpProfile;
      }
      applyEditorChange(next, back, { label: `Cleared RDP settings from ${counted(chosen.length, "link")} in ${planet.name}` });
    }, "editor-danger")), update();
  }

  // src/ui/editor/tools/duplicates.js
  function showDuplicates() {
    editorHeader("Find duplicates", nav.showSunList);
    let duplicates = duplicateGroups(groups);
    if (menuContent.append(element("p", "", "Links that point to the same address or Remote Desktop computer. A copy you made on purpose shows here too; nothing is changed unless you edit or remove an item.")), !duplicates.length) {
      menuContent.append(element("p", "editor-note", "No duplicates found."));
      return;
    }
    menuContent.append(element("p", "data-source", `${counted(duplicates.length, "address", "addresses")} used more than once.`)), duplicates.forEach((list) => {
      let block = element("div", "duplicate-group");
      block.append(element("h4", "editor-section-title", addressText(list[0].item))), list.forEach(({ path }) => {
        let row = element("div", "editor-list-row");
        row.append(element("span", "", `${pathLabel(path)}${groups[path[0]].team ? " · team" : ""}`)), row.append(editorButton(groups[path[0]].team ? "View" : "Edit", () => editPath(path))), block.append(row);
      }), menuContent.append(block);
    });
  }

  // src/ui/editor/tools/history.js
  function mapCounts(list) {
    let planets = list.reduce((sum, sun) => sum + sun.links.length, 0), moons = list.reduce((sum, sun) => sum + sun.links.reduce((total, planet) => total + planet.moons.length, 0), 0);
    return { suns: list.length, planets, moons };
  }
  function countDifference(from, to) {
    let parts = [];
    for (let kind of ["suns", "planets", "moons"]) {
      let change = to[kind] - from[kind];
      change && parts.push(`${change > 0 ? "+" : "−"}${counted(Math.abs(change), kind.slice(0, -1))}`);
    }
    return parts.length ? parts.join(", ") : "same counts";
  }
  function showHistory() {
    editorHeader("History", nav.showSunList);
    let entries = loadHistory(workspaceKey(KEYS.history, activeWorkspace()));
    if (menuContent.append(element("p", "", "Orbit keeps the map as it was before each of your last 20 changes in this browser. Restoring a version is itself a change, so it can be undone here too.")), !entries.length) {
      menuContent.append(element("p", "editor-note", "No earlier versions yet. They appear after your next change."));
      return;
    }
    let current = mapCounts(personalGroups(groups)), list = element("div", "editor-list history-list");
    entries.forEach((entry) => {
      let counts = mapCounts(entry.groups), row = element("div", "editor-list-row history-row"), copy = element("span", "history-copy");
      copy.append(element("strong", "", `Before: ${entry.label}`)), copy.append(element("small", "", `${new Date(entry.time).toLocaleString()} · ${counted(counts.suns, "sun")}, ${counted(counts.planets, "planet")}, ${counted(counts.moons, "moon")} · compared with now: ${countDifference(current, counts)}`)), row.append(copy, editorButton("Restore", () => {
        confirmed(`Restore the map from ${new Date(entry.time).toLocaleString()}?`) && applyEditorChange(
          [...groups.filter((sun) => sun.team), ...entry.groups],
          showHistory,
          {
            label: `Restored the version from ${new Date(entry.time).toLocaleString()}`,
            routines: entry.routines || [],
            rdpPresets: entry.rdpPresets || []
          }
        );
      })), list.append(row);
    }), menuContent.append(list);
  }

  // src/services/link-check.js
  async function checkLinks(urls, { onProgress = () => {
  }, fetch = (url, init2) => globalThis.fetch(url, init2) } = {}) {
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

  // src/ui/editor/tools/link-check.js
  function webLinksByUrl() {
    let byUrl = /* @__PURE__ */ new Map();
    return groups.forEach((sun, sunIndex) => sun.links.forEach((planet, planetIndex) => {
      [[planet, [sunIndex, planetIndex]], ...planet.moons.map((moon, moonIndex) => [moon, [sunIndex, planetIndex, moonIndex]])].forEach(([item, path]) => {
        isGroup(item) || item.type === "rdp" || templateNames(item.url).length || (byUrl.has(item.url) || byUrl.set(item.url, []), byUrl.get(item.url).push({ item, path }));
      });
    })), byUrl;
  }
  function showLinkCheck() {
    if (editorHeader("Check links", nav.showSunList), location.protocol === "file:") {
      menuContent.append(element("p", "", "Checking links needs the local server, because a page opened from a file cannot read other sites. In the Orbit folder, run:")), menuContent.append(element("code", "editor-code", "python3 serve.py")), menuContent.append(element("p", "", "Then open http://localhost:8000 and choose Check links again."));
      return;
    }
    let byUrl = webLinksByUrl();
    menuContent.append(element("p", "", `Orbit asks each website address in your map (${byUrl.size} in all) whether it answers. Remote Desktop links are not checked. Nothing is sent anywhere except to those sites.`));
    let status = element("p", "link-check-status");
    status.setAttribute("role", "status");
    let results = element("div", "link-check-results"), start2 = editorButton("Start check", () => runLinkCheck(byUrl, status, results, start2), "editor-primary");
    editorActions().append(start2), menuContent.append(status, results);
  }
  async function runLinkCheck(byUrl, status, results, start2) {
    start2.disabled = !0, results.replaceChildren();
    let urls = [...byUrl.keys()], answers;
    try {
      answers = await checkLinks(
        urls,
        { onProgress: (done, total) => {
          status.textContent = `Checked ${done} of ${total}…`;
        } }
      );
    } catch (error) {
      status.textContent = `The check stopped: ${/** @type {any} */
      error.message}`, start2.disabled = !1;
      return;
    }
    linkCheckResults.clear();
    let failures = [];
    for (let [url, entries] of byUrl) {
      let answer = answers[url] || { ok: !1, error: "no answer" };
      for (let entry of entries) linkCheckResults.set(destinationKey(entry.item), answer);
      answer.ok || failures.push({ url, answer, entries });
    }
    status.textContent = failures.length ? `Checked ${counted(urls.length, "address", "addresses")}: ${failures.length} did not answer correctly.` : `Checked ${counted(urls.length, "address", "addresses")}: all answered.`, failures.forEach(({ answer, entries }) => entries.forEach(({ item, path }) => {
      let row = element("div", "editor-list-row link-check-failure"), copy = element("span", "history-copy");
      copy.append(element("strong", "", `⚠ ${item.name}`)), copy.append(element("small", "", `${pathLabel(path)} · ${answer.status ? `HTTP ${answer.status}` : answer.error}`)), row.append(copy, editorButton(groups[path[0]].team ? "View" : "Edit", () => editPath(path))), results.append(row);
    })), start2.disabled = !1, nav.renderEditorTree();
  }

  // src/ui/editor/tools/presets.js
  var PRESET_CHOICES = {
    display: [
      ["", "Leave as is", []],
      ["full", "Full screen", ["screen mode id:i:2"]],
      ["1280", "Window, 1280 × 720", ["screen mode id:i:1", "desktopwidth:i:1280", "desktopheight:i:720"]],
      ["1600", "Window, 1600 × 900", ["screen mode id:i:1", "desktopwidth:i:1600", "desktopheight:i:900"]],
      ["1920", "Window, 1920 × 1080", ["screen mode id:i:1", "desktopwidth:i:1920", "desktopheight:i:1080"]]
    ],
    toggles: [
      ["use multimon", "Use all monitors", "use multimon:i:1"],
      ["redirectclipboard", "Share the clipboard", "redirectclipboard:i:1"],
      ["drivestoredirect", "Share local drives", "drivestoredirect:s:*"]
    ]
  }, DISPLAY_KEYS = ["screen mode id", "desktopwidth", "desktopheight"];
  function settingKey(row) {
    return row.split(":")[0].trim().toLowerCase();
  }
  function presetUsage(id) {
    return groups.reduce((sum, sun) => sum + sun.links.reduce((total, planet) => total + [planet, ...planet.moons].filter((item) => item.rdpPreset === id).length, 0), 0);
  }
  function showPresets() {
    editorHeader("Remote Desktop presets", nav.showSunList), menuContent.append(element("p", "", "A preset is a named set of connection settings, such as full screen with all monitors. Choose it for any Remote Desktop planet or moon in Connection settings; each link keeps its own computer. Presets never hold passwords.")), rdpPresets.length || menuContent.append(element("p", "editor-note", "No presets yet."));
    let list = element("div", "editor-list");
    rdpPresets.forEach((preset, index) => {
      let row = element("div", "editor-list-row"), copy = element("span", "history-copy");
      copy.append(element("strong", "", preset.name)), copy.append(element("small", "", `${counted(preset.settings ? preset.settings.split(/\r\n/).length : 0, "setting")} · used by ${counted(presetUsage(preset.id), "link")}`)), row.append(copy, editorButton("Edit", () => showPresetEditor(index))), list.append(row);
    }), menuContent.append(list), editorActions().append(editorButton("New preset", () => showPresetEditor(null), "editor-primary"));
  }
  function showPresetEditor(index) {
    let isNew = index === null, preset = isNew ? { name: "", settings: "" } : rdpPresets[index];
    editorHeader(isNew ? "New preset" : `Edit ${preset.name}`, showPresets);
    let form = element("form", "editor-form"), name = editorField("Preset name", preset.name);
    name.input.setAttribute("aria-label", "Preset name"), name.input.placeholder = "For example: Full screen";
    let settings = editorField("Settings", preset.settings.replace(/\r\n/g, `
`), "textarea");
    settings.input.setAttribute("aria-label", "Settings"), settings.input.classList.add("preset-settings");
    let rows = () => settings.input.value.split(/\n/).map((line) => line.trim()).filter(Boolean), setRows = (list) => {
      settings.input.value = list.join(`
`);
    }, displayField = element("label", "editor-field");
    displayField.append(element("span", "", "Display"));
    let display = document.createElement("select");
    display.setAttribute("aria-label", "Display"), PRESET_CHOICES.display.forEach(([value, label]) => {
      let option = element("option", "", label);
      option.value = value, display.append(option);
    }), displayField.append(display);
    let current = rows(), matching = PRESET_CHOICES.display.find(([value, , lines]) => value && lines.every((line) => current.includes(line)));
    display.value = matching ? matching[0] : "", display.addEventListener("change", () => {
      let lines = (
        /** @type {[string, string, string[]]} */
        PRESET_CHOICES.display.find(([value]) => value === display.value)[2]
      );
      setRows([...rows().filter((row) => !DISPLAY_KEYS.includes(settingKey(row))), ...lines]);
    });
    let toggles = PRESET_CHOICES.toggles.map(([key, label, line]) => {
      let row = element("label", "editor-check"), box = document.createElement("input");
      return box.type = "checkbox", box.checked = current.includes(line), box.setAttribute("aria-label", label), box.addEventListener("change", () => {
        let others = rows().filter((item) => settingKey(item) !== key);
        setRows(box.checked ? [...others, line] : others);
      }), row.append(box, element("span", "", label)), row;
    }), fromFile = editorButton("Start from an .rdp file", () => {
      let input = document.createElement("input");
      input.type = "file", input.accept = ".rdp,application/x-rdp", input.addEventListener("change", async () => {
        let files = input.files;
        if (files?.length)
          try {
            let parsed = parseRdpProfile(await readRdpText(files[0]));
            setRows(parsed.content.split(/\r\n/).filter((row) => row && settingKey(row) !== "full address")), name.input.value.trim() || (name.input.value = files[0].name.replace(/\.rdp$/i, ""));
          } catch (error) {
            editorError(`RDP import failed: ${/** @type {any} */
            error.message}`);
          }
      }), input.click();
    });
    settings.wrapper.append(element("small", "editor-hint", "One setting per line, as in an .rdp file (for example session bpp:i:32). The computer address comes from each link."));
    let actions = element("div", "editor-actions"), save = element("button", "editor-primary", isNew ? "Add preset" : "Save preset");
    save.type = "submit", actions.append(save), isNew || actions.append(editorButton("Remove preset", () => {
      let used = presetUsage(preset.id);
      confirmed(`Remove the ${preset.name} preset?${used ? ` ${counted(used, "link")} using it will open without it.` : ""}`) && applyEditorChange(copyGroups(), showPresets, {
        rdpPresets: rdpPresets.filter((_, i) => i !== index),
        label: `Removed preset ${preset.name}`
      });
    }, "editor-danger")), form.append(name.wrapper, displayField, ...toggles, fromFile, settings.wrapper, actions), form.addEventListener("submit", (event) => {
      event.preventDefault();
      let value = { name: name.input.value.trim(), settings: rows().join(`\r
`) };
      isNew || (value.id = preset.id);
      let next = [...rdpPresets];
      isNew ? next.push(value) : next[index] = value, applyEditorChange(copyGroups(), showPresets, { rdpPresets: next, label: `${isNew ? "Added" : "Saved"} preset ${value.name}` });
    }), menuContent.append(form);
  }

  // src/ui/editor/tools/team.js
  function personalSunOptions() {
    return groups.flatMap((sun, index) => sun.team ? [] : [[String(index), sun.name]]);
  }
  function showTeamSun(index) {
    let sun = groups[index];
    editorHeader(`${sun.icon ? `${sun.icon} ` : ""}${sun.name} (team)`, nav.showSunList, [index]), menuContent.append(element("p", "editor-note", "This sun comes from the team map, so it is read-only here. Copy it, or any of its planets and moons, into your own map to change it.")), sun.description && menuContent.append(descriptionNode("", sun.description));
    let actions = editorActions();
    actions.append(editorButton("Copy sun to my map", () => {
      let next = copyGroups(), copy = plainCopy(sun);
      copy.id = uniqueSunId(copy.name, new Set(next.map((item) => item.id))), next.push(copy), applyEditorChange(next, () => nav.showSunEditor(next.length - 1), { label: `Copied team sun ${sun.name}` });
    }, "editor-primary")), actions.append(editorButton("Hide this team sun", () => {
      store.setTeamSunHidden(sun.id, !0), nav.showSunList();
    })), actions.append(editorButton("Export sun", () => exportItem("sun", sun))), menuContent.append(element("h4", "editor-section-title", "Planets"));
    let list = element("div", "editor-list");
    sun.links.forEach((planet, planetIndex) => {
      let summary = `${planet.name} · ${counted(planet.moons.length, isGroup(planet) ? "link" : "moon")}`;
      list.append(editorExportRow("planet", planet, summary, "View", () => showTeamItem([index, planetIndex])));
    }), menuContent.append(list);
  }
  function showTeamItem(path) {
    let sun = groups[path[0]], planet = sun.links[path[1]], item = itemAt(groups, path), isMoon = path.length === 3;
    if (!item) return showTeamSun(path[0]);
    editorHeader(`${item.name} (team)`, () => isMoon ? showTeamItem(path.slice(0, 2)) : showTeamSun(path[0]), path), menuContent.append(element("p", "", `${sun.name} sun${isMoon ? ` → ${planet.name} planet` : ""} · read-only team ${isMoon ? "moon" : "planet"}`));
    let group = isGroup(item), summary = group ? item.moons.length ? counted(item.moons.length, "link") : "No links yet" : item.type === "rdp" ? `Remote Desktop: ${item.host}` : item.url;
    menuContent.append(element("p", "data-source", summary)), item.tags?.length && menuContent.append(tagChips(item.tags));
    let favorite = isFavorite(item, sun);
    group || editorActions().append(editorButton(favorite ? "Remove from favorites" : "Add to favorites", () => {
      setFavorite(path, !favorite), showTeamItem(path);
    }));
    let options = isMoon ? groups.flatMap((target, targetSun) => target.team ? [] : target.links.map((targetPlanet, targetPlanetIndex) => [`${targetSun}:${targetPlanetIndex}`, `${target.name} → ${targetPlanet.name}`])) : personalSunOptions();
    if (options.length) {
      let select = moveTargetField(options);
      select.setAttribute("aria-label", "Copy to"), select.previousElementSibling.textContent = "Copy to", editorActions().append(editorButton(isMoon ? "Copy moon to my map" : "Copy planet to my map", () => {
        let next = copyGroups(), [targetSun, targetPlanet] = select.value.split(":").map(Number);
        isMoon && !isGroup(item) ? next[targetSun].links[targetPlanet].moons.push(plainCopy(item)) : next[targetSun].links.push(plainCopy(item)), applyEditorChange(
          next,
          () => isMoon ? nav.showMoonEditor(targetSun, targetPlanet, next[targetSun].links[targetPlanet].moons.length - 1) : nav.showPlanetEditor(targetSun, next[targetSun].links.length - 1),
          { label: `Copied team ${isMoon ? "moon" : "planet"} ${item.name}` }
        );
      }, "editor-primary"));
    } else
      menuContent.append(element("p", "editor-hint", `Add ${isMoon ? "a planet" : "a sun"} to your own map to copy this ${isMoon ? "moon" : "planet"} into it.`));
    if (!isMoon && planet.moons.length) {
      menuContent.append(element("h4", "editor-section-title", group ? "Links" : "Moons"));
      let list = element("div", "editor-list");
      planet.moons.forEach((moon, moonIndex) => {
        list.append(editorExportRow("moon", moon, moon.name, "View", () => showTeamItem([path[0], path[1], moonIndex])));
      }), menuContent.append(list);
    }
  }

  // src/ui/editor/screens.js
  function destinationFields(form, destination, onRdpImported, allowGroup = !1) {
    let type = element("label", "editor-field"), fieldName = allowGroup ? "Kind" : "Destination type";
    type.append(element("span", "", fieldName));
    let select = document.createElement("select");
    select.setAttribute("aria-label", fieldName);
    let kinds = [["web", "Website"], ["rdp", "Windows Remote Desktop"]];
    allowGroup && kinds.push(["group", "Group (no link)"]);
    for (let [value, label] of kinds) {
      let option = element("option", "", label);
      option.value = value, select.append(option);
    }
    select.value = destination.type || "web", type.append(select);
    let url = editorField("Destination URL", destination.url || "", "url"), host = editorField("Computer name or IP address", destination.host || ""), rdpProfile = destination.rdpProfile || null, profileNote = element("p", "data-source", rdpProfile ? "Custom .rdp settings are saved with this link." : "No custom .rdp settings are saved."), settingsField = element("label", "editor-field");
    settingsField.append(element("span", "", "Connection settings"));
    let settingsSelect = document.createElement("select");
    settingsSelect.setAttribute("aria-label", "Connection settings"), settingsField.append(settingsSelect);
    let fillSettings = (selected) => {
      settingsSelect.replaceChildren();
      let add = (value, label) => {
        let option = element("option", "", label);
        option.value = value, settingsSelect.append(option);
      };
      add("none", "None (just the computer)"), rdpProfile && add("own", "Imported .rdp settings"), rdpPresets.forEach((preset) => add(`preset:${preset.id}`, `Preset: ${preset.name}`)), settingsSelect.value = [...settingsSelect.options].some((option) => option.value === selected) ? selected : "none";
    };
    fillSettings(destination.rdpPreset ? `preset:${destination.rdpPreset}` : rdpProfile ? "own" : "none");
    let importRdp = editorButton("Import .rdp file", () => {
      let input = document.createElement("input");
      input.type = "file", input.accept = ".rdp,application/x-rdp", input.addEventListener("change", async () => {
        let files = input.files;
        if (files?.length)
          try {
            let parsed = parseRdpProfile(await readRdpText(files[0]));
            select.value = "rdp", host.input.value = parsed.host, rdpProfile = parsed.content, fillSettings("own"), profileNote.textContent = `${parsed.settings} connection settings imported. ${parsed.removed ? `${parsed.removed} password, token, or signature settings excluded. ` : ""}Save this link to keep the profile.`, update(), onRdpImported?.(files[0]);
          } catch (error) {
            editorError(`RDP import failed: ${/** @type {any} */
            error.message}`);
          }
      }), input.click();
    }), update = () => {
      url.wrapper.hidden = select.value !== "web", host.wrapper.hidden = select.value !== "rdp", profileNote.hidden = select.value !== "rdp", importRdp.hidden = select.value !== "rdp", settingsField.hidden = select.value !== "rdp", favorite.hidden = select.value === "group", url.input.disabled = select.value !== "web";
    };
    select.addEventListener("change", update);
    let note = editorField("Note", destination.note || "", "textarea");
    note.input.setAttribute("aria-label", "Note"), note.input.maxLength = 500, note.input.placeholder = "Optional: what this link is for, or a hint such as which account to use", note.wrapper.append(element("small", "editor-hint", "Shown on hover and in search. Never put passwords here; notes are plain text in your browser and in exports."));
    let tags = editorField("Tags", (destination.tags || []).join(", "));
    tags.input.placeholder = "For example: prod, windows", tags.input.setAttribute("aria-label", "Tags"), tags.wrapper.append(element("small", "editor-hint", "Separate tags with commas. Find tagged links with #tag in Quick find."));
    let favorite = element("label", "editor-check"), favoriteInput = document.createElement("input");
    return favoriteInput.type = "checkbox", favoriteInput.checked = destination.favorite === !0, favorite.append(favoriteInput, element("span", "", "Favorite (shown at the top of the Galaxy)")), url.wrapper.append(element("small", "editor-hint", "Use {name} for a part that changes, such as https://jira.example.com/browse/{ticket}; Orbit asks for it when you open the link.")), form.append(type, url.wrapper, host.wrapper, settingsField, profileNote, importRdp, note.wrapper, tags.wrapper, favorite), update(), () => {
      let extras = {
        ...tags.input.value.trim() ? { tags: tags.input.value } : {},
        ...favoriteInput.checked && select.value !== "group" ? { favorite: !0 } : {},
        ...note.input.value.trim() ? { note: note.input.value } : {}
      };
      if (select.value === "group") return { type: "group", ...extras };
      let choice = settingsSelect.value, keepProfile = rdpProfile && choice !== "none" ? { rdpProfile } : {}, preset = choice.startsWith("preset:") ? { rdpPreset: choice.slice(7) } : {};
      return select.value === "rdp" ? { type: "rdp", host: host.input.value.trim(), ...keepProfile, ...preset, ...extras } : { url: url.input.value.trim(), ...extras };
    };
  }
  function exportMap() {
    downloadJson({
      groups: personalGroups(groups),
      ...routines.length ? { routines } : {},
      ...rdpPresets.length ? { rdpPresets } : {}
    }, "orbit-links.json"), noteBackupMade2();
  }
  function reviewCheck(className, checked, parts) {
    let label = element("label", `editor-check ${className}`), box = (
      /** @type {HTMLInputElement} */
      element("input")
    );
    return box.type = "checkbox", box.checked = checked, label.append(box, ...parts), { label, box };
  }
  function showImportReview(data, options = {}) {
    editorHeader(options.title || "Review import", showSunList);
    let planetCount = data.groups.reduce((sum, sun) => sum + sun.links.length, 0), moonCount = data.groups.reduce((sum, sun) => sum + sun.links.reduce(
      (total, planet) => total + planet.moons.length,
      0
    ), 0);
    options.note && menuContent.append(element("p", "", options.note)), menuContent.append(element("p", "", `The file has ${counted(data.groups.length, "sun")} · ${counted(planetCount, "planet")} · ${counted(moonCount, "moon")}.`));
    let personal = personalGroups(groups), additions = sunAdditions(personal, data.groups), newRoutines = mergeRoutines(routines, data.routines || []), addedRoutines = newRoutines.length - routines.length, newPresets = mergeRoutines(rdpPresets, data.rdpPresets || []), addedPresets = newPresets.length - rdpPresets.length, picker = element("fieldset", "import-suns");
    picker.append(element("legend", "", "Choose the suns to add"));
    let choose = element("p", "import-sun-choose"), setAll = (text, value) => editorButton(text, () => {
      for (let box of sunBoxes) box.disabled || (box.checked = value);
      update();
    }, "import-sun-all"), sunBoxes = data.groups.map((sun, index) => {
      let adds = additions[index], something = adds.planets + adds.moons > 0 || adds.isNew, what = adds.isNew ? `new sun · ${counted(adds.planets, "planet")} · ${counted(adds.moons, "moon")}` : something ? `already yours · adds ${counted(adds.planets, "planet")}, ${counted(adds.moons, "moon")}` : "already yours · nothing new", { label, box } = reviewCheck(
        "import-sun",
        something,
        [element("span", "import-sun-name", sun.name), element("span", "import-sun-adds", what)]
      );
      return box.disabled = !something, box.addEventListener("change", () => update()), picker.append(label), box;
    });
    choose.append(setAll("Select all", !0), setAll("Select none", !1)), picker.insertBefore(choose, picker.children[1] ?? null), menuContent.append(picker);
    let routineBox = addedRoutines ? reviewCheck("import-extra", !0, [`Also add ${counted(addedRoutines, "routine")}`]) : null, presetBox = addedPresets ? reviewCheck("import-extra", !0, [`Also add ${counted(addedPresets, "Remote Desktop preset")}`]) : null;
    for (let extra of [routineBox, presetBox])
      extra && (extra.box.addEventListener("change", () => update()), menuContent.append(extra.label));
    let summary = element("p", "import-merge-summary");
    menuContent.append(summary);
    let chosen = () => data.groups.filter((_, index) => sunBoxes[index].checked), merged = () => mergeMaps(personal, chosen()), actions = editorActions(), merge = editorButton("Merge into my map", () => {
      let withRoutines = !!routineBox?.box.checked, withPresets = !!presetBox?.box.checked;
      applyEditorChange(
        [...groups.filter((sun) => sun.team), ...merged().groups],
        showSunList,
        {
          label: options.label || "Merged an imported map",
          routines: withRoutines ? newRoutines : routines,
          rdpPresets: withPresets ? newPresets : rdpPresets
        }
      );
    }, "editor-primary");
    function update() {
      let { added, skipped } = merged(), routineCount = routineBox?.box.checked ? addedRoutines : 0, presetCount = presetBox?.box.checked ? addedPresets : 0, skippedLinks = skipped.planets + skipped.moons;
      summary.textContent = `Merge adds ${counted(added.suns, "sun")}, ${counted(added.planets, "planet")}, and ${counted(added.moons, "moon")}${routineCount ? ` and ${counted(routineCount, "routine")}` : ""}${presetCount ? ` and ${counted(presetCount, "Remote Desktop preset")}` : ""}; ${counted(skippedLinks, "link")} already in your map ${skippedLinks === 1 ? "is" : "are"} skipped. Nothing in your map changes.`, merge.disabled = !(added.suns + added.planets + added.moons + routineCount + presetCount);
    }
    update(), actions.append(merge), options.replace !== !1 && (menuContent.append(element("p", "editor-hint", "Replace my map swaps your whole map for the file, every sun whatever is ticked. Version history keeps the current map, so you can restore it.")), actions.append(editorButton("Replace my map", () => applyEditorChange(
      data.groups,
      showSunList,
      { clearUndo: !0, label: "Replaced the map with an import", routines: data.routines || [], rdpPresets: data.rdpPresets || [] }
    )))), actions.append(editorButton("Cancel", showSunList));
  }
  function importFile() {
    pickFile(".json,application/json,.html,.htm,text/html", async (file) => {
      try {
        let { text, data } = await readImportFile(file);
        switch (importKind(data === void 0 ? text : typeof data == "string" ? null : data, file.name)) {
          case "bookmarks":
            return reviewBookmarks(text);
          case "map":
            return showImportReview(validateMap(data));
          case "sun":
            return reviewItem(data, "sun");
          case "planet":
            return reviewItem(data, "sun", null, null, "planet");
          case "moon":
            return editorError("This file is a moon. Import moons inside a planet: Edit → the planet → Import moon.");
          default:
            return editorError("This isn't an Orbit map, sun, planet, or bookmarks file.");
        }
      } catch (error) {
        editorError(`Import failed: ${/** @type {Error} */
        error.message}`);
      }
    });
  }
  function importItem(kind, sunIndex, planetIndex = null) {
    selectJsonFile((data) => reviewItem(data, kind, sunIndex, planetIndex));
  }
  function reviewItem(data, kind, sunIndex = null, planetIndex = null, sourceKind = kind) {
    let item = validItemExport(data, kind, sourceKind), back = kind === "sun" ? showSunList : kind === "planet" ? () => showSunEditor(sunIndex) : () => showPlanetEditor(sunIndex, planetIndex);
    if (editorHeader(sourceKind === kind ? `Review ${kind} import` : "Review planet as sun", back), menuContent.append(element("p", "", item.name)), sourceKind === "planet" && kind === "sun") {
      let planet = item.links[0];
      menuContent.append(element("p", "", isGroup(planet) ? "The group becomes the first planet in a new sun and keeps all its links." : "The shared planet becomes the first planet in a new sun. Its destination and moons stay with it.")), isGroup(planet) || menuContent.append(element("p", "", `Planet destination: ${planet.host || planet.url}`));
    }
    if (kind === "sun") {
      let moons = item.links.reduce((sum, planet) => sum + planet.moons.length, 0);
      menuContent.append(element("p", "", `${counted(item.links.length, "planet")} · ${counted(moons, "moon")}`));
    } else kind === "planet" ? menuContent.append(element("p", "", isGroup(item) ? item.moons.length ? counted(item.moons.length, "link") : "No links yet" : `${counted(item.moons.length, "moon")} · ${item.host || item.url}`)) : menuContent.append(element("p", "", item.host || item.url));
    let destination = kind === "sun" ? "the Galaxy" : kind === "planet" ? `${groups[sunIndex].name} sun` : `${groups[sunIndex].name} sun → ${groups[sunIndex].links[planetIndex].name} planet`;
    menuContent.append(element("p", "", `Add to ${destination}. Existing links will remain.`));
    let actions = editorActions();
    actions.append(editorButton(`Add ${kind}`, () => {
      let next = copyGroups(), imported = JSON.parse(JSON.stringify(item)), showNext;
      kind === "sun" ? (next.some((sun) => sun.id === imported.id) && (imported.id = uniqueSunId(imported.name, new Set(next.map((sun) => sun.id)))), next.push(imported), showNext = () => showSunEditor(next.length - 1)) : kind === "planet" ? (next[sunIndex].links.push(imported), showNext = () => showPlanetEditor(sunIndex, next[sunIndex].links.length - 1)) : (next[sunIndex].links[planetIndex].moons.push(imported), showNext = () => showMoonEditor(
        sunIndex,
        planetIndex,
        next[sunIndex].links[planetIndex].moons.length - 1
      )), applyEditorChange(next, showNext);
    }, "editor-primary")), actions.append(editorButton("Cancel", back));
  }
  function resetMap() {
    if (confirmed("Replace browser edits with the link data loaded from the project files?"))
      try {
        store.resetToBundled(), showSunList();
      } catch (error) {
        editorError(
          /** @type {any} */
          error.message
        );
      }
  }
  function editorGroup(label, ...controls) {
    let group = element("section", "editor-group"), heading = element("h4", "editor-group-label", label);
    heading.id = `editor-group-${label.toLowerCase().replaceAll(" ", "-")}`, group.setAttribute("aria-labelledby", heading.id);
    let actions = element("div", "editor-actions");
    actions.append(...controls), group.append(heading, actions), menuContent.append(group);
  }
  function showSunList() {
    editorHeader("Edit links", () => editorTree ? leaveEditorPage() : showMenuPanel("Settings")), menuContent.append(element("p", "", "Choose a sun to edit its planets and moons, or add, import, and export below. Changes are saved in this browser. History keeps earlier versions.")), menuContent.append(element("p", "data-source", `Active link map: ${dataSourceLabel()}`));
    let due = backupDue2();
    due && menuContent.append(backupReminder(due)), editorActions().append(
      tip(editorButton("Add sun", () => showSunEditor(null), "editor-primary"), "Create a new sun, a group of planets, at the end of your Galaxy."),
      tip(editorButton("Add a link", () => showQuickAdd("")), "Add a planet or moon quickly by pasting its address.")
    ), menuContent.append(element("h4", "editor-section-title", "Suns"));
    let list = element("div", "editor-list");
    groups.forEach((sun, index) => {
      let row = element("div", "editor-list-row");
      row.append(element("span", "", `${sun.icon ? `${sun.icon} ` : ""}${sun.name} · ${counted(sun.links.length, "planet")}${sun.team ? " · team, read-only" : ""}`)), row.append(tip(
        editorButton(sun.team ? "View" : "Edit", () => showSunEditor(index)),
        sun.team ? `View ${sun.name}: a read-only team sun.` : `Edit ${sun.name}: its name, color, planets, and moons.`
      )), list.append(row);
    }), menuContent.append(list);
    let hidden = team.groups.filter((sun) => hiddenTeamSuns().has(sun.id));
    hidden.length && menuContent.append(element("p", "data-source", `${counted(hidden.length, "team sun")} hidden. Show them again in Settings.`)), editorGroup(
      "Import",
      tip(editorButton("Import a file", importFile), "Add from a file: a whole map (pick which suns, or replace your map), a single sun, a planet as a new sun, or a browser bookmarks file."),
      tip(editorButton("Link pack", showPackImport), "Paste a link pack someone shared and add the links you don't have yet.")
    ), editorGroup(
      "Export",
      tip(editorButton("Whole map (JSON)", exportMap), "Download your whole map, with routines and presets, as a backup or to move it to another browser."),
      tip(editorButton("Share favorites", shareFavorites), "Copy your favorites as a link pack to send to someone.")
    );
    let fileMode = location.protocol === "file:", checkLinks2 = editorButton("Check links", () => {
      fileMode || showLinkCheck();
    });
    fileMode && checkLinks2.setAttribute("aria-disabled", "true"), editorGroup(
      "Organize",
      tip(editorButton("Routines", showRoutines), "Name sets of links to open together, and have Orbit offer them at set times."),
      tip(editorButton("RDP presets", showPresets), "Saved Remote Desktop settings (screen size, monitors) to reuse across computers."),
      tip(editorButton("Find duplicates", showDuplicates), "List links that appear more than once in your map."),
      tip(checkLinks2, fileMode ? "Check links needs the local server: run python3 serve.py and open http://localhost:8000." : "Test every web link and mark the ones that don't answer."),
      tip(editorButton("History", showHistory), "Your map before each of your last 20 changes; restore any of them.")
    ), editorGroup(
      "Start over",
      tip(editorButton("Reset to file data", resetMap, "editor-danger"), "Replace your browser edits with the project's map. History keeps the current one."),
      element("p", "editor-hint", "Replaces your browser edits with the project's map. History keeps the current one.")
    );
    let tags = tagCounts();
    if (tags.length) {
      menuContent.append(element("h4", "editor-section-title", "Tags"));
      let list2 = element("div", "tag-list");
      tags.forEach(([tag, count]) => list2.append(editorButton(`#${tag} · ${count}`, () => {
        closeMenu(), quickFind.value = `#${tag}`, setFindQuery(quickFind.value), location.hash && location.hash !== "#" ? location.hash = "" : hooks.render();
      }, "tag-button"))), menuContent.append(list2);
    }
    renderEditorTree();
  }
  function tagCounts() {
    let counts = /* @__PURE__ */ new Map();
    return groups.forEach((sun) => sun.links.forEach((planet) => [planet, ...planet.moons].forEach((item) => (item.tags || []).forEach((tag) => counts.set(tag, (counts.get(tag) || 0) + 1))))), [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }
  function showSunEditor(index) {
    if (index !== null && groups[index]?.team) return showTeamSun(index);
    let isNew = index === null, sun = isNew ? { name: "", description: "", color: "#79d9f8", links: [] } : groups[index];
    editorHeader(isNew ? "Add sun" : `Edit ${sun.name}`, showSunList, [index]);
    let form = element("form", "editor-form"), name = editorField("Sun name", sun.name), description = editorField("Description", sun.description, "textarea");
    description.wrapper.append(element("small", "editor-hint", "Use [label](https://example.com) to add a link within the description."));
    let color = editorField("Color", sun.color, "color"), icon = editorField("Icon", sun.icon || "");
    icon.input.maxLength = 16, icon.input.placeholder = "Optional, for example 🧪", icon.input.setAttribute("aria-label", "Icon"), icon.wrapper.append(element("small", "editor-hint", "One or two characters, such as an emoji, shown above the sun’s name.")), form.append(name.wrapper, description.wrapper, color.wrapper, icon.wrapper);
    let actions = element("div", "editor-actions"), save = element("button", "editor-primary", isNew ? "Add sun" : "Save sun");
    if (save.type = "submit", actions.append(save), form.append(actions), form.addEventListener("submit", (event) => {
      event.preventDefault();
      let next = copyGroups(), value = {
        name: name.input.value.trim(),
        description: description.input.value.trim(),
        color: color.input.value,
        icon: icon.input.value,
        links: isNew ? [] : next[index].links
      };
      isNew ? (value.id = uniqueSunId(value.name, new Set(next.map((item) => item.id))), next.push(value)) : (value.id = next[index].id, next[index] = value), applyEditorChange(
        next,
        () => showSunEditor(isNew ? next.length - 1 : index),
        { label: `${isNew ? "Added" : "Saved"} sun ${value.name}` }
      );
    }), menuContent.append(form), !isNew) {
      let sunTools = element("div", "editor-sun-tools"), position = element("div", "editor-row-actions");
      position.setAttribute("role", "group"), position.setAttribute("aria-label", "Sun position"), editorMoveControls(position, index, groups.length, (amount) => {
        let next = copyGroups();
        moveEntry(next, index, amount) && applyEditorChange(next, () => showSunEditor(index + amount));
      }), sunTools.append(editorButton("Export sun", () => exportItem("sun", sun)), position), menuContent.append(sunTools), menuContent.append(element("h4", "editor-section-title", "Planets"));
      let list = element("div", "editor-list");
      sun.links.forEach((planet, planetIndex) => {
        let summary = `${planet.name} · ${counted(planet.moons.length, isGroup(planet) ? "link" : "moon")}`;
        list.append(editorExportRow("planet", planet, summary, "Edit", () => showPlanetEditor(index, planetIndex)));
      }), menuContent.append(list);
      let planetActions = editorActions();
      planetActions.append(editorButton("Add planet", () => showPlanetEditor(index, null), "editor-primary")), planetActions.append(editorButton("Import planet", () => importItem("planet", index))), planetActions.append(editorButton("Import .rdp files as planets", () => showRdpBatchImport("planet", index)));
      let removal = element("div", "editor-sun-removal");
      removal.append(
        editorButton("Remove sun", () => removeEditorItem([index], showSunList), "editor-danger"),
        element("p", "editor-hint", "Removes this sun and all its planets and moons.")
      ), menuContent.append(removal);
    }
  }
  function showPlanetEditor(sunIndex, planetIndex) {
    if (groups[sunIndex]?.team) return showTeamItem([sunIndex, planetIndex]);
    let isNew = planetIndex === null, planet = isNew ? { name: "", url: "", moons: [] } : groups[sunIndex].links[planetIndex], header = editorHeader(isNew ? "Add planet" : `Edit ${planet.name}`, () => showSunEditor(sunIndex), [sunIndex, planetIndex]);
    if (menuContent.append(element("p", "", `Sun: ${groups[sunIndex].name}`)), !isNew) {
      let note = duplicateNote(planet, [sunIndex, planetIndex]);
      note && menuContent.append(note);
    }
    let form = element("form", "editor-form"), name = editorField("Planet name", planet.name);
    form.append(name.wrapper);
    let readDestination = destinationFields(form, planet, (file) => {
      isNew && !name.input.value.trim() && (name.input.value = file.name.replace(/\.rdp$/i, ""));
    }, !0), group = isGroup(planet);
    if (attachItemToolbar(header, form, isNew ? "Add planet" : "Save planet", isNew ? void 0 : {
      kind: "planet",
      item: planet,
      index: planetIndex,
      count: groups[sunIndex].links.length,
      reorder: (amount) => {
        let next = copyGroups();
        moveEntry(next[sunIndex].links, planetIndex, amount) && applyEditorChange(next, () => showPlanetEditor(sunIndex, planetIndex + amount));
      },
      move: () => showMovePlanet(sunIndex, planetIndex),
      remove: () => removeEditorItem([sunIndex, planetIndex], () => showSunEditor(sunIndex)),
      ...group && planet.moons.length ? { extra: {
        label: "Share links as a pack",
        glyph: "↗",
        action: () => shareGroup(planet)
      } } : {}
    }), form.addEventListener("submit", (event) => {
      event.preventDefault();
      let next = copyGroups(), value = {
        name: name.input.value.trim(),
        ...readDestination(),
        moons: isNew ? [] : next[sunIndex].links[planetIndex].moons
      };
      !isNew && isGroup(value) && !isGroup(planet) && !confirmed(`${planet.name} will become a group and lose its link ${planet.type === "rdp" ? planet.host : planet.url}. Continue?`) || (isNew ? next[sunIndex].links.push(value) : next[sunIndex].links[planetIndex] = value, applyEditorChange(next, () => showPlanetEditor(
        sunIndex,
        isNew ? next[sunIndex].links.length - 1 : planetIndex
      ), { label: `${isNew ? "Added" : "Saved"} planet ${value.name}` }));
    }), menuContent.append(form), !isNew) {
      menuContent.append(element("h4", "editor-section-title", group ? "Links" : "Moons")), group && !planet.moons.length && menuContent.append(element("p", "data-source", "No links yet"));
      let list = element("div", "editor-list");
      planet.moons.forEach((moon, moonIndex) => {
        list.append(editorExportRow("moon", moon, moon.name, "Edit", () => showMoonEditor(sunIndex, planetIndex, moonIndex)));
      }), menuContent.append(list);
      let moonActions = editorActions();
      moonActions.append(editorButton(group ? "Add link" : "Add moon", () => showMoonEditor(sunIndex, planetIndex, null), "editor-primary")), moonActions.append(editorButton("Import moon", () => importItem("moon", sunIndex, planetIndex))), moonActions.append(editorButton("Import .rdp files as moons", () => showRdpBatchImport("moon", sunIndex, planetIndex))), planet.moons.some((moon) => moon.type === "rdp") && moonActions.append(editorButton("Apply RDP settings to moons", () => showBulkRdp(sunIndex, planetIndex)));
    }
  }
  function showCopyMoon(sunIndex, planetIndex, moonIndex) {
    let sourceSun = groups[sunIndex], sourcePlanet = sourceSun.links[planetIndex], moon = sourcePlanet.moons[moonIndex], back = () => showMoonEditor(sunIndex, planetIndex, moonIndex);
    editorHeader(`Copy ${moon.name}`, back), menuContent.append(element("p", "", `From ${sourceSun.name} sun → ${sourcePlanet.name} planet`)), menuContent.append(element("p", "", "This copies the saved moon as an independent link. Later edits to either moon will not change the other."));
    let target = element("label", "editor-field");
    target.append(element("span", "", "Copy to planet"));
    let select = document.createElement("select");
    if (select.setAttribute("aria-label", "Copy to planet"), groups.forEach((sun, targetSunIndex) => sun.links.forEach((planet, targetPlanetIndex) => {
      if (targetSunIndex === sunIndex && targetPlanetIndex === planetIndex || sun.team) return;
      let option = element("option", "", `${sun.name} → ${planet.name}`);
      option.value = `${targetSunIndex}:${targetPlanetIndex}`, select.append(option);
    })), !select.options.length) {
      menuContent.append(element("p", "", "Add another planet before copying this moon."));
      return;
    }
    target.append(select), menuContent.append(target), editorActions().append(editorButton("Copy to selected planet", () => {
      let [targetSunIndex, targetPlanetIndex] = select.value.split(":").map(Number), next = copyGroups(), targetMoons = next[targetSunIndex].links[targetPlanetIndex].moons;
      targetMoons.push(JSON.parse(JSON.stringify(moon))), applyEditorChange(next, () => showMoonEditor(targetSunIndex, targetPlanetIndex, targetMoons.length - 1));
    }, "editor-primary"));
  }
  function showMoonEditor(sunIndex, planetIndex, moonIndex) {
    if (groups[sunIndex]?.team) return showTeamItem([sunIndex, planetIndex, moonIndex]);
    let isNew = moonIndex === null, planet = groups[sunIndex].links[planetIndex], moon = isNew ? { name: "", url: "" } : planet.moons[moonIndex], addLabel = isGroup(planet) ? "Add link" : "Add moon", header = editorHeader(
      isNew ? addLabel : `Edit ${moon.name}`,
      () => showPlanetEditor(sunIndex, planetIndex),
      [sunIndex, planetIndex, moonIndex]
    );
    if (menuContent.append(element("p", "", `${groups[sunIndex].name} sun → ${planet.name} planet`)), !isNew) {
      let note = duplicateNote(moon, [sunIndex, planetIndex, moonIndex]);
      note && menuContent.append(note);
    }
    let form = element("form", "editor-form"), name = editorField("Moon name", moon.name);
    form.append(name.wrapper);
    let readDestination = destinationFields(form, moon, (file) => {
      isNew && !name.input.value.trim() && (name.input.value = file.name.replace(/\.rdp$/i, ""));
    });
    attachItemToolbar(header, form, isNew ? addLabel : "Save moon", isNew ? void 0 : {
      kind: "moon",
      item: moon,
      index: moonIndex,
      count: planet.moons.length,
      reorder: (amount) => {
        let next = copyGroups();
        moveEntry(next[sunIndex].links[planetIndex].moons, moonIndex, amount) && applyEditorChange(next, () => showMoonEditor(sunIndex, planetIndex, moonIndex + amount));
      },
      move: () => showMoveMoon(sunIndex, planetIndex, moonIndex),
      remove: () => removeEditorItem([sunIndex, planetIndex, moonIndex], () => showPlanetEditor(sunIndex, planetIndex)),
      extra: { label: "Copy moon", glyph: "⧉", action: () => showCopyMoon(sunIndex, planetIndex, moonIndex) }
    }), form.addEventListener("submit", (event) => {
      event.preventDefault();
      let next = copyGroups(), value = { name: name.input.value.trim(), ...readDestination() };
      isNew ? next[sunIndex].links[planetIndex].moons.push(value) : next[sunIndex].links[planetIndex].moons[moonIndex] = value, applyEditorChange(next, () => showMoonEditor(
        sunIndex,
        planetIndex,
        isNew ? next[sunIndex].links[planetIndex].moons.length - 1 : moonIndex
      ), { label: `${isNew ? "Added" : "Saved"} moon ${value.name}` });
    }), menuContent.append(form);
  }

  // src/ui/editor/index.js
  function installEditor() {
    Object.assign(nav, { showSunList, showSunEditor, showPlanetEditor, showMoonEditor, showImportReview, renderEditorTree });
  }

  // src/ui/views/edit-buttons.js
  var MAP_ITEM = ":is(.home-hub, .detail-hub, .home-satellite, .detail-satellite, .more-link, .moon-link, .overflow-moon-link)", hovered = null, hoverActions = null, timer2 = 0;
  function mapItem(target) {
    let item = target instanceof Element ? target.closest(MAP_ITEM) : null;
    return item instanceof HTMLElement && app?.contains(item) ? item : null;
  }
  function mapPath(item) {
    let { sun, planet, moon } = item.dataset;
    return [sun, planet, moon].filter((index) => index !== void 0).map(Number);
  }
  function canEditFromMap() {
    return modes.overlayIs("none") && !modes.inEditMode();
  }
  function mapFocus(origin, path) {
    let route = location.hash, sunId = groups[path[0]]?.id;
    return () => {
      if (location.hash !== route) return !1;
      let sun = groups.findIndex((group) => group.id === sunId);
      if (sun === -1) return !1;
      let [_, planet, moon] = path, base = `${MAP_ITEM}[data-sun="${sun}"]`, planetSelector = `${base}[data-kind="planet"][data-planet="${planet}"]`, moonSelector = `${base}[data-kind="moon"][data-planet="${planet}"][data-moon="${moon}"]`, node = origin.isConnected ? origin : app.querySelector(moonSelector) || app.querySelector(planetSelector) || app.querySelector(`${base}[data-kind="sun"]`);
      if (!(node instanceof HTMLElement)) return !1;
      let containers = [node.closest(".home-orbit"), node.closest(".planet-cluster, .overflow-planet")];
      node.dataset.kind === "moon" && containers[1]?.classList.contains("group-cluster") && setGroupExpanded(containers[1]);
      for (let container of containers) container?.classList.add("restoring-map-focus");
      node.focus({ preventScroll: node === origin });
      for (let container of containers) container?.classList.remove("restoring-map-focus");
      return document.activeElement === node;
    };
  }
  function editItem(item) {
    let path = mapPath(item);
    openEditorAt(path, { restoreFocus: mapFocus(item, path) });
  }
  function handleMapEditKey(event) {
    if (event.key.toLowerCase() !== "e" || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.isComposing || !canEditFromMap()) return !1;
    let item = mapItem(event.target);
    return !item || item !== document.activeElement ? !1 : (event.preventDefault(), editItem(item), !0);
  }
  function hideActions() {
    window.clearTimeout(timer2), hovered = null, hoverActions?.remove(), hoverActions = null;
  }
  function mapAction(className, icon, name, action) {
    let button = tip(element("button", className, icon), name);
    return button.type = "button", button.tabIndex = -1, button.setAttribute("aria-label", name), button.addEventListener("pointerdown", (event) => {
      event.preventDefault(), event.stopPropagation();
    }), button.addEventListener("click", (event) => {
      event.stopPropagation(), canEditFromMap() && action();
    }), button;
  }
  function showActions(item) {
    let parent = item.parentElement;
    if (!parent || !item.isConnected || !item.matches(":hover") || !showEditButtons || !canEditFromMap()) return;
    let path = mapPath(item), sun = groups[path[0]], target = path.length === 1 ? sun : itemAt(groups, path);
    if (!target) return;
    let verb = sun.team ? "View" : "Edit", detail = path.length === 2 ? isGroup(target) ? " and its links" : " and its moons" : "", actions = element("div", "map-item-actions");
    actions.append(mapAction("map-edit-button", "✎", `${verb} ${target.name}${detail}`, () => {
      item.isConnected && editItem(item);
    })), sun.team || actions.append(mapAction("map-remove-button", "🗑︎", `Remove ${target.name}`, () => {
      if (item.isConnected)
        try {
          removeMapItem(path);
        } catch (error) {
          showOpenAllNotice(`Could not remove ${target.name}: ${/** @type {Error} */
          error.message}`, !0);
        }
    })), parent.append(actions);
    let anchor2 = item.getBoundingClientRect(), base = actions.getBoundingClientRect(), scale = base.width / actions.offsetWidth;
    actions.style.left = `${(anchor2.left + anchor2.width * 0.82 - base.left) / scale - 12}px`, actions.style.top = `${(anchor2.top + anchor2.height * 0.18 - base.top) / scale - 12}px`, hoverActions = actions;
  }
  function installMapEditButtons() {
    document.addEventListener("pointerover", (event) => {
      let item = mapItem(event.target);
      !item || item === hovered || event.pointerType === "touch" || !showEditButtons || !canEditFromMap() || (hideActions(), hovered = item, timer2 = window.setTimeout(() => showActions(item), buttonTipsDelay() ?? 800));
    }), document.addEventListener("pointerout", (event) => {
      if (!hovered || !(event.target instanceof Node) || !hovered.contains(event.target) && !hoverActions?.contains(event.target)) return;
      let next = event.relatedTarget;
      next instanceof Node && (hovered.contains(next) || hoverActions?.contains(next)) || hideActions();
    }), modes.subscribe(() => {
      canEditFromMap() || hideActions();
    }), window.addEventListener("resize", hideActions);
  }

  // src/ui/keys/keys.js
  var ARROWS = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] }, PLANET_SELECTOR = ".home-satellite, .detail-satellite";
  function menuFocusables() {
    return [.../** @type {NodeListOf<HTMLButtonElement>} */
    menuOverlay.querySelectorAll(".menu-sheet :is(button, a[href], input, select, textarea, [tabindex])")].filter((node) => !node.disabled && node.tabIndex >= 0 && node.getClientRects().length > 0);
  }
  function trapMenuFocus(event) {
    let items = menuFocusables();
    if (!items.length) return;
    let first = items[0], last = items[items.length - 1];
    /** @type {HTMLElement} */
    menuOverlay.querySelector(".menu-sheet").contains(document.activeElement) ? event.shiftKey && document.activeElement === first ? (event.preventDefault(), last.focus()) : !event.shiftKey && document.activeElement === last && (event.preventDefault(), first.focus()) : (event.preventDefault(), (event.shiftKey ? last : first).focus());
  }
  function handleEscape(event) {
    if (hideTooltip()) {
      event.preventDefault();
      return;
    }
    let target = modes.escapeTarget();
    if (target === "overlay")
      event.preventDefault(), closeMenu();
    else if (target === "drag")
      event.preventDefault(), cancelDrag();
    else if (target === "edit") {
      event.preventDefault();
      let inBar = editBar().contains(document.activeElement);
      setEditMode(!1), inBar && editToggle().focus();
    } else target === "find" ? (event.preventDefault(), document.activeElement?.closest(".find-results") && quickFind.focus(), quickFind.value = "", setFindQuery(""), app.classList.contains("home-view") && quickFind.dispatchEvent(new Event("input"))) : collapseGroup() ? event.preventDefault() : target === "view" && (location.hash = "");
  }
  function typingInField(target) {
    return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
  }
  function handleSlash(event) {
    return event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey || typingInField(event.target) || !modes.keyAllowed("slash") || topbarSearch.hidden ? !1 : (event.preventDefault(), quickFind.focus(), quickFind.select(), !0);
  }
  function handleFindArrows(event) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return !1;
    let results = [.../** @type {NodeListOf<HTMLElement>} */
    app.querySelectorAll(".find-item")];
    if (!results.length) return !1;
    let active = document.activeElement;
    if (active === quickFind)
      return event.key === "ArrowUp" ? !1 : (event.preventDefault(), results[0].focus(), !0);
    let index = results.indexOf(
      /** @type {HTMLElement} */
      active
    );
    return index === -1 ? !1 : (event.preventDefault(), event.key === "ArrowDown" ? results[Math.min(index + 1, results.length - 1)].focus() : index === 0 ? quickFind.focus() : results[index - 1].focus(), !0);
  }
  function centerOf(node) {
    let box = node.getBoundingClientRect();
    return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  }
  function nearestInDirection(from, candidates, [dx, dy]) {
    let origin = centerOf(from), best = null, bestScore = 1 / 0;
    for (let node of candidates) {
      if (node === from) continue;
      let point = centerOf(node), along = (point.x - origin.x) * dx + (point.y - origin.y) * dy;
      if (along <= 8) continue;
      let across = Math.abs((point.x - origin.x) * dy - (point.y - origin.y) * dx), score = along + across * 2;
      score < bestScore && (best = node, bestScore = score);
    }
    return best;
  }
  function neighbor(list, node, step) {
    let index = list.indexOf(node);
    return index === -1 ? null : list[index + step] || null;
  }
  function planetTarget(planet, [dx, dy]) {
    let cluster = planet.closest(".planet-cluster"), container = cluster.parentElement, planets = [...container.querySelectorAll(":scope > .planet-cluster > :is(.home-satellite, .detail-satellite)")];
    if (dx) return neighbor(planets, planet, dx);
    if (dy > 0) {
      let moon = cluster.querySelector(".moon-link");
      return moon && planet.matches(".group-planet") && !cluster.classList.contains("pinned") && !modes.inEditMode() && (collapseGroup(), setGroupExpanded(cluster)), moon;
    }
    return container.querySelector(":scope > .home-hub");
  }
  function moonTarget(moon, [dx, dy]) {
    let field = moon.closest(".moon-field");
    return dx ? neighbor([...field.querySelectorAll(".moon-link")], moon, dx) : dy < 0 ? field.closest(".planet-cluster").querySelector(`:scope > :is(${PLANET_SELECTOR})`) : null;
  }
  function handleMapArrows(event) {
    let direction = ARROWS[event.key];
    if (!direction || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || modes.menuOpen()) return;
    let active = (
      /** @type {HTMLElement} */
      document.activeElement
    ), target = null;
    active.classList.contains("home-hub") ? target = nearestInDirection(active, [...app.querySelectorAll(".home-hub")], direction) : active.matches(PLANET_SELECTOR) ? target = planetTarget(active, direction) : active.classList.contains("moon-link") && (target = moonTarget(active, direction)), target && (event.preventDefault(), target.focus());
  }
  function installKeys() {
    window.addEventListener("keydown", (event) => {
      event.defaultPrevented || handlePaletteKey(event) || modes.overlayIs("palette") || !modes.keyAllowed("other") || handlePaletteShortcut(event) || handleMapEditKey(event) || (event.key === "Tab" ? modes.menuOpen() && trapMenuFocus(event) : event.key === "Escape" ? handleEscape(event) : !handleSlash(event) && !handleFindArrows(event) && handleMapArrows(event));
    });
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
    document.addEventListener("click", (event) => {
      if (event.defaultPrevented || modes.inEditMode() || !(event.target instanceof Element) || event.composedPath().includes(menuOverlay)) return;
      let button = event.target.closest("button.group-planet");
      if (button && app.contains(button) && button.parentElement) {
        let cluster = button.parentElement, expanded = cluster.classList.contains("pinned");
        collapseGroup(), expanded || setGroupExpanded(cluster);
      } else event.target.closest(".pinned") || collapseGroup();
    }), document.addEventListener("click", trackDestinationClicks), document.addEventListener("auxclick", trackDestinationClicks), document.addEventListener("click", (event) => {
      if (!event.shiftKey || modes.inEditMode() || !(event.target instanceof Element)) return;
      let node = (
        /** @type {HTMLElement | null} */
        event.target.closest('[data-kind="planet"]')
      );
      !node || !app.contains(node) || (event.preventDefault(), event.stopPropagation(), openAll(Number(node.dataset.sun), Number(node.dataset.planet)));
    }, !0);
  }

  // src/app/main.js
  setVersion(APP_VERSION);
  hooks.render = render;
  hooks.refreshQuickBar = refreshQuickBar;
  hooks.openMenu = openMenu;
  hooks.showMenuPanel = showMenuPanel;
  hooks.exportMap = exportMap;
  installEditor();
  installLayout();
  installClicks();
  installRoutineOffers();
  installDrag();
  installKeys();
  installMapEditButtons();
  function startPage() {
    installTooltip(), start();
  }
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", startPage) : startPage();
})();
