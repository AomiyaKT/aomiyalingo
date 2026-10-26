import { raceItemCatalog as itemArt } from '../shared/race-items.js';
export function createItemRoulette({
  q,
  read,
  store,
  getData,
  appSettings,
  interactionEffects,
  syncAnswer,
}) {
  let rolling = false,
    spinTimer = null,
    spinKey = null;
  function spinItem(s, key) {
    const data = getData();
    const cache = 'aomi.race.item.' + data.race.id + '.' + s.id,
      seen = read(cache);
    if (seen === key) return;
    clearTimeout(spinTimer);
    spinKey = key;
    store(cache, key);
    rolling = true;
    const panel = q('#item-roulette'),
      symbol = q('#roulette-symbol'),
      name = q('#roulette-name');
    panel.hidden = false;
    panel.classList.remove('is-revealed');
    panel.classList.add('is-spinning');
    q('#use-race-item').textContent = '道具を抽選中…';
    q('#item-description').textContent = '何が出るかな？';
    name.textContent = '何が出るかな？';
    const reduced =
        appSettings.values.reduceMotion || matchMedia('(prefers-reduced-motion: reduce)').matches,
      choices = data.race.settings.items.filter((i) => itemArt[i]);
    let step = 0;
    function reveal() {
      if (spinKey !== key) return;
      rolling = false;
      panel.classList.remove('is-spinning');
      panel.classList.add('is-revealed');
      symbol.textContent = itemArt[s.item].icon;
      name.textContent = itemArt[s.item].name + '！';
      store(cache, key);
      if (getData()?.self?.itemBox === s.itemBox && getData()?.self?.item === s.item) {
        q('#use-race-item').textContent = itemArt[s.item].icon + ' ' + s.itemName + 'を使う';
        q('#item-description').textContent = itemArt[s.item].description;
      }
      if (!document.hidden) interactionEffects.sound('itemReveal');
      interactionEffects.pulse(panel, 'success');
      syncAnswer();
      spinTimer = setTimeout(() => {
        if (spinKey === key) panel.hidden = true;
      }, 2200);
    }
    function tick() {
      if (spinKey !== key) return;
      const current = getData();
      if (
        document.hidden ||
        current?.race?.status !== 'running' ||
        current?.self?.done ||
        current?.self?.ready === false
      ) {
        reveal();
        return;
      }
      const delay = step < 11 ? 55 : 75 + (step - 10) * 25;
      symbol.style.animationDuration = delay + 'ms';
      symbol.textContent = itemArt[choices[step % choices.length] || s.item].icon;
      interactionEffects.sound('roulette');
      step++;
      if (step >= 19) reveal();
      else spinTimer = setTimeout(tick, delay);
    }
    if (reduced) reveal();
    else tick();
  }

  function cancel() {
    clearTimeout(spinTimer);
    spinKey = null;
    rolling = false;
    const panel = q('#item-roulette');
    if (panel) {
      panel.hidden = true;
      panel.classList.remove('is-spinning');
      panel.classList.remove('is-revealed');
    }
  }
  return {
    itemArt,
    spinItem,
    cancel,
    get rolling() {
      return rolling;
    },
  };
}
