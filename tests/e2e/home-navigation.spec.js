import { test, expect } from '@playwright/test';
import { assetPaths } from '../../src/config/assetPaths.js';

const routes = [['entry', '首页'], ['model', '结构'], ['action', '动作'], ['state', '神态']];
const removedNavigation = '.entry-chapter-nav, .entry-bottom-nav, .entry-bottom-item, .entry-nav-shell, .entry-nav-ribbon, .chapter-rail, .entry-dialog-backdrop';
const iconRed = 'rgb(212, 56, 42)';

async function expectRedNavigationIcons(page) {
  await expect.poll(() => page.locator('.site-nav-icon').evaluateAll(icons => icons.map(icon => ({
    color: getComputedStyle(icon).color,
    stroke: getComputedStyle(icon.querySelector('svg')).stroke,
  })))).toEqual(Array.from({ length: 5 }, () => ({ color: iconRed, stroke: iconRed })));
}

async function armNativeNavigationSampling(page, duration) {
  await page.evaluate(duration => {
    window.nativeNavigationSamples = new Promise(resolve => {
      window.addEventListener('hashchange', () => {
        const icon = document.querySelector('.site-nav-icon');
        const read = () => {
          const box = icon.getBoundingClientRect();
          return {
            x: box.left + box.width / 2, y: box.top + box.height / 2,
            color: getComputedStyle(icon).color,
            running: icon.getAnimations().some(animation => animation.playState === 'running'),
          };
        };
        const initial = read();
        const samples = [];
        const started = performance.now();
        const sample = now => {
          samples.push({ time: now - started, ...read() });
          if (now - started < duration + 180) requestAnimationFrame(sample);
          else resolve({ initial, samples });
        };
        requestAnimationFrame(sample);
      }, { capture: true, once: true });
    });
  }, duration);
}

function expectNativeNavigationMotion(motion, duration, direction) {
  expect(motion.samples.length).toBeGreaterThan(15);
  const distance = motion.samples.at(-1).x - motion.initial.x;
  expect(distance * direction).toBeGreaterThan(300);
  const middle = motion.samples.filter(sample => sample.time > duration * .15 && sample.time < duration * .85);
  expect(middle.some(sample => {
    const progress = (sample.x - motion.initial.x) / distance;
    return progress > .05 && progress < .95 && sample.running;
  })).toBe(true);
  expect(Math.max(...middle.map(sample => Math.abs((sample.x - motion.initial.x) / distance - sample.time / duration)))).toBeGreaterThan(.12);
  expect(Math.max(...motion.samples.map(sample => Math.abs(sample.y - motion.initial.y)))).toBeLessThan(2);
  expect([...new Set([motion.initial, ...motion.samples].map(sample => sample.color))]).toEqual([iconRed]);
}

