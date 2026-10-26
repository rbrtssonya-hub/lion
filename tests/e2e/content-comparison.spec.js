import { test, expect } from '@playwright/test';
import { selectHomeExhibit } from './home-exhibit.helpers.js';

async function open(page, route = '') {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    if (window !== top) return;
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    sessionStorage.setItem('nanfeng-lion:book-intro-seen:v1', '1');
    localStorage.setItem('nanfeng-lion:developer-settings:v1', JSON.stringify({ carouselAutoplay: false, navigationTypographyVersion: 2 }));
  });
  await page.goto(`/${route}`);
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 60000 });
}

test('造章形制对照按相同维度联动，重复选择交换两侧并保持章节', async ({ page }) => {
  await open(page);
  const types = await selectHomeExhibit(page, 'homeLionTypes');
  const hash = new URL(page.url()).hash;
  await types.getByRole('button', { name: '形制对照', exact: true }).click();
  const cards = types.locator('.heritage-comparison-card');
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0)).toHaveAttribute('data-type-id', 'foshan');
  await expect(cards.nth(1)).toHaveAttribute('data-type-id', 'heshan');
  for (const card of await cards.all()) {
    await expect(card.locator('dt')).toHaveText(['造型观察', '表演特点', '分类说明']);
    await expect.poll(() => card.locator('img').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
  }
  await types.getByLabel('左侧醒狮形制').focus();
  await types.getByLabel('左侧醒狮形制').selectOption('heshan');
  await expect(types.getByLabel('左侧醒狮形制')).toBeFocused();
  await expect(cards.nth(0)).toHaveAttribute('data-type-id', 'heshan');
  await expect(cards.nth(1)).toHaveAttribute('data-type-id', 'foshan');
  await types.getByLabel('左侧醒狮形制').press('ArrowDown');
  await expect(cards.nth(0)).toHaveAttribute('data-type-id', 'fut-hok');
  await expect(types.getByLabel('左侧醒狮形制')).toBeFocused();
  await types.getByLabel('左侧醒狮形制').press('ArrowUp');
  await types.getByLabel('右侧醒狮形制').selectOption('fut-hok');
  await expect(cards.nth(1)).toContainText('融合形制');
  await expect(cards.nth(1).getByRole('link', { name: /查阅资料/ })).toHaveAttribute('href', 'https://www.nhmuseum.org/fei-yi/1575.html');
  await types.getByLabel('右侧醒狮形制').press('Home');
  expect(new URL(page.url()).hash).toBe(hash);
});

