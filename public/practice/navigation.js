// Navigation may supersede a start request; saving on the server still finishes normally.
export function createPracticeNavigation({ start, showLesson, updateBusy, onSuperseded }) {
  let epoch = 0,
    activeEpoch = null;
  return {
    cancel() {
      epoch++;
    },
    async start(...args) {
      if (activeEpoch === epoch) return false;
      const version = ++epoch;
      activeEpoch = version;
      const request = start(...args);
      updateBusy();
      try {
        const lesson = await request;
        if (version !== epoch) {
          onSuperseded();
          return false;
        }
        if (!lesson) return false;
        showLesson(lesson);
        return true;
      } finally {
        if (activeEpoch === version) activeEpoch = null;
        updateBusy();
      }
    },
  };
}
