export function practiceFlow(room, preparing) {
  preparing = !!preparing || !room;
  return {
    title: preparing ? '授業を準備しよう' : room?.title || '単語練習',
    phase: preparing ? 'setup' : !room?.active ? 'results' : room.paused ? 'paused' : 'running',
    canJoin: !!room?.active,
    next: preparing
      ? '教材と内容を選んでください。準備をやめても、今の授業や記録は変わりません。'
      : !room?.active
        ? 'この授業は終了しました。記録を確認するか、「新しい授業を準備」から次の授業を始められます。'
        : room.paused
          ? '生徒の回答を一時停止しています。「練習を再開」で続きから進めます。'
          : room.accepting
            ? 'この授業のQRを生徒に見せてください。出席番号を入力すると、自分のペースで練習できます。'
            : '参加受付は締め切っています。参加済みの生徒は、このまま練習を続けられます。',
    back: room ? (room.active ? '今の授業に戻る' : '記録に戻る') : 'ホームに戻る',
  };
}

// Capture a form snapshot before confirmation. Merely preparing/canceling never
// ends a classroom, and double confirmation cannot create duplicate rooms.
export function createClassLauncher({ getActive, isBusy, confirm, create }) {
  let creating = false;
  async function run(payload) {
    if (creating || isBusy()) return;
    creating = true;
    try {
      return await create(payload);
    } finally {
      creating = false;
    }
  }
  return async function submit(values) {
    if (creating || isBusy()) return;
    const payload = structuredClone(values);
    const active = getActive();
    if (active) return confirm(active, () => run(payload));
    return run(payload);
  };
}
