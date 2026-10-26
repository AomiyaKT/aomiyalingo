'use strict';
import { createTeacherRoster } from './practice/teacher-roster.js';
import { createTeacherAnalysis } from './practice/teacher-analysis.js';
import { createTeacherPracticePanels } from './practice/teacher-panels.js';
import { practiceFlow, createClassLauncher } from './practice/teacher-flow.js';
import { installContextHelp } from './shared/context-help.js';
installContextHelp();
const tq = (s) => document.querySelector(s),
  modeNames = course.exerciseNames;
let practiceFormat = 'adaptive-four';
let classes = [],
  classId = null,
  lastData = null,
  selectedStudent = null,
  loading = false,
  recordsBusy = false,
  refreshEpoch = 0;
let controlsBusy = false;
let preparingClass = null;
function currentClass() {
  return lastData?.classroom?.id === classId
    ? lastData.classroom
    : classes.find((room) => room.id === classId);
}
function syncPracticeFlow() {
  const room = currentClass();
  const state = practiceFlow(room, preparingClass);
  preparingClass = state.phase === 'setup';
  document.body.dataset.teacherPracticeState = state.phase;
  tq('#practice-title').textContent = state.title;
  tq('#practice-title').translate = preparingClass || !room;
  tq('#practice-next-step').dataset.help = state.next;
  tq('#current-class-panel').hidden = preparingClass || !room;
  tq('#class-results').hidden = preparingClass || !room || lastData?.classroom?.id !== classId;
  tq('#new-class-panel').open = preparingClass;
  tq('#new-class-panel').hidden = !preparingClass && !!room && !room.active;
  tq('#current-class-panel h2').textContent = room?.active ? '現在のクラス' : '授業の記録';
  tq('#prepare-class').hidden = preparingClass || !room || !!room.active;
  tq('#class-setup-cancel').textContent = state.back;
  tq('#class-setup-cancel').hidden = !room;
  tq('#projection-records').hidden = !document.body.classList.contains('projection');
  aomiClassroomLink(
    tq('.qr-panel img'),
    tq('#student-link'),
    location.origin,
    'practice',
    state.canJoin ? room.id : null,
  );
  tq('.qr-panel h2').textContent = state.canJoin ? '生徒用QR' : '記録保存済み';
  tq('.qr-empty-note').textContent = room
    ? 'この授業は終了しました。次の授業を始めると、新しいQRが表示されます。'
    : 'クラスを開始すると、この授業専用のQRが表示されます。';
}
function prepareClass() {
  if (controlsBusy || recordsBusy) return;
  preparingClass = true;
  syncPracticeFlow();
  tq('#class-grade').focus({ preventScroll: true });
  tq('#new-class-panel').scrollIntoView({
    behavior: appSettings.values.reduceMotion ? 'auto' : 'smooth',
    block: 'start',
  });
}
async function teacherApi(path, data) {
  return aomiNetwork.request('/api/teacher/' + path, data);
}
function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function message(text, bad = false) {
  tq('#connection-status').textContent = text;
  tq('#connection-status').classList.toggle('sync-error', bad);
}
function loggedIn(value) {
  tq('#teacher-access').hidden = value;
  tq('#teacher-board').hidden = !value;
  tq('#teacher-logout').hidden = !value;
  tq('#teacher-account-settings').hidden = !value;
}
let editorDefaultsLoaded = false,
  configuredWords = builtinVocabulary,
  gradeRoot = null;
