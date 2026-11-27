// Shared JSDoc types for the map, in its validated shape (what core/schema.js
// returns and what the store holds). Types only; nothing here runs.

/**
 * @typedef {object} DestinationExtras
 * @property {string[]} [tags] Lowercase, deduplicated, at most 8.
 * @property {true} [favorite]
 * @property {string} [note] Trimmed, at most 500 characters.
 */

/** @typedef {DestinationExtras & {name: string, url: string, type?: undefined}} WebDestination */
/** @typedef {DestinationExtras & {name: string, type: 'rdp', host: string, rdpProfile?: string, rdpPreset?: string}} RdpDestination */
/** @typedef {WebDestination | RdpDestination} Destination */

/** @typedef {Destination} Moon */
/** @typedef {{moons: Moon[], planetId?: string}} PlanetFields */
/** @typedef {Pick<DestinationExtras, 'tags'|'note'> & {name: string, type: 'group'} & PlanetFields} GroupPlanet */
/** @typedef {(Destination & PlanetFields) | GroupPlanet} Planet */

/**
 * A sun. Team suns (from the team map) sit in front of the personal ones in
 * the combined map, have `team: true`, and ids that start with `team:`.
 * @typedef {object} Sun
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {string} color Six-digit hex.
 * @property {string} [icon] One or two characters.
 * @property {Planet[]} links The planets.
 * @property {true} [team]
 */

/** @typedef {{key: string, name: string}} RoutineLink */
/** @typedef {{time: string, days: number[]}} Schedule */
/** @typedef {{id: string, name: string, links: RoutineLink[], schedule?: Schedule}} Routine */
/** @typedef {{id: string, name: string, settings: string}} RdpPreset */

/**
 * A whole personal map. Empty routine and preset lists are left out.
 * @typedef {object} MapData
 * @property {Sun[]} groups
 * @property {Routine[]} [routines]
 * @property {RdpPreset[]} [rdpPresets]
 */

/**
 * Where a planet or moon sits in the combined map: [sun, planet] or [sun, planet, moon].
 * @typedef {number[]} IndexPath
 */

export {};
