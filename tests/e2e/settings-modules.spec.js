import { test, expect } from '@playwright/test';

const key = 'nanfeng-lion:developer-settings:v1';
const panel = page => page.getByRole('region', { name: '开发者参数设置' });
async function open(page, saved = {}) {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.addInitScript(({key,saved}) => {
    if (window !== top) return;
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    sessionStorage.setItem('nanfeng-lion:book-intro-seen:v1', '1');
    if (!sessionStorage.getItem('settings-test-seeded')) {
      localStorage.setItem(key, JSON.stringify({ carouselAutoplay: false, ...saved }));
      sessionStorage.setItem('settings-test-seeded','1');
    }
  }, {key,saved});
  await page.goto('/');
  await expect(page.locator('#startupLoading')).toHaveCount(0, {timeout:60000});
  await page.locator('.site-navigation [data-action="settings"]').click();
}
async function tab(page, name) { await panel(page).getByRole('tab', { name, exact: true }).click(); }
async function number(page, name, value) {
  const input = panel(page).getByRole('spinbutton', {name:`${name}数值`,exact:true});
  await input.fill(String(value)); await input.press('Tab');
}
const stored = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);

test('settings separate common, home, chapter and source controls into focused pages', async ({page}) => {
  await open(page);
  await expect(panel(page).getByRole('tablist', {name:'设置分类'}).getByRole('tab')).toHaveText(['公共模块','外观','导航','首页','章节','资料','动画','轮播','布局']);
  await expect(panel(page).getByRole('tabpanel')).toHaveCount(1);
  await expect(panel(page).getByRole('button', {name:'应用公共材质',exact:true})).toBeVisible();
  await tab(page, '首页');
  await expect(panel(page).getByRole('spinbutton', {name:'书册标题底板宽度数值',exact:true})).toBeVisible();
  await expect(panel(page).getByRole('spinbutton', {name:'参考资料区域宽度数值',exact:true})).toHaveCount(0);
  await tab(page, '图鉴');
  await expect(panel(page).getByRole('spinbutton', {name:'文化标题底板宽度数值',exact:true})).toBeVisible();
  await tab(page, '章节'); await tab(page, '神态');
  await expect(panel(page).getByRole('spinbutton', {name:'神态简介字号数值',exact:true})).toBeVisible();
  await expect(panel(page).getByRole('spinbutton', {name:'结构资料底板宽度数值',exact:true})).toHaveCount(0);
  await tab(page, '资料');
  await expect(panel(page).getByRole('spinbutton', {name:'参考资料卡片宽度数值',exact:true})).toBeVisible();
});

test('common material applies only on command to selected surfaces, preserving dimensions and old preferences', async ({page}) => {
  await open(page, {bookTitleWidth:57, bookTitleLayoutVersion:1, cultureBodyHeight:250, headerBlur:23, modelOverlayTransparency:27, expressionOverviewFontSize:25});
  await number(page, '公共透明度', 65); await number(page, '公共模糊强度', 9); await number(page, '公共圆角', 20);
  const color = panel(page).getByLabel('公共底色',{exact:true});
  await color.fill('#e6d4b8');
  expect((await stored(page)).bookTitleTransparency).toBe(40);
  await panel(page).getByRole('combobox',{name:'应用范围',exact:true}).selectOption('home');
  await panel(page).getByRole('button',{name:'应用公共材质',exact:true}).click();
  await expect.poll(() => stored(page)).toMatchObject({archivePanelTransparency:65,bookTitleTransparency:65,bookDetailsTransparency:65,cultureTitleTransparency:65,cultureBodyTransparency:65,bookTitleBlur:9,bookTitleRadius:20,bookTitleColor:'#e6d4b8',bookTitleWidth:57,cultureBodyHeight:250,headerBlur:23,modelOverlayTransparency:27,expressionOverviewFontSize:25});
  await expect(page.locator('[data-surface="bookTitle"]')).toHaveCSS('--surface-opacity','0.35');
  await expect(panel(page).locator('.developer-settings-feedback')).toContainText('已应用到4处底板');
  await panel(page).getByRole('combobox',{name:'应用范围',exact:true}).selectOption('chapters');
  await number(page, '公共透明度', 80);
  await panel(page).getByRole('button',{name:'应用公共材质',exact:true}).click();
  await expect.poll(() => stored(page)).toMatchObject({modelOverlayTransparency:80,expressionOverlayTransparency:80,actionOverlayTransparency:80,videoOverlayTransparency:80,bookTitleTransparency:65,bookTitleWidth:57});
  await page.reload(); await expect(page.locator('#startupLoading')).toHaveCount(0,{timeout:60000});
  await expect.poll(() => stored(page)).toMatchObject({bookTitleTransparency:65,modelOverlayTransparency:80,bookTitleWidth:57,headerBlur:23});
});

