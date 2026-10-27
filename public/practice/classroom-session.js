import { createPracticeTransactions } from './transactions.js';

// Browser-independent session owner; the classic entry only supplies its environment.
export function createClassroomSession({
  page,
  events,
  search,
  storage,
  legacyStorage,
  request,
  vocabulary,
  builtinVocabulary,
  enterStudent,
  goHome,
  stopAudio,
  onLessonSaved = () => {},
  schedule = setInterval,
}) {
  let session = null,
    recovery = null,
    room = null,
    paused = false,
    checking = false,
    watching = false,
    confirming = false,
    entryEpoch = 0,
    joinRequest = null;
  const targetClass = new URLSearchParams(search).get('class');
  const key = 'aomiyalingo.classroom.session',
    recoveryKey = 'aomiyalingo.recovery';
  const q = (s) => page.querySelector(s),
    dialog = q('#join-dialog'),
    form = q('#join-form'),
    error = q('#join-error'),
    status = q('#sync-status'),
    again = q('#sync-retry'),
    pauseDialog = q('#class-paused');
  const read = (k) => {
      try {
        return JSON.parse(storage.getItem(k) || 'null');
      } catch {
        return null;
      }
    },
    write = (k, v) => {
      try {
        if (v === null) storage.removeItem(k);
        else storage.setItem(k, JSON.stringify(v));
      } catch {}
    };
  function showStatus(message, bad = false) {
    status.textContent = message;
    status.classList.toggle('sync-error', bad);
    status.hidden = false;
  }
  async function api(path, data, auth = session?.token || recovery?.token) {
    const owner = session;
    try {
      return await request('/api/' + path, data, { token: auth });
    } catch (e) {
      if (owner === session && (e.code === 'CLASS_CLOSED' || e.code === 'CLASS_PAUSED'))
        setState({
          active: e.code !== 'CLASS_CLOSED',
          ended: e.code === 'CLASS_CLOSED',
          paused: true,
        });
      throw e;
    }
  }
  function setState(value) {
    const wasPaused = paused;
    paused = !!(!value.active || value.paused || value.ended);
    if (paused && watching) {
      stopAudio();
      q('#paused-title').textContent = value.ended
        ? '授業は終了しました'
        : '練習を一時停止しています';
      q('#paused-message').textContent = value.ended
        ? '学習の記録は保存されています。先生が再開すると続けられます。'
        : '先生の説明を聞いて、再開までお待ちください。';
      if (!pauseDialog.open) pauseDialog.showModal();
    } else if (!paused) {
      if (pauseDialog.open) pauseDialog.close();
      if (wasPaused) {
        showStatus('出席番号 ' + session.label + ' · 再開しました');
        if (transactions.unsent) transactions.flush();
      }
    }
  }
  pauseDialog.addEventListener('cancel', (e) => e.preventDefault());
  q('#paused-home').onclick = () => {
    watching = false;
    pauseDialog.close();
    goHome();
  };
  function remember(value) {
    vocabulary.splice(0, vocabulary.length, ...(value.lesson?.vocabulary || builtinVocabulary));
    session = value;
    watching = true;
    try {
      legacyStorage.removeItem(key);
    } catch {}
    write(key, { id: value.id, token: value.token, label: value.label, classId: value.classId });
    q('#number-change').hidden = false;
    showStatus('出席番号 ' + value.label + ' · 保存済み');
    transactions.restore();
    setState(value);
  }
  function resetJoin() {
    confirming = false;
    q('#join-confirmation').hidden = true;
    q('#attendance-number').readOnly = false;
    q('#join-submit').textContent = '確認する';
    q('#join-back').hidden = true;
    q('#recovery-request').hidden = true;
  }
  async function openJoin() {
    const epoch = ++entryEpoch;
    joinRequest = null;
    resetJoin();
    q('#join-submit').disabled = true;
    error.hidden = true;
    if (!dialog.open) dialog.showModal();
    q('#attendance-number').focus();
    try {
      const current = await api(
        'class/current' + (targetClass ? '?class=' + encodeURIComponent(targetClass) : ''),
        undefined,
        null,
      );
      if (epoch !== entryEpoch) return;
      room = current.classroom;
      q('#join-class').textContent =
        room?.title ||
        (targetClass
          ? 'この授業は見つかりません。先生の新しいQRを読み取ってください。'
          : '先生が授業を開始するまでお待ちください。');
      q('#join-submit').disabled = !room?.accepting;
      let saved = read(key);
      if (!saved)
        try {
          saved = JSON.parse(legacyStorage.getItem(key) || 'null');
        } catch {}
      if (saved?.token && (!targetClass || saved.classId === targetClass)) {
        session = saved;
        const value = await api('student/me');
        if (epoch !== entryEpoch) return;
        if (targetClass || value.active || !value.availableClassId) {
          dialog.close();
          remember({ ...saved, ...value });
          if (transactions.unsent && !paused) await transactions.flush();
          enterStudent();
          return;
        }
        session = null;
        write(key, null);
      }
      recovery = read(recoveryKey);
      if (targetClass && recovery?.classId !== targetClass) recovery = null;
      if (recovery && (!targetClass || recovery.classId === targetClass)) {
        q('#join-confirmation').hidden = false;
        q('#join-confirmation').textContent = '先生の引き継ぎ許可を待っています。';
        q('#join-submit').disabled = true;
      }
    } catch (e) {
      if (epoch !== entryEpoch) return;
      error.textContent = e.message;
      error.hidden = false;
      if (e.status === 401) {
        write(key, null);
        session = null;
      }
    }
  }
  form.onsubmit = async (event) => {
    event.preventDefault();
    if (joinRequest) return;
    const label = q('#attendance-number').value.trim();
    error.hidden = true;
    if (!room?.accepting) return;
    if (!confirming) {
      confirming = true;
      q('#join-confirmation').hidden = false;
      q('#join-confirmation').textContent = '出席番号 ' + Number(label) + ' で参加します。';
      q('#attendance-number').readOnly = true;
      q('#join-submit').textContent = '参加する';
      q('#join-back').hidden = false;
      q('#join-submit').focus({ preventScroll: true });
      return;
    }
    q('#join-submit').disabled = true;
    error.hidden = true;
    const joining = { epoch: entryEpoch, roomId: room.id };
    joinRequest = joining;
    try {
      const value = await api('join', { label, classId: joining.roomId }, null);
      if (joining.epoch !== entryEpoch) return;
      dialog.close();
      remember(value);
      enterStudent();
    } catch (e) {
      if (joining.epoch !== entryEpoch) return;
      error.textContent = e.message;
      error.hidden = false;
      q('#recovery-request').hidden = e.code !== 'DUPLICATE';
    } finally {
      if (joinRequest === joining) {
        joinRequest = null;
        q('#join-submit').disabled = false;
      }
    }
  };
  q('#join-back').onclick = () => {
    resetJoin();
    q('#attendance-number').focus({ preventScroll: true });
  };
  dialog.addEventListener('cancel', (event) => {
    if (!session) event.preventDefault();
  });
  q('#join-close').onclick = () => dialog.close();
  q('#recovery-request').onclick = async () => {
    try {
      recovery = await api(
        'recovery/request',
        { label: q('#attendance-number').value, classId: room.id },
        null,
      );
      write(recoveryKey, recovery);
      q('#recovery-request').hidden = true;
      q('#join-submit').disabled = true;
      q('#join-confirmation').textContent =
        '先生に声をかけてください。許可後、保存された続きから再開します。';
    } catch (e) {
      error.textContent = e.message;
      error.hidden = false;
    }
  };
  const transactions = createPracticeTransactions({
    getSession: () => session,
    isPaused: () => paused,
    api,
    read,
    write,
    onSaving() {
      again.hidden = true;
      showStatus('回答を保存中…');
    },
    onSaved(lesson, kind) {
      showStatus('出席番号 ' + session.label + ' · 保存済み');
      if (kind === 'answer') {
        q('#try-again').disabled = false;
        onLessonSaved(lesson);
      }
    },
    onError(e, kind) {
      showStatus(e.message || '回答を保存できませんでした。', true);
      if (kind === 'answer') again.hidden = false;
    },
  });
  function record(questionId, answer, hintUsed = false) {
    const accepted = transactions.record(questionId, answer, hintUsed);
    if (accepted) q('#try-again').disabled = true;
    return accepted;
  }
  again.onclick = transactions.flush;
  events.addEventListener('online', () => {
    if (transactions.unsent) transactions.flush();
  });
  q('#number-change').onclick = () => {
    q('#new-number').value = session.label;
    q('#number-error').hidden = true;
    q('#number-dialog').showModal();
  };
  q('#number-cancel').onclick = () => q('#number-dialog').close();
  q('#number-form').onsubmit = async (e) => {
    e.preventDefault();
    const button = q('#number-save');
    button.disabled = true;
    const owner = session;
    try {
      const result = await api('student/label', { label: q('#new-number').value }, owner.token);
      if (session !== owner) return;
      session.label = result.label;
      remember(session);
      q('#number-dialog').close();
    } catch (e) {
      q('#number-error').textContent = e.message;
      q('#number-error').hidden = false;
    } finally {
      button.disabled = false;
    }
  };
  schedule(async () => {
    if (page.hidden || checking) return;
    checking = true;
    const owner = session,
      transfer = recovery;
    try {
      if (recovery && (!targetClass || recovery.classId === targetClass)) {
        const result = await api('recovery/status', undefined, recovery.token);
        if (recovery !== transfer) return;
        if (result.status === 'approved') {
          const token = recovery.token;
          recovery = null;
          write(recoveryKey, null);
          dialog.close();
          remember({ ...result.session, token });
          enterStudent();
        } else if (result.status === 'denied') {
          recovery = null;
          write(recoveryKey, null);
          error.textContent = '引き継ぎが許可されませんでした。先生に相談してください。';
          error.hidden = false;
          q('#join-submit').disabled = false;
        }
      } else if (session && watching) {
        const result = await api('student/status', undefined, owner.token);
        if (session === owner && watching) setState(result);
      }
    } catch (e) {
      if (e.status === 401 && session && session === owner) {
        watching = false;
        showStatus('この端末の参加は解除されました。先生に相談してください。', true);
        paused = true;
        q('#paused-title').textContent = '参加を確認してください';
        q('#paused-message').textContent =
          '別の端末へ引き継がれた可能性があります。先生に相談してください。';
        if (!pauseDialog.open) pauseDialog.showModal();
      }
    } finally {
      checking = false;
    }
  }, 3000);
  schedule(() => {
    if (session && watching && !page.hidden && !transactions.pending)
      api('student/ping', {}).catch(() =>
        showStatus('接続を確認してください。回答はこの端末に保管しています。', true),
      );
  }, 15000);
  return {
    openJoin,
    start: transactions.start,
    record,
    leave() {
      watching = false;
    },
    get paused() {
      return paused;
    },
    get current() {
      return session;
    },
    get busy() {
      return transactions.busy;
    },
    takeLesson: transactions.takeLesson,
    saveDraft(value) {
      if (session && !transactions.busy) write('aomi.draft.' + session.id, value);
    },
    draft(id) {
      const value = session ? read('aomi.draft.' + session.id) : null;
      return value?.questionId === id ? value : null;
    },
  };
}
