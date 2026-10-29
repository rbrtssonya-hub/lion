import { expect } from '@playwright/test';

export const actions = [
  { id: 'tanqing', name: '探青采青' },
  { id: 'doumao', name: '抖毛' },
  { id: 'tuqiu', name: '狮子吐球' },
  { id: 'meihuazhuang', name: '踩梅花桩' },
];
export const stage = page => page.locator('#chapterStage');
export const scene = page => stage(page).locator('canvas').first();
export const actionButton = (page, id) => stage(page).locator(`button[data-action-id="${id}"]`);
export const actionVideo = (page, id) => stage(page).locator(`video[data-action-id="${id}"]`);
export const jsonAttribute = async (locator, name) => JSON.parse(await locator.getAttribute(name) || 'null');

export async function prepare(page, { width = 1920, height = 1080, settings = {}, reducedMotion = 'no-preference' } = {}) {
  await page.setViewportSize({ width, height });
  await page.emulateMedia({ reducedMotion });
  await page.addInitScript(settings => {
    if (window !== window.top) return;
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    sessionStorage.setItem('nanfeng-lion:book-intro-seen:v1', '1');
    localStorage.setItem('nanfeng-lion:developer-settings:v1', JSON.stringify({ carouselAutoplay: false, pushPage: false, ...settings }));
  }, settings);
}

export async function openTheater(page, options = {}) {
  await prepare(page, options);
  await page.goto('/#/theater');
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 60_000 });
  await expect(stage(page)).toHaveAttribute('data-chapter', 'action');
  await expect(scene(page)).toBeVisible({ timeout: 45_000 });
  await expect(scene(page)).toHaveAttribute('data-active-screen', 'tanqing', { timeout: 45_000 });
  await expect.poll(async () => Number(await scene(page).getAttribute('data-rendered-frames')), { timeout: 45_000 }).toBeGreaterThan(0);
}

export async function selectAction(page, id) {
  await actionButton(page, id).click();
  await expect(scene(page)).toHaveAttribute('data-active-screen', id);
  await expect(actionButton(page, id)).toHaveAttribute('aria-pressed', 'true');
  await expect(scene(page)).toHaveAttribute('data-camera-state', 'idle');
}

// Read the browser-composited canvas, since a presented WebGL drawing buffer
// need not retain its pixels. This does not replace the scene or its media.
export async function canvasPixels(page, clip = null) {
  const png = await scene(page).screenshot();
  return page.evaluate(async ({ imageData, clip }) => {
    const image = new Image();
    image.src = imageData;
    await image.decode();
    const sample = document.createElement('canvas');
    sample.width = image.naturalWidth; sample.height = image.naturalHeight;
    const context = sample.getContext('2d'); context.drawImage(image, 0, 0);
    const width = sample.width, height = sample.height;
    const data = context.getImageData(0, 0, width, height).data;
    let bright = 0, colored = 0, count = 0, sum = 0;
    const bounds = clip || { left: 0, right: 1, top: 0, bottom: 1 };
    for (let y = Math.floor(height * bounds.top); y < height * bounds.bottom; y += 2) {
      for (let x = Math.floor(width * bounds.left); x < width * bounds.right; x += 2) {
        const index = (y * width + x) * 4;
        const rgb = [data[index], data[index + 1], data[index + 2]];
        const light = (rgb[0] + rgb[1] + rgb[2]) / 3;
        if (light > 50) bright += 1;
        if (Math.max(...rgb) - Math.min(...rgb) > 20) colored += 1;
        count += 1; sum += light;
      }
    }
    return { width, height, bright, colored, count, mean: sum / count };
  }, { imageData: 'data:image/png;base64,' + png.toString('base64'), clip });
}
