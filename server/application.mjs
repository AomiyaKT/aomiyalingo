import { createWorker } from '../worker.mjs';
import { course } from '../public/learning/course.js';
import { curriculumLabel, spellingCharacters } from '../public/shared/curriculum.js';
import { createConfigurationStore } from './editor/configuration.mjs';
import { gradeConfig, selectedCurriculum } from './editor/curriculum.mjs';
import { createEditorRoute } from '../editor-server.mjs';
import * as infrastructure from './classroom/infrastructure.mjs';
import { createClassroomLessons } from './classroom/lessons.mjs';
import { createClassroomAuth } from './classroom/auth.mjs';
import { createClassroomRoute } from './classroom/routes.mjs';
import { createRaceRoute } from '../race-server.mjs';

// The application owns service composition. The build supplies immutable content only.
export function createApplication({
  words,
  gradeFiveVocabulary,
  unitSevenVocabulary,
  raceAvatarCatalog,
  assets,
}) {
  const { stmt, json } = infrastructure;
  const configuration = createConfigurationStore({
    words,
    gradeFiveVocabulary,
    unitSevenVocabulary,
    stmt,
  });
  const auth = createClassroomAuth(infrastructure);
  const lessons = createClassroomLessons({ words, course, json });
  const runtime = {
    ...infrastructure,
    ...auth,
    ...configuration,
    ...lessons,
    words,
    course,
    selectedCurriculum,
    gradeConfig,
    curriculumLabel,
    spellingCharacters,
    raceAvatarCatalog,
  };
  return createWorker({
    assets,
    json,
    authRoute: auth.authRoute,
    classroomRoute: createClassroomRoute(runtime),
    editorRoute: createEditorRoute(runtime),
    raceRoute: createRaceRoute(runtime),
  });
}
