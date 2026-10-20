import { test, expect } from '@playwright/test';
import { selectSettingsFor } from './settings-navigation.helpers.js';
import { assetPaths } from '../../src/config/assetPaths.js';

const routes = [['entry', '首页'], ['model', '结构'], ['action', '动作'], ['state', '神态']];
const removedNavigation = '.entry-chapter-nav, .entry-bottom-nav, .entry-bottom-item, .entry-nav-shell, .entry-nav-ribbon, .chapter-rail, .entry-dialog-backdrop';
const iconPaths = [assetPaths.navHomeIcon, assetPaths.navStructureIcon, assetPaths.navActionIcon, assetPaths.navExpressionIcon, assetPaths.navSettingsIcon];

async function expectUserNavigationIcons(page) {
  const images = page.locator('.site-nav-icon svg image');
  await expect(images).toHaveCount(5);
  for (let index = 0; index < iconPaths.length; index += 1) {
    expect((await images.nth(index).getAttribute('href')).endsWith(iconPaths[index])).toBe(true);
  }
  await expect.poll(() => images.evaluateAll(async elements => {
    const loaded = await Promise.all(elements.map(async element => {
      const image = new Image();
      image.src = element.getAttribute('href');
      await image.decode();
      return image.naturalWidth === 1254 && image.naturalHeight === 1254;
    }));
    return loaded.every(Boolean) && elements.every(element =>
      getComputedStyle(element.closest('svg')).filter === 'none' && getComputedStyle(element.closest('svg')).opacity === '1');
  })).toBe(true);
}

