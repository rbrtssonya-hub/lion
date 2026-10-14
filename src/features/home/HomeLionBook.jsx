import { Component, lazy, Suspense, useEffect, useRef, useState } from 'react';
import { media } from '../../config/media.js';
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
        <div>
          <p className="lion-book-overline">南风 · 藏卷 <span>LINGNAN HERITAGE CHRONICLE</span></p>
          <h2 id="lion-book-title">岭南醒狮志<span className="lion-book-seal" aria-hidden="true">狮<br />志</span></h2>
        </div>
        <div className="lion-book-preface"><p>一狮一鼓，百年传承</p><span>翻一页纸，循一脉鼓声。<br />从瑞兽的想象，读到今日岭南。</span></div>
      </header>
      <BookBoundary><Suspense fallback={<BookPlaceholder />}>
        {entered ? <LionBookExperience /> : <BookPlaceholder />}
      </Suspense></BookBoundary>
    </div>
  </section>;
}