async function expectCompleteDesktopNavigation(page) {
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(() => page.locator('.site-navigation').evaluate(navigation => {
    const violations = [];
    const requested = getComputedStyle(navigation.closest('.site-shell'));
    const titleSize = parseFloat(requested.getPropertyValue('--nav-font-size'));
    const helperSize = parseFloat(requested.getPropertyValue('--nav-helper-font-size'));
    const pageBounds = navigation.closest('.site-page').getBoundingClientRect();
    const headerBounds = navigation.closest('.site-header').getBoundingClientRect();
    const buttons = [...navigation.querySelectorAll('.site-nav-item')];
    const firstBounds = buttons[0].getBoundingClientRect();
    for (const button of buttons) {
      const bounds = button.getBoundingClientRect();
      const label = button.querySelector('strong').textContent;
      const parts = ['strong', '.site-nav-description'].map(selector => {
        const element = button.querySelector(selector);
        const style = getComputedStyle(element);
        const range = document.createRange();
        range.selectNodeContents(element);
        const text = range.getBoundingClientRect();
        // A zero-height inline box sits on the text baseline at either font size.
        const marker = document.createElement('span');
        marker.style.cssText = 'display:inline-block;width:0;height:0;margin:0;padding:0;vertical-align:baseline';
        element.append(marker);
        const baseline = marker.getBoundingClientRect().top;
        marker.remove();
        return { element, style, text, baseline };
      });
      if (Math.abs(bounds.top - firstBounds.top) > 1 || Math.abs(bounds.bottom - firstBounds.bottom) > 1) {
        violations.push(`${label}: navigation buttons wrap onto separate rows`);
      }
      if (bounds.left < pageBounds.left - 1 || bounds.right > pageBounds.right + 1) {
        violations.push(`${label}: button extends beyond the available page`);
      }
      const iconBounds = button.querySelector('.site-nav-icon').getBoundingClientRect();
      if (getComputedStyle(button.querySelector('.site-nav-icon')).color !== 'rgb(212, 56, 42)'
        || getComputedStyle(button.querySelector('.site-nav-icon svg')).stroke !== 'rgb(212, 56, 42)') {
        violations.push(`${label}: the expanded icon lost its red color`);
      }
      if (bounds.top < headerBounds.top - 1 || bounds.bottom > headerBounds.bottom + 1
        || iconBounds.top < headerBounds.top - 1 || iconBounds.bottom > headerBounds.bottom + 1) {
        violations.push(`${label}: button or icon exceeds the header height`);
      }
      for (const [index, { element, style, text }] of parts.entries()) {
        const part = element.textContent;
        if (style.display === 'none' || style.visibility !== 'visible' || Number(style.opacity) === 0 || text.width <= 0) {
          violations.push(`${label}: ${part} is hidden`);
        }
        if (style.whiteSpace !== 'nowrap' || style.textOverflow === 'ellipsis') {
          violations.push(`${label}: ${part} can wrap or be abbreviated`);
        }
        if (element.scrollWidth > element.clientWidth + 1 || text.left < bounds.left - 1 || text.right > bounds.right + 1) {
          violations.push(`${label}: ${part} is clipped outside its button`);
        }
        if (text.top < bounds.top - 1 || text.bottom > bounds.bottom + 1) {
          violations.push(`${label}: ${part} is clipped vertically`);
        }
        if (style.fontFamily !== parts[1].style.fontFamily) {
          violations.push(`${label}: ${part} lost the navigation font`);
        }
        const maximum = index === 0 ? titleSize : helperSize;
        if (parseFloat(style.fontSize) <= 0 || parseFloat(style.fontSize) > maximum + .02) {
          violations.push(`${label}: ${part} exceeds its requested typography (${style.fontSize})`);
        }
      }
      if (Math.abs(parts[0].baseline - parts[1].baseline) > 1) {
        violations.push(`${label}: the title and helper are not on one baseline`);
      }
      if (Math.abs(parseFloat(parts[1].style.fontSize) / parseFloat(parts[0].style.fontSize) - helperSize / titleSize) > .002) {
        violations.push(`${label}: fitting changed the requested title/helper size ratio`);
      }
      if (parts[0].text.right > parts[1].text.left + 1) {
        violations.push(`${label}: adjacent text overlaps`);
      }
    }
    if (document.documentElement.scrollWidth > innerWidth) violations.push('The document overflows horizontally');
    return violations;
  }), { message: 'All five navigation items must show their complete text on one line' }).toEqual([]);
}

async function editNavigationParameter(page, label, value) {
  const panel = page.getByRole('region', { name: '开发者参数设置' });
  const tabName = label === '设置面板宽度' ? '布局' : label.includes('动画') || label.startsWith('紧凑') ? '动画' : '导航';
  await panel.getByRole('tab', { name: tabName, exact: true }).click();
  const input = panel
    .getByRole('spinbutton', { name: `${label}数值`, exact: true });
  await input.fill(String(value));
  await input.press('Tab');
  await expect(input).toHaveValue(String(value));
}

