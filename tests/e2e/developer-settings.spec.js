import { test, expect } from '@playwright/test';
import { expandSettingsGroups, selectSettingsFor, selectSettingsPage as selectSettingsTab, settingsPages } from './settings-navigation.helpers.js';

const settingsKey = 'nanfeng-lion:developer-settings:v1';
const headerSurfaces = page => page.locator('.site-header > .navigation-surface');
const panel = page => page.getByRole('region', { name: '开发者参数设置' });
const trigger = page => page.locator('.site-navigation [data-action="settings"]');
const topEdge = page => page.getByRole('separator', { name: '调整顶栏高度' });
const sideEdge = page => page.getByRole('separator', { name: '调整侧栏宽度' });
const pageWidth = page => page.locator('.site-page').evaluate(element => element.getBoundingClientRect().width);
const shellWidth = page => page.locator('.site-shell').evaluate(element => element.getBoundingClientRect().width);
const headerHeight = page => page.locator('.site-header').evaluate(element => element.getBoundingClientRect().height);
const sidebarWidth = page => panel(page).evaluate(element => element.getBoundingClientRect().width);
const carouselDefaults = {
  carouselAutoplay: true, carouselInterval: 6, carouselResumeDelay: 3,
  carouselTransitionDuration: 800, carouselFocusScale: 104,
};

async function savedSettings(page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)), settingsKey);
}

async function expectSaved(page, values) {
  await expect.poll(() => savedSettings(page)).toMatchObject(values);
}

async function expectPageWidth(page, reserve = 0) {
  await expect.poll(() => pageWidth(page)).toBe(await shellWidth(page) - reserve);
}

async function waitForStartup(page) {
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 60_000 });
}

async function loadPage(page) {
  await page.goto('/');
  await waitForStartup(page);
}

async function reloadPage(page) {
  await page.reload();
  await waitForStartup(page);
}

async function openSettings(page) {
  await waitForStartup(page);
  await trigger(page).click();
  await expect(panel(page)).toBeVisible();
}

async function saveSettings(page, reopen = true) {
  await panel(page).getByRole('button', { name: '保存设置', exact: true }).click();
  await expect(panel(page)).toHaveCount(0);
  if (reopen) {
    await openSettings(page);
    await expandSettingsGroups(page);
  }
}

async function editNumber(page, name, value) {
  await selectSettingsFor(page, name);
  const input = panel(page).getByRole('spinbutton', { name: `${name}数值`, exact: true });
  await input.fill(String(value));
  await input.press('Tab');
  await expect(input).toHaveValue(String(value));
}

async function expectNavigationSizes(page, title, helper) {
  await expect.poll(() => page.locator('.site-navigation').evaluate(navigation => ({
    title: parseFloat(getComputedStyle(navigation.querySelector('strong')).fontSize),
    helper: parseFloat(getComputedStyle(navigation.querySelector('.site-nav-description')).fontSize),
  }))).toEqual({ title, helper });
}

async function dragStart(page, edge, axis, delta) {
  await expect(edge).toBeVisible();
  const bounds = await edge.boundingBox();
  expect(bounds).not.toBeNull();
  // Start away from the visual grip to prove the whole boundary is interactive.
  const x = axis === 'x' ? bounds.x + bounds.width / 2 : bounds.x + 100;
  const y = axis === 'y' ? bounds.y + bounds.height / 2 : bounds.y + 120;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + (axis === 'x' ? delta : 0), y + (axis === 'y' ? delta : 0), { steps: 6 });
}

async function expectNoDrag(page) {
  await expect.poll(() => page.evaluate(() =>
    document.documentElement.classList.contains('lion-resizing-x') ||
    document.documentElement.classList.contains('lion-resizing-y'))).toBe(false);
  await expect(page.locator('.lion-resize-handle.is-resizing')).toHaveCount(0);
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.addInitScript(() => {
    if (window.top === window) sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
  });
});

