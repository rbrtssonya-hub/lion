import { test, expect } from '@playwright/test';

// Keep real desktop scrollbars: changing chapters must not shift the red bar.
test.use({ launchOptions: {
  ignoreDefaultArgs: ['--hide-scrollbars'],
  args: ['--disable-features=OverlayScrollbar,FluentOverlayScrollbar'],
} });

const duration = 1000;
const header = page => page.locator('.site-header');
const brand = page => page.getByRole('button', { name: '南风有狮，返回首页', exact: true });
const doubleFrame = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

async function open(page, settings = {}, route = 'entry') {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
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
        const r = element.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
      };
      const state = element => ({ ...box(element), opacity: Number(getComputedStyle(element).opacity),
        transform: getComputedStyle(element).transform,
        running: element.getAnimations().some(animation => animation.playState === 'running'),
        currentTime: element.getAnimations().find(animation => animation.playState === 'running')?.currentTime ?? null,
        willChange: element.style.willChange });
      const background = element => {
        const style = getComputedStyle(element);
        return { ...box(element), animations: element.getAnimations().length,
          style: Object.fromEntries(['backgroundColor', 'backgroundImage', 'backdropFilter', 'borderRadius', 'borderBottom', 'boxShadow', 'clipPath', 'opacity', 'transform'].map(key => [key, style[key]])) };
      };
      const h = document.querySelector('.site-header');
      const backgrounds = [background(h), ...[...h.querySelectorAll('.navigation-surface')].map(background)];
      const bounds = box(h);
      const painted = backgrounds.filter(layer => Number(layer.style.opacity) > 0 &&
        (layer.style.backgroundImage !== 'none' || !['rgba(0, 0, 0, 0)', 'transparent'].includes(layer.style.backgroundColor)));
      const covered = [.1, .5, .9].every(y => Array.from({ length: 41 }, (_, index) => {
        const x = bounds.x + bounds.width * (index + .5) / 41;
        const top = bounds.y + bounds.height * y;
        return painted.some(layer => x >= layer.x - .5 && x <= layer.right + .5 && top >= layer.y - .5 && top <= layer.bottom + .5);
      }).every(Boolean));
      return { time: performance.now(), route: document.querySelector('#react-app').dataset.route,
        animating: h.dataset.navAnimating, columns: h.style.getPropertyValue('--navigation-columns'),
        pageWidth: document.querySelector('.site-page').getBoundingClientRect().width,
        brand: state(h.querySelector('.site-brand-capsule')), backgrounds, covered,
        items: [...h.querySelectorAll('.site-nav-item')].map(element => ({
          key: element.dataset.route || 'settings', button: box(element),
          symbol: state(element.querySelector('.site-nav-icon')), copy: state(element.querySelector('.site-nav-copy')),
        })) };
    };
    const initial = read();
    const frames = [];
    let preInterrupt, postInterrupt;
    const start = performance.now();
    if (remeasure) setTimeout(() => document.fonts.dispatchEvent(new Event('loadingdone')), duration * .4);
    if (interrupt) setTimeout(() => {
      preInterrupt = read();
      document.querySelector(interrupt.selector).click();
      requestAnimationFrame(() => { postInterrupt = read(); });
    }, interrupt.after);
    document.querySelector(selector).click();
    await new Promise(resolve => {
      const collect = () => {
        const frame = read();
        frames.push(frame);
        const elapsed = performance.now() - start;
        const minimum = duration + (interrupt?.after || 0) + 140;
        // A cold model route can delay the first animation frame. Keep sampling
        // its real flight instead of treating time before it starts as motion.
        if (elapsed < minimum || (frame.animating === 'true' && elapsed < minimum + duration * 2)) requestAnimationFrame(collect);
        else resolve();
      };
      requestAnimationFrame(collect);
    });
    return { initial, frames, final: read(), preInterrupt, postInterrupt };
  }, { selector, interrupt, duration, remeasure });
}

function item(frame, key) { return frame.items.find(entry => entry.key === key); }

function expectNaturalFlight(flight, key = 'model') {
  const initial = item(flight.initial, key).symbol;
  const final = item(flight.final, key).symbol;
  const distance = final.x - initial.x;
  expect(Math.abs(distance)).toBeGreaterThan(30);
  const running = flight.frames.filter(frame => item(frame, key).symbol.running);
  expect(running.length).toBeGreaterThan(8);
  expect(running.some(frame => item(frame, key).symbol.currentTime > duration * .65)).toBe(true);
  const middle = running.filter(frame => {
    const progress = (item(frame, key).symbol.x - initial.x) / distance;
    return progress > .08 && progress < .92;
  });
  expect(middle.length).toBeGreaterThan(3);
  expect(Math.max(...middle.map(frame => Math.abs((item(frame, key).symbol.x - initial.x) / distance - item(frame, key).symbol.currentTime / duration)))).toBeGreaterThan(.1);
  expect(flight.final.animating).toBe('false');
  expect(final.running).toBe(false);
  expect(final.willChange).toBe('');
}