async function expectCompactDesktopNavigation(page, route) {
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', route);
  const navigation = page.locator('.site-navigation');
  for (const [chapter, label] of routes) {
    await expect(navigation.locator(`[data-route="${chapter}"]`)).toHaveAccessibleName(label);
  }
  for (const copy of await navigation.locator('.site-nav-copy').all()) await expect(copy).toBeHidden();
  await expect.poll(() => navigation.evaluate((element) => {
    const violations = [];
    const page = element.closest('.site-page').getBoundingClientRect();
    const header = element.closest('.site-header').getBoundingClientRect();
    const brand = element.closest('.site-header').querySelector('.site-brand').getBoundingClientRect();
    const nav = element.getBoundingClientRect();
    const buttons = [...element.querySelectorAll('.site-nav-item')];
    const firstIcon = buttons[0].querySelector('.site-nav-icon').getBoundingClientRect();
    const sharesBrandRow = nav.top < brand.bottom - 1 && nav.bottom > brand.top + 1;
    const overlapsBrand = sharesBrandRow ? nav.left < brand.right - 1 : nav.top < brand.bottom - 1;
    if (overlapsBrand || nav.right > page.right - 15 || nav.width > page.width * .6) {
      violations.push('The icon group is not compact and aligned to the right of the brand');
    }
    let previousRight = nav.left;
    for (const button of buttons) {
      const bounds = button.getBoundingClientRect();
      const icon = button.querySelector('.site-nav-icon').getBoundingClientRect();
      if (getComputedStyle(button.querySelector('.site-nav-icon')).color !== 'rgb(212, 56, 42)'
        || getComputedStyle(button.querySelector('.site-nav-icon svg')).stroke !== 'rgb(212, 56, 42)') {
        violations.push('A compact icon lost its red color');
      }
      if (bounds.left < previousRight - 1 || bounds.right > nav.right + 1) violations.push('Icon buttons overlap or exceed their group');
      if (icon.width <= 0 || icon.left < bounds.left - 1 || icon.right > bounds.right + 1) violations.push('An icon is hidden or clipped');
      if (icon.top < header.top - 1 || icon.bottom > header.bottom + 1) violations.push('An icon exceeds the header vertically');
      if (Math.abs((icon.top + icon.bottom) / 2 - (firstIcon.top + firstIcon.bottom) / 2) > 1) violations.push('Icons are not on one horizontal line');
      previousRight = bounds.right;
      const underline = getComputedStyle(button.querySelector('.site-nav-icon'), '::after');
      const scale = underline.transform === 'none' ? 1 : new DOMMatrix(underline.transform).a;
      if (button.getAttribute('aria-current') === 'page') {
        const underlineTop = icon.bottom - parseFloat(underline.bottom) - parseFloat(underline.height);
        if (scale < .99 || parseFloat(underline.height) < 1 || parseFloat(underline.width) <= 0 || underlineTop < icon.bottom - 1
          || underline.backgroundColor !== 'rgb(212, 56, 42)') {
          violations.push('The current chapter lacks a visible line below its icon');
        }
      } else if (button.dataset.route && scale > .01) {
        violations.push('A noncurrent chapter has an active underline');
      }
    }
    if (document.documentElement.scrollWidth > innerWidth) violations.push('The document overflows horizontally');
    return violations;
  }), { message: 'Chapter navigation must settle into one compact, usable icon row at the right' }).toEqual([]);
}

test('四页共用顶部五项导航，旧上下导航及搜索菜单已移除', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  const navigation = page.getByRole('navigation', { name: '作品章节导航', exact: true });
  for (const [route, label] of routes) {
    await navigation.locator(`[data-route="${route}"]`).click();
    await expect(page.locator('#react-app')).toHaveAttribute('data-route', route);
    await expect(page.locator('.site-header')).toHaveCount(1);
    await expect(navigation).toHaveCount(1);
    await expect(navigation.locator('.site-nav-item')).toHaveCount(5);
    await expect(navigation.locator('.site-nav-heading strong')).toHaveText([...routes.map(([, title]) => title), '设置']);
    await expect(navigation.locator('.site-nav-heading small')).toHaveCount(0);
    await expect(navigation).not.toContainText(/\d/);
    await expect(navigation.locator('[aria-current="page"]')).toHaveCount(1);
    await expect(navigation.locator('[aria-current="page"] .site-nav-heading strong')).toHaveText(label);
    await expect(navigation.locator(`[data-route="${route}"]`)).toHaveAccessibleName(label);
    await expect(navigation.locator('[data-action="settings"]')).toHaveAttribute('aria-expanded', 'false');
    await expect(navigation.locator('.site-nav-icon svg')).toHaveCount(5);
    await expect(navigation.locator('.site-nav-icon svg path')).toHaveCount(5);
    await expect(navigation.locator('[data-route="action"] .site-nav-icon svg path')).toHaveAttribute('d', 'M12 15 8 12l2-5 5 1 3-4 5 2 1 6-4 5-7-2ZM14 8h1M10 12h6M20 16l9 8 7 9 4 9-4 2-5-8-7-5-3 4-5-2 4-6-5-5-3 2-7-4 1-4 6 2 1-4M28 24c6 0 8-4 7-8 5 0 5 8 0 12M25 31l-3 9-6 3-2-3 5-3 1-5');
    await expect(navigation.locator('img')).toHaveCount(0);
    await expect(navigation.locator('[data-route="intro"], [data-route="structure"], [data-route="score"]')).toHaveCount(0);
    await expect(page.locator(removedNavigation)).toHaveCount(0);
    await expect(page.getByRole('button', { name: '搜索章节', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '打开章节菜单', exact: true })).toHaveCount(0);
    if (route === 'entry') await expectCompleteDesktopNavigation(page);
    else await expectCompactDesktopNavigation(page, route);
  }
});

