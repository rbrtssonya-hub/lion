import { test, expect } from '@playwright/test';
import { expectExhibitFrame, returnToHomeHero, selectHomeExhibit } from './home-exhibit.helpers.js';
import { selectSettingsFor } from './settings-navigation.helpers.js';
import { buildSync } from 'esbuild';
import { fileURLToPath } from 'node:url';

let fixtureBundle;

const ids = ['homeLionBook', 'homeCulture', 'homeLionTypes', 'homeCultureSources'];
const pageIds = ['cover', 'origin', 'formation', 'martial', 'spread', 'modern', 'ending'];

async function openBook(page, reducedMotion = 'reduce') {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.emulateMedia({ reducedMotion });
  await page.addInitScript(() => {
    if (window !== window.top) return;
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    sessionStorage.setItem('nanfeng-lion:book-intro-seen:v1', '1');
  });
  await page.goto('/');
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 45000 });
  await selectHomeExhibit(page);
}

async function showRealArchive(page, id = 'homeLionBook') { await selectHomeExhibit(page, id); }

// Mount the actual components without editing the concurrently owned HomePage.
// Removing a navigation command, its keyboard containment or lifecycle cleanup
// must break these browser assertions; no component implementation is mocked.
async function openFixture(page, reducedMotion = 'reduce') {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const request = window.requestAnimationFrame.bind(window), cancel = window.cancelAnimationFrame.bind(window);
    const pending = new Set();
    window.navigationPendingFrames = pending;
    window.requestAnimationFrame = callback => {
      const owned = new Error().stack.includes('__home-navigation-fixture.js');
      const id = request(time => { pending.delete(id); callback(time); });
      if (owned) pending.add(id);
      return id;
    };
    window.cancelAnimationFrame = id => { pending.delete(id); cancel(id); };
  });
  await page.emulateMedia({ reducedMotion });
  // Bundle the real owned source in memory so these fixtures work on both
  // Vite dev and dist preview, without a test-only HomePage or emitted files.
  fixtureBundle ||= buildSync({
    stdin: { resolveDir: fileURLToPath(new URL('../../', import.meta.url)), loader: 'jsx', contents: `
      import React from 'react';
      import { createRoot } from 'react-dom/client';
      import BookTimeline from './src/features/home/BookTimeline.jsx';
      import HomeArchiveNav from './src/features/home/HomeArchiveNav.jsx';
      import useHomeExhibit from './src/features/home/useHomeExhibit.js';
      import './src/styles/home-exhibit.css';
      import './src/styles/lion-book.css';
      import './src/styles/home-navigation.css';
      const h = React.createElement;
      function Fixture() {
        const [index, setIndex] = React.useState(0);
        const [enabled, setEnabled] = React.useState(true);
        const [ink, setInk] = React.useState(true);
        const [home, setHome] = React.useState(true);
        const exhibit = useHomeExhibit(home && enabled);
        window.navigationFixture = { setEnabled, setInk, setHome, setIndex };
        return <div className="site-page" style={{'--site-header-height':'88px'}}>
          <header className="site-header" />
          {home && <div className="home-page" onKeyDown={()=>{window.bubbledHomeKeys=(window.bubbledHomeKeys||0)+1}}>
            <div className="entry-gate"><button id="enterWork" onClick={exhibit.enter}>探索更多</button></div>
            <div className="home-archive-scene home-exhibit" ref={exhibit.archiveRef}>
              {${JSON.stringify(ids)}.map((id, i) => <div className="home-archive-panel" hidden={exhibit.active!==i} key={id}>
                <section id={id} aria-labelledby={id+'-title'}><h2 id={id+'-title'}>{id}</h2>
                  {i===0 && <div className="lion-book-experience" onKeyDown={()=>{window.bubbledBookKeys=(window.bubbledBookKeys||0)+1}}>
                    <BookTimeline book={{ready:true,index}} index={index} inkEnabled={ink} playbackEnabled={enabled}
                      send={(action,value)=>{window.lastBookCommand={action,value};window.bookCommandCount=(window.bookCommandCount||0)+1;setIndex(value)}} />
                  </div>}
                </section>
              </div>)}
            </div>
            <HomeArchiveNav playbackEnabled={enabled} particlesEnabled={ink} current={exhibit.active} visible={exhibit.visible}
              onSelect={exhibit.select} onReturnHome={exhibit.returnHome} />
          </div>}
        </div>;
      }
      createRoot(document.getElementById('root')).render(h(React.StrictMode,null,h(Fixture)));
` },
    bundle: true, write: false, format: 'esm', jsx: 'automatic',
    define: { 'import.meta.env.BASE_URL': '"/"' }, outfile: 'home-navigation-fixture.js',
  });
  await page.route('**/__home-navigation-fixture.*', route => {
    const css = route.request().url().endsWith('.css');
    const output = fixtureBundle.outputFiles.find(file => file.path.endsWith(css ? '.css' : '.js'));
    return route.fulfill({ contentType: css ? 'text/css' : 'text/javascript', body: output.text });
  });
  await page.route('**/__home-navigation-refresh', route => route.fulfill({ contentType: 'text/html', body: `
    <html><head><style>
      *{box-sizing:border-box}body{margin:0;background:#f4ead8}
      .site-header{position:fixed;inset:0 0 auto;height:88px;z-index:50;background:#eee}
      .site-page{container:lion-page / inline-size;width:100%}
      .entry-gate{height:1100px}.home-archive-scene{position:relative;padding-inline:208px;container-type:inline-size}
      #enterWork{position:relative;top:150px}
      @container lion-page (max-width:1250px){.home-archive-scene{padding-inline:132px}}
      section{height:100%;min-height:0;padding:30px}h2{margin:0 0 24px}
    </style><link rel="stylesheet" href="/__home-navigation-fixture.css"></head>
    <body><div id="root"></div><script type="module" src="/__home-navigation-fixture.js"></script></body></html>` }));
  await page.goto('/__home-navigation-refresh');
  await expect(page.locator('#homeCultureSources')).toHaveCount(1);
  expect(errors).toEqual([]);
}

