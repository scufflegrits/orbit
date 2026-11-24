import { element } from './dom.js';
import { buttonTips, menuOverlay } from './page.js';
import { modes } from './page-modes.js';

let nextDescription = 0;
/** @type {HTMLElement} */
let tooltip;
/** @type {HTMLElement | null} */
let anchor = null;
let timer = 0;

/** @template {HTMLElement} T @param {T} node @param {string} text */
export function tip(node, text) {
  const description = element('span', '', text);
  description.id = `orbit-tip-description-${++nextDescription}`;
  description.hidden = true;
  node.append(description);
  node.dataset.tip = description.id;
  node.setAttribute('aria-describedby', description.id);
  return node;
}

export function buttonTipsDelay() {
  return buttonTips === 'off' ? null : buttonTips === 'slow' ? 1500 : 800;
}

/** Whether Escape should stop after dismissing a visible tip. */
export function hideTooltip() {
  window.clearTimeout(timer);
  const wasVisible = Boolean(tooltip && !tooltip.hidden);
  if (anchor && wasVisible) {
    anchor.setAttribute('aria-describedby', /** @type {string} */ (anchor.dataset.tip));
    tooltip.hidden = true;
  }
  anchor = null;
  return wasVisible;
}

/** @param {HTMLElement} node */
function canShow(node) {
  return node.isConnected && !modes.holding() && !modes.overlayIs('placeholder') &&
    !modes.overlayIs('palette') && (!modes.menuOpen() || menuOverlay.contains(node));
}

/** @param {HTMLElement} node */
function scheduleTip(node) {
  if (anchor === node) return;
  hideTooltip();
  const delay = buttonTipsDelay();
  if (delay === null || !canShow(node)) return;
  anchor = node;
  timer = window.setTimeout(() => {
    if (!canShow(node) || !node.getClientRects().length) return void hideTooltip();
    tooltip.textContent = document.getElementById(node.dataset.tip || '')?.textContent || '';
    tooltip.hidden = false;
    const box = node.getBoundingClientRect();
    const { offsetWidth: width, offsetHeight: height } = tooltip;
    const { clientWidth, clientHeight } = document.documentElement;
    const left = box.left + (box.width - width) / 2;
    const above = box.top - height - 8;
    tooltip.style.left = `${Math.max(8, Math.min(left, clientWidth - width - 8))}px`;
    tooltip.style.top = `${Math.max(8, Math.min(above >= 8 ? above : box.bottom + 8, clientHeight - height - 8))}px`;
    node.setAttribute('aria-describedby', tooltip.id);
  }, delay);
}

/** @param {EventTarget | null} target */
function tippedElement(target) {
  return target instanceof Element ? /** @type {HTMLElement | null} */ (target.closest('[data-tip]')) : null;
}

export function installTooltip() {
  tooltip = element('div', 'tooltip');
  tooltip.id = 'orbit-tooltip';
  tooltip.setAttribute('role', 'tooltip');
  tooltip.hidden = true;
  document.body.append(tooltip);

  document.addEventListener('pointerover', event => {
    const node = tippedElement(event.target);
    if (event.pointerType !== 'touch' && node && node !== tippedElement(event.relatedTarget)) scheduleTip(node);
  });
  document.addEventListener('pointerout', event => {
    if (anchor && anchor === tippedElement(event.target) && anchor !== tippedElement(event.relatedTarget)) hideTooltip();
  });
  document.addEventListener('focusin', event => {
    const node = tippedElement(event.target);
    if (node?.matches(':focus-visible')) scheduleTip(node);
  });
  document.addEventListener('focusout', event => {
    if (anchor && anchor === tippedElement(event.target)) hideTooltip();
  });
  document.addEventListener('pointerdown', hideTooltip, true);
  document.addEventListener('click', hideTooltip, true);
  window.addEventListener('scroll', event => {
    if (anchor && (event.target === document || (event.target instanceof Element && event.target.contains(anchor)))) hideTooltip();
  }, true);
  window.addEventListener('resize', hideTooltip);
  modes.subscribe(() => {
    if (anchor && !canShow(anchor)) hideTooltip();
  });
  new MutationObserver(() => {
    if (anchor && !anchor.isConnected) hideTooltip();
  }).observe(document.body, { childList: true, subtree: true });
}
