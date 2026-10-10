import { lazy, Suspense, useEffect } from 'react';
import HomePage from './features/home/HomePage.jsx';
import IntroPage from './features/intro/IntroPage.jsx';
import ChapterPage from './features/chapters/ChapterPage.jsx';
import { useChapterRoute } from './hooks/useChapterRoute.js';

const ModelPage = lazy(() => import('./features/model/ModelPage.jsx'));

export default function App() {
  const [route, navigate] = useChapterRoute();
  useEffect(() => {
    document.body.dataset.state = route;
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [route]);

  let page;
  if (route === 'entry') page = <HomePage onNavigate={navigate} />;
  else if (route === 'intro') page = <IntroPage onEnded={() => navigate('model')} />;
  else if (route === 'model' || route === 'structure') page = <ModelPage route={route} onNavigate={navigate} />;
  else page = <ChapterPage route={route} onNavigate={navigate} />;

  return <main id="react-app" data-route={route}>
    <Suspense fallback={<div className="page-loading" role="status">正在加载章节…</div>}>{page}</Suspense>
  </main>;
}
