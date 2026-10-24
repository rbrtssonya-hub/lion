import { useLayoutEffect, useRef, useState } from 'react';

// Keep the old chapter alive for its short exit. The navigation can respond
// immediately while scene resources retain their existing mount boundaries.
export function useChapterTransition(route) {
  const displayed = useRef(route);
  const [scene, setScene] = useState({ route, phase: 'idle' });
  useLayoutEffect(() => {
    let timer;
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const settle = () => {
      clearTimeout(timer);
      displayed.current = route;
      setScene({ route, phase: 'idle' });
    };
    if (route === displayed.current || preference.matches) settle();
    else {
      setScene(previous => ({ ...previous, phase: 'leaving' }));
      timer = setTimeout(() => {
        displayed.current = route;
        setScene({ route, phase: 'revealing' });
        timer = setTimeout(() => setScene({ route, phase: 'idle' }), 540);
      }, 140);
    }
    const onPreference = () => { if (preference.matches) settle(); };
    preference.addEventListener('change', onPreference);
    return () => { clearTimeout(timer); preference.removeEventListener('change', onPreference); };
  }, [route]);
  return scene;
}
