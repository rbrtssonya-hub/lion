import { Component, lazy, Suspense, useEffect, useRef, useState } from 'react';
import { media } from '../../config/media.js';
import '../../styles/lion-book.css';
import { withStartupTimeout } from '../loading/useStartupLoading.js';

export const preloadLionBookExperience = () => withStartupTimeout(import('./LionBookExperience.jsx'), 25_000, '史册组件准备超时');
const LionBookExperience = lazy(preloadLionBookExperience);

function BookPlaceholder({ failed = false, onRetry }) {
  return <div className="lion-book-placeholder" role="status">
    <img src={media.lionBookCover} alt="岭南醒狮志，红金醒狮水彩手绘展开页" width="1760" height="1240" />
    <p>{failed ? '史册暂未展开，请重试。' : '正在展开史册…'}{failed && <button type="button" onClick={onRetry}>重新展开</button>}</p>
  </div>;
}

class BookBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onReady?.(false, '史册交互模块加载失败'); }
  render() { return this.state.failed ? <BookPlaceholder failed onRetry={() => window.location.reload()} /> : this.props.children; }
}

export default function HomeLionBook({ settings = {}, preload = false, playbackEnabled = true, onReady, onArchiveWheel }) {
  const sectionRef = useRef(null);
  const [entered, setEntered] = useState(preload);
  const { bookScale = 116, bookStageHeight = 680, bookGuideScale = 150, bookGuideVerticalSpacing = 32, bookInkEnabled = true, bookAutoplay = true, bookPageInterval = 8 } = settings;
  const guideScale = bookGuideScale / 100;
  useEffect(() => { if (preload) setEntered(true); }, [preload]);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setEntered(true); observer.disconnect(); }
    }, { rootMargin: '0px 0px -40px 0px' });
    observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return <section className="lion-book-section" id="homeLionBook" ref={sectionRef} aria-labelledby="lion-book-title"
    style={{ '--book-scale': bookScale / 100, '--book-layout-ratio': Math.min(1, bookScale / 116), '--book-stage-height': `${bookStageHeight}px`,
      '--book-guide-normal-size': `${96 * guideScale}px`, '--book-guide-short-size': `${80 * guideScale}px`,
      '--book-guide-normal-lift': `${48 * (guideScale - 1)}px`, '--book-guide-short-lift': `${40 * (guideScale - 1)}px`,
      '--book-guide-vertical-spacing': `${bookGuideVerticalSpacing}px` }}>
    <div className="lion-book-inner">
      <header className="lion-book-heading archive-reading-panel" data-surface="bookTitle">
        <div className="lion-book-title-group">
          <div className="lion-archive-title-line"><h2 id="lion-book-title"><span>岭南</span>醒狮志</h2></div>
        </div>
        <div className="lion-book-preface"><p>一狮一鼓，百年传承</p><span>翻一页纸，循一脉鼓声。从瑞兽的想象，读到今日岭南。</span></div>
      </header>
      <BookBoundary onReady={onReady}><Suspense fallback={<BookPlaceholder />}>
        {entered || preload ? <LionBookExperience autoplay={bookAutoplay} pageInterval={bookPageInterval} scale={bookScale / 100} inkEnabled={bookInkEnabled} playbackEnabled={playbackEnabled} onReady={onReady} onArchiveWheel={onArchiveWheel} /> : <BookPlaceholder />}
      </Suspense></BookBoundary>
    </div>
  </section>;
}
