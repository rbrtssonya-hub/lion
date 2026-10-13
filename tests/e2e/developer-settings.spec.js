import { test, expect } from '@playwright/test';

const settingsKey = 'nanfeng-lion:developer-settings:v1';
const panel = page => page.getByRole('region', { name: '开发者参数设置' });
const trigger = page => page.locator('.site-navigation [data-action="settings"]');
const topEdge = page => page.getByRole('separator', { name: '调整顶栏高度' });
const sideEdge = page => page.getByRole('separator', { name: '调整侧栏宽度' });
const pageWidth = page => page.locator('.site-page').evaluate(element => element.getBoundingClientRect().width);
const headerHeight = page => page.locator('.site-header').evaluate(element => element.getBoundingClientRect().height);
const sidebarWidth = page => panel(page).evaluate(element => element.getBoundingClientRect().width);

const controlTabs = {
  顶栏透明度: '外观', 顶栏模糊强度: '外观', 侧栏透明度: '外观', 侧栏模糊强度: '外观',
  顶栏高度: '导航', 导航标题字号: '导航', 导航辅助文字字号: '导航', 导航图标尺寸: '导航', 品牌左侧留白: '导航',
  导航动画时长: '动画', 紧凑导航图标间距: '动画', 紧凑导航右侧留白: '动画', 设置面板宽度: '布局',
};

async function selectSettingsTab(page, name) {
  const tab = panel(page).getByRole('tab', { name, exact: true });
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
}

async function savedSettings(page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)), settingsKey);
}

async function expectSaved(page, values) {
  await expect.poll(() => savedSettings(page)).toMatchObject(values);
}

async function openSettings(page) {
  await trigger(page).click();
  await expect(panel(page)).toBeVisible();
}

async function editNumber(page, name, value) {
  await selectSettingsTab(page, controlTabs[name]);
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
  await page.addInitScript(() => sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1'));
});