async function loadClasses() {
  if (!editorDefaultsLoaded) {
    const saved = await teacherApi('config');
    gradeRoot = saved.config;
    selectClassGrade();
    editorDefaultsLoaded = true;
    updateLessonOptions();
  }
  const result = await teacherApi('classes');
  classes = result.classes;
  renderClassTrash(result.trash || []);
  const select = tq('#class-select');
  select.replaceChildren();
  for (const c of classes) {
    const option = el('option', roomName(c));
    option.value = c.id;
    select.append(option);
  }
  classId =
    classes.find((c) => c.id === classId)?.id ||
    classes.find((c) => c.active)?.id ||
    classes[0]?.id ||
    null;
  if (classId) select.value = classId;
  select.disabled = !classes.length;
  tq('#empty-class').hidden = !!classId;
  tq('#class-results').hidden = !classId;
  loggedIn(true);
  tq('#current-class-panel').hidden = !classId;
  tq('#more-class-actions').hidden = !classId;
  tq('#projection-mode').disabled = !classId;
  if (!classId) message('内容を選んで、クラスを開始してください。');
  syncPracticeFlow();
  await refresh();
}
tq('#teacher-form').onsubmit = async (event) => {
  event.preventDefault();
  const button = tq('#teacher-submit');
  button.disabled = true;
  tq('#teacher-error').hidden = true;
  try {
    await teacherApi('login', { password: tq('#teacher-password').value });
    tq('#teacher-password').value = '';
    await loadClasses();
    interactionEffects.sound('save');
  } catch (e) {
    tq('#teacher-error').textContent = e.message || '接続できませんでした。';
    tq('#teacher-error').hidden = false;
  } finally {
    button.disabled = false;
  }
};
tq('#teacher-logout').onclick = async () => {
  const button = tq('#teacher-logout'),
    error = tq('#teacher-logout-error');
  button.disabled = true;
  error.hidden = true;
  try {
    await teacherApi('logout', {});
    location.replace('/');
    loggedIn(false);
    lastData = null;
    classId = null;
    tq('#settings-dialog').close();
    document.body.classList.remove('projection');
    tq('#teacher-password').focus();
  } catch {
    error.textContent = 'ログアウトできませんでした。もう一度お試しください。';
    error.hidden = false;
  } finally {
    button.disabled = false;
  }
};
async function createPracticeClass(payload) {
  controlsBusy = true;
  refreshEpoch++;
  const button = tq('#create-class');
  button.disabled = true;
  tq('#new-class-form').inert = true;
  tq('#new-class-error').hidden = true;
  try {
    const room = await teacherApi('classes', payload);
    classId = room.id;
    lastData = null;
    selectedStudent = null;
    preparingClass = false;
    await loadClasses();
    interactionEffects.sound('save');
  } finally {
    controlsBusy = false;
    tq('#new-class-form').inert = false;
    button.disabled = false;
    syncPracticeFlow();
    refresh();
  }
}
const newClassDialog = tq('#new-class-confirm');
let newClassAction = null;
const launchClass = createClassLauncher({
  getActive: () => classes.find((room) => room.active),
  isBusy: () => controlsBusy || recordsBusy,
  confirm(active, action) {
    newClassAction = action;
    tq('#new-class-confirm-description').textContent =
      '「' +
      active.title +
      '」を終了して、新しい授業を始めます。今の成績は保存します。生徒には新しいQRを見せてください。';
    tq('#new-class-confirm-error').textContent = '';
    newClassDialog.showModal();
    tq('#new-class-confirm-cancel').focus();
  },
  create: createPracticeClass,
});
tq('#new-class-confirm-cancel').onclick = () => newClassDialog.close();
newClassDialog.addEventListener('cancel', (event) => {
  if (controlsBusy) event.preventDefault();
});
newClassDialog.addEventListener('close', () => {
  newClassAction = null;
});
tq('#new-class-confirm-ok').onclick = async () => {
  if (!newClassAction || controlsBusy) return;
  tq('#new-class-confirm-ok').disabled = tq('#new-class-confirm-cancel').disabled = true;
  try {
    await newClassAction();
    newClassDialog.close();
  } catch (error) {
    tq('#new-class-confirm-error').textContent = error.message;
  } finally {
    tq('#new-class-confirm-ok').disabled = tq('#new-class-confirm-cancel').disabled = false;
  }
};
tq('#prepare-class').onclick = prepareClass;
tq('#new-class-panel').addEventListener('toggle', () => {
  if (tq('#new-class-panel').open && !preparingClass) prepareClass();
});
tq('#class-setup-cancel').onclick = () => {
  if (controlsBusy) return;
  if (!classId) return location.replace('/');
  preparingClass = false;
  syncPracticeFlow();
  tq('.board-heading').scrollIntoView({ behavior: 'auto', block: 'start' });
};
tq('#new-class-form').onsubmit = async (event) => {
  event.preventDefault();
  tq('#new-class-error').hidden = true;
  try {
    await launchClass({
      grade: curriculumSelection(tq('#class-grade').value).grade,
      unit: curriculumSelection(tq('#class-grade').value).unit,
      title: tq('#class-title').value,
      format: practiceFormat,
      roundSize: Number(tq('#round-size').value),
      wordGroup: tq('#word-group').value,
      modes: [...document.querySelectorAll('[name=lesson-mode]:checked')].map(
        (input) => input.value,
      ),
    });
  } catch (e) {
    tq('#new-class-error').textContent = e.message || 'クラスを開始できませんでした。';
    tq('#new-class-error').hidden = false;
  }
};
tq('#class-select').onchange = () => {
  refreshEpoch++;
  classId = tq('#class-select').value;
  preparingClass = false;
  selectedStudent = null;
  syncPracticeFlow();
  refresh();
};
tq('#refresh-board').onclick = () => refresh();
const { attemptRow, renderDetail, renderMastery } = createTeacherAnalysis({
  q: tq,
  make: el,
  modeNames,
  getVocabulary: () => vocabulary,
  getData: () => lastData,
  getSelectedStudent: () => selectedStudent,
  getClassVocabulary: classVocabulary,
  getConfiguredModes: () => configuredModes(lastData?.classroom),
});
const renderPracticePanels = createTeacherPracticePanels({ q: tq, make: el, attemptRow });
const renderRoster = createTeacherRoster({
  host: tq('#student-rows'),
  make: el,
  modeNames,
  onDetail(id) {
    selectedStudent = id;
    renderDetail();
    tq('#student-detail').scrollIntoView({
      behavior: appSettings.values.reduceMotion ? 'auto' : 'smooth',
      block: 'start',
    });
  },
});
function render(data) {
  vocabulary.splice(
    0,
    vocabulary.length,
    ...(data.classroom?.vocabulary ? JSON.parse(data.classroom.vocabulary) : builtinVocabulary),
  );
  lastData = data;
  const room = data.classroom || classes.find((c) => c.id === classId);
  document.body.dataset.practiceFormat = course.practiceSettings(room?.modes).format;
  if (room) {
    classes = classes.map((c) => (c.id === room.id ? room : c));
    const option = tq('#class-select').querySelector('option[value="' + room.id + '"]');
    if (option) option.textContent = roomName(room);
  }
  tq('#class-scope-summary').textContent = classScope(room);
  tq('#room-state').textContent = !room?.active
    ? '終了 · 記録保存済み'
    : room.paused
      ? '一時停止中'
      : room.accepting
        ? '練習中 · 参加受付中'
        : '練習中 · 参加締切';
  tq('#room-state').dataset.state = !room?.active ? 'ended' : room.paused ? 'paused' : 'active';
  tq('#delete-ended-class').hidden = !room || !!room.active;
  tq('#class-state-button').hidden = !room;
  tq('#class-state-button').textContent = room?.active ? '授業を終了' : '授業を再開';
  tq('#joining-button').hidden = !room?.active;
  tq('#pause-button').hidden = !room?.active;
  tq('#joining-button').textContent = room?.accepting ? '参加を締め切る' : '参加を再開';
  tq('#pause-button').textContent = room?.paused ? '練習を再開' : '練習を一時停止';
  tq('#pause-button').dataset.help = room?.paused
    ? '参加済みの生徒が、続きから練習を再開します。'
    : '生徒の回答を一時停止します。記録は保存され、後から再開できます。';
  tq('#joining-button').dataset.help = room?.accepting
    ? '新しい参加だけを止めます。参加済みの生徒は練習を続けられます。'
    : 'このクラスのQRから、新しい生徒が参加できるようにします。';
  tq('#export-results').hidden = !room;
  tq('#export-results').href = '/api/teacher/export?class=' + encodeURIComponent(classId);
  tq('#class-state-button').classList.toggle('reopen', !room?.active);
  tq('.qr-panel').classList.toggle('room-closed', !room?.active || !room?.accepting);
  tq('#joined-count').textContent = data.students.length;
  tq('#finished-count').textContent = data.students.filter((s) => s.done).length;
  const projecting = document.body.classList.contains('projection');
  const errors = data.attempts.filter((a) => !a.correct),
    summary = course.teachingSummary(data.students, vocabulary);
  tq('#mistake-summary-label').textContent = projecting ? '確認したい単語' : '間違えた回答';
  tq('#mistake-count').textContent = projecting
    ? summary.filter((w) => w.remaining || w.firstWrong || w.hinted).length
    : errors.length;
  tq('#waiting-students').hidden = data.students.length > 0;
  tq('#waiting-students').textContent = room?.active
    ? '生徒の参加を待っています…'
    : 'この授業の参加記録はありません。';
  renderRoster(room?.id || classId, data.students);
  renderPracticePanels(data, summary);
  renderRecovery(data.recovery || []);
  renderMastery(data.students);
  renderDetail();
  renderRecords(data);
  syncPracticeFlow();
  tq('#connection-status').dataset.help =
    '最終更新 ' +
    new Date(data.updated).toLocaleTimeString('ja-JP') +
    '。3秒ごとに自動更新します。';
  message('接続済み');
}
async function refresh() {
  if (loading || controlsBusy || recordsBusy || !classId || tq('#teacher-board').hidden) return;
  loading = true;
  const epoch = refreshEpoch;
  try {
    const requested = classId,
      data = await teacherApi('progress?class=' + encodeURIComponent(requested));
    if (requested === classId && epoch === refreshEpoch) render(data);
  } catch (e) {
    if (epoch !== refreshEpoch) return;
    if (e.status === 401) loggedIn(false);
    message('接続を確認してください。表示中の記録は保持しています。', true);
  } finally {
    loading = false;
    if (epoch !== refreshEpoch && !recordsBusy) refresh();
  }
}
aomiClassroomLink(tq('.qr-panel img'), tq('#student-link'), location.origin, 'practice', null);
tq('.qr-panel p').textContent = 'クラスを開始すると、この授業専用のQRが表示されます。';
if (location.pathname === '/') tq('.header-actions a[href="/"]').hidden = true;
tq('#student-link').textContent = '生徒用リンクを開く';
tq('#class-title').value = 'Unit 4–5 · ' + new Date().toLocaleDateString('ja-JP');
setInterval(() => {
  if (!document.hidden) refresh();
}, 3000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) refresh();
});
loadClasses().catch((e) => {
  loggedIn(false);
  if (e.status === 401) location.replace('/?next=practice');
  if (e.status !== 401) {
    tq('#teacher-error').textContent = '接続できませんでした。もう一度お試しください。';
    tq('#teacher-error').hidden = false;
  }
});

