/**
 * Focus containment for body-portalled Rescue Hub dialogs.
 * Works with nested feedback dialogs without invoking the browser's <dialog>
 * top-layer behaviour (which previously blocked closing admin overlays).
 */
type ModalOptions = { onEscape: () => void };
type ActiveModal = { node: HTMLElement; onEscape: () => void; previous: HTMLElement | null };

const active: ActiveModal[] = [];
const originalInert = new Map<HTMLElement, boolean>();
const focusables = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])', 'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

function insideDialog(node: HTMLElement): HTMLElement {
  return node.querySelector<HTMLElement>('[role="dialog"]') ?? node;
}
function focusTargets(node: HTMLElement): HTMLElement[] {
  return [...insideDialog(node).querySelectorAll<HTMLElement>(focusables)]
    .filter(target => target.getClientRects().length > 0 && !target.closest('[inert]') &&
      target.tabIndex >= 0 && target.getAttribute('aria-hidden') !== 'true');
}
function focusStart(node: HTMLElement) {
  const dialog = insideDialog(node);
  const preferred = dialog.querySelector<HTMLElement>('[data-modal-initial-focus]');
  const target = preferred && !preferred.closest('[inert]') ? preferred :
    focusTargets(node)[0] ?? dialog;
  target.focus({ preventScroll: true });
}
function applyInert() {
  const top = active.at(-1)?.node;
  if (!top) {
    for (const [element, original] of originalInert) {
      if (element.isConnected) element.inert = original;
    }
    originalInert.clear();
    return;
  }
  for (const child of document.body.children) {
    if (!(child instanceof HTMLElement)) continue;
    if (!originalInert.has(child)) originalInert.set(child, child.inert);
    child.inert = child !== top;
  }
}

export function modalFocus(node: HTMLElement, options: ModalOptions) {
  const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const entry: ActiveModal = { node, onEscape: options.onEscape, previous };
  active.push(entry);
  // The companion portal action runs first and places this node under <body>.
  applyInert();
  queueMicrotask(() => {
    if (active.at(-1) === entry && node.isConnected) focusStart(node);
  });

  function onKeydown(event: KeyboardEvent) {
    if (active.at(-1) !== entry) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      entry.onEscape();
      return;
    }
    if (event.key !== 'Tab') return;
    const targets = focusTargets(node);
    if (!targets.length) {
      event.preventDefault();
      insideDialog(node).focus({ preventScroll: true });
      return;
    }
    const first = targets[0], last = targets[targets.length - 1];
    const current = document.activeElement;
    if (!insideDialog(node).contains(current) ||
        (event.shiftKey && current === first) ||
        (!event.shiftKey && current === last)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus({ preventScroll: true });
    }
  }
  function onFocusin(event: FocusEvent) {
    if (active.at(-1) !== entry) return;
    if (!(event.target instanceof Node) || insideDialog(node).contains(event.target)) return;
    focusStart(node);
  }
  document.addEventListener('keydown', onKeydown, true);
  document.addEventListener('focusin', onFocusin, true);

  return {
    update(next: ModalOptions) { entry.onEscape = next.onEscape; },
    destroy() {
      document.removeEventListener('keydown', onKeydown, true);
      document.removeEventListener('focusin', onFocusin, true);
      const index = active.indexOf(entry);
      if (index >= 0) active.splice(index, 1);
      applyInert();
      // The old launcher might have been removed by a successful save.
      // For stacked dialogs, restore within the surviving parent dialog.
      queueMicrotask(() => {
        const top = active.at(-1);
        if (top) {
          if (previous?.isConnected && insideDialog(top.node).contains(previous))
            previous.focus({ preventScroll: true });
          else focusStart(top.node);
        } else if (previous?.isConnected && !previous.closest('[inert]')) {
          previous.focus({ preventScroll: true });
        }
      });
    }
  };
}