test('第五项设置默认关闭，展开为贴右全高侧栏，关闭和 Escape 恢复入口焦点', async ({ page }) => {
  await loadPage(page);
  await expect(page.locator('.site-nav-heading strong')).toHaveText(['首页', '结构', '动作', '神态', '设置']);
  await expect(panel(page)).toHaveCount(0);
  await expect(trigger(page)).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.developer-settings-trigger')).toHaveCount(0);
  await expectSaved(page, { headerTransparency: 20, pushPage: true, homeBrandOffset: 24 });
  await expectPageWidth(page);

  await openSettings(page);
  await expect(trigger(page)).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.site-shell')).toHaveAttribute('data-settings-layout', 'push');
  await expectPageWidth(page, 340);
  await expect(panel(page).getByRole('button', { name: '关闭开发者参数' })).toBeFocused();
  await selectSettingsFor(page, '首页阅读底板透明度数值');
  await expect(panel(page).getByRole('spinbutton', { name: '首页阅读底板透明度数值' })).toHaveValue('35');
  const bounds = await panel(page).boundingBox();
  const viewport = await page.evaluate(() => ({ width: document.querySelector('.site-shell').getBoundingClientRect().right, height: innerHeight }));
  expect(bounds.y).toBe(0);
  expect(bounds.x + bounds.width).toBeCloseTo(viewport.width, 1);
  expect(bounds.height).toBe(viewport.height);
  await expect(panel(page).getByRole('tablist', { name: '设置分类', exact: true }).getByRole('tab', { name: '公共模块', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(panel(page).getByRole('spinbutton', { name: '导航标题字号数值', includeHidden: true })).toBeHidden();
  await panel(page).getByRole('button', { name: '关闭开发者参数' }).click();
  await expect(panel(page)).toHaveCount(0);
  await expect(trigger(page)).toBeFocused();
  await expectPageWidth(page);

  await openSettings(page);
  await page.keyboard.press('Escape');
  await expect(panel(page)).toHaveCount(0);
  await expect(trigger(page)).toBeFocused();
});

test('设置主分类纵向排列，主子页面键盘切换并保留已调参数与当前类别', async ({ page }) => {
  await loadPage(page);
  await openSettings(page);
  const categories = panel(page).getByRole('tablist', { name: '设置分类', exact: true });
  const tabs = categories.getByRole('tab');
  await expect(tabs).toHaveText(settingsPages);
  await expect(categories).toHaveAttribute('aria-orientation', 'vertical');
  expect(await tabs.evaluateAll(elements => elements.every((element, index) => index === 0 || element.getBoundingClientRect().top > elements[index - 1].getBoundingClientRect().top))).toBe(true);
  await expect(panel(page).locator('.developer-settings-page')).toHaveCount(settingsPages.length);
  await expect(panel(page).locator('.developer-settings-page:visible')).toHaveCount(1);
  await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');
  await selectSettingsFor(page, '首页阅读底板透明度数值');
  await expect(panel(page).getByRole('spinbutton', { name: '首页阅读底板透明度数值', exact: true })).toBeVisible();
  await expect(panel(page).getByRole('spinbutton', { name: '导航标题字号数值', includeHidden: true })).toBeHidden();
  for (let index = 0; index < settingsPages.length; index++) {
    const tab = tabs.nth(index);
    if (index === 0) await tab.focus();
    else await tabs.nth(index - 1).press('ArrowDown');
    await expect(tab).toBeFocused();
    await expect(tab).toHaveAttribute('aria-selected', 'true');
    await expect(tab).toHaveAttribute('tabindex', '0');
    const id = await tab.getAttribute('aria-controls');
    const root = panel(page).locator('.developer-settings-page[id="' + id + '"]');
    await expect(root).toBeVisible();
    await expect(root).toHaveAttribute('aria-labelledby', await tab.getAttribute('id'));
    await expect(panel(page).locator('.developer-settings-page:visible')).toHaveCount(1);
    await expect(panel(page).getByRole('tabpanel')).toHaveCount(['首页', '章节'].includes(settingsPages[index]) ? 2 : 1);
  }
  const layout = tabs.last(), common = tabs.first();
  await layout.press('ArrowRight');
  await expect(common).toBeFocused();
  await common.press('ArrowUp');
  await expect(layout).toBeFocused();
  await layout.press('Home');
  await expect(common).toBeFocused();
  for (const [main, label, names] of [
    ['首页', '首页设置分区', ['书册', '图鉴']],
    ['章节', '章节设置分区', ['结构', '动作', '神态']],
  ]) {
    await selectSettingsTab(page, main);
    const subtabs = panel(page).getByRole('tablist', { name: label, exact: true }).getByRole('tab');
    await expect(subtabs).toHaveText(names);
    await expect(subtabs.first()).toHaveAttribute('aria-selected', 'true');
    await subtabs.first().focus();
    await subtabs.first().press('End');
    await expect(subtabs.last()).toBeFocused();
    await expect(subtabs.last()).toHaveAttribute('aria-selected', 'true');
    await panel(page).getByRole('button', { name: '关闭开发者参数', exact: true }).click();
    await openSettings(page);
    await expect(categories.getByRole('tab', { name: main, exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(subtabs.last()).toHaveAttribute('aria-selected', 'true');
    for (const subtab of await subtabs.all()) {
      const id = await subtab.getAttribute('aria-controls');
      await expect(panel(page).locator('[id="' + id + '"]')).toHaveAttribute('aria-labelledby', await subtab.getAttribute('id'));
    }
    await expect(panel(page).getByRole('tabpanel')).toHaveCount(2);
    await subtabs.last().press('Home');
    await expect(subtabs.first()).toBeFocused();
  }
  await editNumber(page, '导航标题字号', 24);
  await saveSettings(page);
  await expectSaved(page, { navFontSize: 24 });
  await panel(page).getByRole('button', { name: '关闭开发者参数' }).click();
  await openSettings(page);
  await expect(categories.getByRole('tab', { name: '导航', exact: true })).toHaveAttribute('aria-selected', 'true');
  await selectSettingsFor(page, '导航标题字号数值');
  await expect(panel(page).getByRole('spinbutton', { name: '导航标题字号数值' })).toHaveValue('24');
});

test('动画参数与紧凑布局可保存刷新和恢复默认，时长数值与滑块校验边界步长', async ({ page }) => {
  await loadPage(page);
  await openSettings(page);
  await selectSettingsFor(page, '导航动画时长数值');
  const duration = panel(page).getByRole('spinbutton', { name: '导航动画时长数值', exact: true });
  const easing = panel(page).getByRole('combobox', { name: '动画变速曲线', exact: true });
  await expect(duration).toHaveValue('720');
  await expect(easing).toHaveValue('smooth');
  await expect(easing.locator('option')).toHaveText(['平滑进出', '快速收拢', '柔和缓出']);
  await selectSettingsFor(page, '紧凑导航图标间距数值');
  await expect(panel(page).getByRole('spinbutton', { name: '紧凑导航图标间距数值' })).toHaveValue('14');
  await selectSettingsFor(page, '紧凑导航右侧留白数值');
  await expect(panel(page).getByRole('spinbutton', { name: '紧凑导航右侧留白数值' })).toHaveValue('48');
  await selectSettingsFor(page, '首页品牌右移距离数值');
  const brandOffset = panel(page).getByRole('spinbutton', { name: '首页品牌右移距离数值', exact: true });
  await expect(brandOffset).toHaveValue('24');
  await expect(brandOffset).toHaveAttribute('min', '0');
  await expect(brandOffset).toHaveAttribute('max', '160');
  await expect(brandOffset).toHaveAttribute('step', '1');
  for (const [draft, expected] of [['-5', 0], ['161', 160], ['35.7', 36], ['', 36]]) {
    await brandOffset.fill(draft);
    await brandOffset.press('Tab');
    await expect(brandOffset).toHaveValue(String(expected));
    await saveSettings(page);
    await expectSaved(page, { homeBrandOffset: expected });
  }
  const brandOffsetSlider = panel(page).getByRole('slider', { name: '首页品牌右移距离', exact: true });
  await expect(brandOffsetSlider).toHaveAttribute('min', '0');
  await expect(brandOffsetSlider).toHaveAttribute('max', '160');
  await expect(brandOffsetSlider).toHaveAttribute('step', '1');
  await brandOffsetSlider.focus();
  await brandOffsetSlider.press('Home');
  await saveSettings(page);
  await expectSaved(page, { homeBrandOffset: 0 });
  await brandOffsetSlider.press('ArrowRight');
  await saveSettings(page);
  await expectSaved(page, { homeBrandOffset: 1 });
  await brandOffsetSlider.press('End');
  await saveSettings(page);
  await expectSaved(page, { homeBrandOffset: 160 });
  await selectSettingsFor(page, 'navigationDuration');
  for (const [draft, expected] of [['99', 200], ['1800', 1600], ['755', 760], ['', 760]]) {
    await duration.fill(draft);
    await duration.press('Tab');
    await expect(duration).toHaveValue(String(expected));
    await saveSettings(page);
    await expectSaved(page, { navigationDuration: expected });
  }
  const slider = panel(page).getByRole('slider', { name: '导航动画时长', exact: true });
  await slider.focus();
  await slider.press('Home');
  await saveSettings(page);
  await expectSaved(page, { navigationDuration: 200 });
  await slider.press('End');
  await saveSettings(page);
  await expectSaved(page, { navigationDuration: 1600 });
  await editNumber(page, '导航动画时长', 1300);
  for (const curve of ['soft', 'smooth', 'swift']) {
    await easing.selectOption(curve);
    await saveSettings(page);
    await expectSaved(page, { navigationEasing: curve });
  }
  await editNumber(page, '紧凑导航图标间距', 28);
  await editNumber(page, '紧凑导航右侧留白', 96);
  await editNumber(page, '首页品牌右移距离', 64);
  await editNumber(page, '导航辅助文字字号', 16);
  await saveSettings(page);
  await expectSaved(page, { navigationDuration: 1300, navigationEasing: 'swift', compactNavGap: 28, compactNavInset: 96, homeBrandOffset: 64, helperFontSize: 16 });

  await reloadPage(page);
  await expect(panel(page)).toHaveCount(0);
  await openSettings(page);
  await expect(panel(page).getByRole('tablist', { name: '设置分类', exact: true }).getByRole('tab', { name: '公共模块', exact: true })).toHaveAttribute('aria-selected', 'true');
  await selectSettingsTab(page, '动画');
  await expect(duration).toHaveValue('1300');
  await expect(easing).toHaveValue('swift');
  await selectSettingsFor(page, '紧凑导航图标间距数值');
  await expect(panel(page).getByRole('spinbutton', { name: '紧凑导航图标间距数值' })).toHaveValue('28');
  await selectSettingsFor(page, '紧凑导航右侧留白数值');
  await expect(panel(page).getByRole('spinbutton', { name: '紧凑导航右侧留白数值' })).toHaveValue('96');
  await selectSettingsFor(page, 'homeBrandOffset');
  await expect(brandOffset).toHaveValue('64');
  await panel(page).getByRole('button', { name: '恢复默认参数' }).click();
  await saveSettings(page);
  await expectSaved(page, { navigationDuration: 720, navigationEasing: 'smooth', compactNavGap: 14, compactNavInset: 48, homeBrandOffset: 24, helperFontSize: 18, headerTransparency: 20, pushPage: true });
  await selectSettingsFor(page, 'navigationDuration');
  await expect(duration).toHaveValue('720');
  await expect(easing).toHaveValue('smooth');
  await selectSettingsFor(page, 'homeBrandOffset');
  await expect(brandOffset).toHaveValue('24');
});

test('旧v2设置补齐轮播默认值，轮播参数独立保存刷新并可恢复默认', async ({ page }) => {
  const navigationSettings = {
    navigationTypographyVersion: 2, navFontSize: 20, helperFontSize: 16,
    helperTransparency: 37, navigationDuration: 960, navigationEasing: 'swift',
    compactNavGap: 21, compactNavInset: 76, pushPage: true,
  };
  await page.addInitScript(({ key, saved }) => {
    if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(saved));
  }, { key: settingsKey, saved: navigationSettings });
  await loadPage(page);
  await expectSaved(page, { ...navigationSettings, ...carouselDefaults });
  await openSettings(page);
  await selectSettingsTab(page, '轮播');
  const autoplay = panel(page).getByRole('checkbox', { name: '照片自动播放', exact: true });
  await expect(autoplay).toBeChecked();
  await autoplay.uncheck();
  await editNumber(page, '自动播放间隔', 9);
  await editNumber(page, '离开后恢复等待', 5);
  await editNumber(page, '照片过渡时长', 1050);
  await editNumber(page, '照片聚焦比例', 107);
  const changed = {
    carouselAutoplay: false, carouselInterval: 9, carouselResumeDelay: 5,
    carouselTransitionDuration: 1050, carouselFocusScale: 107,
  };
  await saveSettings(page);
  await expectSaved(page, { ...navigationSettings, ...changed });

  await reloadPage(page);
  await expect(panel(page)).toHaveCount(0);
  await expectSaved(page, { ...navigationSettings, ...changed });
  await openSettings(page);
  await selectSettingsTab(page, '轮播');
  await expect(autoplay).not.toBeChecked();
  for (const [label, value] of [['自动播放间隔', 9], ['离开后恢复等待', 5], ['照片过渡时长', 1050], ['照片聚焦比例', 107]]) {
    await expect(panel(page).getByRole('spinbutton', { name: `${label}数值`, exact: true })).toHaveValue(String(value));
  }
  await selectSettingsFor(page, '导航标题字号数值');
  await expect(panel(page).getByRole('spinbutton', { name: '导航标题字号数值', exact: true })).toHaveValue('20');
  await selectSettingsTab(page, '轮播');
  await panel(page).getByRole('button', { name: '恢复默认参数' }).click();
  await saveSettings(page);
  await expectSaved(page, { ...carouselDefaults, navFontSize: 26, navigationTypographyVersion: 2, pushPage: true, headerTransparency: 20, homeBrandOffset: 24 });
  await expect(autoplay).toBeChecked();
  for (const [label, value] of [['自动播放间隔', 6], ['离开后恢复等待', 3], ['照片过渡时长', 800], ['照片聚焦比例', 104]]) {
    await expect(panel(page).getByRole('spinbutton', { name: `${label}数值`, exact: true })).toHaveValue(String(value));
  }
});

test('280px侧栏完整显示设置主分类，轮播滑块及数值校验范围与步长', async ({ page }) => {
  await loadPage(page);
  await openSettings(page);
  await editNumber(page, '设置面板宽度', 280);
  await expect.poll(() => sidebarWidth(page)).toBe(280);
  const tabs = panel(page).getByRole('tablist', { name: '设置分类', exact: true }).getByRole('tab');
  await expect(tabs).toHaveText(settingsPages);
  for (const tab of await tabs.all()) await expect(tab).toBeVisible();
  const tabLayout = await panel(page).getByRole('tablist', { name: '设置分类', exact: true }).evaluate(element => {
    const bounds = element.getBoundingClientRect();
    return {
      overflow: element.scrollWidth > element.clientWidth,
      fitted: Array.from(element.querySelectorAll('button')).every(button => {
        const buttonBounds = button.getBoundingClientRect();
        return buttonBounds.left >= bounds.left && buttonBounds.right <= bounds.right && button.scrollWidth <= button.clientWidth;
      }),
    };
  });
  expect(tabLayout).toEqual({ overflow: false, fitted: true });
  await selectSettingsTab(page, '轮播');
  for (const [label, key, min, max, step] of [
    ['自动播放间隔', 'carouselInterval', 2, 30, 1],
    ['离开后恢复等待', 'carouselResumeDelay', 1, 15, 1],
    ['照片过渡时长', 'carouselTransitionDuration', 300, 1600, 50],
    ['照片聚焦比例', 'carouselFocusScale', 101, 110, 1],
  ]) {
    const slider = panel(page).getByRole('slider', { name: label, exact: true });
    await expect(slider).toHaveAttribute('min', String(min));
    await expect(slider).toHaveAttribute('max', String(max));
    await expect(slider).toHaveAttribute('step', String(step));
    await slider.focus();
    await slider.press('Home');
    await saveSettings(page);
    await expectSaved(page, { [key]: min });
    await slider.press('ArrowRight');
    await saveSettings(page);
    await expectSaved(page, { [key]: min + step });
    await slider.press('End');
    await saveSettings(page);
    await expectSaved(page, { [key]: max });
    const input = panel(page).getByRole('spinbutton', { name: `${label}数值`, exact: true });
    for (const [draft, expected] of [[min - 1, min], [max + 1, max]]) {
      await input.fill(String(draft));
      await input.press('Tab');
      await expect(input).toHaveValue(String(expected));
      await saveSettings(page);
      await expectSaved(page, { [key]: expected });
    }
  }
  await selectSettingsFor(page, '照片过渡时长数值');
  const duration = panel(page).getByRole('spinbutton', { name: '照片过渡时长数值', exact: true });
  await duration.fill('1025');
  await duration.press('Tab');
  await expect(duration).toHaveValue('1050');
  await saveSettings(page);
  await expectSaved(page, { carouselTransitionDuration: 1050 });
});

test('顶栏和侧栏材质分别调节透明及模糊，文字、图标和控件不随容器淡出', async ({ page }) => {
  await loadPage(page);
  await openSettings(page);
  await expect(headerSurfaces(page)).toHaveCount(1);
  await editNumber(page, '顶栏透明度', 100);
  await editNumber(page, '顶栏模糊强度', 0);
  await expect(panel(page).getByRole('slider', { name: '顶栏透明度', exact: true })).toHaveValue('100');
  await expect(page.locator('.site-header')).toHaveCSS('opacity', '1');
  await expect(page.locator('.site-header')).toHaveCSS('backdrop-filter', 'none');
  await expect(page.locator('.site-nav-heading strong').first()).toHaveCSS('opacity', '1');
  for (const icon of await page.locator('.site-nav-icon').all()) {
    await expect(icon).toHaveCSS('opacity', '1');
    await expect(icon.locator('svg')).toHaveCSS('filter', 'none');
    await expect(icon.locator('svg image')).toHaveCount(1);
  }
  expect(await page.locator('.site-header').evaluate(element => {
    const style = getComputedStyle(element);
    return style.backgroundImage === 'none' && style.backgroundColor === 'rgba(0, 0, 0, 0)' &&
      element.querySelectorAll(':scope > .navigation-surface').length === 1 &&
      getComputedStyle(element.querySelector(':scope > .navigation-surface')).backgroundImage.includes('rgba(104, 23, 15, 0)');
  })).toBe(true);
  await selectSettingsFor(page, '侧栏透明度数值');
  await expect(panel(page).getByRole('spinbutton', { name: '侧栏透明度数值' })).toHaveValue('14');
  await expect(panel(page)).toHaveCSS('backdrop-filter', 'blur(18px)');

  await editNumber(page, '顶栏模糊强度', 24);
  for (const surface of await headerSurfaces(page).all()) await expect(surface).toHaveCSS('backdrop-filter', 'blur(24px)');
  await editNumber(page, '侧栏透明度', 100);
  await editNumber(page, '侧栏模糊强度', 0);
  await expect(panel(page)).toHaveCSS('opacity', '1');
  await expect(panel(page)).toHaveCSS('backdrop-filter', 'none');
  await expect(panel(page).getByRole('heading', { name: '开发者参数设置' })).toHaveCSS('opacity', '1');
  await selectSettingsFor(page, '侧栏透明度数值');
  await expect(panel(page).getByRole('spinbutton', { name: '侧栏透明度数值' })).toHaveCSS('opacity', '1');
  expect(await panel(page).evaluate(element => {
    const style = getComputedStyle(element);
    return style.backgroundColor === 'rgba(255, 246, 228, 0)' &&
      style.borderLeftColor === 'rgba(199, 148, 86, 0)';
  })).toBe(true);
  await editNumber(page, '侧栏模糊强度', 22);
  await expect(panel(page)).toHaveCSS('backdrop-filter', 'blur(22px)');
  for (const surface of await headerSurfaces(page).all()) await expect(surface).toHaveCSS('backdrop-filter', 'blur(24px)');
});

test('推开页面按侧栏宽度留空，窄窗口自动覆盖并在加宽后恢复用户偏好', async ({ page }) => {
  await loadPage(page);
  await openSettings(page);
  await selectSettingsTab(page, '布局');
  await expect(panel(page).getByRole('checkbox', { name: '设置面板推开页面' })).toBeChecked();
  await expect(page.locator('.site-shell')).toHaveAttribute('data-settings-layout', 'push');
  await expectPageWidth(page, 340);
  await panel(page).getByRole('checkbox', { name: '设置面板推开页面' }).uncheck();
  await expect(page.locator('.site-shell')).toHaveAttribute('data-settings-layout', 'overlay');
  await expectPageWidth(page);
  await panel(page).getByRole('checkbox', { name: '设置面板推开页面' }).check();
  await expect(page.locator('.site-shell')).toHaveAttribute('data-settings-layout', 'push');
  await expectPageWidth(page, 340);
  await editNumber(page, '设置面板宽度', 480);
  await expectPageWidth(page, 480);

  await page.setViewportSize({ width: 1200, height: 900 });
  await expect(page.locator('.site-shell')).toHaveAttribute('data-settings-layout', 'overlay');
  await expectPageWidth(page);
  await expect(panel(page)).toContainText('窗口空间不足');
  await expect(panel(page).getByRole('checkbox', { name: '设置面板推开页面' })).toBeChecked();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await saveSettings(page);
  await expectSaved(page, { pushPage: true, panelWidth: 480 });

  await page.setViewportSize({ width: 1920, height: 1080 });
  await expect(page.locator('.site-shell')).toHaveAttribute('data-settings-layout', 'push');
  await expectPageWidth(page, 480);
  await panel(page).getByRole('button', { name: '关闭开发者参数' }).click();
  await expectPageWidth(page);
});

test('导航标题与辅助文字可独立调整，滑块和数值输入校验字号边界', async ({ page }) => {
  await page.setViewportSize({ width: 3440, height: 1440 });
  await loadPage(page);
  await openSettings(page);
  await selectSettingsTab(page, '导航');
  await expectNavigationSizes(page, 26, 18);
  await editNumber(page, '导航辅助文字字号', 12);
  await expectNavigationSizes(page, 26, 12);
  await editNumber(page, '导航标题字号', 28);
  await expectNavigationSizes(page, 28, 12);
  await saveSettings(page);
  await expectSaved(page, { navFontSize: 28, helperFontSize: 12 });

  const helperSlider = panel(page).getByRole('slider', { name: '导航辅助文字字号', exact: true });
  await helperSlider.focus();
  await helperSlider.press('Home');
  await expectNavigationSizes(page, 28, 10);
  await helperSlider.press('End');
  await expectNavigationSizes(page, 28, 28);
  await selectSettingsFor(page, '导航辅助文字字号数值');
  const helperInput = panel(page).getByRole('spinbutton', { name: '导航辅助文字字号数值', exact: true });
  for (const [draft, expected] of [['99', 28], ['-1', 10], ['', 10], ['18.6', 19]]) {
    await helperInput.fill(draft);
    await helperInput.press('Tab');
    await expect(helperInput).toHaveValue(String(expected));
    await expectNavigationSizes(page, 28, expected);
    await saveSettings(page);
    await expectSaved(page, { navFontSize: 28, helperFontSize: expected });
  }

  await selectSettingsFor(page, '导航标题字号数值');
  const titleInput = panel(page).getByRole('spinbutton', { name: '导航标题字号数值', exact: true });
  await titleInput.fill('-1');
  await titleInput.press('Tab');
  await expect(titleInput).toHaveValue('14');
  await expectNavigationSizes(page, 14, 19);
});

test('章节原毛笔标题继承导航字号设置，刷新与返回首页后保持且品牌文字只在首页出现', async ({ page }) => {
  await page.setViewportSize({ width: 3440, height: 1440 });
  await loadPage(page);
  const labels = await page.locator('.site-nav-heading strong').elementHandles();
  await page.locator('.site-nav-item[data-route="state"]').click();
  await expect(page.locator('.site-header')).toHaveAttribute('data-nav-animating', 'false');
  await openSettings(page);
  await editNumber(page, '导航标题字号', 28);
  await editNumber(page, '导航辅助文字字号', 15);
  await expectNavigationSizes(page, 28, 15);
  await expect(page.locator('.site-brand-copy')).toBeHidden();
  await expect(page.locator('.site-brand-capsule .entry-lion-emblem')).toBeVisible();
  await expect(page.locator('.site-nav-short-label')).toHaveCount(0);
  for (const [index, label] of labels.entries()) {
    expect(await label.evaluate((element, index) => element === document.querySelectorAll('.site-nav-heading strong')[index], index)).toBe(true);
    expect(await label.evaluate(element => getComputedStyle(element).fontFamily)).toContain('Nanfeng Navigation Brush');
  }
  for (const helper of await page.locator('.site-nav-description').all()) await expect(helper).toBeHidden();
  await saveSettings(page, false);
  await reloadPage(page);
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'state');
  await expectNavigationSizes(page, 28, 15);
  await expect(page.locator('.site-brand-copy')).toBeHidden();
  for (const label of await page.locator('.site-nav-heading strong').all()) await expect(label).toBeVisible();
  await page.locator('.site-brand-capsule').click();
  await expect(page.locator('.site-header')).toHaveAttribute('data-nav-animating', 'false');
  await expect(page.locator('.site-brand-name')).toBeVisible();
  await expectNavigationSizes(page, 28, 15);
  for (const helper of await page.locator('.site-nav-description').all()) await expect(helper).toBeVisible();
});

test('参数与独立字号持久保存，刷新保持侧栏关闭，恢复默认同时恢复外观与尺寸', async ({ page }) => {
  // Leave enough width for the requested fonts while the panel now pushes by default.
  await page.setViewportSize({ width: 3440, height: 1440 });
  await loadPage(page);
  await openSettings(page);
  await editNumber(page, '顶栏透明度', 42);
  await editNumber(page, '侧栏模糊强度', 9);
  await editNumber(page, '设置面板宽度', 430);
  await selectSettingsTab(page, '导航');
  await editNumber(page, '顶栏高度', 123);
  await editNumber(page, '导航标题字号', 23);
  await editNumber(page, '导航辅助文字字号', 15);
  await saveSettings(page);
  await expectSaved(page, { headerTransparency: 42, sidebarBlur: 9, panelWidth: 430, headerHeight: 123, navFontSize: 23, helperFontSize: 15 });
  await expectNavigationSizes(page, 23, 15);

  await reloadPage(page);
  await expect(panel(page)).toHaveCount(0);
  await expect.poll(() => headerHeight(page)).toBe(123);
  await openSettings(page);
  await selectSettingsFor(page, '顶栏透明度数值');
  await expect(panel(page).getByRole('spinbutton', { name: '顶栏透明度数值' })).toHaveValue('42');
  await selectSettingsFor(page, '侧栏模糊强度数值');
  await expect(panel(page).getByRole('spinbutton', { name: '侧栏模糊强度数值' })).toHaveValue('9');
  await expect.poll(() => sidebarWidth(page)).toBe(430);
  await selectSettingsFor(page, '导航标题字号数值');
  await expect(panel(page).getByRole('spinbutton', { name: '导航标题字号数值' })).toHaveValue('23');
  await selectSettingsFor(page, '导航辅助文字字号数值');
  await expect(panel(page).getByRole('spinbutton', { name: '导航辅助文字字号数值' })).toHaveValue('15');
  await expectNavigationSizes(page, 23, 15);
  await panel(page).getByRole('button', { name: '恢复默认参数' }).click();
  await saveSettings(page);
  await expectSaved(page, { headerTransparency: 20, sidebarTransparency: 14, sidebarBlur: 18, headerHeight: 90, navFontSize: 26, helperFontSize: 18, panelWidth: 340, pushPage: true, homeBrandOffset: 24 });
  await expectNavigationSizes(page, 26, 18);
  await expect.poll(() => headerHeight(page)).toBe(90);
  await expect.poll(() => sidebarWidth(page)).toBe(340);
});

test('旧默认字号 20 只迁移一次至 26，其他参数保留，随后手选 20 不再升级', async ({ page }) => {
  await page.addInitScript(({ key, saved }) => {
    if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(saved));
  }, { key: settingsKey, saved: { navFontSize: 20, headerTransparency: 42, sidebarBlur: 9, headerHeight: 137, panelWidth: 430, pushPage: true } });
  await loadPage(page);
  await expectSaved(page, { navFontSize: 26, helperFontSize: 18, headerTransparency: 42, sidebarBlur: 9, headerHeight: 137, panelWidth: 430, pushPage: true });
  await openSettings(page);
  await selectSettingsFor(page, '导航标题字号数值');
  await expect(panel(page).getByRole('spinbutton', { name: '导航标题字号数值' })).toHaveValue('26');
  await editNumber(page, '导航标题字号', 20);
  await saveSettings(page);
  await expectSaved(page, { navFontSize: 20 });
  await reloadPage(page);
  await expect(panel(page)).toHaveCount(0);
  await expectSaved(page, { navFontSize: 20, headerTransparency: 42, sidebarBlur: 9, headerHeight: 137, panelWidth: 430, pushPage: true });
  await openSettings(page);
  await selectSettingsFor(page, '导航标题字号数值');
  await expect(panel(page).getByRole('spinbutton', { name: '导航标题字号数值' })).toHaveValue('20');
});

test('已有 v2 的标题字号 20 保留，缺失的辅助字号补为 18 且刷新保持', async ({ page }) => {
  await page.addInitScript(({ key, saved }) => {
    if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(saved));
  }, { key: settingsKey, saved: { navigationTypographyVersion: 2, navFontSize: 20, helperTransparency: 37 } });
  await loadPage(page);
  await expectSaved(page, { navigationTypographyVersion: 2, navFontSize: 20, helperFontSize: 18, helperTransparency: 37,
    navigationDuration: 720, navigationEasing: 'smooth', compactNavGap: 14, compactNavInset: 48,
    headerTransparency: 20, pushPage: true, homeBrandOffset: 24 });
  await expectNavigationSizes(page, 20, 18);
  await reloadPage(page);
  await expectSaved(page, { navFontSize: 20, helperFontSize: 18, helperTransparency: 37,
    headerTransparency: 20, pushPage: true, homeBrandOffset: 24 });
  await openSettings(page);
  await selectSettingsFor(page, '导航标题字号数值');
  await expect(panel(page).getByRole('spinbutton', { name: '导航标题字号数值' })).toHaveValue('20');
  await selectSettingsFor(page, '导航辅助文字字号数值');
  await expect(panel(page).getByRole('spinbutton', { name: '导航辅助文字字号数值' })).toHaveValue('18');
});

test('已有透明度、覆盖偏好和零品牌位移保留，恢复默认采用新参数', async ({ page }) => {
  const saved = { navigationTypographyVersion: 2, navFontSize: 20, headerTransparency: 18,
    pushPage: false, homeBrandOffset: 0, brandPadding: 37 };
  await page.addInitScript(({ key, saved }) => {
    if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(saved));
  }, { key: settingsKey, saved });
  await loadPage(page);
  await expectSaved(page, saved);
  await openSettings(page);
  await selectSettingsFor(page, '顶栏透明度数值');
  await expect(panel(page).getByRole('spinbutton', { name: '顶栏透明度数值' })).toHaveValue('18');
  await expect(page.locator('.site-shell')).toHaveAttribute('data-settings-layout', 'overlay');
  await expectPageWidth(page);
  await selectSettingsFor(page, '首页品牌右移距离数值');
  await expect(panel(page).getByRole('spinbutton', { name: '首页品牌右移距离数值' })).toHaveValue('0');
  await reloadPage(page);
  await expect(panel(page)).toHaveCount(0);
  await expectSaved(page, saved);
  await openSettings(page);
  await selectSettingsTab(page, '布局');
  await expect(panel(page).getByRole('checkbox', { name: '设置面板推开页面' })).not.toBeChecked();
  await panel(page).getByRole('button', { name: '恢复默认参数' }).click();
  await saveSettings(page);
  await expectSaved(page, { navigationTypographyVersion: 2, navFontSize: 26, headerTransparency: 20,
    pushPage: true, homeBrandOffset: 24, brandPadding: 24 });
  await expect(page.locator('.site-shell')).toHaveAttribute('data-settings-layout', 'push');
  await expectPageWidth(page, 340);
  await selectSettingsFor(page, '首页品牌右移距离数值');
  await expect(panel(page).getByRole('spinbutton', { name: '首页品牌右移距离数值' })).toHaveValue('24');
});

test('损坏或不合法的保存参数可恢复，浏览器存储不可用时仍能实时调整', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 3440, height: 1440 });
  await loadPage(page);
  for (const [badSaved, expected] of [
    ['{broken', { headerTransparency: 20, headerBlur: 12, headerHeight: 90, helperFontSize: 18 }],
    [JSON.stringify({ headerTransparency: 180, headerBlur: -8, sidebarTransparency: 'bad', navFontSize: '20', helperFontSize: '18', headerHeight: 999, panelWidth: null, pushPage: 'yes', homeBrandOffset: '24' }),
      { headerTransparency: 100, headerBlur: 0, sidebarTransparency: 14, headerHeight: 180, helperFontSize: 18 }],
    [JSON.stringify({ helperFontSize: 99 }), { helperFontSize: 28 }],
    [JSON.stringify({ helperFontSize: -1 }), { helperFontSize: 10 }],
    [JSON.stringify({ navigationDuration: 99, navigationEasing: 'unknown', compactNavGap: -1, compactNavInset: 999 }),
      { navigationDuration: 200, navigationEasing: 'smooth', compactNavGap: 4, compactNavInset: 160 }],
    [JSON.stringify({ navigationDuration: 1799, navigationEasing: 2, compactNavGap: 99, compactNavInset: -1 }),
      { navigationDuration: 1600, navigationEasing: 'smooth', compactNavGap: 36, compactNavInset: 16 }],
    [JSON.stringify({ homeBrandOffset: -1 }), { homeBrandOffset: 0 }],
    [JSON.stringify({ homeBrandOffset: 999 }), { homeBrandOffset: 160 }],
    [JSON.stringify({ homeBrandOffset: 31.6 }), { homeBrandOffset: 32 }],
  ]) {
    await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: settingsKey, value: badSaved });
    await reloadPage(page);
    await expect(panel(page)).toHaveCount(0);
    await expectSaved(page, { homeBrandOffset: 24, ...expected, navFontSize: 26, panelWidth: 340, pushPage: true });
  }

  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', {
    configurable: true,
    get() { throw new DOMException('Storage blocked for this test', 'SecurityError'); },
  }));
  await reloadPage(page);
  await openSettings(page);
  await editNumber(page, '顶栏透明度', 55);
  await editNumber(page, '设置面板宽度', 420);
  await selectSettingsTab(page, '导航');
  await editNumber(page, '导航辅助文字字号', 12);
  await expectNavigationSizes(page, 26, 12);
  await expect.poll(() => sidebarWidth(page)).toBe(420);
  await selectSettingsTab(page, '外观');
  await expect(panel(page).getByRole('slider', { name: '顶栏透明度', exact: true })).toHaveValue('55');
  await reloadPage(page);
  await expect(panel(page)).toHaveCount(0);
  await openSettings(page);
  await selectSettingsFor(page, '顶栏透明度数值');
  await expect(panel(page).getByRole('spinbutton', { name: '顶栏透明度数值' })).toHaveValue('20');
  await expectNavigationSizes(page, 26, 18);
  expect(errors).toEqual([]);
});

