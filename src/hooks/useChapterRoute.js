import { useCallback, useEffect, useState } from 'react';
import { chapters } from '../config/chapters.js';

const routes = new Set(chapters.map((chapter) => chapter.route));
const routeAliases = new Map([['intro', 'entry'], ['structure', 'model']]);
const readCandidate = () => window.location.hash.replace(/^#\/?/, '');
const readRoute = () => {
  const hashRoute = readCandidate();
  const candidate = routeAliases.get(hashRoute) ?? hashRoute;
  return routes.has(candidate) ? candidate : 'entry';
};

export function useChapterRoute() {
  const [route, setRoute] = useState(readRoute);

  useEffect(() => {
    const syncRoute = () => {
      const next = readRoute();
      if (routeAliases.has(readCandidate())) {
        window.history.replaceState(window.history.state, '', `#/${next}`);
      }
      setRoute(next);
    };
    syncRoute();
    window.addEventListener('hashchange', syncRoute);
    return () => window.removeEventListener('hashchange', syncRoute);
  }, []);

  const navigate = useCallback((next) => {
    const canonicalRoute = routeAliases.get(next) ?? next;
    if (!routes.has(canonicalRoute)) return;
    window.location.hash = `/${canonicalRoute}`;
    setRoute(canonicalRoute);
  }, []);

  return [route, navigate];
}
