export function createPracticeScreens({
  $,
  getLesson,
  setLesson,
  getStudyIndex,
  getVocabulary,
  assignedWords,
  assignedUnit,
  spellingAllowed,
  dueReviews,
  startVocabularyQuiz,
  stopAudio,
  clearAttempt,
  svg,
  studyAudio,
  playWordAudio,
  appSettings,
  notify,
  classroom,
  interactionEffects,
}) {
  function renderStudyCard(direction = 1) {
    const studyIndex = getStudyIndex();
    stopAudio();
    const word = assignedWords()[studyIndex];
    const picture = $('#study-picture');
    $('.study-card').classList.toggle('has-picture', !!word.image);
    picture.hidden = !word.image;
    if (word.image) {
      picture.src = word.image;
      picture.alt = word.meaning + ' のイラスト';
      picture.onerror = () => {
        picture.hidden = true;
        $('.study-card').classList.remove('has-picture');
      };
    } else {
      picture.removeAttribute('src');
      picture.alt = '';
    }
    $('#study-position').textContent = `${studyIndex + 1} / ${assignedWords().length}`;
    $('#study-word').textContent = word.word;
    $('#study-meaning').textContent = word.meaning;
    $('#study-note').textContent = word.base
      ? `${word.base} の過去形${word.word === 'read' ? ' · 発音 /red/' : ''}`
      : {
          phrase: 'いくつかの単語を組み合わせた表現',
          family: '家族を表すことば',
          occupation: '職業を表すことば',
          adjective: '様子や特徴を表すことば',
        }[word.group] || '英語のことば';
    $('#study-example').textContent = word.example;
    $('#study-prev').disabled = studyIndex === 0;
    $('#study-next').textContent =
      studyIndex === assignedWords().length - 1 ? 'クイズを始める →' : '次の単語 →';
    interactionEffects.enter($('.study-card'), 'flip', direction);
  }
  function finishVocabularyQuiz() {
    let lesson = getLesson();
    const studyIndex = getStudyIndex(),
      vocabulary = getVocabulary();
    stopAudio();
    clearAttempt();
    $('#quiz-main').hidden = true;
    $('#lesson-complete').hidden = false;
    document.body.classList.add('course-finished');
    document.body.classList.remove('practice-picture', 'practice-rich');
    const round = lesson.lastRound;
    $('#complete-title').textContent = lesson.queue.length
      ? 'レッスンクリア！'
      : '今回の練習が終わりました！';
    $('#complete-stats').textContent = round
      ? `${round.correct} / ${round.answers} 正解${round.hints ? `（ヒント ${round.hints}問）` : ''} · +${round.xp} XP`
      : `${lesson.completed}問 · ${lesson.attempts}回答`;
    $('#complete-message').textContent = lesson.queue.length
      ? 'ここでひと休みしても大丈夫。続きは保存されています。'
      : 'できたことを確認して、苦手な単語を少しずつ復習しよう。';
    $('#course-again').textContent = lesson.queue.length
      ? '次のレッスンへ'
      : lesson.practiceMode === 'review'
        ? '通常の練習に戻る'
        : 'もう一度練習する';
    $('#review-selected').hidden = !!lesson.queue.length || !lesson.needsReview?.length;
    const list = $('#review-words');
    list.replaceChildren();
    const title = document.createElement('h2');
    title.textContent = lesson.needsReview?.length ? 'また確認してみよう' : '今回練習した単語';
    list.append(title);
    for (const term of [
      ...new Set(
        lesson.needsReview?.length
          ? lesson.needsReview.map((k) => k.split(':')[0])
          : round?.words || lesson.missed,
      ),
    ]) {
      const word = vocabulary.find((v) => v.word === term);
      const row = document.createElement('p');
      row.textContent = `${word.word} — ${word.meaning}`;
      row.translate = false;
      list.append(row);
    }
    try {
      localStorage.setItem(
        'aomiyalingo.unit4.lastResult',
        JSON.stringify({
          completed: lesson.completed,
          attempts: lesson.attempts,
          reviewed: lesson.missed,
          date: new Date().toISOString(),
        }),
      );
    } catch {}
    interactionEffects.enter($('#lesson-complete'));
    interactionEffects.pulse($('.complete-medal'), 'success');
    interactionEffects.celebrate();
    $('#complete-title').tabIndex = -1;
    $('#complete-title').focus();
  }
  function showCourseHome() {
    let lesson = getLesson();
    const studyIndex = getStudyIndex(),
      vocabulary = getVocabulary();
    stopAudio();
    lesson = classroom.current?.lesson || lesson;
    setLesson(lesson);
    $('#course-home .exercise-tag').textContent =
      assignedUnit() + ' · ' + assignedWords().length + ' WORDS';
    $('#start-screen').hidden = true;
    $('#quiz-main').hidden = true;
    $('#vocab-screen').hidden = true;
    $('#lesson-complete').hidden = true;
    $('#course-home').hidden = false;
    document.body.classList.remove(
      'at-home',
      'studying',
      'course-finished',
      'practice-picture',
      'practice-rich',
    );
    document.body.classList.add('on-path');
    $('#header-actions').hidden = false;
    const stage = lesson?.queue[0]?.stage || 1,
      rounds = lesson?.rounds || 1,
      done = lesson?.queue.length === 0;
    $('#course-overview').textContent = done
      ? '今回の練習は完了しました。単語帳で確認したり、もう一度練習できます。'
      : '1回に少しずつ。自分のペースで進もう。';
    const path = $('#course-path');
    path.replaceChildren();
    for (let i = 1; i <= rounds; i++) {
      const circle = document.createElement('span');
      circle.className =
        'path-node ' + (done || i < stage ? 'finished' : i === stage ? 'current' : '');
      circle.textContent = done || i < stage ? '✓' : String(i);
      circle.setAttribute(
        'aria-label',
        `レッスン ${i}${done || i < stage ? ' 完了' : i === stage ? ' 次のレッスン' : ''}`,
      );
      path.append(circle);
    }
    $('#stage-tag').textContent = done ? '練習完了' : `レッスン ${stage} / ${rounds}`;
    $('#stage-title').textContent = done ? 'よく頑張りました！' : '次の小さな一歩';
    if (!done && lesson.format === 'adaptive-four') {
      const band = lesson.queue[0]?.band || 0;
      $('#stage-title').textContent = [
        'ことばを覚えよう',
        '文の中で使ってみよう',
        '聞いて、思い出してみよう',
      ][band];
      $('#course-overview').textContent =
        'ことば → 文づくり → リスニング。答えに合わせてヒントを調整します。';
    }
    const tasks = lesson?.queue.filter((t) => t.stage === lesson.queue[0]?.stage).slice(0, 8) || [];
    $('#stage-description').textContent = done
      ? '苦手なところを確認してみよう。'
      : `残り${tasks.length}問${dueReviews(lesson) ? '＋復習' : ''}。途中で戻っても続きから再開できます。`;
    const panel = $('#stage-words');
    panel.replaceChildren();
    for (const term of [...new Set(tasks.map((t) => t.word))]) {
      const word = vocabulary.find((w) => w.word === term),
        card = document.createElement('div');
      card.className = 'stage-word';
      const strong = document.createElement('strong');
      strong.textContent = word.word;
      const meaning = document.createElement('span');
      meaning.textContent = word.meaning;
      const button = document.createElement('button');
      button.innerHTML = svg('speaker');
      button.setAttribute('aria-label', word.word + ' の発音を聞く');
      button.onclick = async () => {
        stopAudio();
        try {
          await playWordAudio(studyAudio, word, appSettings.values.voiceVolume / 100);
        } catch {
          notify('音声を再生できませんでした。');
        }
      };
      card.append(strong, meaning, button);
      panel.append(card);
    }
    $('#path-review').hidden = !done || !lesson.needsReview?.length;
    $('#extra-spelling').hidden = !done || !spellingAllowed();
    $('#course-continue').textContent = done
      ? lesson.practiceMode === 'review'
        ? '通常の練習に戻る'
        : 'もう一度練習する'
      : lesson?.attempts || classroom.draft(lesson?.queue[0]?.id)
        ? '続きから始める'
        : 'レッスンを始める';
    $('#course-continue').onclick = () => {
      document.body.classList.remove('on-path');
      startVocabularyQuiz(
        done && lesson?.practiceMode === 'review' ? null : lesson?.practiceMode,
        done,
      );
    };
    interactionEffects.enter($('#course-home'));
  }
  return { renderStudyCard, finishVocabularyQuiz, showCourseHome };
}