test('整条边界可悬停显示中央握柄，拖动实时预览，设置内拖动需显式保存', async ({ page }) => {
  await loadPage(page);
  const top = topEdge(page);
  await expect(top.locator('span')).toHaveCSS('opacity', '0');
  let bounds = await top.boundingBox();
  await page.mouse.move(100, bounds.y + bounds.height / 2);
  await expect(top.locator('span')).toHaveCSS('opacity', '1');
  expect(bounds.width).toBe(await shellWidth(page));
  const grip = await top.locator('span').boundingBox();
  expect(grip.width).toBeLessThan(bounds.width / 4);
  expect(grip.x + grip.width / 2).toBeCloseTo(bounds.x + bounds.width / 2, 1);
  await expectSaved(page, { headerHeight: 90, panelWidth: 340 });

  await dragStart(page, top, 'y', 37);
  await expect.poll(() => headerHeight(page)).toBe(127);
  await expectSaved(page, { headerHeight: 90 });
  await page.mouse.up();
  await expectSaved(page, { headerHeight: 127 });
  await expectNoDrag(page);

  await openSettings(page);
  const side = sideEdge(page);
  bounds = await side.boundingBox();
  expect(bounds.height).toBe(1080);
  await page.mouse.move(bounds.x + bounds.width / 2, 120);
  await expect(side.locator('span')).toHaveCSS('opacity', '1');
  const sideGrip = await side.locator('span').boundingBox();
  expect(sideGrip.height).toBeLessThan(bounds.height / 4);
  expect(sideGrip.y + sideGrip.height / 2).toBeCloseTo(bounds.y + bounds.height / 2, 1);
  await dragStart(page, side, 'x', -113);
  await expect.poll(() => sidebarWidth(page)).toBe(453);
  await expectSaved(page, { panelWidth: 340 });
  await page.mouse.up();
  await expectSaved(page, { panelWidth: 340 });
  await saveSettings(page);
  await expectSaved(page, { panelWidth: 453, headerHeight: 127 });
  await expectNoDrag(page);
});

