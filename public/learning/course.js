import { lessonEngine } from './lesson.js';
import { learningDiagnostics } from './diagnostics.js';
import { practiceEngine } from './practice.js';
// One model is bundled for the browser and imported by the Worker.
export const course = { ...lessonEngine, ...learningDiagnostics, ...practiceEngine };
