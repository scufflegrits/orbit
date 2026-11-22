// The one-owner check for interaction modes (REWRITE_PLAN.md, "Who owns mode
// state during the migration", step 5). From phase 4b, src/ui/mode-store.js
// is the only owner. This reads the old classic scripts and src/ and fails
// if any of them keeps its own copy of a mode:
//   - a deleted state flag (editMode, a gesture's own `state`) is used at all
//   - menuOverlay.hidden is read anywhere, or set outside the mode subscriber
//   - a controller (palette, variableDialog, drag) is used as a true-or-false
//     test, such as `if (palette)`, `!palette`, `palette ?`, or `palette?.`
// Uses of a controller's fields (`palette.input`) are allowed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('../../', import.meta.url).pathname;
// The classic scripts index.html loads (tests/helpers.py APP_SCRIPTS).
const helpers = readFileSync(join(ROOT, 'tests/helpers.py'), 'utf8');
const OLD = [...helpers.match(/APP_SCRIPTS = \(([^)]*)\)/s)[1].matchAll(/"([^"]+\.js)"/g)].map(m => m[1]);

/** @param {string} dir @returns {string[]} */
const walk = dir => readdirSync(dir).flatMap(name => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? walk(path) : path.endsWith('.js') && !path.endsWith('.test.js') ? [path] : [];
});
const FILES = [...OLD.map(name => join(ROOT, name)), ...walk(join(ROOT, 'src'))];

/**
 * The code with comments and string contents blanked, so a CSS class such as
 * 'palette-overlay' or a word in a comment never counts. Line numbers stay.
 * @param {string} text
 */
export function codeOnly(text) {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];
    if (c === '/' && next === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      out += '\n';
    } else if (c === '/' && next === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) { if (text[i] === '\n') out += '\n'; i++; }
      i++;
    } else if (c === '"' || c === "'" || c === '`') {
      out += c;
      i++;
      while (i < text.length && text[i] !== c) {
        if (text[i] === '\\') i++;
        else if (c === '`' && text[i] === '$' && text[i + 1] === '{') {
          // Keep template expressions: code can hide there.
          let depth = 0;
          for (; i < text.length; i++) {
            if (text[i] === '{') depth++;
            if (text[i] === '}' && --depth === 0) break;
            out += text[i];
          }
        } else if (text[i] === '\n') out += '\n';
        i++;
      }
      out += c;
    } else {
      out += c;
    }
  }
  return out;
}

const CONTROLLERS = ['palette', 'variableDialog', 'drag'];
const NOT_FIELD = '(?![\\w$.])';
/** Each rule: [what it catches, pattern]. */
export const RULES = [
  ['the deleted editMode flag', /(?<![\w$.])editMode\b(?!\s*:)/],
  ["a gesture's deleted state field", /\b(?:drag|gesture)\.state\b/],
  ...CONTROLLERS.flatMap(name => [
    [`${name} used as a test`, new RegExp(`\\bif\\s*\\(\\s*!?\\s*${name}\\s*\\)`)],
    [`${name} used as a test`, new RegExp(`!\\s*${name}${NOT_FIELD}`)],
    [`${name} used as a test`, new RegExp(`(?<![\\w$.])${name}\\s*(?:\\?(?![.?])|&&|\\|\\|)`)],
    [`${name} used as a test`, new RegExp(`(?:&&|\\|\\|)\\s*${name}${NOT_FIELD}`)],
    [`${name} used as a test`, new RegExp(`(?<![\\w$.])${name}\\?\\.`)],
  ]),
];

/**
 * Every rule broken in one file's code, as "file:line: what".
 * @param {string} name
 * @param {string} text
 */
export function problemsIn(name, text) {
  const lines = codeOnly(text).split('\n');
  const problems = [];
  lines.forEach((line, index) => {
    for (const [what, pattern] of RULES) {
      if (pattern.test(line)) problems.push(`${name}:${index + 1}: ${what}: ${line.trim()}`);
    }
    if (/menuOverlay\.hidden/.test(line) && !(name === 'src/app/start.js' && /^\s*page\.menuOverlay\.hidden = !menu\(next\);$/.test(line))) {
      problems.push(`${name}:${index + 1}: menuOverlay.hidden outside the mode subscriber: ${line.trim()}`);
    }
  });
  return problems;
}

test('one owner: no old flag, no menuOverlay.hidden outside the subscriber, no controller used as a test', () => {
  assert.deepEqual(OLD, [], 'no old classic scripts remain (phase 8)');
  const problems = FILES.flatMap(path => problemsIn(relative(ROOT, path), readFileSync(path, 'utf8')));
  assert.deepEqual(problems, []);
});

test('the subscriber is the one place menuOverlay.hidden is set', () => {
  const start = codeOnly(readFileSync(join(ROOT, 'src/app/start.js'), 'utf8'));
  assert.equal(start.match(/menuOverlay\.hidden =/g)?.length, 1);
});

test('the check catches each kind of second owner', () => {
  const caught = [
    'editMode = true;', 'if (editMode) go();', 'drag.state = "dragging";', 'if (palette) return;', 'if (!variableDialog) return;',
    'return !palette;', 'const x = palette ? 1 : 2;', 'const e = palette?.entries;', 'if (ok && drag) end();', 'if (drag && ok) end();',
    'menuOverlay.hidden = false;', 'if (!menuOverlay.hidden) close();',
  ];
  for (const line of caught) assert.notDeepEqual(problemsIn('x.js', line), [], line);
  const allowed = [
    'palette.input.focus();', 'const { overlay } = palette;', "element('div', 'palette-overlay');", '// if (palette) in a comment',
    'drag = null;', 'drag.target = target;', 'editMode: modes.inEditMode(),', 'const dragging = orbitModes.dragging();',
    'if (orbitModes.holding() && event.pointerId === drag.pointerId) cancelDrag();',
  ];
  for (const line of allowed) assert.deepEqual(problemsIn('x.js', line), [], line);
});
