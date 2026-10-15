import { test, expect } from '@playwright/test';

async function openPage(page, url) {
  await page.goto(url);
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 45000 });
}

const states = ['喜', '怒', '哀', '乐', '动', '静', '惊', '疑'];
const observation = page => page.getByRole('region', { name: '醒狮神态切换', exact: true });
const menu = page => page.getByRole('navigation', { name: '醒狮八态', exact: true });
const stateButton = (page, state) => menu(page).getByRole('button', { name: state, exact: true });
const routeButton = (page, route) => page.locator(`.site-header [data-route="${route}"]`);

async function setAvailableWidth(page, width, height) {
  const gutter = await page.locator('.site-shell').evaluate(element => innerWidth - element.getBoundingClientRect().width);
  await page.setViewportSize({ width: Math.round(width + gutter), height });
}

async function expectState(page, state) {
  await expect(page.locator('#chapterStage')).toHaveAttribute('data-expression', state);
  await expect(page.locator('#expressionStateTitle')).toHaveText(state);
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
  await page.addInitScript(() => { if (window === window.top) sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1'); });
});

test('八态目录与狮头点击同步右侧简介和详细解读，移除下半区图片', async ({ page }) => {
  await openPage(page, '/#/state');
  await expect(menu(page).getByRole('button')).toHaveCount(8, { timeout: 5_000 });
  for (const state of states) await expect(stateButton(page, state)).toBeVisible();
  await expectState(page, '喜');
  await expectLoadedLion(page);
  await expect(page.locator('#expressionDetails, .expression-detail-images, .expression-detail-crop')).toHaveCount(0);
  await expect(page.locator('.site-footer')).toHaveCount(0);
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
    await expect(page.locator('#expressionStateCopy')).toHaveAttribute('data-view', 'overview');
    await expect(page.locator('#expressionSummary')).toBeVisible();
    summaries.push(await page.locator('#expressionSummary').innerText());
    await page.locator('#expressionLionTrigger').click();
    await expect(page.locator('#expressionStateCopy')).toHaveAttribute('data-view', 'details');
    await expect(page.locator('#expressionStateCopy #expressionDetailTitle')).toHaveText(`${state}态怎么看`);
    await expect(page.locator('#expressionSummary')).toHaveCount(0);
    for (const id of ['expressionEmotionCue', 'expressionMotionCue']) {
      await expect(page.locator(`#${id}`)).toBeVisible();
      await expect(page.locator(`#${id}`)).not.toHaveText('');
    }
    emotions.push(await page.locator('#expressionEmotionCue').innerText());
    motions.push(await page.locator('#expressionMotionCue').innerText());
  }
  expect(new Set(summaries).size).toBe(8);
  expect(new Set(emotions).size).toBe(8);
  expect(new Set(motions).size).toBe(8);
  await expect(page).toHaveURL(/#\/state$/);
});

test('狮头重复点击保留解读，返回和Escape恢复简介及狮头焦点', async ({ page }) => {
  await openPage(page, '/#/state');
  const trigger = page.locator('#expressionLionTrigger');
  await trigger.hover();
  await expect(page.locator('#expressionInteractionHint')).toContainText('点击狮头');
  await trigger.click();
  await trigger.click();
  await expect(page.locator('#expressionEmotionCue')).toHaveText('观察明亮的目光与嘴部开合，寻找欢喜的回应。');
  await expect(page.locator('#expressionMotionCue')).toHaveText('留意轻快的起伏、点头与迎向观众的动作。');
  await page.getByRole('button', { name: '返回神态简介', exact: true }).click();
  await expect(page.locator('#expressionSummary')).toHaveText('轻快回应，传达欢喜。');
  await expect(trigger).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#expressionStateCopy')).toHaveAttribute('data-view', 'details');
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await expect(page.locator('#expressionStateCopy')).toHaveAttribute('data-view', 'overview');
  await page.keyboard.press('Space');
  await page.keyboard.press('ArrowDown');
  await expectState(page, '怒');
  await expect(page.locator('#expressionStateCopy')).toHaveAttribute('data-view', 'overview');
  await trigger.click();
  await stateButton(page, '怒').click();
  await expect(page.locator('#expressionStateCopy')).toHaveAttribute('data-view', 'overview');
  await expect(stateButton(page, '怒')).toBeFocused();
  await trigger.click();
  await observation(page).hover();
  await page.mouse.wheel(0, 180);
  await expectState(page, '哀');
  await expect(page.locator('#expressionStateCopy')).toHaveAttribute('data-view', 'overview');
});

test('切态取消尚未完成的Space激活，松开不重新打开旧意图', async ({ page }) => {
  await openPage(page, '/#/state');
  await page.locator('#expressionLionTrigger').focus();
  await page.keyboard.down('Space');
  await page.keyboard.press('ArrowDown');
  await expectState(page, '怒');
  await expect(page.locator('#expressionStateCopy')).toHaveAttribute('data-view', 'overview');
  await page.keyboard.up('Space');
  await expect(page.locator('#expressionStateCopy')).toHaveAttribute('data-view', 'overview');
  await page.keyboard.press('Space');
  await expect(page.locator('#expressionStateCopy')).toHaveAttribute('data-view', 'details');
});

test('上下切换按钮遍历八态并在首尾循环', async ({ page }) => {
  await openPage(page, '/#/state');
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

test('主视觉滚轮切态并限制连续手势，视觉外不误触切态', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 620 });
  await openPage(page, '/#/state');
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
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await expectState(page, '疑');
});

