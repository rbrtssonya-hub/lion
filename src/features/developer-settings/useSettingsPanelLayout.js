import { useLayoutEffect, useState } from 'react';

export function useSettingsPanelLayout(open, panelRef, panelWidth, usePageWidth = true) {
  const [canPush, setCanPush] = useState(false);
  useLayoutEffect(() => {
    if (!open || !panelRef.current) return;
    const panel = panelRef.current;
    const update = () => {
      // Stable scrollbar gutters consume real page space even when clientWidth
      // still reports the full viewport. Never budget that gutter twice.
      const width = usePageWidth ? panel.closest('.site-shell')?.clientWidth ?? document.documentElement.clientWidth : document.documentElement.clientWidth;
      const available = width - panel.getBoundingClientRect().width;
      setCanPush(available >= 900);
    };
    const observer = new ResizeObserver(update);
    observer.observe(panel);
    window.addEventListener('resize', update);
    update();
    return () => { observer.disconnect(); window.removeEventListener('resize', update); };
  }, [open, panelRef, panelWidth, usePageWidth]);
  return canPush;
}
