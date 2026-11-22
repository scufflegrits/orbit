// Link variables ({placeholders} in a web address) and Quick add. Loaded as a
// classic script after routines.js. Uses shared state and helpers from the
// other scripts only when called.

let variableDialog = null;

// Saved values moved to src/state/prefs.js in rewrite phase 4.
function loadVariables() { return window.OrbitNext.state.prefs.readVariables(); }
function saveVariables(values) { window.OrbitNext.state.prefs.saveVariables(values); }

// Ask for each placeholder, prefilled with the value used last, then open the
// link. The Open click is the user action that lets the browser open a tab.
function askForVariables(item) {
  if (variableDialog) closeVariableDialog();
  const names = templateNames(item.url);
  const remembered = loadVariables();
  const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const overlay = element('div', 'palette-overlay variable-overlay');
  const scrim = element('div', 'palette-scrim');
  const form = element('form', 'palette variable-form');
  form.setAttribute('role', 'dialog');
  form.setAttribute('aria-modal', 'true');
  form.setAttribute('aria-label', `Open ${item.name}`);
  form.append(element('h2', 'variable-title', `Open ${item.name}`));
  form.append(element('p', 'variable-address', item.url));
  const inputs = names.map(name => {
    const field = editorField(name, remembered[name] || '');
    field.input.setAttribute('aria-label', name);
    field.input.required = true;
    field.input.autocomplete = 'off';
    form.append(field.wrapper);
    return [name, field.input];
  });
  const preview = element('p', 'variable-preview');
  const update = () => {
    preview.textContent = fillTemplate(item.url, Object.fromEntries(inputs.map(([name, input]) => [name, input.value.trim()])));
  };
  inputs.forEach(([, input]) => input.addEventListener('input', update));
  update();
  const actions = element('div', 'editor-actions');
  const open = element('button', 'editor-primary', 'Open');
  open.type = 'submit';
  const cancel = editorButton('Cancel', closeVariableDialog);
  actions.append(open, cancel);
  form.append(preview, actions);
  form.addEventListener('submit', event => {
    event.preventDefault();
    const values = Object.fromEntries(inputs.map(([name, input]) => [name, input.value.trim()]));
    if (Object.values(values).some(value => !value)) return;
    saveVariables(values);
    closeVariableDialog();
    window.OrbitNext.services.opener.openTab(fillTemplate(item.url, values));
    noteOpened(item);
  });
  form.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeVariableDialog();
    }
  });
  scrim.addEventListener('click', closeVariableDialog);
  overlay.append(scrim, form);
  document.body.append(overlay);
  variableDialog = { overlay, opener };
  (inputs.find(([, input]) => !input.value)?.[1] || inputs[0]?.[1])?.focus();
}

function closeVariableDialog() {
  if (!variableDialog) return;
  const { overlay, opener } = variableDialog;
  variableDialog = null;
  overlay.remove();
  if (opener && document.contains(opener)) opener.focus();
}

// ---- Quick add --------------------------------------------------------------

// A typed web address, or null. "www.example.com" becomes https://.
function typedAddress(text) {
  const value = String(text || '').trim();
  if (/\s/.test(value) || !value) return null;
  const candidate = /^https?:\/\//i.test(value) ? value : /^www\.[^.\s]+\.[^\s]+$/i.test(value) ? `https://${value}` : null;
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return url.hostname.includes('.') || url.hostname === 'localhost' ? candidate : null;
  } catch {
    return null;
  }
}

function suggestedName(address) {
  try {
    const host = new URL(address.replace(PLACEHOLDER, 'x')).hostname.replace(/^www\./, '');
    const word = host.split('.')[0];
    return word ? word[0].toUpperCase() + word.slice(1) : host;
  } catch {
    return '';
  }
}

// The "Add this link" card at the top of Quick find results.
function quickAddResult(address) {
  const node = element('button', 'find-item find-add');
  node.type = 'button';
  node.append(element('span', 'find-kind', 'Add'));
  const copy = element('span', 'find-copy');
  copy.append(element('strong', '', 'Add this link to your map'), element('small', '', address));
  node.append(copy, element('span', 'find-arrow', '+'));
  node.addEventListener('click', () => showQuickAdd(address));
  return node;
}

function showQuickAdd(address = '') {
  if (menuOverlay.hidden) openMenu();
  if (!editorTree) openEditorPage();
  editorHeader('Add a link', showSunList);
  const targets = [];
  groups.forEach((sun, sunIndex) => {
    if (sun.team) return;
    targets.push([`sun:${sunIndex}`, `${sun.name} (as a planet)`]);
    sun.links.forEach((planet, planetIndex) => targets.push([`planet:${sunIndex}:${planetIndex}`, `${sun.name} → ${planet.name} (as a moon)`]));
  });
  if (!targets.length) {
    menuContent.append(element('p', 'editor-note', 'Add a sun to your map first; links are added to a sun as planets or to a planet as moons.'));
    editorActions().append(editorButton('Add sun', () => showSunEditor(null), 'editor-primary'));
    return;
  }
  menuContent.append(element('p', '', 'Add a website to a sun as a planet, or to a planet as a moon.'));
  const form = element('form', 'editor-form');
  const url = editorField('Address', address, 'url');
  url.input.setAttribute('aria-label', 'Address');
  const name = editorField('Name', address ? suggestedName(address) : '');
  name.input.setAttribute('aria-label', 'Name');
  let nameEdited = false;
  name.input.addEventListener('input', () => { nameEdited = true; });
  url.input.addEventListener('input', () => { if (!nameEdited) name.input.value = suggestedName(url.input.value); });
  const paste = editorButton('Paste from clipboard', async () => {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      url.input.value = typedAddress(text) || text;
      url.input.dispatchEvent(new Event('input'));
    } catch {
      editorError('The browser did not allow Orbit to read the clipboard. Click in Address and press Ctrl+V instead.');
    }
  });
  const target = element('label', 'editor-field');
  target.append(element('span', '', 'Add to'));
  const select = document.createElement('select');
  select.setAttribute('aria-label', 'Add to');
  targets.forEach(([value, label]) => {
    const option = element('option', '', label);
    option.value = value;
    select.append(option);
  });
  target.append(select);
  const actions = element('div', 'editor-actions');
  const save = element('button', 'editor-primary', 'Add link');
  save.type = 'submit';
  actions.append(save);
  form.append(url.wrapper, paste, name.wrapper, target, actions);
  form.addEventListener('submit', event => {
    event.preventDefault();
    const address = typedAddress(url.input.value) || url.input.value.trim();
    const value = { name: name.input.value.trim() || suggestedName(address), url: address };
    const next = copyGroups();
    const [kind, sunIndex, planetIndex] = select.value.split(':');
    if (kind === 'sun') {
      next[Number(sunIndex)].links.push({ ...value, moons: [] });
      applyEditorChange(next, () => showPlanetEditor(Number(sunIndex), next[Number(sunIndex)].links.length - 1),
        { label: `Added planet ${value.name}` });
    } else {
      const moons = next[Number(sunIndex)].links[Number(planetIndex)].moons;
      moons.push(value);
      applyEditorChange(next, () => showMoonEditor(Number(sunIndex), Number(planetIndex), moons.length - 1),
        { label: `Added moon ${value.name}` });
    }
  });
  menuContent.append(form);
  (address ? name.input : url.input).focus();
}
