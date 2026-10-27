import {
  curriculumCatalog,
  curriculumProfile,
  curriculumValue,
} from '../../public/shared/curriculum.js';
export const gradeConfig = (config, grade, unit) =>
  curriculumProfile(config, curriculumValue(grade, unit));
export function selectedCurriculum(data) {
  const grade = data.grade ?? 6,
    unit = data.unit ?? (grade === 5 ? '5' : '4-5');
  return Object.values(curriculumCatalog).some(
    (entry) => entry.grade === grade && entry.unit === unit,
  )
    ? { grade, unit }
    : null;
}
