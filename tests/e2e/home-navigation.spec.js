import { test, expect } from '@playwright/test';
import { assetPaths } from '../../src/config/assetPaths.js';

const routes = [['entry', '首页'], ['model', '狮头与结构'], ['action', '动作'], ['state', '神态']];
const removedNavigation = '.entry-chapter-nav, .entry-bottom-nav, .entry-bottom-item, .entry-nav-shell, .entry-nav-ribbon, .chapter-rail, .entry-dialog-backdrop';

test('四页共用顶部五项导航，旧上下导航及搜索菜单已移除', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  const navigation = page.getByRole('navigation', { name: '作品章节导航', exact: true });
  for (const [route, label] of routes) {
    await navigation.locator(`[data-route="${route}"]`).click();
    await expect(page.locator('#react-app')).toHaveAttribute('data-route', route);
    await expect(page.locator('.site-header')).toHaveCount(1);
    await expect(navigation).toHaveCount(1);
    await expect(navigation.locator('.site-nav-item')).toHaveCount(5);
    await expect(navigation.locator('.site-nav-heading strong')).toHaveText([...routes.map(([, title]) => title), '设置']);
    await expect(navigation.locator('.site-nav-heading small')).toHaveText(['01', '02', '03', '04', '05']);
    await expect(navigation.locator('[aria-current="page"]')).toHaveCount(1);
    await expect(navigation.locator('[aria-current="page"] .site-nav-heading strong')).toHaveText(label);
    await expect(navigation.locator('[data-action="settings"]')).toHaveAttribute('aria-expanded', 'false');
    await expect(navigation.locator('.site-nav-icon svg')).toHaveCount(5);
    await expect(navigation.locator('.site-nav-icon svg path')).toHaveCount(5);
    await expect(navigation.locator('img')).toHaveCount(0);
    await expect(navigation.locator('[data-route="intro"], [data-route="structure"], [data-route="score"]')).toHaveCount(0);
    await expect(page.locator(removedNavigation)).toHaveCount(0);
    await expect(page.getByRole('button', { name: '搜索章节', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '打开章节菜单', exact: true })).toHaveCount(0);
  }
});

