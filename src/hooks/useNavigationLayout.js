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
    const write = (element, property, value) => {
      if (element.style.getPropertyValue(property) !== value) element.style.setProperty(property, value);
    };
    const textUnits = element => {
      range.selectNodeContents(element);
      const size = Number.parseFloat(getComputedStyle(element).fontSize);
      return size > 0 ? range.getBoundingClientRect().width / size : 0;
    };
    const measureCopy = (item, font, helperFont) => {
      // Visible copy can be in the middle of a compressed return flight.
      // Measure an untransformed clone so font/resize notifications cannot
      // change the grid based on the current animation scale.
      const copy = item.querySelector('.site-nav-copy').cloneNode(true);
      copy.style.cssText = 'display:flex;position:absolute;left:-10000px;top:0;visibility:hidden;pointer-events:none;width:max-content;transform:none;opacity:1';
      header.append(copy);
      const width = textUnits(copy.querySelector('.site-nav-heading strong')) * font
        + textUnits(copy.querySelector('.site-nav-description')) * helperFont;
      copy.remove();
      return width;
    };
    const update = () => {
      frame = 0;
      if (!active) return;
      const width = page.getBoundingClientRect().width;
      const requested = getComputedStyle(shell);
      const requestedHeight = readPixels(requested, '--header-height', 90);
      const font = readPixels(requested, '--nav-font-size', 26);
      const helperFont = readPixels(requested, '--nav-helper-font-size', 18);
      if (width < 700) {
        header.dataset.navLayout = 'mobile';
        write(header, '--site-nav-font-size', `${Math.min(16, Math.max(12, font * .58))}px`);
        write(shell, '--site-header-height', `${Math.max(116, requestedHeight)}px`);
        return;
      }

      const requestedIcon = readPixels(requested, '--requested-nav-icon-size', 40);
      const requestedPadding = readPixels(requested, '--brand-padding', 24);
      const density = Math.min(1, width / 1600);
      // Include the button's vertical padding and the header border in the height budget.
      const icon = Math.min(requestedIcon, Math.max(20, requestedIcon * density * density), requestedHeight - 44);
      const homeOffset = Math.min(readPixels(requested, '--home-brand-offset', 24), Math.max(0, width * .12));
      write(header, '--navigation-home-brand-offset', `${homeOffset}px`);
      if (current !== 'entry') {
        const sidePadding = Math.min(requestedPadding, Math.max(8, width * .02));
        const inset = Math.min(readPixels(requested, '--compact-nav-inset', 48), Math.max(16, width * .1));
        const gap = Math.min(readPixels(requested, '--compact-nav-gap', 14), width * .025);
        const brandWidth = header.querySelector('.site-brand-capsule').getBoundingClientRect().width;
        const available = width - sidePadding - inset - brandWidth - Math.min(28, width * .011) - 28 - 3 * gap;
        const compactIcon = Math.max(18, Math.min(icon, available / 4 - 24));
        header.dataset.navLayout = 'compact';
        write(header, '--navigation-icon-size', `${compactIcon}px`);
        write(header, '--navigation-compact-gap', `${gap}px`);
        write(header, '--navigation-compact-inset', `${inset}px`);
        write(header, '--navigation-copy-shift', `${Math.min(36, Math.max(8, inset - 16))}px`);
        write(header, '--navigation-side-padding', `${sidePadding}px`);
        write(shell, '--site-header-height', `${requestedHeight}px`);
        return;
      }
      // Expose the complete text before measuring when leaving the compact layout.
      header.dataset.navLayout = 'inline';
      const headingGap = 6 * density;
      const copyGap = 8 * density;
      const itemGap = 8 * density;
      const itemPadding = 6 * density;
      const sidePadding = Math.min(requestedPadding, Math.max(8, width * .02));
      const headerGap = Math.min(28, width * .011);
      const items = [...header.querySelectorAll('.site-nav-item')];
      // Fit both text sizes together so narrowing the page preserves their hierarchy.
      const textWidths = items.map(item => measureCopy(item, font, helperFont));
      const totalTextWidth = textWidths.reduce((sum, value) => sum + value, 0);
      const fixedWidth = icon + headingGap + copyGap + itemGap + 2 * itemPadding;
      const brandWidth = header.querySelector('.site-brand-capsule').getBoundingClientRect().width;
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
      const extra = Math.max(0, (available - totalTextWidth * scale - fixedWidth * items.length) / items.length);
      const columns = textWidths.map(value => `${value * scale + fixedWidth + extra}px`).join(' ');
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
      write(shell, '--site-header-height', `${Math.max(stacked ? 116 : 0, requestedHeight)}px`);
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
