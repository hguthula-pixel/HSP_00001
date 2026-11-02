// Accessible Help dialog: native <dialog> with an explicit focus loop and
// focus returned to whatever opened it.

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea, [tabindex]:not([tabindex="-1"])';

export function setupHelp({ dialog, openers, closeBtn }) {
  let returnTo = null;

  function open(from) {
    if (dialog.open) return;
    returnTo = from || document.activeElement;
    dialog.showModal();
    closeBtn.focus();
  }

  function close() {
    if (dialog.open) dialog.close();
  }

  dialog.addEventListener('close', () => {
    const target = returnTo && document.contains(returnTo) ? returnTo : null;
    returnTo = null;
    if (target) target.focus();
  });

  // Click on the backdrop closes the dialog.
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) close();
  });

  // Keep Tab inside the dialog.
  dialog.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const items = [...dialog.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  for (const btn of openers) btn.addEventListener('click', () => open(btn));
  closeBtn.addEventListener('click', close);

  return { open, close, get isOpen() { return dialog.open; } };
}
