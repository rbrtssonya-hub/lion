import { test, expect } from '@playwright/test';

// Classic scrollbars expose the homepage → single-screen expression transition
// that headless Chromium's default --hide-scrollbars otherwise conceals.
test.use({ launchOptions: {
  ignoreDefaultArgs: ['--hide-scrollbars'],
  args: ['--disable-features=OverlayScrollbar,FluentOverlayScrollbar'],
} });

const duration = 1000;
const header = page => page.locator('.site-header');
const brand = page => page.getByRole('button', { name: '南风有狮，返回首页', exact: true });
const doubleFrame = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

async function open(page, settings = {}, route = 'entry') {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.addInitScript(value => {
    if (window !== window.top) return;
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    if (!localStorage.getItem('nanfeng-lion:developer-settings:v1')) {
      localStorage.setItem('nanfeng-lion:developer-settings:v1', JSON.stringify({ navigationTypographyVersion: 2, navigationDuration: 1000, homeBrandOffset: 64, ...value }));
    }
  }, settings);
  await page.goto(route === 'entry' ? '/' : `/#/${route}`);
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 60_000 });
  await page.evaluate(() => document.fonts.ready);
  await doubleFrame(page);
  await expect(header(page)).toHaveAttribute('data-nav-animating', 'false');
}

async function sampleFlight(page, selector, interrupt = null, remeasure = false) {
  return page.evaluate(async ({ selector, interrupt, duration, remeasure }) => {
    const read = () => {
      const box = element => {
        const rect = element.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      };
      const state = element => ({ ...box(element), opacity: Number(getComputedStyle(element).opacity),
        running: element.getAnimations().some(animation => animation.playState === 'running'),
        currentTime: element.getAnimations().find(animation => animation.playState === 'running')?.currentTime ?? null,
        willChange: element.style.willChange });
      const h = document.querySelector('.site-header');
      return { time: performance.now(), route: document.querySelector('#react-app').dataset.route,
        animating: h.dataset.navAnimating, columns: h.style.getPropertyValue('--navigation-columns'),
        pageWidth: document.querySelector('.site-page').getBoundingClientRect().width,
        brand: state(document.querySelector('.site-brand-capsule')),
        items: [...document.querySelectorAll('.site-nav-item')].map(item => ({
          key: item.dataset.route || 'settings', symbol: state(item.querySelector('.site-nav-symbol')),
          copy: state(item.querySelector('.site-nav-copy')),
        })) };
    };
    const initial = read();
    const frames = [];
    let preInterrupt, postInterrupt;
    const start = performance.now();
    if (remeasure) setTimeout(() => {
      // A font completion can arrive while the visible text is still scaled.
      // Its layout pass must use the glyph widths before animation transforms.
      document.fonts.dispatchEvent(new Event('loadingdone'));
    }, duration * .4);
    if (interrupt) setTimeout(() => {
      preInterrupt = read();
      document.querySelector(interrupt.selector).click();
      requestAnimationFrame(() => { postInterrupt = read(); });
    }, interrupt.after);
    document.querySelector(selector).click();
    await new Promise(resolve => {
      const collect = () => {
        frames.push(read());
        if (performance.now() - start < duration + (interrupt?.after || 0) + 140) requestAnimationFrame(collect);
        else resolve();
      };
      requestAnimationFrame(collect);
    });
    return { initial, frames, final: read(), preInterrupt, postInterrupt };
  }, { selector, interrupt, duration, remeasure });
}

function item(frame, key) { return frame.items.find(entry => entry.key === key); }
function expectNaturalFlight(flight, key, kind = 'symbol') {
  const initial = item(flight.initial, key)[kind];
  const final = item(flight.final, key)[kind];
  const distance = final.x - initial.x;
  expect(Math.abs(distance)).toBeGreaterThan(30);
  const running = flight.frames.filter(frame => item(frame, key)[kind].running);
  expect(running.length).toBeGreaterThan(8);
  expect(running.some(frame => item(frame, key)[kind].currentTime > duration * .65)).toBe(true);
  const middle = running.filter(frame => {
    const progress = (item(frame, key)[kind].x - initial.x) / distance;
    return progress > .08 && progress < .92;
  });
  expect(middle.length).toBeGreaterThan(3);
  expect(Math.max(...middle.map(frame => Math.abs((item(frame, key)[kind].x - initial.x) / distance - item(frame, key)[kind].currentTime / duration)))).toBeGreaterThan(.1);
  expect(flight.final.animating).toBe('false');
  expect(final.running).toBe(false);
  expect(final.willChange).toBe('');
}

