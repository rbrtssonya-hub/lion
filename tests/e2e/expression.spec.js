import { test, expect } from '@playwright/test';

const states = ['喜', '怒', '哀', '乐', '动', '静', '惊', '疑'];
const observation = page => page.getByRole('region', { name: '醒狮神态切换', exact: true });
const menu = page => page.getByRole('navigation', { name: '醒狮八态', exact: true });
const stateButton = (page, state) => menu(page).getByRole('button', { name: state, exact: true });
const routeButton = (page, route) => page.locator(`.site-header [data-route="${route}"]`);

async function expectState(page, state) {
  await expect(page.locator('#chapterStage')).toHaveAttribute('data-expression', state);
  await expect(page.locator('#expressionStateTitle')).toHaveText(state);
  await expect(page.locator('#expressionDetailTitle')).toContainText(`${state}态怎么看`);
  await expect(stateButton(page, state)).toHaveAttribute('aria-pressed', 'true');
  await expect(menu(page).locator('button[aria-pressed="true"]')).toHaveCount(1);
}

async function expectLoadedLion(page) {
  await expect(page.locator('#expressionLion')).toBeVisible();
  await expect.poll(() => page.locator('#expressionLion').evaluate(image =>
    image.tagName === 'IMG' && image.complete && image.naturalWidth > 0)).toBe(true);
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1'));
});

test('八态目录选择同步当前神态、观察文字和眼嘴说明', async ({ page }) => {
  await page.goto('/#/state');
  await expect(menu(page).getByRole('button')).toHaveCount(8, { timeout: 5_000 });
  for (const state of states) await expect(stateButton(page, state)).toBeVisible();
  await expectState(page, '喜');
  await expectLoadedLion(page);
  const lionFits = await page.locator('#expressionLion').evaluate(image => {
    const lion = image.getBoundingClientRect();
    const stage = image.closest('#expressionObservation').getBoundingClientRect();
    return lion.top >= stage.top && lion.bottom <= stage.bottom && lion.width <= stage.width;
  });
  expect(lionFits).toBe(true);
  const summaries = [];
  const emotions = [];
  const motions = [];
  for (const state of states) {
    await stateButton(page, state).click();
    await expectState(page, state);
    for (const id of ['expressionSummary', 'expressionEmotionCue', 'expressionMotionCue']) {
      await expect(page.locator(`#${id}`)).toBeVisible();
      await expect(page.locator(`#${id}`)).not.toHaveText('');
    }
    summaries.push(await page.locator('#expressionSummary').innerText());
    emotions.push(await page.locator('#expressionEmotionCue').innerText());
    motions.push(await page.locator('#expressionMotionCue').innerText());
  }
  expect(new Set(summaries).size).toBe(8);
  expect(new Set(emotions).size).toBe(8);
  expect(new Set(motions).size).toBe(8);
});

test('上下切换按钮遍历八态并在首尾循环', async ({ page }) => {
  await page.goto('/#/state');
  await expectState(page, '喜');
  await page.locator('#expressionPrevious').click();
  await expectState(page, '疑');
  await page.locator('#expressionNext').click();
  await expectState(page, '喜');
  for (const state of ['怒', '哀', '乐', '动', '静', '惊', '疑', '喜']) {
    await page.locator('#expressionNext').click();
    await expectState(page, state);
  }
});