tq('#projection-mode').onclick = () => {
  const active = document.body.classList.toggle('projection');
  tq('#projection-mode').setAttribute('aria-pressed', String(active));
  tq('#projection-mode').innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>' +
    (active ? '先生の画面に戻る' : 'テレビに映す');
  tq('#more-class-actions').open = false;
  document.body.classList.remove('show-records');
  tq('#projection-records').textContent = '個別の記録を表示';
  if (lastData) render(lastData);
};

const classStateDialog = tq('#class-state-dialog');
let classAction = null;
function confirmAction(action) {
  tq('#more-class-actions').open = false;
  const room = classes.find((c) => c.id === classId);
  if (!room) return;
  classAction = { classId: room.id, action };
  tq('#class-state-title').textContent =
    action === 'end' ? '授業を終了しますか？' : '授業を再開しますか？';
  tq('#class-state-description').textContent =
    action === 'end'
      ? '参加と回答を停止し、この授業の記録を保存します。後から再開できます。'
      : '保存された続きから再開します。他に進行中の授業がある場合、その授業は終了します。';
  tq('#class-state-confirm').textContent = action === 'end' ? '授業を終了' : '授業を再開';
  tq('#class-state-error').hidden = true;
  classStateDialog.showModal();
}
tq('#class-state-button').onclick = () =>
  confirmAction(classes.find((c) => c.id === classId)?.active ? 'end' : 'reopen');