test('shared material and independent panels reset correctly, with scoped keyboard navigation', async ({page}) => {
  await open(page);
  await number(page, '公共透明度', 100);
  await panel(page).getByRole('combobox',{name:'应用范围',exact:true}).selectOption('all');
  await panel(page).getByRole('button',{name:'应用公共材质',exact:true}).click();
  await expect.poll(() => stored(page)).toMatchObject({bookTitleTransparency:100,cultureSourceCardTransparency:100,videoOverlayTransparency:100});
  const common = panel(page).getByRole('tab',{name:'公共模块',exact:true});
  await common.focus(); await common.press('ArrowDown');
  await expect(panel(page).getByRole('tab',{name:'外观',exact:true})).toBeFocused();
  await common.press('Home');
  await tab(page,'首页');
  const book = panel(page).getByRole('tab',{name:'书册',exact:true});
  await book.focus(); await book.press('ArrowRight');
  await expect(panel(page).getByRole('tab',{name:'图鉴',exact:true})).toBeFocused();
  await expect(panel(page).getByRole('tab',{name:'首页',exact:true})).toHaveAttribute('aria-selected','true');
  await panel(page).getByRole('button',{name:'恢复默认参数',exact:true}).click();
  await expect.poll(() => stored(page)).toMatchObject({bookTitleTransparency:40,cultureSourceCardTransparency:0,videoOverlayTransparency:12});
  await tab(page,'公共模块');
  await expect(panel(page).getByRole('spinbutton',{name:'公共透明度数值',exact:true})).toHaveValue('40');
});

test('settings navigation and active controls remain usable at 280-760px panel widths', async ({page}) => {
  await open(page);
  for (const [width,height,panelWidth] of [[1920,1080,340],[1366,768,460],[1024,768,280],[1920,1080,760]]) {
    await page.setViewportSize({width,height});
    await tab(page,'布局'); await number(page,'设置面板宽度',panelWidth);
    for (const name of ['公共模块','首页','章节','资料','轮播','布局']) {
      await tab(page,name);
      await expect.poll(() => panel(page).evaluate(el => {
        const active=el.querySelector('.developer-settings-page:not([hidden])'), scroll=el.querySelector('.developer-settings-scroll');
        return el.scrollWidth<=el.clientWidth+1 && scroll.scrollWidth<=scroll.clientWidth+1 && active.getBoundingClientRect().width>150;
      })).toBe(true);
      await expect(panel(page).getByRole('button',{name:'关闭开发者参数'})).toBeVisible();
    }
  }
});

test('changing a subpage starts at its heading and reopening retains that subpage', async ({page}) => {
  await open(page);
  await page.setViewportSize({width:1366,height:768});
  await tab(page,'首页');
  await panel(page).getByRole('spinbutton',{name:'画册首次翻阅时长数值',exact:true}).scrollIntoViewIfNeeded();
  await tab(page,'图鉴');
  await expect.poll(() => panel(page).locator('.developer-settings-scroll').evaluate(el=>el.scrollTop)).toBe(0);
  await expect(panel(page).getByRole('heading',{name:'文化标题底板',exact:true})).toBeInViewport();
  await page.keyboard.press('Escape');
  await page.locator('.site-navigation [data-action="settings"]').click();
  await expect(panel(page).getByRole('tab',{name:'图鉴',exact:true})).toHaveAttribute('aria-selected','true');
  await tab(page,'章节'); await tab(page,'动作');
  await page.keyboard.press('Escape');
  await page.locator('.site-navigation [data-action="settings"]').click();
  await expect(panel(page).getByRole('tab',{name:'动作',exact:true})).toHaveAttribute('aria-selected','true');
});
