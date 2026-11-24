// Optional browser checks. Uses an isolated in-memory database, never the live site.
import http from 'node:http';
import { Readable } from 'node:stream';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
import { database } from '../tests/database.mjs';

const options = new Map(
  process.argv.slice(2).map((value) => {
    const split = value.indexOf('=');
    return split < 0 ? [value, true] : [value.slice(0, split), value.slice(split + 1)];
  }),
);
const require = createRequire(options.get('--playwright-package') || import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  throw Error('Optional browser tooling is missing. See docs/browser-compatibility.md.');
}
const output = path.resolve(options.get('--output-dir') || 'output/browser-compatibility');
await mkdir(output, { recursive: true });
const password = crypto.randomUUID();
const env = { DB: database(), TEACHER_PASSWORD: password };
const server = http.createServer(async (request, response) => {
  try {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const result = await worker.fetch(
      new Request(base + request.url, {
        method: request.method,
        headers: request.headers,
        ...(['GET', 'HEAD'].includes(request.method) ? {} : { body: Buffer.concat(chunks) }),
      }),
      env,
    );
    response.writeHead(result.status, Object.fromEntries(result.headers));
    if (result.body) Readable.fromWeb(result.body).pipe(response);
    else response.end();
  } catch {
    response.writeHead(500);
    response.end('Local browser fixture failed');
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = 'http://127.0.0.1:' + server.address().port;
const report = { date: new Date().toISOString(), engines: [], deviceVerified: false };
function instrument() {
  window.__compatMedia = { attempted: [], played: [], properties: [], effects: 0 };
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    window.__compatMedia.attempted.push(this.src);
    return play.call(this).then(() => {
      window.__compatMedia.played.push(this.src);
      window.__compatMedia.properties.push({ rate: this.playbackRate, volume: this.volume });
    });
  };
  const Context = window.AudioContext || window.webkitAudioContext;
  if (Context) {
    const create = Context.prototype.createBufferSource;
    Context.prototype.createBufferSource = function () {
      const source = create.call(this),
        start = source.start;
      source.start = function (...args) {
        window.__compatMedia.effects++;
        return start.apply(this, args);
      };
      return source;
    };
  }
}
async function audioCheck(page) {
  await page.waitForFunction(() => window.__compatMedia.played.length > 0);
  return page.evaluate(() => ({
    attemptedBlob: window.__compatMedia.attempted.some((s) => s.startsWith('blob:')),
    playedBlob: window.__compatMedia.played.some((s) => s.startsWith('blob:')),
    playedOriginal: window.__compatMedia.played.some((s) =>
      new URL(s).pathname.startsWith('/assets/words/'),
    ),
  }));
}
try {
  for (const name of ['chrome', 'webkit']) {
    const type = name === 'chrome' ? playwright.chromium : playwright.webkit;
    const browser = await type.launch(
      name === 'chrome'
        ? {
            headless: true,
            ...(options.get('--chrome-executable')
              ? { executablePath: options.get('--chrome-executable') }
              : { channel: 'chrome' }),
          }
        : { headless: true },
    );
    const result = { engine: name, version: browser.version(), practice: [], pageErrors: [] };
    report.engines.push(result);
    const teacher = await browser.newContext();
    async function call(url, data) {
      const response = await teacher.request[data === undefined ? 'get' : 'post'](
        base + url,
        data === undefined ? {} : { data },
      );
      assert(response.ok(), url + ' ' + (await response.text()));
      return response.json();
    }
    async function student() {
      const context = await browser.newContext({
        viewport: { width: 768, height: 1024 },
        ...(name === 'webkit' ? { isMobile: true, hasTouch: true } : {}),
      });
      await context.addInitScript(instrument);
      const page = await context.newPage();
      page.on('pageerror', (e) => result.pageErrors.push(e.message));
      return { context, page };
    }
    try {
      const login = await teacher.request.post(base + '/api/teacher/login', { data: { password } });
      assert(login.ok());
      await teacher.addCookies([
        {
          name: 'aomi_teacher',
          value: login.headers()['set-cookie'].match(/aomi_teacher=([^;]+)/)[1],
          url: base,
          secure: false,
          httpOnly: true,
          sameSite: 'Strict',
        },
      ]);
      for (const mode of ['text', 'voice', 'spelling']) {
        const room = await call('/api/teacher/classes', {
          title: name + ' ' + mode,
          grade: 5,
          unit: '1',
          format: 'classic',
          modes: [mode],
          roundSize: 4,
        });
        const { context, page } = await student();
        let failedAudio = null;
        const downloads = new Map();
        if (mode === 'text')
          await page.route(/\/assets\/words\/[^?]+\.(wav|mp3)(?:\?|$)/, async (route) => {
            const url = route.request().url();
            if (route.request().resourceType() !== 'fetch') return route.continue();
            downloads.set(url, (downloads.get(url) || 0) + 1);
            if (!failedAudio) {
              failedAudio = url;
              return route.abort();
            }
            return route.continue();
          });
        await page.goto(base + '/?student=1&class=' + room.id);
        await page.locator('#attendance-number').fill('21');
        await page.locator('#join-submit').click();
        await page.locator('#join-submit').click();
        await page.locator('#course-home').waitFor({ state: 'visible' });
        if (mode === 'text') {
          await page.waitForFunction(() => window.aomiAudioPreparation.state.retrying);
          assert.equal(await page.locator('#course-continue').isDisabled(), true);
          assert.match(await page.locator('.audio-preparation p').textContent(), /\d+ \/ \d+/);
          await page.screenshot({
            path: path.join(output, name + '-preparing.png'),
            fullPage: true,
          });
        }
        await page.waitForFunction(() => window.aomiAudioPreparation.state.ready);
        if (mode === 'text')
          assert.equal(downloads.get(failedAudio), 2, 'Failed audio retries automatically');
        await page.locator('#course-continue').click();
        await page.locator('#quiz-main').waitFor({ state: 'visible' });
        const session = await page.evaluate(() =>
          JSON.parse(localStorage.getItem('aomiyalingo.classroom.session')),
        );
        const auth = { authorization: 'Bearer ' + session.token };
        const me = await (
          await context.request.get(base + '/api/student/me', { headers: auth })
        ).json();
        assert.equal(me.lesson.queue[0].mode, mode);
        for (const viewport of [
          { width: 768, height: 1024 },
          { width: 1024, height: 768 },
        ]) {
          await page.setViewportSize(viewport);
          await page.waitForTimeout(80);
          assert(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
            name + ' ' + mode + ' overflow',
          );
        }
        await page.locator('#settings-open').click();
        await page.locator('#interface-language').selectOption('en');
        assert.equal(await page.locator('html').getAttribute('lang'), 'en');
        await page.locator('#settings-done').click();
        const row = { mode, rotation: true, languageSwitch: true };
        if (mode === 'voice') {
          await page.locator('#audio-play').click();
          row.audio = await audioCheck(page);
        }
        if (mode === 'spelling') {
          for (const letter of me.lesson.queue[0].word.replace(/[^a-z]/gi, '')) {
            const buttons = page.locator('#letter-bank button:not([disabled])');
            const index = (await buttons.allTextContents()).findIndex(
              (value) => value.toLowerCase() === letter.toLowerCase(),
            );
            assert(index >= 0);
            await buttons.nth(index).click();
          }
        } else await page.locator('#answers .answer').first().click();
        let answerAttempts = 0;
        if (mode === 'text')
          await page.route('**/api/student/answer', async (route) => {
            if (++answerAttempts === 1) {
              await route.fetch(); // The server saved it, but its acknowledgement was lost.
              return route.abort();
            }
            return route.continue();
          });
        if (mode === 'spelling') await context.setOffline(true);
        await page.locator('#submit').click();
        await page.locator('#feedback').waitFor({ state: 'visible' });
        if (mode === 'text' || mode === 'spelling') {
          await page.waitForFunction(
            (id) => !!localStorage.getItem('aomi.pending.' + id),
            session.id,
          );
          assert.equal(await page.locator('#join-dialog').isVisible(), false);
          if (mode === 'spelling') await context.setOffline(false);
          row[mode === 'spelling' ? 'offlineRetry' : 'lostAcknowledgementRetry'] = true;
        }
        await page.waitForFunction((id) => !localStorage.getItem('aomi.pending.' + id), session.id);
        const saved = await (
          await context.request.get(base + '/api/student/me', { headers: auth })
        ).json();
        assert.equal(saved.lesson.attempts, 1);
        if (mode === 'text') {
          assert.equal(answerAttempts, 2, 'Silent connection recovery replays once');
          row.failedAudioRecovery = true;
        }
        row.savedOnce = true;
        row.effects = await page.evaluate(() => ({
          supported: !!(window.AudioContext || window.webkitAudioContext),
          started: window.__compatMedia.effects,
        }));
        if (row.effects.supported) assert(row.effects.started > 0);
        if (mode === 'text') {
          await page.goto(base + '/race');
          await page.goBack();
          await page.waitForFunction(() => document.querySelector('#join-dialog')?.open === false);
          assert.equal(
            (
              await page.evaluate(() =>
                JSON.parse(localStorage.getItem('aomiyalingo.classroom.session')),
              )
            ).id,
            session.id,
          );
          row.historyRestore = true;
        }
        await page.screenshot({
          path: path.join(output, name + '-' + mode + '.png'),
          fullPage: true,
        });
        result.practice.push(row);
        await context.close();
      }
      const { raceId } = await call('/api/teacher/race/create', {
        title: name + ' race',
        grade: 5,
        unit: '1',
        format: 'classic',
        endless: true,
      });
      const first = await student();
      await first.page.goto(base + '/race?race=' + raceId);
      await first.page.locator('#race-number').fill('11');
      await first.page.locator('#join-race').click();
      await first.page.locator('#race-ready').waitFor({ state: 'visible' });
      await first.page.waitForFunction(() => window.aomiAudioPreparation.state.ready);
      await first.page.locator('#race-ready').click();
      const old = await first.page.evaluate(() =>
        JSON.parse(localStorage.getItem('aomi.race.session')),
      );
      await call('/api/teacher/race/state', { raceId, action: 'closeJoin' });
      const second = await student();
      await second.page.goto(base + '/race?race=' + raceId);
      await second.page.locator('#race-number').fill('11');
      await second.page.locator('#join-race').click();
      await second.page.locator('#race-reconnect').waitFor({ state: 'visible' });
      await second.page.locator('#race-reconnect').click();
      await second.page.locator('#race-play').waitFor({ state: 'visible' });
      await second.page.waitForFunction(() => window.aomiAudioPreparation.state.ready);
      assert.equal(
        (
          await teacher.request.get(base + '/api/race/me', {
            headers: { authorization: 'Bearer ' + old.token },
          })
        ).status(),
        401,
      );
      await first.page.locator('#race-reconnect').waitFor({ state: 'visible' });
      assert.equal(await first.page.locator('#race-number').inputValue(), '11');
      await call('/api/teacher/race/state', { raceId, action: 'start' });
      await second.page.locator('#race-audio').waitFor({ state: 'visible' });
      await second.page.locator('#race-audio').click();
      result.race = {
        reconnectClosedAdmission: true,
        revokedOldToken: true,
        audio: await audioCheck(second.page),
      };
      const played = await second.page.evaluate(() => window.__compatMedia.played.length);
      await second.page.locator('#race-slow').click();
      await second.page.waitForFunction(
        (count) => window.__compatMedia.played.length > count,
        played,
      );
      assert.equal(
        await second.page.evaluate(() => window.__compatMedia.properties.at(-1).rate),
        0.75,
      );
      result.race.slowPlayback = true;
      const live = await second.page.evaluate(() =>
        JSON.parse(localStorage.getItem('aomi.race.session')),
      );
      const raceAuth = { authorization: 'Bearer ' + live.token };
      const task = (
        await (
          await second.context.request.get(base + '/api/race/me', { headers: raceAuth })
        ).json()
      ).self.task;
      if (task.mode === 'spelling') {
        for (let i = 0; i < task.length; i++)
          await second.page.locator('#race-letters button:not([disabled])').first().click();
      } else await second.page.locator('#race-options button').first().click();
      const prompt = await second.page.locator('#race-prompt').textContent();
      let allowAnswer = false,
        raceAttempts = 0;
      await second.page.route('**/api/race/answer', async (route) => {
        if (++raceAttempts === 1) await route.fetch();
        if (!allowAnswer) return route.abort();
        return route.continue();
      });
      await second.page.locator('#race-submit').click();
      await second.page.locator('#race-save-error').waitFor({ state: 'visible' });
      await second.page.waitForTimeout(2500);
      assert.equal(await second.page.locator('#race-entry').isVisible(), false);
      assert.equal(
        await second.page.locator('#race-prompt').textContent(),
        prompt,
        'The pending question stays visible until its acknowledgement',
      );
      allowAnswer = true;
      await second.page.evaluate(() => window.dispatchEvent(new CustomEvent('aomi-reconnect')));
      await second.page.waitForFunction(
        () => JSON.parse(localStorage.getItem('aomi.race.pending')) === null,
      );
      const after = await (
        await second.context.request.get(base + '/api/race/me', { headers: raceAuth })
      ).json();
      assert.equal(
        after.self.history.length,
        1,
        'A lost race acknowledgement cannot award points twice',
      );
      result.race.lostAcknowledgementRetry = true;
      await second.page.screenshot({ path: path.join(output, name + '-race.png'), fullPage: true });
      await first.context.close();
      await second.context.close();
      assert.deepEqual(result.pageErrors, []);
      result.passed = true;
      console.log(name + ' browser checks passed (' + result.version + ')');
    } finally {
      await browser.close();
    }
  }
} finally {
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  await new Promise((resolve) => server.close(resolve));
}