test('Escape、pointercancel 和拖动中关闭侧栏均撤销预览并清理全局拖动状态', async ({ page }) => {
  await loadPage(page);
  await openSettings(page);
  await dragStart(page, topEdge(page), 'y', 28);
  await expect.poll(() => headerHeight(page)).toBe(118);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect.poll(() => headerHeight(page)).toBe(90);
  await expect(panel(page)).toBeVisible();
  await expectSaved(page, { headerHeight: 90 });
  await expectNoDrag(page);

  await page.evaluate(() => window.addEventListener('pointerdown', event => {
    window.testResizePointerId = event.pointerId;
  }, { capture: true, once: true }));
  await dragStart(page, sideEdge(page), 'x', -90);
  await expect.poll(() => sidebarWidth(page)).toBe(430);
  await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointercancel', {
    pointerId: window.testResizePointerId, pointerType: 'mouse', bubbles: true,
  })));
  await page.mouse.up();
  await expect.poll(() => sidebarWidth(page)).toBe(340);
  await expectSaved(page, { panelWidth: 340 });
  await expectNoDrag(page);

  await dragStart(page, sideEdge(page), 'x', -100);
  await expect.poll(() => sidebarWidth(page)).toBe(440);
  // Activate the close control while the pointer remains captured to exercise unmount cleanup.
  await panel(page).getByRole('button', { name: '关闭开发者参数' }).evaluate(button => button.click());
  await expect(page.getByRole('alertdialog', { name: '放弃未保存的设置？' })).toBeVisible();
  await page.getByRole('button', { name: '放弃更改', exact: true }).evaluate(button => button.click());
  await page.mouse.up();
  await expect(panel(page)).toHaveCount(0);
  await expect(trigger(page)).toBeFocused();
  await expectSaved(page, { panelWidth: 340 });
  await expectNoDrag(page);
  await page.mouse.move(100, 400);
  await openSettings(page);
  await expect.poll(() => sidebarWidth(page)).toBe(340);
});

