import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

// Black-box checks work against either Vite dev or the built static site.
const url = process.env.ATLAS_URL || 'http://127.0.0.1:5175';
const ids = ['brows', 'crown', 'beard', 'body', 'trim', 'mouth'];
const output = process.env.ATLAS_EVIDENCE || 'artifacts/enrichment';
await mkdir(`${output}/screenshots`, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', headless: true, args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1536, height: 960 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
const errors = [], failedResponses = [], chapters = [], layouts = [];
const result = { url, scope: 'six navigation artworks and all six enriched culture/data panels', errors, failedResponses, chapters, layouts };
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
page.on('response', response => { if (response.status() >= 400) failedResponses.push({ url: response.url(), status: response.status() }); });

async function study(id) {
  await page.locator(`.chapter-control[data-part="${id}"]`).click();
  await page.waitForFunction(id => {
    const main = document.querySelector('.lion-experience');
    return main?.dataset.phase === 'study' && main?.dataset.selected === id;
  }, id, { timeout: 45000 });
  await page.waitForFunction(() => {
    const panel = document.querySelector('.cultural-panel');
    return panel && getComputedStyle(panel).visibility === 'visible' && Number(getComputedStyle(panel).opacity) > .99;
  });
  await page.waitForTimeout(2300); // Finish GSAP child type/image reveals before visual evidence.
}

async function decoded(selector) {
  const image = page.locator(selector);
  await image.evaluate(async element => { await element.decode(); });
  return image.evaluate(element => ({
    src: new URL(element.currentSrc).pathname,
    width: element.naturalWidth, height: element.naturalHeight,
    fit: getComputedStyle(element).objectFit,
    displayWidth: element.getBoundingClientRect().width,
    displayHeight: element.getBoundingClientRect().height,
  }));
}

async function detailInReader() {
  await page.waitForFunction(() => {
    const detail = document.querySelector('.culture-detail')?.getBoundingClientRect();
    const reader = document.querySelector('.chapter-reader')?.getBoundingClientRect();
    return detail && reader && detail.top >= reader.top - 1 && detail.bottom <= reader.bottom + 1;
  }, null, { timeout: 5000 });
}

async function desktopLayout(width, height) {
  await page.setViewportSize({ width, height });
  await page.waitForTimeout(400);
  const state = await page.evaluate(() => {
    const rect = element => {
      const r = element.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
    };
    return {
      viewport: { width: innerWidth, height: innerHeight },
      page: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
      frame: rect(document.querySelector('.visual-frame')),
      column: rect(document.querySelector('.cultural-column')),
      nav: rect(document.querySelector('.chapter-controls')),
      reader: rect(document.querySelector('.chapter-reader')),
      tabs: rect(document.querySelector('.reader-tabs')),
    };
  });
  assert.ok(state.page.width <= width + 1, 'desktop has no horizontal page overflow');
  assert.ok(state.page.height <= height + 1, 'desktop has no vertical page overflow');
  for (const [name, box] of Object.entries(state).filter(([name]) => ['column', 'nav', 'reader', 'tabs'].includes(name))) {
    assert.ok(box.x >= -1 && box.y >= -1 && box.right <= width + 1 && box.bottom <= height + 1, `${name} stays inside desktop`);
    assert.ok(box.width > 0 && box.height > 0, `${name} has visible area`);
  }
  assert.ok(state.reader.bottom <= state.nav.y + 1, 'scrollable reading area stays above navigation');
  assert.ok(state.frame.right <= state.column.x + 1, 'hero image and culture column do not overlap');
  layouts.push(state);
  await page.screenshot({ path: `${output}/screenshots/desktop-${width}.png` });
}

try {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('.lion-experience')?.dataset.ready === 'true', null, { timeout: 180000 });
  assert.equal(await page.locator('.corner-sign').count(), 0, 'top-left logo removed');
  assert.equal(await page.locator('.cultural-panel').count(), 0, 'homepage has no cultural information');
  assert.equal(await page.locator('.chapter-control').count(), 6);
  assert.equal(await page.locator('.chapter-control img').count(), 6, 'all six navigation controls use raster images');
  assert.equal(await page.locator('.chapter-control svg').count(), 0, 'navigation controls contain no code-drawn SVG glyphs');
  const navigation = [];
  for (const id of ids) {
    const art = await decoded(`.chapter-control[data-part="${id}"] img`);
    assert.equal(art.src, `/images/navigation/${id}.png`);
    assert.ok(art.width >= 512 && art.height >= 512, `${id} uses a real generated-resolution asset`);
    assert.equal(art.width, art.height, 'square artwork canvas');
    assert.equal(art.fit, 'contain', 'navigation artwork is not cropped');
    navigation.push({ id, ...art });
  }
  result.navigation = navigation;
  await page.screenshot({ path: `${output}/screenshots/home-art-navigation.png` });

  for (const id of ids) {
    await study(id);
    assert.equal(await page.locator('.corner-sign').count(), 0);
    const hero = await decoded('.chapter-artwork');
    assert.equal(hero.src, `/images/chapters/${id}.png`, 'original matching handoff artwork retained');
    assert.equal(hero.fit, 'contain');
    assert.equal(await page.locator('.model-layer').evaluate(el => getComputedStyle(el).visibility), 'hidden', 'real model hidden after handoff');
    assert.equal(await page.locator('.model-layer').evaluate(el => getComputedStyle(el).opacity), '0');
    const cultureTab = page.getByRole('tab', { name: '文化图解', exact: false });
    const dataTab = page.getByRole('tab', { name: '形态数据', exact: false });
    assert.equal(await cultureTab.getAttribute('aria-selected'), 'true', 'new chapter starts on culture tab');
    assert.equal(await page.locator('.chapter-reader').evaluate(el => el.scrollTop), 0, 'new chapter resets its scroll position');
    assert.equal(await page.locator('.culture-zone').first().getAttribute('aria-pressed'), 'true', 'new chapter resets selected illustration detail');
    const art = await decoded('.culture-art');
    assert.equal(art.src, `/images/culture/${id}.png`);
    assert.equal(art.width, 1536); assert.equal(art.height, 1024);
    assert.equal(art.fit, 'contain', 'complete culture plate is displayed');
    assert.ok(Math.abs(art.displayWidth / art.displayHeight - 1.5) < .015, 'rendered culture plate preserves 3:2 ratio');
    const zones = await page.locator('.culture-zone').count();
    assert.equal(zones, id === 'crown' ? 4 : 3, 'illustration exposes the corresponding number of studies');
    assert.equal(await page.locator('.culture-step-controls button').count(), zones);
    await page.screenshot({ path: `${output}/screenshots/${id}-culture.png` });

    const details = [];
    for (let index = 0; index < zones; index++) {
      await page.locator('.culture-zone').nth(index).click();
      await page.waitForTimeout(50);
      assert.equal(await page.locator('.culture-zone').nth(index).getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('.culture-step-controls button').nth(index).getAttribute('aria-pressed'), 'true');
      await detailInReader(); // Clicking the study must bring its explanation into the reader.
      const text = await page.locator('.culture-detail').innerText();
      assert.ok(text.length > 25, 'detail contains an explanatory paragraph');
      details.push(text);
    }
    assert.equal(new Set(details).size, zones, 'each illustration zone reveals a different explanation');
    await page.locator('.culture-step-controls button').first().click();
    assert.equal(await page.locator('.culture-zone').first().getAttribute('aria-pressed'), 'true', 'under-image labels operate the same detail state');
    assert.equal(await page.locator('.culture-detail').innerText(), details[0]);
    await detailInReader();
    if (id === 'brows') await page.screenshot({ path: `${output}/screenshots/brows-detail-in-view.png` });

    const reader = page.locator('.chapter-reader');
    const beforeScroll = await reader.evaluate(el => ({ top: el.scrollTop, height: el.clientHeight, total: el.scrollHeight, overflow: getComputedStyle(el).overflowY }));
    assert.ok(beforeScroll.total > beforeScroll.height, 'rich culture content extends within its own reader');
    assert.ok(['auto', 'scroll'].includes(beforeScroll.overflow));
    await reader.evaluate(el => { el.scrollTop = el.scrollHeight; });
    const afterScroll = await reader.evaluate(el => el.scrollTop);
    assert.ok(afterScroll > 0, 'reader can scroll to cultural context and sources');
    const sources = await page.locator('.culture-page .chapter-source').evaluateAll(elements => elements.map(el => {
      const r = el.getBoundingClientRect(), reader = el.closest('.chapter-reader').getBoundingClientRect();
      return { text: el.textContent.trim(), href: el.href, target: el.target, reachable: r.top >= reader.top - 1 && r.bottom <= reader.bottom + 1 };
    }));
    assert.ok(sources.length >= 1);
    sources.forEach(source => { assert.match(source.href, /^https:\/\//); assert.equal(source.target, '_blank'); assert.ok(source.reachable, 'source links are reachable at end of reader'); });
    assert.ok((await page.locator('.culture-context').innerText()).length > 60, 'cultural context adds substantive text');
    if (id === 'brows' || id === 'mouth') await page.screenshot({ path: `${output}/screenshots/${id}-culture-reading.png` });

    await cultureTab.focus();
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(1150);
    assert.equal(await dataTab.getAttribute('aria-selected'), 'true');
    assert.equal(await dataTab.getAttribute('tabindex'), '0', 'active tab is the roving keyboard stop');
    assert.equal(await cultureTab.getAttribute('tabindex'), '-1');
    assert.equal(await dataTab.evaluate(el => el === document.activeElement), true, 'ArrowRight focuses the new tab');
    assert.equal(await page.locator('.lion-experience').getAttribute('data-selected'), id, 'tab ArrowRight does not trigger global next-chapter navigation');
    assert.equal(await page.locator('.lion-experience').getAttribute('data-phase'), 'study');
    assert.equal(await reader.evaluate(el => el.scrollTop), 0, 'tab change resets reader for new content');
    assert.equal(await page.locator('.culture-page').isVisible(), false);
    assert.equal(await page.locator('.data-page').isVisible(), true);
    const chart = page.locator('.data-page .shape-trace');
    assert.ok(await chart.isVisible(), 'actual geometric data chart is visible');
    const paths = await chart.locator('.trace-path').evaluateAll(elements => elements.map(el => ({ d: el.getAttribute('d'), length: el.getTotalLength() })));
    assert.ok(paths.length > 0 && paths.every(path => path.length > 0 && !/NaN|undefined/.test(path.d)), 'data chart contains valid nonempty measured geometry');
    assert.equal(await page.locator('.dimension-row').count(), 3);
    const dimensions = await page.locator('.dimension-row').evaluateAll(elements => elements.map(el => ({ value: Number(el.querySelector('code').textContent), bar: parseFloat(el.querySelector('b').style.width) })));
    assert.ok(dimensions.every(row => row.value > 0 && row.bar > 0 && row.bar <= 100), 'all three measured dimensions have positive numbers and proportional bars');
    assert.ok(Number(await page.locator('.chapter-data b').first().innerText()) > 0, 'real source component count displayed');
    if (id === 'body') {
      const palette = await page.locator('.palette-band span').evaluateAll(elements => elements.map(el => ({ color: getComputedStyle(el).backgroundColor, flex: Number(el.style.flexGrow), width: el.getBoundingClientRect().width })));
      assert.ok(palette.length > 1 && palette.every(p => p.width > 0 && p.flex > 0), 'body displays real sampled multicolour texture proportions');
      result.bodyPalette = palette;
    }
    if (id === 'body' || id === 'crown' || id === 'beard') await page.screenshot({ path: `${output}/screenshots/${id}-data.png` });
    await dataTab.focus();
    await page.keyboard.press('Home');
    assert.equal(await cultureTab.getAttribute('aria-selected'), 'true', 'Home selects the first local tab');
    await page.keyboard.press('End');
    assert.equal(await dataTab.getAttribute('aria-selected'), 'true', 'End selects the last local tab');
    assert.equal(await page.locator('.lion-experience').getAttribute('data-selected'), id);
    await reader.evaluate(el => { el.scrollTop = el.scrollHeight; });
    chapters.push({ id, hero, art, zones, details, sources, reader: { beforeScroll, afterScroll }, chart: { paths, dimensions } });
  }

  await study('body');
  await desktopLayout(1280, 800);
  await desktopLayout(1920, 1080);
  await page.getByRole('button', { name: '返回整体', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.lion-experience').dataset.phase === 'overview');
  assert.equal(await page.locator('.cultural-panel').count(), 0, 'return removes cultural panel');
  assert.equal(await page.locator('.chapter-artwork').count(), 0);
  assert.equal(await page.locator('.model-layer').evaluate(el => getComputedStyle(el).visibility), 'visible');
  assert.deepEqual(errors, []);
  assert.deepEqual(failedResponses, []);

  const hashes = await page.evaluate(async () => {
    const digest = async path => {
      const response = await fetch(path); if (!response.ok) throw new Error(`Missing ${path}`);
      return [...new Uint8Array(await crypto.subtle.digest('SHA-256', await response.arrayBuffer()))].map(x => x.toString(16).padStart(2, '0')).join('');
    };
    return Promise.all(['navigation', 'culture'].flatMap(group => ['brows', 'crown', 'beard', 'body', 'trim', 'mouth'].map(async id => ({ group, id, sha256: await digest(`/images/${group}/${id}.png`) }))));
  });
  assert.equal(new Set(hashes.map(asset => asset.sha256)).size, 12, 'all twelve new images are distinct content, not aliases');
  result.assets = hashes;
  result.passed = true;
  await writeFile(`${output}/browser-results.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ passed: true, url, chapters: chapters.length, navigation: navigation.length, distinctAssets: hashes.length, layouts: layouts.map(item => item.viewport), errors, failedResponses, evidence: output }, null, 2));
} catch (error) {
  result.passed = false; result.failure = error.stack;
  await page.screenshot({ path: `${output}/screenshots/failure.png` }).catch(() => {});
  await writeFile(`${output}/browser-results.json`, JSON.stringify(result, null, 2));
  throw error;
} finally { await browser.close(); }
