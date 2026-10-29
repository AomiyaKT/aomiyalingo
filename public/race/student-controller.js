// One durable answer flight, bound to the credential and navigation epoch that
// sent it. Rendering stays in race.js; transport and recovery stay here.
export function createStudentRaceController({
  api,
  getSession,
  getEpoch,
  getPending,
  setPending,
  isBusy,
  onBusy,
  onAccepted,
  onError,
  onSynchronized,
}) {
  let flight = null;
  const current = (request) =>
    flight === request &&
    request.epoch === getEpoch() &&
    request.session.token === getSession()?.token;
  return {
    async submit() {
      if (flight || isBusy() || !getPending() || !getSession()?.token) return false;
      const request = { session: { ...getSession() }, epoch: getEpoch(), answer: getPending() };
      flight = request;
      onBusy(true);
      try {
        const result = await api('/api/race/answer', request.answer, true, request.session);
        if (!current(request)) return false;
        setPending(null);
        onAccepted(result);
        return true;
      } catch (error) {
        if (!current(request)) return false;
        onError(error);
        if ([400, 409, 423].includes(error.status)) {
          try {
            const latest = await api('/api/race/me', undefined, true, request.session);
            if (!current(request)) return false;
            const retry =
              latest.self.task?.id === request.answer.questionId && latest.race.status === 'paused';
            setPending(retry ? request.answer : null);
            onSynchronized(latest, !retry);
          } catch {
            if (current(request)) setPending(request.answer);
          }
        }
        return false;
      } finally {
        if (flight === request) {
          flight = null;
          onBusy(false);
        }
      }
    },
    invalidate() {
      const active = !!flight;
      flight = null;
      if (active) onBusy(false);
    },
  };
}
