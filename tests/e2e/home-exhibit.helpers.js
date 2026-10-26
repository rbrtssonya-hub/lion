import { expect } from '@playwright/test';

export async function selectHomeExhibit(page, id = 'homeLionBook') {
  if (id === 'homeLionTypes') {
    await page.locator('.site-navigation [data-route="model"]').click();
    await page.getByRole('tab', { name: '形制', exact: true }).click();
    const types = page.locator('#homeLionTypes');
    await expect(types).toBeVisible();
    return types;
  }
  if (await page.locator('#react-app').getAttribute('data-route') !== 'entry') {
    await page.locator('.site-navigation [data-route="entry"]').click();
  }
  const rail = page.getByRole('navigation', { name: '首页章节导航', exact: true });
  if (!await rail.isVisible()) {
    await page.locator('#enterWork').click();
    await expect(rail).toBeVisible();
  }
  const target = page.locator(`#${id}`);
  if (id === 'homeCultureSources') {
    await page.getByRole('button', { name: '资料与许可', exact: true }).click();
    await expect(target).toBeVisible();
    return target;
  }
  const button = rail.locator(`[data-home-section="${id}"]`);
  if (!await target.isVisible()) await button.click();
  await expect(target).toBeVisible();
  await expect(button).toHaveAttribute('aria-current', 'location');
  return target;
}

export async function expectExhibitFrame(page, id) {
  await expect.poll(() => page.locator(`#${id}`).evaluate(section => {
    const container = section.closest('.home-archive-panel, [role="tabpanel"], dialog');
    if (!container) return false;
    const panel = container.getBoundingClientRect();
    const header = document.querySelector('.site-header').getBoundingClientRect();
    return panel.top >= (container.tagName === 'DIALOG' ? 0 : header.bottom - 3) && panel.bottom <= innerHeight + 2;
  })).toBe(true);
}

export async function returnToHomeHero(page) {
  if (await page.getByRole('dialog', { name: '资料与许可' }).isVisible()) await page.keyboard.press('Escape');
  if (await page.locator('#react-app').getAttribute('data-route') !== 'entry') {
    await page.locator('.site-brand-capsule').click();
    await expect(page.locator('#enterWork')).toBeInViewport();
    return;
  }
  await page.locator('.home-archive-return').click();
  await expect(page.locator('.home-archive-nav')).toBeHidden();
  await expect(page.locator('#enterWork')).toBeInViewport();
}
