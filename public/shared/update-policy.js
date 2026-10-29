export const UPDATE_REPOSITORY = 'https://github.com/AomiyaKT/aomiyalingo';

export function releaseVersion(value) {
  if (typeof value !== 'string' || !/^v?\d{1,6}(?:\.\d{1,6}){0,2}$/.test(value)) return null;
  return value.replace(/^v/, '').split('.').map(Number).join('.');
}

export function compareVersions(a, b) {
  const left = releaseVersion(a),
    right = releaseVersion(b);
  if (!left || !right) return null;
  const x = left.split('.').map(Number),
    y = right.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((x[i] || 0) !== (y[i] || 0)) return Math.sign((x[i] || 0) - (y[i] || 0));
  }
  return 0;
}

export function updateDecision(clientVersion, result) {
  if (!releaseVersion(clientVersion) || !releaseVersion(result?.serverVersion))
    return 'unavailable';
  if (compareVersions(result.serverVersion, clientVersion) > 0) return 'reload';
  if (compareVersions(clientVersion, result.serverVersion) > 0) return 'server-older';
  if (!result.latest || !releaseVersion(result.latest.version)) return 'unavailable';
  if (compareVersions(result.latest.version, result.serverVersion) > 0)
    return 'awaiting-deployment';
  if (compareVersions(clientVersion, result.latest.version) > 0) return 'preview';
  return 'current';
}

export function hasUnsavedWork(state = {}) {
  return !!(state.pending || state.failed || state.dirty || state.saving);
}
