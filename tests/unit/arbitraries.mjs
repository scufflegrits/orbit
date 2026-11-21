// fast-check generators shared by the rewrite's node tests (REWRITE_PLAN.md,
// "Property-based tests"). Maps are kept within the plan's bounds: up to 10
// suns, 12 planets per sun, and 8 moons per planet.
//
// Two kinds of generator:
// - "raw" ones produce what might be in a file or in storage: valid, nearly
//   valid, and wrong values, for comparing validation with 2.2.1;
// - "valid" ones produce maps 2.2.1 accepts, already in their validated shape,
//   for the map operations and search.
import fc from 'fast-check';

const pick = list => fc.constantFrom(...list);

// ---- Pieces of addresses ------------------------------------------------

const hostWord = pick(['a', 'docs', 'Jira', 'WIKI', 'status', 'mail', 'x-y', 'b2', 'example', 'Tech']);
const tld = pick(['test', 'example', 'com', 'org']);
export const hostName = fc.tuple(fc.boolean(), fc.array(hostWord, { minLength: 1, maxLength: 2 }), tld)
  .map(([www, words, end]) => `${www ? 'www.' : ''}${words.join('.')}.${end}`);
const pathPart = pick(['docs', 'Docs', 'a', 'b', '{ticket}', '{id}', 'x%20y', 'café', '', 'API', '{q}']);
const queryPart = pick(['', '?q=1', '?b=2&a=1', '?a=1&b=2', '?q={term}', '?x', '?Q=Up']);
const fragment = pick(['', '#top', '#', '#{x}']);

/** Web addresses, mostly valid, some with placeholders, ports, and odd shapes. */
export const webUrl = fc.oneof(
  { weight: 8, arbitrary: fc.tuple(pick(['https', 'http', 'HTTPS']), hostName, pick(['', ':8080', ':443', ':80']),
    fc.array(pathPart, { maxLength: 3 }), pick(['', '/', '//']), queryPart, fragment)
    .map(([scheme, host, port, parts, slash, query, hash]) =>
      `${scheme}://${host}${port}${parts.length ? '/' + parts.join('/') : ''}${slash}${query}${hash}`) },
  { weight: 2, arbitrary: pick([
    'ftp://a.test/', 'https://user:pw@a.test/', 'javascript:alert(1)', 'not a url', '', '  https://a.test/  ',
    'https://a.test/{', 'https://a.test/}', 'https://a.test/{a}{b}{c}{d}{e}{f}', 'https://{host}.test/',
    'https://a.test/{toolongplaceholdernamexxxxxxxxxxxxx}', 'https://a.test/{a}/{a}', 'https://', 'http://[::1]/',
    'https://a.test/?q={x}#{y}', 'https://xn--caf-dma.test/', 'https://a.test:99999/']) },
);

/** Remote Desktop hosts: valid names and IPs with and without ports, and invalid ones. */
export const rdpHost = fc.oneof(
  { weight: 4, arbitrary: fc.tuple(pick(['lab1', 'LAB1', 'srv-01.corp.test', '10.0.0.5', 'a']),
    pick(['', ':3389', ':03389', ':1', ':65535'])).map(([name, port]) => name + port) },
  { weight: 1, arbitrary: pick(['', ' lab1 ', 'lab1:0', 'lab1:65536', '-bad', 'bad-', 'a..b', 'x y', 'lab1:3389:1', 'host:abc']) },
);

// ---- RDP text -----------------------------------------------------------

const rdpLine = pick([
  'screen mode id:i:2', 'desktopwidth:i:1920', 'desktopheight:i:1080', 'use multimon:i:0',
  'audiomode:i:0', 'prompt for credentials:i:1', 'username:s:alice', 'password 51:b:00ff',
  'Signature:s:abc', 'signscope:s:x', 'gatewaytoken:s:t', 'full address:s:other-host', 'full address:s:lab2:3390',
  'full address:i:1', '', '   ', 'not a setting', 'bad*key:s:1', 'Redirect Printers:i:1', 'x:Z:1',
]);
/** Text of an .rdp file or preset settings, joined with any line ending, sometimes with a byte-order mark. */
export const rdpText = fc.tuple(fc.boolean(), fc.array(rdpLine, { maxLength: 8 }), pick(['\r\n', '\n', '\r']))
  .map(([bom, lines, end]) => (bom ? '﻿' : '') + lines.join(end));

