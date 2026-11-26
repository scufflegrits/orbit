// Shared editor fields and groups used by the editor screens.
import * as rdp from '../../core/rdp.js';
import * as fileIo from '../../services/file-io.js';
import { element } from '../dom.js';
import { editorButton, editorError, editorField } from './kit.js';
import { menuContent, rdpPresets } from '../page.js';

/**
 * @param {any} form
 * @param {any} destination
 * @param {any} onRdpImported
 * @param {boolean} [allowGroup]
 */
export function destinationFields(form, destination, onRdpImported, allowGroup = false) {
  const type = element('label', 'editor-field');
  const fieldName = allowGroup ? 'Kind' : 'Destination type';
  type.append(element('span', '', fieldName));
  const select = document.createElement('select');
  select.setAttribute('aria-label', fieldName);
  const kinds = [['web', 'Website'], ['rdp', 'Windows Remote Desktop']];
  if (allowGroup) kinds.push(['group', 'Group (no link)']);
  for (const [value, label] of kinds) {
    const option = element('option', '', label);
    option.value = value;
    select.append(option);
  }
  select.value = destination.type || 'web';
  type.append(select);
  const url = editorField('Destination URL', destination.url || '', 'url');
  const host = editorField('Computer name or IP address', destination.host || '');
  let rdpProfile = destination.rdpProfile || null;
  const profileNote = element('p', 'data-source', rdpProfile
    ? 'Custom .rdp settings are saved with this link.' : 'No custom .rdp settings are saved.');
  // Connection settings: none, this link's imported settings, or a preset.
  const settingsField = element('label', 'editor-field');
  settingsField.append(element('span', '', 'Connection settings'));
  const settingsSelect = document.createElement('select');
  settingsSelect.setAttribute('aria-label', 'Connection settings');
  settingsField.append(settingsSelect);
  const fillSettings = (/** @type {any} */ selected) => {
    settingsSelect.replaceChildren();
    const add = (/** @type {any} */ value, /** @type {any} */ label) => {
      const option = element('option', '', label);
      option.value = value;
      settingsSelect.append(option);
    };
    add('none', 'None (just the computer)');
    if (rdpProfile) add('own', 'Imported .rdp settings');
    rdpPresets.forEach(preset => add(`preset:${preset.id}`, `Preset: ${preset.name}`));
    settingsSelect.value = [...settingsSelect.options].some(option => option.value === selected) ? selected : 'none';
  };
  fillSettings(destination.rdpPreset ? `preset:${destination.rdpPreset}` : rdpProfile ? 'own' : 'none');
  const importRdp = editorButton('Import .rdp file', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.rdp,application/x-rdp';
    input.addEventListener('change', async () => {
      const files = input.files;
      if (!files?.length) return;
      try {
        const parsed = rdp.parseRdpProfile(await fileIo.readRdpText(files[0]));
        select.value = 'rdp';
        host.input.value = parsed.host;
        rdpProfile = parsed.content;
        fillSettings('own');
        profileNote.textContent = `${parsed.settings} connection settings imported. ${parsed.removed ? `${parsed.removed} password, token, or signature settings excluded. ` : ''}Save this link to keep the profile.`;
        update();
        onRdpImported?.(files[0]);
      } catch (error) {
        editorError(`RDP import failed: ${/** @type {any} */ (error).message}`);
      }
    });
    input.click();
  });
  const update = () => {
    url.wrapper.hidden = select.value !== 'web';
    host.wrapper.hidden = select.value !== 'rdp';
    profileNote.hidden = select.value !== 'rdp';
    importRdp.hidden = select.value !== 'rdp';
    settingsField.hidden = select.value !== 'rdp';
    favorite.hidden = select.value === 'group';
    url.input.disabled = select.value !== 'web';
  };
  select.addEventListener('change', update);
  const note = editorField('Note', destination.note || '', 'textarea');
  note.input.setAttribute('aria-label', 'Note');
  note.input.maxLength = 500;
  note.input.placeholder = 'Optional: what this link is for, or a hint such as which account to use';
  note.wrapper.append(element('small', 'editor-hint', 'Shown on hover and in search. Never put passwords here; notes are plain text in your browser and in exports.'));
  const tags = editorField('Tags', (destination.tags || []).join(', '));
  tags.input.placeholder = 'For example: prod, windows';
  tags.input.setAttribute('aria-label', 'Tags');
  tags.wrapper.append(element('small', 'editor-hint', 'Separate tags with commas. Find tagged links with #tag in Quick find.'));
  const favorite = element('label', 'editor-check');
  const favoriteInput = document.createElement('input');
  favoriteInput.type = 'checkbox';
  favoriteInput.checked = destination.favorite === true;
  favorite.append(favoriteInput, element('span', '', 'Favorite (shown at the top of the Galaxy)'));
  url.wrapper.append(element('small', 'editor-hint', 'Use {name} for a part that changes, such as https://jira.example.com/browse/{ticket}; Orbit asks for it when you open the link.'));
  form.append(type, url.wrapper, host.wrapper, settingsField, profileNote, importRdp, note.wrapper, tags.wrapper, favorite);
  update();
  return () => {
    const extras = {
      ...(tags.input.value.trim() ? { tags: tags.input.value } : {}),
      ...(favoriteInput.checked && select.value !== 'group' ? { favorite: true } : {}),
      ...(note.input.value.trim() ? { note: note.input.value } : {}),
    };
    if (select.value === 'group') return { type: 'group', ...extras };
    const choice = settingsSelect.value;
    // "None" drops imported settings; a preset keeps them for switching back.
    const keepProfile = rdpProfile && choice !== 'none' ? { rdpProfile } : {};
    const preset = choice.startsWith('preset:') ? { rdpPreset: choice.slice(7) } : {};
    return select.value === 'rdp'
      ? { type: 'rdp', host: host.input.value.trim(), ...keepProfile, ...preset, ...extras }
      : { url: url.input.value.trim(), ...extras };
  };
}

/**
 * @param {string} label
 * @param {...HTMLElement} controls
 */
export function editorGroup(label, ...controls) {
  const group = element('section', 'editor-group');
  const heading = element('h4', 'editor-group-label', label);
  heading.id = `editor-group-${label.toLowerCase().replaceAll(' ', '-')}`;
  group.setAttribute('aria-labelledby', heading.id);
  const actions = element('div', 'editor-actions');
  actions.append(...controls);
  group.append(heading, actions);
  menuContent.append(group);
}
