import { test, expect } from '@playwright/test';

const destinations = [
  ['homeLionBook', '岭南醒狮志'],
  ['homeCulture', '醒狮文化'],
  ['homeLionTypes', '醒狮种类'],
  ['homeCultureSources', '参考资料'],
];

async function openHome(page, reducedMotion = 'reduce', url = '/') {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.emulateMedia({ reducedMotion });
  await page.addInitScript(() => {
    if (window !== top) return;
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    sessionStorage.setItem('nanfeng-lion:book-intro-seen:v1', '1');
    localStorage.setItem('nanfeng-lion:developer-settings:v1', JSON.stringify({
      carouselAutoplay: false, navigationTypographyVersion: 2,
    }));
  });
  await page.goto(url);
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 45_000 });
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'entry');
  await page.evaluate(() => document.fonts.ready);
}

async function showRail(page) {
  await page.locator('#homeLionTypes').scrollIntoViewIfNeeded();
  const rail = page.getByRole('navigation', { name: '首页章节导航', exact: true });
  await expect(rail).toBeVisible();
  return rail;
}

async function expectMarkerAt(rail, id) {
  await expect.poll(() => rail.evaluate((nav, id) => {
    const marker = nav.querySelector('.home-archive-nav-lion').getBoundingClientRect();
    const stop = nav.querySelector(`[data-home-section="${id}"] i`).getBoundingClientRect();
    return Math.hypot((marker.left + marker.right - stop.left - stop.right) / 2,
      (marker.top + marker.bottom - stop.top - stop.bottom) / 2);
  }, id)).toBeLessThan(1.5);
  await expect.poll(() => rail.evaluate((nav, id) => {
    const marker = nav.querySelector('.home-archive-nav-lion').getBoundingClientRect();
    const label = nav.querySelector(`[data-home-section="${id}"] span`).getBoundingClientRect();
    return marker.right <= label.left - 4 || marker.bottom <= label.top - 4;
  }, id), { message: 'The lion must leave readable space around the current label' }).toBe(true);
  const bounds = await rail.evaluate(nav => {
    const marker = nav.querySelector('.home-archive-nav-lion').getBoundingClientRect();
    const box = nav.getBoundingClientRect();
    return { width: marker.width, height: marker.height, inset: Math.min(
      marker.left - box.left, marker.top - box.top, box.right - marker.right, box.bottom - marker.bottom,
    ) };
  });
  expect(bounds.width).toBe(48);
  expect(bounds.height).toBe(48);
  expect(bounds.inset, 'The complete 48px lion fits inside the rail canvas').toBeGreaterThanOrEqual(-1);
}