async function alignSection(page, id) { await selectHomeExhibit(page, id); }

test('seven era selections command the real book and preserve its controlled current state', async ({ page }) => {
  await openBook(page);
  const nav = page.getByRole('navigation', { name: '醒狮历史时间线' });
  await expect(nav.locator('button[data-book-page]')).toHaveCount(7);
  await expect(nav.locator('button')).toHaveText(['序卷', '起源', '形成', '兴盛', '传播', '传承', '终章'], { timeout: 1500 });
  await expect(nav.locator('.lion-book-guide-character')).toHaveCount(1, { timeout: 1500 });
  await expect(page.locator('.lion-book-experience')).toHaveAttribute('data-book-ready', 'true');
  for (const [index, id] of pageIds.entries()) {
    await nav.locator(`[data-book-page="${id}"]`).click();
    await expect(nav.locator(`[data-book-page="${id}"]`)).toHaveAttribute('aria-current', 'step');
    await expect(page.locator('.lion-book-experience')).toHaveAttribute('data-book-index', String(index));
  }
  expect(new URL(page.url()).hash).toBe('');
  await expect(nav.getByRole('progressbar')).toHaveCount(0);
  await nav.screenshot({ path: test.info().outputPath('book-navigation.png') });
});

test('book keys stay inside navigation and controlled updates never send extra commands', async ({ page }) => {
  await openFixture(page);
  await alignSection(page, ids[0]);
  const nav = page.getByRole('navigation', { name: '醒狮历史时间线' });
  const first = nav.locator('button').first();
  await first.focus();
  await first.press('End');
  await expect(nav.locator('button').last()).toBeFocused();
  expect(await page.evaluate(() => window.bookCommandCount)).toBe(1);
  await nav.locator('button').last().press('Enter');
  expect(await page.evaluate(() => window.bookCommandCount)).toBe(2);
  expect(await page.evaluate(() => window.lastBookCommand)).toEqual({ action: 'goTo', value: 6 });
  expect(await page.evaluate(() => window.bubbledBookKeys || 0)).toBe(0);
  await page.evaluate(() => { window.lastBookCommand = null; window.navigationFixture.setIndex(2); });
  await expect(nav.locator('[data-book-page="formation"]')).toHaveAttribute('aria-current', 'step');
  expect(await page.evaluate(() => window.lastBookCommand)).toBeNull();
});