test('经典滚动条下首页到三章保留图案文字和品牌的中间动画并自然完成', async ({ page }) => {
  await open(page);
  const homepageWidth = await page.locator('.site-page').evaluate(element => element.getBoundingClientRect().width);
  expect(homepageWidth).toBeLessThan(1920);
  for (const route of ['state', 'model', 'action']) {
    const flight = await sampleFlight(page, `.site-nav-item[data-route="${route}"]`);
    expectNaturalFlight(flight, 'model');
    expect(flight.final.pageWidth).toBeCloseTo(homepageWidth, 1);
    expect(flight.frames.some(frame => frame.brand.running && item(frame, 'model').copy.running)).toBe(true);
    expect(flight.frames.some(frame => item(frame, 'model').copy.opacity > .1 && item(frame, 'model').copy.opacity < .9)).toBe(true);
    expect(flight.frames.some(frame => item(frame, 'model').copy.width < item(flight.initial, 'model').copy.width * .8)).toBe(true);
    expect(flight.final.brand.x).toBeCloseTo(flight.initial.brand.x - 64, 1);
    expect(item(flight.final, 'model').copy.opacity).toBe(0);
    await expect(header(page)).toHaveAttribute('data-nav-layout', 'compact');
    const returning = await sampleFlight(page, '.site-brand-capsule');
    expectNaturalFlight(returning, 'model');
    expect(returning.final.route).toBe('entry');
  }
});

test('返回首页时主标题辅助字渐显放宽且中途复测不改变最终导航布局', async ({ page }) => {
  await open(page);
  const originalColumns = await header(page).evaluate(element => element.style.getPropertyValue('--navigation-columns'));
  const initial = await page.locator('.site-nav-copy').evaluateAll(elements => elements.map(element => {
    const rect = element.getBoundingClientRect();
    return { width: rect.width, x: rect.x, font: getComputedStyle(element).fontSize };
  }));
  await sampleFlight(page, '.site-nav-item[data-route="state"]');
  const returning = await sampleFlight(page, '.site-brand-capsule', null, true);
  expectNaturalFlight(returning, 'model');
  expect(returning.frames.every(frame => frame.columns === originalColumns)).toBe(true);
  for (const key of ['entry', 'model', 'action', 'state', 'settings']) {
    const frames = returning.frames.map(frame => item(frame, key).copy);
    expect(frames.some(copy => copy.running && copy.opacity > .15 && copy.opacity < .85)).toBe(true);
    const final = item(returning.final, key).copy;
    const original = initial[['entry', 'model', 'action', 'state', 'settings'].indexOf(key)];
    expect(final.opacity).toBe(1);
    expect(final.width).toBeCloseTo(original.width, 0);
    expect(final.x).toBeCloseTo(original.x, 0);
  }
  const layout = await page.locator('.site-nav-copy').evaluateAll(elements => elements.map(element => ({ font: getComputedStyle(element).fontSize, transform: getComputedStyle(element).transform })));
  expect(layout.map(value => value.font)).toEqual(initial.map(value => value.font));
  expect(layout.every(value => value.transform === 'none')).toBe(true);
});

test('品牌右移距离控制往返落点，0归位且快速回首页从可见中途位置接续', async ({ page }) => {
  await open(page);
  const flight = await sampleFlight(page, '.site-nav-item[data-route="state"]', { selector: '.site-brand-capsule', after: 370 });
  expect(flight.preInterrupt.brand.running).toBe(true);
  expect(Math.abs(flight.postInterrupt.brand.x - flight.preInterrupt.brand.x)).toBeLessThan(4);
  expect(Math.abs(item(flight.postInterrupt, 'model').symbol.x - item(flight.preInterrupt, 'model').symbol.x)).toBeLessThan(25);
  expect(flight.final.route).toBe('entry');
  expect(flight.final.brand.x).toBeCloseTo(flight.initial.brand.x, 1);
  expect(flight.final.animating).toBe('false');
  await page.evaluate(() => {
    const settings = JSON.parse(localStorage.getItem('nanfeng-lion:developer-settings:v1'));
    settings.homeBrandOffset = 0;
    localStorage.setItem('nanfeng-lion:developer-settings:v1', JSON.stringify(settings));
  });
  await page.reload();
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 60_000 });
  await page.evaluate(() => document.fonts.ready);
  await doubleFrame(page);
  const zero = await sampleFlight(page, '.site-nav-item[data-route="action"]');
  expect(zero.initial.brand.x).toBeCloseTo(zero.final.brand.x, 1);
  expect(zero.frames.some(frame => frame.brand.running)).toBe(false);
  await sampleFlight(page, '.site-brand-capsule');
  await expect(brand(page)).toBeVisible();
});