test('尺寸边界支持方向键、加速与上下限，双击仅恢复对应默认尺寸', async ({ page }) => {
  await loadPage(page);
  const top = topEdge(page);
  await top.focus();
  await page.keyboard.press('ArrowDown');
  await expectSaved(page, { headerHeight: 91 });
  await page.keyboard.press('Shift+ArrowDown');
  await expectSaved(page, { headerHeight: 101 });
  await page.keyboard.press('Home');
  await expectSaved(page, { headerHeight: 64 });
  await page.keyboard.press('End');
  await expectSaved(page, { headerHeight: 180 });
  await top.dblclick({ position: { x: 100, y: 6 } });
  await expectSaved(page, { headerHeight: 90 });

  await openSettings(page);
  await editNumber(page, '顶栏透明度', 45);
  const side = sideEdge(page);
  await side.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(side).toHaveAttribute('aria-valuenow', '341');
  await page.keyboard.press('Shift+ArrowLeft');
  await expect(side).toHaveAttribute('aria-valuenow', '351');
  await page.keyboard.press('Home');
  await expect(side).toHaveAttribute('aria-valuenow', '280');
  await page.keyboard.press('End');
  await expect(side).toHaveAttribute('aria-valuenow', '760');
  await side.dblclick({ position: { x: 6, y: 120 } });
  await expectSaved(page, { panelWidth: 340, headerTransparency: 20 });
  await saveSettings(page);
  await expectSaved(page, { panelWidth: 340, headerHeight: 90, headerTransparency: 45 });
});

