// Fails if any file in src/ imports from a higher layer, or if imports form a
// cycle (REWRITE_PLAN.md, "Rules the structure enforces"). Layers, lowest first:
//
//   core < state < services < ui < app
//
// A file may import from its own layer or any lower one. Uses esbuild's
// metafile, so it checks the imports that actually end up in the bundle.
import * as esbuild from 'esbuild';

const ORDER = ['core', 'state', 'services', 'ui', 'app'];
const layerOf = path => {
  const match = /^src\/([^/]+)\//.exec(path);
  return match ? match[1] : null;
};

const result = await esbuild.build({
  entryPoints: ['src/app/main.js'],
  bundle: true,
  write: false,
  metafile: true,
  format: 'iife',
  define: { ORBIT_TEST: 'true' },
  logLevel: 'silent',
});

const problems = [];
const graph = new Map();
for (const [file, info] of Object.entries(result.metafile.inputs)) {
  const from = layerOf(file);
  if (!from) continue;
  if (!ORDER.includes(from)) problems.push(`${file} is in src/${from}/, which is not a known layer (${ORDER.join(', ')})`);
  graph.set(file, info.imports.map(item => item.path).filter(path => path.startsWith('src/')));
  for (const imported of graph.get(file)) {
    const to = layerOf(imported);
    if (ORDER.indexOf(to) > ORDER.indexOf(from)) problems.push(`${file} (${from}) imports ${imported} (${to}), a higher layer`);
  }
}

// Cycles: depth-first search, reporting each cycle once.
const state = new Map();
const visit = (file, stack) => {
  state.set(file, 'open');
  for (const next of graph.get(file) || []) {
    if (state.get(next) === 'open') problems.push(`import cycle: ${[...stack.slice(stack.indexOf(next)), next].join(' -> ')}`);
    else if (!state.has(next)) visit(next, [...stack, next]);
  }
  state.set(file, 'done');
};
for (const file of graph.keys()) if (!state.has(file)) visit(file, [file]);

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`layers OK: ${graph.size} files in src/, no upward imports, no cycles`);
