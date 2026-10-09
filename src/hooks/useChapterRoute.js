import { useCallback, useEffect, useState } from 'react';
import { chapters } from '../config/chapters.js';

const routes = new Set(['entry', ...chapters.map((chapter) => chapter.route)]);
const readRoute = () => {
  const candidate = window.location.hash.replace(/^#\/?/, '');
  return routes.has(candidate) ? candidate : 'entry';
};

export function useChapterRoute() {
  const [route, setRoute] = useState(readRoute);

  useEffect(() => {
    const syncRoute = () => setRoute(readRoute());
    window.addEventListener('hashchange', syncRoute);
    return () => window.removeEventListener('hashchange', syncRoute);
  }, []);

  const navigate = useCallback((next) => {
    if (!routes.has(next)) return;
    window.location.hash = `/${next}`;
    setRoute(next);
  }, []);

  return [route, navigate];
}
