import { createClassroomIdentity } from './identity.mjs';
import { createClassroomTeacher } from './teacher.mjs';
import { createClassroomStudent } from './student.mjs';
export function createClassroomRoute(runtime) {
  const identity = createClassroomIdentity(runtime),
    teacher = createClassroomTeacher(runtime),
    student = createClassroomStudent(runtime);
  return async function classroomRoute(req, env, url) {
    if (url.pathname.startsWith('/api/teacher/')) return teacher(req, env, url);
    if (url.pathname.startsWith('/api/student/')) return student(req, env, url);
    return identity(req, env, url);
  };
}
