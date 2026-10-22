import { test, expect } from '@playwright/test';

test('线条开关贴合首页右下角，自适应且只有白线；键盘和减少动态可用', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 60_000 });
  await page.locator('#replayIntro').click();
  await page.locator('#skipIntro').click();
  const toggle = page.locator('#toggleHomeAudio');
  await expect(toggle).toHaveClass(/sound-control-line/);
  for (const [width, height] of [[1920, 1080], [2560, 1440], [1366, 768], [1024, 768], [900, 768]]) {
    await page.setViewportSize({ width, height });
    const box = await toggle.boundingBox();
    const hero = await page.locator('.entry-gate').boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(hero.x + hero.width - box.x - box.width).toBeGreaterThanOrEqual(20);
    expect(hero.x + hero.width - box.x - box.width).toBeLessThanOrEqual(48);
    expect(hero.y + hero.height - box.y - box.height).toBeGreaterThanOrEqual(20);
    expect(hero.y + hero.height - box.y - box.height).toBeLessThanOrEqual(48);
    expect(await toggle.evaluate(button => {
      const css = getComputedStyle(button);
      const path = getComputedStyle(button.querySelector('path'));
      return { background: css.backgroundColor, border: css.borderTopWidth, shadow: css.boxShadow, stroke: path.stroke };
    })).toEqual({ background: 'rgba(0, 0, 0, 0)', border: '0px', shadow: 'none', stroke: 'rgb(255, 255, 255)' });
    await expect(toggle).toHaveText('');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await toggle.focus();
  await page.keyboard.press('Space');
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(toggle.locator('path')).toHaveAttribute('d', 'M 3 12 H 57');
  expect(await toggle.evaluate(button => getComputedStyle(button).outlineStyle)).toBe('solid');
  await page.mouse.click(700, 300);
  await page.screenshot({ path: testInfo.outputPath('muted-900.png') });
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(toggle.locator('path')).toHaveAttribute('d', /C/);
  for (let index = 0; index < 8; index += 1) await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await page.mouse.click(700, 300);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.screenshot({ path: testInfo.outputPath('audible-1920.png') });
  await toggle.screenshot({ path: testInfo.outputPath('audible-detail.png') });
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.getByRole('button', { name: '打开开发者参数设置', exact: true }).click();
  await expect(page.locator('.site-shell')).toHaveAttribute('data-settings-layout', 'push');
  await expect(page.locator('#developerSettingsPanel')).toBeVisible();
  await expect.poll(async () => {
    const hero = await page.locator('.entry-gate').boundingBox();
    const box = await toggle.boundingBox();
    const panel = await page.locator('#developerSettingsPanel').boundingBox();
    return hero.x + hero.width <= panel.x + 1 && box.x + box.width < panel.x;
  }).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('pushed-settings-1366.png') });
  await page.getByRole('button', { name: '关闭开发者参数', exact: true }).click();
  await page.locator('#homeLionBook').scrollIntoViewIfNeeded();
  await expect(toggle).not.toBeInViewport();
  await page.locator('.site-header [data-route="state"]').click();
  await expect(toggle).not.toBeVisible();
});
