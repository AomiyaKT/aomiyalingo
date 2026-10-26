import { masterySummary } from './teacher-analysis-model.js';

export function createTeacherAnalysis({
  q: tq,
  make: el,
  modeNames,
  getVocabulary,
  getData,
  getSelectedStudent,
  getClassVocabulary,
  getConfiguredModes,
}) {
  let detailKey = null,
    masteryKey = null;
  function answerText(attempt) {
    try {
      const value = JSON.parse(attempt.answer);
      return Array.isArray(value) ? value.join(' / ') : (value?.value ?? value);
    } catch {
      return '—';
    }
  }
  function expected(attempt) {
    try {
      const value = JSON.parse(attempt.answer);
      if (value?.expected) return value.expected;
    } catch {}
    const word = getVocabulary().find((w) => w.word === attempt.word);
    return attempt.mode === 'text' ? word?.meaning || attempt.word : attempt.word;
  }
  function attemptRow(a) {
    const row = el('div', undefined, 'attempt-row ' + (a.correct ? 'right' : 'wrong'));
    row.append(
      el('span', '出席番号 ' + a.label, 'attempt-number'),
      el('strong', a.word),
      el('span', modeNames[a.mode] || a.mode, 'mode-tag'),
      el('span', a.correct ? '✓ 正解' : '× 不正解', a.correct ? 'good' : 'bad'),
      el('span', '回答：' + answerText(a)),
      el('span', a.hint_used ? 'ヒント使用' : '', 'hint-label'),
    );
    if (!a.correct) row.append(el('span', '正解：' + expected(a), 'expected-answer'));
    return row;
  }
  function renderDetail() {
    const lastData = getData(),
      selectedStudent = getSelectedStudent();
    const panel = tq('#student-detail');
    const student = lastData?.students.find((s) => s.id === selectedStudent);
    const list = student ? lastData.attempts.filter((a) => a.student_id === selectedStudent) : [];
    const adaptive = document.body.dataset.practiceFormat === 'adaptive-four';
    const key = JSON.stringify(
      student
        ? [
            lastData.classroom?.id,
            student.id,
            student.label,
            student.firstAccuracy,
            student.needsHelp,
            student.corrected,
            student.supported,
            student.skills,
            list,
            adaptive,
            getVocabulary(),
          ]
        : null,
    );
    if (key === detailKey) return;
    detailKey = key;
    panel.replaceChildren();
    if (!student) return;
    panel.append(el('h2', '出席番号 ' + student.label + ' · 回答履歴'));
    if (!list.length) panel.append(el('p', 'まだ回答がありません。'));
    const summary = el(
      'p',
      `初回正答率 ${student.firstAccuracy ?? '—'}% · 要復習 ${student.needsHelp} · 修正済み ${student.corrected} · ヒントで正解 ${student.supported || 0}`,
    );
    panel.append(summary);
    const matrix = el('div', undefined, 'skill-grid');
    for (const w of student.skills) {
      if (
        document.body.dataset.practiceFormat === 'adaptive-four' &&
        Object.values(w.modes).every((m) => m.state === 'unanswered')
      )
        continue;
      const row = el('div', undefined, 'skill-row');
      row.append(el('strong', w.word));
      for (const [mode, m] of Object.entries(w.modes)) {
        if (document.body.dataset.practiceFormat === 'adaptive-four' && m.state === 'unanswered')
          continue;
        row.append(
          el(
            'span',
            modeNames[mode] +
              '：' +
              { unanswered: '未回答', correct: '初回正解', corrected: '修正済み', wrong: '要復習' }[
                m.state
              ] +
              (m.latestHinted && m.state !== 'wrong'
                ? '（ヒントで正解）'
                : m.hinted
                  ? '（ヒント使用歴あり）'
                  : ''),
            'skill-' + m.state,
          ),
        );
      }
      matrix.append(row);
    }
    panel.append(matrix);
    for (const a of list) panel.append(attemptRow(a));
  }

  function renderMastery(students) {
    const panel = tq('#word-mastery');
    const adaptive = document.body.dataset.practiceFormat === 'adaptive-four';
    const rows = masterySummary(students, getClassVocabulary(), getConfiguredModes(), adaptive);
    const key = JSON.stringify([getData()?.classroom?.id, rows, students.length, adaptive]);
    if (key === masteryKey) return;
    masteryKey = key;
    panel.replaceChildren();
    if (!students.length) {
      panel.append(el('p', '回答が集まると、ことばや文づくりの理解度が表示されます。'));
      return;
    }
    for (const w of rows) {
      const row = el('div', undefined, 'skill-row');
      row.append(el('strong', w.word));
      for (const [mode, counts] of Object.entries(w.modes)) {
        row.append(
          el(
            'span',
            modeNames[mode] +
              ' · 初回正解 ' +
              counts.correct +
              ' / 要復習 ' +
              counts.wrong +
              ' / 修正 ' +
              counts.corrected +
              (adaptive ? '' : ' / 未回答 ' + counts.unanswered),
            counts.wrong ? 'bad' : '',
          ),
        );
      }
      panel.append(row);
    }
    if (!panel.childElementCount) panel.append(el('p', '回答が集まると理解度が表示されます。'));
  }
  return { attemptRow, renderDetail, renderMastery };
}
