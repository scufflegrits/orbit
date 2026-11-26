// The editor's sun list and its row helpers.
import * as prefs from '../../state/prefs.js';
import * as workspaces from '../../state/workspaces.js';
import { activeWorkspace } from '../../state/page-store.js';
import { counted, element } from '../dom.js';
import { hooks } from '../hooks.js';
import { closeMenu, showMenuPanel } from '../menu/menu.js';
import { backupDue, backupReminder } from '../notices/backup.js';
import { team } from '../team-map.js';
import { showQuickAdd } from './quick-add.js';
import { applyEditorChange, copyGroups, editorActions, editorButton, editorExportRow, editorHeader, editorRowActions, editorTree, focusMovedRow, moveEntry } from './kit.js';
import { leaveEditorPage, renderEditorTree } from './page.js';
import { dataSourceLabel, groups, menuContent, quickFind, setFindQuery } from '../page.js';
import { nav } from './nav.js';
import { importFile, exportMap, resetMap } from './import-export.js';
import { editorGroup } from './fields.js';
import { tip } from '../tooltip.js';
import { shareFavorites, showPackImport } from './tools/packs.js';
import { showLinkCheck } from './tools/link-check.js';
import { showDuplicates } from './tools/duplicates.js';
import { showHistory } from './tools/history.js';
import { showPresets } from './tools/presets.js';
import { showRoutines } from './tools/routines.js';

/**
 * @param {number} index
 * @param {number} amount
 * @param {(target: number) => void} after
 */
export function moveSun(index, amount, after) {
  const target = index + amount;
  if (!groups[index] || !groups[target] || groups[index].team || groups[target].team) return;
  const next = copyGroups();
  if (moveEntry(next, index, amount)) {
    applyEditorChange(next, () => after(target), { label: `Reordered sun ${groups[index].name}` });
  }
}

/** @param {number} index @param {number} firstPersonal */
function sunRowActions(index, firstPersonal) {
  return editorRowActions(groups[index].name, index - firstPersonal, groups.length - firstPersonal, [index], amount => {
    const scroll = menuContent.scrollTop;
    moveSun(index, amount, target => {
      nav.showSunList();
      focusMovedRow(menuContent.querySelector('.editor-list'), target, amount, scroll);
    });
  }, nav.showSunList);
}

export function showSunList() {
  editorHeader('Edit links', () => editorTree ? leaveEditorPage() : showMenuPanel('Settings'));
  menuContent.append(element('p', '', 'Choose a sun to edit its planets and moons, or add, import, and export below. Changes are saved in this browser. History keeps earlier versions.'));
  menuContent.append(element('p', 'data-source', `Active link map: ${dataSourceLabel()}`));
  const due = backupDue();
  if (due) menuContent.append(backupReminder(due));
  editorActions().append(
    tip(editorButton('Add sun', () => nav.showSunEditor(null), 'editor-primary'), 'Create a new sun, a group of planets, at the end of your Galaxy.'),
    tip(editorButton('Add a link', () => showQuickAdd('')), 'Add a planet or moon quickly by pasting its address.'),
  );
  menuContent.append(element('h4', 'editor-section-title', 'Suns'));
  const list = element('div', 'editor-list');
  const firstPersonal = groups.findIndex(sun => !sun.team);
  groups.forEach((sun, index) => {
    const summary = `${sun.icon ? `${sun.icon} ` : ''}${sun.name} · ${counted(sun.links.length, 'planet')}${sun.team ? ' · team, read-only' : ''}`;
    list.append(editorExportRow('sun', sun, summary, sun.team ? 'View' : 'Edit', () => nav.showSunEditor(index),
      ...(sun.team ? [] : sunRowActions(index, firstPersonal))));
  });
  menuContent.append(list);
  const hidden = team.groups.filter(sun => prefs.hiddenTeamSuns().has(sun.id));
  if (hidden.length) {
    menuContent.append(element('p', 'data-source', `${counted(hidden.length, 'team sun')} hidden. Show them again in Settings.`));
  }

  editorGroup('Import',
    tip(editorButton('Import a file', importFile), 'Add from a file: a whole map (pick which suns, or replace your map), a single sun, a planet as a new sun, or a browser bookmarks file.'),
    tip(editorButton('Link pack', showPackImport), "Paste a link pack someone shared and add the links you don't have yet."),
  );
  editorGroup('Export',
    tip(editorButton('Whole map (JSON)', exportMap), 'Download your whole map, with routines and presets, as a backup or to move it to another browser.'),
    tip(editorButton('Share favorites', shareFavorites), 'Copy your favorites as a link pack to send to someone.'),
  );
  const fileMode = location.protocol === 'file:';
  const checkLinks = editorButton('Check links', () => {
    if (!fileMode) showLinkCheck();
  });
  if (fileMode) checkLinks.setAttribute('aria-disabled', 'true');
  editorGroup('Organize',
    tip(editorButton('Routines', showRoutines), 'Name sets of links to open together, and have Orbit offer them at set times.'),
    tip(editorButton('RDP presets', showPresets), 'Saved Remote Desktop settings (screen size, monitors) to reuse across computers.'),
    tip(editorButton('Find duplicates', showDuplicates), 'List links that appear more than once in your map.'),
    tip(checkLinks, fileMode
      ? 'Check links needs the local server: run python3 serve.py and open http://localhost:8000.'
      : "Test every web link and mark the ones that don't answer."),
    tip(editorButton('History', showHistory), 'Your map before each of your last 20 changes; restore any of them.'),
  );
  editorGroup('Start over',
    tip(editorButton('Reset to file data', resetMap, 'editor-danger'), workspaces.defaultWorkspace(activeWorkspace())
      ? `Replace ${workspaces.workspaceName(activeWorkspace())}'s edits with its default links.`
      : activeWorkspace() === 'main' ? "Replace Main's edits with its default links."
        : `Replace ${workspaces.workspaceName(activeWorkspace())}'s map with Main's default map.`),
    element('p', 'editor-hint', 'History keeps the current map.'),
  );
  const tags = tagCounts();
  if (tags.length) {
    menuContent.append(element('h4', 'editor-section-title', 'Tags'));
    const list = element('div', 'tag-list');
    tags.forEach(([tag, count]) => list.append(editorButton(`#${tag} · ${count}`, () => {
      closeMenu();
      quickFind.value = `#${tag}`;
      setFindQuery(quickFind.value);
      if (location.hash && location.hash !== '#') location.hash = '';
      else hooks.render();
    }, 'tag-button')));
    menuContent.append(list);
  }
  renderEditorTree();
}

function tagCounts() {
  const counts = new Map();
  groups.forEach(sun => sun.links.forEach((/** @type {any} */ planet) => [planet, ...planet.moons].forEach(item =>
    (item.tags || []).forEach((/** @type {any} */ tag) => counts.set(tag, (counts.get(tag) || 0) + 1)))));
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}