test('four controlled sidebar selections align panels, hero and other routes hide the rail', async ({ page }) => {
  await openFixture(page);
  const nav = page.getByRole('navigation', { name: '首页章节导航', includeHidden: true });
  await expect(nav).toBeHidden();
  await alignSection(page, ids[0]);
  await expect(nav).toBeVisible();
  await expect(nav.locator('[data-home-section]')).toHaveCount(4);
  await expect(nav.locator('[data-home-section]')).toHaveText(['岭南醒狮志', '醒狮文化', '醒狮种类', '参考资料']);
  for (const id of ids) {
    const button = nav.locator(`[data-home-section="${id}"]`);
    await button.click();
    await expect(button).toHaveAttribute('aria-current', 'location');
    const top = await page.locator(`#${id} h2`).evaluate(el => el.getBoundingClientRect().top);
    expect(top).toBeGreaterThanOrEqual(88);
    expect(top).toBeLessThan(150);
  }
  await alignSection(page, ids[1]);
  await expect(nav.locator(`[data-home-section="${ids[1]}"]`)).toHaveAttribute('aria-current', 'location');
  await expect(nav.locator('[aria-current]')).toHaveCount(1);
  await nav.locator('[data-home-section]').first().focus();
  await page.keyboard.press('End');
  await expect(nav.locator('[data-home-section]').last()).toBeFocused();
  await page.keyboard.press('Space');
  await expect(nav.locator('[data-home-section]').last()).toHaveAttribute('aria-current', 'location');
  expect(await page.evaluate(() => window.bubbledHomeKeys || 0)).toBe(0);
  expect(new URL(page.url()).hash).toBe('');
  await returnToHomeHero(page);
  await expect(nav).toBeHidden();
  await page.evaluate(() => window.navigationFixture.setHome(false));
  await expect(nav).toHaveCount(0);
  expect(await page.evaluate(() => window.navigationPendingFrames.size)).toBe(0);
});

test('rapid marker retargeting is vertical from its current position; controls suspend animation', async ({ page }) => {
  await openFixture(page, 'no-preference');
  await alignSection(page, ids[0]);
  const nav = page.locator('.home-archive-nav');
  const marker = nav.locator('.home-archive-nav-lion');
  await expect(nav).toBeVisible();
  const start = await marker.boundingBox();
  await alignSection(page, ids.at(-1));
  await expect.poll(async () => (await marker.boundingBox()).y).toBeGreaterThan(start.y + 20);
  await expect.poll(() => nav.locator('canvas').evaluate(canvas => {
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    return pixels.some((alpha, index) => index % 4 === 3 && alpha > 0 && pixels[index - 3] > pixels[index - 2] * 2);
  })).toBe(true);
  const before = await marker.boundingBox();
  await alignSection(page, ids[1]);
  const after = await marker.boundingBox();
  expect(Math.abs(after.y - before.y)).toBeLessThan(55);
  expect(Math.abs(after.x - start.x)).toBeLessThan(1);
  await expect.poll(async () => {
    const target = await nav.locator(`[data-home-section="${ids[1]}"]`).boundingBox();
    const lion = await marker.boundingBox();
    return Math.abs(lion.y + lion.height / 2 - target.y - target.height / 2);
  }).toBeLessThan(2);
  expect((await marker.boundingBox()).width).toBe(48);
  await page.evaluate(() => window.navigationFixture.setInk(false));
  await expect(nav).toHaveAttribute('data-particles-playing', 'false');
  await page.evaluate(() => window.navigationFixture.setEnabled(false));
  await expect(nav).toHaveAttribute('data-playing', 'false');
  await expect(nav).toHaveAttribute('data-observing', 'false');
  expect(await page.evaluate(() => window.navigationPendingFrames.size)).toBe(0);
  await page.evaluate(() => window.navigationFixture.setEnabled(true));
  await expect(nav).toHaveAttribute('data-observing', 'true');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(nav).toHaveAttribute('data-playing', 'false');
  await expect(nav).toHaveAttribute('data-observing', 'false');
  expect(await page.evaluate(() => window.navigationPendingFrames.size)).toBe(0);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await expect(nav).toHaveAttribute('data-observing', 'false');
  await expect(nav).toHaveAttribute('data-playing', 'false');
  expect(await page.evaluate(() => window.navigationPendingFrames.size)).toBe(0);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(nav).toHaveAttribute('data-observing', 'false');
  await expect(nav).toHaveAttribute('data-playing', 'false');
  await alignSection(page, ids[2]);
  await expect(nav.locator(`[data-home-section="${ids[2]}"]`)).toHaveAttribute('aria-current', 'location');
});