async function expectRailGeometry(page, rail, large = false) {
  const appearance = await rail.evaluate(nav => ({
    background: getComputedStyle(nav).backgroundColor,
    backdrop: getComputedStyle(nav, '::before').content,
    fontSize: parseFloat(getComputedStyle(nav.querySelector('button')).fontSize),
    compact: nav.getBoundingClientRect().width < 180,
    labelsFit: [...nav.querySelectorAll('button span')].every(label => {
      const box = label.getBoundingClientRect(), frame = nav.getBoundingClientRect();
      return box.left >= frame.left && box.right <= frame.right && box.height <= label.parentElement.getBoundingClientRect().height;
    }),
  }));
  expect(appearance.background).toBe('rgba(0, 0, 0, 0)');
  expect(appearance.backdrop).toBe('none');
  expect(appearance.fontSize).toBeGreaterThanOrEqual(appearance.compact ? 18 : 22);
  expect(appearance.labelsFit).toBe(true);
  const geometry = await rail.evaluate(nav => {
    const bounds = nav.getBoundingClientRect();
    const track = nav.querySelector('.home-archive-nav-track').getBoundingClientRect();
    const stops = [...nav.querySelectorAll('[data-navigation-stop]')].map(node => {
      const box = node.getBoundingClientRect();
      return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    });
    return {
      top: bounds.top, bottom: bounds.bottom, height: bounds.height,
      header: document.querySelector('.site-header').getBoundingClientRect().bottom,
      viewport: innerHeight, stops,
      track: { x: track.left + track.width / 2, top: track.top, bottom: track.bottom },
      fits: [...nav.querySelectorAll('button')].every(button => {
        const box = button.getBoundingClientRect();
        return box.top >= bounds.top - 1 && box.bottom <= bounds.bottom + 1;
      }),
    };
  });
  await test.info().attach('rail-geometry', {
    body: JSON.stringify({ viewportSize: page.viewportSize(), ...geometry }), contentType: 'application/json',
  });
  if (large) {
    expect(geometry.height).toBeGreaterThanOrEqual(520);
    expect(geometry.height).toBeLessThanOrEqual(600);
  }
  expect(geometry.fits).toBe(true);
  expect(geometry.top).toBeGreaterThanOrEqual(geometry.header + 12);
  expect(geometry.bottom).toBeLessThanOrEqual(geometry.viewport - 12);
  expect(geometry.stops).toHaveLength(4);
  const gaps = geometry.stops.slice(1).map((stop, index) => stop.y - geometry.stops[index].y);
  expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThan(1);
  expect(Math.min(...gaps)).toBeGreaterThan(44);
  for (const stop of geometry.stops) expect(Math.abs(stop.x - geometry.track.x)).toBeLessThan(1);
  expect(Math.abs(geometry.stops[0].y - geometry.track.top)).toBeLessThan(1);
  expect(Math.abs(geometry.stops.at(-1).y - geometry.track.bottom)).toBeLessThan(1);
  if (large) {
    expect(Math.min(...gaps)).toBeGreaterThan(120);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (await rail.locator('canvas').evaluate(canvas => getComputedStyle(canvas).display !== 'none')) {
    const canvas = await rail.locator('canvas').boundingBox();
    const box = await rail.boundingBox();
    expect(canvas).toEqual(box);
    expect(canvas.y).toBeGreaterThanOrEqual(geometry.header + 12);
    expect(canvas.y + canvas.height).toBeLessThanOrEqual(geometry.viewport - 12);
  }
}

test('all archive sections keep equal page margins independently of the sidebar and settings push', async ({ page }) => {
  await openHome(page);
  const selectors = ['.lion-book-inner', '.home-culture-inner', '#homeLionTypes .heritage-inner', '#homeCultureSources'];
  const symmetric = async () => {
    for (const selector of selectors) {
      await expect.poll(() => page.locator(selector).evaluate(node => {
        const bounds = node.getBoundingClientRect(), frame = node.closest('.site-page').getBoundingClientRect();
        return Math.abs((bounds.left - frame.left) - (frame.right - bounds.right));
      }), { message: `${selector} must use the page center, not a sidebar-shifted center` }).toBeLessThan(2);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  };
  for (const [width, height] of [[2560,1440], [1920,1080], [1366,768], [1024,768], [900,600]]) {
    await page.setViewportSize({width,height});
    await symmetric();
  }
  await page.setViewportSize({width:1500,height:1080});
  await page.locator('.site-header [data-action="settings"]').click();
  const settings = page.getByRole('region',{name:'开发者参数设置',exact:true});
  await settings.getByRole('tab',{name:'布局',exact:true}).click();
  await settings.getByRole('checkbox',{name:'设置面板推开页面',exact:true}).check();
  const shell = await page.locator('.site-shell').evaluate(n=>n.getBoundingClientRect().width);
  const width = settings.getByRole('spinbutton',{name:'设置面板宽度数值',exact:true});
  await width.fill(String(shell - 900)); await width.press('Tab');
  await expect.poll(()=>page.locator('.site-page').evaluate(n=>n.getBoundingClientRect().width)).toBe(900);
  await symmetric();
});

for (const url of ['/', '/?researchPhotos=1']) {
  test(`mounted home removes inheritors and photo entrances while retaining cultural credits: ${url}`, async ({ page }) => {
    const errors = [], portraitRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
      if (/\/src\/data\/inheritor-photos\.js|\/tmp\/.*(?:inheritor|portrait)/i.test(request.url())) portraitRequests.push(request.url());
    });
    await openHome(page, 'reduce', url);
    await expect(page.locator('#homeInheritors, #inheritors-title, #heritage-person-panel, [data-person-id], .heritage-person-photo, .heritage-person-plaque')).toHaveCount(0);
    await expect(page.locator('[aria-controls="homeInheritors"], a[href*="homeInheritors"]')).toHaveCount(0);
    const rail = await showRail(page);
    await expect(rail.getByRole('button')).toHaveText(destinations.map(([, label]) => label));
    const sources = page.locator('#homeCultureSources');
    await sources.scrollIntoViewIfNeeded();
    await expect(sources.locator('.home-culture-source-cards a')).toHaveCount(3);
    await expect(sources.locator('.heritage-source-group')).toHaveCount(1);
    await expect(sources.getByRole('region', { name: '种类资料', exact: true })).toBeVisible();
    await expect(sources.getByRole('region', { name: '人物资料', exact: true })).toHaveCount(0);
    await sources.locator('.archive-provenance summary').click();
    await expect(sources.locator('.archive-portrait-sources')).toHaveCount(0);
    await expect(sources.getByRole('link', { name: /照片来源|冯昆杰|赵继红|黄钦添|赵伟斌|黎伟|黎婉珍/ })).toHaveCount(0);
    await expect(sources.locator('.archive-provenance')).toContainText('AI辅助示意');
    await expect(sources.getByRole('link', { name: 'Sketchbook · ThreeUI / MIT', exact: true })).toHaveAttribute('href', /LICENSE/);
    await expect(sources.getByRole('link', { name: '字体许可', exact: true })).toHaveAttribute('href', /threeui-FONT-LICENSES\.txt$/);
    await sources.locator('.home-culture-photo-licenses summary').click();
    const licenses = sources.locator('.home-culture-photo-license');
    await expect(licenses).toHaveCount(8);
    for (const license of await licenses.all()) {
      await expect(license).toBeVisible();
      expect(await license.locator('a[href^="https://"]').count()).toBeGreaterThanOrEqual(2);
    }
    expect(portraitRequests).toEqual([]);
    expect(errors).toEqual([]);
  });
}

