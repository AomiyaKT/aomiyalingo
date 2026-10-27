import { createRaceRules } from './server/race/rules.mjs';
import { createRaceRepository } from './server/race/repository.mjs';
import { createRaceService } from './server/race/service.mjs';
import { createTeacherRaceHandler } from './server/race/teacher.mjs';
import { createStudentRaceHandler } from './server/race/student.mjs';
import { createRaceGradingHandler } from './server/race/grading.mjs';

// One explicit composition root; handlers never depend on concatenation order.
export function createRaceRoute(runtime) {
  const rules = createRaceRules(runtime);
  const repository = createRaceRepository({ ...runtime, ...rules });
  const service = createRaceService({ ...runtime, ...rules, ...repository });
  const dependencies = { ...runtime, ...rules, ...repository, ...service };
  const grade = createRaceGradingHandler(dependencies);
  const teacherHandler = createTeacherRaceHandler(dependencies);
  const studentHandler = createStudentRaceHandler({ ...dependencies, grade });
  return (request, env, url) =>
    url.pathname.startsWith('/api/teacher/race/')
      ? teacherHandler(request, env, url)
      : studentHandler(request, env, url);
}