test('sprite uses the supplied idle/move atlases and poster, stopping when offscreen, disabled or reduced', async ({ page }) => {
  await openFixture(page, 'no-preference');
  await alignSection(page, ids[0]);
  const sprite = page.locator('.lion-book-guide-character');
  await expect(sprite).toHaveAttribute('data-ready', 'true');
  await expect(sprite).toHaveAttribute('data-playing', 'true');
  await expect(sprite).toHaveAttribute('data-animation', 'idle');
  const firstFrame = await sprite.locator('canvas').evaluate(canvas => canvas.toDataURL());
  await expect.poll(() => sprite.locator('canvas').evaluate(canvas => canvas.toDataURL())).not.toBe(firstFrame);
  await page.locator('[data-book-page="ending"]').click();
  await expect(sprite).toHaveAttribute('data-animation', 'mov');
  await expect(sprite).toHaveAttribute('data-animation', 'idle');
  await page.evaluate(() => window.navigationFixture.setEnabled(false));
  await expect(sprite).toHaveAttribute('data-playing', 'false');
  await page.evaluate(() => window.navigationFixture.setEnabled(true));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(sprite).toHaveAttribute('data-animation', 'poster');
  await expect(sprite).toHaveAttribute('data-playing', 'false');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await alignSection(page, ids[3]);
  await expect(sprite).toHaveAttribute('data-playing', 'false');
});

test('a settings push to 900px remaining switches the rail without a window resize', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openFixture(page);
  await alignSection(page, ids[0]);
  const nav = page.locator('.home-archive-nav');
  await expect.poll(async () => (await nav.boundingBox()).width).toBe(184);
  await page.locator('.site-page').evaluate(element => { element.style.width = '900px'; });
  await expect.poll(async () => (await nav.boundingBox()).width).toBe(116);
  const rail = await nav.boundingBox(), content = await page.locator('#homeLionBook .lion-book-experience').boundingBox();
  expect(rail.x + rail.width).toBeLessThanOrEqual(content.x);
  const offset = await nav.evaluate(element => {
    const marker = element.querySelector('.home-archive-nav-lion').getBoundingClientRect();
    const stop = element.querySelector('[aria-current] [data-navigation-stop]').getBoundingClientRect();
    return Math.hypot(marker.x + marker.width / 2 - stop.x - stop.width / 2, marker.y + marker.height / 2 - stop.y - stop.height / 2);
  });
  expect(offset).toBeLessThan(1);
  await nav.locator('[data-home-section="homeLionTypes"]').click();
  await expect(nav.locator('[data-home-section="homeLionTypes"]')).toHaveAttribute('aria-current', 'location');
});

test('container resize repositions the visible sidebar without a window resize', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openFixture(page, 'no-preference');
  await alignSection(page, ids[0]);
  const nav = page.locator('.home-archive-nav');
  await expect(nav).toBeVisible();
  await page.evaluate(() => { window.navigationResizeEvents = 0; window.addEventListener('resize', () => window.navigationResizeEvents++); });
  await page.locator('.site-page').evaluate(element => { element.style.width = '900px'; element.style.marginLeft = '40px'; });
  await expect.poll(async () => (await nav.boundingBox()).x, { timeout: 2000 }).toBe(52);
  expect(await page.evaluate(() => window.navigationResizeEvents)).toBe(0);
});

test('sidebar selection commits only the requested panel without an intermediate selection', async ({ page }) => {
  await openFixture(page, 'no-preference');
  await alignSection(page, ids[0]);
  const nav = page.locator('.home-archive-nav');
  await expect(nav).toBeVisible();
  await nav.evaluate(element => {
    window.navigationSelections = [];
    window.navigationSelectionObserver = new MutationObserver(() => {
      const id = element.querySelector('[aria-current]')?.dataset.homeSection;
      if (id) window.navigationSelections.push(id);
    });
    window.navigationSelectionObserver.observe(element, { subtree: true, attributes: true, attributeFilter: ['aria-current'] });
  });
  await nav.locator('[data-home-section="homeCultureSources"]').click();
  await expectExhibitFrame(page, 'homeCultureSources');
  const selections = await page.evaluate(() => { window.navigationSelectionObserver.disconnect(); return window.navigationSelections; });
  expect(selections.length).toBeGreaterThan(0);
  expect([...new Set(selections)]).toEqual(['homeCultureSources']);
});

