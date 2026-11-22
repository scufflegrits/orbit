// The placeholder form (2.2.1 variables.js): opening a link with
// {placeholders} asks for each value, prefilled with the one used last. It
// handles its own Escape, and the global key handler leaves every other key
// to it. Whether it is open belongs to the mode store; app.js's mode
// subscriber calls variableFormOpened() and variableFormClosed(). Moved in
// rewrite phase 6a.
import { fillTemplate, templateNames } from '../../core/templates.js';
import { openTab } from '../../services/opener.js';
import { readVariables, saveVariables } from '../../state/prefs.js';
import { element } from '../dom.js';
import { editorButton, editorField } from '../editor/kit.js';
import { modes } from '../page-modes.js';
import { noteOpened } from '../views/favorites.js';

/**
 * The form's controller, set exactly while the form is open; whether it is
 * open is always asked of the mode store, never read from this.
 * @type {{overlay: HTMLElement, opener: HTMLElement | null}}
 */
let variableDialog = /** @type {any} */ (null);
/** The link to ask about, kept from askForVariables() until the form is built. */
let variableItem = /** @type {any} */ (null);

/**
 * Ask for each placeholder, then open the link. The Open click is the user
 * action that lets the browser open a tab.
 * @param {any} item
 */
export function askForVariables(item) {
  if (modes.overlayIs('placeholder')) closeVariableDialog();
  variableItem = item;
  modes.send('openPlaceholder');
}

/** Called only by the mode subscriber, when the placeholder form has opened. */
export function variableFormOpened() {
  const item = variableItem;
  variableItem = null;
  const names = templateNames(item.url);
  const remembered = readVariables();
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
    return /** @type {[string, HTMLInputElement]} */ ([name, field.input]);
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
    openTab(fillTemplate(item.url, values));
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

export function closeVariableDialog() {
  if (!modes.overlayIs('placeholder')) return;
  modes.send('closeOverlay');
}

/** Called only by the mode subscriber, when the placeholder form has closed. */
export function variableFormClosed() {
  const { overlay, opener } = variableDialog;
  variableDialog = /** @type {any} */ (null);
  overlay.remove();
  if (opener && document.contains(opener)) opener.focus();
}