async function quickAction(action, button) {
  if (controlsBusy) return;
  controlsBusy = true;
  refreshEpoch++;
  const id = classId;
  tq('#more-class-actions').open = false;
  for (const selector of [
    '#joining-button',
    '#pause-button',
    '#class-state-button',
    '#class-select',
  ])
    tq(selector).disabled = true;
  try {
    await teacherApi('class-state', { classId: id, action });
    const result = await teacherApi('progress?class=' + encodeURIComponent(id));
    if (classId === id) render(result);
    interactionEffects.sound('save');
  } catch (e) {
    message(e.message, true);
  } finally {
    controlsBusy = false;
    for (const selector of [
      '#joining-button',
      '#pause-button',
      '#class-state-button',
      '#class-select',
    ])
      tq(selector).disabled = false;
  }
}
tq('#joining-button').onclick = () =>
  quickAction(
    classes.find((c) => c.id === classId)?.accepting ? 'join-stop' : 'join-open',
    tq('#joining-button'),
  );
tq('#pause-button').onclick = () =>
  quickAction(
    classes.find((c) => c.id === classId)?.paused ? 'resume' : 'pause',
    tq('#pause-button'),
  );
tq('#class-state-cancel').onclick = () => classStateDialog.close();
tq('#class-state-confirm').onclick = async () => {
  if (!classAction) return;
  const action = { ...classAction };
  tq('#class-state-confirm').disabled = true;
  try {
    await teacherApi('class-state', action);
    classId = action.classId;
    await loadClasses();
    classStateDialog.close();
    interactionEffects.sound('save');
  } catch (e) {
    tq('#class-state-error').textContent =
      e.message || '変更できませんでした。もう一度お試しください。';
    tq('#class-state-error').hidden = false;
  } finally {
    tq('#class-state-confirm').disabled = false;
  }
};

