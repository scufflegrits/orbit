// Builds Orbit's bundle from src/ (REWRITE_PLAN.md, "Builds and what tests run").
//
//   node build.mjs            release bundle orbit.js (committed; no test hook)
//   node build.mjs --test     test bundle orbit.test.js (git-ignored; with window.OrbitTest)
//   node build.mjs --check    fail if orbit.js doesn't match a fresh release build, or contains OrbitTest
//   node build.mjs --watch    rebuild orbit.js on every change, with a linked source map
//                             (run `npm run build` before committing; the map line breaks --check)
//
// Both bundles are one plain script (IIFE), so index.html works from file://.
// The test bundle's first line is a fingerprint of every build input, which
// tests/helpers.py recomputes before copying it into a fixture.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import * as esbuild from 'esbuild';

const ROOT = new URL('.', import.meta.url).pathname;
const RELEASE = join(ROOT, 'orbit.js');
const TEST = join(ROOT, 'orbit.test.js');
const HEADER = '// Orbit. Built by build.mjs from src/; edit src/, not this file.\n';

/** Every file under a folder, as paths relative to ROOT with / separators. */
function filesUnder(folder) {
  return readdirSync(join(ROOT, folder), { recursive: true })
    .map(name => join(folder, String(name)))
    .filter(path => statSync(join(ROOT, path)).isFile())
    .map(path => path.split(sep).join('/'));
}

/**
 * SHA-256 of every build input: src/**, build.mjs, package.json,
 * package-lock.json, and the installed esbuild version. tests/helpers.py
 * computes the same value the same way.
 */
export function fingerprint() {
  const hash = createHash('sha256');
  const inputs = [...filesUnder('src'), 'build.mjs', 'package.json', 'package-lock.json'].sort();
  for (const path of inputs) {
    hash.update(path).update('\0').update(readFileSync(join(ROOT, path))).update('\0');
  }
  hash.update(`esbuild@${esbuild.version}`);
  return hash.digest('hex');
}

/** @param {{test: boolean, outfile: string, sourcemap?: 'linked'}} options */
function options({ test, outfile, sourcemap }) {
  return {
    entryPoints: [join(ROOT, 'src/app/main.js')],
    outfile,
    bundle: true,
    format: 'iife',
    target: 'es2020',
    charset: 'utf8',
    legalComments: 'none',
    // Drops dead branches such as `if (false) installTestHook()` without minifying names or whitespace.
    minifySyntax: true,
    define: { ORBIT_TEST: String(test) },
    banner: { js: test ? `/* orbit-build-inputs: ${fingerprint()} */\n${HEADER}` : HEADER },
    sourcemap: sourcemap || false,
    logLevel: 'warning',
  };
}

async function main() {
  const mode = process.argv[2] || '--release';
  if (mode === '--release') {
    await esbuild.build(options({ test: false, outfile: RELEASE }));
    console.log(`built ${relative(ROOT, RELEASE)}`);
  } else if (mode === '--test') {
    await esbuild.build(options({ test: true, outfile: TEST }));
    console.log(`built ${relative(ROOT, TEST)}`);
  } else if (mode === '--check') {
    const folder = mkdtempSync(join(tmpdir(), 'orbit-build-'));
    try {
      const fresh = join(folder, 'orbit.js');
      await esbuild.build(options({ test: false, outfile: fresh }));
      const committed = readFileSync(RELEASE, 'utf8');
      if (committed !== readFileSync(fresh, 'utf8')) {
        console.error('orbit.js does not match a fresh build of src/. Run `npm run build` and commit orbit.js.');
        process.exit(1);
      }
      if (committed.includes('OrbitTest')) {
        console.error('orbit.js contains OrbitTest; the release bundle must not include the test hook.');
        process.exit(1);
      }
      console.log('orbit.js matches a fresh release build and has no test hook');
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  } else if (mode === '--watch') {
    const context = await esbuild.context(options({ test: false, outfile: RELEASE, sourcemap: 'linked' }));
    await context.watch();
    console.log('watching src/ (orbit.js with a source map); stop with Ctrl+C');
  } else {
    console.error(`unknown option ${mode}`);
    process.exit(2);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