test('设置和尺寸调整保留首页视频及模型画布实例，切换章节与模型控件继续可用', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await loadPage(page);
  await expect.poll(() => page.locator('#entryLionVideo').evaluate(video => video.readyState)).toBeGreaterThanOrEqual(2);
  const video = await page.locator('#entryLionVideo').elementHandle();
  await openSettings(page);
  await selectSettingsTab(page, '布局');
  await panel(page).getByRole('checkbox', { name: '设置面板推开页面' }).check();
  await editNumber(page, '设置面板宽度', 480);
  await selectSettingsTab(page, '导航');
  await editNumber(page, '顶栏高度', 115);
  expect(await video.evaluate(element => element.isConnected && element === document.querySelector('#entryLionVideo'))).toBe(true);
  await saveSettings(page, false);
  await page.locator('.site-navigation [data-route="model"]').click();
  await expect(page.locator('#modelStatus')).toContainText('模型已载入', { timeout: 45_000 });
  await expect(page.locator('#sceneContainer canvas')).toHaveCount(1);
  const canvas = await page.locator('#sceneContainer canvas').elementHandle();
  const rendererEnvironment = await canvas.evaluate(element => {
    const gl = element.getContext('webgl2') ?? element.getContext('webgl');
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      userAgent: navigator.userAgent, devicePixelRatio,
      renderer: gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER),
      vendor: gl.getParameter(debug ? debug.UNMASKED_VENDOR_WEBGL : gl.VENDOR),
      webgl: gl.getParameter(gl.VERSION),
    };
  });
  await test.info().attach('browser-and-webgl-environment', {
    body: JSON.stringify({ chrome: page.context().browser().version(), ...rendererEnvironment }, null, 2),
    contentType: 'application/json',
  });
  await openSettings(page);
  await editNumber(page, '设置面板宽度', 520);
  await editNumber(page, '顶栏高度', 100);
  await editNumber(page, '侧栏模糊强度', 22);
  expect(await canvas.evaluate(element => element.isConnected && element === document.querySelector('#sceneContainer canvas'))).toBe(true);
  await saveSettings(page, false);
  await page.locator('#toggleRotate').click();
  await expect(page.locator('#toggleRotate')).toHaveAttribute('aria-pressed', 'true');
  const movingMouth = page.locator('#modelHotspots [data-id="mouth"]');
  await expect(movingMouth).toBeVisible();
  const mouthBounds = await movingMouth.boundingBox();
  expect(mouthBounds?.width).toBeGreaterThan(0);
  // Projected labels move with the rotating lion, so a locator's stable-layout
  // auto-wait would never finish. Send an actual pointer click at its center.
  await page.mouse.click(mouthBounds.x + mouthBounds.width / 2, mouthBounds.y + mouthBounds.height / 2);
  await expect(page.locator('#panelTitle')).toHaveText('狮嘴');
  await expect(page.locator('#modelStage')).toHaveAttribute('data-focus-state', 'mouth');
  await expect(page.locator('#toggleRotate')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('.site-navigation [data-route="action"]').click();
  await expect(page.locator('#chapterTitle')).toHaveText('动作');
  await page.locator('.site-navigation [data-route="state"]').click();
  await expect(page.locator('#chapterTitle')).toHaveText('神态');
  await expect(panel(page)).toHaveCount(0);
  await openSettings(page);
  await panel(page).getByRole('button', { name: '关闭开发者参数' }).click();
  await page.locator('.site-navigation [data-route="model"]').click();
  expect(await canvas.evaluate(element => element === document.querySelector('#sceneContainer canvas'))).toBe(true);
  await expect(page.locator('#sceneContainer canvas')).toHaveAttribute('data-full-hair-groups', '33');
  await expect(page.locator('#sceneContainer canvas')).toHaveAttribute('data-full-hair-strands', '2295421');
  expect(errors).toEqual([]);
  await canvas.dispose();
  await video.dispose();
});

test('七类底板独立参数可保存刷新，完全透明时文字与按钮保留', async ({ page }) => {
  test.setTimeout(150_000);
  await loadPage(page);
  await openSettings(page);
  const surfaces = [
    ['bookTitle', '书册标题底板'], ['bookDetails', '书册详情底板'],
    ['cultureTitle', '文化标题底板'], ['cultureBody', '文化正文底板'],
    ['modelOverlay', '结构资料底板'], ['actionOverlay', '动作目录底板'], ['videoOverlay', '视频提示底板'],
  ];
  const saved = {};
  for (const [prefix, label] of surfaces) {
    await selectSettingsFor(page, prefix);
    for (const [suffix, field, value] of [['Width', '宽度', 82], ['Height', '高度', 230], ['Transparency', '透明度', 36], ['Blur', '模糊强度', 17], ['Radius', '圆角', 27]]) {
      const input = panel(page).getByRole('spinbutton', { name: `${label}${prefix === 'bookTitle' && suffix === 'Height' ? '最小高度' : field}数值`, exact: true });
      await input.fill(String(value));
      await input.press('Tab');
      saved[`${prefix}${suffix}`] = value;
    }
    await panel(page).getByLabel(`${label}底色`, { exact: true }).evaluate(input => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '#f2e6cf');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    saved[`${prefix}Color`] = '#f2e6cf';
  }
  await saveSettings(page);
  await expectSaved(page, saved);
  for (const [prefix, count] of [['bookTitle', 1], ['bookDetails', 1], ['cultureTitle', 2], ['cultureBody', 9]]) {
    await expect(page.locator('.archive-reading-panel[data-surface="' + prefix + '"]')).toHaveCount(count);
  }
  for (const surface of await page.locator('.archive-reading-panel[data-surface]').all()) {
    await expect(surface).toHaveCSS('border-radius', '27px');
    await expect(surface).toHaveCSS('min-height', '230px');
    if (['bookTitle', 'cultureTitle'].includes(await surface.getAttribute('data-surface'))) {
      await expect(surface).toHaveCSS('backdrop-filter', 'none');
      await expect(surface).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      expect(await surface.evaluate(node => {
        const paper = getComputedStyle(node, '::before');
        return [paper.borderRadius, paper.backdropFilter, paper.backgroundColor];
      })).toEqual(['27px', 'blur(17px)', 'rgba(242, 230, 207, 0.64)']);
    } else {
      await expect(surface).toHaveCSS('backdrop-filter', 'blur(17px)');
      await expect(surface).toHaveCSS('background-color', 'rgba(242, 230, 207, 0.64)');
    }
  }
  await reloadPage(page);
  await expectSaved(page, saved);
  await openSettings(page);
  await selectSettingsFor(page, '文化正文底板透明度数值');
  const transparency = panel(page).getByRole('spinbutton', { name: '文化正文底板透明度数值', exact: true });
  await transparency.fill('100');
  await transparency.press('Tab');
  const body = page.locator('[data-surface="cultureBody"]').first();
  await expect(body).toHaveCSS('backdrop-filter', 'none');
  await expect(body).toHaveCSS('background-color', 'rgba(242, 230, 207, 0)');
  await expect(body).toHaveCSS('opacity', '1');
  await expect(body.locator('h3')).toHaveCSS('opacity', '1');
  expect(await page.locator('[data-surface="bookTitle"]').evaluate(node => getComputedStyle(node, '::before').backdropFilter)).toBe('blur(17px)');
});

test('旧统一底板透明度迁移，书册尺寸与页面命中可单独保存并恢复', async ({ page }) => {
  await page.addInitScript(({ key }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({
      archivePanelTransparency: 67, navFontSize: 23, navigationTypographyVersion: 2,
      cultureTitleTransparency: 15, headerColor: 'invalid', bookStageHeight: -1,
    }));
  }, { key: settingsKey });
  await loadPage(page);
  await expectSaved(page, {
    archivePanelTransparency: 67, bookTitleTransparency: 67, bookDetailsTransparency: 67,
    cultureTitleTransparency: 15, cultureBodyTransparency: 67, headerColor: '#801d17',
    bookStageHeight: 480, bookScale: 116, bookInkEnabled: true, pageHitEnabled: false, navFontSize: 23,
  });
  await expect(page.locator('.home-page')).toHaveCSS('user-select', 'none');
  await openSettings(page);
  await selectSettingsFor(page, '书册放大比例数值');
  const scale = panel(page).getByRole('spinbutton', { name: '书册放大比例数值', exact: true });
  await scale.fill('128');
  await scale.press('Tab');
  await selectSettingsFor(page, '书册展示区高度数值');
  const height = panel(page).getByRole('spinbutton', { name: '书册展示区高度数值', exact: true });
  await height.fill('755');
  await height.press('Tab');
  await expect(height).toHaveValue('760');
  await selectSettingsFor(page, 'bookInkEnabled');
  await panel(page).getByRole('checkbox', { name: '书册导航粒子拖尾', exact: true }).uncheck();
  await selectSettingsTab(page, '布局');
  await panel(page).getByRole('checkbox', { name: '网页页面是否能被命中', exact: true }).check();
  await expect(page.locator('.home-page')).toHaveCSS('user-select', 'auto');
  await saveSettings(page);
  await expectSaved(page, { bookScale: 128, bookStageHeight: 760, bookInkEnabled: false, pageHitEnabled: true });
  await reloadPage(page);
  await expectSaved(page, { bookScale: 128, bookStageHeight: 760, bookInkEnabled: false, pageHitEnabled: true });
  await openSettings(page);
  await panel(page).getByRole('button', { name: '恢复默认参数' }).click();
  await saveSettings(page);
  await expectSaved(page, { bookScale: 116, bookStageHeight: 680, bookInkEnabled: true, pageHitEnabled: false, bookTitleTransparency: 35, cultureTitleTransparency: 35 });
});

