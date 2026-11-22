// core/bookmarks.js: browser bookmark folders to suns. Parsing the HTML file
// into a folder tree is services/file-io (phase 4); this takes the tree.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { oracle } from '../../tests/oracle/oracle.mjs';
import { runs, webUrl } from '../../tests/unit/arbitraries.mjs';
import { BOOKMARK_LIMIT, bookmarksToMap } from './bookmarks.js';

const old = oracle();
const link = (name, url) => ({ name, url });
const folder = (name, links = [], folders = []) => ({ name, links, folders });

test('toolbar folders are unwrapped, other folders become suns, loose links go to Bookmarks', () => {
  const root = folder('Bookmarks', [link('Loose', 'https://loose.test/')], [
    folder('Bookmarks bar', [link('On bar', 'https://bar.test/')], [folder('Work', [link('Jira', 'https://jira.test/')])]),
    folder('News', [link('Verge', 'https://verge.test/')], [folder('Sub', [link('A', 'https://a.test/'), link('B', 'https://b.test/')], [folder('Deep', [link('C', 'https://c.test/')])])]),
  ]);
  const { map, stats } = bookmarksToMap(root);
  assert.deepEqual(map.groups.map(sun => sun.name), ['Work', 'Bookmarks bar', 'News', 'Bookmarks']);
  const news = map.groups[2];
  assert.deepEqual(news.links.map(p => p.name), ['Verge', 'Sub'], 'a subfolder becomes one planet');
  assert.equal(news.links[1].url, 'https://a.test/', 'its first link is the planet');
  assert.deepEqual(news.links[1].moons.map(m => m.name), ['B', 'C'], 'the rest, deeper folders included, are moons');
  assert.equal(news.description, 'Imported from browser bookmarks');
  assert.deepEqual(stats, { links: 7, skipped: 0, truncated: false });
});

test('non-web links are skipped and counted; empty folders are dropped; a missing name uses the host', () => {
  const { map, stats } = bookmarksToMap(folder('Root', [], [
    folder('Mixed', [link('', 'https://named.test/x'), link('JS', 'javascript:void(0)'), link('Bad', 'not a url'), link('FTP', 'ftp://f.test/')]),
    folder('Empty', [link('JS', 'javascript:1')]),
  ]));
  assert.deepEqual(map.groups.map(sun => sun.name), ['Mixed']);
  assert.equal(map.groups[0].links[0].name, 'named.test');
  assert.deepEqual(stats, { links: 1, skipped: 4, truncated: false }, 'the dropped folder\'s link counts as skipped too');
});

test(`at most ${BOOKMARK_LIMIT} links are imported`, () => {
  const many = Array.from({ length: BOOKMARK_LIMIT + 5 }, (_, i) => link(`L${i}`, `https://l${i}.test/`));
  const { map, stats } = bookmarksToMap(folder('Root', [], [folder('Big', many)]));
  assert.equal(map.groups[0].links.length, BOOKMARK_LIMIT);
  assert.deepEqual(stats, { links: BOOKMARK_LIMIT, skipped: 0, truncated: true });
});

// Differential: random folder trees give 2.2.1's map and counts, or its error.
const nameArb = fc.constantFrom('Work', 'News', 'Bookmarks bar', 'Favorites bar', 'Other bookmarks', 'Mobile bookmarks', 'Sub', '', 'A & B');
const linkArb = fc.record({ name: fc.constantFrom('', 'Docs', 'Jira', 'x'), url: webUrl });
const tree = fc.letrec(tie => ({
  folder: fc.record({ name: nameArb, links: fc.array(linkArb, { maxLength: 3 }),
    folders: fc.oneof({ depthSize: 'small', withCrossShrink: true }, fc.constant([]), fc.array(tie('folder'), { maxLength: 3 })) }),
})).folder;

test('bookmarksToMap matches 2.2.1 on random folder trees', () => {
  fc.assert(fc.property(tree, root => {
    let mine;
    try {
      mine = JSON.parse(JSON.stringify(bookmarksToMap(root)));
    } catch (error) {
      mine = { error: error.message };
    }
    assert.deepEqual(mine, old.call('bookmarksToMap', root));
  }), runs(500));
});
