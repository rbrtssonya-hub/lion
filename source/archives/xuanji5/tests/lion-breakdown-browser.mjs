import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const baseURL = process.env.ATLAS_URL || 'http://127.0.0.1:5173';
const output = process.env.ATLAS_BREAKDOWN_EVIDENCE || 'artifacts/lion-info/validation';
const ids = ['brows', 'crown', 'beard', 'body', 'trim', 'mouth'];
const assetNames = ['01-mei-mu', '02-e-guan', '03-fan-xu', '04-zhi-jin', '05-yun-bian', '06-kou-chi'];
const browser = await chromium.launch({ channel: 'chromium', headless: true, args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1536, height: 960 }, deviceScaleFactor: 1 });
const pageErrors = [];
const failedRequests = [];
page.on('pageerror', error => pageErrors.push(error.message));
page.on('requestfailed', request => failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
await mkdir(`${output}/screenshots`, { recursive: true });

const result = { baseURL, chapters: [], pageErrors, failedRequests };
try {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('.lion-experience')?.dataset.ready === 'true', { timeout: 180000 });
  await page.locator('.initial-loader').waitFor({ state: 'detached', timeout: 180000 });

  for (const [index, id] of ids.entries()) {
    await page.locator(`.chapter-control[data-part="${id}"]`).click();
    await page.waitForFunction(expected => {
      const root = document.querySelector('.lion-experience');
      return root?.dataset.phase === 'study' && root.dataset.selected === expected;
    }, id, { timeout: 30000 });

    const stage = page.locator('.lion-breakdown-stage');
    await stage.waitFor({ state: 'visible' });
    assert.equal((await stage.innerText()).trim(), '', 'the right stage shows no visible text UI');
    assert.equal(await stage.evaluate(element => getComputedStyle(element).backgroundColor), 'rgb(238, 234, 225)', 'letterboxing uses a solid paper color');
    const stageImage = await page.locator('.lion-breakdown-image-button img').evaluate(element => ({
      src: new URL(element.src).pathname,
      width: element.naturalWidth,
      height: element.naturalHeight,
      fit: getComputedStyle(element).objectFit,
      filter: getComputedStyle(element).filter,
    }));
    assert.equal(stageImage.src, `/images/lion-info/${assetNames[index]}.png`);
    assert.ok(stageImage.width >= 1024 && stageImage.height >= 1536, `${id} is a full-resolution generated image`);
    assert.ok(Math.abs(stageImage.width / stageImage.height - 2 / 3) < .01, `${id} keeps its portrait ratio`);
    assert.equal(stageImage.fit, 'contain', `${id} is never cropped`);
    assert.equal(stageImage.filter, 'none', `${id} has no blur or image filter`);
    if (id === 'body') await page.screenshot({ path: `${output}/screenshots/body-stage.png` });

    const trigger = page.getByRole('button', { name: `打开${({ brows: '眉目', crown: '额冠', beard: '鬃须', body: '织锦', trim: '云边', mouth: '口齿' })[id]}文化讲解` });
    await trigger.click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor({ state: 'visible' });
    await page.waitForFunction(() => {
      const backdrop = document.querySelector('.lion-detail-backdrop');
      const modal = document.querySelector('.lion-detail-modal');
      return Number(getComputedStyle(backdrop).opacity) > .98 && Number(getComputedStyle(modal).opacity) > .98;
    });
    assert.equal(await dialog.getAttribute('aria-modal'), 'true');
    assert.equal(await page.locator('.lion-detail-section').count(), 5, `${id} has five structured explanation sections`);
    assert.ok(await page.locator('.lion-detail-sources a').count() > 0, `${id} includes source links`);
    const reader = page.locator('.lion-detail-reading');
    const scrollMetrics = await reader.evaluate(element => ({
      total: element.scrollHeight,
      height: element.clientHeight,
      overflow: getComputedStyle(element).overflowY,
    }));
    assert.ok(['auto', 'scroll'].includes(scrollMetrics.overflow), 'modal reading pane owns its scroll');
    if (scrollMetrics.total > scrollMetrics.height) {
      await reader.evaluate(element => { element.scrollTop = element.scrollHeight; });
      const finalSource = await page.locator('.lion-detail-sources a').last().evaluate(element => {
        const link = element.getBoundingClientRect();
        const pane = element.closest('.lion-detail-reading').getBoundingClientRect();
        return link.top >= pane.top - 1 && link.bottom <= pane.bottom + 1;
      });
      assert.equal(finalSource, true, 'source links remain reachable at the end of modal content');
      if (id === 'brows') await page.screenshot({ path: `${output}/screenshots/brows-modal-reading.png` });
      await reader.evaluate(element => { element.scrollTop = 0; });
    }
    const sourceLink = page.locator('.lion-detail-sources a').first();
    assert.equal(await sourceLink.getAttribute('target'), '_blank');
    assert.ok((await sourceLink.getAttribute('rel')).includes('noreferrer'));
    assert.equal(await page.locator('.lion-experience').getAttribute('data-selected'), id, 'opening the dialog keeps the same chapter selected');
    assert.equal(await page.locator('.lion-experience').getAttribute('data-phase'), 'study', 'opening the dialog keeps the study view');
    assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden', 'background scrolling is locked while open');

    if (id === 'brows') {
      await page.screenshot({ path: `${output}/screenshots/brows-modal.png` });
      await page.keyboard.press('ArrowRight');
      assert.equal(await page.locator('.lion-experience').getAttribute('data-selected'), id, 'arrow keys do not change chapters behind the dialog');
      await page.keyboard.press('Shift+Tab');
      assert.equal(await page.locator('.lion-detail-sources a').last().evaluate(element => element === document.activeElement), true, 'Shift+Tab wraps to the last dialog control');
      await page.keyboard.press('Tab');
      assert.equal(await page.getByRole('button', { name: '关闭文化讲解' }).evaluate(element => element === document.activeElement), true, 'Tab wraps to the first dialog control');
      await page.keyboard.press('Escape');
    } else if (id === 'crown') {
      await page.locator('.lion-detail-backdrop').click({ position: { x: 4, y: 4 } });
    } else {
      await page.getByRole('button', { name: '关闭文化讲解' }).click();
    }

    await dialog.waitFor({ state: 'detached' });
    assert.equal(await page.evaluate(() => document.body.style.overflow), '', 'body overflow is restored after closing');
    assert.equal(await page.locator('.lion-experience').getAttribute('data-selected'), id, 'closing keeps the selected chapter');
    assert.equal(await trigger.evaluate(element => element === document.activeElement), true, 'focus returns to the image that opened the dialog');
    result.chapters.push({ id, stageImage, sections: 5, scrollMetrics, dialogClosed: true });
  }

  const hashes = await page.evaluate(async names => Promise.all(names.map(async name => {
    const response = await fetch(`/images/lion-info/${name}.png`);
    if (!response.ok) throw new Error(`Missing information image: ${name}`);
    const bytes = await response.arrayBuffer();
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(value => value.toString(16).padStart(2, '0')).join('');
    return { name, bytes: bytes.byteLength, sha256: hash };
  })), assetNames);
  assert.equal(new Set(hashes.map(asset => asset.sha256)).size, 6, 'six image files contain six unique generated images');
  result.assets = hashes;

  const desktopLayouts = [];
  for (const viewport of [[1280, 800], [1536, 960], [1920, 1080], [2560, 1440]]) {
    await page.setViewportSize({ width: viewport[0], height: viewport[1] });
    await page.waitForTimeout(450);
    const layout = await page.evaluate(() => {
      const stage = document.querySelector('.lion-breakdown-stage').getBoundingClientRect();
      const frame = document.querySelector('.visual-frame').getBoundingClientRect();
      const image = document.querySelector('.lion-breakdown-image-button img');
      const fitScale = Math.min(stage.width / image.naturalWidth, stage.height / image.naturalHeight);
      return {
        viewport: [innerWidth, innerHeight],
        background: getComputedStyle(document.querySelector('.lion-breakdown-stage')).backgroundColor,
        stage: { left: stage.left, top: stage.top, right: stage.right, bottom: stage.bottom, width: stage.width, height: stage.height },
        frame: { right: frame.right },
        renderedImage: { width: image.naturalWidth * fitScale, height: image.naturalHeight * fitScale },
      };
    });
    assert.ok(layout.stage.left >= layout.frame.right, 'the information plate remains to the right of the main artwork');
    assert.ok(layout.stage.right <= viewport[0] + 1 && layout.stage.top >= 0 && layout.stage.bottom <= viewport[1] + 1, 'the complete plate stage remains inside the desktop viewport');
    assert.ok(layout.renderedImage.width <= layout.stage.width && layout.renderedImage.height <= layout.stage.height, 'the portrait image remains fully contained');
    assert.equal(layout.background, 'rgb(238, 234, 225)', 'desktop letterboxing remains a solid color at every tested ratio');
    desktopLayouts.push(layout);
  }
  result.desktopLayouts = desktopLayouts;

  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.chapter-control[data-part="mouth"]').click();
  await page.waitForFunction(() => document.querySelector('.lion-experience')?.dataset.phase === 'study' && document.querySelector('.lion-experience')?.dataset.selected === 'mouth');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: '打开口齿文化讲解' }).click();
  await page.getByRole('dialog').waitFor({ state: 'visible' });
  await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.lion-detail-modal')).opacity) > .98);
  const mobile = await page.locator('.lion-detail-modal').evaluate(element => {
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return { width: box.width, height: box.height, columns: style.gridTemplateColumns, rows: style.gridTemplateRows };
  });
  assert.ok(mobile.width <= 390 && mobile.height <= 844, 'mobile modal stays within the viewport');
  assert.equal(mobile.columns.trim().split(/\s+/).length, 1, 'mobile modal stacks image and text vertically');
  assert.equal(await page.locator('.lion-detail-modal').evaluate(element => getComputedStyle(element).animationName), 'none', 'reduced-motion preference removes modal animation');
  await page.screenshot({ path: `${output}/screenshots/mobile-modal.png` });
  const mobileReader = page.locator('.lion-detail-reading');
  const mobileScroll = await mobileReader.evaluate(element => ({ total: element.scrollHeight, height: element.clientHeight, overflow: getComputedStyle(element).overflowY }));
  assert.ok(mobileScroll.total > mobileScroll.height, 'mobile modal content scrolls inside its reading pane');
  assert.ok(['auto', 'scroll'].includes(mobileScroll.overflow));
  await mobileReader.evaluate(element => { element.scrollTop = element.scrollHeight; });
  const mobileSourceReachable = await page.locator('.lion-detail-sources a').last().evaluate(element => {
    const link = element.getBoundingClientRect();
    const pane = element.closest('.lion-detail-reading').getBoundingClientRect();
    return link.top >= pane.top - 1 && link.bottom <= pane.bottom + 1;
  });
  assert.equal(mobileSourceReachable, true, 'mobile reader can reach source links at the end');
  await page.screenshot({ path: `${output}/screenshots/mobile-modal-reading.png` });
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  assert.equal(await page.locator('.lion-experience').getAttribute('data-selected'), 'mouth');
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(failedRequests, []);

  result.mobile = { viewport: { width: 390, height: 844 }, layout: mobile, scroll: mobileScroll, sourcesReachable: mobileSourceReachable, reducedMotion: true };
  result.passed = true;
  await writeFile(`${output}/browser-results.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ passed: true, chapters: result.chapters.length, uniqueImages: hashes.length, mobile, pageErrors, failedRequests, evidence: output }, null, 2));
} catch (error) {
  result.passed = false;
  result.failure = error.stack;
  await page.screenshot({ path: `${output}/screenshots/failure.png` }).catch(() => {});
  await writeFile(`${output}/browser-results.json`, JSON.stringify(result, null, 2));
  throw error;
} finally {
  await browser.close();
}
