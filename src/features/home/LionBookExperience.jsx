import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Sketchbook } from '@designcodeio/threeui';
import '@designcodeio/threeui/style.css';
import { media } from '../../config/media.js';
import { lionBookPages } from '../../data/lion-book.js';

const fileBase = media.lionBookCover.slice(0, media.lionBookCover.lastIndexOf('/') + 1);
const introSessionKey = 'nanfeng-lion:book-intro-seen:v1';
let introConsumedInThisPage = false;

function hasConsumedIntro() {
  try { return introConsumedInThisPage || sessionStorage.getItem(introSessionKey) === '1'; }
  catch { return introConsumedInThisPage; }
}

function consumeIntro() {
  introConsumedInThisPage = true;
  try { sessionStorage.setItem(introSessionKey, '1'); }
  catch { /* Preserve once-per-page-session behavior when storage is unavailable. */ }
}

export default function LionBookExperience() {
  const hostRef = useRef(null);
  const frameRef = useRef(null);
  const channelRef = useRef(null);
  const [attempt, setAttempt] = useState(0);
  const channelId = useMemo(() => crypto.randomUUID(), [attempt]);
  const assetBaseUrl = useMemo(() => {
    const url = new URL(fileBase, window.location.href);
    url.hash = `lion-book=${channelId}`;
    return url.href;
  }, [channelId]);
  const [book, setBook] = useState({ index: 0, turning: false, ready: false, intro: 'pending', error: null });
  const current = lionBookPages[book.index];
  const send = useCallback((action, value) => {
    const command = { type: 'lion-book:command', channelId: channelRef.current, action };
    if (action === 'visibility') command.visible = value;
    else if (action === 'intro-policy') command.enabled = value;
    else if (Number.isInteger(value)) command.index = value;
    frameRef.current?.contentWindow?.postMessage(command, '*');
  }, []);

  useLayoutEffect(() => {
    const frame = hostRef.current.querySelector('iframe');
    if (!frame) return undefined;
    frameRef.current = frame;
    channelRef.current = channelId;
    let active = true;
    let scrollFrame = null;
    let scrollDelta = 0;
    let stageVisible = false;
    let focusTimer = null;
    const publishVisibility = () => send('visibility', stageVisible && !document.hidden && document.hasFocus());
    // Focusing the sandbox also blurs the parent window. Wait until the focus
    // transfer completes, then test the whole document (including its iframe).
    const onWindowBlur = () => {
      clearTimeout(focusTimer);
      focusTimer = setTimeout(publishVisibility, 0);
    };
    const observer = new IntersectionObserver(([entry]) => {
      stageVisible = entry.isIntersecting && entry.intersectionRatio >= .6;
      publishVisibility();
    }, { threshold: [0, .6] });
    observer.observe(hostRef.current);
    document.addEventListener('visibilitychange', publishVisibility);
    window.addEventListener('focus', publishVisibility);
    window.addEventListener('blur', onWindowBlur);
    const receive = (event) => {
      if (!active || event.source !== frame.contentWindow || event.data?.channelId !== channelId) return;
      const data = event.data;
      if (data.type === 'lion-book:state') {
        if (!Number.isInteger(data.index) || data.index < 0 || data.index >= lionBookPages.length) return;
        if (typeof data.ready !== 'boolean' || typeof data.turning !== 'boolean') return;
        if (!['pending', 'playing', 'done'].includes(data.intro)) return;
        if (typeof data.introConsumed !== 'boolean') return;
        // Only the real engine start or deliberate paper input consumes the
        // visit. Lazy mounting, loading and visibility alone do not.
        if (data.introConsumed) consumeIntro();
        if (data.ready || data.error) clearTimeout(loadTimeout);
        setBook({ index: data.index, turning: data.turning, ready: data.ready, intro: data.intro, error: data.error ? '书页加载失败' : null });
      } else if (data.type === 'lion-book:wheel' && Number.isFinite(data.deltaY)) {
        scrollDelta += Math.max(-1600, Math.min(1600, data.deltaY));
        if (scrollFrame === null) scrollFrame = requestAnimationFrame(() => {
          window.scrollBy({ top: scrollDelta, behavior: 'instant' });
          scrollDelta = 0; scrollFrame = null;
        });
      }
    };
    window.addEventListener('message', receive);
    const loadTimeout = setTimeout(() => {
      if (active) setBook((previous) => ({ ...previous, error: '史册加载时间较长，请重试' }));
    }, 25_000);
    const sync = () => {
      frame.title = '岭南醒狮志 · 拖动书页翻阅文化史册';
      send('intro-policy', !hasConsumedIntro());
      send('sync');
      publishVisibility();
    };
    frame.addEventListener('load', sync);
    frame.title = '岭南醒狮志 · 拖动书页翻阅文化史册';
    sync();
    return () => {
      active = false;
      // Removing/replacing the official iframe destroys its browsing context;
      // its pagehide listener also disposes the engine. Effect replay in React
      // StrictMode must not dispose a document that remains mounted.
      window.removeEventListener('message', receive);
      frame.removeEventListener('load', sync);
      observer.disconnect();
      document.removeEventListener('visibilitychange', publishVisibility);
      window.removeEventListener('focus', publishVisibility);
      window.removeEventListener('blur', onWindowBlur);
      clearTimeout(focusTimer);
      clearTimeout(loadTimeout);
      if (scrollFrame !== null) cancelAnimationFrame(scrollFrame);
      frameRef.current = null;
    };
  }, [channelId, send]);

  const retry = () => {
    setBook({ index: 0, turning: false, ready: false, intro: 'pending', error: null });
    setAttempt((value) => value + 1);
  };
  return <div className="lion-book-experience" data-book-ready={book.ready} data-book-index={book.index} data-book-turning={book.turning} data-book-intro={book.intro} data-book-error={Boolean(book.error)}
    onKeyDown={(event) => {
      if (event.metaKey || event.ctrlKey || event.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return;
      const action = { ArrowRight: 'next', ArrowLeft: 'previous', Home: 'goTo', End: 'goTo' }[event.key];
      if (!action || !book.ready) return;
      event.preventDefault();
      send(action, event.key === 'End' ? lionBookPages.length - 1 : 0);
    }}>
    <div className="lion-book-figure-meta"><span>手绘档案 <i /> {String(book.index + 1).padStart(2, '0')} / 07</span><span>岭南风物 · 纸上留声</span></div>
    <div className="lion-book-stage" ref={hostRef}>
      <Sketchbook assetBaseUrl={assetBaseUrl} />
      {!book.ready && !book.error && <p className="lion-book-load" role="status">正在展开史册…</p>}
      {book.error && <div className="lion-book-error" role="alert"><p>{book.error}</p><button type="button" onClick={retry}>重新展开</button></div>}
    </div>
    <p className="lion-book-instructions" id="lion-book-instructions"><span aria-hidden="true">↔</span> 拖动左右书页，翻阅醒狮往事 <span className="lion-book-key-hint">也可点选年代 · 左右方向键翻页</span></p>
    <nav className="lion-book-timeline" aria-label="醒狮历史时间线" aria-describedby="lion-book-instructions">
      {lionBookPages.map((page, index) => <button type="button" key={page.id} data-book-page={page.id} className={index === 0 || index === 6 ? 'lion-book-endpoint' : ''}
        aria-label={`翻阅${page.stage}：${page.title}`} aria-current={book.index === index ? 'step' : undefined} disabled={!book.ready}
        onClick={() => send('goTo', index)}>
        <span className="lion-book-node" aria-hidden="true">{index === 0 ? '序' : index === 6 ? '终' : String(index).padStart(2, '0')}</span>
        <span>{page.stage}</span><small>{index > 0 && index < 6 ? page.era : index === 0 ? '开启史册' : '南风有狮'}</small>
      </button>)}
    </nav>
    <div className="lion-book-reading" aria-live={book.intro === 'playing' ? 'off' : 'polite'} aria-atomic="true">
      <div className="lion-book-reading-title"><p>{current.era}</p><h3>{current.title}</h3></div>
      <div className="lion-book-reading-copy"><p>{current.description}</p><a href={current.sourceUrl} target="_blank" rel="noreferrer">资料依据：{current.source} <span aria-hidden="true">↗</span></a>
        {current.additionalSource && <a className="lion-book-additional-source" href={current.additionalSource.url} target="_blank" rel="noreferrer">{current.additionalSource.label} ↗</a>}
      </div>
    </div>
    <footer className="lion-book-provenance"><span>AI辅助绘制 · 历史主题示意，非文物或史料影像。年代为叙事分期，文化传承延续交叠。</span><span><a href={media.lionBookLicense} target="_blank" rel="noreferrer">Sketchbook · ThreeUI / MIT</a>{' · '}<a href={media.lionBookFontLicense} target="_blank" rel="noreferrer">字体许可</a></span></footer>
  </div>;
}
