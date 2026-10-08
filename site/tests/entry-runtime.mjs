import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const port = process.env.CODEX_CDP_PORT ?? '9226';
const url = process.env.ENTRY_URL ?? 'http://127.0.0.1:8765/site/';
const tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const tab = tabs.find((item) => item.type === 'page');
assert.ok(tab, 'A Chrome debugging page is required');
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
  return new Promise((resolveCommand, reject) => {
    const id = ++sequence;
    pending.set(id, (message) => message.error ? reject(new Error(message.error.message)) : resolveCommand(message.result));
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  assert.equal(result.exceptionDetails, undefined, JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function until(expression, message) {
  for (let count = 0; count < 100; count++) {
    if (await evaluate(expression)) return;
    await new Promise((done) => setTimeout(done, 100));
  }
  assert.fail(message);
}
const output = resolve(import.meta.dirname, '../../output/react-entry');
mkdirSync(output, { recursive: true });
try {
  await new Promise((done) => socket.addEventListener('open', done, { once: true }));
  await command('Page.enable');
  await command('Network.enable');
  await command('Network.setCacheDisabled', { cacheDisabled: true });
  for (const [width, height] of [[1920, 1080], [2560, 1440]]) {
    await command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await command('Page.navigate', { url });
    await until('Boolean(document.querySelector("#enterWork"))', 'Homepage must mount');
    await until('document.querySelector("video")?.readyState >= 2', 'Homepage video must load');
    const media = await evaluate('(() => { const v=document.querySelector("video"); return {playing:!v.paused,loop:v.loop,muted:v.muted,width:v.videoWidth,height:v.videoHeight}; })()');
    assert.equal(media.playing, true);
    assert.equal(media.loop, true);
    assert.equal(media.muted, true);
    const before = await evaluate('document.querySelector(".entry-title-art").getAttribute("style")');
    await command('Input.dispatchMouseEvent', { type: 'mouseMoved', x: width * .65, y: height * .4 });
    await new Promise((done) => setTimeout(done, 500));
    const after = await evaluate('document.querySelector(".entry-title-art").getAttribute("style")');
    assert.notEqual(before, after, 'Title should visibly move');
    const layout = await evaluate(`(() => {
      const title=document.querySelector('.entry-title-art').getBoundingClientRect();
      const button=document.querySelector('#enterWork').getBoundingClientRect();
      const motto=document.querySelector('.entry-motto').getBoundingClientRect();
      const nav=document.querySelector('.entry-bottom-nav').getBoundingClientRect();
      const centerX=button.x+button.width/2, centerY=button.y+button.height/2;
      return {title:{x:title.x,right:title.right,bottom:title.bottom}, button:{y:button.y,bottom:button.bottom}, motto:{y:motto.y}, navHeight:nav.height, clickable:!!document.elementFromPoint(centerX,centerY)?.closest('#enterWork')};
    })()`);
    const screenshot = await command('Page.captureScreenshot', { format: 'png' });
    writeFileSync(resolve(output, `home-${width}.png`), Buffer.from(screenshot.data, 'base64'));
    assert.equal(layout.clickable, true, 'Explore must receive real pointer clicks');
    assert.ok(layout.button.y >= layout.title.bottom + 12, 'Explore must clear the title');
    assert.ok(layout.motto.y >= layout.button.bottom + 16, 'Motto must clear Explore');
    assert.ok(layout.navHeight <= height * .101, 'Bottom navigation must fit in 10% of the screen');
    console.log(`home ${width}x${height}: video ${media.width}x${media.height}, loop, title motion, button and navigation verified`);
  }
  await evaluate('document.querySelector("#enterWork").click()');
  await until('document.querySelector("#introVideo")?.readyState >= 2', 'Entrance video must load');
  assert.equal(await evaluate('!document.querySelector("#introVideo").paused'), true);
  assert.equal(await evaluate('document.querySelector("#introStage").innerText.trim()'), '');
  assert.equal(await evaluate('getComputedStyle(document.querySelector("#introVideo")).filter'), 'none');
  const introShot = await command('Page.captureScreenshot', { format: 'png' });
  writeFileSync(resolve(output, 'intro.png'), Buffer.from(introShot.data, 'base64'));
  await evaluate('(() => { const v=document.querySelector("#introVideo"); v.dispatchEvent(new Event("ended")); })()');
  await until('Boolean(document.querySelector("iframe"))', 'Ended video must hand off to the existing model page');
  await until('Boolean(document.querySelector("iframe")?.contentDocument?.querySelector("#sceneContainer"))', 'Existing model page must remain accessible');
  console.log('intro: playback, video-only view, no filter, natural ended transition to model verified');
} finally { socket.close(); }