test('主视觉滚轮切态并限制连续手势，视觉外仍正常滚动页面', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 620 });
  await page.goto('/#/state');
  await expectState(page, '喜');
  await observation(page).hover();
  const scrollBefore = await page.evaluate(() => scrollY);
  await page.mouse.wheel(0, 180);
  await expectState(page, '怒');
  expect(await page.evaluate(() => scrollY)).toBe(scrollBefore);

  await page.waitForTimeout(250);
  // Keep one gesture active longer than its quiet gap to catch repeated leading-edge throttles.
  await observation(page).evaluate(async element => {
    for (let index = 0; index < 12; index += 1) {
      element.dispatchEvent(new WheelEvent('wheel', { deltaY: 48, bubbles: true, cancelable: true }));
      await new Promise(resolve => setTimeout(resolve, 45));
    }
  });
  await expectState(page, '哀');
  expect(await page.evaluate(() => scrollY)).toBe(scrollBefore);
  await page.waitForTimeout(250);
  await page.mouse.wheel(0, -180);
  await expectState(page, '怒');
  await page.mouse.wheel(180, 0);
  await page.waitForTimeout(50);
  await expectState(page, '怒');
  await observation(page).evaluate(element =>
    element.dispatchEvent(new WheelEvent('wheel', { deltaY: 180, ctrlKey: true, bubbles: true, cancelable: true })));
  await expectState(page, '怒');

  await stateButton(page, '疑').click();
  await observation(page).hover();
  await page.waitForTimeout(250);
  await page.mouse.wheel(0, 180);
  await expectState(page, '喜');
  await page.waitForTimeout(250);
  await page.mouse.wheel(0, -180);
  await expectState(page, '疑');

  await page.evaluate(() => scrollTo(0, 0));
  await page.mouse.move(12, 12);
  await page.mouse.wheel(0, 450);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
  await expectState(page, '疑');
});

test('减弱动态效果下键盘可切态，离页重入没有残留交互', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#/state');
  await observation(page).focus();
  await expect(observation(page)).toBeFocused();
  for (const [key, state] of [
    ['ArrowDown', '怒'], ['ArrowUp', '喜'], ['ArrowUp', '疑'],
    ['Home', '喜'], ['End', '疑'], ['ArrowDown', '喜'],
  ]) {
    await page.keyboard.press(key);
    await expectState(page, state);
    await expect(observation(page)).toBeFocused();
  }
  await stateButton(page, '静').click();
  await expectState(page, '静');
  const previousObservation = await observation(page).elementHandle();
  await routeButton(page, 'action').click();
  await expect(page.locator('#chapterStage')).toHaveAttribute('data-chapter', 'action');
  expect(await previousObservation.evaluate(element => element.isConnected)).toBe(false);
  await expect(observation(page)).toHaveCount(0);
  await routeButton(page, 'state').click();
  await expectState(page, '喜');
  await observation(page).hover();
  await page.mouse.wheel(0, 180);
  await expectState(page, '怒');
  expect(errors).toEqual([]);
  await previousObservation.dispose();
});

test('电脑侧栏推开后900px余宽仍可读可切换且没有横向溢出', async ({ page }) => {
  await page.setViewportSize({ width: 1380, height: 900 });
  await page.goto('/#/state');
  await page.locator('.site-navigation [data-action="settings"]').click();
  const settings = page.getByRole('region', { name: '开发者参数设置', exact: true });
  await settings.getByRole('tab', { name: '布局', exact: true }).click();
  const width = settings.getByRole('spinbutton', { name: '设置面板宽度数值', exact: true });
  await width.fill('480');
  await width.press('Tab');
  await settings.getByRole('checkbox', { name: '设置面板推开页面', exact: true }).check();
  await expect(page.locator('.site-shell')).toHaveAttribute('data-settings-layout', 'push');
  await expect.poll(() => page.locator('.site-page').evaluate(element => element.getBoundingClientRect().width)).toBe(900);
  await expectLoadedLion(page);
  await stateButton(page, '惊').click();
  await expectState(page, '惊');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const contentFits = await page.locator('#chapterStage').evaluate(element => {
    const page = element.closest('.site-page').getBoundingClientRect();
    return ['#expressionObservation', '#expressionStateTitle', '#expressionDetailTitle'].every(selector => {
      const bounds = element.querySelector(selector).getBoundingClientRect();
      return bounds.left >= page.left && bounds.right <= page.right;
    });
  });
  expect(contentFits).toBe(true);
});
