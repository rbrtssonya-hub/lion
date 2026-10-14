import { Component, lazy, Suspense, useEffect, useRef, useState } from 'react';
import { media } from '../../config/media.js';
import LionArchiveOrnament from './LionArchiveOrnament.jsx';
import '../../styles/lion-book.css';

const LionBookExperience = lazy(() => import('./LionBookExperience.jsx'));

function BookPlaceholder({ failed = false, onRetry }) {
  return <div className="lion-book-placeholder" role="status">
    <img src={media.lionBookCover} alt="岭南醒狮志，红金醒狮水彩手绘展开页" width="1760" height="1240" />
    <p>{failed ? '史册暂未展开，请重试。' : '正在展开史册…'}{failed && <button type="button" onClick={onRetry}>重新展开</button>}</p>
  </div>;
}

class BookBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <BookPlaceholder failed onRetry={() => window.location.reload()} /> : this.props.children; }
}

export default function HomeLionBook() {
  const sectionRef = useRef(null);
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setEntered(true); observer.disconnect(); }
    }, { rootMargin: '0px 0px -40px 0px' });
    observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return <section className="lion-book-section" id="homeLionBook" ref={sectionRef} aria-labelledby="lion-book-title">
    <div className="lion-book-inner">
      <header className="lion-book-heading">
        <div className="lion-book-title-group">
          <p className="lion-book-overline">南风 · 藏卷 <span>LINGNAN HERITAGE CHRONICLE</span></p>
          <div className="lion-archive-title-line"><h2 id="lion-book-title"><span>岭南</span>醒狮志</h2><LionArchiveOrnament /></div>
          <div className="lion-archive-tags"><span>狮舞</span><i aria-hidden="true" /><span>鼓韵</span><i aria-hidden="true" /><span>匠心</span></div>
        </div>
        <div className="lion-book-preface"><span className="lion-book-preface-label">循鼓入卷 · 读狮知岭南</span><p>一狮一鼓，百年传承</p><span>翻一页纸，循一脉鼓声。<br />从瑞兽的想象，读到今日岭南。</span></div>
      </header>
      <BookBoundary><Suspense fallback={<BookPlaceholder />}>
        {entered ? <LionBookExperience /> : <BookPlaceholder />}
      </Suspense></BookBoundary>
    </div>
  </section>;
}
