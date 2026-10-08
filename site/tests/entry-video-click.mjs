import assert from 'node:assert/strict';

const port = process.env.CODEX_CDP_PORT ?? '9225';
const tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const tab = tabs.find((item) => item.type === 'page' && item.url.includes('/site/'));
assert.ok(tab, 'Open the homepage in a Chrome debugging tab before running this test');

const socket = new WebSocket(tab.webSocketDebuggerUrl);
let sequence = 0;
const pending = new Map();
socket.onmessage = ({ data }) => {
  const message = JSON.parse(data);
  if (!pending.has(message.id)) return;
  pending.get(message.id)(message);
  pending.delete(message.id);
};

function command(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, (message) => message.error
      ? reject(new Error(message.error.message))
      : resolve(message.result));
    socket.send(JSON.stringify({ id, method, params }));
  });
}

try {
  await new Promise((resolve) => socket.addEventListener('open', resolve, { once: true }));
  await command('Page.reload', { ignoreCache: true });
  await new Promise((resolve) => setTimeout(resolve, 700));

  const result = await command('Runtime.evaluate', {
    expression: `(async () => {
      document.querySelector('#enterWork').click();
      await new Promise((resolve) => setTimeout(resolve, 850));
      const video = document.querySelector('#introVideo');
      return {
        state: document.body.dataset.state,
        introVisible: getComputedStyle(document.querySelector('#introStage')).display !== 'none',
        source: video.currentSrc,
        readyState: video.readyState,
        paused: video.paused,
      };
    })()`,
    awaitPromise: true,
    returnByValue: true,
  });

  const state = result.result.value;
  assert.equal(state.state, 'intro');
  assert.equal(state.introVisible, true);
  assert.match(state.source, /assets\/intro\/entry-intro\.mp4$/);
  assert.ok(state.readyState >= 2, `Video did not load: readyState=${state.readyState}`);
  assert.equal(state.paused, false, 'Entry video should be playing after clicking 探索更多');
  console.log('entry video click: route and playback are working');
} finally {
  socket.close();
}
