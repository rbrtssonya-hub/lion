import { test, expect } from '@playwright/test';

test('探索更多保留透明金色书法与电脑端居中对齐，点击进入结构章节', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  const button = page.getByRole('button', { name: '探索更多', exact: true });
  await expect(button).toBeVisible();
  const calligraphy = button.locator('.entry-cta-calligraphy');
  await expect(calligraphy).toHaveAttribute('src', /assets\/entry\/explore-more-calligraphy\.png$/);
  await expect.poll(() => calligraphy.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
  const transparency = await calligraphy.evaluate(image => {
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const corner = (x, y) => pixels[(y * canvas.width + x) * 4 + 3];
    let visible = 0;
    for (let index = 3; index < pixels.length; index += 4) if (pixels[index] > 16) visible += 1;
    return {
      corners: [corner(0, 0), corner(canvas.width - 1, 0), corner(0, canvas.height - 1), corner(canvas.width - 1, canvas.height - 1)],
      visible, total: canvas.width * canvas.height,
    };
  });
  expect(transparency.corners.every(alpha => alpha <= 2)).toBe(true);
  expect(transparency.visible).toBeGreaterThan(transparency.total * 0.1);
  expect(transparency.visible).toBeLessThan(transparency.total);

  for (const [width, height] of [[1024, 768], [1366, 768], [1920, 1080], [2560, 1440]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect(button).toBeVisible();
    const alignment = await page.locator('.entry-copy').evaluate(copy => {
      const read = selector => {
        const box = copy.querySelector(selector).getBoundingClientRect();
        return { centerX: box.left + box.width / 2, centerY: box.top + box.height / 2, left: box.left, right: box.right };
      };
      return {
        button: read('.entry-cta'), image: read('.entry-cta-calligraphy'),
        title: read('.entry-title-live2d'), motto: read('.entry-motto'), english: read('.entry-english'),
      };
    });
    expect(Math.abs(alignment.image.centerX - alignment.button.centerX)).toBeLessThan(1);
    expect(Math.abs(alignment.image.centerY - alignment.button.centerY)).toBeLessThan(1);
    for (const part of [alignment.title, alignment.motto, alignment.english]) {
      expect(Math.abs(part.centerX - alignment.button.centerX)).toBeLessThan(1);
      expect(part.left).toBeGreaterThanOrEqual(0);
      expect(part.right).toBeLessThanOrEqual(width);
    }
  }
  await button.click();
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'model');
  await expect(page).toHaveURL(/#\/model$/);
  await expect(page.locator('#modelStage')).toBeVisible();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
});

test('首页向下了解文化入口继续滚动图鉴并保持首页地址', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  const initialUrl = page.url();
  await page.getByRole('button', { name: '向下了解醒狮文化' }).click();
  await expect(page.locator('#homeCulture')).toBeInViewport();
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(100);
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'entry');
  expect(page.url()).toBe(initialUrl);
});

async function openCulture(page, settings = {}) {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.addInitScript(value => {
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    localStorage.setItem('nanfeng-lion:developer-settings:v1', JSON.stringify({ navigationTypographyVersion: 2, ...value }));
  }, settings);
  await page.goto('/');
  const carousel = page.locator('#homeCulture');
  const gallery = carousel.locator('.culture-depth-gallery');
  await gallery.scrollIntoViewIfNeeded();
  return { carousel, gallery, action: gallery.getByRole('button', { name: '下一张文化照片', exact: true }) };
}

async function photoPoint(gallery) {
  const box = await gallery.boundingBox();
  return { x: box.x + box.width * .42, y: box.y + box.height * .5 };
}