test('桌面品牌居中对齐，导航加载毛笔字体且辅助文字较小并完整排成一行', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const fontResponses = [];
  page.on('response', response => {
    if (response.url().endsWith(assetPaths.navBrushFont)) fontResponses.push(response.status());
  });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  const typography = await page.locator('.site-navigation').evaluate(navigation => {
    const read = element => {
      const style = getComputedStyle(element);
      const bounds = element.getBoundingClientRect();
      return {
        family: style.fontFamily, size: style.fontSize, color: style.color, opacity: Number(style.opacity),
        top: bounds.top, bottom: bounds.bottom, left: bounds.left, right: bounds.right,
        width: bounds.width, scrollWidth: element.scrollWidth, clientWidth: element.clientWidth,
      };
    };
    return {
      loadedFaces: [...document.fonts].filter(face => face.family.includes('Nanfeng Navigation Brush') && face.status === 'loaded').length,
      items: [...navigation.querySelectorAll('.site-nav-item')].map(item => ({
        button: read(item), icon: read(item.querySelector('.site-nav-icon')),
        title: read(item.querySelector('strong')),
        helper: read(item.querySelector('.site-nav-description')),
      })),
    };
  });
  expect(fontResponses.some(status => status >= 200 && status < 400)).toBe(true);
  expect(typography.loadedFaces).toBeGreaterThan(0);
  expect(typography.items).toHaveLength(5);
  for (const { button, icon, title, helper } of typography.items) {
    expect(icon.color).toBe(iconRed);
    expect(helper.color).toBe('rgb(255, 255, 255)');
    expect(helper.opacity).toBeGreaterThan(0);
    expect(helper.opacity).toBeLessThan(1);
    expect(title.family).toContain('Nanfeng Navigation Brush');
    expect(helper.family).toBe(title.family);
    expect(parseFloat(helper.size)).toBeLessThan(parseFloat(title.size));
    expect(parseFloat(helper.size) / parseFloat(title.size)).toBeCloseTo(18 / 26, 2);
    expect(title.right).toBeLessThanOrEqual(helper.left);
    expect(helper.width).toBeGreaterThan(0);
    expect(helper.scrollWidth).toBeLessThanOrEqual(helper.clientWidth + 1);
    expect(helper.right).toBeLessThanOrEqual(button.right + 1);
    expect(button.top).toBeCloseTo(typography.items[0].button.top, 0);
    expect(button.bottom).toBeCloseTo(typography.items[0].button.bottom, 0);
  }
  await expectCompleteDesktopNavigation(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  for (const [route] of routes) {
    await page.locator(`.site-navigation [data-route="${route}"]`).click();
    const brand = page.locator('.site-header .site-brand');
    const lion = brand.locator('.entry-lion-emblem');
    await expect(brand.locator('.site-brand-name')).toHaveText('南风有狮');
    await expect(brand.locator('.site-brand-caption')).toHaveCount(0);
    await expect(lion).toBeVisible();
    await expect(lion).toHaveAttribute('src', /assets\/entry\/nav-lion-head\.png/);
    await expect.poll(() => lion.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
    const placement = await brand.evaluate(element => {
      const image = element.querySelector('img').getBoundingClientRect();
      const nameElement = element.querySelector('.site-brand-name');
      const name = nameElement.getBoundingClientRect();
      return {
        imageRight: image.right, nameLeft: name.left,
        imageCenter: image.top + image.height / 2, nameCenter: name.top + name.height / 2,
        width: image.width, height: image.height, family: getComputedStyle(nameElement).fontFamily,
      };
    });
    expect(placement.imageRight).toBeLessThanOrEqual(placement.nameLeft);
    expect(Math.abs(placement.imageCenter - placement.nameCenter)).toBeLessThan(1);
    expect(placement.width).toBeLessThanOrEqual(72);
    expect(placement.height).toBeLessThanOrEqual(72);
    expect(placement.family).toContain('Nanfeng Navigation Brush');
    await expect(page.locator('.entry-lion-emblem')).toHaveCount(1);
  }
});

test('电脑常见宽度与连续窗口缩放均完整显示五项导航辅助文字', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  for (const width of [1024, 1280, 1366, 1440, 1536, 1920, 2560, 3440, 1024, 1920]) {
    await test.step(`${width}px viewport`, async () => {
      await page.setViewportSize({ width, height: 1080 });
      await expect.poll(() => page.locator('.site-page').evaluate(element => element.getBoundingClientRect().width)).toBe(width);
      await expectCompleteDesktopNavigation(page);
    });
  }
});

