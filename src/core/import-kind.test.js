import test from 'node:test';
import assert from 'node:assert/strict';
import { importKind } from './import-kind.js';

test('identifies supported files before validating their contents', () => {
  assert.equal(importKind({ groups: [] }), 'map');
  for (const kind of ['sun', 'planet', 'moon']) {
    assert.equal(importKind({ format: 'orbit-item-v1', kind }), kind);
  }
  assert.equal(importKind('', 'bookmarks.HTM'), 'bookmarks');
  assert.equal(importKind(' <!DOCTYPE NETSCAPE-Bookmark-file-1>'), 'bookmarks');
  assert.equal(importKind('<html><DL><p></DL></html>'), 'bookmarks');
  for (const input of ['', 'junk', null, [], {}, { format: 'foreign', groups: [] }]) {
    assert.equal(importKind(input), 'unknown');
  }
});
