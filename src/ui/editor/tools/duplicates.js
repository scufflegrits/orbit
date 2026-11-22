// Find duplicates (2.2.1 tools.js): links that point to the same address or computer.
// Moved in rewrite phase 6b.
import * as mapOps from '../../../core/map-ops.js';
import { addressText } from '../../../core/search.js';
import { counted, element } from '../../dom.js';
import { editorButton, editorHeader, editPath, pathLabel } from '../kit.js';
import { nav } from '../nav.js';
import { groups, menuContent } from '../../page.js';

export function showDuplicates() {
  editorHeader('Find duplicates', nav.showSunList);
  const duplicates = mapOps.duplicateGroups(groups);
  menuContent.append(element('p', '', 'Links that point to the same address or Remote Desktop computer. A copy you made on purpose shows here too; nothing is changed unless you edit or remove an item.'));
  if (!duplicates.length) {
    menuContent.append(element('p', 'editor-note', 'No duplicates found.'));
    return;
  }
  menuContent.append(element('p', 'data-source', `${counted(duplicates.length, 'address', 'addresses')} used more than once.`));
  duplicates.forEach(list => {
    const block = element('div', 'duplicate-group');
    block.append(element('h4', 'editor-section-title', addressText(list[0].item)));
    list.forEach(({ path }) => {
      const row = element('div', 'editor-list-row');
      row.append(element('span', '', `${pathLabel(path)}${groups[path[0]].team ? ' · team' : ''}`));
      row.append(editorButton(groups[path[0]].team ? 'View' : 'Edit', () => editPath(path)));
      block.append(row);
    });
    menuContent.append(block);
  });
}