// ---- Destinations and maps ---------------------------------------------

const name = pick(['Docs', 'Jira', 'Wiki', 'Status', 'Mail', 'The Verge', 'engadget', 'Tech reviews', 'Lab 1',
  'café menu', 'Ticket', 'build2', 'Release notes', 'CI', 'a', 'Docs']);
const tag = pick(['work', 'ops', 'docs', 'daily', 'team a', 'x-1']);
const note = pick(['', 'Morning check', 'see runbook', 'verge.com mirror']);

/** Extras a planet or moon may carry, valid for 2.2.1. */
const extras = fc.record({
  tags: fc.array(tag, { maxLength: 3 }),
  favorite: fc.boolean(),
  note,
}, { requiredKeys: [] });

const validWebUrl = fc.tuple(pick(['https', 'http']), hostName, fc.array(pick(['docs', 'Docs', 'a', '{ticket}', 'API']), { maxLength: 2 }),
  pick(['', '/']), pick(['', '?q=1', '?q={term}']))
  .map(([scheme, host, parts, slash, query]) => `${scheme}://${host}${parts.length ? '/' + parts.join('/') : ''}${slash}${query}`);
const validRdpHost = fc.tuple(pick(['lab1', 'LAB1', 'srv-01.corp.test', '10.0.0.5']), pick(['', ':3389', ':3390']))
  .map(([host, port]) => host + port);

/** A destination 2.2.1 accepts, in its validated shape (no moons). */
export const validDestination = fc.oneof(
  { weight: 5, arbitrary: fc.tuple(name, validWebUrl, extras).map(([n, url, e]) => ({ name: n, url, ...clean(e) })) },
  { weight: 1, arbitrary: fc.tuple(name, validRdpHost, extras).map(([n, host, e]) => ({ name: n, type: 'rdp', host, ...clean(e) })) },
);

// The validated shape leaves empty extras out.
function clean(e) {
  const out = {};
  const tags = [...new Set(e.tags || [])];
  if (tags.length) out.tags = tags;
  if (e.favorite) out.favorite = true;
  if (e.note) out.note = e.note;
  return out;
}

/** A sun 2.2.1 accepts, in its validated shape. Ids are fixed up by validMap. */
const validSun = fc.record({
  name: pick(['Work', 'Tech', 'Home', 'Lab', 'News', 'Reviews', 'Ops', 'work']),
  color: pick(['#79d9f8', '#f8a979', '#123abc']),
  description: pick(['', 'Daily tools']),
  links: fc.array(fc.tuple(validDestination, fc.array(validDestination, { maxLength: 8 }))
    .map(([planet, moons]) => ({ ...planet, moons })), { maxLength: 12 }),
});

/** A whole map 2.2.1 accepts, with unique sun ids, in its validated shape (field order included). */
export const validMap = fc.array(validSun, { maxLength: 10 }).map(suns => {
  const used = new Set();
  return suns.map(sun => {
    const base = sun.name.toLowerCase();
    let id = base;
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
    used.add(id);
    return { id, name: sun.name, description: sun.description, color: sun.color, links: sun.links };
  });
});

/** A valid map with 0–2 team suns in front, as the page holds it (team ids carry the `team:` prefix). */
export const combinedMap = fc.tuple(validMap, fc.array(validSun, { maxLength: 2 })).map(([personal, team]) => [
  ...team.map((sun, index) => ({ id: `team:t${index}`, name: sun.name, description: sun.description, color: sun.color,
    links: sun.links, team: true })),
  ...personal,
]);

// ---- Raw (unvalidated) maps --------------------------------------------