test('退出类型对照恢复直接可读的单狮介绍和焦点，示意图失败仍能读对照', async ({ page }) => {
  await page.route('**/lion-types/foshan.png', route => route.abort());
  await open(page);
  const types = await selectHomeExhibit(page, 'homeLionTypes');
  await types.getByRole('tab', { name: /佛鹤狮/ }).click();
  await expect(types.locator('.heritage-copy')).toBeVisible();
  await expect(types.locator('.heritage-copy h3')).toHaveText('佛鹤狮');
  const compare = types.getByRole('button', { name: '形制对照', exact: true });
  await compare.click();
  await types.getByLabel('左侧醒狮形制').focus();
  await page.keyboard.press('Escape');
  await expect(types.getByRole('button', { name: '单狮阅读', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(compare).toBeFocused();
  await expect(types.locator('.heritage-copy')).toBeVisible();
  await expect(types.locator('.heritage-copy h3')).toHaveText('佛鹤狮');
  await expect(types.getByRole('list', { name: '观察重点' }).getByRole('listitem')).toHaveCount(3);
  await compare.click();
  await expect(types.locator('.heritage-comparison-card').first().locator('.heritage-image-fallback')).toBeVisible();
  await expect(types.locator('.heritage-comparison-card').first().getByRole('heading', { name: '佛山狮', exact: true })).toBeVisible();
  await expect(types.locator('.heritage-comparison-card').first().locator('dd')).toHaveCount(3);
});

test('资料按历史文化和形制工艺去重，摄影仍保留八份署名许可', async ({ page }) => {
  await open(page);
  const sources = await selectHomeExhibit(page, 'homeCultureSources');
  await expect(sources.getByRole('heading', { name: '历史与文化', exact: true })).toBeVisible();
  await expect(sources.getByRole('heading', { name: '形制与工艺', exact: true })).toBeVisible();
  const links = await sources.locator('.home-culture-source-card, .heritage-source-group a').evaluateAll(nodes => nodes.map(node => node.href));
  expect(new Set(links).size).toBe(links.length);
  await expect(sources.getByRole('heading', { name: '摄影署名与许可', exact: true })).toBeVisible();
  await expect(sources.locator('.home-culture-photo-license')).toHaveCount(8);
  for (const credit of await sources.locator('.home-culture-photo-license .home-culture-credit').all()) {
    await expect(credit.getByRole('link')).toHaveCount(2);
    await expect(credit.getByRole('link').last()).toHaveAttribute('href', /^https:\/\/creativecommons.org\//);
  }
});

test('神态三组对照保持原详情，退出恢复焦点，滚轮不驱动隐藏八态', async ({ page }) => {
  await open(page, '#/state');
  await page.getByRole('navigation', { name: '醒狮八态', exact: true }).getByRole('button', { name: '疑', exact: true }).click();
  await page.locator('#expressionLionTrigger').click();
  const compare = page.getByRole('button', { name: '神态对照', exact: true });
  await compare.click();
  const cards = page.locator('.expression-comparison-card');
  await expect(cards.locator('h2')).toHaveText(['惊', '疑']);
  await expect(page.locator('#expressionObservation')).toBeHidden();
  await cards.first().hover();
  await page.mouse.wheel(0, 150);
  await expect(page.locator('#chapterStage')).toHaveAttribute('data-expression', '疑');
  for (const [label, names] of [['喜与乐', ['喜', '乐']], ['惊与疑', ['惊', '疑']], ['动与静', ['动', '静']]]) {
    await page.getByRole('tab', { name: label, exact: true }).click();
    await expect(cards.locator('h2')).toHaveText(names);
    for (const card of await cards.all()) await expect(card.locator('dt')).toHaveText(['姿态', '眉眼与狮口', '表现意图']);
  }
  await page.getByRole('tab', { name: '动与静', exact: true }).press('Escape');
  await expect(compare).toBeFocused();
  await expect(page.locator('#expressionStateCopy')).toHaveAttribute('data-view', 'details');
  await expect(page.locator('#expressionStateTitle')).toHaveText('疑');
});

test('结构观察跳转与浏览器返回保留部位、相机、可读资料和详情位置', async ({ page }) => {
  await open(page, '#/model');
  const stage = page.locator('#modelStage');
  await expect(page.locator('#modelStatus')).toContainText('模型已载入');
  await page.locator('#modelHotspots button[data-id="eyes"]').click();
  const cultureReading = page.locator('.structure-more-reading').last();
  await expect(cultureReading).toBeVisible();
  const canvas = page.locator('#sceneContainer canvas');
  await expect(canvas).toHaveAttribute('data-focus-state', 'idle');
  const before = await canvas.getAttribute('data-camera-distance');
  await page.getByRole('button', { name: '去神态页观察惊态', exact: true }).click();
  await expect(page).toHaveURL(/#\/state$/);
  await expect(page.locator('#expressionStateTitle')).toHaveText('惊');
  await expect(page.locator('#expressionStateCopy')).toHaveAttribute('data-view', 'details');
  await page.getByRole('button', { name: '返回眉眼部位', exact: true }).click();
  await expect(page).toHaveURL(/#\/model$/);
  await expect(page.locator('#modelExpressionLink')).toBeFocused();
  await expect(stage).toHaveAttribute('data-selected-id', 'eyes');
  await expect(cultureReading).toBeVisible();
  expect(await canvas.getAttribute('data-camera-distance')).toBe(before);
  await page.getByRole('button', { name: '去神态页观察惊态', exact: true }).click();
  await page.goBack();
  await expect(stage).toHaveAttribute('data-selected-id', 'eyes');
  await expect(cultureReading).toBeVisible();
  await page.locator('.site-header [data-route="entry"]').click();
  await page.locator('.site-header [data-route="action"]').click();
  await page.getByRole('button', { name: '看狮头 · 八态', exact: true }).click();
  await expect(page.getByRole('button', { name: '返回眉眼部位', exact: true })).toHaveCount(0);
});

test('结构图鉴直接呈现文化原资料，标题与正文仍在阅读区可达', async ({ page }) => {
  await open(page, '#/model');
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.locator('#modelHotspots button[data-id="eyes"]').click();
  const culture = page.locator('.structure-culture-section').last();
  await culture.getByRole('heading', { name: '狮韵之意', exact: true }).scrollIntoViewIfNeeded();
  await expect(culture.getByRole('heading', { name: '狮韵之意', exact: true })).toBeInViewport();
  const reading = culture.locator('.structure-more-reading');
  await expect(reading).toBeVisible();
  await reading.locator('dd').last().scrollIntoViewIfNeeded();
  await expect(reading.locator('dd').last()).toBeInViewport();
});

test('后退修改模型部位使旧观察上下文失效，前进后不承诺错误返回目标', async ({ page }) => {
  await open(page, '#/model');
  await page.locator('#modelHotspots button[data-id="eyes"]').click();
  await page.getByRole('button', { name: '去神态页观察惊态', exact: true }).click();
  await expect(page.locator('#expressionStateTitle')).toHaveText('惊');
  await page.goBack();
  await page.locator('#nextStructurePart').click();
  await page.locator('#nextStructurePart').click();
  await page.goForward();
  await expect(page).toHaveURL(/#\/state$/);
  await expect(page.getByRole('button', { name: '返回眉眼部位', exact: true })).toHaveCount(0);
});

test('结构观察往返保留非零资料滚动和转动后的实际投影', async ({ page }) => {
  await open(page, '#/model');
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.locator('#modelHotspots button[data-id="eyes"]').click();
  const canvas = page.locator('#sceneContainer canvas');
  await expect(canvas).toHaveAttribute('data-focus-state', 'idle');
  const scene = await page.locator('#sceneInteraction').boundingBox();
  await page.mouse.move(scene.x + scene.width / 2, scene.y + scene.height / 2);
  await page.mouse.down(); await page.mouse.move(scene.x + scene.width / 2 + 60, scene.y + scene.height / 2 + 20, { steps: 8 }); await page.mouse.up();
  await page.locator('#modelExpressionLink').scrollIntoViewIfNeeded();
  const paneScroll = await page.locator('#modelDetailContent').evaluate(node => node.scrollTop);
  expect(paneScroll).toBeGreaterThan(0);
  await expect(canvas).toHaveAttribute('data-focus-state', 'idle');
  const projection = JSON.parse(await canvas.getAttribute('data-part-projections'));
  await page.locator('#modelExpressionLink').click();
  await page.getByRole('button', { name: '返回眉眼部位', exact: true }).click();
  await expect(page.locator('#modelExpressionLink')).toBeFocused();
  expect(await page.locator('#modelDetailContent').evaluate(node => node.scrollTop)).toBe(paneScroll);
  await expect(canvas).toHaveAttribute('data-focus-state', 'idle');
  const after = JSON.parse(await canvas.getAttribute('data-part-projections'));
  for (const id of Object.keys(projection)) {
    expect(Math.abs(after[id].x - projection[id].x)).toBeLessThan(1);
    expect(Math.abs(after[id].y - projection[id].y)).toBeLessThan(1);
  }
});
