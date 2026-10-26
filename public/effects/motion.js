export const curves = {
  settle: 'cubic-bezier(.16,1,.3,1)',
  pop: 'cubic-bezier(.34,1.56,.64,1)',
  press: 'cubic-bezier(.2,.8,.2,1)',
};

export function createMotion({ reduced, host = globalThis }) {
  const running = new Set(),
    byElement = new WeakMap(),
    entered = new WeakMap();
  function animate(element, frames, options = {}) {
    if (!element || !element.animate || reduced() || host.document.hidden) return;
    byElement.get(element)?.cancel();
    const animation = element.animate(frames, { duration: 260, easing: curves.settle, ...options });
    byElement.set(element, animation);
    running.add(animation);
    const done = () => {
      running.delete(animation);
      if (byElement.get(element) === animation) byElement.delete(element);
    };
    animation.onfinish = done;
    animation.oncancel = done;
    return animation;
  }
  function pulse(element, type = 'press') {
    if (type === 'wrong')
      return animate(
        element,
        [
          { translate: '0 0' },
          { translate: '-5px 0' },
          { translate: '4px 0' },
          { translate: '-2px 0' },
          { translate: '0 0' },
        ],
        { duration: 280, easing: 'ease-out' },
      );
    if (type === 'success')
      return animate(
        element,
        [
          { scale: '.88', offset: 0 },
          { scale: '1.1', offset: 0.5 },
          { scale: '.98', offset: 0.8 },
          { scale: '1', offset: 1 },
        ],
        { duration: 380 },
      );
    if (type === 'character')
      return animate(
        element,
        [
          { scale: '1.06 .92', translate: '0 0', offset: 0 },
          { scale: '.94 1.05', translate: '0 -16px', rotate: '-4deg', offset: 0.36 },
          { scale: '1.05 .95', translate: '0 1px', rotate: '2deg', offset: 0.75 },
          { scale: '1', translate: '0 0', rotate: '0deg', offset: 1 },
        ],
        { duration: 540 },
      );
    if (type === 'letter')
      return animate(
        element,
        [
          { scale: '.72', translate: '0 8px' },
          { scale: '1.08', translate: '0 -2px', offset: 0.65 },
          { scale: '1', translate: '0 0' },
        ],
        { duration: 240 },
      );
    return animate(
      element,
      [
        { translate: '0 2px', scale: '.985' },
        { translate: '0 0', scale: '1' },
      ],
      { duration: 170 },
    );
  }
  function enter(element, type = 'screen', direction = 1) {
    if (!element || element.hidden) return;
    const time = host.performance.now();
    if (time - (entered.get(element) ?? -Infinity) < 100) return;
    entered.set(element, time);
    if (type === 'progress') return pulse(element, 'success');
    const frames =
      type === 'flip'
        ? [
            { opacity: 0.2, translate: `${direction * 18}px 0`, scale: '.99' },
            { opacity: 1, translate: '0 0', scale: '1' },
          ]
        : type === 'toast' || element.matches?.('.feedback, #race-feedback')
          ? [
              { opacity: 0, translate: '0 20px' },
              { opacity: 1, translate: '0 0' },
            ]
          : [
              { opacity: 0, translate: '0 12px', scale: '.985' },
              { opacity: 1, translate: '0 0', scale: '1' },
            ];
    return animate(element, frames, { duration: type === 'flip' ? 250 : 280 });
  }
  function stop() {
    for (const animation of running) animation.cancel();
    running.clear();
  }
  return { animate, pulse, enter, stop };
}