const rawValue = fc.oneof(fc.constant(undefined), fc.constant(null), fc.constant(''), fc.integer({ min: -2, max: 70 }),
  fc.boolean(), fc.string({ maxLength: 6 }), fc.constant([]), fc.constant({}));

/** A planet or moon as it might appear in a file: valid fields, wrong types, unknown fields. */
const rawDestination = fc.record({
  name: fc.oneof({ weight: 5, arbitrary: name }, { weight: 1, arbitrary: rawValue }, { weight: 1, arbitrary: pick(['  Spaced  ', 'x'.repeat(30)]) }),
  url: fc.oneof({ weight: 5, arbitrary: webUrl }, { weight: 1, arbitrary: rawValue }),
  type: fc.oneof({ weight: 6, arbitrary: fc.constant(undefined) }, { weight: 1, arbitrary: pick(['rdp', 'web', 'ftp', 'RDP']) }),
  host: fc.oneof({ weight: 3, arbitrary: rdpHost }, { weight: 1, arbitrary: rawValue }),
  rdpProfile: fc.oneof({ weight: 6, arbitrary: fc.constant(undefined) }, { weight: 2, arbitrary: rdpText },
    { weight: 1, arbitrary: pick([null, '', 'full address:s:lab1', 'full address:s:lab1\r\nfull address:s:lab2']) }),
  rdpPreset: fc.oneof({ weight: 4, arbitrary: fc.constant(undefined) }, { weight: 1, arbitrary: pick(['', 'wide', 'missing', 'Wide']) }),
  tags: fc.oneof({ weight: 3, arbitrary: fc.array(tag, { maxLength: 4 }) },
    { weight: 1, arbitrary: pick(['work, ops', ' Work ,work', 'bad!', ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'], 'x'.repeat(25), ['Team  A']]) },
    { weight: 1, arbitrary: rawValue }),
  favorite: fc.oneof(fc.constant(undefined), fc.boolean(), pick(['true', 1])),
  note: fc.oneof({ weight: 3, arbitrary: note }, { weight: 1, arbitrary: pick(['  padded  ', 'n'.repeat(501), 'n'.repeat(500)]) }, { weight: 1, arbitrary: rawValue }),
  extra: fc.oneof(fc.constant(undefined), fc.constant(1)),
  team: fc.oneof(fc.constant(undefined), fc.constant(true)),
}, { requiredKeys: ['name'] });

const rawPlanet = fc.tuple(rawDestination, fc.oneof(
  { weight: 5, arbitrary: fc.array(fc.tuple(rawDestination, fc.oneof(fc.constant(undefined), fc.constant([{ name: 'Deep', url: 'https://d.test/' }])))
    .map(([moon, deeper]) => (deeper ? { ...moon, moons: deeper } : moon)), { maxLength: 3 }) },
  { weight: 1, arbitrary: pick([undefined, null, 'none', {}]) },
)).map(([planet, moons]) => (moons === undefined ? planet : { ...planet, moons }));

const rawSun = fc.record({
  id: fc.oneof({ weight: 3, arbitrary: fc.constant(undefined) }, { weight: 2, arbitrary: pick(['work', 'tech', 'work-2', 'team:x', '']) },
    { weight: 1, arbitrary: pick([null, 7]) }),
  name: fc.oneof({ weight: 6, arbitrary: pick(['Work', 'Tech', 'work', 'My Sun!', '!!!', 'Café']) }, { weight: 1, arbitrary: rawValue }),
  color: fc.oneof({ weight: 4, arbitrary: pick(['#79d9f8', '#ABCDEF', ' #123456 ']) }, { weight: 2, arbitrary: fc.constant(undefined) },
    { weight: 1, arbitrary: pick([null, '', 'red', '#12345', 123456]) }),
  description: fc.oneof(fc.constant(undefined), pick(['', 'About', 0, null])),
  icon: fc.oneof({ weight: 4, arbitrary: fc.constant(undefined) }, { weight: 1, arbitrary: pick(['', '🚀', 'ab', 'abc', '<', ' x ', '👩‍💻', '🇺🇸🇬🇧']) }),
  links: fc.oneof({ weight: 8, arbitrary: fc.array(rawPlanet, { maxLength: 4 }) }, { weight: 1, arbitrary: pick([undefined, null, 'x', {}]) }),
  team: fc.oneof(fc.constant(undefined), fc.constant(true)),
  extra: fc.oneof(fc.constant(undefined), fc.constant('x')),
}, { requiredKeys: [] });

const rawRoutine = fc.record({
  id: fc.oneof(fc.constant(undefined), pick(['morning', 'm', '', 'morning'])),
  name: fc.oneof({ weight: 5, arbitrary: pick(['Morning', 'morning', 'Evening', 'r'.repeat(61), ' Spaced ']) }, { weight: 1, arbitrary: rawValue }),
  links: fc.oneof({ weight: 6, arbitrary: fc.array(fc.oneof(
    fc.record({ key: pick(['https://a.test', 'rdp:lab1', '', ' https://a.test ', 'k'.repeat(2001)]), name: fc.oneof(name, fc.constant(undefined), fc.constant('n'.repeat(250))) }),
    rawValue), { maxLength: 4 }) }, { weight: 1, arbitrary: rawValue }),
  schedule: fc.oneof({ weight: 3, arbitrary: fc.constant(undefined) },
    { weight: 3, arbitrary: fc.record({ time: pick(['08:00', '23:59', '24:00', '8:00', '', undefined]),
      days: fc.oneof(fc.array(pick([0, 1, 6, 7, -1, '3', 1.5, 1]), { maxLength: 4 }), pick([undefined, null, '1,2'])) }, { requiredKeys: [] }) },
    { weight: 1, arbitrary: pick([null, 0, 'daily']) }),
  extra: fc.oneof(fc.constant(undefined), fc.constant(2)),
}, { requiredKeys: [] });

const rawPreset = fc.record({
  id: fc.oneof(fc.constant(undefined), pick(['wide', 'wide', 'w', ''])),
  name: fc.oneof({ weight: 5, arbitrary: pick(['Wide', 'wide', 'Small', 'p'.repeat(61)]) }, { weight: 1, arbitrary: rawValue }),
  settings: fc.oneof({ weight: 4, arbitrary: rdpText }, { weight: 1, arbitrary: rawValue },
    { weight: 1, arbitrary: fc.constant(Array.from({ length: 101 }, (_, i) => `k${i}:i:1`).join('\n')) }),
  extra: fc.oneof(fc.constant(undefined), fc.constant(3)),
}, { requiredKeys: [] });

/** A map as it might be in a file or in storage: often valid, often not, never trusted. */
export const rawMap = fc.oneof(
  { weight: 12, arbitrary: fc.record({
    groups: fc.array(rawSun, { maxLength: 4 }),
    routines: fc.oneof({ weight: 3, arbitrary: fc.constant(undefined) }, { weight: 3, arbitrary: fc.array(rawRoutine, { maxLength: 3 }) },
      { weight: 1, arbitrary: pick([null, 'x', {}]) }),
    rdpPresets: fc.oneof({ weight: 3, arbitrary: fc.constant(undefined) }, { weight: 3, arbitrary: fc.array(rawPreset, { maxLength: 3 }) },
      { weight: 1, arbitrary: pick([null, 'x', {}]) }),
    extra: fc.oneof(fc.constant(undefined), fc.constant(true)),
  }, { requiredKeys: ['groups'] }) },
  { weight: 1, arbitrary: pick([null, undefined, {}, { groups: 'x' }, [], 'map', 3]) },
);

/** Settings for property runs: a fixed seed by default so failures repeat; FC_SEED overrides it. */
export const runs = (numRuns = 300) => ({ numRuns, seed: process.env.FC_SEED ? Number(process.env.FC_SEED) : 2026 });

export { rawDestination, rawSun, rawRoutine, rawPreset };