test('首页照片下方控制栏已删除，照片与摄影许可保留且页面自然滚动', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const { carousel, gallery } = await openCulture(page);
  await expect(carousel.locator('.home-culture-carousel-controls, .home-culture-progress, .home-culture-dots')).toHaveCount(0);
  await expect(carousel.getByRole('button')).toHaveCount(1);
  await expect(carousel.locator('[data-culture-slide]')).toHaveCount(4);
  await expect(carousel.locator('.is-active .home-culture-credit a')).toHaveCount(2);
  await expect(carousel.locator('.is-active .home-culture-photo')).toBeVisible();
  await expect.poll(() => carousel.locator('.is-active .home-culture-photo').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
  const center = await photoPoint(gallery);
  await page.mouse.move(center.x, center.y);
  const before = await page.evaluate(() => scrollY);
  await page.mouse.wheel(0, -230);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(before - 80);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('轮播按设置间隔同步照片与文字，鼠标在解读文字内不暂停', async ({ page }) => {
  const { carousel, gallery } = await openCulture(page, { carouselInterval: 2 });
  await expect(gallery).toHaveAttribute('data-depth-state', 'ready');
  await carousel.locator('.is-active .home-culture-copy').hover();
  await expect(carousel).toHaveAttribute('data-culture-playing', 'true');
  await expect(carousel.locator('.is-active')).toHaveAttribute('data-culture-id', 'living-tradition');
  await expect(carousel.locator('.is-active')).toHaveAttribute('data-culture-id', 'lion-head-craft', { timeout: 3500 });
  await expect(carousel.locator('.is-active .home-culture-title')).toHaveText('一扎一画，狮有了神采');
  await expect(carousel.locator('.is-active .home-culture-photo')).toHaveAttribute('alt', /狮头/);
  await expect(carousel.locator('.is-active .home-culture-credit a')).toHaveCount(2);
});

test('只有最前照片悬停微放大且左右移动稳定，点击一次切下一张', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const { carousel, gallery } = await openCulture(page, { carouselAutoplay: false });
  await expect(gallery).toHaveAttribute('data-depth-state', 'ready');
  await page.waitForTimeout(500);
  const canvas = gallery.locator('canvas');
  const before = await canvas.screenshot();
  const point = await photoPoint(gallery);
  await page.mouse.move(point.x, point.y);
  await expect(carousel).toHaveAttribute('data-culture-focused', 'true');
  await expect(canvas).toHaveCSS('cursor', 'pointer');
  await page.waitForTimeout(700);
  const focused = await canvas.screenshot();
  expect(focused.equals(before)).toBe(false);
  await page.mouse.move(point.x - 90, point.y);
  await page.mouse.move(point.x + 90, point.y);
  await page.waitForTimeout(150);
  expect((await canvas.screenshot()).equals(focused)).toBe(true);
  await page.mouse.click(point.x, point.y);
  await expect(carousel).toHaveAttribute('data-culture-index', '1');
  await page.waitForTimeout(1000);
  await expect(carousel.locator('.is-active .home-culture-title')).toHaveText('一扎一画，狮有了神采');
  const box = await gallery.boundingBox();
  await page.mouse.click(box.x + box.width * .94, box.y + box.height * .5);
  await expect(carousel).toHaveAttribute('data-culture-focused', 'false');
  await expect(carousel).toHaveAttribute('data-culture-index', '1');
  await page.mouse.click(box.x + box.width * .42, box.y + 8);
  await expect(carousel).toHaveAttribute('data-culture-index', '1');
  await page.mouse.move(point.x, point.y);
  for (let index = 0; index < 3; index += 1) await page.mouse.click(point.x, point.y);
  await expect(carousel).toHaveAttribute('data-culture-index', '0');
  expect(errors).toEqual([]);
});

test('悬停停止自动切换，不点击离开后按等待时间恢复，重复进入会重新等待', async ({ page }) => {
  const { carousel, gallery } = await openCulture(page, { carouselInterval: 2, carouselResumeDelay: 1 });
  await expect(gallery).toHaveAttribute('data-depth-state', 'ready');
  const point = await photoPoint(gallery);
  await page.mouse.move(point.x, point.y);
  await expect(carousel).toHaveAttribute('data-culture-status', 'focused');
  await page.waitForTimeout(2300);
  await expect(carousel).toHaveAttribute('data-culture-index', '0');
  await page.mouse.move(1800, point.y);
  await expect(carousel).toHaveAttribute('data-culture-status', 'waiting');
  await page.waitForTimeout(500);
  await page.mouse.move(point.x, point.y);
  await expect(carousel).toHaveAttribute('data-culture-status', 'focused');
  await page.waitForTimeout(700);
  await expect(carousel).toHaveAttribute('data-culture-index', '0');
  await page.mouse.move(1800, point.y);
  await expect(carousel).toHaveAttribute('data-culture-status', 'waiting');
  await expect(carousel).toHaveAttribute('data-culture-status', 'playing', { timeout: 1800 });
  await expect(carousel).toHaveAttribute('data-culture-index', '0');
  await expect(carousel).toHaveAttribute('data-culture-index', '1', { timeout: 3000 });
  // A pointer click does not leave keyboard focus permanently pausing playback.
  await gallery.getByRole('button', { name: '下一张文化照片', exact: true }).focus();
  await expect(carousel).toHaveAttribute('data-culture-status', 'focused');
  await page.mouse.click(point.x, point.y);
  await expect(carousel).toHaveAttribute('data-culture-index', '2');
  await page.mouse.move(1800, point.y);
  await expect(carousel).toHaveAttribute('data-culture-status', 'playing', { timeout: 1800 });
  await expect(carousel).toHaveAttribute('data-culture-index', '3', { timeout: 3200 });
});

test('减少动态时保留点击与键盘首尾循环并停止自动播放', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const { carousel, gallery, action } = await openCulture(page, { carouselInterval: 2, carouselResumeDelay: 1 });
  await expect(gallery).toHaveAttribute('data-depth-state', 'static');
  await action.click();
  await expect(carousel).toHaveAttribute('data-culture-index', '1');
  await action.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(carousel).toHaveAttribute('data-culture-index', '0');
  await page.keyboard.press('ArrowLeft');
  await expect(carousel).toHaveAttribute('data-culture-index', '3');
  await page.keyboard.press('Enter');
  await expect(carousel).toHaveAttribute('data-culture-index', '0');
  await page.keyboard.press('End');
  await expect(carousel).toHaveAttribute('data-culture-index', '3');
  await page.keyboard.press('Home');
  await expect(carousel).toHaveAttribute('data-culture-index', '0');
  await expect(carousel.locator('[aria-live]')).toHaveAttribute('aria-live', 'polite');
  await page.waitForTimeout(2300);
  await expect(carousel).toHaveAttribute('data-culture-index', '0');
});

