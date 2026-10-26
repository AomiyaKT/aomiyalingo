// Keep content clear of the actual action bar, including accessibility text sizes
// and Safari's visual viewport when the software keyboard is open.
export function installStudentViewport(host = globalThis) {
  const doc = host.document;
  if (!doc?.body || !host.requestAnimationFrame || !host.addEventListener) return () => {};
  const bars = [...doc.querySelectorAll('.bottom-bar, .feedback, .race-submit-row')];
  const viewport = host.visualViewport;
  let frame = null,
    disposed = false,
    barsDirty = true,
    action = 96,
    revealInput = false;
  const set = (key, value) => {
    if (doc.body.style.getPropertyValue(key) !== value) doc.body.style.setProperty(key, value);
  };
  function measure() {
    frame = null;
    if (disposed) return;
    const height = Math.round(viewport?.height || host.innerHeight);
    const inset = Math.max(0, Math.round(host.innerHeight - height - (viewport?.offsetTop || 0)));
    if (barsDirty || !observer) {
      action = Math.ceil(Math.max(0, ...bars.map((bar) => bar.getBoundingClientRect().height)));
      barsDirty = false;
    }
    set('--action-height', (action || 96) + 'px');
    set('--student-visible-height', height + 'px');
    set('--student-viewport-top', Math.round(viewport?.offsetTop || 0) + 'px');
    set('--student-keyboard-inset', inset + 'px');
    if (revealInput) {
      const input = doc.activeElement;
      if (input?.matches('input:not([type=range]):not([type=checkbox]), textarea')) {
        const rect = input.getBoundingClientRect();
        const inDialog = !!input.closest?.('dialog[open]');
        const reserved = inDialog ? 0 : action;
        if (
          rect.bottom > height + (viewport?.offsetTop || 0) - reserved - 12 ||
          rect.top < (viewport?.offsetTop || 0)
        )
          input.scrollIntoView({ block: 'center', behavior: 'instant' });
      }
    }
    revealInput = false;
  }
  function schedule(event) {
    if (disposed) return;
    revealInput ||= event?.type === 'focusin' || event?.target === viewport;
    if (frame === null) frame = host.requestAnimationFrame(measure);
  }
  function invalidateBars() {
    barsDirty = true;
    schedule();
  }
  const observer = host.ResizeObserver ? new host.ResizeObserver(invalidateBars) : null;
  bars.forEach((bar) => observer?.observe(bar));
  host.addEventListener('resize', invalidateBars);
  doc.addEventListener('focusin', schedule);
  viewport?.addEventListener('resize', schedule);
  viewport?.addEventListener('scroll', schedule);
  schedule();
  return () => {
    disposed = true;
    if (frame !== null) host.cancelAnimationFrame(frame);
    observer?.disconnect();
    host.removeEventListener('resize', invalidateBars);
    doc.removeEventListener('focusin', schedule);
    viewport?.removeEventListener('resize', schedule);
    viewport?.removeEventListener('scroll', schedule);
  };
}