test('PageUp from a focused sidebar returns to the hero without changing the route', async ({ page }) => {
  await openFixture(page, 'no-preference');
  await alignSection(page, ids[1]);
  const nav = page.locator('.home-archive-nav');
  await expect(nav).toBeVisible();
  await nav.locator('[data-home-section="homeCultureSources"]').click();
  await page.keyboard.press('PageUp');
  await expect(nav).toBeHidden();
  await expect(page.locator('#enterWork')).toBeInViewport();
});

test('mounted HomePage sidebar jumps to four real panels and preserves hero and chapter returns', async ({ page }) => {
  await openBook(page);
  const nav = page.getByRole('navigation', { name: '首页章节导航', includeHidden: true });
  await expect(nav).toHaveCount(1);
  await expect(page.locator('#homeInheritors')).toHaveCount(0);
  await returnToHomeHero(page);
  await expect(nav).toBeHidden();
  await showRealArchive(page);
  await expect(nav.locator('[data-home-section]')).toHaveCount(4);
  await expect(nav.locator('[data-home-section]')).toHaveText(['岭南醒狮志', '醒狮文化', '醒狮种类', '参考资料']);
  for (const id of ids) {
    await nav.locator(`[data-home-section="${id}"]`).click();
    await expect(nav.locator(`[data-home-section="${id}"]`)).toHaveAttribute('aria-current', 'location');
    await expectExhibitFrame(page, id);
  }
  await showRealArchive(page, 'homeLionTypes');
  await expect(nav.locator('[data-home-section="homeLionTypes"]')).toHaveAttribute('aria-current', 'location');
  const originalHash = new URL(page.url()).hash;
  await nav.locator('[data-home-section]').first().focus();
  await page.keyboard.press('End');
  await expect(nav.locator('[data-home-section]').last()).toBeFocused();
  expect(new URL(page.url()).hash).toBe(originalHash);
  await page.locator('.site-header [data-route="state"]').click();
  await expect(nav).toBeHidden();
  await expect(nav).toHaveAttribute('data-observing', 'false');
  await expect(nav).toHaveAttribute('data-layout-observing', 'false');
  await page.locator('.site-header [data-route="entry"]').click();
  await showRealArchive(page);
  await expect(nav).toBeVisible();
});

test('mounted HomePage sidebar handles settings push and the one-screen sources frame', async ({ page }) => {
  await openBook(page, 'no-preference');
  await page.setViewportSize({ width: 1600, height: 900 });
  await showRealArchive(page);
  const nav = page.locator('.home-archive-nav');
  await expect(nav).toHaveAttribute('data-layout-observing', 'true');
  await page.locator('.site-header [data-action="settings"]').click();
  await selectSettingsFor(page, 'panelWidth');
  const available = await page.locator('.site-shell').evaluate(element => element.getBoundingClientRect().width);
  const width = page.getByRole('spinbutton', { name: '设置面板宽度数值', exact: true });
  await width.fill(String(available - 900)); await width.press('Tab');
  await expect.poll(() => page.locator('.site-page').evaluate(element => Math.abs(element.getBoundingClientRect().width - 900))).toBeLessThan(2);
  await expect.poll(async () => (await nav.boundingBox()).width).toBe(116);
  const box = await nav.boundingBox();
  const pageBox = await page.locator('.site-page').boundingBox();
  expect(Math.abs(box.x - pageBox.x - 12)).toBeLessThan(1);
  await page.getByRole('button', { name: '保存设置', exact: true }).click();
  await expect.poll(() => page.locator('.site-page').evaluate((element, available) => Math.abs(element.getBoundingClientRect().width - available), available)).toBeLessThan(2);
  await nav.locator('[data-home-section="homeCultureSources"]').click();
  await expectExhibitFrame(page, 'homeCultureSources');
  await expect(nav.locator('[data-home-section="homeCultureSources"]')).toHaveAttribute('aria-current', 'location');
});