test('最小顶栏高度与最大导航参数、推开至900px仍保留完整单行文字', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  await page.locator('.site-navigation [data-action="settings"]').click();
  const panel = page.getByRole('region', { name: '开发者参数设置' });
  await panel.getByRole('tab', { name: '布局', exact: true }).click();
  await panel.getByRole('checkbox', { name: '设置面板推开页面' }).check();
  await editNavigationParameter(page, '设置面板宽度', 760);
  await panel.getByRole('tab', { name: '导航', exact: true }).click();
  await editNavigationParameter(page, '顶栏高度', 64);
  await editNavigationParameter(page, '导航标题字号', 28);
  await editNavigationParameter(page, '导航辅助文字字号', 28);
  await editNavigationParameter(page, '导航图标尺寸', 56);
  await editNavigationParameter(page, '品牌左侧留白', 80);

  for (const [viewport, available] of [[1920, 1160], [1660, 900], [2126, 1366], [2680, 1920]]) {
    await test.step(`${viewport}px viewport, ${available}px available page`, async () => {
      await page.setViewportSize({ width: viewport, height: 1080 });
      await expect(page.locator('.site-shell')).toHaveAttribute('data-settings-layout', 'push');
      await expect.poll(() => page.locator('.site-page').evaluate(element => element.getBoundingClientRect().width)).toBe(available);
      await expectCompleteDesktopNavigation(page);
    });
  }
  await panel.getByRole('button', { name: '关闭开发者参数' }).click();
  await page.setViewportSize({ width: 1024, height: 1080 });
  await expectCompleteDesktopNavigation(page);
  await page.reload();
  await expectCompleteDesktopNavigation(page);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await expectCompleteDesktopNavigation(page);
  await expect(page.locator('.site-header')).toHaveCSS('height', '64px');
  const edge = await page.getByRole('separator', { name: '调整顶栏高度' }).boundingBox();
  expect(edge.y + edge.height / 2).toBeCloseTo(64, 0);
});

test('独立字号的正反比例在电脑窄宽推开布局和刷新后保持完整单行', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  await page.locator('.site-navigation [data-action="settings"]').click();
  const panel = page.getByRole('region', { name: '开发者参数设置' });
  await panel.getByRole('tab', { name: '布局', exact: true }).click();
  await panel.getByRole('checkbox', { name: '设置面板推开页面' }).check();
  await editNavigationParameter(page, '设置面板宽度', 760);
  await panel.getByRole('tab', { name: '导航', exact: true }).click();
  for (const [title, helper] of [[28, 10], [14, 28], [20, 20]]) {
    await editNavigationParameter(page, '导航标题字号', title);
    await editNavigationParameter(page, '导航辅助文字字号', helper);
    for (const width of [1660, 2126, 2680]) {
      await test.step(`title ${title}px, helper ${helper}px, viewport ${width}px`, async () => {
        await page.setViewportSize({ width, height: 1080 });
        await expect(page.locator('.site-shell')).toHaveAttribute('data-settings-layout', 'push');
        await expect.poll(() => page.locator('.site-page').evaluate(element => element.getBoundingClientRect().width)).toBe(width - 760);
        await expectCompleteDesktopNavigation(page);
      });
    }
  }
  await editNavigationParameter(page, '导航标题字号', 28);
  await editNavigationParameter(page, '导航辅助文字字号', 10);
  await panel.getByRole('button', { name: '关闭开发者参数' }).click();
  await page.setViewportSize({ width: 900, height: 1080 });
  await expectCompleteDesktopNavigation(page);
  await page.reload();
  await expectCompleteDesktopNavigation(page);
});

test('顶部导航随文化内容滚动保持可见，当前首页入口返回顶部', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  await page.mouse.move(960, 400);
  await page.mouse.wheel(0, 900);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(100);
  await expect(page.locator('#homeCulture')).toBeInViewport();
  const header = page.locator('.site-header');
  await expect(header).toBeInViewport();
  expect((await header.boundingBox()).y).toBeCloseTo(0, 0);
  await page.locator('.site-navigation [data-route="entry"]').click();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'entry');
  await expect(page.locator('.entry-gate')).toBeInViewport();
});

