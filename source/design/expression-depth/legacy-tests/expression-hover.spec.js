import { test, expect } from '@playwright/test';

test.use({ trace: 'off', viewport: { width: 1920, height: 1080 } });

const trigger = page => page.locator('#expressionLionTrigger');
const copy = page => page.locator('#expressionStateCopy');

async function openExpression(page) {
  await page.addInitScript(() => { if (window === window.top) sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1'); });
  await page.goto('/#/state');
  await expect.poll(() => page.locator('#expressionLion').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('.expression-state-button')).toHaveCount(8);
}

async function expectNoHoverFrame(page) {
  const style = await trigger(page).evaluate(element => {
    const normal = getComputedStyle(element), after = getComputedStyle(element, '::after');
    return { hovered: element.matches(':hover'), focusVisible: element.matches(':focus-visible'),
      border: normal.borderTopWidth, shadow: normal.boxShadow, outline: normal.outlineStyle,
      afterContent: after.content, afterBorder: after.borderTopWidth, afterShadow: after.boxShadow };
  });
  expect(style).toEqual({ hovered: true, focusVisible: false, border: '0px', shadow: 'none', outline: 'none',
    afterContent: 'none', afterBorder: '0px', afterShadow: 'none' });
}

async function expectState(page, name) {
  await expect(page.locator('#chapterStage')).toHaveAttribute('data-expression', name);
  await expect(page.locator('.expression-state-nav button[aria-pressed="true"]')).toHaveText(name);
}

test('真实悬停和鼠标点狮头没有假金色内框，点击解读、滚轮和前后切态照常工作', async ({ page }) => {
  await openExpression(page);
  const brushRing = await page.locator('.expression-brush-ring').elementHandle();
  const original = await trigger(page).elementHandle();
  await trigger(page).hover();
  await expectNoHoverFrame(page);
  await expect(copy(page)).toHaveAttribute('data-view', 'overview');
  await trigger(page).click();
  await expect(copy(page)).toHaveAttribute('data-view', 'details');
  await expectNoHoverFrame(page);
  await expect(page.locator('#expressionDetailTitle')).toHaveText('喜态怎么看');
  await expect(page.locator('#expressionEmotionCue')).toBeVisible();
  // Scroll over the actual central lion, rather than dispatching a synthetic
  // wheel event, and retain the real eight-state component and brush artwork.
  await page.mouse.wheel(0, 180);
  await expectState(page, '怒');
  await expect(copy(page)).toHaveAttribute('data-view', 'overview');
  await expect.poll(() => page.locator('#expressionLion').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
  await page.locator('#expressionNext').click();
  await expectState(page, '哀');
  await page.locator('#expressionPrevious').click();
  await expectState(page, '怒');
  await trigger(page).hover();
  await expectNoHoverFrame(page);
  expect(await original.evaluate(element => element === document.querySelector('#expressionLionTrigger'))).toBe(true);
  expect(await brushRing.evaluate(element => element === document.querySelector('.expression-brush-ring'))).toBe(true);
  await expect(page.locator('.expression-brush-ring circle')).toHaveCount(3);
});

test('真实Tab进入中央狮头仍有可见键盘焦点，Enter查看解读和Escape返回正常', async ({ page }) => {
  await openExpression(page);
  await page.locator('#expressionPrevious').click();
  await expectState(page, '疑');
  await page.keyboard.press('Tab');
  await expect(trigger(page)).toBeFocused();
  expect(await trigger(page).evaluate(element => {
    const style = getComputedStyle(element), after = getComputedStyle(element, '::after');
    return { visible: element.matches(':focus-visible'), outline: style.outlineStyle,
      width: Number.parseFloat(style.outlineWidth), color: style.outlineColor, afterContent: after.content };
  })).toEqual({ visible: true, outline: 'solid', width: 2, color: 'rgb(196, 156, 99)', afterContent: 'none' });
  await page.keyboard.press('Enter');
  await expect(copy(page)).toHaveAttribute('data-view', 'details');
  await expect(page.locator('#expressionDetailTitle')).toHaveText('疑态怎么看');
  await page.keyboard.press('Escape');
  await expect(copy(page)).toHaveAttribute('data-view', 'overview');
  await expect(trigger(page)).toBeFocused();
  expect(await trigger(page).evaluate(element => element.matches(':focus-visible'))).toBe(true);
});
