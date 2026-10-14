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

test('首页文化图鉴可以自然向下滚动，当前图片与来源可读', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  const culture = page.locator('#homeCulture');
  await expect(culture.getByRole('heading', { name: /一头醒狮，\s*一方风土/ })).toBeVisible();
  const stories = culture.locator('[data-culture-slide]');
  await expect(stories).toHaveCount(4);
  expect(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight * 1.5)).toBe(true);
  await expect(culture.locator('button')).toHaveCount(7);
  const first = stories.first();
  await page.mouse.move(960, 80);
  await page.mouse.wheel(0, 850);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(100);
  await expect(first).toHaveClass(/is-active/);
  await expect(first.locator('.home-culture-photo')).toHaveAttribute('alt', /\S/);
  await expect.poll(() => first.locator('.home-culture-photo').evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true);
  await expect(first.locator('.home-culture-credit a')).toHaveCount(2);
  await expect(first.locator('.home-culture-note')).not.toBeEmpty();
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'entry');
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('home-culture-scrolled.png'), fullPage: true });
});

test('首页文化图鉴会同步轮播图片、文字、署名与进度', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  const carousel = page.locator('#homeCulture');
  await expect(carousel).toHaveAttribute('data-culture-carousel', 'true');
  await expect(carousel.locator('[data-culture-slide].is-active')).toHaveAttribute('data-culture-id', 'living-tradition');
  await expect(carousel.locator('[data-culture-slide].is-active .home-culture-title')).toHaveText('一声锣鼓，唤醒岭南');
  await expect(carousel.locator('[data-culture-slide].is-active .home-culture-credit a')).toHaveCount(2);
  await expect(carousel.locator('.home-culture-progress > span:first-child')).toHaveText('01 / 04');
  await expect(carousel.getByRole('button', { name: '下一项' })).toBeVisible();
  await expect(carousel.getByRole('button', { name: '上一项' })).toBeVisible();
  await expect(carousel.getByRole('button', { name: '暂停自动播放' })).toBeVisible();

  await carousel.locator('.home-culture-carousel').scrollIntoViewIfNeeded();
  await page.mouse.move(960, 20);

  await expect.poll(() => carousel.locator('[data-culture-slide].is-active').getAttribute('data-culture-id'), { timeout: 9_000 }).toBe('lion-head-craft');
  await expect(carousel.locator('[data-culture-slide].is-active .home-culture-title')).toHaveText('一扎一画，狮有了神采');
  await expect(carousel.locator('.home-culture-progress > span:first-child')).toHaveText('02 / 04');
  await expect(carousel.locator('[data-culture-slide].is-active .home-culture-credit a')).toHaveCount(2);
  await expect(carousel.locator('[data-culture-slide].is-active .home-culture-photo')).toHaveAttribute('alt', /狮头/);
});

test('纵深照片保留实际画面、首尾循环和局部键盘控制，滚轮仍能离开图鉴', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.addInitScript(() => sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1'));
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  const carousel = page.locator('#homeCulture');
  const gallery = carousel.locator('.culture-depth-gallery');
  await gallery.scrollIntoViewIfNeeded();
  await expect(gallery).toHaveAttribute('data-depth-state', 'ready');
  await carousel.getByRole('button', { name: '暂停自动播放' }).click();
  await expect(carousel.locator('canvas')).toHaveCount(1);
  const photoPixels = await gallery.locator('canvas').evaluate(canvas => new Promise(resolve => {
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    let attempts = 0;
    const sample = () => {
      const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
      gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      let visible = 0;
      let rear = 0;
      for (let y = 0; y < gl.drawingBufferHeight; y += 4) {
        for (let x = 0; x < gl.drawingBufferWidth; x += 4) {
          if (pixels[(y * gl.drawingBufferWidth + x) * 4 + 3] > 8) {
            visible++;
            if (x > gl.drawingBufferWidth * .82) rear++;
          }
        }
      }
      if (visible > 10_000 || attempts++ > 90) resolve({ visible, rear });
      else requestAnimationFrame(sample);
    };
    const bounds = canvas.getBoundingClientRect();
    canvas.parentElement.dispatchEvent(new PointerEvent('pointermove', { clientX: bounds.left + 30, clientY: bounds.top + 50 }));
    requestAnimationFrame(sample);
  }));
  expect(photoPixels.visible).toBeGreaterThan(10_000);
  expect(photoPixels.rear).toBeGreaterThan(100);
  await carousel.getByRole('button', { name: '上一项' }).click();
  await expect(carousel).toHaveAttribute('data-culture-index', '3');
  await expect(carousel.locator('.is-active .home-culture-title')).toHaveText('两个人，一头狮，一份默契');
  await carousel.getByRole('button', { name: '下一项' }).click();
  await expect(carousel).toHaveAttribute('data-culture-index', '0');
  await carousel.getByRole('tab', { name: /第 1 项/ }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(carousel).toHaveAttribute('data-culture-index', '1');
  await page.keyboard.press('End');
  await expect(carousel).toHaveAttribute('data-culture-index', '3');
  await page.keyboard.press('Home');
  await expect(carousel).toHaveAttribute('data-culture-index', '0');
  const box = await gallery.boundingBox();
  await page.mouse.move(box.x + box.width * .5, box.y + box.height * .5);
  const before = await page.evaluate(() => scrollY);
  await page.mouse.wheel(0, -230);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(before - 80);
  await expect(carousel).toHaveAttribute('data-culture-index', '0');
  expect(errors).toEqual([]);
});

test('WebGL不可用时保留照片、署名与手动轮播', async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (/webgl/.test(type)) return null;
      return getContext.call(this, type, ...args);
    };
  });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  const carousel = page.locator('#homeCulture');
  const gallery = carousel.locator('.culture-depth-gallery');
  await gallery.scrollIntoViewIfNeeded();
  await expect(gallery).toHaveAttribute('data-depth-state', 'fallback');
  await expect(carousel.locator('.is-active .home-culture-photo')).toBeVisible();
  await carousel.getByRole('button', { name: '下一项' }).click();
  await expect(carousel.locator('.is-active .home-culture-photo')).toHaveAttribute('alt', /狮头/);
  await expect(carousel.locator('.is-active .home-culture-credit a')).toHaveCount(2);
  expect(errors).toEqual([]);
});