function expectStationaryBackground(flight) {
  expect(flight.initial.backgrounds.length).toBeGreaterThan(1);
  const violations = [];
  for (const [frameIndex, frame] of [flight.initial, ...flight.frames, flight.final].entries()) {
    if (!frame.covered) violations.push({ frame: frameIndex, problem: 'red background has an uncovered area' });
    if (frame.backgrounds.length !== flight.initial.backgrounds.length) violations.push({ frame: frameIndex, problem: 'background count changed' });
    for (const [index, layer] of frame.backgrounds.entries()) {
      const original = flight.initial.backgrounds[index];
      for (const key of ['x', 'y', 'width', 'height']) {
        if (Math.abs(layer[key] - original[key]) >= .75) violations.push({ frame: frameIndex, background: index, key, value: layer[key], original: original[key] });
      }
      if (JSON.stringify(layer.style) !== JSON.stringify(original.style)) violations.push({ frame: frameIndex, background: index, style: layer.style, original: original.style });
      if (layer.animations !== 0) violations.push({ frame: frameIndex, background: index, animations: layer.animations });
    }
    for (const entry of frame.items) {
      if (entry.copy.running || entry.copy.transform !== 'none' || entry.copy.willChange !== '') violations.push({ frame: frameIndex, label: entry.key, copy: entry.copy });
    }
  }
  // One assertion still checks every captured frame without producing tens of
  // thousands of individual trace events during a three-chapter round trip.
  expect(violations).toEqual([]);
}

function expectBrandBeforeHome(frame) {
  const home = item(frame, 'entry').button;
  const gap = home.x - frame.brand.right;
  expect(gap).toBeGreaterThanOrEqual(-.75);
  expect(gap).toBeLessThanOrEqual(48);
  expect(Math.abs(frame.brand.y + frame.brand.height / 2 - home.y - home.height / 2)).toBeLessThan(18);
  const bounds = frame.backgrounds[0];
  expect(frame.brand.x).toBeGreaterThanOrEqual(bounds.x - .75);
  expect(item(frame, 'settings').button.right).toBeLessThanOrEqual(bounds.right + .75);
}

test('经典滚动条下三章只有图标和品牌移动，完整红底板逐帧不变', async ({ page }) => {
  await open(page);
  const homepageWidth = await page.locator('.site-page').evaluate(element => element.getBoundingClientRect().width);
  expect(homepageWidth).toBeLessThan(1920);
  for (const route of ['state', 'model', 'action']) {
    const leaving = await sampleFlight(page, `.site-nav-item[data-route="${route}"]`);
    expectNaturalFlight(leaving);
    expectStationaryBackground(leaving);
    expect(leaving.final.pageWidth).toBeCloseTo(homepageWidth, 1);
    expect(leaving.frames.some(frame => frame.brand.running)).toBe(true);
    expect(leaving.final.brand.x - leaving.initial.brand.x).toBeGreaterThan(150);
    expectBrandBeforeHome(leaving.final);
    expect(item(leaving.final, 'model').copy.opacity).toBe(0);
    await expect(header(page)).toHaveAttribute('data-nav-layout', 'compact');
    const returning = await sampleFlight(page, '.site-brand-capsule');
    expectNaturalFlight(returning);
    expectStationaryBackground(returning);
    expect(returning.final.route).toBe('entry');
    expect(returning.final.brand.x).toBeCloseTo(leaving.initial.brand.x, 1);
  }
});

test('返回首页恢复原文字和布局，字体复测不触发文字压缩飞行或底板动画', async ({ page }) => {
  await open(page);
  const originalColumns = await header(page).evaluate(element => element.style.getPropertyValue('--navigation-columns'));
  const original = await page.locator('.site-nav-copy').evaluateAll(elements => elements.map(element => ({
    width: element.getBoundingClientRect().width, x: element.getBoundingClientRect().x, font: getComputedStyle(element).fontSize,
  })));
  await sampleFlight(page, '.site-nav-item[data-route="state"]');
  const returning = await sampleFlight(page, '.site-brand-capsule', null, true);
  expectNaturalFlight(returning);
  expectStationaryBackground(returning);
  expect(returning.frames.every(frame => frame.columns === originalColumns)).toBe(true);
  for (const [index, key] of ['entry', 'model', 'action', 'state', 'settings'].entries()) {
    const restored = item(returning.final, key).copy;
    expect(restored.opacity).toBe(1);
    expect(restored.width).toBeCloseTo(original[index].width, 0);
    expect(restored.x).toBeCloseTo(original[index].x, 0);
  }
  expect(await page.locator('.site-nav-copy').evaluateAll(elements => elements.map(element => getComputedStyle(element).fontSize))).toEqual(original.map(value => value.font));
});

