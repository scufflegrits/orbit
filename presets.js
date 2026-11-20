// Remote Desktop presets: named connection settings shared by many links.
// Loaded as a classic script after sharing.js. Presets are saved with the map
// (`rdpPresets`); a link chooses one in its Connection settings.

const PRESET_CHOICES = {
  display: [
    ['', 'Leave as is', []],
    ['full', 'Full screen', ['screen mode id:i:2']],
    ['1280', 'Window, 1280 × 720', ['screen mode id:i:1', 'desktopwidth:i:1280', 'desktopheight:i:720']],
    ['1600', 'Window, 1600 × 900', ['screen mode id:i:1', 'desktopwidth:i:1600', 'desktopheight:i:900']],
    ['1920', 'Window, 1920 × 1080', ['screen mode id:i:1', 'desktopwidth:i:1920', 'desktopheight:i:1080']],
  ],
  toggles: [
    ['use multimon', 'Use all monitors', 'use multimon:i:1'],
    ['redirectclipboard', 'Share the clipboard', 'redirectclipboard:i:1'],
    ['drivestoredirect', 'Share local drives', 'drivestoredirect:s:*'],
  ],
};
const DISPLAY_KEYS = ['screen mode id', 'desktopwidth', 'desktopheight'];

function settingKey(row) {
  return row.split(':')[0].trim().toLowerCase();
}

function presetUsage(id) {
  return groups.reduce((sum, sun) => sum + sun.links.reduce((total, planet) =>
    total + [planet, ...planet.moons].filter(item => item.rdpPreset === id).length, 0), 0);
}

function showPresets() {
  editorHeader('Remote Desktop presets', showSunList);
  menuContent.append(element('p', '', 'A preset is a named set of connection settings, such as full screen with all monitors. Choose it for any Remote Desktop planet or moon in Connection settings; each link keeps its own computer. Presets never hold passwords.'));
  if (!rdpPresets.length) menuContent.append(element('p', 'editor-note', 'No presets yet.'));
  const list = element('div', 'editor-list');
  rdpPresets.forEach((preset, index) => {
    const row = element('div', 'editor-list-row');
    const copy = element('span', 'history-copy');
    copy.append(element('strong', '', preset.name));
    copy.append(element('small', '', `${counted(preset.settings ? preset.settings.split(/\r\n/).length : 0, 'setting')} · used by ${counted(presetUsage(preset.id), 'link')}`));
    row.append(copy, editorButton('Edit', () => showPresetEditor(index)));
    list.append(row);
  });
  menuContent.append(list);
  editorActions().append(editorButton('New preset', () => showPresetEditor(null), 'editor-primary'));
}

function showPresetEditor(index) {
  const isNew = index === null;
  const preset = isNew ? { name: '', settings: '' } : rdpPresets[index];
  editorHeader(isNew ? 'New preset' : `Edit ${preset.name}`, showPresets);
  const form = element('form', 'editor-form');
  const name = editorField('Preset name', preset.name);
  name.input.setAttribute('aria-label', 'Preset name');
  name.input.placeholder = 'For example: Full screen';
  const settings = editorField('Settings', preset.settings.replace(/\r\n/g, '\n'), 'textarea');
  settings.input.setAttribute('aria-label', 'Settings');
  settings.input.classList.add('preset-settings');
  const rows = () => settings.input.value.split(/\n/).map(line => line.trim()).filter(Boolean);
  const setRows = list => { settings.input.value = list.join('\n'); };
  // Common choices write their lines into the settings text.
  const displayField = element('label', 'editor-field');
  displayField.append(element('span', '', 'Display'));
  const display = document.createElement('select');
  display.setAttribute('aria-label', 'Display');
  PRESET_CHOICES.display.forEach(([value, label]) => {
    const option = element('option', '', label);
    option.value = value;
    display.append(option);
  });
  displayField.append(display);
  const current = rows();
  const matching = PRESET_CHOICES.display.find(([value, , lines]) => value && lines.every(line => current.includes(line)));
  display.value = matching ? matching[0] : '';
  display.addEventListener('change', () => {
    const lines = PRESET_CHOICES.display.find(([value]) => value === display.value)[2];
    setRows([...rows().filter(row => !DISPLAY_KEYS.includes(settingKey(row))), ...lines]);
  });
  const toggles = PRESET_CHOICES.toggles.map(([key, label, line]) => {
    const row = element('label', 'editor-check');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = current.includes(line);
    box.setAttribute('aria-label', label);
    box.addEventListener('change', () => {
      const others = rows().filter(item => settingKey(item) !== key);
      setRows(box.checked ? [...others, line] : others);
    });
    row.append(box, element('span', '', label));
    return row;
  });
  const fromFile = editorButton('Start from an .rdp file', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.rdp,application/x-rdp';
    input.addEventListener('change', async () => {
      if (!input.files.length) return;
      try {
        const parsed = parseRdpProfile(await readRdpText(input.files[0]));
        setRows(parsed.content.split(/\r\n/).filter(row => row && settingKey(row) !== 'full address'));
        if (!name.input.value.trim()) name.input.value = input.files[0].name.replace(/\.rdp$/i, '');
      } catch (error) {
        editorError(`RDP import failed: ${error.message}`);
      }
    });
    input.click();
  });
  settings.wrapper.append(element('small', 'editor-hint', 'One setting per line, as in an .rdp file (for example session bpp:i:32). The computer address comes from each link.'));
  const actions = element('div', 'editor-actions');
  const save = element('button', 'editor-primary', isNew ? 'Add preset' : 'Save preset');
  save.type = 'submit';
  actions.append(save);
  if (!isNew) {
    actions.append(editorButton('Remove preset', () => {
      const used = presetUsage(preset.id);
      if (!window.confirm(`Remove the ${preset.name} preset?${used ? ` ${counted(used, 'link')} using it will open without it.` : ''}`)) return;
      applyEditorChange(copyGroups(), showPresets, { rdpPresets: rdpPresets.filter((_, i) => i !== index),
        label: `Removed preset ${preset.name}` });
    }, 'editor-danger'));
  }
  form.append(name.wrapper, displayField, ...toggles, fromFile, settings.wrapper, actions);
  form.addEventListener('submit', event => {
    event.preventDefault();
    const value = { name: name.input.value.trim(), settings: rows().join('\r\n') };
    if (!isNew) value.id = preset.id;
    const next = [...rdpPresets];
    if (isNew) next.push(value);
    else next[index] = value;
    applyEditorChange(copyGroups(), showPresets, { rdpPresets: next, label: `${isNew ? 'Added' : 'Saved'} preset ${value.name}` });
  });
  menuContent.append(form);
}
