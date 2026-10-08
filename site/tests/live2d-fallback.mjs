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
    pending.set(id, (message) => message.error ? reject(new Error(message.error.message)) : resolve(message.result));
    socket.send(JSON.stringify({ id, method, params }));
  });
}

try {
  await new Promise((resolve) => socket.addEventListener('open', resolve, { once: true }));
  await command('Page.reload', { ignoreCache: true });

  let state;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    const result = await command('Runtime.evaluate', {
      expression: `(() => {
        const stage = document.querySelector('#live2dStage');
        const canvas = stage?.querySelector('canvas');
        return {
          status: stage?.dataset.live2dStatus,
          ready: stage?.dataset.live2dReady,
          modelAttached: Boolean(stage?._nanfengLive2DModel),
          canvasOpacity: canvas ? getComputedStyle(canvas).opacity : null,
        };
      })()`,
      returnByValue: true,
    });
    state = result.result?.value;
    if (state?.status && state.status !== 'loading-manifest' && state.status !== 'pending-cubism-export') break;
  }

  assert.equal(state?.status, 'needs-layer-rebuild', 'The unapproved model must stay out of the homepage');
  assert.equal(state.ready, 'false');
  assert.equal(state.modelAttached, false);
  assert.equal(state.canvasOpacity, '0');

  const route = await command('Runtime.evaluate', {
    expression: `(async () => {
      document.querySelector('#enterWork').click();
      await new Promise((resolve) => setTimeout(resolve, 600));
      return {
        state: document.body.dataset.state,
        introDisplay: getComputedStyle(document.querySelector('#introStage')).display,
      };
    })()`,
    awaitPromise: true,
    returnByValue: true,
  });
  assert.equal(route.result.value.state, 'intro', 'The entry video must remain accessible');
  assert.notEqual(route.result.value.introDisplay, 'none');
  console.log('Live2D fallback: incomplete model is hidden; entry video remains accessible');
} finally {
  socket.close();
}