function renderRecovery(requests) {
  tq('#recovery-panel').hidden = !requests.length;
  const panel = tq('#recovery-list');
  panel.replaceChildren();
  if (!requests.length) {
    panel.append(el('p', '申請はありません。'));
    return;
  }
  for (const r of requests) {
    const row = el('div', undefined, 'recovery-row');
    row.append(
      el('strong', '出席番号 ' + r.label),
      el('span', '別の端末で続けたいと申請しています。以前の端末は参加解除されます。'),
    );
    for (const [text, approve] of [
      ['許可する', true],
      ['許可しない', false],
    ]) {
      const button = el('button', text, 'control-button');
      button.onclick = async () => {
        button.disabled = true;
        try {
          await teacherApi('recovery', { requestId: r.id, approve });
          await refresh();
        } catch (e) {
          message(e.message, true);
        } finally {
          button.disabled = false;
        }
      };
      row.append(button);
    }
    panel.append(row);
  }
}
function roomName(c) {
  return (
    c.title +
    ' · ' +
    (!c.active ? '終了' : c.paused ? '一時停止' : c.accepting ? '受付中' : '参加締切')
  );
}
const recordsDialog = tq('#records-warning');
tq('#projection-records').onclick = () => {
  if (document.body.classList.contains('show-records')) {
    document.body.classList.remove('show-records');
    tq('#projection-records').textContent = '個別の記録を表示';
  } else recordsDialog.showModal();
};
tq('#records-cancel').onclick = () => recordsDialog.close();
tq('#records-confirm').onclick = () => {
  document.body.classList.add('show-records');
  tq('#projection-records').textContent = '個別の記録を隠す';
  recordsDialog.close();
};