test('轮播自动开关即时生效，关闭时点击再离开也不会自动重启', async ({ page }) => {
  const { carousel, gallery } = await openCulture(page, { carouselAutoplay: false, carouselInterval: 2, carouselResumeDelay: 1 });
  await expect(gallery).toHaveAttribute('data-depth-state', 'ready');
  const point = await photoPoint(gallery);
  await page.mouse.click(point.x, point.y);
  await expect(carousel).toHaveAttribute('data-culture-index', '1');
  await page.mouse.move(1800, point.y);
  await page.waitForTimeout(3300);
  await expect(carousel).toHaveAttribute('data-culture-status', 'disabled');
  await expect(carousel).toHaveAttribute('data-culture-index', '1');
  await page.getByRole('button', { name: '打开开发者参数设置', exact: true }).click();
  const panel = page.getByRole('region', { name: '开发者参数设置' });
  await panel.getByRole('tab', { name: '轮播', exact: true }).click();
  await panel.getByRole('checkbox', { name: '照片自动播放', exact: true }).check();
  await panel.getByRole('button', { name: '关闭开发者参数' }).click();
  await expect(carousel).toHaveAttribute('data-culture-playing', 'true');
  await expect(carousel).toHaveAttribute('data-culture-index', '2', { timeout: 3000 });
});

