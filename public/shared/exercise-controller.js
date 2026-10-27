// Owns the draft and focus of richer exercises. Polling must not replace a live
// text input or reset a pair / sentence the student is composing.
export function createExerciseController({ host, changed, play, submit, save }) {
  let task,
    draft = {},
    locked = false,
    signature = '',
    activeLeft = null;
  const node = (tag, text, className) => {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (className) el.className = className;
    return el;
  };
  const key = () => 'aomi.race.draft.' + task.id;
  function hintedText(text) {
    const p = node('p', undefined, 'exercise-hint');
    const split = text.indexOf('：');
    if (split < 0) {
      p.textContent = text;
      p.translate = false;
    } else {
      const value = node('span', text.slice(split + 1));
      value.translate = false;
      p.append(node('span', text.slice(0, split + 1)), value);
    }
    return p;
  }
  function persist(cue = 'select') {
    try {
      if (save) save(draft);
      else localStorage.setItem(key(), JSON.stringify({ exercise: draft }));
    } catch {}
    changed(cue);
  }
  function button(text, action, className = '') {
    const b = node('button', text, 'exercise-tile ' + className);
    b.type = 'button';
    b.disabled = locked;
    b.onclick = () => {
      if (!locked) action();
    };
    return b;
  }
  function set(t, saved) {
    task = t;
    activeLeft = null;
    signature = '';
    const e = t.exercise;
    draft = { text: '', order: [], pairs: [], ...(saved || {}) };
    draft.text = typeof draft.text === 'string' ? draft.text.slice(0, 200) : '';
    draft.order = Array.isArray(draft.order)
      ? [...new Set(draft.order)]
          .filter((id) => e.tokens?.some((v) => v.id === id))
          .slice(0, e.slots)
      : [];
    const left = new Set(),
      right = new Set();
    draft.pairs = Array.isArray(draft.pairs)
      ? draft.pairs.filter((p) => {
          if (
            !Array.isArray(p) ||
            p.length !== 2 ||
            left.has(p[0]) ||
            right.has(p[1]) ||
            !e.left?.some((v) => v.id === p[0]) ||
            !e.right?.some((v) => v.id === p[1])
          )
            return false;
          left.add(p[0]);
          right.add(p[1]);
          return true;
        })
      : [];
  }
  function render(t, disabled) {
    task = t;
    locked = disabled;
    const e = t.exercise;
    // A hint may change while the same draft remains in place.
    const nextSignature = JSON.stringify([
      t.id,
      e,
      draft.order,
      draft.pairs,
      activeLeft,
      !!e.choices && draft.text,
    ]);
    if (nextSignature === signature) {
      for (const el of host.querySelectorAll('button, input'))
        el.disabled = locked || el.dataset.used === 'true';
      return;
    }
    signature = nextSignature;
    const focusKey = document.activeElement?.dataset.exerciseKey;
    host.replaceChildren();
    host.append(node('p', e.instruction, 'exercise-instruction'));
    if (e.kind === 'picture') {
      const figure = node('figure', undefined, 'exercise-picture-cue');
      const image = node('img');
      image.src = e.image;
      image.alt = '問題のイラスト';
      image.width = 232;
      image.height = 200;
      figure.append(image);
      host.append(figure);
    }
    if (e.hint) host.append(hintedText(e.hint));
    if (e.kind === 'match') {
      const board = node('div', undefined, 'exercise-pairs');
      for (const [side, values] of [
        ['left', e.left],
        ['right', e.right],
      ]) {
        const column = node('div', undefined, 'exercise-pair-column');
        for (const v of values) {
          const paired = draft.pairs.findIndex((p) => p[side === 'left' ? 0 : 1] === v.id);
          const b = button(
            '',
            () => {
              if (paired >= 0) {
                draft.pairs.splice(paired, 1);
                activeLeft = null;
                persist('remove');
              } else if (side === 'left') {
                activeLeft = v.id;
                if (v.spoken) play(v);
                persist();
              } else if (activeLeft) {
                draft.pairs.push([activeLeft, v.id]);
                activeLeft = null;
                persist('letter');
              } else {
                host.querySelector('[data-side="left"]:not([data-paired="true"])')?.focus();
                return;
              }
              signature = '';
              render(task, locked);
            },
            'pair-tile' + (activeLeft === v.id ? ' chosen' : '') + (paired >= 0 ? ' paired' : ''),
          );
          b.dataset.side = side;
          b.dataset.paired = String(paired >= 0);
          b.dataset.exerciseKey = v.id;
          b.setAttribute('aria-pressed', String(paired >= 0 || activeLeft === v.id));
          if (v.spoken) {
            b.dataset.uiLabel = 'true';
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
            use.setAttribute('href', '#i-speaker');
            svg.setAttribute('aria-hidden', 'true');
            svg.classList.add('pair-audio-icon');
            svg.append(use);
            b.append(svg);
          }
          b.append(node('span', v.value));
          if (paired >= 0) b.append(node('span', String(paired + 1), 'pair-number'));
          b.setAttribute(
            'aria-label',
            v.value +
              (paired >= 0
                ? '・ペア ' + (paired + 1) + ' を戻す'
                : side === 'left'
                  ? ' を選ぶ'
                  : ' と組み合わせる'),
          );
          column.append(b);
        }
        board.append(column);
      }
      host.append(
        board,
        node(
          'p',
          draft.pairs.length + ' / ' + e.left.length + ' ペア・押すと組み直せます',
          'exercise-count',
        ),
      );
    } else if (e.kind === 'order') {
      const answer = node('div', undefined, 'exercise-sentence-answer');
      answer.setAttribute('aria-label', '作っている文');
      for (const id of draft.order) {
        const token = e.tokens.find((v) => v.id === id);
        const b = button(token.value === ' ' ? '␣' : token.value, () => {
          draft.order = draft.order.filter((v) => v !== id);
          persist('remove');
          render(task, locked);
        });
        b.setAttribute('aria-label', token.value + ' を戻す');
        b.dataset.exerciseKey = 'answer-' + id;
        answer.append(b);
      }
      if (!draft.order.length)
        answer.append(node('span', 'ことばを選んで、ここに並べよう', 'exercise-placeholder'));
      const bank = node('div', undefined, 'exercise-token-bank');
      for (const v of e.tokens) {
        const b = button(v.value === ' ' ? '␣' : v.value, () => {
          draft.order.push(v.id);
          persist('letter');
          render(task, locked);
        });
        b.dataset.used = String(draft.order.includes(v.id));
        b.disabled ||= draft.order.includes(v.id);
        b.dataset.exerciseKey = 'token-' + v.id;
        bank.append(b);
      }
      host.append(
        answer,
        bank,
        node(
          'p',
          draft.order.length + ' / ' + e.slots + (e.separator === '' ? ' 文字' : ' ことば'),
          'exercise-count',
        ),
      );
    } else {
      if (e.kind === 'cloze') {
        const sentence = node('p', undefined, 'exercise-gap-sentence');
        sentence.append(
          document.createTextNode(e.before),
          node('span', draft.text || '____', 'exercise-gap'),
          document.createTextNode(e.after),
        );
        host.append(sentence);
        if (e.cue) {
          const cue = node('p', undefined, 'exercise-cue');
          const value = node('span', e.cue);
          value.translate = false;
          cue.append(node('span', '意味：'), value);
          host.append(cue);
        }
      }
      if (e.choices) {
        const bank = node('div', undefined, 'exercise-choice-bank');
        for (const choice of e.choices) {
          const b = button(
            choice,
            () => {
              draft.text = choice;
              persist();
              render(task, locked);
            },
            draft.text === choice ? 'chosen' : '',
          );
          b.setAttribute('aria-pressed', String(draft.text === choice));
          b.dataset.exerciseKey = choice;
          bank.append(b);
        }
        host.append(bank);
      } else {
        const label = node('label', '英語の答え', 'exercise-input-label');
        const input = node('input');
        input.type = 'text';
        input.maxLength = 200;
        input.lang = 'en';
        input.autocomplete = 'off';
        input.setAttribute('autocorrect', 'off');
        input.setAttribute('autocapitalize', 'none');
        input.spellcheck = false;
        input.value = draft.text;
        input.placeholder = e.placeholder;
        input.disabled = locked;
        input.dataset.exerciseKey = 'typing';
        input.oninput = () => {
          draft.text = input.value;
          const gap = host.querySelector('.exercise-gap');
          if (gap) gap.textContent = draft.text || '____';
          persist(null);
        };
        input.onkeydown = (event) => {
          if (event.key === 'Enter' && !event.isComposing && !locked && ready()) {
            event.preventDefault();
            submit();
          }
        };
        label.append(input);
        host.append(label);
      }
    }
    if (focusKey)
      [...host.querySelectorAll('[data-exercise-key]')]
        .find((el) => el.dataset.exerciseKey === focusKey && !el.disabled)
        ?.focus({ preventScroll: true });
  }
  function ready() {
    const e = task?.exercise;
    return e?.kind === 'match'
      ? draft.pairs.length === e.left.length
      : e?.kind === 'order'
        ? draft.order.length === e.slots
        : !!draft.text?.trim();
  }
  function answer() {
    const e = task.exercise;
    return e.kind === 'match'
      ? JSON.stringify(draft.pairs)
      : e.kind === 'order'
        ? JSON.stringify(draft.order)
        : draft.text;
  }
  return { set, render, ready, answer, draft: () => structuredClone(draft) };
}