test('mounted HomePage sidebar keeps the selected panel and releases observers when reduced or backgrounded', async ({ page }) => {
  await openBook(page, 'no-preference');
  await showRealArchive(page);
  const nav = page.locator('.home-archive-nav');
  await expect(nav).toHaveAttribute('data-layout-observing', 'true');
  await nav.evaluate(element => {
    window.realNavigationSelections = [];
    window.realNavigationObserver = new MutationObserver(() => {
      const id = element.querySelector('[aria-current]')?.dataset.homeSection;
      if (id) window.realNavigationSelections.push(id);
    });
    window.realNavigationObserver.observe(element, { subtree: true, attributes: true, attributeFilter: ['aria-current'] });
  });
  await nav.locator('[data-home-section="homeLionTypes"]').click();
  await expectExhibitFrame(page, 'homeLionTypes');
  expect(await page.evaluate(() => { window.realNavigationObserver.disconnect(); return [...new Set(window.realNavigationSelections)]; })).toEqual(['homeLionTypes']);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(nav).toHaveAttribute('data-observing', 'false');
  // Layout measurement remains active so a resized header cannot cover the
  // static reduced-motion rail. Animation observers/RAF still stop.
  await expect(nav).toHaveAttribute('data-layout-observing', 'true');
  await expect(nav).toHaveAttribute('data-playing', 'false');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await expect(nav).toHaveAttribute('data-observing', 'false');
  await expect(nav).toHaveAttribute('data-layout-observing', 'false');
  await expect(nav).toHaveAttribute('data-playing', 'false');
  await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
  await expect(nav).toHaveAttribute('data-layout-observing', 'true');
});

test('mounted HomePage reserves the rail and fits seven real book targets at desktop widths', async ({ page }) => {
  await openBook(page);
  for (const width of [1920, 2560, 1366, 1024, 900]) {
    await page.setViewportSize({ width, height: 900 });
    await showRealArchive(page);
    const rail = await page.locator('.home-archive-nav').boundingBox();
    const inner = await page.locator('#homeLionBook .lion-book-inner').boundingBox();
    expect(inner.x, `reserved archive content at ${width}px`).toBeGreaterThanOrEqual(rail.x + rail.width + 8);
    const targets = await page.locator('.lion-book-timeline button').evaluateAll(buttons => buttons.map(button => {
      const box = button.getBoundingClientRect();
      return { left: box.left, right: box.right, width: box.width };
    }));
    expect(targets).toHaveLength(7);
    for (const [index, target] of targets.entries()) {
      expect(target.width).toBeGreaterThanOrEqual(44);
      expect(target.left).toBeGreaterThanOrEqual(rail.x + rail.width);
      expect(target.right).toBeLessThanOrEqual(width);
      if (index) expect(target.left).toBeGreaterThanOrEqual(targets[index - 1].right - 1);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

for (const width of [1920, 2560, 1366, 1024, 900]) {
  test(`sidebar rail and seven era targets fit ${width}px desktop content`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openFixture(page);
    await alignSection(page, ids[0]);
    const nav = page.locator('.home-archive-nav');
    await expect(nav).toBeVisible();
    const rail = await nav.boundingBox();
    const section = await page.locator('#homeLionBook .lion-book-experience').boundingBox();
    expect(rail.x + rail.width).toBeLessThanOrEqual(section.x);
    const bounds = await page.locator('.lion-book-timeline button').evaluateAll(buttons => buttons.map(button => {
      const b = button.getBoundingClientRect();
      return { left: b.left, right: b.right, width: b.width };
    }));
    expect(bounds).toHaveLength(7);
    for (let i = 0; i < bounds.length; i++) {
      expect(bounds[i].width).toBeGreaterThanOrEqual(44);
      expect(bounds[i].left).toBeGreaterThanOrEqual(section.x);
      expect(bounds[i].right).toBeLessThanOrEqual(width);
      if (i) expect(bounds[i].left).toBeGreaterThanOrEqual(bounds[i - 1].right - 1);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 1920 || width === 900) await page.screenshot({ path: test.info().outputPath(`archive-rail-${width}.png`) });
  });
}