test('WebGL不可用时照片仍可点击切换且保留来源', async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (/webgl/.test(type)) return null;
      return getContext.call(this, type, ...args);
    };
  });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const { carousel, gallery, action } = await openCulture(page);
  await expect(gallery).toHaveAttribute('data-depth-state', 'fallback');
  await expect(carousel.locator('.is-active .home-culture-photo')).toBeVisible();
  await action.click();
  await expect(carousel).toHaveAttribute('data-culture-index', '1');
  await expect(carousel.locator('.is-active .home-culture-photo')).toHaveAttribute('alt', /狮头/);
  await expect(carousel.locator('.is-active .home-culture-credit a')).toHaveCount(2);
  expect(errors).toEqual([]);
});

test('电脑窗口和运行中参数变化保持同一画布，减少动态与离页可释放重入', async ({ page }) => {
  const { carousel, gallery } = await openCulture(page, { carouselAutoplay: false });
  await expect(gallery).toHaveAttribute('data-depth-state', 'ready');
  const canvas = await gallery.locator('canvas').evaluateHandle(element => element);
  for (const [width, height] of [[1366, 768], [1920, 1080], [2560, 1440]]) {
    await page.setViewportSize({ width, height });
    await gallery.scrollIntoViewIfNeeded();
    await expect.poll(() => gallery.locator('canvas').evaluate(element => Math.abs(element.width / Math.min(devicePixelRatio, 1.75) - element.clientWidth) < 2)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.getByRole('button', { name: '打开开发者参数设置', exact: true }).click();
  const panel = page.getByRole('region', { name: '开发者参数设置' });
  await panel.getByRole('tab', { name: '轮播', exact: true }).click();
  const zoom = panel.getByRole('spinbutton', { name: '照片聚焦比例数值', exact: true });
  await zoom.fill('110');
  await zoom.press('Tab');
  const duration = panel.getByRole('spinbutton', { name: '照片过渡时长数值', exact: true });
  await duration.fill('300');
  await duration.press('Tab');
  await expect.poll(() => canvas.evaluate(element => element.isConnected && element === document.querySelector('.culture-depth-canvas'))).toBe(true);
  await expect(gallery).toHaveCSS('--culture-focus-scale', '1.1');
  await panel.getByRole('button', { name: '关闭开发者参数' }).click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(gallery).toHaveAttribute('data-depth-state', 'static');
  await expect.poll(() => canvas.evaluate(element => (element.getContext('webgl2') || element.getContext('webgl')).isContextLost())).toBe(true);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(gallery).toHaveAttribute('data-depth-state', 'ready');
  const nextCanvas = await gallery.locator('canvas').evaluateHandle(element => element);
  await page.locator('.site-nav-item[data-route="action"]').click();
  await expect(page.locator('.culture-depth-canvas')).toHaveCount(0);
  await expect.poll(() => nextCanvas.evaluate(element => !element.isConnected && (element.getContext('webgl2') || element.getContext('webgl')).isContextLost())).toBe(true);
  await page.locator('.site-nav-item[data-route="entry"]').click();
  await gallery.scrollIntoViewIfNeeded();
  await expect(gallery).toHaveAttribute('data-depth-state', 'ready');
  await expect(carousel.locator('canvas')).toHaveCount(1);
});


test('减少动态效果时文化内容立即可读，手机页面仍能自然滚动', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const reveals = page.locator('#homeCulture [data-culture-reveal], #homeCulture [data-culture-slide].is-active');
  expect(await reveals.count()).toBe(2);
  await expect.poll(() => reveals.evaluateAll((elements) => elements.every((element) => {
    const style = getComputedStyle(element);
    return Number(style.opacity) === 1 && style.transform === 'none' && style.animationName === 'none';
  }))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight * 1.5)).toBe(true);
  await page.mouse.move(190, 80);
  await page.mouse.wheel(0, 800);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(100);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
