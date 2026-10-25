import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const root = process.cwd();
const out = path.join(root, 'source/reviews/lion-mini-games/2026-10-26');
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const report = { directFile: true, checks: [], screenshots: [] };
async function shot(name) {
  await page.screenshot({ path: path.join(out, name), fullPage: true });
  report.screenshots.push(name);
}
async function check(condition, message) {
  assert.ok(await condition, message);
  report.checks.push(message);
}
try {
  const startTime = new Date('2026-10-26T12:00:00Z');
  await page.clock.install({ time: startTime });
  await page.clock.pauseAt(startTime);
  await page.goto(pathToFileURL(path.join(root, 'source/design/lion-mini-games/index.html')).href);
  await page.waitForFunction(() => document.body.dataset.ready === 'true');
  await check(page.locator('[data-game]').count().then(n => n === 2), '两个独立游戏入口可用');
  await check(page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), '1920 桌面无横向溢出');
  await shot('01-menu-1920.png');
  await page.locator('#character-open').click();
  await check(page.locator('#character-dialog').isVisible(), '角色设定可打开');
  await shot('02-character.png');
  await page.keyboard.press('Escape');
  await check(page.locator('#character-dialog').isHidden(), 'Escape 关闭角色设定');
  await page.locator('[data-game="rhythm"]').click();
  await page.clock.runFor(2000);
  await shot('03-rhythm.png');
  await page.locator('#character-open').click();
  await page.keyboard.press('Shift+Tab');
  await check(page.evaluate(() => document.activeElement.id === 'character-close' && document.querySelectorAll('.modal:not([hidden])').length === 1), '游戏中角色设定独占焦点，不进入底层暂停框');
  await page.keyboard.press('Escape');
  await check(page.locator('#pause-dialog').isVisible(), '关闭角色设定回到暂停状态');
  await page.locator('#resume-button').click();
  await page.locator('#pause-button').click();
  const pausedProgress = await page.locator('#game-progress-fill').getAttribute('style');
  await page.clock.runFor(2000);
  await check(page.locator('#game-progress-fill').getAttribute('style').then(value => value === pausedProgress), '暂停时可见游戏进度保持');
  await page.locator('#resume-button').click();
  await page.clock.runFor(2000);
  await check(page.locator('#game-progress-fill').getAttribute('style').then(value => value !== pausedProgress), '恢复后可见游戏进度继续');
  await page.keyboard.press('Space');
  await page.keyboard.down('Space');
  await page.clock.runFor(1300);
  await page.keyboard.up('Space');
  await page.clock.runFor(26000);
  await check(page.locator('#result-dialog').isVisible(), '节奏游戏自然结算');
  await shot('04-rhythm-result.png');
  await page.locator('#replay-button').click();
  await page.clock.runFor(4000);
  for (let beat = 0; beat < 18; beat++) {
    await page.keyboard.press('Space');
    if (beat === 11) {
      await page.clock.runFor(380);
      await shot('13-rhythm-picking.png');
      await page.clock.runFor(770);
    } else if (beat < 17) await page.clock.runFor(1150);
  }
  await page.clock.runFor(1800);
  await check(page.locator('#result-stats').innerText().then(value => value.includes('18 / 18')), '真实键盘操作能完成十八拍满命中');
  await shot('09-rhythm-success.png');
  await page.locator('#result-menu').click();
  await page.locator('[data-game="poles"]').click();
  await page.clock.runFor(1200);
  await shot('05-poles.png');
  await page.keyboard.down('Space');
  await page.clock.runFor(350);
  await page.locator('#pause-button').click();
  await page.keyboard.up('Space');
  await page.locator('#resume-button').click();
  await page.clock.runFor(200);
  await check(page.evaluate(() => window.LionArcade.preview.activeGame.debug.phase === 'ready'), '蓄力中暂停并松键保持准备状态');
  await page.keyboard.down('Space');
  await page.clock.runFor(700);
  await page.keyboard.up('Space');
  await page.clock.runFor(1800);
  await shot('06-poles-after-jump.png');
  await page.clock.runFor(65000);
  await check(page.locator('#result-dialog').isVisible(), '踩桩游戏超时结算');
  await page.locator('#replay-button').click();
  await check(page.evaluate(() => document.body.dataset.playState === 'playing'), '结算后重玩建立新游戏');
  await page.clock.runFor(200);
  for (let step = 0; step < 5; step++) {
    const center = await page.evaluate(() => window.LionArcade.preview.activeGame.debug.targetBand.center);
    await page.keyboard.down('Space');
    await page.clock.runFor((center - .03) / .48 * 1000);
    if (step === 0) await shot('10-poles-charge.png');
    await page.keyboard.up('Space');
    if (step === 0) { await page.clock.runFor(500); await shot('11-poles-jump.png'); await page.clock.runFor(1450); }
    else await page.clock.runFor(1950);
    await check(page.evaluate(expected => window.LionArcade.preview.activeGame.debug.landed === expected, step + 1), `真实蓄力操作完成第 ${step + 1} 个落点`);
  }
  await check(page.locator('#result-dialog').isVisible(), '五个成功落点自然结算');
  await shot('12-poles-success.png');
  await page.locator('#replay-button').click();
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await check(page.evaluate(() => document.body.dataset.playState === 'paused'), '窗口失焦自动暂停');
  await page.locator('#pause-menu').click();
  await page.locator('#sound-button').click();
  await check(page.locator('#sound-button').getAttribute('aria-pressed').then(v => v === 'true'), '声音开关能主动启用');
  await page.locator('#sound-button').click();
  await check(page.locator('#sound-button').getAttribute('aria-pressed').then(v => v === 'false'), '声音开关能关闭');
  await page.setViewportSize({ width: 1366, height: 768 });
  await shot('07-menu-1366.png');
  await check(page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight + 2), '1366×768 菜单一屏完整显示');
  await page.locator('[data-game="poles"]').click();
  await page.clock.runFor(500);
  await shot('08-poles-1366.png');
  await check(page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight + 2), '1366×768 游戏一屏完整显示');
  const bounds = await page.locator('#game-canvas').boundingBox();
  const target = await page.evaluate(() => window.LionArcade.preview.activeGame.debug.targetBand.center);
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.clock.runFor((target - .03) / .48 * 1000);
  await page.mouse.up();
  await page.clock.runFor(1900);
  await check(page.evaluate(() => window.LionArcade.preview.activeGame.debug.landed === 1), '鼠标独立蓄力也能成功落桩');
  await page.locator('#menu-button').click();
  await page.locator('[data-game="rhythm"]').click();
  await page.clock.runFor(4000);
  await page.locator('#game-canvas').click();
  await check(page.locator('#hud-primary').innerText().then(value => value.includes('1 / 18')), '鼠标点击舞台能命中节奏');
  await shot('14-rhythm-1366.png');
  await check(errors.length === 0, `浏览器无未捕获错误 ${JSON.stringify(errors)}`);
  report.passed = true;
} finally {
  report.errors = errors;
  await fs.writeFile(path.join(out, 'review.json'), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
console.log(JSON.stringify(report, null, 2));
