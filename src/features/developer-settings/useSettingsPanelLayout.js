import { useLayoutEffect, useState } from 'react';

export function useSettingsPanelLayout(open, panelRef, panelWidth) {
  const [canPush, setCanPush] = useState(false);
  useLayoutEffect(() => {
    if (!open || !panelRef.current) return;
    const panel = panelRef.current;
    const update = () => {
      // Keep the existing three-column model layout usable; preserve the user's preference.
      const available = document.documentElement.clientWidth - panel.getBoundingClientRect().width;
      setCanPush(available >= 900);
    };
    const observer = new ResizeObserver(update);
    observer.observe(panel);
    window.addEventListener('resize', update);
    update();
    return () => { observer.disconnect(); window.removeEventListener('resize', update); };
  }, [open, panelRef, panelWidth]);
  return canPush;
}
