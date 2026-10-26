import { setAttributeIfChanged, setTextIfChanged } from '../shared/dom.js';

// Keep controls attached while polling: rebuilding a row also discards keyboard focus.
export function createTeacherRoster({ host, make, modeNames, onDetail, now = Date.now }) {
  const rows = new Map();
  let owner;

  function create(id) {
    const row = make('tr');
    const number = make('td', undefined, 'student-number');
    const progress = make('td');
    const count = make('strong');
    const bar = make('div', undefined, 'board-progress');
    const fill = make('span');
    bar.append(fill);
    progress.append(count, bar);
    const current = make('td');
    const attempts = make('td');
    const accuracy = make('td');
    const review = make('td');
    const activity = make('td');
    const actions = make('td');
    const button = make('button', '回答を見る', 'detail-button');
    button.onclick = () => onDetail(id);
    actions.append(button);
    row.append(number, progress, current, attempts, accuracy, review, activity, actions);
    return { row, number, count, fill, current, attempts, accuracy, review, activity, button };
  }

  function update(view, student, time) {
    setTextIfChanged(view.number, student.label);
    setTextIfChanged(view.count, student.completed + ' / ' + student.total);
    const width =
      (student.total > 0
        ? Math.min(100, Math.max(0, (student.completed / student.total) * 100))
        : 0) + '%';
    if (view.fill.style.width !== width) view.fill.style.width = width;
    setTextIfChanged(
      view.current,
      student.done
        ? '完了'
        : student.current
          ? (student.stage ? 'レッスン ' + student.stage + ' / ' + student.rounds + ' · ' : '') +
            modeNames[student.current.mode] +
            ' · ' +
            student.current.word
          : '単語を確認中',
    );
    setTextIfChanged(view.attempts, student.attempts);
    setTextIfChanged(
      view.accuracy,
      student.firstAccuracy === null ? '—' : student.firstAccuracy + '%',
    );
    const accuracyClass = student.firstAccuracy !== null && student.firstAccuracy < 60 ? 'bad' : '';
    if (view.accuracy.className !== accuracyClass) view.accuracy.className = accuracyClass;
    setTextIfChanged(
      view.review,
      student.needsHelp + ' / ' + student.corrected + ' / ' + (student.supported || 0),
    );
    const reviewClass = student.needsHelp ? 'bad' : 'good';
    if (view.review.className !== reviewClass) view.review.className = reviewClass;
    const age = time - student.lastSeen;
    setTextIfChanged(
      view.activity,
      age < 45000 ? '最近活動あり' : Math.floor(age / 60000) + '分前',
    );
    const activityClass = age < 45000 ? 'good' : '';
    if (view.activity.className !== activityClass) view.activity.className = activityClass;
    setAttributeIfChanged(view.button, 'aria-label', '出席番号 ' + student.label + ' の回答を見る');
  }

  return function renderRoster(classId, students) {
    if (owner !== classId) {
      owner = classId;
      rows.clear();
      host.replaceChildren();
    }
    const incoming = new Set(students.map((student) => student.id));
    for (const [id, view] of rows) {
      if (incoming.has(id)) continue;
      view.row.remove();
      rows.delete(id);
    }
    const time = now();
    students.forEach((student, index) => {
      let view = rows.get(student.id);
      if (!view) {
        view = create(student.id);
        rows.set(student.id, view);
      }
      update(view, student, time);
      if (host.children[index] !== view.row)
        host.insertBefore(view.row, host.children[index] || null);
    });
  };
}
