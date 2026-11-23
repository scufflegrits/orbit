// The map format: what a valid map, sun, planet, moon, routine, Remote Desktop
// preset, link pack, and single-item export are. Every rule and error message
// is 2.2.1's (storage.js, sharing.js, editor.js), held there by the
// differential tests in schema.test.js. Pure: no storage, no DOM.
//
// Where the code looks odd, it's on purpose: the differential test compares
// error messages, and a raw TypeError's message quotes the expression that
// failed (see `days` in validRoutines).
import { isGroup } from './destination.js';
import { templateNames, PLACEHOLDER } from './templates.js';
import { parseRdpProfile, presetSettings, validRdpHost } from './rdp.js';

/** @typedef {import('./types.js').Destination} Destination */
/** @typedef {import('./types.js').DestinationExtras} DestinationExtras */
/** @typedef {import('./types.js').Sun} Sun */
/** @typedef {import('./types.js').Planet} Planet */
/** @typedef {import('./types.js').MapData} MapData */
/** @typedef {import('./types.js').Routine} Routine */
/** @typedef {import('./types.js').RdpPreset} RdpPreset */

/** The color a sun gets when its file has none. */
export const DEFAULT_SUN_COLOR = '#79d9f8';

/**
 * Tags: short lowercase words of letters, digits, spaces, and hyphens; a list
 * or a comma-separated string. Deduplicated; at most 8.
 * @param {unknown} value
 * @param {string} label
 * @returns {string[]}
 */
export function validTags(value, label) {
  if (value === undefined || value === null || value === '') return [];
  const list = Array.isArray(value) ? value : String(value).split(',');
  /** @type {string[]} */
  const tags = [];
  for (const raw of list) {
    const tag = String(raw).trim().toLowerCase().replace(/\s+/g, ' ');
    if (!tag) continue;
    if (!/^[a-z0-9][a-z0-9 -]{0,23}$/.test(tag)) {
      throw new Error(`${label} has an invalid tag “${tag}”. Use up to 24 letters, digits, spaces, or hyphens.`);
    }
    if (!tags.includes(tag)) tags.push(tag);
  }
  if (tags.length > 8) throw new Error(`${label} can have at most 8 tags.`);
  return tags;
}

/**
 * Optional extras shared by planets and moons; empty ones are left out.
 * @param {any} value
 * @param {string} label
 * @returns {DestinationExtras}
 */
function destinationExtras(value, label) {
  /** @type {DestinationExtras} */
  const extras = {};
  const tags = validTags(value.tags, label);
  if (tags.length) extras.tags = tags;
  if (value.favorite === true) extras.favorite = true;
  const note = String(value.note ?? '').trim();
  if (note.length > 500) throw new Error(`${label} has a note longer than 500 characters.`);
  if (note) extras.note = note;
  return extras;
}

/**
 * A planet or moon without its moons: a web address or a Remote Desktop computer.
 * @param {any} value
 * @param {string} label How errors name it, such as "Planet 2 in Work".
 * @returns {Destination}
 */
export function validDestination(value, label) {
  if (isGroup(value)) throw new Error(`${label} can't be a group; only a planet can.`);
  if (!value || typeof value !== 'object') throw new Error(`${label} needs a name and destination.`);
  const name = String(value.name || '').trim();
  if (!name) throw new Error(`${label} needs a name.`);
  const extras = destinationExtras(value, label);
  if (value.type === 'rdp') {
    const host = validRdpHost(String(value.host || '').trim(), label);
    const preset = value.rdpPreset ? { rdpPreset: String(value.rdpPreset) } : {};
    if (value.rdpProfile === undefined) return { name, type: 'rdp', host, ...preset, ...extras };
    return { name, type: 'rdp', host, rdpProfile: parseRdpProfile(value.rdpProfile, host).content, ...preset, ...extras };
  }
  if (value.type !== undefined && value.type !== 'web') throw new Error(`${label} has an unsupported destination type.`);
  const url = String(value.url || '').trim();
  if (templateNames(url).length > 5) throw new Error(`${label} can have at most five {placeholders}.`);
  // Check the address with sample values in place of its placeholders.
  const sample = url.replace(PLACEHOLDER, 'x');
  try {
    if (/[{}]/.test(sample)) throw new Error('unmatched brace');
    const parsed = new URL(sample);
    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password) {
      throw new Error('unsupported URL');
    }
  } catch {
    throw new Error(`${label} needs an http or https URL.`);
  }
  return { name, url, ...extras };
}

/**
 * A sun icon: one or two characters, such as an emoji; '' for none.
 * @param {unknown} value
 * @param {string} name
 */