test('进入章节时五个原图标水平变速收拢到右侧，保留高亮与操作，回首页重新展开', async ({ page }) => {
  const duration = 1400;
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.addInitScript(({ duration }) => {
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    localStorage.setItem('nanfeng-lion:developer-settings:v1', JSON.stringify({ navigationDuration: duration, navigationTypographyVersion: 2 }));
  }, { duration });
  await page.goto('/');
  await expectCompleteDesktopNavigation(page);
  for (const button of await page.locator('.site-nav-item').all()) {
    await button.hover();
    await expectRedNavigationIcons(page);
  }
  await page.mouse.move(0, 120);
  const icons = await page.locator('.site-nav-icon svg').elementHandles();
  const paths = await page.locator('.site-nav-icon svg path').evaluateAll(elements => elements.map(element => element.getAttribute('d')));
  const motion = await page.evaluate(async duration => {
    const icons = [...document.querySelectorAll('.site-nav-icon')];
    const positions = () => icons.map(icon => {
      const box = icon.getBoundingClientRect();
      return {
        x: box.left + box.width / 2, y: box.top + box.height / 2,
        color: getComputedStyle(icon).color, stroke: getComputedStyle(icon.querySelector('svg')).stroke,
      };
    });
    const initial = positions();
    const initialX = initial[0].x;
    const initialY = initial[0].y;
    const samples = [];
    const started = performance.now();
    document.querySelector('.site-nav-item[data-route="model"]').click();
    await new Promise(resolve => {
      const sample = now => {
        const current = positions();
        samples.push({ time: now - started, x: current[0].x, y: current[0].y, positions: current });
        if (now - started < duration + 180) requestAnimationFrame(sample);
        else resolve();
      };
      requestAnimationFrame(sample);
    });
    return { initialX, initialY, initial, samples };
  }, duration);
  expect(motion.samples.length).toBeGreaterThan(15);
  expect([...new Set([...motion.initial, ...motion.samples.flatMap(sample => sample.positions)]
    .flatMap(position => [position.color, position.stroke]))]).toEqual([iconRed]);
  const finalX = motion.samples.at(-1).x;
  const distance = finalX - motion.initialX;
  expect(distance).toBeGreaterThan(300);
  const intermediates = motion.samples.filter(sample => sample.time > duration * .15 && sample.time < duration * .85);
  expect(intermediates.some(sample => sample.x > motion.initialX + distance * .05 && sample.x < finalX - distance * .05)).toBe(true);
  const deviation = Math.max(...intermediates.map(sample => Math.abs((sample.x - motion.initialX) / distance - sample.time / duration)));
  expect(deviation).toBeGreaterThan(.12);
  expect(Math.max(...motion.samples.map(sample => Math.abs(sample.y - motion.initialY)))).toBeLessThan(2);
  for (let index = 0; index < motion.initial.length; index += 1) {
    const start = motion.initial[index];
    const finish = motion.samples.at(-1).positions[index];
    expect(finish.x - start.x).toBeGreaterThan(10);
    expect(intermediates.some(sample => sample.positions[index].x > start.x + (finish.x - start.x) * .05
      && sample.positions[index].x < finish.x - (finish.x - start.x) * .05)).toBe(true);
    expect(Math.max(...motion.samples.map(sample => Math.abs(sample.positions[index].y - start.y)))).toBeLessThan(2);
  }
  for (let index = 1; index < motion.samples.length; index += 1) {
    expect(motion.samples[index].x).toBeGreaterThanOrEqual(motion.samples[index - 1].x - 2);
  }
  await expectCompactDesktopNavigation(page, 'model');
  await page.locator('.site-nav-item[data-route="action"]').hover();
  await expectRedNavigationIcons(page);
  expect(await page.locator('.site-nav-icon svg path').evaluateAll(elements => elements.map(element => element.getAttribute('d')))).toEqual(paths);
  for (let index = 0; index < icons.length; index += 1) {
    expect(await icons[index].evaluate((element, index) => element === document.querySelectorAll('.site-nav-icon svg')[index], index)).toBe(true);
  }
  const navBounds = await page.locator('.site-navigation').boundingBox();
  expect(1920 - navBounds.x - navBounds.width).toBeCloseTo(48, 0);
  for (const route of ['action', 'state']) {
    await page.locator(`.site-nav-item[data-route="${route}"]`).click();
    await expectCompactDesktopNavigation(page, route);
  }
  const beforeSettings = page.url();
  await page.locator('.site-nav-item[data-action="settings"]').click();
  await expect(page.getByRole('region', { name: '开发者参数设置' })).toBeVisible();
  await expectRedNavigationIcons(page);
  expect(page.url()).toBe(beforeSettings);
  await page.getByRole('button', { name: '关闭开发者参数' }).click();
  await page.locator('.site-nav-item[data-route="entry"]').click();
  await expectCompleteDesktopNavigation(page);
  await expectRedNavigationIcons(page);
  await expect(page.locator('.site-header')).toHaveAttribute('data-nav-mode', 'expanded');
  await expect.poll(() => page.locator('.site-nav-icon').first().evaluate(icon => icon.getBoundingClientRect().left + icon.getBoundingClientRect().width / 2)).toBeCloseTo(motion.initialX, 0);
});