test('减弱动态效果下键盘可切态，离页重入没有残留交互', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openPage(page, '/#/state');
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
  await page.addInitScript(() => {
    if (window !== window.top) return;
    localStorage.setItem('nanfeng-lion:developer-settings:v1', JSON.stringify({ pushPage: false }));
  });
  await page.setViewportSize({ width: 1380, height: 900 });
  await openPage(page, '/#/state');
  await setAvailableWidth(page, 1380, 900);
  await page.locator('.site-navigation [data-action="settings"]').click();
  await expect(page.locator('.site-shell')).toHaveAttribute('data-settings-layout', 'overlay');
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
  await page.locator('#expressionLionTrigger').click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.querySelector('.site-shell').getBoundingClientRect().width)).toBe(true);
  const contentFits = await page.locator('#chapterStage').evaluate(element => {
    const page = element.closest('.site-page').getBoundingClientRect();
    return ['#expressionObservation', '#expressionStateTitle', '#expressionDetailTitle'].every(selector => {
      const bounds = element.querySelector(selector).getBoundingClientRect();
      return bounds.left >= page.left && bounds.right <= page.right;
    });
  });
  expect(contentFits).toBe(true);
});

test('神态简介与解读按电脑宽高自适应，完整三栏且无遗留第二屏', async ({ page }) => {
  test.setTimeout(180_000);
  for (const [width, height] of [[1920,1080],[2560,1440],[1366,768],[1024,768],[1440,620]]) {
    await page.setViewportSize({ width, height });
    await openPage(page, `/?expressionFit=${width}#/state`);
    await expectLoadedLion(page);
    for (const mode of ['overview', 'details']) {
      if (mode === 'details') await page.locator('#expressionLionTrigger').click();
      await expect(page.locator('#expressionStateCopy')).toHaveAttribute('data-view', mode);
      await page.waitForTimeout(550);
      const fits = await page.locator('#chapterStage').evaluate(el => {
        const header = document.querySelector('.site-header').getBoundingClientRect();
        const page = el.closest('.site-page').getBoundingClientRect();
        const rects = ['.expression-state-nav', '#expressionObservation', '#expressionStateCopy', '#chapterEvidence', '#expressionLion'].map(selector => el.querySelector(selector).getBoundingClientRect());
        return { oneScreen: document.documentElement.scrollHeight <= innerHeight + 2, noHorizontal: document.documentElement.scrollWidth <= document.querySelector('.site-shell').getBoundingClientRect().width, inView: rects.every(r => r.top >= header.bottom - 1 && r.bottom <= innerHeight + 1 && r.left >= page.left && r.right <= page.right), threeColumns: rects[0].right < rects[1].left && rects[1].right < rects[2].left };
      });
      expect(fits).toEqual({ oneScreen: true, noHorizontal: true, inView: true, threeColumns: true });
      await page.screenshot({ path: `tmp/expression-single/${mode}-${width}.png` });
    }
  }
});

