// One durable answer slot per learner. Responses are scoped to the session that sent them.
export function createPracticeTransactions({
  getSession,
  isPaused,
  api,
  read,
  write,
  onSaving,
  onSaved,
  onError,
}) {
  let generation = 0,
    flight = null,
    unsent = null,
    nextLesson = null;
  const capture = () => ({ owner: getSession(), generation });
  const current = (request) => request.owner === getSession() && request.generation === generation;
  function restore() {
    generation++;
    flight = null;
    nextLesson = null;
    const session = getSession();
    unsent = session ? read('aomi.pending.' + session.id) : null;
  }
  async function flush() {
    if (!unsent || flight || isPaused() || !getSession()) return false;
    const request = { ...capture(), answer: unsent };
    flight = request;
    onSaving();
    try {
      const result = await api('student/answer', request.answer, request.owner.token);
      if (!current(request)) return false;
      nextLesson = request.owner.lesson = result.lesson;
      write('aomi.pending.' + request.owner.id, null);
      write('aomi.draft.' + request.owner.id, null);
      unsent = null;
      onSaved(result.lesson, 'answer');
      return true;
    } catch (error) {
      if (current(request)) onError(error, 'answer');
      return false;
    } finally {
      if (flight === request) flight = null;
    }
  }
  async function start(mode, reset = false, review = false) {
    const request = capture();
    if (!request.owner || flight || isPaused()) return null;
    if (unsent) {
      await flush();
      if (!current(request) || unsent || isPaused()) return null;
    }
    flight = request;
    try {
      const result = await api('student/start', { mode, reset, review }, request.owner.token);
      if (!current(request)) return null;
      request.owner.lesson = result.lesson;
      nextLesson = null;
      onSaved(result.lesson, 'start');
      return result.lesson;
    } catch (error) {
      if (current(request)) onError(error, 'start');
      return null;
    } finally {
      if (flight === request) flight = null;
    }
  }
  return {
    restore,
    flush,
    start,
    record(questionId, answer, hintUsed = false) {
      if (!getSession() || flight || unsent || isPaused()) return false;
      nextLesson = null;
      unsent = { questionId, answer, hintUsed };
      write('aomi.pending.' + getSession().id, unsent);
      void flush();
      return true;
    },
    get pending() {
      return !!flight;
    },
    get unsent() {
      return !!unsent;
    },
    get busy() {
      return !!flight || !!unsent;
    },
    takeLesson() {
      const value = nextLesson;
      nextLesson = null;
      return value;
    },
  };
}
