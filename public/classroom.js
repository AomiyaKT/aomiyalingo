import { createClassroomSession } from './practice/classroom-session.js';
const classroom = createClassroomSession({
  page: document,
  events: window,
  search: location.search,
  storage: {
    getItem: (key) => localStorage.getItem(key),
    setItem: (key, value) => localStorage.setItem(key, value),
    removeItem: (key) => localStorage.removeItem(key),
  },
  legacyStorage: {
    getItem: (key) => sessionStorage.getItem(key),
    removeItem: (key) => sessionStorage.removeItem(key),
  },
  request: (...args) => aomiNetwork.request(...args),
  vocabulary,
  builtinVocabulary,
  enterStudent: () => window.enterApp('student'),
  goHome: () => window.goHome(),
  stopAudio: () => window.stopAudio?.(),
  onLessonSaved: () => window.dispatchEvent(new CustomEvent('aomi-practice-saved')),
});
Object.assign(globalThis, { classroom });