test('900px推开与64或180px顶栏下八态解读仍在单屏，快速切换无旧内容', async ({ page }) => {
  test.setTimeout(150_000);
  await page.addInitScript(() => {
    if (window !== window.top) return;
    localStorage.setItem('nanfeng-lion:developer-settings:v1', JSON.stringify({ pushPage: true, panelWidth: 480, headerHeight: Number(new URLSearchParams(location.search).get('header')) }));
  });
  await page.setViewportSize({ width: 1380, height: 768 });
  for (const height of [64,180]) {
    await openPage(page, `/?header=${height}#/state`);
    await setAvailableWidth(page, 1380, 768);
    await page.locator('.site-navigation [data-action="settings"]').click();
    await expect(page.locator('.site-shell')).toHaveAttribute('data-settings-layout', 'push');
    await expect.poll(() => page.locator('.site-page').evaluate(el => el.getBoundingClientRect().width)).toBe(900);
    for (const state of states) {
      await stateButton(page, state).click();
      await page.locator('#expressionLionTrigger').click();
      await expect(page.locator('#expressionStateCopy #expressionDetailTitle')).toHaveText(`${state}态怎么看`);
      await page.waitForTimeout(550);
      const inside = await page.locator('#chapterStage').evaluate(el => {
        const page = el.closest('.site-page').getBoundingClientRect();
        const header = document.querySelector('.site-header').getBoundingClientRect();
        return ['.expression-state-nav', '#expressionLion', '#expressionStateCopy', '#expressionPrevious', '#expressionNext', '#chapterEvidence'].every(selector => {
          const r = el.querySelector(selector).getBoundingClientRect();
          return r.left >= page.left - 1 && r.right <= page.right + 1 && r.top >= header.bottom - 1 && r.bottom <= innerHeight + 1;
        }) && document.documentElement.scrollHeight <= innerHeight + 2;
      });
      expect(inside).toBe(true);
    }
    await page.screenshot({ path: `tmp/expression-single/push900-header${height}.png` });
    await page.locator('#expressionLionTrigger').click();
    await page.keyboard.press('Escape');
    await expect(page.locator('#expressionStateCopy')).toHaveAttribute('data-view', 'overview');
    await expect(page.getByRole('region', { name: '开发者参数设置', exact: true })).toBeVisible();
  }
});

test('短高桌面与180px顶栏仍完整显示解读文字、返回及上下箭头', async ({ page }) => {
  test.setTimeout(180_000);
  await page.addInitScript(() => {
    if (window !== window.top) return;
    const query = new URLSearchParams(location.search);
    localStorage.setItem('nanfeng-lion:developer-settings:v1', JSON.stringify({ pushPage: query.get('push') === '1', panelWidth: 480, headerHeight: 180 }));
  });
  for (const [width, height, push] of [[1440,540,false],[1440,500,false],[1380,540,true],[1380,500,true]]) {
    await page.setViewportSize({ width, height });
    await openPage(page, `/?short=${height}&push=${push ? 1 : 0}#/state`);
    if (push) {
      await setAvailableWidth(page, width, height);
      await page.locator('.site-navigation [data-action="settings"]').click();
      await expect(page.locator('.site-shell')).toHaveAttribute('data-settings-layout', 'push');
      await expect.poll(() => page.locator('.site-page').evaluate(el => el.getBoundingClientRect().width)).toBe(900);
    }
    for (const state of ['喜','怒','惊','疑']) {
      await stateButton(page, state).click();
      await page.locator('#expressionLionTrigger').click();
      await page.waitForTimeout(550);
      const fits = await page.locator('#chapterStage').evaluate(el => {
        const header = document.querySelector('.site-header').getBoundingClientRect();
        const page = el.closest('.site-page').getBoundingClientRect();
        return { oneScreen: document.documentElement.scrollHeight <= innerHeight + 2, visible: ['.expression-state-nav','#expressionLion','#expressionEmotionCue','#expressionMotionCue','.expression-return','#expressionPrevious','#expressionNext','#chapterEvidence'].every(selector => {
          const r = el.querySelector(selector).getBoundingClientRect();
          return r.top >= header.bottom - 1 && r.bottom <= innerHeight + 1 && r.left >= page.left - 1 && r.right <= page.right + 1;
        }) };
      });
      expect(fits).toEqual({ oneScreen: true, visible: true });
    }
    await page.screenshot({ path: `tmp/expression-single/short-${width}-${height}.png` });
  }
});