const deleteRecordsDialog = tq('#delete-records-dialog');
let deleteRecordsAction = null;
function renderRecords(data) {
  const select = tq('#record-student'),
    previous = select.value;
  select.replaceChildren(el('option', '出席番号を選んでください'));
  select.firstChild.value = '';
  for (const st of data.students) {
    const option = el('option', '出席番号 ' + st.label + ' · 回答 ' + st.attempts + '件');
    option.value = st.id;
    select.append(option);
  }
  if (data.students.some((st) => st.id === previous)) select.value = previous;
  tq('#records-class-name').textContent = data.classroom?.title || '';
  tq('#delete-student-record').disabled = !select.value;
  tq('#clear-class-records').disabled = !data.students.length;
  renderTrash(data);
}
tq('#record-student').onchange = () => {
  tq('#delete-student-record').disabled = !tq('#record-student').value;
};
function confirmRecordsDelete(scope) {
  const data = lastData,
    room = data?.classroom;
  if (!room || room.id !== classId || recordsBusy) return;
  const st = data.students.find((s) => s.id === tq('#record-student').value);
  if (scope === 'student' && !st) return;
  deleteRecordsAction = {
    classId: room.id,
    classTitle: room.title,
    scope,
    confirm: true,
    ...(scope === 'student' ? { studentId: st.id, label: st.label } : {}),
  };
  tq('#delete-records-title').textContent =
    scope === 'student' ? 'この生徒の記録を削除しますか？' : 'このクラスの記録をすべて消しますか？';
  tq('#delete-records-target').textContent =
    room.title +
    (scope === 'student' ? ' · 出席番号 ' + st.label : ' · ' + data.students.length + '人');
  tq('#delete-records-description').textContent =
    scope === 'student'
      ? 'この生徒の成績・回答履歴・参加情報を回収箱に移します。他の生徒の記録は残ります。'
      : 'このクラス全員の成績・回答履歴・参加情報を回収箱に移します。他のクラスの記録は残ります。';
  tq('#delete-records-error').hidden = true;
  tq('#delete-records-confirm').textContent =
    scope === 'student' ? 'この生徒の記録を削除' : 'このクラスの記録をすべて消す';
  deleteRecordsDialog.showModal();
  tq('#delete-records-cancel').focus();
}
tq('#delete-student-record').onclick = () => confirmRecordsDelete('student');
tq('#clear-class-records').onclick = () => confirmRecordsDelete('class');
tq('#delete-records-cancel').onclick = () => deleteRecordsDialog.close();
deleteRecordsDialog.addEventListener('cancel', (event) => {
  if (recordsBusy) event.preventDefault();
});
deleteRecordsDialog.addEventListener('close', () => {
  deleteRecordsAction = null;
});
tq('#delete-records-confirm').onclick = async () => {
  if (!deleteRecordsAction || recordsBusy) return;
  const action = { ...deleteRecordsAction };
  recordsBusy = true;
  refreshEpoch++;
  tq('#delete-records-confirm').disabled = true;
  tq('#delete-records-cancel').disabled = true;
  try {
    const removed = await teacherApi('records-delete', action);
    if (classId === action.classId && lastData) {
      const ids = new Set(
        lastData.students
          .filter((s) => action.scope === 'class' || s.id === action.studentId)
          .map((s) => s.id),
      );
      selectedStudent = ids.has(selectedStudent) ? null : selectedStudent;
      render({
        ...lastData,
        trash: [
          {
            id: removed.trashId,
            scope: action.scope,
            label: action.label,
            count: ids.size,
            created: Date.now(),
          },
          ...(lastData.trash || []),
        ],
        students: lastData.students.filter((s) => !ids.has(s.id)),
        attempts: lastData.attempts.filter((a) => !ids.has(a.student_id)),
        recovery: (lastData.recovery || []).filter(
          (r) => action.scope !== 'class' && r.label !== action.label,
        ),
        updated: Date.now(),
      });
    }
    deleteRecordsDialog.close();
    tq('#records-result').textContent =
      action.scope === 'student'
        ? '出席番号 ' + action.label + ' の記録を回収箱に移しました。'
        : 'このクラスの記録を回収箱に移しました。';
    interactionEffects.sound('save');
  } catch (e) {
    tq('#delete-records-error').textContent =
      e.message || '削除できませんでした。もう一度お試しください。';
    tq('#delete-records-error').hidden = false;
  } finally {
    recordsBusy = false;
    tq('#delete-records-confirm').disabled = false;
    tq('#delete-records-cancel').disabled = false;
    refresh();
  }
};