test('第五项设置默认关闭，展开为贴右全高侧栏，关闭和 Escape 恢复入口焦点', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.site-nav-heading strong')).toHaveText(['首页', '结构', '动作', '神态', '设置']);
  await expect(panel(page)).toHaveCount(0);
  await expect(trigger(page)).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.developer-settings-trigger')).toHaveCount(0);

  await openSettings(page);
  await expect(trigger(page)).toHaveAttribute('aria-expanded', 'true');
  const bounds = await panel(page).boundingBox();
  const viewport = await page.evaluate(() => ({ width: document.documentElement.clientWidth, height: innerHeight }));
  expect(bounds.y).toBe(0);
  expect(bounds.x + bounds.width).toBeCloseTo(viewport.width, 1);
  expect(bounds.height).toBe(viewport.height);
  await expect(panel(page).getByRole('button', { name: '关闭开发者参数' })).toBeFocused();
  await expect(panel(page).getByRole('tab', { name: '外观', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(panel(page).getByRole('spinbutton', { name: '导航标题字号数值', includeHidden: true })).toBeHidden();
  await panel(page).getByRole('button', { name: '关闭开发者参数' }).click();
  await expect(panel(page)).toHaveCount(0);
  await expect(trigger(page)).toBeFocused();

  await openSettings(page);
  await page.keyboard.press('Escape');
  await expect(panel(page)).toHaveCount(0);
  await expect(trigger(page)).toBeFocused();
});

test('四个设置页签仅显示选中类别，支持键盘切换并保留已调参数与当前类别', async ({ page }) => {
  await page.goto('/');
  await openSettings(page);
  const tabs = panel(page).getByRole('tab');
  await expect(panel(page).getByRole('tablist', { name: '设置分类' })).toBeVisible();
  await expect(tabs).toHaveText(['外观', '导航', '动画', '布局']);
  await expect(panel(page).getByRole('tabpanel')).toHaveCount(1);
  await expect(panel(page).getByRole('tabpanel', { includeHidden: true })).toHaveCount(4);
  await expect(panel(page).getByRole('spinbutton', { name: '顶栏透明度数值' })).toBeVisible();
  await expect(panel(page).getByRole('spinbutton', { name: '导航标题字号数值', includeHidden: true })).toBeHidden();
  await expect(panel(page).getByRole('spinbutton', { name: '导航动画时长数值', includeHidden: true })).toBeHidden();

  const appearance = panel(page).getByRole('tab', { name: '外观', exact: true });
  await appearance.focus();
  await appearance.press('ArrowRight');
  const navigation = panel(page).getByRole('tab', { name: '导航', exact: true });
  await expect(navigation).toBeFocused();
  await expect(navigation).toHaveAttribute('aria-selected', 'true');
  await expect(navigation).toHaveAttribute('tabindex', '0');
  await expect(appearance).toHaveAttribute('tabindex', '-1');
  await editNumber(page, '导航标题字号', 24);
  await navigation.press('ArrowRight');
  const animation = panel(page).getByRole('tab', { name: '动画', exact: true });
  await expect(animation).toBeFocused();
  await expect(animation).toHaveAttribute('aria-selected', 'true');
  await expect(panel(page).getByRole('spinbutton', { name: '导航动画时长数值' })).toBeVisible();
  await expect(panel(page).getByRole('spinbutton', { name: '导航标题字号数值', includeHidden: true })).toBeHidden();
  await animation.press('End');
  const layout = panel(page).getByRole('tab', { name: '布局', exact: true });
  await expect(layout).toBeFocused();
  await expect(layout).toHaveAttribute('aria-selected', 'true');
  await expect(panel(page).getByRole('checkbox', { name: '设置面板推开页面' })).toBeVisible();
  await layout.press('ArrowRight');
  await expect(appearance).toBeFocused();
  await expect(appearance).toHaveAttribute('aria-selected', 'true');
  await appearance.press('ArrowLeft');
  await expect(layout).toBeFocused();
  await layout.press('Home');
  await expect(appearance).toBeFocused();

  await selectSettingsTab(page, '导航');
  await expect(panel(page).getByRole('spinbutton', { name: '导航标题字号数值' })).toHaveValue('24');
  await expectSaved(page, { navFontSize: 24 });
  await panel(page).getByRole('button', { name: '关闭开发者参数' }).click();
  await openSettings(page);
  await expect(panel(page).getByRole('tab', { name: '导航', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(panel(page).getByRole('spinbutton', { name: '导航标题字号数值' })).toHaveValue('24');
});

test('动画参数与紧凑布局可保存刷新和恢复默认，时长数值与滑块校验边界步长', async ({ page }) => {
  await page.goto('/');
  await openSettings(page);
  await selectSettingsTab(page, '动画');
  const duration = panel(page).getByRole('spinbutton', { name: '导航动画时长数值', exact: true });
  const easing = panel(page).getByRole('combobox', { name: '动画变速曲线', exact: true });
  await expect(duration).toHaveValue('720');
  await expect(easing).toHaveValue('smooth');
  await expect(easing.locator('option')).toHaveText(['平滑进出', '快速收拢', '柔和缓出']);
  await expect(panel(page).getByRole('spinbutton', { name: '紧凑导航图标间距数值' })).toHaveValue('14');
  await expect(panel(page).getByRole('spinbutton', { name: '紧凑导航右侧留白数值' })).toHaveValue('48');
  for (const [draft, expected] of [['99', 200], ['1800', 1600], ['755', 760], ['', 760]]) {
    await duration.fill(draft);
    await duration.press('Tab');
    await expect(duration).toHaveValue(String(expected));
    await expectSaved(page, { navigationDuration: expected });
  }
  const slider = panel(page).getByRole('slider', { name: '导航动画时长', exact: true });
  await slider.focus();
  await slider.press('Home');
  await expectSaved(page, { navigationDuration: 200 });
  await slider.press('End');
  await expectSaved(page, { navigationDuration: 1600 });
  await editNumber(page, '导航动画时长', 1300);
  for (const curve of ['soft', 'smooth', 'swift']) {
    await easing.selectOption(curve);
    await expectSaved(page, { navigationEasing: curve });
  }
  await editNumber(page, '紧凑导航图标间距', 28);
  await editNumber(page, '紧凑导航右侧留白', 96);
  await editNumber(page, '导航辅助文字字号', 16);
  await expectSaved(page, { navigationDuration: 1300, navigationEasing: 'swift', compactNavGap: 28, compactNavInset: 96, helperFontSize: 16 });

  await page.reload();
  await expect(panel(page)).toHaveCount(0);
  await openSettings(page);
  await expect(panel(page).getByRole('tab', { name: '外观', exact: true })).toHaveAttribute('aria-selected', 'true');
  await selectSettingsTab(page, '动画');
  await expect(duration).toHaveValue('1300');
  await expect(easing).toHaveValue('swift');
  await expect(panel(page).getByRole('spinbutton', { name: '紧凑导航图标间距数值' })).toHaveValue('28');
  await expect(panel(page).getByRole('spinbutton', { name: '紧凑导航右侧留白数值' })).toHaveValue('96');
  await panel(page).getByRole('button', { name: '恢复默认参数' }).click();
  await expectSaved(page, { navigationDuration: 720, navigationEasing: 'smooth', compactNavGap: 14, compactNavInset: 48, helperFontSize: 18 });
  await expect(duration).toHaveValue('720');
  await expect(easing).toHaveValue('smooth');
});

test('顶栏和侧栏材质分别调节透明及模糊，文字、图标和控件不随容器淡出', async ({ page }) => {
  await page.goto('/');
  await openSettings(page);
  await editNumber(page, '顶栏透明度', 100);
  await editNumber(page, '顶栏模糊强度', 0);
  await expect(panel(page).getByRole('slider', { name: '顶栏透明度', exact: true })).toHaveValue('100');
  await expect(page.locator('.site-header')).toHaveCSS('opacity', '1');
  await expect(page.locator('.site-header')).toHaveCSS('backdrop-filter', 'none');
  await expect(page.locator('.site-nav-heading strong').first()).toHaveCSS('opacity', '1');
  for (const icon of await page.locator('.site-nav-icon').all()) {
    await expect(icon).toHaveCSS('color', 'rgb(212, 56, 42)');
    await expect(icon.locator('svg')).toHaveCSS('stroke', 'rgb(212, 56, 42)');
  }
  expect(await page.locator('.site-header').evaluate(element => {
    const style = getComputedStyle(element);
    return style.backgroundImage.includes('rgba(104, 23, 15, 0)') &&
      getComputedStyle(element, '::after').opacity === '0';
  })).toBe(true);
  await expect(panel(page).getByRole('spinbutton', { name: '侧栏透明度数值' })).toHaveValue('14');
  await expect(panel(page)).toHaveCSS('backdrop-filter', 'blur(18px)');

  await editNumber(page, '顶栏模糊强度', 24);
  await expect(page.locator('.site-header')).toHaveCSS('backdrop-filter', 'blur(24px)');
  await editNumber(page, '侧栏透明度', 100);
  await editNumber(page, '侧栏模糊强度', 0);
  await expect(panel(page)).toHaveCSS('opacity', '1');
  await expect(panel(page)).toHaveCSS('backdrop-filter', 'none');
  await expect(panel(page).getByRole('heading', { name: '开发者参数设置' })).toHaveCSS('opacity', '1');
  await expect(panel(page).getByRole('spinbutton', { name: '侧栏透明度数值' })).toHaveCSS('opacity', '1');
  expect(await panel(page).evaluate(element => {
    const style = getComputedStyle(element);
    return style.backgroundImage.includes('rgba(255, 246, 228, 0)') &&
      style.borderLeftColor === 'rgba(199, 148, 86, 0)';
  })).toBe(true);
  await editNumber(page, '侧栏模糊强度', 22);
  await expect(panel(page)).toHaveCSS('backdrop-filter', 'blur(22px)');
  await expect(page.locator('.site-header')).toHaveCSS('backdrop-filter', 'blur(24px)');
});

test('推开页面按侧栏宽度留空，窄窗口自动覆盖并在加宽后恢复用户偏好', async ({ page }) => {
  await page.goto('/');
  await openSettings(page);
  await selectSettingsTab(page, '布局');
  await expect.poll(() => pageWidth(page)).toBe(1920);
  await panel(page).getByRole('checkbox', { name: '设置面板推开页面' }).check();
  await expect(page.locator('.site-shell')).toHaveAttribute('data-settings-layout', 'push');
  await expect.poll(() => pageWidth(page)).toBe(1580);
  await editNumber(page, '设置面板宽度', 480);
  await expect.poll(() => pageWidth(page)).toBe(1440);

  await page.setViewportSize({ width: 1200, height: 900 });
  await expect(page.locator('.site-shell')).toHaveAttribute('data-settings-layout', 'overlay');
  await expect.poll(() => pageWidth(page)).toBe(1200);
  await expect(panel(page)).toContainText('窗口空间不足');
  await expect(panel(page).getByRole('checkbox', { name: '设置面板推开页面' })).toBeChecked();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expectSaved(page, { pushPage: true, panelWidth: 480 });

  await page.setViewportSize({ width: 1920, height: 1080 });
  await expect(page.locator('.site-shell')).toHaveAttribute('data-settings-layout', 'push');
  await expect.poll(() => pageWidth(page)).toBe(1440);
  await panel(page).getByRole('button', { name: '关闭开发者参数' }).click();
  await expect.poll(() => pageWidth(page)).toBe(1920);
});

test('导航标题与辅助文字可独立调整，滑块和数值输入校验字号边界', async ({ page }) => {
  await page.setViewportSize({ width: 3440, height: 1440 });
  await page.goto('/');
  await openSettings(page);
  await selectSettingsTab(page, '导航');
  await expectNavigationSizes(page, 26, 18);
  await editNumber(page, '导航辅助文字字号', 12);
  await expectNavigationSizes(page, 26, 12);
  await editNumber(page, '导航标题字号', 28);
  await expectNavigationSizes(page, 28, 12);
  await expectSaved(page, { navFontSize: 28, helperFontSize: 12 });

  const helperSlider = panel(page).getByRole('slider', { name: '导航辅助文字字号', exact: true });
  await helperSlider.focus();
  await helperSlider.press('Home');
  await expectNavigationSizes(page, 28, 10);
  await helperSlider.press('End');
  await expectNavigationSizes(page, 28, 28);
  const helperInput = panel(page).getByRole('spinbutton', { name: '导航辅助文字字号数值', exact: true });
  for (const [draft, expected] of [['99', 28], ['-1', 10], ['', 10], ['18.6', 19]]) {
    await helperInput.fill(draft);
    await helperInput.press('Tab');
    await expect(helperInput).toHaveValue(String(expected));
    await expectNavigationSizes(page, 28, expected);
    await expectSaved(page, { navFontSize: 28, helperFontSize: expected });
  }

  const titleInput = panel(page).getByRole('spinbutton', { name: '导航标题字号数值', exact: true });
  await titleInput.fill('-1');
  await titleInput.press('Tab');
  await expect(titleInput).toHaveValue('14');
  await expectNavigationSizes(page, 14, 19);
});

test('参数与独立字号持久保存，刷新保持侧栏关闭，恢复默认同时恢复外观与尺寸', async ({ page }) => {
  await page.goto('/');
  await openSettings(page);
  await editNumber(page, '顶栏透明度', 42);
  await editNumber(page, '侧栏模糊强度', 9);
  await editNumber(page, '设置面板宽度', 430);
  await selectSettingsTab(page, '导航');
  await editNumber(page, '顶栏高度', 123);
  await editNumber(page, '导航标题字号', 23);
  await editNumber(page, '导航辅助文字字号', 15);
  await expectSaved(page, { headerTransparency: 42, sidebarBlur: 9, panelWidth: 430, headerHeight: 123, navFontSize: 23, helperFontSize: 15 });
  await expectNavigationSizes(page, 23, 15);

  await page.reload();
  await expect(panel(page)).toHaveCount(0);
  await expect.poll(() => headerHeight(page)).toBe(123);
  await openSettings(page);
  await selectSettingsTab(page, '外观');
  await expect(panel(page).getByRole('spinbutton', { name: '顶栏透明度数值' })).toHaveValue('42');
  await expect(panel(page).getByRole('spinbutton', { name: '侧栏模糊强度数值' })).toHaveValue('9');
  await expect.poll(() => sidebarWidth(page)).toBe(430);
  await selectSettingsTab(page, '导航');
  await expect(panel(page).getByRole('spinbutton', { name: '导航标题字号数值' })).toHaveValue('23');
  await expect(panel(page).getByRole('spinbutton', { name: '导航辅助文字字号数值' })).toHaveValue('15');
  await expectNavigationSizes(page, 23, 15);
  await panel(page).getByRole('button', { name: '恢复默认参数' }).click();
  await expectSaved(page, { headerTransparency: 18, sidebarTransparency: 14, sidebarBlur: 18, headerHeight: 90, navFontSize: 26, helperFontSize: 18, panelWidth: 340, pushPage: false });
  await expectNavigationSizes(page, 26, 18);
  await expect.poll(() => headerHeight(page)).toBe(90);
  await expect.poll(() => sidebarWidth(page)).toBe(340);
});

test('旧默认字号 20 只迁移一次至 26，其他参数保留，随后手选 20 不再升级', async ({ page }) => {
  await page.addInitScript(({ key, saved }) => {
    if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(saved));
  }, { key: settingsKey, saved: { navFontSize: 20, headerTransparency: 42, sidebarBlur: 9, headerHeight: 137, panelWidth: 430, pushPage: true } });
  await page.goto('/');
  await expectSaved(page, { navFontSize: 26, helperFontSize: 18, headerTransparency: 42, sidebarBlur: 9, headerHeight: 137, panelWidth: 430, pushPage: true });
  await openSettings(page);
  await selectSettingsTab(page, '导航');
  await expect(panel(page).getByRole('spinbutton', { name: '导航标题字号数值' })).toHaveValue('26');
  await editNumber(page, '导航标题字号', 20);
  await expectSaved(page, { navFontSize: 20 });
  await page.reload();
  await expect(panel(page)).toHaveCount(0);
  await expectSaved(page, { navFontSize: 20, headerTransparency: 42, sidebarBlur: 9, headerHeight: 137, panelWidth: 430, pushPage: true });
  await openSettings(page);
  await selectSettingsTab(page, '导航');
  await expect(panel(page).getByRole('spinbutton', { name: '导航标题字号数值' })).toHaveValue('20');
});

test('已有 v2 的标题字号 20 保留，缺失的辅助字号补为 18 且刷新保持', async ({ page }) => {
  await page.addInitScript(({ key, saved }) => {
    if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(saved));
  }, { key: settingsKey, saved: { navigationTypographyVersion: 2, navFontSize: 20, helperTransparency: 37 } });
  await page.goto('/');
  await expectSaved(page, { navigationTypographyVersion: 2, navFontSize: 20, helperFontSize: 18, helperTransparency: 37,
    navigationDuration: 720, navigationEasing: 'smooth', compactNavGap: 14, compactNavInset: 48 });
  await expectNavigationSizes(page, 20, 18);
  await page.reload();
  await expectSaved(page, { navFontSize: 20, helperFontSize: 18, helperTransparency: 37 });
  await openSettings(page);
  await selectSettingsTab(page, '导航');
  await expect(panel(page).getByRole('spinbutton', { name: '导航标题字号数值' })).toHaveValue('20');
  await expect(panel(page).getByRole('spinbutton', { name: '导航辅助文字字号数值' })).toHaveValue('18');
});

test('损坏或不合法的保存参数可恢复，浏览器存储不可用时仍能实时调整', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  for (const [badSaved, expected] of [
    ['{broken', { headerTransparency: 18, headerBlur: 12, headerHeight: 90, helperFontSize: 18 }],
    [JSON.stringify({ headerTransparency: 180, headerBlur: -8, sidebarTransparency: 'bad', navFontSize: '20', helperFontSize: '18', headerHeight: 999, panelWidth: null, pushPage: 'yes' }),
      { headerTransparency: 100, headerBlur: 0, sidebarTransparency: 14, headerHeight: 180, helperFontSize: 18 }],
    [JSON.stringify({ helperFontSize: 99 }), { helperFontSize: 28 }],
    [JSON.stringify({ helperFontSize: -1 }), { helperFontSize: 10 }],
    [JSON.stringify({ navigationDuration: 99, navigationEasing: 'unknown', compactNavGap: -1, compactNavInset: 999 }),
      { navigationDuration: 200, navigationEasing: 'smooth', compactNavGap: 4, compactNavInset: 160 }],
    [JSON.stringify({ navigationDuration: 1799, navigationEasing: 2, compactNavGap: 99, compactNavInset: -1 }),
      { navigationDuration: 1600, navigationEasing: 'smooth', compactNavGap: 36, compactNavInset: 16 }],
  ]) {
    await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: settingsKey, value: badSaved });
    await page.reload();
    await expect(panel(page)).toHaveCount(0);
    await expectSaved(page, { ...expected, navFontSize: 26, panelWidth: 340, pushPage: false });
  }

  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', {
    configurable: true,
    get() { throw new DOMException('Storage blocked for this test', 'SecurityError'); },
  }));
  await page.reload();
  await openSettings(page);
  await editNumber(page, '顶栏透明度', 55);
  await editNumber(page, '设置面板宽度', 420);
  await selectSettingsTab(page, '导航');
  await editNumber(page, '导航辅助文字字号', 12);
  await expectNavigationSizes(page, 26, 12);
  await expect.poll(() => sidebarWidth(page)).toBe(420);
  await selectSettingsTab(page, '外观');
  await expect(panel(page).getByRole('slider', { name: '顶栏透明度', exact: true })).toHaveValue('55');
  await page.reload();
  await expect(panel(page)).toHaveCount(0);
  await openSettings(page);
  await expect(panel(page).getByRole('spinbutton', { name: '顶栏透明度数值' })).toHaveValue('18');
  await expectNavigationSizes(page, 26, 18);
  expect(errors).toEqual([]);
});