test('桌面品牌居中对齐，导航真实加载毛笔字体并完整排成一行', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const fontResponses = [];
  page.on('response', response => {
    if (response.url().endsWith(assetPaths.navBrushFont)) fontResponses.push(response.status());
  });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  const typography = await page.locator('.site-navigation').evaluate(navigation => {
    const read = element => {
      const style = getComputedStyle(element);
      const bounds = element.getBoundingClientRect();
      return {
        family: style.fontFamily, size: style.fontSize, color: style.color, opacity: Number(style.opacity),
        top: bounds.top, bottom: bounds.bottom, left: bounds.left, right: bounds.right,
        width: bounds.width, scrollWidth: element.scrollWidth, clientWidth: element.clientWidth,
      };
    };
    return {
      loadedFaces: [...document.fonts].filter(face => face.family.includes('Nanfeng Navigation Brush') && face.status === 'loaded').length,
      items: [...navigation.querySelectorAll('.site-nav-item')].map(item => ({
        button: read(item), icon: read(item.querySelector('.site-nav-icon')),
        number: read(item.querySelector('small')), title: read(item.querySelector('strong')),
        helper: read(item.querySelector('.site-nav-description')),
      })),
    };
  });
  expect(fontResponses.some(status => status >= 200 && status < 400)).toBe(true);
  expect(typography.loadedFaces).toBeGreaterThan(0);
  expect(typography.items).toHaveLength(5);
  for (const { button, icon, number, title, helper } of typography.items) {
    expect(number.color).toBe('rgb(255, 255, 255)');
    expect(number.opacity).toBe(1);
    expect(helper.color).toBe('rgb(255, 255, 255)');
    expect(helper.opacity).toBeGreaterThan(0);
    expect(helper.opacity).toBeLessThan(1);
    expect(title.family).toContain('Nanfeng Navigation Brush');
    expect(number.family).toBe(title.family);
    expect(helper.family).toBe(title.family);
    expect(number.size).toBe(title.size);
    expect(helper.size).toBe(title.size);
    expect(Math.abs(number.top - title.top)).toBeLessThan(1);
    expect(Math.abs(helper.top - title.top)).toBeLessThan(1);
    expect(icon.right).toBeLessThanOrEqual(number.left);
    expect(title.right).toBeLessThanOrEqual(helper.left);
    expect(helper.width).toBeGreaterThan(0);
    expect(helper.scrollWidth).toBeLessThanOrEqual(helper.clientWidth + 1);
    expect(helper.right).toBeLessThanOrEqual(button.right + 1);
    expect(button.top).toBeCloseTo(typography.items[0].button.top, 0);
    expect(button.bottom).toBeCloseTo(typography.items[0].button.bottom, 0);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  for (const [route] of routes) {
    await page.locator(`.site-navigation [data-route="${route}"]`).click();
    const brand = page.locator('.site-header .site-brand');
    const lion = brand.locator('.entry-lion-emblem');
    await expect(brand.locator('.site-brand-name')).toHaveText('南风有狮');
    await expect(brand.locator('.site-brand-caption')).toHaveCount(0);
    await expect(lion).toBeVisible();
    await expect(lion).toHaveAttribute('src', /assets\/entry\/nav-lion-head\.png/);
    await expect.poll(() => lion.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
    const placement = await brand.evaluate(element => {
      const image = element.querySelector('img').getBoundingClientRect();
      const nameElement = element.querySelector('.site-brand-name');
      const name = nameElement.getBoundingClientRect();
      return {
        imageRight: image.right, nameLeft: name.left,
        imageCenter: image.top + image.height / 2, nameCenter: name.top + name.height / 2,
        width: image.width, height: image.height, family: getComputedStyle(nameElement).fontFamily,
      };
    });
    expect(placement.imageRight).toBeLessThanOrEqual(placement.nameLeft);
    expect(Math.abs(placement.imageCenter - placement.nameCenter)).toBeLessThan(1);
    expect(placement.width).toBeLessThanOrEqual(72);
    expect(placement.height).toBeLessThanOrEqual(72);
    expect(placement.family).toContain('Nanfeng Navigation Brush');
    await expect(page.locator('.entry-lion-emblem')).toHaveCount(1);
  }
});

test('顶部导航随文化内容滚动保持可见，当前首页入口返回顶部', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  await page.mouse.move(960, 400);
  await page.mouse.wheel(0, 900);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(100);
  await expect(page.locator('#homeCulture')).toBeInViewport();
  const header = page.locator('.site-header');
  await expect(header).toBeInViewport();
  expect((await header.boundingBox()).y).toBeCloseTo(0, 0);
  await page.locator('.site-navigation [data-route="entry"]').click();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'entry');
  await expect(page.locator('.entry-gate')).toBeInViewport();
});

test('导航可用键盘逐项切换，设置入口保持当前页面与地址', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  const navigation = page.locator('.site-navigation');
  await navigation.locator('[data-route="entry"]').focus();
  await page.keyboard.press('Tab');
  const model = navigation.locator('[data-route="model"]');
  await expect(model).toBeFocused();
  expect(await model.evaluate(element => getComputedStyle(element).outlineStyle)).toBe('solid');
  await page.keyboard.press('Enter');
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'model');
  await page.keyboard.press('Tab');
  await expect(navigation.locator('[data-route="action"]')).toBeFocused();
  await page.keyboard.press('Space');
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'action');
  await page.keyboard.press('Tab');
  await expect(navigation.locator('[data-route="state"]')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'state');
  await page.keyboard.press('Tab');
  const settings = navigation.locator('[data-action="settings"]');
  await expect(settings).toBeFocused();
  const before = page.url();
  await page.keyboard.press('Space');
  await expect(settings).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('region', { name: '开发者参数设置', exact: true })).toBeVisible();
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'state');
  expect(page.url()).toBe(before);
  await expect(navigation.locator('[data-route="state"]')).toHaveAttribute('aria-current', 'page');
  await page.keyboard.press('Escape');
  await expect(settings).toHaveAttribute('aria-expanded', 'false');
  await expect(settings).toBeFocused();
  expect(page.url()).toBe(before);
});

test('手机顶部五项入口可见且可切换，无旧菜单或横向溢出', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const navigation = page.locator('.site-navigation');
  await expect(navigation.locator('.site-nav-item')).toHaveCount(5);
  for (const item of await navigation.locator('.site-nav-item').all()) await expect(item).toBeInViewport();
  await expect(page.locator(removedNavigation)).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const [route, label] of [['action', '动作'], ['state', '神态'], ['entry', '首页']]) {
    await navigation.locator(`[data-route="${route}"]`).click();
    await expect(page.locator('#react-app')).toHaveAttribute('data-route', route);
    await expect(navigation.locator('[aria-current="page"] .site-nav-heading strong')).toHaveText(label);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
