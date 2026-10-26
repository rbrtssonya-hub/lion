import { expect } from '@playwright/test';

export async function selectHomeExhibit(page, id = 'homeLionBook') {
  const rail = page.getByRole('navigation', { name: '首页章节导航', exact: true });
  if (!await rail.isVisible()) {
    await page.locator('#enterWork').click();
    await expect(rail).toBeVisible();
  }
  const target = page.locator(`#${id}`);
  const button = rail.locator(`[data-home-section="${id}"]`);
  if (!await target.isVisible()) await button.click();
  await expect(target).toBeVisible();
  await expect(button).toHaveAttribute('aria-current', 'location');
  return target;
}

export async function expectExhibitFrame(page, id) {
  await expect.poll(() => page.locator(`#${id}`).evaluate(section => {
    const panel = section.closest('.home-archive-panel').getBoundingClientRect();
    const header = document.querySelector('.site-header').getBoundingClientRect();
    return Math.abs(panel.top - header.bottom) < 3 && panel.bottom <= innerHeight + 2;
  })).toBe(true);
}

export async function returnToHomeHero(page) {
  await page.locator('.home-archive-return').click();
  await expect(page.locator('.home-archive-nav')).toBeHidden();
  await expect(page.locator('#enterWork')).toBeInViewport();
}
