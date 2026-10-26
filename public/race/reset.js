// Reset starts a new setup flow. Stored results are never deleted or overwritten.
export function createRaceReset({ getData, isBusy, confirm, endRace, onPrepare, onReturn }) {
  let preparing = false;
  function prepare(result = getData()) {
    preparing = true;
    onPrepare(result);
  }
  return {
    get preparing() {
      return preparing;
    },
    request() {
      const race = getData()?.race;
      if (isBusy() || !race) return;
      if (race.status === 'finished') {
        prepare();
        return;
      }
      const id = race.id;
      confirm(
        '現在のレースをリセットしますか？',
        '「' +
          race.title +
          '」の受付と回答を停止して、新しいレースの設定に戻ります。ここまでの成績は履歴に保存します。',
        async () => prepare(await endRace(id)),
        '中止して設定し直す',
      );
    },
    back() {
      if (isBusy()) return;
      preparing = false;
      onReturn();
    },
    complete() {
      preparing = false;
    },
  };
}