test('动画中连续切换章节与首页会收敛到最终位置并清理旧动画', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  await expectCompleteDesktopNavigation(page);
  await page.evaluate(async () => {
    for (const route of ['model', 'entry', 'action', 'state', 'entry', 'action']) {
      document.querySelector(`.site-nav-item[data-route="${route}"]`).click();
      await new Promise(resolve => setTimeout(resolve, 80));
    }
  });
  await expectCompactDesktopNavigation(page, 'action');
  await expect.poll(() => page.locator('.site-navigation').evaluate(element =>
    element.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length)).toBe(0);
  const settled = await page.locator('.site-nav-icon').evaluateAll(elements => elements.map(element => element.getBoundingClientRect().left));
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 200)));
  expect(await page.locator('.site-nav-icon').evaluateAll(elements => elements.map(element => element.getBoundingClientRect().left))).toEqual(settled);
  await page.locator('.site-nav-item[data-route="entry"]').click();
  await expectCompleteDesktopNavigation(page);
  await expect.poll(() => page.locator('.site-navigation').evaluate(element =>
    element.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length)).toBe(0);
  expect(errors).toEqual([]);
});

test('浏览器返回与原生Hash跳转继续使用真实的水平变速动画', async ({ page }) => {
  const duration = 1200;
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.addInitScript(duration => {
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    localStorage.setItem('nanfeng-lion:developer-settings:v1', JSON.stringify({ navigationTypographyVersion: 2, navigationDuration: duration }));
  }, duration);
  await page.goto('/');
  await expectCompleteDesktopNavigation(page);
  await page.locator('.site-nav-item[data-route="action"]').click();
  await expectCompactDesktopNavigation(page, 'action');

  await armNativeNavigationSampling(page, duration);
  await page.goBack({ waitUntil: 'commit' });
  const backMotion = await page.evaluate(() => window.nativeNavigationSamples);
  expectNativeNavigationMotion(backMotion, duration, -1);
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'entry');
  await expectCompleteDesktopNavigation(page);

  await armNativeNavigationSampling(page, duration);
  await page.evaluate(() => { location.hash = '#/state'; });
  const hashMotion = await page.evaluate(() => window.nativeNavigationSamples);
  expectNativeNavigationMotion(hashMotion, duration, 1);
  await expectCompactDesktopNavigation(page, 'state');
  await expect.poll(() => page.locator('.site-navigation').evaluate(element =>
    element.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length)).toBe(0);
});

test('1366px电脑在紧凑模式修改字号后返回首页，五个图标的Y位置保持不变', async ({ page }) => {
  const duration = 1000;
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1366, height: 1080 });
  await page.addInitScript(duration => {
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    localStorage.setItem('nanfeng-lion:developer-settings:v1', JSON.stringify({ navigationTypographyVersion: 2, navigationDuration: duration }));
  }, duration);
  await page.goto('/#/action');
  await page.evaluate(() => document.fonts.ready);
  await expectCompactDesktopNavigation(page, 'action');
  await page.locator('.site-nav-item[data-action="settings"]').click();
  await editNavigationParameter(page, '导航标题字号', 14);
  await editNavigationParameter(page, '导航辅助文字字号', 28);
  await editNavigationParameter(page, '导航图标尺寸', 56);
  await page.getByRole('button', { name: '关闭开发者参数' }).click();
  await expect(page.locator('.site-header')).toHaveAttribute('data-nav-layout', 'compact-stacked');
  await expectCompactDesktopNavigation(page, 'action');

  const motion = await page.evaluate(async duration => {
    const icons = [...document.querySelectorAll('.site-nav-icon')];
    const positions = () => icons.map(icon => {
      const box = icon.getBoundingClientRect();
      return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    });
    const initial = positions();
    const samples = [];
    const started = performance.now();
    document.querySelector('.site-nav-item[data-route="entry"]').click();
    await new Promise(resolve => {
      const sample = now => {
        samples.push(positions());
        if (now - started < duration + 180) requestAnimationFrame(sample);
        else resolve();
      };
      requestAnimationFrame(sample);
    });
    return { initial, samples };
  }, duration);
  expect(motion.samples.length).toBeGreaterThan(15);
  for (let index = 0; index < 5; index += 1) {
    expect(Math.max(...motion.samples.map(sample => Math.abs(sample[index].y - motion.initial[index].y)))).toBeLessThan(2);
  }
  expect(motion.initial[0].x - motion.samples.at(-1)[0].x).toBeGreaterThan(300);
  await expect(page.locator('.site-header')).toHaveAttribute('data-nav-layout', 'stacked');
  await expectCompleteDesktopNavigation(page);
  await expectRedNavigationIcons(page);
});