test('纵深画廊随电脑窗口调整，动态偏好变化及离页重入能释放画布', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1'));
  await page.goto('/');
  const carousel = page.locator('#homeCulture');
  const gallery = carousel.locator('.culture-depth-gallery');
  await gallery.scrollIntoViewIfNeeded();
  await expect(gallery).toHaveAttribute('data-depth-state', 'ready');
  for (const [width, height] of [[1366, 768], [1920, 1080], [2560, 1440]]) {
    await page.setViewportSize({ width, height });
    await gallery.scrollIntoViewIfNeeded();
    await expect.poll(() => gallery.locator('canvas').evaluate(canvas => Math.abs(canvas.width / Math.min(devicePixelRatio, 1.75) - canvas.clientWidth) < 2)).toBe(true);
    const bounds = await carousel.locator('.is-active').evaluate(slide => {
      const canvas = slide.parentElement.querySelector('canvas').getBoundingClientRect();
      const copy = slide.querySelector('.home-culture-copy').getBoundingClientRect();
      return { imageRight: canvas.right, copyLeft: copy.left, overflow: document.documentElement.scrollWidth > innerWidth };
    });
    expect(bounds.imageRight).toBeLessThanOrEqual(bounds.copyLeft);
    expect(bounds.overflow).toBe(false);
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(gallery).toHaveAttribute('data-depth-state', 'static');
  await expect(carousel.locator('.is-active .home-culture-photo')).toBeVisible();
  await expect(carousel.getByRole('button', { name: '开始自动播放' })).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(gallery).toHaveAttribute('data-depth-state', 'ready');
  const oldCanvas = await gallery.locator('canvas').evaluateHandle(canvas => canvas);
  await page.getByRole('navigation', { name: '作品章节导航' }).getByRole('button', { name: '动作', exact: true }).click();
  await expect(page.locator('.culture-depth-canvas')).toHaveCount(0);
  await expect.poll(() => oldCanvas.evaluate(canvas => !canvas.isConnected && (canvas.getContext('webgl2') || canvas.getContext('webgl')).isContextLost())).toBe(true);
  await page.getByRole('navigation', { name: '作品章节导航' }).getByRole('button', { name: '首页', exact: true }).click();
  await gallery.scrollIntoViewIfNeeded();
  await expect(gallery).toHaveAttribute('data-depth-state', 'ready');
  await expect(carousel.locator('canvas')).toHaveCount(1);
});

test('首页文化图鉴支持手动切换，并在悬停与键盘聚焦时暂停', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  const carousel = page.locator('#homeCulture');
  const next = carousel.getByRole('button', { name: '下一项' });
  await next.click();
  await expect(carousel.locator('[data-culture-slide].is-active')).toHaveAttribute('data-culture-id', 'lion-head-craft');
  await expect(carousel.locator('[aria-live]')).toHaveAttribute('aria-live', 'polite');
  await carousel.getByRole('button', { name: '暂停自动播放' }).click();
  await expect(carousel.getByRole('button', { name: '开始自动播放' })).toBeVisible();
  await next.click();
  await expect(carousel.locator('[data-culture-slide].is-active')).toHaveAttribute('data-culture-id', 'cai-qing');
  await carousel.getByRole('button', { name: '开始自动播放' }).click();
  await carousel.hover();
  const hoveredId = await carousel.locator('[data-culture-slide].is-active').getAttribute('data-culture-id');
  await page.waitForTimeout(6_300);
  await expect(carousel.locator('[data-culture-slide].is-active')).toHaveAttribute('data-culture-id', hoveredId);
  await next.focus();
  await page.waitForTimeout(6_300);
  await expect(carousel.locator('[data-culture-slide].is-active')).toHaveAttribute('data-culture-id', hoveredId);
});

test('减少动态效果时文化图鉴不自动切换但仍支持手动操作', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const carousel = page.locator('#homeCulture');
  await expect(carousel.locator('[data-culture-slide].is-active')).toHaveAttribute('data-culture-id', 'living-tradition');
  await page.waitForTimeout(6_300);
  await expect(carousel.locator('[data-culture-slide].is-active')).toHaveAttribute('data-culture-id', 'living-tradition');
  await carousel.getByRole('button', { name: '下一项' }).click();
  await expect(carousel.locator('[data-culture-slide].is-active')).toHaveAttribute('data-culture-id', 'lion-head-craft');
  await expect(carousel.getByRole('button', { name: '开始自动播放' })).toBeVisible();
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