test('章节导航保留原底板和首页入口，中间透明且五项短标位于高亮下方', async ({ page }) => {
  await open(page, {}, 'state');
  await expect(page.locator('.navigation-surface')).toHaveCount(2);
  await expect(page.locator('.site-nav-item[data-route="entry"]')).toBeVisible();
  const geometry = await header(page).evaluate(element => {
    const rect = node => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; };
    const style = getComputedStyle(element);
    const surfaces = [...element.querySelectorAll('.navigation-surface')].map(surface => ({ ...rect(surface),
      opacity: getComputedStyle(surface).opacity, clip: getComputedStyle(surface).clipPath,
      background: getComputedStyle(surface).backgroundImage, svg: surface.querySelectorAll('svg path').length }));
    const buttons = [...element.querySelectorAll('.site-nav-item')].filter(button => getComputedStyle(button).visibility !== 'hidden').map(button => {
      const icon = button.querySelector('.site-nav-icon'); const label = button.querySelector('.site-nav-short-label');
      return { label: label.textContent, icon: rect(icon), labelRect: rect(label),
        underlineBottom: rect(icon).bottom - parseFloat(getComputedStyle(icon, '::after').bottom),
        font: getComputedStyle(label).fontFamily, current: button.getAttribute('aria-current') };
    });
    const middle = (surfaces[0].right + surfaces[1].left) / 2;
    const hit = document.elementFromPoint(middle, element.getBoundingClientRect().top + element.getBoundingClientRect().height / 2);
    return { color: style.backgroundColor, background: style.backgroundImage, backdrop: style.backdropFilter,
      surfaces, buttons, middleHasSurface: !!hit?.closest('.navigation-surface, .site-brand-capsule, .site-navigation') };
  });
  expect(geometry.color).toBe('rgba(0, 0, 0, 0)');
  expect(geometry.background).toBe('none');
  expect(geometry.backdrop).toBe('none');
  expect(geometry.middleHasSurface).toBe(false);
  expect(geometry.surfaces[1].left - geometry.surfaces[0].right).toBeGreaterThan(100);
  for (const surface of geometry.surfaces) {
    expect(surface.opacity).toBe('1');
    expect(surface.clip).toBe('none');
    expect(surface.background).toMatch(/linear-gradient/);
    expect(surface.svg).toBeGreaterThan(1);
  }
  expect(geometry.buttons.map(button => button.label)).toEqual(['首页', '结构', '动作', '神态', '设置']);
  for (const button of geometry.buttons) {
    expect(button.labelRect.top).toBeGreaterThanOrEqual(button.underlineBottom + 1);
    expect(button.labelRect.bottom).toBeLessThanOrEqual(geometry.surfaces[1].bottom);
    expect(button.font).not.toMatch(/Nanfeng Navigation Brush/);
  }
  expect(geometry.buttons.find(button => button.label === '神态').current).toBe('page');
});

test('电脑缩放和短顶栏保留两块边界，运行中resize清理旧位移且可重新导航', async ({ page }) => {
  await open(page, { headerHeight: 64 });
  await page.evaluate(() => document.querySelector('.site-nav-item[data-route="state"]').click());
  await expect(header(page)).toHaveAttribute('data-nav-animating', 'true');
  await page.setViewportSize({ width: 1366, height: 768 });
  await expect(header(page)).toHaveAttribute('data-nav-animating', 'false');
  for (const scale of [1, 1.25]) {
    await page.evaluate(value => { document.documentElement.style.zoom = String(value); }, scale);
    await doubleFrame(page);
    const geometry = await header(page).evaluate(element => {
      const bounds = element.getBoundingClientRect();
      return [...element.querySelectorAll('.site-brand-capsule, .site-navigation, .site-nav-item:not([data-route="entry"]) .site-nav-symbol')].map(node => {
        const r = node.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, header: { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom },
          running: node.getAnimations().some(animation => animation.playState === 'running'), willChange: node.style.willChange };
      });
    });
    for (const rect of geometry) {
      expect(rect.left).toBeGreaterThanOrEqual(rect.header.left - 1);
      expect(rect.right).toBeLessThanOrEqual(rect.header.right + 1);
      expect(rect.top).toBeGreaterThanOrEqual(rect.header.top - 1);
      expect(rect.bottom).toBeLessThanOrEqual(rect.header.bottom + 1);
      expect(rect.running).toBe(false);
      expect(rect.willChange).toBe('');
    }
  }
  await page.evaluate(() => { document.documentElement.style.zoom = ''; });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await doubleFrame(page);
  const returning = await sampleFlight(page, '.site-brand-capsule');
  expectNaturalFlight(returning, 'model');
});

test('减少动态在飞行中清理品牌图案与文字，品牌键盘返回首页保留焦点', async ({ page }) => {
  await open(page);
  await page.evaluate(() => document.querySelector('.site-nav-item[data-route="state"]').click());
  await expect(header(page)).toHaveAttribute('data-nav-animating', 'true');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(header(page)).toHaveAttribute('data-nav-animating', 'false');
  const active = await page.locator('.site-nav-symbol, .site-nav-copy, .site-brand-capsule').evaluateAll(elements => elements.map(element => ({
    running: element.getAnimations().some(animation => animation.playState === 'running'), willChange: element.style.willChange,
  })));
  expect(active.every(value => !value.running && value.willChange === '')).toBe(true);
  await brand(page).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'entry');
  await expect(header(page)).toHaveAttribute('data-nav-mode', 'expanded');
  await expect(brand(page)).toBeFocused();
  await expect(header(page)).toHaveAttribute('data-nav-animating', 'false');
  const restored = await page.locator('.site-nav-copy').evaluateAll(elements => elements.map(element => ({ opacity: getComputedStyle(element).opacity, transform: getComputedStyle(element).transform })));
  expect(restored.every(value => value.opacity === '1' && value.transform === 'none')).toBe(true);
});