test('紧凑图标间距与右侧留白影响实际电脑布局，推开设置侧栏后仍按页面边缘定位', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/#/action');
  await expectCompactDesktopNavigation(page, 'action');
  await page.locator('.site-nav-item[data-action="settings"]').click();
  await editNavigationParameter(page, '紧凑导航图标间距', 28);
  await editNavigationParameter(page, '紧凑导航右侧留白', 96);
  const panel = page.getByRole('region', { name: '开发者参数设置' });
  await panel.getByRole('tab', { name: '布局', exact: true }).click();
  await panel.getByRole('checkbox', { name: '设置面板推开页面' }).check();
  await editNavigationParameter(page, '设置面板宽度', 480);
  await expect.poll(() => page.locator('.site-page').evaluate(element => element.getBoundingClientRect().width)).toBe(1440);
  await expectCompactDesktopNavigation(page, 'action');
  await expect.poll(() => page.locator('.site-navigation').evaluate(navigation => {
    const page = navigation.closest('.site-page').getBoundingClientRect();
    const nav = navigation.getBoundingClientRect();
    const buttons = [...navigation.querySelectorAll('.site-nav-item')].map(button => button.getBoundingClientRect());
    return { inset: Math.round(page.right - nav.right), gaps: buttons.slice(1).map((button, index) => Math.round(button.left - buttons[index].right)) };
  })).toEqual({ inset: 96, gaps: [28, 28, 28, 28] });
  await panel.getByRole('button', { name: '关闭开发者参数' }).click();
  await expect.poll(() => page.locator('.site-page').evaluate(element => element.getBoundingClientRect().width)).toBe(1920);
  await expectCompactDesktopNavigation(page, 'action');
  const finalBounds = await page.locator('.site-navigation').boundingBox();
  expect(1920 - finalBounds.x - finalBounds.width).toBeCloseTo(96, 0);
});

test('减少动态偏好时章节图标直接就位并保留可访问导航和返回首页', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  await expectCompleteDesktopNavigation(page);
  const state = await page.evaluate(async () => {
    document.querySelector('.site-nav-item[data-route="action"]').click();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const navigation = document.querySelector('.site-navigation');
    return {
      route: document.querySelector('#react-app').dataset.route,
      running: navigation.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length,
    };
  });
  expect(state).toEqual({ route: 'action', running: 0 });
  await expectCompactDesktopNavigation(page, 'action');
  await page.locator('.site-nav-item[data-route="entry"]').click();
  await expectCompleteDesktopNavigation(page);
  await expect(page.locator('.site-header')).toHaveAttribute('data-nav-mode', 'expanded');
});

test('导航可用键盘逐项切换，设置入口保持当前页面与地址', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  const navigation = page.locator('.site-navigation');
  await navigation.locator('[data-route="entry"]').focus();
  await page.keyboard.press('Tab');
  const model = navigation.locator('[data-route="model"]');
  await expect(model).toBeFocused();
  expect(await model.evaluate(element => getComputedStyle(element).outlineStyle)).toBe('solid');
  await page.keyboard.press('Enter');
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'model');
  await page.keyboard.press('Tab');
  await expect(navigation.locator('[data-route="action"]')).toBeFocused();
  await page.keyboard.press('Space');
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'action');
  await page.keyboard.press('Tab');
  await expect(navigation.locator('[data-route="state"]')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'state');
  await page.keyboard.press('Tab');
  const settings = navigation.locator('[data-action="settings"]');
  await expect(settings).toBeFocused();
  const before = page.url();
  await page.keyboard.press('Space');
  await expect(settings).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('region', { name: '开发者参数设置', exact: true })).toBeVisible();
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'state');
  expect(page.url()).toBe(before);
  await expect(navigation.locator('[data-route="state"]')).toHaveAttribute('aria-current', 'page');
  await page.keyboard.press('Escape');
  await expect(settings).toHaveAttribute('aria-expanded', 'false');
  await expect(settings).toBeFocused();
  expect(page.url()).toBe(before);
});

test('手机顶部五项入口可见且可切换，无旧菜单或横向溢出', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const navigation = page.locator('.site-navigation');
  await expect(navigation.locator('.site-nav-item')).toHaveCount(5);
  for (const item of await navigation.locator('.site-nav-item').all()) await expect(item).toBeInViewport();
  await expect(page.locator(removedNavigation)).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const [route, label] of [['action', '动作'], ['state', '神态'], ['entry', '首页']]) {
    await navigation.locator(`[data-route="${route}"]`).click();
    await expect(page.locator('#react-app')).toHaveAttribute('data-route', route);
    await expect(navigation.locator('[aria-current="page"] .site-nav-heading strong')).toHaveText(label);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
