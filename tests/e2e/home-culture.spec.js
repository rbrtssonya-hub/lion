import { test, expect } from '@playwright/test';

test('探索更多保留透明金色书法与电脑端居中对齐，点击进入结构章节', async ({ page }) => {
  await page.addInitScript(() => { if (window === window.top) sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1'); });
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

test('首页向下了解文化入口滚动衔接处史册并保持首页地址', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  const initialUrl = page.url();
  await page.getByRole('button', { name: '向下了解醒狮文化' }).click();
  await expect(page.locator('#homeLionBook')).toBeInViewport();
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(100);
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'entry');
  expect(page.url()).toBe(initialUrl);
});

async function openCulture(page, settings = {}) {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.addInitScript(value => {
    if (window !== window.top) return;
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

test('照片暖色氛围自然淡出，电脑尺寸下四周没有矩形色带', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const { gallery } = await openCulture(page, { carouselAutoplay: false });
  // Resolve the preceding lazy book before comparing a fixed viewport clip.
  // Its placeholder replacement would otherwise move the paper between shots.
  await page.locator('#homeLionBook').scrollIntoViewIfNeeded();
  await expect(page.locator('.lion-book-experience')).toHaveAttribute('data-book-ready', 'true');
  await gallery.scrollIntoViewIfNeeded();
  // Compare the actual rendered decoration against the same paper beneath it.
  // Hide foreground content and paper pattern so they cannot conceal a clipped
  // boundary or introduce unrelated raster differences between screenshots.
  await page.addStyleTag({ content: '#homeCulture .home-culture-slide, #homeCulture .culture-depth-label, #homeCulture .culture-depth-axis, #homeCulture::before { visibility: hidden; } #homeCulture { background-image: none; }' });
  await page.evaluate(() => document.fonts.ready);
  const atmosphere = gallery.locator('.culture-depth-atmosphere');
  for (const [width, height] of [[1366, 900], [1920, 1080], [2560, 1440]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await atmosphere.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const box = await atmosphere.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(box.y + box.height).toBeLessThanOrEqual(height);
    const clip = { x: Math.floor(box.x), y: Math.floor(box.y), width: Math.ceil(box.x + box.width) - Math.floor(box.x), height: Math.ceil(box.y + box.height) - Math.floor(box.y) };
    const painted = (await page.screenshot({ clip })).toString('base64');
    await atmosphere.evaluate(element => { element.style.visibility = 'hidden'; });
    const paper = (await page.screenshot({ clip })).toString('base64');
    await atmosphere.evaluate(element => { element.style.visibility = ''; });
    const pixels = await page.evaluate(async ({ painted, paper }) => {
      const decode = async data => {
        const image = new Image();
        image.src = `data:image/png;base64,${data}`;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0);
        return { data: context.getImageData(0, 0, canvas.width, canvas.height).data, width: canvas.width, height: canvas.height };
      };
      const [paint, plain] = await Promise.all([decode(painted), decode(paper)]);
      let edgeDifference = 0;
      let interiorDifference = 0;
      let warmDifference = 0;
      for (let y = 0; y < paint.height; y += 1) {
        for (let x = 0; x < paint.width; x += 1) {
          const index = (y * paint.width + x) * 4;
          const difference = Math.max(...[0, 1, 2].map(channel => Math.abs(paint.data[index + channel] - plain.data[index + channel])));
          if (x < 2 || y < 2 || x >= paint.width - 2 || y >= paint.height - 2) edgeDifference = Math.max(edgeDifference, difference);
          else {
            interiorDifference = Math.max(interiorDifference, difference);
            warmDifference = Math.max(warmDifference, paint.data[index] - paint.data[index + 2] - plain.data[index] + plain.data[index + 2]);
          }
        }
      }
      return { edgeDifference, interiorDifference, warmDifference };
    }, { painted, paper });
    expect(pixels.edgeDifference, `${width}px decoration must reach transparency before its box edge`).toBeLessThanOrEqual(1);
    expect(pixels.interiorDifference, `${width}px retains the visible atmosphere`).toBeGreaterThan(5);
    expect(pixels.warmDifference, `${width}px retains the warm paper tint`).toBeGreaterThan(3);
  }
});

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

test('悬停后滚动使照片移离静止指针时自动解除暂停', async ({ page }) => {
  const { carousel, gallery, action } = await openCulture(page, { carouselInterval: 2, carouselResumeDelay: 1 });
  await expect(gallery).toHaveAttribute('data-depth-state', 'ready');
  const photo = await action.boundingBox();
  const point = { x: photo.x + photo.width / 2, y: photo.y + 15 };
  await page.mouse.move(point.x, point.y);
  await expect(carousel).toHaveAttribute('data-culture-status', 'focused');
  await page.mouse.wheel(0, -65);
  // The pointer remains inside the canvas, so a whole-gallery pointerleave
  // cannot release this pause. The photograph itself has moved out from it.
  await expect.poll(async () => (await action.boundingBox()).y > point.y + 20).toBe(true);
  const bounds = await gallery.boundingBox();
  expect(point.y).toBeGreaterThan(bounds.y);
  await expect(carousel).toHaveAttribute('data-culture-focused', 'false');
  await expect(carousel).toHaveAttribute('data-culture-status', 'playing', { timeout: 2000 });
  await expect(carousel).toHaveAttribute('data-culture-index', '1', { timeout: 3000 });
});

test('自动切图经过静止指针时不会自行获取悬停并停播', async ({ page }) => {
  const { carousel, gallery, action } = await openCulture(page, {
    carouselInterval: 2, carouselResumeDelay: 1, carouselTransitionDuration: 300,
  });
  await expect(gallery).toHaveAttribute('data-depth-state', 'ready');
  const center = await photoPoint(gallery);
  await page.mouse.click(center.x, center.y);
  await page.mouse.click(center.x, center.y);
  await expect(carousel).toHaveAttribute('data-culture-index', '2');
  await page.waitForTimeout(650);
  const narrowPhoto = await action.boundingBox();
  // The third photograph is narrower. The next, wider photo will slide under
  // this stationary pointer without any new user input.
  await page.mouse.move(narrowPhoto.x - 20, center.y);
  await expect(carousel).toHaveAttribute('data-culture-focused', 'false');
  await expect(carousel).toHaveAttribute('data-culture-index', '3', { timeout: 4000 });
  await page.waitForTimeout(500);
  const widePhoto = await action.boundingBox();
  expect(narrowPhoto.x - 20).toBeGreaterThan(widePhoto.x);
  await expect(carousel).toHaveAttribute('data-culture-focused', 'false');
  await expect(carousel).toHaveAttribute('data-culture-index', '0', { timeout: 3000 });
});

test('照片加载期间悬停，画布就绪后移开仍能恢复自动轮播', async ({ page }) => {
  let releaseModule;
  const moduleGate = new Promise(resolve => { releaseModule = resolve; });
  await page.route(/\/(?:src\/services\/cultureDepthGallery\.js|assets\/cultureDepthGallery-[^/]+\.js)(?:\?|$)/, async route => {
    await moduleGate;
    await route.continue();
  });
  try {
    const { carousel, gallery } = await openCulture(page, { carouselInterval: 2, carouselResumeDelay: 1 });
    await expect(gallery).toHaveAttribute('data-depth-state', 'loading');
    const point = await photoPoint(gallery);
    await page.mouse.move(point.x, point.y);
    await expect(carousel).toHaveAttribute('data-culture-focused', 'true');
    releaseModule();
    await expect(gallery).toHaveAttribute('data-depth-state', 'ready');
    // A valid hover survives the handoff; loading must not cancel the user's
    // current interaction merely to avoid retaining a stale pause on exit.
    await expect(carousel).toHaveAttribute('data-culture-focused', 'true');
    await page.waitForTimeout(2300);
    await expect(carousel).toHaveAttribute('data-culture-index', '0');
    await page.mouse.move(1800, point.y);
    await expect(carousel).toHaveAttribute('data-culture-focused', 'false');
    await expect(carousel).toHaveAttribute('data-culture-status', 'playing', { timeout: 2000 });
    await expect(carousel).toHaveAttribute('data-culture-index', '1', { timeout: 3000 });
  } finally {
    releaseModule();
  }
});

test('加载交接期间新的指针离开不会被较旧坐标覆盖', async ({ page }) => {
  let releaseModule;
  const moduleGate = new Promise(resolve => { releaseModule = resolve; });
  await page.route(/\/(?:src\/services\/cultureDepthGallery\.js|assets\/cultureDepthGallery-[^/]+\.js)(?:\?|$)/, async route => {
    await moduleGate;
    await route.continue();
  });
  try {
    const { carousel, gallery } = await openCulture(page, { carouselInterval: 2, carouselResumeDelay: 1 });
    await expect(gallery).toHaveAttribute('data-depth-state', 'loading');
    const point = await photoPoint(gallery);
    await page.mouse.move(point.x, point.y);
    await expect(carousel).toHaveAttribute('data-culture-focused', 'true');
    await gallery.evaluate(element => {
      // Inject a newer boundary event at the exact DOM/effect handoff, which
      // physical input cannot reliably time. The engine must not replay the
      // older loading pointer afterward and reacquire a stale pause.
      const observer = new MutationObserver(() => {
        if (element.dataset.depthState !== 'ready') return;
        observer.disconnect();
        const event = { bubbles: true, clientX: 1800, clientY: 600, relatedTarget: document.body };
        element.dispatchEvent(new PointerEvent('pointerout', event));
        element.dispatchEvent(new PointerEvent('pointerleave', event));
      });
      observer.observe(element, { attributes: true, attributeFilter: ['data-depth-state'] });
    });
    releaseModule();
    await expect(gallery).toHaveAttribute('data-depth-state', 'ready');
    await expect(carousel).toHaveAttribute('data-culture-focused', 'false');
    await expect(carousel).toHaveAttribute('data-culture-index', '1', { timeout: 4000 });
  } finally {
    releaseModule();
  }
});

test('窗口高度变化使静止指针移出视口后释放照片暂停', async ({ page }) => {
  const { carousel, gallery } = await openCulture(page, { carouselInterval: 2, carouselResumeDelay: 1 });
  await expect(gallery).toHaveAttribute('data-depth-state', 'ready');
  const point = await photoPoint(gallery);
  await page.mouse.move(point.x, point.y);
  await expect(carousel).toHaveAttribute('data-culture-focused', 'true');
  const before = await gallery.boundingBox();
  await page.setViewportSize({ width: 1920, height: Math.floor(point.y - 40) });
  const after = await gallery.boundingBox();
  // This height-only resize does not resize the gallery, so ResizeObserver
  // alone cannot invalidate the stored pointer's viewport coordinates.
  expect(after.width).toBeCloseTo(before.width, 1);
  expect(after.height).toBeCloseTo(before.height, 1);
  await expect(carousel).toHaveAttribute('data-culture-focused', 'false');
  await expect(carousel).toHaveAttribute('data-culture-status', 'playing', { timeout: 2000 });
  await expect(carousel).toHaveAttribute('data-culture-index', '1', { timeout: 3000 });
});

test('窗口失焦和指针取消事件清理悬停，返回后仍可再次聚焦和自动恢复', async ({ page }) => {
  const { carousel, gallery } = await openCulture(page, { carouselInterval: 2, carouselResumeDelay: 1 });
  await expect(gallery).toHaveAttribute('data-depth-state', 'ready');
  const point = await photoPoint(gallery);
  // Dispatch lifecycle events explicitly: headless bringToFront does not
  // reliably change OS window focus or document visibility.
  for (const [index, type] of ['blur', 'pointercancel'].entries()) {
    await page.mouse.move(point.x + index, point.y);
    await expect(carousel).toHaveAttribute('data-culture-focused', 'true');
    await page.evaluate(eventType => window.dispatchEvent(new Event(eventType)), type);
    await expect(carousel).toHaveAttribute('data-culture-focused', 'false');
    await expect(carousel).toHaveAttribute('data-culture-status', 'playing', { timeout: 2000 });
  }
  await expect(carousel).toHaveAttribute('data-culture-index', '1', { timeout: 3000 });
});

test('连续三个完整自动循环保持图文同步，滚出后返回仍继续播放', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const { carousel, gallery } = await openCulture(page, { carouselInterval: 2, carouselTransitionDuration: 300 });
  await expect(gallery).toHaveAttribute('data-depth-state', 'ready');
  await page.mouse.move(1800, 600);
  const ids = ['living-tradition', 'lion-head-craft', 'cai-qing', 'shared-rhythm'];
  const canvas = gallery.locator('canvas');
  let previousFrame;
  for (let step = 1; step <= 12; step += 1) {
    const index = step % ids.length;
    await expect(carousel).toHaveAttribute('data-culture-index', String(index), { timeout: 3200 });
    await expect(carousel.locator('.is-active')).toHaveAttribute('data-culture-id', ids[index]);
    await expect(carousel).toHaveAttribute('data-culture-status', 'playing');
    await page.waitForTimeout(450);
    const frame = await canvas.screenshot();
    if (previousFrame) expect(frame.equals(previousFrame)).toBe(false);
    previousFrame = frame;
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await expect(carousel).toHaveAttribute('data-culture-status', 'offscreen');
  const pausedIndex = await carousel.getAttribute('data-culture-index');
  await page.waitForTimeout(2300);
  await expect(carousel).toHaveAttribute('data-culture-index', pausedIndex);
  await gallery.scrollIntoViewIfNeeded();
  await expect(carousel).toHaveAttribute('data-culture-status', 'playing');
  await expect(carousel).toHaveAttribute('data-culture-index', String((Number(pausedIndex) + 1) % 4), { timeout: 3200 });
  expect(errors).toEqual([]);
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
