// Bulk Remote Desktop settings (2.2.1 tools.js): apply one set of settings to a planet's Remote Desktop links.
// Moved in rewrite phase 6b.
import * as rdp from '../../../core/rdp.js';
import * as fileIo from '../../../services/file-io.js';
import { confirmed } from '../../dialogs/confirm.js';
import { counted, element } from '../../dom.js';
import { applyEditorChange, copyGroups, editorActions, editorButton, editorError, editorHeader, profileRows } from '../kit.js';
import { nav } from '../nav.js';
import { groups, menuContent, rdpPresets } from '../../page.js';

/**
 * @param {any} sunIndex
 * @param {any} planetIndex
 */
export function showBulkRdp(sunIndex, planetIndex) {
  const planet = groups[sunIndex].links[planetIndex];
  const back = () => nav.showPlanetEditor(sunIndex, planetIndex);
  editorHeader(`RDP settings for ${planet.name}`, back);
  menuContent.append(element('p', '', 'Apply one set of Remote Desktop settings to several links at once. Each link keeps its own computer; passwords, tokens, and signatures are never kept.'));
  /** @type {{label: string, path: number[], item: any}[]} */
  const targets = [];
  if (planet.type === 'rdp') targets.push({ label: `${planet.name} (this planet)`, path: [sunIndex, planetIndex], item: planet });
  planet.moons.forEach((/** @type {any} */ moon, /** @type {any} */ moonIndex) => {
    if (moon.type === 'rdp') targets.push({ label: moon.name, path: [sunIndex, planetIndex, moonIndex], item: moon });
  });
  /** @type {string | null} */
  let profile = null;
  const sourceField = element('label', 'editor-field');
  sourceField.append(element('span', '', 'Settings from'));
  const source = document.createElement('select');
  source.setAttribute('aria-label', 'Settings from');
  const fileOption = element('option', '', 'An .rdp file…');
  fileOption.value = 'file';
  source.append(fileOption);
  targets.forEach((target, index) => {
    if (!target.item.rdpProfile) return;
    const option = element('option', '', `${target.item.name}’s imported settings`);
    option.value = String(index);
    source.append(option);
  });
  rdpPresets.forEach(preset => {
    const option = element('option', '', `Preset: ${preset.name}`);
    option.value = `preset:${preset.id}`;
    source.append(option);
  });
  sourceField.append(source);
  const preview = element('div', 'rdp-bulk-preview');
  const chooseFile = editorButton('Choose .rdp file', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.rdp,application/x-rdp';
    input.addEventListener('change', async () => {
      const files = input.files;
      if (!files?.length) return;
      try {
        const parsed = rdp.parseRdpProfile(await fileIo.readRdpText(files[0]));
        setProfile(parsed.content, `${files[0].name}${parsed.removed ? ` (${counted(parsed.removed, 'sensitive setting')} excluded)` : ''}`);
      } catch (error) {
        editorError(`RDP import failed: ${/** @type {any} */ (error).message}`);
      }
    });
    input.click();
  });
  const apply = editorButton('Apply to selected links', () => {
    const chosen = targets.filter((_, index) => boxes[index].checked);
    if (!profile || !chosen.length) return;
    const next = copyGroups();
    const preset = source.value.startsWith('preset:') ? source.value.slice(7) : null;
    for (const target of chosen) {
      const item = target.path.length === 3
        ? next[target.path[0]].links[target.path[1]].moons[target.path[2]] : next[target.path[0]].links[target.path[1]];
      // A preset is linked by name; other settings are copied in.
      if (preset) item.rdpPreset = preset;
      else {
        item.rdpProfile = rdp.parseRdpProfile(profile, item.host).content;
        delete item.rdpPreset;
      }
    }
    applyEditorChange(next, back, { label: `Applied RDP settings to ${counted(chosen.length, 'link')} in ${planet.name}` });
  }, 'editor-primary');
  apply.disabled = true;
  const setProfile = (/** @type {any} */ content, /** @type {any} */ from) => {
    profile = content;
    preview.replaceChildren(element('p', 'data-source', `Settings from ${from}:`));
    const rows = element('ul', 'rdp-bulk-settings');
    profileRows(content).filter((/** @type {any} */ row) => !/^full address:/i.test(row)).forEach((/** @type {any} */ row) => rows.append(element('li', '', row)));
    if (!rows.children.length) rows.append(element('li', '', 'Only the computer address (no other settings).'));
    preview.append(rows);
    apply.disabled = false;
  };
  const update = () => {
    chooseFile.hidden = source.value !== 'file';
    if (source.value === 'file') {
      profile = null;
      preview.replaceChildren(element('p', 'data-source', 'Choose an .rdp file to see its settings.'));
      apply.disabled = true;
    } else if (source.value.startsWith('preset:')) {
      const preset = rdpPresets.find(item => item.id === source.value.slice(7));
      setProfile(`full address:s:example\r\n${preset.settings}`, `the ${preset.name} preset`);
    } else {
      setProfile(targets[Number(source.value)].item.rdpProfile, `${targets[Number(source.value)].item.name}`);
    }
  };
  source.addEventListener('change', update);
  menuContent.append(sourceField);
  editorActions().append(chooseFile);
  menuContent.append(preview);
  menuContent.append(element('h4', 'editor-section-title', 'Apply to'));
  const boxes = targets.map(target => {
    const row = element('label', 'editor-check');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = true;
    row.append(box, element('span', '', `${target.label} → ${target.item.host}${target.item.rdpProfile ? ' (has settings)' : ''}`));
    menuContent.append(row);
    return box;
  });
  const actions = editorActions();
  actions.append(apply);
  actions.append(editorButton('Clear imported settings', () => {
    const chosen = targets.filter((_, index) => boxes[index].checked && targets[index].item.rdpProfile);
    if (!chosen.length) return editorError('None of the selected links has imported settings.');
    if (!confirmed(`Remove imported settings from ${counted(chosen.length, 'link')}?`)) return;
    const next = copyGroups();
    for (const target of chosen) {
      const item = target.path.length === 3
        ? next[target.path[0]].links[target.path[1]].moons[target.path[2]] : next[target.path[0]].links[target.path[1]];
      delete item.rdpProfile;
    }
    applyEditorChange(next, back, { label: `Cleared RDP settings from ${counted(chosen.length, 'link')} in ${planet.name}` });
  }, 'editor-danger'));
  update();
}
