import { renderClassroomLink } from './shared/classroom-links.js';
window.aomiClassroomLink = renderClassroomLink;
import { createRequest } from './shared/request.js';
import { createRuntimeStatus } from './shared/runtime-status.js';
import { createConnectionNotice } from './shared/connection-notice.js';
window.aomiRuntimeStatus = createRuntimeStatus({ online: navigator.onLine });
const banner = document.createElement('div');
banner.className = 'connection-banner';
banner.setAttribute('role', 'status');
banner.hidden = true;
document.body.append(banner);
const updateNotice = createConnectionNotice({ banner });
function connection(ok) {
  window.aomiRuntimeStatus.connection(ok);
  updateNotice(ok);
}
window.addEventListener('offline', () => {
  window.aomiRuntimeStatus.online(false);
  connection(false);
});
window.addEventListener('online', () => {
  window.aomiRuntimeStatus.online(true);
  window.dispatchEvent(new CustomEvent('aomi-reconnect'));
});
window.aomiNetwork = { request: createRequest({ onConnection: connection }), connection };

// Measure the actual action footer so large text and iPad rotation cannot cover answers.
const footers = [...document.querySelectorAll('.bottom-bar, .feedback, .race-submit-row')];
if (footers.length && typeof ResizeObserver === 'function') {
  const observer = new ResizeObserver(() =>
    document.documentElement.style.setProperty(
      '--action-height',
      Math.max(...footers.map((footer) => footer.offsetHeight)) + 'px',
    ),
  );
  footers.forEach((footer) => observer.observe(footer));
}
