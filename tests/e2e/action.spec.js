import { test, expect } from '@playwright/test';

async function openPage(page, url) {
  await page.goto(url);
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 45000 });
}

const names = ['入场', '探步', '转身', '收势'];
const ids = ['entry', 'probe', 'turn', 'settle'];
const timeline = (page, placement) => page.locator(`.action-timeline[data-placement="${placement}"]`);

test('动作页首屏与四段配图保持独立媒体、真实待接入和16:9', async ({ page }) => {
  const videoRequests = [];
  page.on('request', r => { if (/\.mp4|\.webm/.test(r.url())) videoRequests.push(r.url()); });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openPage(page, '/#/action');
  await expect(page.locator('#actionHero')).toBeVisible();
  await expect(page.locator('.action-clip')).toHaveCount(4);
  await expect(page.locator('.action-timeline')).toHaveCount(1);
  await expect(page.locator('#actionHero .action-timeline, .action-explore-link')).toHaveCount(0);
  await expect(timeline(page, 'details').getByRole('button')).toHaveText(names);
  await expect(page.locator('#actionHero [data-action-count]')).toHaveText('01 / 04');
  await expect(page.locator('#actionHero [data-action-name]')).toHaveText('入场');
  await expect(page.locator('.action-poster')).toHaveCount(5);
  expect(await page.locator('#actionHero .action-player').evaluate(el => {
    const r = el.getBoundingClientRect(); return r.width / r.height;
  })).toBeCloseTo(16 / 9, 2);
  await expect(page.locator('#actionHero .action-media-status')).toContainText('视频待接入');
  await expect(page.locator('.action-clip [data-watch-clip]')).toHaveCount(4);
  await expect(page.locator('.action-clip [data-watch-clip]')).toHaveText(Array(4).fill('观看片段 →'));
  // The global startup now prepares the persistent home video behind each
  // chapter. No unprovided action clip may create its own media request.
  expect(videoRequests.filter(url => !/\/assets\/(?:entry\/home-lion-loop|intro\/entry-intro)\.mp4(?:\?|$)/.test(url))).toEqual([]);
  for (const poster of await page.locator('.action-poster').all()) {
    await poster.scrollIntoViewIfNeeded();
    await expect.poll(() => poster.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  }
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(240); // Capture the settled visual, not a previous node's transition.
  await page.screenshot({ path: 'tmp/action-ui/action-long-1920.png', fullPage: true });
  await page.evaluate(() => scrollTo({ top: document.querySelector('#actionDetails').getBoundingClientRect().top + scrollY - document.querySelector('.site-header').getBoundingClientRect().height, behavior: 'instant' }));
  await expect(page.locator('#chapterStage')).toHaveAttribute('data-active-action', 'entry');
  await page.waitForTimeout(240);
  await page.screenshot({ path: 'tmp/action-ui/detail-start-1920.png' });
});

test('动作页唯一阶段目录同步首屏编号图片与两句简介，不自动播放', async ({ page }) => {
  await openPage(page, '/#/action');
  for (let i = 0; i < 4; i++) {
    await timeline(page, 'details').getByRole('button', { name: names[i], exact: true }).click();
    await expect(page.locator('#chapterStage')).toHaveAttribute('data-active-action', ids[i]);
    await expect(page.locator('#actionHero [data-action-count]')).toHaveText(`0${i + 1} / 04`);
    await expect(page.locator('#actionHero [data-action-name]')).toHaveText(names[i]);
    await expect(page.locator('#actionHero .action-intro-lines p')).toHaveCount(2);
    await expect(page.locator('#actionHero .action-poster')).toHaveAttribute('src', new RegExp(`action-${ids[i]}-poster`));
    await expect(timeline(page, 'details').getByRole('button', { name: names[i], exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#actionHero .action-player')).toHaveAttribute('data-media-state', 'pending');
  }
  await expect(page).toHaveURL(/#\/action$/);
});

test('动作页下方时间轴定位四段并保持Hash、吸顶和正确高亮', async ({ page }) => {
  await openPage(page, '/#/action');
  await page.locator('#actionDetails').scrollIntoViewIfNeeded();
  for (const i of [3, 1, 2, 0]) {
    await timeline(page, 'details').getByRole('button', { name: names[i], exact: true }).click();
    await expect(page.locator('#chapterStage')).toHaveAttribute('data-active-action', ids[i]);
    await expect.poll(() => page.locator(`#action-clip-${ids[i]}`).evaluate(el => {
      const bar = document.querySelector('[data-placement="details"]').getBoundingClientRect();
      return el.getBoundingClientRect().top - bar.bottom;
    })).toBeGreaterThanOrEqual(12);
    await expect.poll(() => page.locator(`#action-clip-${ids[i]}`).evaluate(el => {
      const bar = document.querySelector('.action-sticky-index').getBoundingClientRect();
      return el.getBoundingClientRect().top - bar.bottom;
    })).toBeLessThanOrEqual(30);
    await page.waitForTimeout(250);
    await expect(page.locator('#chapterStage')).toHaveAttribute('data-active-action', ids[i]);
    await expect(page).toHaveURL(/#\/action$/);
  }
});

test('审查回归：高窗口和设置推开定位结束后不漂移到下一段', async ({ page }) => {
  test.setTimeout(180_000);
  await page.addInitScript(() => {
    if (window !== window.top) return;
    const query = new URLSearchParams(location.search);
    const panelWidth = Number(query.get('panel'));
    localStorage.setItem('nanfeng-lion:developer-settings:v1', JSON.stringify({ pushPage: Boolean(panelWidth), panelWidth: panelWidth || 340, headerHeight: Number(query.get('header')) }));
  });
  for (const [width, height, panelWidth, headerHeight] of [[1600,1200,700,90],[1920,1440,760,64],[3840,2160,0,90]]) {
    await page.setViewportSize({ width, height });
    await openPage(page, `/?panel=${panelWidth}&header=${headerHeight}#/action`);
    if (panelWidth) {
      const gutter = await page.locator('.site-shell').evaluate(element => innerWidth - element.getBoundingClientRect().width);
      await page.setViewportSize({ width: Math.round(width + gutter), height });
      await page.getByRole('button', { name: '打开开发者参数设置', exact: true }).click();
      await expect(page.locator('.site-shell')).toHaveAttribute('data-settings-layout', 'push');
      await expect.poll(() => page.locator('.site-page').evaluate(element => element.getBoundingClientRect().width)).toBe(width - panelWidth);
    }
    await page.locator('#actionDetails').scrollIntoViewIfNeeded();
    for (const i of [2, 0, 1, 3]) {
      await timeline(page, 'details').getByRole('button', { name: names[i], exact: true }).click();
      await expect.poll(() => page.locator(`#action-clip-${ids[i]}`).evaluate(el => {
        const desired = el.getBoundingClientRect().top + scrollY - document.querySelector('.site-header').getBoundingClientRect().height - document.querySelector('.action-sticky-index').getBoundingClientRect().height - 24;
        return Math.abs(scrollY - Math.min(desired, document.documentElement.scrollHeight - innerHeight));
      })).toBeLessThan(4);
      expect(await page.locator(`#action-clip-${ids[i]}`).evaluate(el => el.getBoundingClientRect().top - document.querySelector('.action-sticky-index').getBoundingClientRect().bottom)).toBeGreaterThanOrEqual(12);
      await page.waitForTimeout(250);
      await expect(page.locator('#chapterStage')).toHaveAttribute('data-active-action', ids[i]);
      await expect(page.locator('#actionHero [data-action-count]')).toHaveText(`0${i + 1} / 04`);
      await expect(timeline(page, 'details').getByRole('button', { name: names[i], exact: true })).toHaveAttribute('aria-pressed', 'true');
    }
  }
});

test('审查回归：定位途中点击、滚轮和滚动键会终止旧平滑滚动', async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  for (const cancel of ['pointer', 'wheel', 'keyboard']) {
    await openPage(page, '/#/action');
    await page.locator('#actionDetails').scrollIntoViewIfNeeded();
    const start = await page.evaluate(() => scrollY);
    await timeline(page, 'details').getByRole('button', { name: '收势', exact: true }).click();
    await expect.poll(() => page.evaluate(start => scrollY - start, start)).toBeGreaterThan(100);
    await page.evaluate(() => { window.actionSelectionTrace = []; const observer = new MutationObserver(() => window.actionSelectionTrace.push(document.querySelector('#chapterStage').dataset.activeAction)); observer.observe(document.querySelector('#chapterStage'), { attributes: true, attributeFilter: ['data-active-action'] }); });
    if (cancel === 'pointer') await page.mouse.click(1850, 800);
    if (cancel === 'wheel') await page.mouse.wheel(0, -80);
    if (cancel === 'keyboard') { await page.locator('#chapterStage').evaluate(el => { el.tabIndex = -1; el.focus({ preventScroll: true }); }); await page.keyboard.press('ArrowUp'); }
    const atCancel = await page.evaluate(() => scrollY);
    await page.waitForTimeout(550); // Longer than Chrome's remaining original scroll animation.
    const final = await page.evaluate(() => ({ top: scrollY, trace: window.actionSelectionTrace }));
    expect(Math.abs(final.top - atCancel)).toBeLessThan(cancel === 'pointer' ? 8 : 150);
    expect(new Set(final.trace).size).toBeLessThanOrEqual(1);
  }
});

test('动作页自然滚动同步唯一阶段目录与首屏，未接入片段仍可查看配图简介', async ({ page }) => {
  await openPage(page, '/#/action');
  await page.locator('#action-clip-turn').scrollIntoViewIfNeeded();
  await expect(page.locator('#chapterStage')).toHaveAttribute('data-active-action', 'turn');
  await expect(timeline(page, 'details').getByRole('button', { name: '转身', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#actionHero [data-action-name]')).toHaveText('转身');
  await page.locator('#action-clip-turn [data-watch-clip]').click();
  await expect(page.locator('#action-clip-turn .action-media-status')).toContainText('视频待接入');
  await expect(page.locator('#action-clip-turn .action-intro-lines')).toContainText('狮头引导，身体跟随。');
});

test('动作页减弱动态时键盘切段仍联动并可立即定位', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openPage(page, '/#/action');
  await page.locator('#actionDetails').scrollIntoViewIfNeeded();
  await timeline(page, 'details').getByRole('button', { name: '入场', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(page.locator('#chapterStage')).toHaveAttribute('data-active-action', 'probe');
  await page.locator('#actionDetails').scrollIntoViewIfNeeded();
  await timeline(page, 'details').getByRole('button', { name: '收势', exact: true }).click();
  await expect(page.locator('#chapterStage')).toHaveAttribute('data-active-action', 'settle');
});

test('动作页电脑窗口与设置推开不横溢、媒体与简介不重叠', async ({ page }) => {
  test.setTimeout(180_000);
  await page.addInitScript(() => {
    if (window !== window.top) return;
    localStorage.setItem('nanfeng-lion:developer-settings:v1', JSON.stringify({ pushPage: false }));
  });
  for (const [width, height] of [[1920,1080],[2560,1440],[1366,768],[1024,768]]) {
    await page.setViewportSize({ width, height });
    await openPage(page, '/#/action');
    await expect(page.locator('#actionHero')).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await expect.poll(() => page.locator('#actionHero .action-poster').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
    await page.screenshot({ path: `tmp/action-ui/hero-${width}.png` });
    const geometry = await page.locator('#actionHero').evaluate(el => {
      const media = el.querySelector('.action-player').getBoundingClientRect();
      const copy = el.querySelector('.action-hero-copy').getBoundingClientRect();
      return { overflow: document.documentElement.scrollWidth > document.querySelector('.site-shell').getBoundingClientRect().width, separated: media.right < copy.left };
    });
    expect(geometry).toEqual({ overflow: false, separated: true });
  }
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.getByRole('button', { name: '打开开发者参数设置', exact: true }).click();
  await expect(page.locator('#developerSettingsPanel')).toBeVisible();
  await expect(page.locator('.site-shell')).toHaveAttribute('data-settings-layout', 'overlay');
  await page.getByRole('tab', { name: '布局', exact: true }).click();
  await page.getByRole('checkbox', { name: '设置面板推开页面', exact: true }).check();
  await expect(page.locator('.site-shell')).toHaveAttribute('data-settings-layout', 'push');
  await expect.poll(() => page.locator('.site-page').evaluate(el => el.getBoundingClientRect().width)).toBeLessThan(1800);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.querySelector('.site-shell').getBoundingClientRect().width)).toBe(true);
  await page.screenshot({ path: 'tmp/action-ui/settings-push-1920.png' });
});
