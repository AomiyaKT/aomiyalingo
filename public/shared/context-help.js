// One delegated tooltip for the page. Touch users can tap explicit help buttons.
export function installContextHelp(host = globalThis) {
  const doc = host.document;
  const tip = doc.createElement('div');
  tip.id = 'aomi-context-help';
  tip.className = 'context-help';
  tip.setAttribute('role', 'tooltip');
  tip.hidden = true;
  doc.body.append(tip);
  let source = null,
    timer = null,
    pinned = false;
  const target = (node) => node?.closest?.('[data-help]');
  function hide() {
    host.clearTimeout(timer);
    timer = null;
    tip.hidden = true;
    if (source) {
      const ids = (source.getAttribute('aria-describedby') || '')
        .split(/\s+/)
        .filter((id) => id && id !== tip.id);
      if (ids.length) source.setAttribute('aria-describedby', ids.join(' '));
      else source.removeAttribute('aria-describedby');
    }
    source = null;
    pinned = false;
  }
  function show(node) {
    if (!node?.dataset.help || node.isConnected === false) return hide();
    if (source !== node) {
      hide();
      source = node;
    }
    host.clearTimeout(timer);
    timer = null;
    tip.textContent = node.dataset.help;
    tip.hidden = false;
    const ids = new Set((node.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
    ids.add(tip.id);
    node.setAttribute('aria-describedby', [...ids].join(' '));
    const anchor = node.getBoundingClientRect(),
      box = tip.getBoundingClientRect();
    const width = host.innerWidth || doc.documentElement.clientWidth;
    const height = host.innerHeight || doc.documentElement.clientHeight;
    tip.style.left =
      Math.max(
        12,
        Math.min(width - box.width - 12, anchor.left + anchor.width / 2 - box.width / 2),
      ) + 'px';
    tip.style.top =
      Math.max(
        12,
        anchor.bottom + box.height + 20 <= height ? anchor.bottom + 8 : anchor.top - box.height - 8,
      ) + 'px';
  }
  function over(event) {
    const next = target(event.target);
    if (pinned || event.pointerType === 'touch' || !next || next === source) return;
    hide();
    source = next;
    timer = host.setTimeout(() => show(next), 350);
  }
  function out(event) {
    if (
      !source ||
      pinned ||
      source.contains(event.relatedTarget) ||
      tip.contains(event.relatedTarget)
    )
      return;
    if (doc.activeElement !== source) hide();
  }
  function focus(event) {
    const next = target(event.target);
    if (next) {
      pinned = false;
      show(next);
    }
  }
  function blur(event) {
    if (source && !source.contains(event.relatedTarget)) hide();
  }
  function click(event) {
    const next = target(event.target);
    if (next?.classList.contains('help-trigger')) {
      event.preventDefault();
      if (source === next && pinned) hide();
      else {
        show(next);
        pinned = true;
      }
    } else if (!tip.contains(event.target)) hide();
  }
  function key(event) {
    if (event.key === 'Escape' && source) {
      hide();
      event.preventDefault();
    }
  }
  const listeners = {
    pointerover: over,
    pointerout: out,
    focusin: focus,
    focusout: blur,
    click,
    keydown: key,
    scroll: hide,
  };
  for (const [name, fn] of Object.entries(listeners))
    doc.addEventListener(name, fn, name === 'scroll');
  host.addEventListener('resize', hide);
  return () => {
    hide();
    for (const [name, fn] of Object.entries(listeners))
      doc.removeEventListener(name, fn, name === 'scroll');
    host.removeEventListener('resize', hide);
    tip.remove();
  };
}