function configuredModes(room) {
  return course.practiceSettings(room?.modes).modes;
}
function classVocabulary() {
  const group = lastData?.classroom?.word_group;
  return vocabulary.filter((w) => !group || group === 'all' || w.group === group);
}
function classScope(room) {
  const group = {
    all: 'すべての単語',
    verb: '動詞',
    adjective: '形容詞',
    family: '家族',
    occupation: '職業',
    phrase: 'ことば・表現',
    other: 'その他',
  }[room?.word_group || 'all'];
  return (
    curriculumLabel(room?.grade, room?.unit) +
    ' · ' +
    group +
    ' · ' +
    (course.practiceSettings(room?.modes).format === 'adaptive-four'
      ? 'ことば・文づくり・リスニング'
      : configuredModes(room)
          .map((m) => modeNames[m])
          .join('・'))
  );
}
function selectClassGrade() {
  if (!gradeRoot) return;
  const choice = curriculumSelection(tq('#class-grade').value),
    c = curriculumProfile(gradeRoot, tq('#class-grade').value);
  configuredWords = c.words.filter((w) => w.enabled && c.course.wordIds.includes(w.word));
  practiceFormat = c.course.format || 'adaptive-four';
  tq('#class-basic-modes').hidden = practiceFormat !== 'classic';
  tq('#class-format-summary').hidden = practiceFormat === 'classic';
  tq('#round-size').value = c.course.roundSize;
  for (const input of document.querySelectorAll('[name=lesson-mode]'))
    input.checked = c.course.modes.includes(input.value);
  tq('#class-title').value = choice.label + ' · ' + new Date().toLocaleDateString('ja-JP');
  const group = tq('#word-group');
  group.replaceChildren();
  for (const [value, name] of Object.entries({
    all: 'すべての設定済み単語',
    family: '家族',
    verb: '動詞',
    adjective: '形容詞',
    occupation: '職業',
    phrase: 'ことば・表現',
    other: 'その他',
  })) {
    if (value !== 'all' && !configuredWords.some((w) => w.group === value)) continue;
    const option = el('option', name);
    option.value = value;
    group.append(option);
  }
  updateLessonOptions();
}
tq('#class-grade').onchange = selectClassGrade;
function updateLessonOptions() {
  const modes = [...document.querySelectorAll('[name=lesson-mode]:checked')],
    count = configuredWords.filter(
      (w) => tq('#word-group').value === 'all' || w.group === tq('#word-group').value,
    ).length;
  tq('#lesson-options-summary').textContent =
    practiceFormat === 'adaptive-four'
      ? count +
        '語 · 全' +
        count * 3 +
        '問を' +
        tq('#round-size').value +
        '問ずつ。10種類の題型を3段階で練習します。'
      : modes.length
        ? count + '語 · ' + count * modes.length + '問（' + tq('#round-size').value + '問ずつ）'
        : '問題の種類を1つ以上選んでください。';
  tq('#create-class').disabled = (practiceFormat === 'classic' && !modes.length) || count < 4;
}
for (const input of document.querySelectorAll('[name=lesson-mode],#word-group,#round-size'))
  input.addEventListener('change', updateLessonOptions);
updateLessonOptions();
const restoreRecordsDialog = tq('#restore-records-dialog');
let restoreRecordsAction = null;
function renderTrash(data) {
  const panel = tq('#record-trash-list');
  panel.replaceChildren();
  if (!data.trash?.length) {
    panel.append(el('p', '回収箱は空です。'));
    return;
  }
  for (const item of data.trash) {
    const row = el('div', undefined, 'trash-row');
    row.append(
      el(
        'strong',
        item.scope === 'student' ? '出席番号 ' + item.label : 'クラス全員 · ' + item.count + '人',
      ),
      el('span', new Date(item.created).toLocaleString('ja-JP')),
    );
    const button = el('button', '記録を戻す', 'control-button');
    button.onclick = () => {
      if (recordsBusy) return;
      restoreRecordsAction = {
        classId: data.classroom.id,
        classTitle: data.classroom.title,
        trashId: item.id,
        confirm: true,
      };
      tq('#restore-records-target').textContent =
        data.classroom.title +
        ' · ' +
        (item.scope === 'student' ? '出席番号 ' + item.label : item.count + '人');
      tq('#restore-records-error').hidden = true;
      restoreRecordsDialog.showModal();
      tq('#restore-records-cancel').focus();
    };
    row.append(button);
    panel.append(row);
  }
}
tq('#restore-records-cancel').onclick = () => restoreRecordsDialog.close();
restoreRecordsDialog.addEventListener('cancel', (event) => {
  if (recordsBusy) event.preventDefault();
});
restoreRecordsDialog.addEventListener('close', () => {
  restoreRecordsAction = null;
});
tq('#restore-records-confirm').onclick = async () => {
  if (!restoreRecordsAction || recordsBusy) return;
  const action = { ...restoreRecordsAction };
  recordsBusy = true;
  refreshEpoch++;
  tq('#restore-records-confirm').disabled = true;
  tq('#restore-records-cancel').disabled = true;
  try {
    await teacherApi('records-restore', action);
    restoreRecordsDialog.close();
    tq('#records-result').textContent = '記録を戻しました。';
    interactionEffects.sound('save');
  } catch (e) {
    tq('#restore-records-error').textContent =
      e.message || '記録を戻せませんでした。もう一度お試しください。';
    tq('#restore-records-error').hidden = false;
  } finally {
    recordsBusy = false;
    tq('#restore-records-confirm').disabled = false;
    tq('#restore-records-cancel').disabled = false;
    refresh();
  }
};