function validSunIcon(value, name) {
  const icon = String(value ?? '').trim();
  if (!icon) return '';
  const characters = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(icon)];
  if (characters.length > 2 || /[<>&"']/.test(icon)) throw new Error(`${name} needs an icon of one or two characters.`);
  return icon;
}

/**
 * An id made from a name (lowercase letters and digits joined by hyphens), with
 * -2, -3... added until it isn't in `used`. Used for suns, routines, presets,
 * and workspaces.
 * @param {string} name
 * @param {Set<string>} used
 */
export function uniqueSunId(name, used) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'sun';
  let id = base;
  let suffix = 2;
  while (used.has(id)) id = `${base}-${suffix++}`;
  return id;
}

/**
 * @param {any} value
 * @param {string} label
 * @returns {Planet}
 */
function validPlanet(value, label) {
  const planet = isGroup(value) ? validGroup(value, label) : validDestination(value, label);
  if (value.moons !== undefined && !Array.isArray(value.moons)) {
    throw new Error(`${planet.name} needs a moons array.`);
  }
  const moons = (value.moons || []).map((/** @type {any} */ moon, /** @type {number} */ index) =>
    validDestination(moon, `Moon ${index + 1} around ${planet.name}`));
  return { ...planet, moons };
}

/** @param {any} value @param {string} label */
function validGroup(value, label) {
  const name = String(value.name || '').trim();
  if (!name) throw new Error(`${label} needs a name.`);
  const { tags, note } = destinationExtras(value, label);
  return { name, type: /** @type {const} */ ('group'), ...(tags ? { tags } : {}), ...(note ? { note } : {}) };
}

/**
 * A whole map, in its stored shape: unknown fields dropped, defaults filled
 * in, empty routine and preset lists left out. Throws an Error with a message
 * for the user when something can't be fixed.
 * @param {any} data
 * @returns {MapData}
 */
export function validateMap(data) {
  if (!data || !Array.isArray(data.groups)) throw new Error('The link map needs a "groups" array.');
  /** @type {Set<string>} */
  const used = new Set();
  /** @type {Sun[]} */
  const normalized = data.groups.map((/** @type {any} */ group, /** @type {number} */ groupIndex) => {
    if (!group || typeof group !== 'object') throw new Error(`Sun ${groupIndex + 1} is invalid.`);
    const name = String(group.name || '').trim();
    if (!name) throw new Error(`Sun ${groupIndex + 1} needs a name.`);
    const color = group.color === undefined ? DEFAULT_SUN_COLOR : String(group.color).trim();
    if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error(`${name} needs a six-digit hex color.`);
    if (!Array.isArray(group.links)) throw new Error(`${name} needs a planets array.`);
    const id = group.id === undefined || group.id === null || group.id === ''
      ? uniqueSunId(name, used) : String(group.id);
    if (used.has(id)) throw new Error(`Duplicate sun ID: ${id}`);
    used.add(id);
    /** @type {Planet[]} */
    const links = group.links.map((/** @type {any} */ link, /** @type {number} */ linkIndex) => {
      return validPlanet(link, `Planet ${linkIndex + 1} in ${name}`);
    });
    const icon = validSunIcon(group.icon, name);
    return { id, name, description: String(group.description || ''), color, ...(icon ? { icon } : {}), links };
  });
  const routines = validRoutines(data.routines);
  const rdpPresets = validRdpPresets(data.rdpPresets);
  // A link that names a preset the map does not have simply has no preset.
  const presetIds = new Set(rdpPresets.map(preset => preset.id));
  for (const sun of normalized) {
    for (const item of sun.links.flatMap(planet => [planet, ...planet.moons])) {
      if (item.type === 'rdp' && item.rdpPreset && !presetIds.has(item.rdpPreset)) delete item.rdpPreset;
    }
  }
  /** @type {MapData} */
  const map = { groups: normalized };
  if (routines.length) map.routines = routines;
  if (rdpPresets.length) map.rdpPresets = rdpPresets;
  return map;
}

/**
 * Remote Desktop presets: named connection settings without a computer
 * address or any credential. Names are unique ignoring case; a clashing id is
 * replaced silently.
 * @param {unknown} value
 * @returns {RdpPreset[]}
 */
