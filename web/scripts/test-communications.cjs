// Run only against a disposable local environment seeded by
// backend/scripts/seed-comm-fixtures.cjs. No API or media transport mocks.
const { chromium, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const fixtureFile = process.env.COMMUNICATION_FIXTURES;
const baseURL = process.env.COMMUNICATION_BASE_URL || 'http://127.0.0.1:3310';
const output = process.env.COMMUNICATION_ARTIFACTS;
const tones = process.env.COMMUNICATION_TONES;
if (!fixtureFile || !output || !tones || !['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname)) {
  throw new Error('Disposable localhost fixtures, artifacts directory and synthetic tones are required');
}
const fixtures = JSON.parse(fs.readFileSync(fixtureFile, 'utf8'));
fs.mkdirSync(output, { recursive: true });
const results = { testEnvironment: 'disposable local source build; real Nest/Postgres/Redis/WebSocket/LiveKit; synthetic users and hardware', scenarios: [] };
const run = String(Date.now());

async function browser(role) {
  return chromium.launch({ headless: true, args: [
    '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
    `--use-file-for-fake-audio-capture=${path.join(tones, role + '.wav')}`,
    '--autoplay-policy=no-user-gesture-required',
  ] });
}
async function context(browser, user) {
  const ctx = await browser.newContext({ baseURL, permissions: ['microphone', 'camera'], viewport: { width: 1365, height: 900 } });
  await ctx.addCookies([
    { name: 'sq_at', value: user.accessToken, url: baseURL, httpOnly: true, sameSite: 'Lax' },
    { name: 'sq_rt', value: user.refreshToken, url: baseURL, httpOnly: true, sameSite: 'Lax' },
  ]);
  await ctx.addInitScript(() => {
    window.__communicationPeers = [];
    const Native = window.RTCPeerConnection;
    window.RTCPeerConnection = new Proxy(Native, {
      construct(Target, args) {
        const peer = new Target(...args);
        window.__communicationPeers.push(peer);
        return peer;
      },
    });
  });
  return ctx;
}
async function stats(page) {
  return page.evaluate(async () => {
    const inbound = [];
    const sending = [];
    for (const pc of window.__communicationPeers) {
      if (pc.connectionState === 'closed') continue;
      const records = await pc.getStats();
      records.forEach((r) => {
        if (r.type === 'inbound-rtp') inbound.push({ kind: r.kind, bytes: r.bytesReceived || 0, packets: r.packetsReceived || 0, frames: r.framesDecoded || 0, energy: r.totalAudioEnergy || 0 });
      });
      for (const sender of pc.getSenders()) if (sender.track) sending.push({ kind: sender.track.kind, enabled: sender.track.enabled, state: sender.track.readyState });
    }
    const audio = document.querySelector('audio[aria-label="Аудио собеседника"]');
    const video = document.querySelector('video[aria-label="Видео собеседника"]');
    return { inbound, sending, remoteAudioTracks: audio?.srcObject?.getAudioTracks().filter(t => t.readyState === 'live').length || 0, audioPlaying: audio ? !audio.paused : false, videoWidth: video?.videoWidth || 0, videoHeight: video?.videoHeight || 0, videoReady: video?.readyState || 0 };
  });
}
const sum = (snapshot, kind, field) => snapshot.inbound.filter(r => r.kind === kind).reduce((n, r) => n + r[field], 0);
async function send(page, peer, message) {
  await page.getByLabel('Сообщение', { exact: true }).fill(message);
  await expect(page.getByRole('button', { name: 'Отправить', exact: true })).toBeEnabled({ timeout: 20000 });
  await page.getByRole('button', { name: 'Отправить', exact: true }).click();
  await expect(peer.getByRole('log', { name: 'Переписка' }).getByText(message, { exact: true })).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole('log', { name: 'Переписка' }).getByText(message, { exact: true })).toHaveCount(1);
}
async function readyMedia(page, format) {
  await expect.poll(async () => (await stats(page)).remoteAudioTracks, { timeout: 30000 }).toBeGreaterThan(0);
  await expect.poll(async () => sum(await stats(page), 'audio', 'packets'), { timeout: 30000 }).toBeGreaterThan(10);
  await expect.poll(async () => sum(await stats(page), 'audio', 'energy'), { timeout: 30000 }).toBeGreaterThan(0);
  if (format === 'video') {
    await expect.poll(async () => (await stats(page)).videoWidth, { timeout: 30000 }).toBeGreaterThan(0);
    await expect.poll(async () => sum(await stats(page), 'video', 'frames'), { timeout: 30000 }).toBeGreaterThan(5);
  } else {
    assert.equal((await stats(page)).sending.some(t => t.kind === 'video' && t.state === 'live'), false, 'Audio call must not activate a camera');
  }
}
(async () => {
  const clientBrowser = await browser('client');
  const expertBrowser = await browser('expert');
  try {
    for (const format of ['chat', 'audio', 'video']) {
      const fixture = fixtures.scenarios[format];
      const clientContext = await context(clientBrowser, fixtures.client);
      const expertContext = await context(expertBrowser, fixture.expert);
      const client = await clientContext.newPage();
      const expert = await expertContext.newPage();
      const result = { format, passed: false, steps: [] };
      results.scenarios.push(result);
      const errors = [];
      for (const page of [client, expert]) page.on('pageerror', e => errors.push(e.name + ': ' + e.message.replace(/eyJ[\w.-]+/g, '[TOKEN]')));
      try {
        await Promise.all([client.goto(fixture.clientPath), expert.goto(fixture.expertPath)]);
        await Promise.all([client.waitForLoadState('networkidle'), expert.waitForLoadState('networkidle')]);
        await send(client, expert, `${run} ${format} client to expert`);
        await send(expert, client, `${run} ${format} expert to client`);
        result.steps.push('bidirectional real WebSocket messages, one copy each');
        if (format === 'chat') {
          await Promise.all([client.reload(), expert.reload()]);
          await expect(client.getByRole('log').getByText(`${run} chat expert to client`, { exact: true })).toBeVisible();
          await expect(expert.getByRole('log').getByText(`${run} chat client to expert`, { exact: true })).toBeVisible();
          result.steps.push('history persists after both participants reload');
        } else {
          await expect(client.getByRole('button', { name: 'Подключиться', exact: true })).toBeEnabled();
          await expect(expert.getByRole('button', { name: 'Подключиться', exact: true })).toBeEnabled();
          await Promise.all([
            client.getByRole('button', { name: 'Подключиться', exact: true }).click(),
            expert.getByRole('button', { name: 'Подключиться', exact: true }).click(),
          ]);
          await Promise.all([readyMedia(client, format), readyMedia(expert, format)]);
          result.media = { client: await stats(client), expert: await stats(expert) };
          result.steps.push('nonzero inbound audio energy and packets on both peers');
          if (format === 'video') result.steps.push('decoded video frames and rendered remote video on both peers');
          for (const page of [client, expert]) {
            await page.getByRole('button', { name: 'Микрофон включён', exact: true }).click();
            await expect(page.getByRole('button', { name: 'Микрофон выключен', exact: true })).toHaveAttribute('aria-pressed', 'false');
            await expect.poll(async () => (await stats(page)).sending.some(t => t.kind === 'audio' && t.enabled && t.state === 'live')).toBe(false);
            await page.getByRole('button', { name: 'Микрофон выключен', exact: true }).click();
            await expect.poll(async () => (await stats(page)).sending.some(t => t.kind === 'audio' && t.enabled && t.state === 'live')).toBe(true);
            if (format === 'video') {
              await page.getByRole('button', { name: 'Камера включена', exact: true }).click();
              await expect(page.getByRole('button', { name: 'Камера выключена', exact: true })).toHaveAttribute('aria-pressed', 'false');
              await page.getByRole('button', { name: 'Камера выключена', exact: true }).click();
              await expect(page.getByRole('button', { name: 'Камера включена', exact: true })).toHaveAttribute('aria-pressed', 'true');
            }
          }
          result.steps.push('microphone controls affect real local tracks for both participants');
          if (format === 'video') {
            for (const page of [client, expert]) {
              const frames = sum(await stats(page), 'video', 'frames');
              await expect.poll(async () => sum(await stats(page), 'video', 'frames'), { timeout: 20000 }).toBeGreaterThan(frames + 5);
              await expect.poll(async () => (await stats(page)).videoWidth).toBeGreaterThan(0);
            }
            result.steps.push('video resumes with new decoded frames after both cameras toggle');
          }
          await Promise.all([client.screenshot({ path: path.join(output, format + '-client.png'), fullPage: true }), expert.screenshot({ path: path.join(output, format + '-expert.png'), fullPage: true })]);
          await client.getByRole('button', { name: 'Выйти из звонка', exact: true }).click();
          await expect.poll(async () => (await stats(expert)).remoteAudioTracks, { timeout: 15000 }).toBe(0);
          await client.getByRole('button', { name: 'Подключиться', exact: true }).click();
          await Promise.all([readyMedia(client, format), readyMedia(expert, format)]);
          result.steps.push('client leaves; expert loses remote track; client rejoins and both receive media again');
        }
        await expert.getByLabel('Исход консультации').selectOption('COMPLETED');
        await expert.getByRole('button', { name: 'Завершить консультацию', exact: true }).click();
        await expert.getByRole('button', { name: 'Подтвердить завершение', exact: true }).click();
        await expect(expert.getByText('Консультация завершена', { exact: true })).toBeVisible({ timeout: 20000 });
        await expect(client.getByRole('button', { name: 'Отправить', exact: true })).toHaveCount(0, { timeout: 20000 });
        const completed = await client.evaluate(async (id) => {
          const response = await fetch(`/api/proxy/consultations/${id}`);
          if (!response.ok) throw new Error('Completion verification HTTP ' + response.status);
          return response.json();
        }, fixture.consultationId);
        assert.equal(completed.status, 'COMPLETED');
        assert.equal(completed.paymentStatus, 'CAPTURED');
        result.completion = { status: completed.status, paymentStatus: completed.paymentStatus };

        if (format !== 'chat') {
          for (const page of [client, expert]) {
            await expect.poll(async () => (await stats(page)).sending.some(t => t.state === 'live'), { timeout: 20000 }).toBe(false);
            await expect(page.getByRole('button', { name: 'Подключиться', exact: true })).toHaveCount(0);
          }
        }
        result.steps.push('expert completes consultation; client becomes read-only automatically; both media senders stop');
        assert.deepEqual(errors, [], 'No uncaught browser errors');
        result.passed = true;
      } catch (error) {
        result.error = error.message.replace(/eyJ[\w.-]+/g, '[TOKEN]');
        result.pageErrors = errors;
        result.mediaAtFailure = { client: await stats(client), expert: await stats(expert) };
        result.visibleAlerts = { client: await client.getByRole('alert').allTextContents().catch(() => []), expert: await expert.getByRole('alert').allTextContents().catch(() => []) };
        await client.screenshot({ path: path.join(output, format + '-failed-client.png'), fullPage: true }).catch(() => {});
        await expert.screenshot({ path: path.join(output, format + '-failed-expert.png'), fullPage: true }).catch(() => {});
      } finally {
        fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
        await clientContext.close(); await expertContext.close();
      }
      console.log(format, result.passed ? 'PASS' : 'FAIL', result.steps.join('; '));
    }
  } finally { await clientBrowser.close(); await expertBrowser.close(); }
  if (results.scenarios.some(r => !r.passed)) process.exitCode = 1;
})().catch(error => { console.error(error.message); process.exitCode = 1; });
