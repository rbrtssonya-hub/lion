import { test, expect } from '@playwright/test';

test.use({ trace: 'off' });

test('音量文字、裁剪波按钮与简约横线贴合首页右下角，电脑窄低窗可点且键盘和减少动态可用', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await page.locator('#replayIntro').click();
  await page.locator('#skipIntro').click();
  const toggle = page.locator('#toggleHomeAudio');
  const widget = toggle.locator('..');
  const slider = widget.getByRole('slider', { name: '音量', exact: true });
  await expect(toggle).toHaveClass(/sound-control-line/);
  await expect(toggle).toHaveText('音量');
  const overlaps = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  for (const [width, height] of [[1920, 1080], [2560, 1440], [1366, 768], [1024, 768], [900, 600], [675, 403], [640, 360]]) {
    await page.setViewportSize({ width, height });
    const box = await widget.boundingBox();
    const hero = await page.locator('.entry-gate').boundingBox();
    const button = await toggle.boundingBox();
    const range = await slider.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(100);
    expect(button.height).toBeGreaterThanOrEqual(36);
    expect(range.height).toBeGreaterThanOrEqual(24);
    expect(range.y).toBeGreaterThanOrEqual(button.y + button.height - 1);
    expect(hero.x + hero.width - box.x - box.width).toBeGreaterThanOrEqual(20);
    expect(hero.x + hero.width - box.x - box.width).toBeLessThanOrEqual(48);
    expect(hero.y + hero.height - box.y - box.height).toBeGreaterThanOrEqual(18);
    expect(hero.y + hero.height - box.y - box.height).toBeLessThanOrEqual(48);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(height + 1);
    for (const content of ['#enterWork', '.entry-motto', '.entry-english']) expect(overlaps(box, await page.locator(content).boundingBox())).toBe(false);
    expect(await toggle.evaluate(button => {
      const css = getComputedStyle(button);
      return { background: css.backgroundColor, border: css.borderTopWidth, shadow: css.boxShadow,
        stroke: getComputedStyle(button.querySelector('svg')).stroke };
    })).toEqual({ background: 'rgba(0, 0, 0, 0)', border: '0px', shadow: 'none', stroke: 'rgb(255, 255, 255)' });
    for (const locator of [toggle, slider]) expect(await locator.evaluate(element => {
      const box = element.getBoundingClientRect();
      return element.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
    })).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await toggle.focus();
  await page.keyboard.press('Space');
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  expect(await toggle.locator('.sound-wave-amplitude').evaluate(element => new DOMMatrixReadOnly(getComputedStyle(element).transform).m22)).toBeCloseTo(.0001, 5);
  expect(await toggle.evaluate(button => getComputedStyle(button).outlineStyle)).toBe('solid');
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  expect(await toggle.locator('.sound-wave-amplitude').evaluate(element => new DOMMatrixReadOnly(getComputedStyle(element).transform).m22)).toBe(1);
  await slider.focus();
  await slider.press('ArrowRight');
  await expect(slider).toHaveValue('26');
  await expect(slider).toHaveAttribute('aria-valuetext', '26%');
  expect(await slider.evaluate(element => getComputedStyle(element).outlineStyle)).toBe('solid');
  for (let index = 0; index < 8; index += 1) await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.getByRole('button', { name: '打开开发者参数设置', exact: true }).click();
  await expect(page.locator('.site-shell')).toHaveAttribute('data-settings-layout', 'push');
  await expect.poll(async () => {
    const hero = await page.locator('.entry-gate').boundingBox();
    const box = await widget.boundingBox();
    const panel = await page.locator('#developerSettingsPanel').boundingBox();
    return hero.x + hero.width <= panel.x + 1 && box.x + box.width < panel.x;
  }).toBe(true);
  await page.getByRole('button', { name: '关闭开发者参数', exact: true }).click();
  await page.locator('#homeLionBook').scrollIntoViewIfNeeded();
  await expect(widget).not.toBeInViewport();
  await page.locator('.site-header [data-route="state"]').click();
  await expect(widget).not.toBeVisible();
});

test('高顶栏与640短窗组合保留音量独立区，题图与探索/中文/英文均不重叠且可操作', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 360 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    if (window !== window.top) return;
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    localStorage.setItem('nanfeng-lion:developer-settings:v1', JSON.stringify({ headerHeight: 180, navFontSize: 14, helperFontSize: 28, navIconSize: 56, homeBrandOffset: 160, headerWidth: 60 }));
  });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  const widget = page.locator('.sound-control-widget-home');
  await expect(widget).toBeVisible();
  const sound = await widget.boundingBox();
  for (const selector of ['.entry-title-art', '#enterWork', '.entry-motto', '.entry-english']) {
    const item = await page.locator(selector).boundingBox();
    expect(item.x).toBeGreaterThanOrEqual(-1);
    expect(item.x + item.width).toBeLessThanOrEqual(641);
    expect(item.y + item.height).toBeLessThanOrEqual(361);
    expect(sound.x < item.x + item.width && sound.x + sound.width > item.x && sound.y < item.y + item.height && sound.y + sound.height > item.y).toBe(false);
  }
  for (const locator of [widget.getByRole('button'), widget.getByRole('slider', { name: '音量', exact: true }), page.locator('#enterWork')]) {
    expect(await locator.evaluate(element => {
      const bounds = element.getBoundingClientRect();
      return element.contains(document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2));
    })).toBe(true);
  }
});