export function validRdpPresets(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error('Remote Desktop presets need to be a list.');
  /** @type {Set<string>} */
  const used = new Set();
  const names = new Set();
  return value.map((preset, index) => {
    const name = String(preset?.name || '').trim();
    if (!name || name.length > 60) throw new Error(`Remote Desktop preset ${index + 1} needs a name of up to 60 characters.`);
    if (names.has(name.toLocaleLowerCase())) throw new Error(`There is already a preset named ${name}.`);
    names.add(name.toLocaleLowerCase());
    const settings = presetSettings(preset.settings, name);
    const id = preset.id && !used.has(String(preset.id)) ? String(preset.id) : uniqueSunId(name, used);
    used.add(id);
    return { id, name, settings };
  });
}

/**
 * Routines: named lists of links, remembered by destination key, with an
 * optional schedule. Names are unique ignoring case; a clashing id is replaced
 * silently; duplicate link keys are dropped; link names are cut to 200.
 * @param {unknown} value
 * @returns {Routine[]}
 */
export function validRoutines(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error('Routines need to be a list.');
  /** @type {Set<string>} */
  const used = new Set();
  const names = new Set();
  return value.map((routine, index) => {
    if (!routine || typeof routine !== 'object') throw new Error(`Routine ${index + 1} is invalid.`);
    const name = String(routine.name || '').trim();
    if (!name || name.length > 60) throw new Error(`Routine ${index + 1} needs a name of up to 60 characters.`);
    if (names.has(name.toLocaleLowerCase())) throw new Error(`There is already a routine named ${name}.`);
    names.add(name.toLocaleLowerCase());
    if (!Array.isArray(routine.links)) throw new Error(`${name} needs a links list.`);
    const keys = new Set();
    const links = [];
    for (const link of routine.links) {
      const key = String(link?.key || '').trim();
      if (!key || key.length > 2000) throw new Error(`${name} has an invalid link.`);
      if (keys.has(key)) continue;
      keys.add(key);
      links.push({ key, name: String(link.name || '').trim().slice(0, 200) || key });
    }
    if (links.length > 100) throw new Error(`${name} can have at most 100 links.`);
    const id = routine.id && !used.has(String(routine.id)) ? String(routine.id) : uniqueSunId(name, used);
    used.add(id);
    /** @type {Routine} */
    const result = { id, name, links };
    if (routine.schedule) {
      const time = String(routine.schedule.time || '');
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error(`${name} needs a time such as 08:00.`);
      // Keep this expression as written: a string of days throws a TypeError
      // whose message quotes it, exactly as 2.2.1 does.
      const days = [...new Set((routine.schedule.days || []).map(Number))].sort();
      if (!days.length || days.some(day => !Number.isInteger(day) || day < 0 || day > 6)) {
        throw new Error(`${name} needs at least one day for its schedule.`);
      }
      result.schedule = { time, days };
    }
    return result;
  });
}

/** @typedef {{name: string, links: Destination[], routine: {name: string, schedule: any} | null}} LinkPack */

/**
 * A link pack file (orbit-pack-v1). Links are validated one by one; a
 * routine's schedule is passed through unchecked, as in 2.2.1 (it's checked
 * when the routine is added).
 * @param {any} data
 * @returns {LinkPack}
 */
export function validPack(data) {
  if (!data || data.format !== 'orbit-pack-v1' || !Array.isArray(data.links)) {
    throw new Error('This is not an Orbit link pack.');
  }
  const name = String(data.name || '').trim().slice(0, 60) || 'Shared links';
  const links = data.links.map((/** @type {any} */ link, /** @type {number} */ index) =>
    validDestination(link, `Link ${index + 1} in the pack`));
  if (!links.length) throw new Error('The pack has no links.');
  return { name, links, routine: data.routine ? { name: String(data.routine.name || name).trim().slice(0, 60) || name,
    schedule: data.routine.schedule } : null };
}

/**
 * A single-item export file (orbit-item-v1), validated as the kind it will
 * become. A planet can be imported as a new sun (`kind` 'sun', `sourceKind` 'planet').
 * @param {any} data
 * @param {'sun'|'planet'|'moon'} kind
 * @param {'sun'|'planet'|'moon'} [sourceKind]
 * @returns {any} A Sun, Planet, or Destination (moon).
 */
export function validItemExport(data, kind, sourceKind = kind) {
  if (!data || data.format !== 'orbit-item-v1' || data.kind !== sourceKind || !data.item) {
    throw new Error(`Choose an Orbit ${sourceKind} export file.`);
  }
  if (kind === 'sun' && sourceKind === 'planet') return validateMap({ groups: [{ name: data.item.name, links: [data.item] }] }).groups[0];
  if (kind === 'sun') return validateMap({ groups: [data.item] }).groups[0];
  if (kind === 'planet') return validateMap({ groups: [{ name: 'Import', links: [data.item] }] }).groups[0].links[0];
  return validDestination(data.item, 'Moon');
}