// Contextual actions remain keyboard-accessible and close after use or an outside click.
const moreClassActions = tq('#more-class-actions');
moreClassActions.addEventListener('click', (event) => {
  if (event.target.closest('button,a')) moreClassActions.open = false;
});
document.addEventListener('click', (event) => {
  if (!moreClassActions.contains(event.target)) moreClassActions.open = false;
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && moreClassActions.open) {
    moreClassActions.open = false;
    moreClassActions.querySelector('summary').focus();
  }
});

const classLifecycleDialog = tq('#class-lifecycle-dialog');
let classLifecycleAction = null,
  classLifecycleBusy = false;
function confirmClassLifecycle(room, restore = false) {
  if (classLifecycleBusy || recordsBusy || !room || (!restore && room.active)) return;
  tq('#more-class-actions').open = false;
  classLifecycleAction = { classId: room.id, classTitle: room.title, confirm: true, restore };
  tq('#class-lifecycle-title').textContent = restore
    ? 'このクラスを戻しますか？'
    : 'このクラスを削除しますか？';
  tq('#class-lifecycle-target').textContent = room.title;
  tq('#class-lifecycle-description').textContent = restore
    ? 'クラスと保存された成績・進み具合を戻します。授業は終了した状態で戻り、現在の授業には影響しません。'
    : 'このクラスと成績・回答履歴をクラスの回収箱へ移します。後から戻せます。他のクラスは残ります。';
  tq('#class-lifecycle-error').hidden = true;
  tq('#class-lifecycle-confirm').textContent = restore ? 'クラスを戻す' : 'クラスを削除';
  classLifecycleDialog.showModal();
  tq('#class-lifecycle-cancel').focus();
}
function renderClassTrash(items) {
  tq('#class-trash-panel').hidden = !items.length;
  tq('#class-trash-count').textContent = items.length + '件';
  const panel = tq('#class-trash-list');
  panel.replaceChildren();
  for (const room of items) {
    const row = el('div', undefined, 'trash-row');
    row.append(
      el('strong', room.title),
      el('span', room.students + '人 · ' + new Date(room.deleted_at).toLocaleString('ja-JP')),
    );
    const button = el('button', 'クラスを戻す', 'control-button');
    button.onclick = () => confirmClassLifecycle(room, true);
    row.append(button);
    panel.append(row);
  }
}
tq('#delete-ended-class').onclick = () =>
  confirmClassLifecycle(classes.find((c) => c.id === classId));
tq('#class-lifecycle-cancel').onclick = () => classLifecycleDialog.close();
classLifecycleDialog.addEventListener('cancel', (event) => {
  if (classLifecycleBusy) event.preventDefault();
});
classLifecycleDialog.addEventListener('close', () => {
  classLifecycleAction = null;
});
tq('#class-lifecycle-confirm').onclick = async () => {
  if (!classLifecycleAction || classLifecycleBusy || recordsBusy) return;
  const action = { ...classLifecycleAction };
  classLifecycleBusy = true;
  recordsBusy = true;
  refreshEpoch++;
  tq('#class-lifecycle-confirm').disabled = true;
  tq('#class-lifecycle-cancel').disabled = true;
  try {
    await teacherApi(action.restore ? 'class-restore' : 'class-delete', action);
    if (!action.restore && classId === action.classId) {
      classId = null;
      lastData = null;
      selectedStudent = null;
      tq('#class-results').hidden = true;
    }
    await loadClasses();
    classLifecycleDialog.close();
    tq('#class-lifecycle-result').textContent =
      action.classTitle + (action.restore ? ' を戻しました。' : ' をクラスの回収箱に移しました。');
    interactionEffects.sound('save');
  } catch (e) {
    tq('#class-lifecycle-error').textContent =
      e.message || '変更できませんでした。もう一度お試しください。';
    tq('#class-lifecycle-error').hidden = false;
  } finally {
    classLifecycleBusy = false;
    recordsBusy = false;
    tq('#class-lifecycle-confirm').disabled = false;
    tq('#class-lifecycle-cancel').disabled = false;
    refresh();
  }
};

window.addEventListener('aomi-mode-settings-saved', () => {
  editorDefaultsLoaded = false;
  loadClasses().catch((e) => message(e.message, true));
});
