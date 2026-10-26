'use strict';
(() => {
  const q = (s) => document.querySelector(s);
  const destinations = { practice: '/teacher', race: '/race-teacher' };
  function showChooser() {
    q('#teacher-access').hidden = true;
    q('#mode-chooser').hidden = false;
    q('#teacher-account-settings').hidden = false;
    q('#teacher-logout').hidden = false;
    const target = destinations[new URLSearchParams(location.search).get('next')];
    if (target) return location.replace(target);
    q('#chooser-title').focus();
    interactionEffects.enter(q('#mode-chooser'));
  }
  q('#teacher-form').onsubmit = async (event) => {
    event.preventDefault();
    q('#teacher-submit').disabled = true;
    q('#teacher-error').hidden = true;
    try {
      await aomiNetwork.request('/api/teacher/login', { password: q('#teacher-password').value });
      q('#teacher-password').value = '';
      showChooser();
      interactionEffects.sound('welcome');
    } catch (error) {
      q('#teacher-error').textContent = error.message;
      q('#teacher-error').hidden = false;
    } finally {
      q('#teacher-submit').disabled = false;
    }
  };
  q('#teacher-logout').onclick = async () => {
    const button = q('#teacher-logout');
    button.disabled = true;
    try {
      await aomiNetwork.request('/api/teacher/logout', {});
      location.replace('/');
    } catch (error) {
      q('#teacher-logout-error').hidden = false;
      q('#teacher-logout-error').textContent = error.message;
    } finally {
      button.disabled = false;
    }
  };
  aomiNetwork
    .request('/api/teacher/session')
    .then(showChooser)
    .catch((error) => {
      if (error.status !== 401) {
        q('#teacher-error').textContent = error.message;
        q('#teacher-error').hidden = false;
      }
    });
})();