test('缩短设置背板后纵向分类与内容分别滚动，底部恢复入口始终可见', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await loadPage(page);
  await openSettings(page);
  await editNumber(page, '设置面板宽度', 280);
  await selectSettingsFor(page, '侧栏高度数值');
  const height = panel(page).getByRole('spinbutton', { name: '侧栏高度数值', exact: true });
  await height.fill('55');
  await height.press('Tab');
  await expect.poll(async () => (await panel(page).boundingBox()).height).toBe(480);
  await expect(height).toHaveValue('55');
  const tabs = panel(page).getByRole('tablist', { name: '设置分类', exact: true });
  const before = await page.evaluate(() => scrollY);
  await tabs.getByRole('tab', { name: '外观', exact: true }).focus();
  await page.keyboard.press('End');
  await expect(tabs.getByRole('tab', { name: '布局', exact: true })).toBeFocused();
  await expect(tabs.getByRole('tab', { name: '布局', exact: true })).toBeInViewport();
  expect(await tabs.evaluate(element => element.scrollHeight > element.clientHeight && element.scrollTop > 0)).toBe(true);
  await panel(page).getByRole('checkbox', { name: '设置面板推开页面' }).scrollIntoViewIfNeeded();
  await expect(panel(page).getByRole('button', { name: '恢复默认参数' })).toBeInViewport();
  expect(await page.evaluate(() => scrollY)).toBe(before);
  expect(await panel(page).evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
});

test('顶栏与设置背板宽高圆角和颜色同步到实际材质并持久化', async ({ page }) => {
  await loadPage(page);
  await openSettings(page);
  for (const [label, value] of [['顶栏宽度', 84], ['顶栏圆角', 33], ['侧栏高度', 70], ['侧栏圆角', 26]]) {
    await selectSettingsFor(page, label);
    const input = panel(page).getByRole('spinbutton', { name: `${label}数值`, exact: true });
    await input.fill(String(value));
    await input.press('Tab');
  }
  for (const [label, value] of [['顶栏底色', '#6d3125'], ['侧栏底色', '#f6eddc']]) {
    await panel(page).getByLabel(label, { exact: true }).evaluate((input, color) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, color);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
  }
  await saveSettings(page);
  await expectSaved(page, { headerWidth: 84, headerRadius: 33, headerColor: '#6d3125', sidebarHeight: 70, sidebarRadius: 26, sidebarColor: '#f6eddc' });
  await expect(headerSurfaces(page)).toHaveCount(1);
  for (const surface of await headerSurfaces(page).all()) {
    await expect(surface).toHaveCSS('border-radius', '33px');
    expect(await surface.evaluate(element => getComputedStyle(element).backgroundImage)).toContain('rgba(89, 39, 24, 0.8)');
  }
  await expect(panel(page)).toHaveCSS('border-radius', '26px');
  await expect(panel(page)).toHaveCSS('background-color', 'rgba(246, 237, 220, 0.86)');
  await expect.poll(async () => (await panel(page).boundingBox()).height).toBe(756);
  await expect.poll(() => page.locator('.site-header').evaluate(element => Math.round(element.getBoundingClientRect().width / element.parentElement.getBoundingClientRect().width * 100))).toBe(84);
  await reloadPage(page);
  await expectSaved(page, { headerWidth: 84, headerRadius: 33, headerColor: '#6d3125', sidebarHeight: 70, sidebarRadius: 26, sidebarColor: '#f6eddc' });
});

test('参考资料区域与卡片分别公开六参数，旧偏好补齐默认且可保存刷新恢复', async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(({ key }) => {
    if (window.top !== window || localStorage.getItem(key)) return;
    localStorage.setItem(key, JSON.stringify({ archivePanelTransparency: 67, headerTransparency: 34, navigationTypographyVersion: 2, navFontSize: 23 }));
  }, { key: settingsKey });
  await loadPage(page);
  const sources = page.locator('.home-culture-sources');
  const cards = sources.locator('.home-culture-source-card');
  const defaults = {
    cultureSourcesWidth: 100, cultureSourcesHeight: 0, cultureSourcesTransparency: 5,
    cultureSourcesBlur: 0, cultureSourcesRadius: 10, cultureSourcesColor: '#f7f5f0',
    cultureSourceCardWidth: 100, cultureSourceCardHeight: 186, cultureSourceCardTransparency: 5,
    cultureSourceCardBlur: 0, cultureSourceCardRadius: 10, cultureSourceCardColor: '#f7f5f0',
  };
  await expectSaved(page, { ...defaults, archivePanelTransparency: 67, headerTransparency: 34, navFontSize: 23 });
  await expect(sources).toHaveCSS('background-color', 'rgba(247, 245, 240, 0.95)');
  await expect(sources).toHaveCSS('border-radius', '10px');
  await expect(sources).toHaveCSS('backdrop-filter', 'none');
  await expect(cards).toHaveCount(3);
  for (const card of await cards.all()) {
    await expect(card).toHaveCSS('background-color', 'rgba(247, 245, 240, 0.95)');
    await expect(card).toHaveCSS('border-radius', '10px');
    await expect(card).toHaveCSS('min-height', '186px');
  }
  await openSettings(page);
  const changed = {};
  for (const { prefix, label, values, color } of [
    { prefix: 'cultureSources', label: '参考资料区域', values: [84, 700, 25, 14, 28], color: '#ede0ca' },
    { prefix: 'cultureSourceCard', label: '参考资料卡片', values: [92, 260, 35, 11, 21], color: '#efe0c6' },
  ]) {
    await selectSettingsFor(page, prefix);
    for (const [index, [suffix, field]] of [['Width', '宽度'], ['Height', '高度'], ['Transparency', '透明度'], ['Blur', '模糊强度'], ['Radius', '圆角']].entries()) {
      const value = values[index];
      const input = panel(page).getByRole('spinbutton', { name: `${label}${field}数值`, exact: true });
      await input.fill(String(value));
      await input.press('Tab');
      changed[`${prefix}${suffix}`] = value;
    }
    await panel(page).getByLabel(`${label}底色`, { exact: true }).evaluate((input, value) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, color);
    changed[`${prefix}Color`] = color;
  }
  await saveSettings(page);
  await expectSaved(page, { ...changed, archivePanelTransparency: 67, headerTransparency: 34, navFontSize: 23 });
  await expect(sources).toHaveCSS('background-color', 'rgba(237, 224, 202, 0.75)');
  await expect(sources).toHaveCSS('backdrop-filter', 'blur(14px)');
  await expect(sources).toHaveCSS('border-radius', '28px');
  await expect(sources).toHaveCSS('min-height', '700px');
  expect(await sources.evaluate(element => element.getBoundingClientRect().width / element.parentElement.getBoundingClientRect().width * 100)).toBeCloseTo(84, 1);
  for (const card of await cards.all()) {
    await expect(card).toHaveCSS('background-color', 'rgba(239, 224, 198, 0.65)');
    await expect(card).toHaveCSS('backdrop-filter', 'blur(11px)');
    await expect(card).toHaveCSS('border-radius', '21px');
    await expect(card).toHaveCSS('min-height', '260px');
  }
  expect(await cards.first().evaluate(element => element.getBoundingClientRect().width / parseFloat(getComputedStyle(element.parentElement).gridTemplateColumns) * 100)).toBeCloseTo(92, 1);
  await reloadPage(page);
  await expectSaved(page, changed);
  await expect(sources).toHaveCSS('backdrop-filter', 'blur(14px)');
  await expect(cards.first()).toHaveCSS('min-height', '260px');
  await openSettings(page);
  await panel(page).getByRole('button', { name: '恢复默认参数' }).click();
  await saveSettings(page);
  await expectSaved(page, defaults);
  await expect(sources).toHaveCSS('background-color', 'rgba(247, 245, 240, 0.95)');
  await expect(cards.first()).toHaveCSS('background-color', 'rgba(247, 245, 240, 0.95)');
  await expect(cards.first()).toHaveCSS('min-height', '186px');
});

test('参考资料外区与卡片完全透明时移除材质，文字和链接仍可用', async ({ page }) => {
  await page.addInitScript(({ key }) => {
    if (window.top !== window) return;
    localStorage.setItem(key, JSON.stringify({
      cultureSourcesTransparency: 100, cultureSourcesBlur: 18,
      cultureSourceCardTransparency: 100, cultureSourceCardBlur: 12,
    }));
  }, { key: settingsKey });
  await loadPage(page);
  const sources = page.locator('.home-culture-sources');
  const cards = sources.locator('.home-culture-source-card');
  await sources.scrollIntoViewIfNeeded();
  await expect(sources).toHaveCSS('background-color', 'rgba(247, 245, 240, 0)');
  await expect(sources).toHaveCSS('backdrop-filter', 'none');
  await expect(sources).toHaveCSS('border-color', 'rgba(183, 170, 151, 0)');
  await expect(sources).toHaveCSS('opacity', '1');
  expect(await sources.evaluate(element => getComputedStyle(element, '::before').backgroundColor)).toBe('rgba(165, 57, 37, 0)');
  await expect(sources.getByRole('heading', { name: '参考资料', exact: true })).toHaveCSS('opacity', '1');
  for (const card of await cards.all()) {
    await expect(card).toHaveCSS('background-color', 'rgba(247, 245, 240, 0)');
    await expect(card).toHaveCSS('backdrop-filter', 'none');
    await expect(card.locator('strong')).toHaveCSS('opacity', '1');
    await expect(card).toHaveAttribute('href', /^https:\/\//);
  }
  await cards.first().hover();
  await expect(cards.first()).toHaveCSS('border-color', 'rgba(183, 170, 151, 0)');
  expect(await cards.first().evaluate(element => getComputedStyle(element).boxShadow)).toMatch(/rgba\([^)]*, 0\)/);
  await cards.first().focus();
  await expect(cards.first()).toBeFocused();
});