test('整条边界可悬停显示中央握柄，拖动实时预览并仅在松手后保存', async ({ page }) => {
  await page.goto('/');
  const top = topEdge(page);
  await expect(top.locator('span')).toHaveCSS('opacity', '0');
  let bounds = await top.boundingBox();
  await page.mouse.move(100, bounds.y + bounds.height / 2);
  await expect(top.locator('span')).toHaveCSS('opacity', '1');
  expect(bounds.width).toBe(1920);
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
  await expectSaved(page, { panelWidth: 453, headerHeight: 127 });
  await expectNoDrag(page);
});

test('Escape、pointercancel 和拖动中关闭侧栏均撤销预览并清理全局拖动状态', async ({ page }) => {
  await page.goto('/');
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
  await page.goto('/');
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
  await expectSaved(page, { panelWidth: 341 });
  await page.keyboard.press('Shift+ArrowLeft');
  await expectSaved(page, { panelWidth: 351 });
  await page.keyboard.press('Home');
  await expectSaved(page, { panelWidth: 280 });
  await page.keyboard.press('End');
  await expectSaved(page, { panelWidth: 760 });
  await side.dblclick({ position: { x: 6, y: 120 } });
  await expectSaved(page, { panelWidth: 340, headerHeight: 90, headerTransparency: 45 });
});