for (const reducedMotion of ['no-preference', 'reduce']) {
  test(`four archive entrances scroll to real sections and align the lion: ${reducedMotion}`, async ({ page }) => {
    await openHome(page, reducedMotion);
    const rail = await showRail(page);
    await expect(rail.getByRole('button')).toHaveCount(4);
    const hash = new URL(page.url()).hash;
    for (const [id, label] of destinations) {
      const button = rail.getByRole('button', { name: label, exact: true });
      await expect(button).toHaveAttribute('aria-controls', id);
      await button.click();
      await expect(button).toHaveAttribute('aria-current', 'location');
      if (reducedMotion === 'no-preference' && id === 'homeLionBook') {
        await expect.poll(() => rail.locator('canvas').evaluate(canvas => {
          const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
          return pixels.some((alpha, index) => index % 4 === 3 && alpha > 0);
        })).toBe(true);
      }
      await expect.poll(() => page.locator(`#${id}`).evaluate(section => {
        const title = document.getElementById(section.getAttribute('aria-labelledby')) || section.querySelector('h2') || section;
        const header = document.querySelector('.site-header').getBoundingClientRect().bottom;
        const top = title.getBoundingClientRect().top;
        return top >= header - 1 && top < innerHeight;
      })).toBe(true);
      await expectMarkerAt(rail, id);
    }
    await rail.getByRole('button').last().focus();
    await page.keyboard.press('ArrowDown');
    await expect(rail.getByRole('button').first()).toBeFocused();
    await page.keyboard.press('End');
    await expect(rail.getByRole('button').last()).toBeFocused();
    expect(new URL(page.url()).hash).toBe(hash);
    if (reducedMotion === 'reduce') {
      await expect(rail).toHaveAttribute('data-playing', 'false');
      await expect(rail).toHaveAttribute('data-observing', 'false');
      await expect(rail.locator('canvas')).toHaveCSS('display', 'none');
    } else {
      await expect(rail.locator('canvas')).toHaveCSS('display', 'block');
      await expect(rail.locator('canvas')).toHaveJSProperty('width', 184);
    }
  });

  test(`rail grows on large desktops and its endpoints survive resizing: ${reducedMotion}`, async ({ page }) => {
    await openHome(page, reducedMotion);
    const rail = await showRail(page);
    for (const [width, height] of [[1920, 1080], [1366, 768], [1024, 768], [1024, 540], [1920, 1080]]) {
      await page.setViewportSize({ width, height });
      await showRail(page);
      await expectRailGeometry(page, rail, width === 1920);
      for (const [id] of [destinations[0], destinations.at(-1)]) {
        await rail.locator(`[data-home-section="${id}"]`).click();
        await expectMarkerAt(rail, id);
      }
    }
    await page.screenshot({ path: test.info().outputPath(`archive-rail-${reducedMotion}.png`) });
  });

  test(`available height follows the real 90/180px header through desktop resizes: ${reducedMotion}`, async ({ page }) => {
    test.setTimeout(90_000);
    await openHome(page, reducedMotion);
    const rail = await showRail(page);
    for (const [width, height] of [[1920, 1080], [1366, 768], [1024, 768], [900, 600], [900, 520]]) {
      await page.setViewportSize({ width, height });
      await showRail(page);
      for (const headerHeight of [90, 180]) {
        // Change only the real header's box: stale --site-header-height must
        // never position the rail over a taller physical header.
        await page.locator('.site-header').evaluate((node, value) => { node.style.height = `${value}px`; }, headerHeight);
        await expect.poll(() => rail.evaluate(nav => {
          const header = document.querySelector('.site-header').getBoundingClientRect().bottom;
          const box = nav.getBoundingClientRect();
          return box.top >= header + 12 && box.bottom <= innerHeight - 12 &&
            Math.abs(box.top - (header + (innerHeight - header - box.height) / 2)) < 1;
        })).toBe(true);
        await expectRailGeometry(page, rail, width === 1920);
        expect((await rail.boundingBox()).width).toBe(width > 1250 ? 184 : 140);
        for (const [id] of [destinations[0], destinations.at(-1)]) {
          await rail.locator(`[data-home-section="${id}"]`).click();
          await expectMarkerAt(rail, id);
        }
      }
    }
    await page.screenshot({ path: test.info().outputPath(`archive-short-header180-${reducedMotion}.png`) });
  });

  test(`900px pushed page keeps the rail outside type artwork and body copy: ${reducedMotion}`, async ({ page }) => {
    test.setTimeout(90_000);
    await openHome(page, reducedMotion);
    await page.setViewportSize({ width: 1500, height: 1080 });
    await page.locator('.site-header [data-action="settings"]').click();
    const settings = page.getByRole('region', { name: '开发者参数设置', exact: true });
    await settings.getByRole('tab', { name: '布局', exact: true }).click();
    await settings.getByRole('checkbox', { name: '设置面板推开页面', exact: true }).check();
    const shellWidth = await page.locator('.site-shell').evaluate(node => node.getBoundingClientRect().width);
    const widthInput = settings.getByRole('spinbutton', { name: '设置面板宽度数值', exact: true });
    await widthInput.fill(String(shellWidth - 900));
    await widthInput.press('Tab');
    await expect.poll(() => page.locator('.site-page').evaluate(node => node.getBoundingClientRect().width)).toBe(900);
    const rail = await showRail(page);
    await expect(rail.getByRole('button')).toHaveCount(4);
    const types = page.locator('#homeLionTypes');
    await types.getByRole('button', { name: '展开佛山狮介绍', exact: true }).click();
    await expect(types.locator('.heritage-type-copy')).toBeVisible();
    await expectRailGeometry(page, rail, true);
    const railRight = await rail.evaluate(node => node.getBoundingClientRect().right);
    for (const selector of ['.heritage-heading', '.heritage-figure', '.heritage-type-copy']) {
      const bounds = await types.locator(selector).boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(railRight + 8);
    }
    await expectMarkerAt(rail, 'homeLionTypes');
    for (const height of [768, 600, 520]) {
      await page.setViewportSize({ width: 1500, height });
      for (const headerHeight of [90, 180]) {
        await page.locator('.site-header').evaluate((node, value) => { node.style.height = `${value}px`; }, headerHeight);
        await showRail(page);
        await expect.poll(() => rail.evaluate(nav => Number(nav.style.getPropertyValue('--archive-nav-header').replace('px', '')))).toBe(headerHeight);
        await expectRailGeometry(page, rail);
        await expectMarkerAt(rail, 'homeLionTypes');
        expect((await rail.boundingBox()).width).toBe(140);
      }
    }
    await page.screenshot({ path: test.info().outputPath(`archive-pushed-${reducedMotion}.png`) });
  });
}
