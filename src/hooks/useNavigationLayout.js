import { useLayoutEffect } from 'react';

const readPixels = (style, property, fallback) => {
  const value = Number.parseFloat(style.getPropertyValue(property));
  return Number.isFinite(value) ? value : fallback;
};

// Measure the rendered font rather than assuming every label needs the same space.
// This also responds to browser zoom and to the width left by a pushed settings panel.
export function useNavigationLayout(headerRef) {
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
    const update = () => {
      frame = 0;
      if (!active) return;
      const width = page.getBoundingClientRect().width;
      const requested = getComputedStyle(shell);
      const requestedHeight = readPixels(requested, '--header-height', 90);
      const font = readPixels(requested, '--nav-font-size', 26);
      if (width < 700) {
        header.dataset.navLayout = 'mobile';
        write(header, '--site-nav-font-size', `${Math.min(16, Math.max(12, font * .58))}px`);
        write(shell, '--site-header-height', `${Math.max(116, requestedHeight)}px`);
        return;
      }

      // Expose the complete text before measuring when leaving the mobile layout.
      header.dataset.navLayout = 'inline';
      const requestedIcon = readPixels(requested, '--requested-nav-icon-size', 40);
      const requestedPadding = readPixels(requested, '--brand-padding', 24);
      const density = Math.min(1, width / 1600);
      // Include the button's vertical padding and the header border in the height budget.
      const icon = Math.min(requestedIcon, Math.max(20, requestedIcon * density * density), requestedHeight - 21);
      const headingGap = 6 * density;
      const copyGap = 8 * density;
      const itemGap = 8 * density;
      const itemPadding = 6 * density;
      const sidePadding = Math.min(requestedPadding, Math.max(8, width * .02));
      const headerGap = Math.min(28, width * .011);
      const items = [...header.querySelectorAll('.site-nav-item')];
      const units = items.map(item => [...item.querySelectorAll('.site-nav-heading strong, .site-nav-description')]
        .reduce((sum, element) => sum + textUnits(element), 0));
      const totalUnits = units.reduce((sum, value) => sum + value, 0);
      const fixedWidth = icon + headingGap + copyGap + itemGap + 2 * itemPadding;
      const brandWidth = header.querySelector('.site-brand').getBoundingClientRect().width;
      let available = width - 2 * sidePadding - brandWidth - headerGap;
      let fittedFont = Math.min(font, (available - fixedWidth * items.length) / totalUnits);
      const stacked = fittedFont < Math.min(font, 16);
      if (stacked) {
        header.dataset.navLayout = 'stacked';
        available = width - 2 * sidePadding;
        fittedFont = Math.min(font, (available - fixedWidth * items.length) / totalUnits);
      }
      // Leave a subpixel margin for the browser's grid-track rounding.
      if (fittedFont < font) fittedFont = Math.floor((fittedFont - .08) * 100) / 100;
      const extra = Math.max(0, (available - totalUnits * fittedFont - fixedWidth * items.length) / items.length);
      const columns = units.map(value => `${value * fittedFont + fixedWidth + extra}px`).join(' ');
      write(header, '--site-nav-font-size', `${fittedFont}px`);
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
  }, [headerRef]);
}