test('设置和尺寸调整保留首页视频及模型画布实例，切换章节与模型控件继续可用', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect.poll(() => page.locator('#entryLionVideo').evaluate(video => video.readyState)).toBeGreaterThanOrEqual(2);
  const video = await page.locator('#entryLionVideo').elementHandle();
  await openSettings(page);
  await selectSettingsTab(page, '布局');
  await panel(page).getByRole('checkbox', { name: '设置面板推开页面' }).check();
  await editNumber(page, '设置面板宽度', 480);
  await selectSettingsTab(page, '导航');
  await editNumber(page, '顶栏高度', 115);
  expect(await video.evaluate(element => element.isConnected && element === document.querySelector('#entryLionVideo'))).toBe(true);

  await page.locator('.site-navigation [data-route="model"]').click();
  await expect(page.locator('#modelStatus')).toContainText('模型已载入', { timeout: 45_000 });
  await expect(page.locator('#sceneContainer canvas')).toHaveCount(1);
  const canvas = await page.locator('#sceneContainer canvas').elementHandle();
  await editNumber(page, '设置面板宽度', 520);
  await editNumber(page, '顶栏高度', 100);
  await editNumber(page, '侧栏模糊强度', 22);
  expect(await canvas.evaluate(element => element.isConnected && element === document.querySelector('#sceneContainer canvas'))).toBe(true);
  await page.locator('#toggleRotate').click();
  await expect(page.locator('#toggleRotate')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('#hotspotList [data-id="mouth"]').click();
  await expect(page.locator('#panelTitle')).toHaveText('狮嘴');
  await page.locator('#viewStructure').click();
  await expect(page.locator('#structureLayer')).toBeVisible();
  await page.locator('.site-navigation [data-route="action"]').click();
  await expect(page.locator('#chapterTitle')).toHaveText('动作');
  await page.locator('.site-navigation [data-route="state"]').click();
  await expect(page.locator('#chapterTitle')).toHaveText('神态');
  await expect(panel(page)).toBeVisible();
  expect(errors).toEqual([]);
});