test('快速中断从品牌可见位置返回，零首页偏移仍让章节品牌移到首页左邻', async ({ page }) => {
  await open(page);
  const flight = await sampleFlight(page, '.site-nav-item[data-route="state"]', { selector: '.site-brand-capsule', after: 370 });
  expect(flight.preInterrupt.brand.running).toBe(true);
  expect(Math.abs(flight.postInterrupt.brand.x - flight.preInterrupt.brand.x)).toBeLessThan(25);
  expect(Math.abs(item(flight.postInterrupt, 'model').symbol.x - item(flight.preInterrupt, 'model').symbol.x)).toBeLessThan(25);
  expectStationaryBackground(flight);
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
  expect(zero.final.brand.x - zero.initial.brand.x).toBeGreaterThan(150);
  expect(zero.frames.some(frame => frame.brand.running)).toBe(true);
  expectBrandBeforeHome(zero.final);
  expectStationaryBackground(zero);
  await sampleFlight(page, '.site-brand-capsule');
  await expect(brand(page)).toBeVisible();
});

test('直接打开章节仍为完整平直红栏，右侧品牌紧邻首页且短标在图标下方', async ({ page }) => {
  await open(page, {}, 'state');
  const geometry = await header(page).evaluate(element => {
    const rect = node => { const r = node.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
    const buttons = [...element.querySelectorAll('.site-nav-item')].map(button => {
      const icon = button.querySelector('.site-nav-icon');
      const label = button.querySelector('.site-nav-short-label');
      return { label: label.textContent, button: rect(button), icon: rect(icon), labelRect: rect(label),
        underlineBottom: rect(icon).bottom - parseFloat(getComputedStyle(icon, '::after').bottom),
        font: getComputedStyle(label).fontFamily, current: button.getAttribute('aria-current') };
    });
    return { header: rect(element), brand: rect(element.querySelector('.site-brand-capsule')), buttons };
  });
  expect(geometry.buttons.map(button => button.label)).toEqual(['首页', '结构', '动作', '神态', '设置']);
  expect(geometry.brand.right).toBeLessThanOrEqual(geometry.buttons[0].button.left + .75);
  expect(geometry.buttons[0].button.left - geometry.brand.right).toBeLessThanOrEqual(48);
  expect(geometry.brand.left).toBeGreaterThan(geometry.header.left + geometry.header.width * .4);
  for (const button of geometry.buttons) {
    expect(button.labelRect.top).toBeGreaterThanOrEqual(button.underlineBottom + 1);
    expect(button.labelRect.bottom).toBeLessThanOrEqual(geometry.header.bottom);
    expect(button.font).not.toMatch(/Nanfeng Navigation Brush/);
  }
  expect(geometry.buttons.find(button => button.label === '神态').current).toBe('page');
  const returning = await sampleFlight(page, '.site-brand-capsule');
  expectStationaryBackground(returning);
});

test('首页原版红底面积与样式跨章节不变，往返复用相同底板节点', async ({ page }) => {
  await open(page);
  await header(page).evaluate(element => { window.originalNavigationSurfaces = [...element.querySelectorAll('.navigation-surface')]; });
  const leaving = await sampleFlight(page, '.site-nav-item[data-route="state"]');
  expectStationaryBackground(leaving);
  const visibleLayers = leaving.initial.backgrounds.filter(layer => layer.style.opacity === '1' && layer.style.backgroundImage !== 'none');
  expect(visibleLayers.length).toBeGreaterThan(0);
  for (const layer of visibleLayers) {
    expect(layer.style.borderRadius).toBe('0px');
    expect(layer.style.clipPath).toBe('none');
    expect(layer.style.backgroundImage).toContain('rgba(104, 23, 15, 0.8)');
    expect(layer.style.backgroundImage).toContain('rgba(139, 32, 20, 0.8)');
  }
  const returning = await sampleFlight(page, '.site-brand-capsule');
  expectStationaryBackground(returning);
  expect(returning.final.backgrounds).toEqual(leaving.initial.backgrounds);
  expect(await header(page).evaluate(element => [...element.querySelectorAll('.navigation-surface')].every((node, index) => node === window.originalNavigationSurfaces[index]))).toBe(true);
});

test('窄顶栏与125%电脑缩放往返保持整条底板，图标组不越界', async ({ page }) => {
  await open(page, { headerWidth: 60 });
  await page.setViewportSize({ width: 1366, height: 1080 });
  for (const scale of [1, 1.25]) {
    await page.evaluate(value => { document.documentElement.style.zoom = String(value); }, scale);
    await doubleFrame(page);
    for (const selector of ['.site-nav-item[data-route="state"]', '.site-brand-capsule']) {
      const flight = await sampleFlight(page, selector);
      expectStationaryBackground(flight);
      const bounds = flight.final.backgrounds[0];
      for (const rect of [flight.final.brand, ...flight.final.items.map(entry => entry.button)]) {
        expect(rect.x).toBeGreaterThanOrEqual(bounds.x - .75);
        expect(rect.right).toBeLessThanOrEqual(bounds.right + .75);
        expect(rect.y).toBeGreaterThanOrEqual(bounds.y - .75);
        expect(rect.bottom).toBeLessThanOrEqual(bounds.bottom + .75);
      }
      if (flight.final.route !== 'entry') expectBrandBeforeHome(flight.final);
    }
  }
});

test('短顶栏飞行中resize清理旧位移，缩放后品牌仍在首页左邻且可继续往返', async ({ page }) => {
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
      return [...element.querySelectorAll('.site-brand-capsule, .site-nav-icon, .navigation-surface')].map(node => {
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
  expectBrandBeforeHome(returning.initial);
  expectNaturalFlight(returning);
  expectStationaryBackground(returning);
});

test('设置推开至实测900px余宽，章节品牌靠首页且底板在切换中保持原面积', async ({ page }) => {
  await open(page, { panelWidth: 760, pushPage: true });
  const gutter = await page.evaluate(() => innerWidth - document.documentElement.clientWidth);
  await page.setViewportSize({ width: 1660 + gutter, height: 1080 });
  await page.locator('.site-nav-item[data-action="settings"]').click();
  await expect(page.getByRole('region', { name: '开发者参数设置' })).toBeVisible();
  await expect.poll(() => page.locator('.site-page').evaluate(element => element.getBoundingClientRect().width)).toBeCloseTo(900, 0);
  await doubleFrame(page);
  const leaving = await sampleFlight(page, '.site-nav-item[data-route="state"]');
  expectStationaryBackground(leaving);
  expectBrandBeforeHome(leaving.final);
  const returning = await sampleFlight(page, '.site-brand-capsule');
  expectStationaryBackground(returning);
  expect(returning.final.route).toBe('entry');
  expect(returning.final.brand.x).toBeCloseTo(leaving.initial.brand.x, 1);
});

test('减少动态在飞行中清理品牌图案，键盘返回首页保留焦点和固定底板', async ({ page }) => {
  await open(page);
  const original = await page.locator('.navigation-surface').evaluateAll(elements => elements.map(element => ({
    x: element.getBoundingClientRect().x, width: element.getBoundingClientRect().width, background: getComputedStyle(element).backgroundImage,
  })));
  await page.evaluate(() => document.querySelector('.site-nav-item[data-route="state"]').click());
  await expect(header(page)).toHaveAttribute('data-nav-animating', 'true');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(header(page)).toHaveAttribute('data-nav-animating', 'false');
  const active = await page.locator('.site-nav-icon, .site-nav-copy, .site-brand-capsule, .navigation-surface').evaluateAll(elements => elements.map(element => ({
    running: element.getAnimations().some(animation => animation.playState === 'running'), willChange: element.style.willChange,
  })));
  expect(active.every(value => !value.running && value.willChange === '')).toBe(true);
  await brand(page).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'entry');
  await expect(header(page)).toHaveAttribute('data-nav-mode', 'expanded');
  await expect(brand(page)).toBeFocused();
  await expect(header(page)).toHaveAttribute('data-nav-animating', 'false');
  expect(await page.locator('.navigation-surface').evaluateAll(elements => elements.map(element => ({
    x: element.getBoundingClientRect().x, width: element.getBoundingClientRect().width, background: getComputedStyle(element).backgroundImage,
  })))).toEqual(original);
  const restored = await page.locator('.site-nav-copy').evaluateAll(elements => elements.map(element => ({ opacity: getComputedStyle(element).opacity, transform: getComputedStyle(element).transform })));
  expect(restored.every(value => value.opacity === '1' && value.transform === 'none')).toBe(true);
});
