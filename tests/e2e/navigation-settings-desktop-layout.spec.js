import { expect, test } from '@playwright/test';
import { selectSettingsFor, selectSettingsPage, settingsPages, settingsPanel } from './settings-navigation.helpers.js';

const key = 'nanfeng-lion:developer-settings:v1';
const trigger = page => page.locator('.site-navigation [data-action="settings"]');
const stored = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);

async function prepare(page, settings = {}, route = '') {
  await page.addInitScript(({ key, settings }) => {
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    if (!sessionStorage.getItem('desktop-layout-seeded')) {
      localStorage.setItem(key, JSON.stringify({ bookAutoplay: false, carouselAutoplay: false, hdriEnabled: false, ...settings }));
      sessionStorage.setItem('desktop-layout-seeded', '1');
    }
  }, { key, settings });
  await page.goto(`/${route}`);
  await expect(trigger(page)).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

async function expectInsideViewport(locator, page) {
  await expect.poll(() => locator.evaluate(element => {
    const box = element.getBoundingClientRect();
    return box.width > 0 && box.height > 0 && box.left >= -1 && box.top >= -1 && box.right <= innerWidth + 1 && box.bottom <= innerHeight + 1;
  })).toBe(true);
}

async function expectHeaderLabels(page, expanded) {
  const items = page.locator('.site-header .site-nav-item');
  for (const item of await items.all()) {
    await item.scrollIntoViewIfNeeded();
    await expect.poll(() => item.evaluate((element, expanded) => {
      const header = element.closest('.site-header').getBoundingClientRect();
      const navigation = element.closest('.site-navigation').getBoundingClientRect();
      const nodes = [element.querySelector('strong'), ...(expanded ? [element.querySelector('.site-nav-description')] : [])];
      return nodes.every(node => {
        const style = getComputedStyle(node), box = node.getBoundingClientRect();
        const range = document.createRange(); range.selectNodeContents(node);
        const text = range.getBoundingClientRect();
        const minimum = node.tagName === 'STRONG' ? 14 : 10;
        return style.display !== 'none' && style.visibility !== 'hidden' && parseFloat(style.fontSize) >= minimum - .05 &&
          text.height <= parseFloat(style.fontSize) * 1.5 &&
          box.left >= navigation.left - 1 && box.right <= navigation.right + 1 &&
          box.top >= header.top - 1 && box.bottom <= header.bottom + 1;
      });
    }, expanded)).toBe(true);
  }
  await expect.poll(() => page.locator('.site-header').evaluate(element => element.getBoundingClientRect().height / innerHeight)).toBeLessThanOrEqual(.46);
}

test('电脑有效宽度640至4K保留完整单行导航文字，短窗不被顶栏占满', async ({ page }) => {
  await prepare(page);
  for (const [width, height] of [[640, 480], [800, 600], [1024, 576], [1366, 768], [1920, 1080], [2560, 1080], [3840, 2160]]) {
    await page.setViewportSize({ width, height });
    await expectHeaderLabels(page, true);
    await page.locator('.site-header [data-route="state"]').click();
    await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'state');
    await expectHeaderLabels(page, false);
    await page.locator('.site-header [data-route="entry"]').click();
    await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'entry');
  }
});

test('窄低电脑窗的极端导航偏好可局部滚动访问，往返尺寸不改写偏好', async ({ page }) => {
  const settings = { navFontSize: 14, helperFontSize: 28, navIconSize: 56, homeBrandOffset: 160, headerHeight: 180, headerWidth: 60 };
  await page.setViewportSize({ width: 640, height: 480 });
  await prepare(page, settings);
  const initial = await stored(page);
  for (const [width, height] of [[640, 480], [640, 360], [1920, 1080], [640, 480]]) {
    await page.setViewportSize({ width, height });
    await expectHeaderLabels(page, true);
    await page.locator('.site-header [data-route="state"]').click();
    await expectHeaderLabels(page, false);
    await page.locator('.site-header [data-route="entry"]').click();
    expect(await stored(page)).toEqual(initial);
  }
});

test('低窗最窄设置侧栏各分类与操作可达，未保存提示和导出均在视口内', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 480 });
  await prepare(page, { panelWidth: 280, sidebarHeight: 50, headerHeight: 180 });
  await trigger(page).click();
  const panel = settingsPanel(page);
  await expectInsideViewport(panel, page);
  for (const name of settingsPages) {
    await selectSettingsPage(page, name);
    const active = panel.locator('.developer-settings-page:not([hidden])');
    const controls = active.locator('input:visible, select:visible, button:visible');
    if (await controls.count()) {
      await controls.last().scrollIntoViewIfNeeded();
      await expect.poll(() => controls.last().evaluate(element => {
        const box = element.getBoundingClientRect(), scroll = element.closest('.developer-settings-scroll').getBoundingClientRect();
        return box.top >= scroll.top - 1 && box.bottom <= scroll.bottom + 1 && box.left >= scroll.left - 1 && box.right <= scroll.right + 1;
      })).toBe(true);
    }
    for (const name of ['取消', '保存设置', '导出当前参数']) await expectInsideViewport(panel.getByRole('button', { name, exact: true }), page);
  }
  await selectSettingsFor(page, '顶栏透明度');
  await panel.getByRole('spinbutton', { name: '顶栏透明度数值', exact: true }).fill('55');
  await panel.getByRole('button', { name: '取消', exact: true }).click();
  const dialog = page.getByRole('alertdialog');
  await expectInsideViewport(dialog, page);
  await expectInsideViewport(dialog.getByRole('button', { name: '放弃更改' }), page);
  await page.setViewportSize({ width: 640, height: 360 });
  await expectInsideViewport(dialog, page);
  await expectInsideViewport(dialog.getByRole('button', { name: '放弃更改' }), page);
  await dialog.getByRole('button', { name: '继续编辑' }).click();
  const downloading = page.waitForEvent('download');
  await panel.getByRole('button', { name: '导出当前参数', exact: true }).click();
  expect((await downloading).suggestedFilename()).toMatch(/\.json$/);
});

test('设置最大宽度按真实余宽回退，拖动边界和保存按钮可达且尺寸往返不写参数', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await prepare(page, { panelWidth: 760, sidebarHeight: 50, headerHeight: 180 });
  const initial = await stored(page);
  await trigger(page).click();
  for (const [width, height] of [[1920, 1080], [640, 480], [675, 403], [640, 360], [800, 600], [1920, 1080]]) {
    await page.setViewportSize({ width, height });
    await expectInsideViewport(settingsPanel(page), page);
    await expectInsideViewport(page.getByRole('separator', { name: '调整侧栏宽度' }), page);
    await expect.poll(() => page.getByRole('separator', { name: '调整顶栏高度' }).evaluate(element => element.getBoundingClientRect().width)).toBeGreaterThan(0);
    await expectInsideViewport(settingsPanel(page).getByRole('button', { name: '保存设置', exact: true }), page);
    expect(await stored(page)).toEqual(initial);
  }
  await expect(page.locator('.site-shell')).toHaveAttribute('data-settings-layout', 'push');
});
