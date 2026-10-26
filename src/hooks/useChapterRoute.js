import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { pageRoutes } from '../config/chapters.js';

const routes = new Set(pageRoutes);
const routeAliases = new Map([['intro', 'entry'], ['structure', 'model']]);
const readCandidate = () => window.location.hash.replace(/^#\/?/, '');
const readRoute = () => {
  const hashRoute = readCandidate();
  const candidate = routeAliases.get(hashRoute) ?? hashRoute;
  return routes.has(candidate) ? candidate : 'entry';
};

export function useChapterRoute(onBeforeChange) {
  const [route, setRoute] = useState(readRoute);
  const currentRoute = useRef(route);
  useLayoutEffect(() => { currentRoute.current = route; }, [route]);

  useEffect(() => {
    const syncRoute = () => {
      const next = readRoute();
      if (routeAliases.has(readCandidate())) {
        window.history.replaceState(window.history.state, '', `#/${next}`);
      }
      // Capture native history/hash navigation in the same callback before React commits.
      if (next !== currentRoute.current) onBeforeChange?.();
      setRoute(next);
    };
    syncRoute();
    window.addEventListener('hashchange', syncRoute);
    return () => window.removeEventListener('hashchange', syncRoute);
  }, [onBeforeChange]);

  const navigate = useCallback((next) => {
    const canonicalRoute = routeAliases.get(next) ?? next;
    if (!routes.has(canonicalRoute)) return;
    window.location.hash = `/${canonicalRoute}`;
    setRoute(canonicalRoute);
  }, []);

  return [route, navigate];
}
