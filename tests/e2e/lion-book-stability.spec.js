import { test, expect } from '@playwright/test';

async function view(page, locator) {
  await locator.scrollIntoViewIfNeeded();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function open(page, { intro = true, reduced = false } = {}) {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await page.addInitScript(() => { if (window === window.top) sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1'); });
  await page.goto('/');
  await view(page, page.locator('#homeLionBook'));
  const book = page.locator('.lion-book-experience');
  await expect(book).toHaveAttribute('data-book-ready', 'true');
  await view(page, page.locator('.lion-book-stage'));
  if (intro) await expect(book).toHaveAttribute('data-book-intro', 'done');
  return { book, frame: page.frameLocator('#homeLionBook iframe') };
}

async function state(frame) {
  return frame.locator('body').evaluate(() => ({
    index: idx, turning: !!turn, dragging: !!drag, spring: !!spring, framePending: raf !== null,
  }));
}

async function idle(book, frame, index) {
  await expect(book).toHaveAttribute('data-book-index', String(index));
  await expect(book).toHaveAttribute('data-book-turning', 'false');
  await expect.poll(() => state(frame)).toEqual({ index, turning: false, dragging: false, spring: false, framePending: false });
}

async function hold(page, frame, fraction = .16) {
  await view(page, page.locator('.lion-book-stage'));
  const box = await frame.locator('#sbBook').boundingBox();
  const x = box.x + box.width * .88;
  const y = box.y + box.height * .56;
  await page.mouse.move(x, y);
  await page.waitForTimeout(150);
  await page.mouse.down();
  await page.mouse.move(x - box.width * fraction, y, { steps: 12 });
  await expect(frame.locator('.curl .strip')).toHaveCount(18);
  expect((await state(frame)).dragging, 'pointer is held in an actual drag').toBe(true);
}

test('首次快翻等待书面可见，使用原七页卷曲回到序卷且滚动回来不会重播', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.addInitScript(() => { if (window === window.top) sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1'); });
  await page.goto('/');
  // Reveal the heading enough to load the module, leaving the actual book below view.
  await page.locator('#homeLionBook').evaluate(element => window.scrollTo({ top: scrollY + element.getBoundingClientRect().top - innerHeight + 150, behavior: 'instant' }));
  const book = page.locator('.lion-book-experience');
  const frame = page.frameLocator('#homeLionBook iframe');
  await expect(book).toHaveAttribute('data-book-ready', 'true');
  await page.waitForTimeout(500);
  await expect(book).toHaveAttribute('data-book-intro', 'pending');
  await frame.locator('body').evaluate(() => {
    window.seenBookPages = [idx];
    new MutationObserver(() => window.seenBookPages.push(idx)).observe(document.querySelector('#sbBook'), { childList: true });
  });
  await view(page, page.locator('.lion-book-stage'));
  await expect(book).toHaveAttribute('data-book-intro', 'playing');
  await expect(frame.locator('#sbWrap')).toHaveClass(/intro/);
  await expect(frame.locator('.curl .strip')).toHaveCount(18);
  await expect(book).toHaveAttribute('data-book-intro', 'done');
  expect(await frame.locator('body').evaluate(() => [...new Set(window.seenBookPages)].sort())).toEqual([0, 1, 2, 3, 4, 5, 6]);
  await page.mouse.move(20, 150);
  await idle(book, frame, 0);
  await view(page, page.locator('#homeCulture'));
  await view(page, page.locator('.lion-book-stage'));
  await page.waitForTimeout(500);
  await expect(book).toHaveAttribute('data-book-intro', 'done');
  await idle(book, frame, 0);
});

test('快翻中选择序卷立即归位，手动接管后没有旧动画再次翻页', async ({ page }) => {
  const { book, frame } = await open(page, { intro: false });
  await expect(book).toHaveAttribute('data-book-intro', 'playing');
  await view(page, book.locator('.lion-book-timeline'));
  await book.locator('[data-book-page="cover"]').click();
  await expect(book).toHaveAttribute('data-book-intro', 'done');
  await idle(book, frame, 0);
  await page.waitForTimeout(700);
  await idle(book, frame, 0);
  await book.locator('[data-book-page="formation"]').click();
  await idle(book, frame, 2);
});

test('快翻离开视野会保留进度并停止动画帧，回来接续完成而不重新开始', async ({ page }) => {
  const { book, frame } = await open(page, { intro: false });
  await expect(book).toHaveAttribute('data-book-intro', 'playing');
  await view(page, page.locator('#homeCulture'));
  await expect.poll(() => frame.locator('body').evaluate(() => raf)).toBeNull();
  const paused = await frame.locator('body').evaluate(() => ({ index: idx, progress: turn?.t, spring: !!spring }));
  expect(paused.spring).toBe(true);
  await page.waitForTimeout(600);
  expect(await frame.locator('body').evaluate(() => ({ index: idx, progress: turn?.t, spring: !!spring }))).toEqual(paused);
  await expect(book).toHaveAttribute('data-book-intro', 'playing');
  await view(page, page.locator('.lion-book-stage'));
  await expect(book).toHaveAttribute('data-book-intro', 'done');
  await page.mouse.move(20, 150);
  await idle(book, frame, 0);
});

test('连续选回当前页或远跳不会选错，也不会留下没有翻页的永久动画帧', async ({ page }) => {
  const { book, frame } = await open(page);
  await view(page, book.locator('.lion-book-timeline'));
  await book.locator('[data-book-page="origin"]').click();
  await page.waitForTimeout(35);
  await book.locator('[data-book-page="cover"]').click();
  await idle(book, frame, 0);
  await book.locator('[data-book-page="origin"]').click();
  await page.waitForTimeout(35);
  await book.locator('[data-book-page="martial"]').click();
  await idle(book, frame, 3);
  await book.locator('[data-book-page="martial"]').focus();
  for (let press = 0; press < 12; press += 1) await page.keyboard.press('ArrowRight');
  await idle(book, frame, 1);
});

test('书面已滚出视野时选择相邻年代仍立即更新文字与节点，且没有悬空动画', async ({ page }) => {
  const { book, frame } = await open(page);
  await book.locator('.lion-book-timeline').evaluate(element => window.scrollTo({ top: scrollY + element.getBoundingClientRect().top - 130, behavior: 'instant' }));
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await book.locator('[data-book-page="origin"]').click();
  await idle(book, frame, 1);
  await expect(book.locator('.lion-book-reading h3')).toHaveText('起源 · 瑞兽文化');
  await expect(book.locator('[aria-current="step"]')).toHaveAttribute('data-book-page', 'origin');
});

test('拖拽中失焦、指针取消与捕获丢失回到完整书页，之后仍可翻阅', async ({ page }) => {
  const { book, frame } = await open(page);
  for (const event of ['blur', 'pointercancel', 'lostpointercapture']) {
    await test.step(event, async () => {
      await hold(page, frame);
      await frame.locator('body').evaluate((element, type) => {
        if (type === 'blur') window.dispatchEvent(new Event('blur'));
        else document.querySelector('#sbStage').dispatchEvent(new PointerEvent(type, { pointerId: 1, bubbles: true }));
      }, event);
      expect(await state(frame), `${event} immediately clears the interrupted gesture`).toEqual({ index: 0, turning: false, dragging: false, spring: false, framePending: false });
      await page.mouse.move(20, 160);
      await page.mouse.up();
      await idle(book, frame, 0);
      await frame.locator('body').evaluate(() => window.dispatchEvent(new Event('focus')));
    });
  }
  await view(page, book.locator('.lion-book-timeline'));
  await book.locator('[data-book-page="origin"]').click();
  await idle(book, frame, 1);
});

test('实际纸面交互后移焦时间线仍能完成翻页，再回纸面可继续操作', async ({ page }) => {
  const { book, frame } = await open(page);
  await hold(page, frame, .58);
  await page.mouse.up();
  await idle(book, frame, 1);
  await frame.locator('.sb-next').focus();
  await page.keyboard.press('ArrowRight');
  await idle(book, frame, 2);
  await view(page, book.locator('.lion-book-timeline'));
  await book.locator('[data-book-page="martial"]').click();
  await idle(book, frame, 3);
  await hold(page, frame, .58);
  await page.mouse.up();
  await page.mouse.move(20, 150);
  await idle(book, frame, 4);
});

test('拖拽中改变窗口尺寸取消旧坐标手势，新的纸面尺寸和翻页仍正确', async ({ page }) => {
  const { book, frame } = await open(page);
  await hold(page, frame);
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.mouse.move(20, 160);
  await page.mouse.up();
  await idle(book, frame, 0);
  const widthDifference = await frame.locator('#sbBook').evaluate(element => Math.abs(element.clientWidth - parseFloat(document.querySelector('#sb3d').style.getPropertyValue('--bw'))));
  expect(widthDifference).toBeLessThan(1);
  await view(page, book.locator('.lion-book-timeline'));
  await book.locator('[data-book-page="origin"]').click();
  await idle(book, frame, 1);
});

test('运行中开启减少动态会结束在飞动画，后续静态翻阅且恢复偏好不重播开场', async ({ page }) => {
  const { book, frame } = await open(page);
  await view(page, book.locator('.lion-book-timeline'));
  await book.locator('[data-book-page="origin"]').click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await idle(book, frame, 1);
  await book.locator('[data-book-page="origin"]').focus();
  await page.keyboard.press('ArrowRight');
  await idle(book, frame, 2);
  await expect(frame.locator('.curl')).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.waitForTimeout(500);
  await expect(book).toHaveAttribute('data-book-intro', 'done');
  await idle(book, frame, 2);
});

test('书册上下透明留白不翻页，纸面仍可点击和拖动', async ({ page }) => {
  const { book, frame } = await open(page);
  const viewport = await page.locator('#homeLionBook iframe').boundingBox();
  await page.mouse.click(viewport.x + viewport.width * .8, viewport.y + 18);
  await page.mouse.move(20, 150);
  await idle(book, frame, 0);
  await hold(page, frame, .58);
  await page.mouse.up();
  await page.mouse.move(20, 150);
  await idle(book, frame, 1);
});

test('书下投影保留接触感，三种电脑尺寸的嵌入边缘均完全淡出', async ({ page }) => {
  const { frame } = await open(page, { reduced: true });
  await page.addStyleTag({ content: '.lion-book-section::before { visibility: hidden; }' });
  await frame.locator('body').evaluate(() => {
    const style = document.createElement('style');
    style.id = 'shadow-review'; style.textContent = '#sbBook { visibility:hidden; }'; document.head.appendChild(style);
  });
  const stage = page.locator('.lion-book-stage');
  for (const [width, height] of [[1366, 900], [1920, 1080], [2560, 1440]]) {
    await page.setViewportSize({ width, height });
    await stage.evaluate(element => window.scrollTo({ top: scrollY + element.getBoundingClientRect().top - 150, behavior: 'instant' }));
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const bottom = await frame.locator('#sbBook').evaluate(element => element.getBoundingClientRect().bottom - element.getBoundingClientRect().height * .218);
    const painted = (await stage.screenshot()).toString('base64');
    await frame.locator('body').evaluate(() => document.querySelectorAll('.sb-cast').forEach(element => { element.style.visibility = 'hidden'; }));
    const plain = (await stage.screenshot()).toString('base64');
    await frame.locator('body').evaluate(() => document.querySelectorAll('.sb-cast').forEach(element => { element.style.visibility = ''; }));
    const difference = await page.evaluate(async ({ painted, plain, bottom }) => {
      const decode = async source => {
        const image = new Image(); image.src = `data:image/png;base64,${source}`; await image.decode();
        const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
        return { pixels: context.getImageData(0, 0, canvas.width, canvas.height).data, width: canvas.width, height: canvas.height };
      };
      const [a, b] = await Promise.all([decode(painted), decode(plain)]);
      let edge = 0, belowPaper = 0;
      for (let y = 0; y < a.height; y += 1) for (let x = 0; x < a.width; x += 1) {
        const index = (y * a.width + x) * 4;
        const delta = Math.max(...[0, 1, 2].map(channel => Math.abs(a.pixels[index + channel] - b.pixels[index + channel])));
        if (x < 3 || y < 3 || x >= a.width - 3 || y >= a.height - 3) edge = Math.max(edge, delta);
        if (y > bottom + 2) belowPaper = Math.max(belowPaper, delta);
      }
      return { edge, belowPaper };
    }, { painted, plain, bottom });
    expect(difference.edge, `${width}px shadow must fade before the viewport boundary`).toBeLessThanOrEqual(1);
    expect(difference.belowPaper, `${width}px retains a visible shadow just below the paper`).toBeGreaterThan(1);
  }
});
