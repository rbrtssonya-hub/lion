import { Component, lazy, Suspense, useEffect, useRef, useState } from 'react';
import { media } from '../../config/media.js';
import LionArchiveOrnament from './LionArchiveOrnament.jsx';
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

export default function HomeLionBook({ settings = {}, introDuration = 12, preload = false, playbackEnabled = true, onReady }) {
  const sectionRef = useRef(null);
  const [entered, setEntered] = useState(preload);
  const { bookScale = 116, bookStageHeight = 680, bookInkEnabled = true } = settings;
  useEffect(() => { if (preload) setEntered(true); }, [preload]);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setEntered(true); observer.disconnect(); }
    }, { rootMargin: '0px 0px -40px 0px' });
    observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return <section className="lion-book-section" id="homeLionBook" ref={sectionRef} aria-labelledby="lion-book-title"
    style={{ '--book-scale': bookScale / 100, '--book-stage-height': `${bookStageHeight}px` }}>
    <div className="lion-book-inner">
      <header className="lion-book-heading archive-reading-panel" data-surface="bookTitle">
        <div className="lion-book-title-group">
          <div className="lion-archive-title-line"><h2 id="lion-book-title"><span>岭南</span>醒狮志</h2><LionArchiveOrnament /></div>
        </div>
        <div className="lion-book-preface"><p>一狮一鼓，百年传承</p><span>翻一页纸，循一脉鼓声。<br />从瑞兽的想象，读到今日岭南。</span></div>
      </header>
      <BookBoundary onReady={onReady}><Suspense fallback={<BookPlaceholder />}>
        {entered || preload ? <LionBookExperience introDuration={introDuration} scale={bookScale / 100} inkEnabled={bookInkEnabled} playbackEnabled={playbackEnabled} onReady={onReady} /> : <BookPlaceholder />}
      </Suspense></BookBoundary>
    </div>
  </section>;
}
