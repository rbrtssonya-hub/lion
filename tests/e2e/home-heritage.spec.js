import { test, expect } from '@playwright/test';
import { selectSettingsFor } from './settings-navigation.helpers.js';
import { lionTypes } from '../../src/data/home-heritage.js';

async function open(page) {
  await page.addInitScript(() => {
    if (window !== top) return;
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    sessionStorage.setItem('nanfeng-lion:book-intro-seen:v1', '1');
    if (!localStorage.getItem('nanfeng-lion:developer-settings:v1')) localStorage.setItem('nanfeng-lion:developer-settings:v1', JSON.stringify({ carouselAutoplay: false, navigationTypographyVersion: 2 }));
  });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 45000 });
}

test('heritage sections appear in order; type selection synchronizes artwork, three observations and sources', async ({ page }) => {
  await open(page);
  const types = page.locator('#homeLionTypes');
  await types.scrollIntoViewIfNeeded();
  await expect(types.getByRole('tab', { selected: true })).toHaveText('佛山狮传统流派');
  for (const [name, id, kind] of [['鹤山狮', 'heshan', '传统流派'], ['佛鹤狮', 'fut-hok', '融合形制'], ['佛山狮', 'foshan', '传统流派']]) {
    await types.getByRole('tab', { name: new RegExp(name) }).click();
    const article = types.locator('[data-type-id]');
    await expect(article).toHaveAttribute('data-type-id', id);
    const imageButton = article.getByRole('button', { name: `展开${name}介绍`, exact: true });
    await expect(imageButton).toHaveAttribute('aria-expanded', 'false');
    await expect(article.locator('.heritage-copy')).toBeHidden();
    await imageButton.click();
    await expect(article.getByRole('heading', { level: 3, name, exact: true })).toBeVisible();
    await expect(article.locator('.heritage-kind')).toHaveText(kind);
    await expect(article.getByRole('img')).toHaveAttribute('src', new RegExp(`lion-types/${id}\\.png$`));
    await expect(article.locator('.heritage-hotspot, .heritage-point-list button')).toHaveCount(0);
    const observations = article.getByRole('list', { name: '观察重点' });
    await expect(observations.getByRole('listitem')).toHaveCount(3);
    for (const point of lionTypes.find(type => type.id === id).points) {
      const item = observations.getByRole('listitem').filter({ has: page.getByRole('heading', { name: point.label, exact: true }) });
      await expect(item.locator('p')).toHaveText(point.text);
    }
    await expect(article.getByRole('link', { name: /查阅资料/ }).first()).toHaveAttribute('href', /^https:\/\//);
  }
  const order = await page.locator('#homeLionBook, #homeCulture, #homeLionTypes, #homeInheritors, #homeCultureSources').evaluateAll(nodes => nodes.map(n => n.id));
  expect(order).toEqual(['homeLionBook', 'homeCulture', 'homeLionTypes', 'homeCultureSources']);
  await expect(page.locator('#homeInheritors')).toHaveCount(0);
  await expect(types).toContainText(/AI辅助/);
  await expect(types.getByRole('heading', { name: '传统地狮' })).toBeVisible();
  await expect(types.getByRole('heading', { name: '高桩表演' })).toBeVisible();
});

test('the mounted homepage removes people and photo entries while retaining all four archive destinations', async ({ page }) => {
  const requests = [];
  page.on('request', request => {
    if (/\/(?:tmp\/home-inheritor-photos|assets\/home-heritage\/inheritors)\//.test(new URL(request.url()).pathname)) requests.push(request.url());
  });
  await open(page);
  await page.locator('#homeLionBook').scrollIntoViewIfNeeded();
  const nav = page.getByRole('navigation', { name: '首页章节导航' });
  await expect(nav.getByRole('button')).toHaveText(['岭南醒狮志', '醒狮文化', '醒狮种类', '参考资料']);
  await expect(page.locator('#homeInheritors, .heritage-person-choice, .archive-portrait-sources')).toHaveCount(0);
  await nav.getByRole('button', { name: '参考资料', exact: true }).click();
  await expect(nav.getByRole('button', { name: '参考资料', exact: true })).toHaveAttribute('aria-current', 'location');
  const sources = page.locator('#homeCultureSources');
  await expect(sources.getByRole('heading', { name: '人物资料', exact: true })).toHaveCount(0);
  await expect(sources.getByRole('link', { name: /照片来源/ })).toHaveCount(0);
  expect(requests).toEqual([]);
});

test('local keyboard, rapid selection and reduced motion do not change the culture carousel or hash', async ({ page }) => {
  await open(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const index = await page.locator('#homeCulture').getAttribute('data-culture-index');
  const hash = new URL(page.url()).hash;
  const types = page.locator('#homeLionTypes');
  const first = types.getByRole('tab').first();
  await first.focus();
  await first.press('End');
  await expect(types.getByRole('tab').last()).toBeFocused();
  await expect(types.getByRole('tab').last()).toHaveAttribute('aria-selected', 'true');
  await types.getByRole('tab').last().press('Home');
  await expect(first).toBeFocused();
  for (const i of [2, 1, 0, 2]) await types.getByRole('tab').nth(i).click();
  await expect(types.locator('[data-type-id]')).toHaveAttribute('data-type-id', 'fut-hok');
  const imageButton = types.getByRole('button', { name: '展开佛鹤狮介绍', exact: true });
  await imageButton.focus();
  await imageButton.press('Enter');
  await expect(imageButton).toHaveAttribute('aria-expanded', 'true');
  await expect(types.getByRole('list', { name: '观察重点' }).getByRole('listitem')).toHaveCount(3);
  expect(await types.locator('.heritage-type-copy').evaluate(n => getComputedStyle(n).animationName)).toBe('none');
  await imageButton.press('Escape');
  await expect(imageButton).toBeFocused();
  await expect(types.locator('.heritage-copy')).toBeHidden();
  expect(await page.locator('#homeCulture').getAttribute('data-culture-index')).toBe(index);
  expect(new URL(page.url()).hash).toBe(hash);
});

test('deferred type artwork cannot hold startup and unavailable images retain usable observations', async ({ page }) => {
  await page.addInitScript(() => {
    if (window !== top) return;
    new MutationObserver(() => {
      const loader=document.getElementById('startupLoading');
      if(loader) window.heritageStartupFailures=loader.dataset.failures||'';
    }).observe(document,{subtree:true,childList:true,attributes:true,attributeFilter:['data-failures']});
  });
  await page.route('**/assets/lion-types/**', route => route.abort());
  await open(page);
  expect(await page.evaluate(()=>window.heritageStartupFailures)).not.toContain('图像与章节');
  const types = page.locator('#homeLionTypes');
  await types.scrollIntoViewIfNeeded();
  await expect(types.locator('.heritage-image-fallback')).toBeVisible();
  const imageButton = types.getByRole('button', { name: '展开佛山狮介绍', exact: true });
  await imageButton.click();
  await expect(imageButton).toHaveAttribute('aria-expanded', 'true');
  await expect(types.getByRole('list', { name: '观察重点' }).getByRole('listitem')).toHaveCount(3);
});

test('new sections share existing reading surfaces and persist previews without adding settings', async ({page}) => {
  await open(page);
  await page.locator('.site-header [data-action="settings"]').click();
  const panel=page.getByRole('region',{name:'开发者参数设置'});
  await selectSettingsFor(page, 'cultureTitle');
  for(const [name,value] of [['文化标题底板透明度数值','100'],['文化正文底板透明度数值','100']]) {
    const input=panel.getByRole('spinbutton',{name,exact:true});await input.fill(value);await input.press('Tab');
  }
  await page.locator('#homeLionTypes .heritage-type-image').click();
  for(const selector of ['#homeLionTypes .heritage-heading','#homeLionTypes .heritage-copy']) {
    await expect(page.locator(selector)).toHaveCSS('background-color','rgba(255, 249, 238, 0)');
    await expect(page.locator(selector)).toHaveCSS('backdrop-filter','none');
    await expect(page.locator(selector)).toHaveCSS('opacity','1');
  }
  await page.reload();await expect(page.locator('#startupLoading')).toHaveCount(0,{timeout:45000});
  await expect(page.locator('#homeLionTypes .heritage-heading')).toHaveCSS('background-color','rgba(255, 249, 238, 0)');
  await page.locator('.site-header [data-action="settings"]').click();
  await panel.getByRole('button',{name:'恢复默认参数',exact:true}).click();
  await expect(page.locator('#homeLionTypes .heritage-copy')).toHaveCSS('background-color','rgba(255, 249, 238, 0.6)');
});

test('unified sources preserve references, the approved paw and book emblem, and collapsed image and engineering licences without person entries', async ({ page }) => {
  await open(page);
  const sources = page.locator('#homeCultureSources');
  await sources.scrollIntoViewIfNeeded();
  await expect(sources.locator('.home-culture-source-cards').getByRole('link')).toHaveCount(3);
  await expect(sources.locator('.heritage-source-group')).toHaveCount(2);
  await expect(sources.getByRole('heading', { name: '历史与文化', exact: true })).toBeVisible();
  await expect(sources.getByRole('heading', { name: '形制与工艺', exact: true })).toBeVisible();
  const formSource = page.locator('.heritage-form-note').getByRole('link');
  await expect(sources.locator('.home-culture-source-cards').getByRole('link', { name: /狮舞 · 广东醒狮/ })).toHaveAttribute('href', await formSource.getAttribute('href'));
  const emblem = sources.locator('.home-culture-sources-emblem');
  await expect(emblem).toHaveAttribute('aria-hidden', 'true');
  await expect(emblem.locator('img')).toHaveAttribute('src', /archive-ornament-paw\.png$/);
  await expect(emblem.locator(':scope > svg')).toBeVisible();
  for (const src of await sources.locator('img').evaluateAll(images => images.map(image => image.src))) {
    expect(new URL(src).pathname).toMatch(/\/archive-ornament-(peeking|paw|tail)\.png$/);
  }
  await expect(page.locator('.home-archive-scene .lion-archive-ornament img[src*="nav-lion-head"], .home-culture-sources-emblem img[src*="nav-lion-head"]')).toHaveCount(0);
  const provenance = sources.locator('details.archive-provenance');
  await expect(provenance).toHaveJSProperty('open', false);
  await provenance.locator('summary').click();
  await expect(provenance.locator('.archive-portrait-sources')).toHaveCount(0);
  await expect(sources.getByRole('heading', { name: '人物资料', exact: true })).toHaveCount(0);
  await expect(sources.getByRole('link', { name: /照片来源/ })).toHaveCount(0);
  await expect(provenance.getByRole('link', { name: /ThreeUI/ })).toHaveAttribute('href', /threeui-LICENSE/);
  await expect(provenance.getByRole('link', { name: '字体许可', exact: true })).toHaveAttribute('href', /LICENSE/);
  await expect(provenance).toContainText('AI辅助');
  await expect(sources.locator('.home-culture-source-cards img, .heritage-source-groups img, .archive-portrait-sources img')).toHaveCount(0);
  await sources.getByText('摄影署名与许可', { exact: false }).click();
  await expect(sources.locator('.home-culture-photo-license')).toHaveCount(8);
  await expect(sources.locator('.home-culture-photo-license').first()).toBeVisible();
});

test('heritage title paper contains its text and lion ornament at 40 percent width', async ({ page }) => {
  await open(page);
  await page.locator('.site-header [data-action="settings"]').click();
  const panel = page.getByRole('region', { name: '开发者参数设置' });
  await selectSettingsFor(page, 'cultureTitle');
  const width = panel.getByRole('spinbutton', { name: '文化标题底板宽度数值', exact: true });
  await width.fill('40'); await width.press('Tab');
  await page.locator('.site-header [data-action="settings"]').click();
  for (const [w,h] of [[1920,1080],[2560,1440],[1366,768],[1024,768]]) {
    await page.setViewportSize({ width:w, height:h });
    for (const heading of await page.locator('.heritage-heading').all()) {
      const fits = await heading.evaluate(n => {
        const box=n.getBoundingClientRect();
        return n.scrollWidth<=n.clientWidth+1 && [...n.querySelectorAll('.heritage-eyebrow, h2, .lion-archive-title-line, .lion-archive-ornament, .heritage-lead')].every(child=>{
          const rect=child.getBoundingClientRect();
          return rect.left>=box.left-1 && rect.right<=box.right+1 && child.scrollWidth<=child.clientWidth+1;
        });
      });
      expect(fits, `title paper and descendants:${w}`).toBe(true);
    }
  }
});

test('heritage desktop geometry remains readable at target widths and 900px pushed page', async ({ page }) => {
  await open(page);
  for (const [width, height] of [[1920,1080],[2560,1440],[1366,768],[1024,768]]) {
    await page.setViewportSize({width,height});
    for (const id of ['homeLionTypes','homeCultureSources']) {
      const section=page.locator(`#${id}`);
      await section.scrollIntoViewIfNeeded();
      const geometry=await section.evaluate(n=>({fits:n.scrollWidth<=n.clientWidth+1, right:n.getBoundingClientRect().right, width:document.documentElement.clientWidth}));
      expect(geometry.fits, `${width}:${id}`).toBe(true);
      expect(geometry.right).toBeLessThanOrEqual(geometry.width+1);
    }
  }
  await page.setViewportSize({width:1500,height:1080});
  await page.locator('.site-header [data-action="settings"]').click();
  const panel=page.getByRole('region', { name: '开发者参数设置' });
  await selectSettingsFor(page, 'panelWidth');
  const shellWidth=await page.locator('.site-shell').evaluate(n=>n.getBoundingClientRect().width);
  const widthInput=panel.getByRole('spinbutton',{name:'设置面板宽度数值',exact:true});
  await widthInput.fill(String(shellWidth-900)); await widthInput.press('Tab');
  await expect.poll(()=>page.locator('.site-page').evaluate(n=>n.getBoundingClientRect().width)).toBe(900);
  for (const id of ['homeLionTypes']) {
    const section=page.locator(`#${id}`); await section.scrollIntoViewIfNeeded();
    expect(await section.evaluate(n=>n.scrollWidth<=n.clientWidth+1)).toBe(true);
    const columns = await section.locator('.heritage-layout').evaluate(node => ({
      actual: getComputedStyle(node).gridTemplateColumns.split(' ').length,
      expected: node.closest('.heritage-inner').clientWidth >= 760 ? 2 : 1,
    }));
    expect(columns.actual).toBe(columns.expected);
  }
});