async function armNativeNavigationSampling(page, duration) {
  await page.evaluate(duration => {
    window.nativeNavigationSamples = new Promise(resolve => {
      window.addEventListener('hashchange', () => {
        const icon = document.querySelector('[data-route="model"] .site-nav-icon');
        const read = () => {
          const box = icon.getBoundingClientRect();
          return {
            x: box.left + box.width / 2, y: box.top + box.height / 2,
            source: icon.querySelector('image').getAttribute('href'),
            filter: getComputedStyle(icon.querySelector('svg')).filter,
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
  expectSmoothVerticalMotion(motion.initial.y, motion.samples, duration);
  expect(motion.samples.at(-1).running).toBe(false);
  expect([...new Set([motion.initial, ...motion.samples].map(sample => sample.source))]).toEqual([motion.initial.source]);
  expect([...new Set([motion.initial, ...motion.samples].map(sample => sample.filter))]).toEqual(['none']);
}

function expectSmoothVerticalMotion(initialY, samples, duration) {
  const finalY = samples.at(-1).y;
  const distance = finalY - initialY;
  expect(Math.max(...samples.map(sample => Math.abs(sample.y - initialY)))).toBeLessThan(Math.abs(distance) + 2);
  if (Math.abs(distance) > 2) {
    expect(samples.some(sample => sample.time > duration * .15 && sample.time < duration * .85
      && (sample.y - initialY) / distance > .05 && (sample.y - initialY) / distance < .95 && sample.running)).toBe(true);
  }
  for (let index = 1; index < samples.length; index += 1) {
    expect(Math.abs(samples[index].y - samples[index - 1].y)).toBeLessThan(Math.max(2, Math.abs(distance) * .35));
  }
}

async function expectPageReserve(page, reserve = 0) {
  await expect.poll(() => page.locator('.site-page').evaluate((element, reserve) => {
    const shell = element.closest('.site-shell').getBoundingClientRect();
    const bounds = element.getBoundingClientRect();
    return Math.round(shell.width - bounds.width - reserve);
  }, reserve)).toBe(0);
}

async function expectCompleteDesktopNavigation(page) {
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('.site-header')).toHaveAttribute('data-nav-animating', 'false');
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
      if (!button.querySelector('.site-nav-icon svg image')
        || getComputedStyle(button.querySelector('.site-nav-icon svg')).filter !== 'none') {
        violations.push(`${label}: the supplied artwork is missing or filtered`);
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
  await selectSettingsFor(page, label);
  const input = panel
    .getByRole('spinbutton', { name: `${label}数值`, exact: true });
  await input.fill(String(value));
  await input.press('Tab');
  await expect(input).toHaveValue(String(value));
}

async function expectCompactDesktopNavigation(page, route) {
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', route);
  await expect(page.locator('.site-header')).toHaveAttribute('data-nav-animating', 'false');
  await expect(page.locator('.site-header')).toHaveAttribute('data-nav-layout', 'compact');
  const navigation = page.locator('.site-navigation');
  for (const [chapter, label] of routes) {
    await expect(navigation.locator(`[data-route="${chapter}"]`)).toHaveAccessibleName(label);
  }
  const home = navigation.locator('[data-route="entry"]');
  await expect(home).toBeVisible();
  await expect(home).toHaveAccessibleName('首页');
  await expect(page.getByRole('button', { name: '南风有狮，返回首页', exact: true })).toBeVisible();
  await expect(page.locator('.site-brand-copy')).toBeHidden();
  await expect(page.locator('.site-brand-capsule .entry-lion-emblem')).toBeVisible();
  await expect(navigation.locator('.site-nav-short-label')).toHaveCount(0);
  for (const heading of await navigation.locator('.site-nav-heading strong').all()) {
    await expect(heading).toBeVisible();
    await expect(heading).toHaveCSS('opacity', '1');
    await expect(heading).toHaveCSS('font-weight', '400');
    expect(await heading.evaluate(element => getComputedStyle(element).fontFamily)).toContain('Nanfeng Navigation Brush');
  }
  for (const helper of await navigation.locator('.site-nav-description').all()) await expect(helper).toBeHidden();
  await expect.poll(() => navigation.evaluate((element) => {
    const violations = [];
    const page = element.closest('.site-page').getBoundingClientRect();
    const header = element.closest('.site-header').getBoundingClientRect();
    const brand = element.closest('.site-header').querySelector('.site-brand-capsule').getBoundingClientRect();
    const nav = element.getBoundingClientRect();
    const buttons = [...element.querySelectorAll('.site-nav-item')].filter(button => getComputedStyle(button).visibility !== 'hidden');
    if (buttons.length !== 5) violations.push('Compact navigation must retain all five home/chapter/settings buttons');
    const firstIcon = buttons[0].querySelector('.site-nav-icon').getBoundingClientRect();
    const sharesBrandRow = nav.top < brand.bottom - 1 && nav.bottom > brand.top + 1;
    const brandGap = nav.left - brand.right;
    const expectedGap = parseFloat(getComputedStyle(element.closest('.site-header-inner')).columnGap);
    if (!sharesBrandRow || brandGap < -1 || brandGap > expectedGap + 1
      || brand.left < header.left - 1 || brand.top < header.top - 1 || brand.bottom > header.bottom + 1
      || nav.right > page.right - 15 || nav.width > page.width * .6) {
      violations.push('The brand must sit immediately left of Home in the compact group at the right');
    }
    let previousRight = nav.left;
    for (const button of buttons) {
      const bounds = button.getBoundingClientRect();
      const icon = button.querySelector('.site-nav-icon').getBoundingClientRect();
      if (!button.querySelector('.site-nav-icon svg image')
        || getComputedStyle(button.querySelector('.site-nav-icon svg')).filter !== 'none') {
        violations.push('A compact icon lost its supplied artwork or color');
      }
      if (bounds.left < previousRight - 1 || bounds.right > nav.right + 1) violations.push('Icon buttons overlap or exceed their group');
      if (icon.width <= 0 || icon.left < bounds.left - 1 || icon.right > bounds.right + 1) violations.push('An icon is hidden or clipped');
      if (icon.top < header.top - 1 || icon.bottom > header.bottom + 1) violations.push('An icon exceeds the header vertically');
      const label = button.querySelector('.site-nav-heading strong');
      const labelBounds = label.getBoundingClientRect();
      const highlight = getComputedStyle(button.querySelector('.site-nav-icon'), '::after');
      const highlightBottom = icon.bottom - parseFloat(highlight.bottom);
      if (labelBounds.width <= 0 || labelBounds.top < highlightBottom + 1 || labelBounds.bottom > nav.bottom + 1
        || labelBounds.left < bounds.left - 1 || labelBounds.right > bounds.right + 1) {
        violations.push('An original brush title is missing or clipped below the icon highlight');
      }
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
  await openPrepared(page, '/');
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
    await expect(navigation.locator('.site-nav-icon svg path')).toHaveCount(0);
    await expectUserNavigationIcons(page);
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
  await openPrepared(page, '/');
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
    expect(icon.width).toBeGreaterThan(0);
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
    if (route !== 'entry') {
      await expect(brand.locator('.site-brand-copy')).toBeHidden();
      await expect(page.locator('.entry-lion-emblem')).toHaveCount(1);
      continue;
    }
    await expect(brand.locator('.site-brand-copy')).toBeVisible();
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
  await openPrepared(page, '/');
  for (const width of [1024, 1280, 1366, 1440, 1536, 1920, 2560, 3440, 1024, 1920]) {
    await test.step(`${width}px viewport`, async () => {
      await page.setViewportSize({ width, height: 1080 });
      await expectPageReserve(page);
      await expectCompleteDesktopNavigation(page);
    });
  }
});

test('最小顶栏高度与最大导航参数、推开至900px仍保留完整单行文字', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openPrepared(page, '/');
  await page.locator('.site-navigation [data-action="settings"]').click();
  const panel = page.getByRole('region', { name: '开发者参数设置' });
  const gutter = await page.evaluate(() => innerWidth - document.querySelector('.site-shell').getBoundingClientRect().width);
  await selectSettingsFor(page, 'panelWidth');
  await panel.getByRole('checkbox', { name: '设置面板推开页面' }).check();
  await editNavigationParameter(page, '设置面板宽度', 760);
  await selectSettingsFor(page, 'navFontSize');
  await editNavigationParameter(page, '顶栏高度', 64);
  await editNavigationParameter(page, '导航标题字号', 28);
  await editNavigationParameter(page, '导航辅助文字字号', 28);
  await editNavigationParameter(page, '导航图标尺寸', 56);
  await editNavigationParameter(page, '品牌左侧留白', 80);

  for (const [viewport, available] of [[1920, 1160], [1660, 900], [2126, 1366], [2680, 1920]]) {
    await test.step(`${viewport}px viewport, ${available}px available page`, async () => {
      await page.setViewportSize({ width: viewport + gutter, height: 1080 });
      await expect(page.locator('.site-shell')).toHaveAttribute('data-settings-layout', 'push');
      await expectPageReserve(page, 760);
      await expectCompleteDesktopNavigation(page);
    });
  }
  await panel.getByRole('button', { name: '关闭开发者参数' }).click();
  await page.setViewportSize({ width: 1024, height: 1080 });
  await expectCompleteDesktopNavigation(page);
  await page.reload();
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 60_000 });
  await expectCompleteDesktopNavigation(page);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await expectCompleteDesktopNavigation(page);
  await expect(page.locator('.site-header')).toHaveCSS('height', '64px');
  const edge = await page.getByRole('separator', { name: '调整顶栏高度' }).boundingBox();
  expect(edge.y + edge.height / 2).toBeCloseTo(64, 0);
});

test('独立字号的正反比例在电脑窄宽推开布局和刷新后保持完整单行', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openPrepared(page, '/');
  await page.locator('.site-navigation [data-action="settings"]').click();
  const panel = page.getByRole('region', { name: '开发者参数设置' });
  const gutter = await page.evaluate(() => innerWidth - document.querySelector('.site-shell').getBoundingClientRect().width);
  await selectSettingsFor(page, 'panelWidth');
  await panel.getByRole('checkbox', { name: '设置面板推开页面' }).check();
  await editNavigationParameter(page, '设置面板宽度', 760);
  await selectSettingsFor(page, 'navFontSize');
  for (const [title, helper] of [[28, 10], [14, 28], [20, 20]]) {
    await editNavigationParameter(page, '导航标题字号', title);
    await editNavigationParameter(page, '导航辅助文字字号', helper);
    for (const width of [1660, 2126, 2680]) {
      await test.step(`title ${title}px, helper ${helper}px, viewport ${width}px`, async () => {
        await page.setViewportSize({ width: width + gutter, height: 1080 });
        await expect(page.locator('.site-shell')).toHaveAttribute('data-settings-layout', 'push');
        await expectPageReserve(page, 760);
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
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 60_000 });
  await expectCompleteDesktopNavigation(page);
});

test('顶部导航随文化内容滚动保持可见，当前首页入口返回顶部', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openPrepared(page, '/');
  await page.mouse.move(960, 400);
  await page.mouse.wheel(0, 900);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(100);
  await expect(page.locator('#homeLionBook')).toBeInViewport();
  const header = page.locator('.site-header');
  await expect(header).toBeInViewport();
  expect((await header.boundingBox()).y).toBeCloseTo(0, 0);
  await page.locator('.site-navigation [data-route="entry"]').click();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'entry');
  await expect(page.locator('.entry-gate')).toBeInViewport();
});

test('进入章节时图案、原毛笔标题和品牌变速收拢，完整底板保持原位置与面积并可返回展开', async ({ page }) => {
  const duration = 1400;
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.addInitScript(({ duration }) => {
    if (window !== window.top) return;
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    localStorage.setItem('nanfeng-lion:developer-settings:v1', JSON.stringify({ navigationDuration: duration, navigationTypographyVersion: 2 }));
  }, { duration });
  await openPrepared(page, '/');
  await expectCompleteDesktopNavigation(page);
  for (const button of await page.locator('.site-nav-item').all()) {
    await button.hover();
    await expectUserNavigationIcons(page);
  }
  await page.mouse.move(0, 120);
  const icons = await page.locator('.site-nav-icon svg').elementHandles();
  const labels = await page.locator('.site-nav-heading strong').elementHandles();
  const sources = await page.locator('.site-nav-icon svg image').evaluateAll(elements => elements.map(element => element.getAttribute('href')));
  const motion = await page.evaluate(async duration => {
    const icons = [...document.querySelectorAll('.site-nav-icon')];
    const positions = () => icons.map(icon => {
      const box = icon.getBoundingClientRect();
      const heading = icon.closest('.site-nav-item').querySelector('.site-nav-heading');
      const text = heading.getBoundingClientRect();
      return {
        x: box.left + box.width / 2, y: box.top + box.height / 2,
        source: icon.querySelector('image').getAttribute('href'), filter: getComputedStyle(icon.querySelector('svg')).filter,
        running: icon.getAnimations().some(animation => animation.playState === 'running'),
        label: { x: text.left + text.width / 2, y: text.top + text.height / 2,
          running: heading.getAnimations().some(animation => animation.playState === 'running') },
      };
    });
    const backdrop = () => {
      const header = document.querySelector('.site-header');
      const surfaces = header.querySelectorAll(':scope > .navigation-surface');
      const surface = surfaces[0];
      const bounds = surface.getBoundingClientRect();
      const headerBounds = header.getBoundingClientRect();
      const style = getComputedStyle(surface);
      return { count: surfaces.length, bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
        header: { x: headerBounds.x, y: headerBounds.y, width: headerBounds.width, height: headerBounds.height },
        background: style.backgroundImage, opacity: style.opacity, blur: style.backdropFilter, radius: style.borderRadius,
        running: surface.getAnimations().some(animation => animation.playState === 'running'),
      };
    };
    const initial = positions();
    const initialBackdrop = backdrop();
    const initialX = initial[1].x;
    const initialY = initial[1].y;
    const samples = [];
    const started = performance.now();
    document.querySelector('.site-nav-item[data-route="model"]').click();
    await new Promise(resolve => {
      const sample = now => {
        const current = positions();
        samples.push({ time: now - started, x: current[1].x, y: current[1].y, running: current[1].running, positions: current, backdrop: backdrop() });
        if (now - started < duration + 180) requestAnimationFrame(sample);
        else resolve();
      };
      requestAnimationFrame(sample);
    });
    return { initialX, initialY, initial, initialBackdrop, samples };
  }, duration);
  expect(motion.samples.length).toBeGreaterThan(15);
  expect(motion.initialBackdrop.count).toBe(1);
  expect(motion.initialBackdrop.bounds).toEqual(motion.initialBackdrop.header);
  for (const sample of motion.samples) {
    expect(sample.positions.map(position => position.source)).toEqual(sources);
    expect(sample.positions.map(position => position.filter)).toEqual(Array(5).fill('none'));
    expect(sample.backdrop).toEqual(motion.initialBackdrop);
  }
  const finalX = motion.samples.at(-1).x;
  const distance = finalX - motion.initialX;
  expect(distance).toBeGreaterThan(300);
  const intermediates = motion.samples.filter(sample => sample.time > duration * .15 && sample.time < duration * .85);
  expect(intermediates.some(sample => sample.x > motion.initialX + distance * .05 && sample.x < finalX - distance * .05)).toBe(true);
  const deviation = Math.max(...intermediates.map(sample => Math.abs((sample.x - motion.initialX) / distance - sample.time / duration)));
  expect(deviation).toBeGreaterThan(.12);
  expectSmoothVerticalMotion(motion.initialY, motion.samples, duration);
  for (let index = 1; index < motion.initial.length; index += 1) {
    const start = motion.initial[index];
    const finish = motion.samples.at(-1).positions[index];
    expect(Math.abs(finish.x - start.x)).toBeGreaterThan(10);
    expect(intermediates.some(sample => {
      const progress = (sample.positions[index].x - start.x) / (finish.x - start.x);
      return progress > .05 && progress < .95 && sample.positions[index].running;
    })).toBe(true);
    expectSmoothVerticalMotion(start.y, motion.samples.map(sample => ({ time: sample.time, ...sample.positions[index] })), duration);
  }
  for (let index = 0; index < motion.initial.length; index += 1) {
    const start = motion.initial[index].label;
    const finish = motion.samples.at(-1).positions[index].label;
    const distance = Math.hypot(finish.x - start.x, finish.y - start.y);
    expect(distance).toBeGreaterThan(10);
    expect(intermediates.some(sample => {
      const label = sample.positions[index].label;
      const travelled = Math.hypot(label.x - start.x, label.y - start.y);
      return label.running && travelled > distance * .05 && travelled < distance * .95;
    })).toBe(true);
    expect(finish.running).toBe(false);
  }
  for (let index = 1; index < motion.samples.length; index += 1) {
    expect(motion.samples[index].x).toBeGreaterThanOrEqual(motion.samples[index - 1].x - 2);
  }
  await expectCompactDesktopNavigation(page, 'model');
  await page.locator('.site-nav-item[data-route="action"]').hover();
  await expectUserNavigationIcons(page);
  expect(await page.locator('.site-nav-icon svg image').evaluateAll(elements => elements.map(element => element.getAttribute('href')))).toEqual(sources);
  for (let index = 0; index < icons.length; index += 1) {
    expect(await icons[index].evaluate((element, index) => element === document.querySelectorAll('.site-nav-icon svg')[index], index)).toBe(true);
    expect(await labels[index].evaluate((element, index) => element === document.querySelectorAll('.site-nav-heading strong')[index], index)).toBe(true);
  }
  const navBounds = await page.locator('.site-navigation').boundingBox();
  const pageBounds = await page.locator('.site-page').boundingBox();
  expect(pageBounds.x + pageBounds.width - navBounds.x - navBounds.width).toBeCloseTo(48, 0);
  for (const route of ['action', 'state']) {
    await page.locator(`.site-nav-item[data-route="${route}"]`).click();
    await expectCompactDesktopNavigation(page, route);
  }
  const beforeSettings = page.url();
  await page.locator('.site-nav-item[data-action="settings"]').click();
  await expect(page.getByRole('region', { name: '开发者参数设置' })).toBeVisible();
  await expectUserNavigationIcons(page);
  expect(page.url()).toBe(beforeSettings);
  await page.getByRole('button', { name: '关闭开发者参数' }).click();
  await page.locator('.site-brand-capsule').click();
  await expectCompleteDesktopNavigation(page);
  await expectUserNavigationIcons(page);
  await expect(page.locator('.site-header')).toHaveAttribute('data-nav-mode', 'expanded');
  await expect.poll(() => page.locator('[data-route="model"] .site-nav-icon').evaluate(icon => icon.getBoundingClientRect().left + icon.getBoundingClientRect().width / 2)).toBeCloseTo(motion.initialX, 0);
});

test('动画中连续切换章节与首页会收敛到最终位置并清理旧动画', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openPrepared(page, '/');
  await expectCompleteDesktopNavigation(page);
  await page.evaluate(async () => {
    for (const route of ['model', 'entry', 'action', 'state', 'entry', 'action']) {
      document.querySelector(route === 'entry' ? '.site-brand-capsule' : `.site-nav-item[data-route="${route}"]`).click();
      await new Promise(resolve => setTimeout(resolve, 80));
    }
  });
  await expectCompactDesktopNavigation(page, 'action');
  await expect.poll(() => page.locator('.site-navigation').evaluate(element =>
    element.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length)).toBe(0);
  const settled = await page.locator('.site-nav-icon').evaluateAll(elements => elements.map(element => element.getBoundingClientRect().left));
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 200)));
  expect(await page.locator('.site-nav-icon').evaluateAll(elements => elements.map(element => element.getBoundingClientRect().left))).toEqual(settled);
  await page.locator('.site-brand-capsule').click();
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
    if (window !== window.top) return;
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    localStorage.setItem('nanfeng-lion:developer-settings:v1', JSON.stringify({ navigationTypographyVersion: 2, navigationDuration: duration }));
  }, duration);
  await openPrepared(page, '/');
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

test('1366px电脑紧凑模式修改字号后返回首页，图案平滑归位且底板高度保持一致', async ({ page }) => {
  const duration = 1000;
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1366, height: 1080 });
  await page.addInitScript(duration => {
    if (window !== window.top) return;
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    localStorage.setItem('nanfeng-lion:developer-settings:v1', JSON.stringify({ navigationTypographyVersion: 2, navigationDuration: duration }));
  }, duration);
  await openPrepared(page, '/#/action');
  await page.evaluate(() => document.fonts.ready);
  await expectCompactDesktopNavigation(page, 'action');
  await page.locator('.site-nav-item[data-action="settings"]').click();
  await editNavigationParameter(page, '导航标题字号', 14);
  await editNavigationParameter(page, '导航辅助文字字号', 28);
  await editNavigationParameter(page, '导航图标尺寸', 56);
  await page.getByRole('button', { name: '关闭开发者参数' }).click();
  await expectPageReserve(page);
  await expect(page.locator('.site-header')).toHaveAttribute('data-nav-layout', 'compact');
  await expectCompactDesktopNavigation(page, 'action');

  const motion = await page.evaluate(async duration => {
    const icons = [...document.querySelectorAll('.site-nav-item:not([data-route="entry"]) .site-nav-icon')];
    const positions = () => icons.map(icon => {
      const box = icon.getBoundingClientRect();
      return { x: box.left + box.width / 2, y: box.top + box.height / 2, running: icon.getAnimations().some(animation => animation.playState === 'running') };
    });
    const initial = positions();
    const initialHeaderHeight = document.querySelector('.site-header').getBoundingClientRect().height;
    const samples = [];
    const started = performance.now();
    document.querySelector('.site-brand-capsule').click();
    await new Promise(resolve => {
      const sample = now => {
        samples.push({ time: now - started, positions: positions(), headerHeight: document.querySelector('.site-header').getBoundingClientRect().height });
        if (now - started < duration + 180) requestAnimationFrame(sample);
        else resolve();
      };
      requestAnimationFrame(sample);
    });
    return { initial, samples, initialHeaderHeight };
  }, duration);
  expect(motion.samples.length).toBeGreaterThan(15);
  for (const sample of motion.samples) expect(sample.headerHeight).toBe(motion.initialHeaderHeight);
  for (let index = 0; index < 4; index += 1) {
    expectSmoothVerticalMotion(motion.initial[index].y, motion.samples.map(sample => ({ time: sample.time, ...sample.positions[index] })), duration);
    expect(motion.samples.some(sample => sample.time > duration * .6 && sample.positions[index].running)).toBe(true);
    expect(motion.samples.at(-1).positions[index].running).toBe(false);
  }
  expect(motion.initial[0].x - motion.samples.at(-1).positions[0].x).toBeGreaterThan(300);
  await expect(page.locator('.site-header')).toHaveAttribute('data-nav-layout', 'stacked');
  await expectCompleteDesktopNavigation(page);
  await expectUserNavigationIcons(page);
});

test('紧凑图标间距与右侧留白影响实际电脑布局，推开设置侧栏后仍按页面边缘定位', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openPrepared(page, '/#/action');
  await expectCompactDesktopNavigation(page, 'action');
  await page.locator('.site-nav-item[data-action="settings"]').click();
  await editNavigationParameter(page, '紧凑导航图标间距', 28);
  await editNavigationParameter(page, '紧凑导航右侧留白', 96);
  const panel = page.getByRole('region', { name: '开发者参数设置' });
  await selectSettingsFor(page, 'panelWidth');
  await panel.getByRole('checkbox', { name: '设置面板推开页面' }).check();
  await editNavigationParameter(page, '设置面板宽度', 480);
  await expectPageReserve(page, 480);
  await expectCompactDesktopNavigation(page, 'action');
  await expect.poll(() => page.locator('.site-navigation').evaluate(navigation => {
    const page = navigation.closest('.site-page').getBoundingClientRect();
    const nav = navigation.getBoundingClientRect();
    const buttons = [...navigation.querySelectorAll('.site-nav-item')].filter(button => getComputedStyle(button).visibility !== 'hidden').map(button => button.getBoundingClientRect());
    return { inset: Math.round(page.right - nav.right), gaps: buttons.slice(1).map((button, index) => Math.round(button.left - buttons[index].right)) };
  })).toEqual({ inset: 96, gaps: [28, 28, 28, 28] });
  await panel.getByRole('button', { name: '关闭开发者参数' }).click();
  await expectPageReserve(page);
  await expectCompactDesktopNavigation(page, 'action');
  const finalBounds = await page.locator('.site-navigation').boundingBox();
  const pageBounds = await page.locator('.site-page').boundingBox();
  expect(pageBounds.x + pageBounds.width - finalBounds.x - finalBounds.width).toBeCloseTo(96, 0);
});

test('减少动态偏好时章节图标直接就位并保留可访问导航和返回首页', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openPrepared(page, '/');
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
  await page.locator('.site-brand-capsule').click();
  await expectCompleteDesktopNavigation(page);
  await expect(page.locator('.site-header')).toHaveAttribute('data-nav-mode', 'expanded');
});

test('导航可用键盘逐项切换，设置入口保持当前页面与地址', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openPrepared(page, '/');
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
  await openPrepared(page, '/');
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

async function openPrepared(page, url) {
  await page.goto(url);
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 60_000 });
}
