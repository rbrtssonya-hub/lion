import { useLayoutEffect } from 'react';

const readPixels = (style, property, fallback) => {
  const value = Number.parseFloat(style.getPropertyValue(property));
  return Number.isFinite(value) ? value : fallback;
};

// Measure the rendered font rather than assuming every label needs the same space.
// This also responds to browser zoom and to the width left by a pushed settings panel.
export function useNavigationLayout(headerRef, current, settings) {
  useLayoutEffect(() => {
    const header = headerRef.current;
    const page = header?.closest('.site-page');
    const shell = header?.closest('.site-shell');
    if (!header || !page || !shell) return;

    const initialHeaderHeight = shell.style.getPropertyValue('--site-header-height');
    const range = document.createRange();
    let frame = 0;
    let active = true;
    let coordinateScale = 1;
    const write = (element, property, value) => {
      if (element.style.getPropertyValue(property) !== value) element.style.setProperty(property, value);
    };
    const textUnits = element => {
      range.selectNodeContents(element);
      const size = Number.parseFloat(getComputedStyle(element).fontSize);
      return size > 0 ? range.getBoundingClientRect().width / coordinateScale / size : 0;
    };
    const measureCopy = (item, font, helperFont) => {
      // Helpers are hidden in compact mode. Restore them on a layout-only clone
      // so all routes retain the expanded font budget and background height.
      const copy = item.querySelector('.site-nav-copy').cloneNode(true);
      copy.style.cssText = 'display:flex;position:absolute;left:-10000px;top:0;visibility:hidden;pointer-events:none;width:max-content;transform:none;opacity:1';
      copy.style.fontSize = `${font}px`;
      const helper = copy.querySelector('.site-nav-description');
      helper.style.display = 'block';
      helper.style.position = 'static';
      helper.style.fontSize = `${helperFont}px`;
      header.append(copy);
      const heading = textUnits(copy.querySelector('.site-nav-heading strong')) * font;
      const description = textUnits(copy.querySelector('.site-nav-description')) * helperFont;
      copy.remove();
      return { heading, description };
    };
    const measureBrand = expanded => {
      // Hiding the compact brand name must not change how the homepage fits.
      const brand = header.querySelector('.site-brand-capsule').cloneNode(true);
      brand.style.cssText = 'position:absolute;left:-10000px;top:0;visibility:hidden;pointer-events:none;margin-left:0;transform:none';
      const copy = brand.querySelector('.site-brand-copy');
      copy.style.position = expanded ? 'static' : 'absolute';
      copy.style.transform = 'none';
      copy.style.opacity = '1';
      header.append(brand);
      const width = Number.parseFloat(getComputedStyle(brand).width);
      brand.remove();
      return width;
    };
    const update = () => {
      frame = 0;
      if (!active) return;
      // Layout uses CSS pixels; DOM rectangles also include page zoom.
      const bounds = header.getBoundingClientRect();
      const width = parseFloat(getComputedStyle(header).width);
      coordinateScale = bounds.width / width;
      const requested = getComputedStyle(shell);
      const requestedHeight = readPixels(requested, '--header-height', 90);
      const font = readPixels(requested, '--nav-font-size', 26);
      const helperFont = readPixels(requested, '--nav-helper-font-size', 18);
      const requestedIcon = readPixels(requested, '--requested-nav-icon-size', 40);
      const requestedPadding = readPixels(requested, '--brand-padding', 24);
      const density = Math.min(1, width / 1600);
      // Include the button's vertical padding and the header border in the height budget.
      const icon = Math.min(requestedIcon, Math.max(20, requestedIcon * density * density), requestedHeight - 44);
      const homeOffset = Math.min(readPixels(requested, '--home-brand-offset', 24), Math.max(0, width * .12));
      write(header, '--navigation-home-brand-offset', `${homeOffset}px`);
      // First measure the expanded layout in every route. A stacked homepage
      // must not make the background taller only when returning to the homepage.
      header.dataset.navLayout = 'inline';
      const headingGap = 6 * density;
      const copyGap = 8 * density;
      const itemGap = 8 * density;
      const itemPadding = 6 * density;
      const sidePadding = Math.min(requestedPadding, Math.max(8, width * .02));
      const headerGap = Math.min(28, width * .011);
      const items = [...header.querySelectorAll('.site-nav-item')];
      // Fit both text sizes together so narrowing the page preserves their hierarchy.
      const copies = items.map(item => measureCopy(item, font, helperFont));
      const textWidths = copies.map(({ heading, description }) => heading + description);
      const totalTextWidth = textWidths.reduce((sum, value) => sum + value, 0);
      const fixedWidth = icon + headingGap + copyGap + itemGap + 2 * itemPadding;
      const brandWidth = measureBrand(true);
      let available = width - 2 * sidePadding - brandWidth - homeOffset - headerGap;
      let scale = Math.min(1, (available - fixedWidth * items.length) / totalTextWidth);
      const stacked = font * scale < Math.min(font, 16);
      if (stacked) {
        header.dataset.navLayout = 'stacked';
        available = width - 2 * sidePadding;
        scale = Math.min(1, (available - fixedWidth * items.length) / totalTextWidth);
      }
      // Leave a subpixel margin for the browser's grid-track rounding.
      if (scale < 1) scale = Math.max(0, Math.floor((scale - .08 / Math.max(font, helperFont)) * 10000) / 10000);
      // Zoomed desktop windows retain readable, single-line labels. When the
      // expanded row cannot fit, wrap whole items instead of hiding helpers.
      const minimumScale = Math.max(Math.min(14, font) / font, Math.min(11, helperFont) / helperFont);
      const wrapped = scale < minimumScale;
      let wrappedRows = 1, rowHeight = 0;
      let columns;
      if (wrapped) {
        scale = minimumScale;
        const widestItem = Math.max(...textWidths.map(value => value * scale + fixedWidth));
        // Reserve the local scrollbar gutter even before it becomes necessary.
        const wrappedWidth = width - 2 * sidePadding - 16;
        const count = Math.max(1, Math.min(items.length, Math.floor(wrappedWidth / widestItem)));
        wrappedRows = Math.ceil(items.length / count);
        rowHeight = Math.ceil(Math.max(44, icon + 20, Math.max(font, helperFont) * scale * 1.45 + 20));
        columns = `repeat(${count}, minmax(0, 1fr))`;
        header.dataset.navLayout = 'wrapped';
        write(header, '--navigation-wrapped-row-height', `${rowHeight}px`);
      }
      const extra = Math.max(0, (available - totalTextWidth * scale - fixedWidth * items.length) / items.length);
      columns ??= textWidths.map(value => `${value * scale + fixedWidth + extra}px`).join(' ');
      write(header, '--site-nav-font-size', `${font * scale}px`);
      write(header, '--site-nav-helper-font-size', `${helperFont * scale}px`);
      write(header, '--navigation-icon-size', `${icon}px`);
      write(header, '--navigation-heading-gap', `${headingGap}px`);
      write(header, '--navigation-copy-gap', `${copyGap}px`);
      write(header, '--navigation-item-gap', `${itemGap}px`);
      write(header, '--navigation-item-padding', `${itemPadding}px`);
      write(header, '--navigation-side-padding', `${sidePadding}px`);
      write(header, '--navigation-header-gap', `${headerGap}px`);
      write(header, '--navigation-columns', columns);
      // Large preferences remain stored as entered; the rendered header leaves
      // useful space for the chapter in short desktop windows. Extra nav rows
      // scroll inside the header rather than consuming the full viewport.
      const heightLimit = Math.max(116, Math.floor(window.innerHeight * .45));
      const headerHeight = Math.min(heightLimit, Math.max(wrapped ? 44 + wrappedRows * rowHeight : stacked ? 116 : 0, requestedHeight));
      write(shell, '--site-header-height', `${headerHeight}px`);
      if (current !== 'entry') {
        const inset = Math.min(readPixels(requested, '--compact-nav-inset', 48), Math.max(16, width * .1));
        const requestedGap = Math.min(readPixels(requested, '--compact-nav-gap', 14), width * .025);
        const compactAvailable = width - sidePadding - inset - measureBrand(false) - headerGap - 28 - 4 * requestedGap;
        const labelWidth = Math.max(...copies.map(({ heading }) => heading * scale));
        // Reuse the original brush title under each icon, fitting the two within
        // the requested header instead of substituting a separate small label.
        const compactIcon = Math.max(18, Math.min(icon, compactAvailable / items.length - 24,
          headerHeight - 10 - font * scale - 8));
        const itemWidth = Math.max(compactIcon, labelWidth) + 24;
        const compactStacked = itemWidth * items.length > compactAvailable;
        const navBudget = compactStacked ? width - 2 * sidePadding - 28 : compactAvailable + 4 * requestedGap;
        const gap = Math.max(0, Math.min(requestedGap, (navBudget - itemWidth * items.length) / 4));
        header.dataset.navLayout = compactStacked ? 'compact-stacked' : 'compact';
        write(header, '--navigation-icon-size', `${compactIcon}px`);
        write(header, '--navigation-compact-item-width', `${itemWidth}px`);
        write(header, '--navigation-compact-gap', `${gap}px`);
        write(header, '--navigation-compact-inset', `${inset}px`);
      }
    };
    const schedule = () => {
      if (active && !frame) frame = requestAnimationFrame(update);
    };
    const resize = new ResizeObserver(schedule);
    resize.observe(page);
    const mutations = new MutationObserver(schedule);
    mutations.observe(shell, { attributes: true, attributeFilter: ['style'] });
    document.fonts?.addEventListener('loadingdone', schedule);
    document.fonts?.ready.then(schedule);
    window.addEventListener('resize', schedule);
    update();
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      resize.disconnect();
      mutations.disconnect();
      document.fonts?.removeEventListener('loadingdone', schedule);
      window.removeEventListener('resize', schedule);
      if (initialHeaderHeight) shell.style.setProperty('--site-header-height', initialHeaderHeight);
      else shell.style.removeProperty('--site-header-height');
    };
  }, [headerRef, current, settings.headerHeight, settings.navFontSize, settings.helperFontSize,
    settings.navIconSize, settings.brandPadding, settings.homeBrandOffset, settings.compactNavGap, settings.compactNavInset]);
}