test('参考资料在900/1920px桌面余宽与两层40/100%宽度极值均无溢出重叠', async ({ page }) => {
  test.setTimeout(90_000);
  await loadPage(page);
  await openSettings(page);
  const sources = page.locator('.home-culture-sources');
  const matrix = [];
  for (const availableWidth of [900, 1920]) {
    await page.setViewportSize({ width: availableWidth + 380, height: 1080 });
    await editNumber(page, '设置面板宽度', Math.round(await shellWidth(page) - availableWidth));
    await expect.poll(() => pageWidth(page)).toBe(availableWidth);
    await selectSettingsFor(page, 'cultureSources');
    for (const areaWidth of [40, 100]) {
      await selectSettingsFor(page, '参考资料区域宽度数值');
      const areaInput = panel(page).getByRole('spinbutton', { name: '参考资料区域宽度数值', exact: true });
      await areaInput.fill(String(areaWidth));
      await areaInput.press('Tab');
      for (const cardWidth of [40, 100]) {
        await selectSettingsFor(page, '参考资料卡片宽度数值');
        const cardInput = panel(page).getByRole('spinbutton', { name: '参考资料卡片宽度数值', exact: true });
        await cardInput.fill(String(cardWidth));
        await cardInput.press('Tab');
        await sources.scrollIntoViewIfNeeded();
        const geometry = await sources.evaluate(element => {
          const cards = [...element.querySelectorAll('.home-culture-source-card')];
          const rectangles = cards.map(card => card.getBoundingClientRect());
          const fit = card => {
            const bounds = card.getBoundingClientRect();
            return card.scrollWidth <= card.clientWidth + 1 && [...card.querySelectorAll('*')].every(child => {
              const childBounds = child.getBoundingClientRect();
              // display:none ornaments have a zero box at the viewport origin,
              // not visible content escaping this material's bounds.
              if (!childBounds.width && !childBounds.height) return true;
              return childBounds.left >= bounds.left - 1 && childBounds.right <= bounds.right + 1;
            });
          };
          return {
            areaFits: element.scrollWidth <= element.clientWidth + 1,
            headingFits: fit(element.querySelector('.home-culture-sources-heading')),
            cardsFit: cards.every(fit),
            noOverlap: rectangles.every((rect, index) => rectangles.slice(index + 1).every(next =>
              rect.right <= next.left + 1 || next.right <= rect.left + 1 || rect.bottom <= next.top + 1 || next.bottom <= rect.top + 1)),
            areaPixels: element.getBoundingClientRect().width,
            cardPixels: rectangles.map(rect => rect.width),
            columns: getComputedStyle(element.querySelector('.home-culture-source-cards')).gridTemplateColumns.split(' ').length,
          };
        });
        matrix.push({ availableWidth, areaWidth, cardWidth, ...geometry });
        const context = JSON.stringify({ availableWidth, areaWidth, cardWidth, geometry });
        expect(geometry.areaFits, context).toBe(true);
        expect(geometry.headingFits, context).toBe(true);
        expect(geometry.cardsFit, context).toBe(true);
        expect(geometry.noOverlap, context).toBe(true);
        await expect(sources.locator('.home-culture-source-cards').getByRole('link')).toHaveCount(3);
        await expect(sources.locator('.heritage-source-group')).toHaveCount(2);
      }
    }
  }
  await test.info().attach('sources-size-matrix', { body: JSON.stringify(matrix, null, 2), contentType: 'application/json' });
});

test('神态底板六参数与简介解读字号独立保存，点击前后使用对应字号', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 3440, height: 1440 });
  await page.addInitScript(({ key }) => {
    if (window.top !== window || localStorage.getItem(key)) return;
    localStorage.setItem(key, JSON.stringify({ headerTransparency: 34, cultureSourcesWidth: 82, navigationTypographyVersion: 2, navFontSize: 23 }));
  }, { key: settingsKey });
  await loadPage(page);
  await page.locator('.site-navigation [data-route="state"]').click();
  const copy = page.locator('#expressionStateCopy');
  const defaults = {
    expressionOverlayWidth: 100, expressionOverlayHeight: 0, expressionOverlayTransparency: 10,
    expressionOverlayBlur: 0, expressionOverlayRadius: 10, expressionOverlayColor: '#f7f5f0',
    expressionOverviewFontSize: 22, expressionDetailFontSize: 18,
  };
  await expectSaved(page, { ...defaults, headerTransparency: 34, cultureSourcesWidth: 82, navFontSize: 23 });
  await expect(copy).toHaveAttribute('data-surface', 'expressionOverlay');
  await expect(copy).toHaveAttribute('data-view', 'overview');
  expect(await copy.locator('.expression-description p').count()).toBeGreaterThan(0);
  for (const paragraph of await copy.locator('.expression-description p').all()) await expect(paragraph).toHaveCSS('font-size', '22px');
  await openSettings(page);
  await expectPageWidth(page, 340);
  const initialWidth = await copy.evaluate(element => element.getBoundingClientRect().width);
  const changes = {
    expressionOverlayWidth: 68, expressionOverlayHeight: 300, expressionOverlayTransparency: 37,
    expressionOverlayBlur: 12, expressionOverlayRadius: 33, expressionOverlayColor: '#f6e6c7',
    expressionOverviewFontSize: 28, expressionDetailFontSize: 20,
  };
  await selectSettingsFor(page, 'expressionOverlay');
  for (const [label, value] of [['宽度', 68], ['高度', 300], ['透明度', 37], ['模糊强度', 12], ['圆角', 33]]) {
    const input = panel(page).getByRole('spinbutton', { name: `神态文字底板${label}数值`, exact: true });
    await input.fill(String(value));
    await input.press('Tab');
  }
  await panel(page).getByLabel('神态文字底板底色', { exact: true }).evaluate(input => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '#f6e6c7');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(copy).toHaveCSS('background-color', 'rgba(246, 230, 199, 0.63)');
  await expect(copy).toHaveCSS('backdrop-filter', 'blur(12px)');
  await expect(copy).toHaveCSS('border-radius', '33px');
  await expect(copy).toHaveCSS('--surface-height', '300px');
  await expect.poll(() => copy.evaluate(element => element.getBoundingClientRect().width)).toBeLessThan(initialWidth - 2);
  await editNumber(page, '神态简介字号', 28);
  await editNumber(page, '神态解读字号', 20);
  for (const paragraph of await copy.locator('.expression-description p').all()) await expect(paragraph).toHaveCSS('font-size', '28px');
  await saveSettings(page, false);
  await page.locator('#expressionLionTrigger').click();
  await expect(copy).toHaveAttribute('data-view', 'details');
  await expect(copy.locator('.expression-cues p')).toHaveCount(2);
  for (const paragraph of await copy.locator('.expression-cues p').all()) await expect(paragraph).toHaveCSS('font-size', '20px');
  await expectSaved(page, { ...changes, headerTransparency: 34, cultureSourcesWidth: 82 });
  await reloadPage(page);
  await expectSaved(page, changes);
  await expect(copy).toHaveAttribute('data-view', 'overview');
  for (const paragraph of await copy.locator('.expression-description p').all()) await expect(paragraph).toHaveCSS('font-size', '28px');
  await openSettings(page);
  await panel(page).getByRole('button', { name: '恢复默认参数' }).click();
  await saveSettings(page);
  await expectSaved(page, defaults);
  await expect(copy).toHaveCSS('background-color', 'rgba(247, 245, 240, 0.9)');
  await expect(copy).toHaveCSS('backdrop-filter', 'none');
  await expect(copy).toHaveCSS('border-radius', '10px');
});

test('神态两种字号校验16至32边界，透明底板仍保留前后文字', async ({ page }) => {
  await loadPage(page);
  await page.locator('.site-navigation [data-route="state"]').click();
  await openSettings(page);
  await selectSettingsFor(page, '神态文字底板透明度数值');
  const transparency = panel(page).getByRole('spinbutton', { name: '神态文字底板透明度数值', exact: true });
  await transparency.fill('100');
  await transparency.press('Tab');
  const copy = page.locator('#expressionStateCopy');
  await expect(copy).toHaveCSS('backdrop-filter', 'none');
  await expect(copy).toHaveCSS('background-color', 'rgba(247, 245, 240, 0)');
  await expect(copy).toHaveCSS('opacity', '1');
  for (const [label, key] of [['神态简介字号', 'expressionOverviewFontSize'], ['神态解读字号', 'expressionDetailFontSize']]) {
    await selectSettingsFor(page, label);
    const input = panel(page).getByRole('spinbutton', { name: `${label}数值`, exact: true });
    for (const [draft, expected] of [['15', 16], ['33', 32], ['19.6', 20]]) {
      await input.fill(draft);
      await input.press('Tab');
      await expect(input).toHaveValue(String(expected));
      await saveSettings(page);
      await expectSaved(page, { [key]: expected });
    }
  }
  await saveSettings(page, false);
  await page.locator('#expressionLionTrigger').click();
  await expect(copy).toHaveAttribute('data-view', 'details');
  await expect(copy).toHaveCSS('backdrop-filter', 'none');
  await expect(copy).toHaveCSS('background-color', 'rgba(247, 245, 240, 0)');
  for (const paragraph of await copy.locator('.expression-cues p').all()) await expect(paragraph).toHaveCSS('opacity', '1');
});
