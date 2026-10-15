import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Sketchbook } from '@designcodeio/threeui';
import '@designcodeio/threeui/style.css';
import { media } from '../../config/media.js';
import { lionBookPages } from '../../data/lion-book.js';

const fileBase = media.lionBookCover.slice(0, media.lionBookCover.lastIndexOf('/') + 1);
const introSessionKey = 'nanfeng-lion:book-intro-seen:v1';
let introConsumedInThisPage = false;
const wavePoints = lionBookPages.map((_, index) => ({ x: 60 + index * 880 / 6, y: [64, 38, 64, 90, 64, 38, 64][index] }));
const wavePath = wavePoints.reduce((path, point, index) => {
  if (!index) return `M ${point.x} ${point.y}`;
  const previous = wavePoints[index - 1];
  return `${path} C ${previous.x + 49} ${previous.y}, ${point.x - 49} ${point.y}, ${point.x} ${point.y}`;
}, '');

function LionTimelineEmblem() {
  return <svg viewBox="0 0 80 80" fill="none" aria-hidden="true">
    <path d="M17 27 9 20l3-10 16 8M63 27l8-7-3-10-16 8" fill="#a43629" stroke="#d5a763" strokeWidth="2" />
    <path d="M40 8c9 0 15 5 18 13 10 2 15 11 12 21-1 7-5 13-10 18-6 6-12 11-20 13-8-2-14-7-20-13-5-5-9-11-10-18-3-10 2-19 12-21C25 13 31 8 40 8Z" fill="#a43629" stroke="#ebc483" strokeWidth="2" />
    <path d="m40 12 5 7-5 6-5-6 5-7ZM20 28c5-5 12-5 16 0M44 28c4-5 11-5 16 0" stroke="#f3d49d" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M16 37c0-6 6-10 12-9 7 1 10 8 7 13-4 7-19 4-19-4Zm48 0c0-6-6-10-12-9-7 1-10 8-7 13 4 7 19 4 19-4Z" fill="#fbebca" stroke="#d6aa68" strokeWidth="1.5" />
    <circle cx="27" cy="36" r="5" fill="#332d27" /><circle cx="53" cy="36" r="5" fill="#332d27" />
    <circle cx="28.5" cy="34.5" r="1.7" fill="#fff8e8" /><circle cx="51.5" cy="34.5" r="1.7" fill="#fff8e8" />
    <path d="M33 46c2-6 12-6 14 0l-3 5h-8l-3-5Z" fill="#e4bb78" stroke="#f8db9e" strokeWidth="1.5" />
    <path d="M23 49c4 7 10 5 17 8 7-3 13-1 17-8M25 57c8 11 22 11 30 0M31 63l2 5m7-3v5m7-7-2 5M16 45l5 2m43-2-5 2" stroke="#f5d9a4" strokeWidth="2.4" strokeLinecap="round" />
  </svg>;
}

function BookTimeline({ book, send, inkEnabled, playbackEnabled }) {
  const navRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [trail, setTrail] = useState({ from: 0, to: 0, id: 0 });
  const previousIndex = useRef(book.index);
  const filterId = useMemo(() => `book-ink-${crypto.randomUUID()}`, []);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    observer.observe(navRef.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (previousIndex.current !== book.index) {
      setTrail({ from: previousIndex.current, to: book.index, id: performance.now() });
      previousIndex.current = book.index;
    }
  }, [book.index]);
  const currentPoint = wavePoints[book.index];
  return <nav ref={navRef} className="lion-book-timeline" aria-label="醒狮历史时间线" aria-describedby="lion-book-instructions"
    data-ink-enabled={inkEnabled} data-ink-playing={visible && playbackEnabled}>
    <svg className="lion-book-wave" viewBox="0 0 1000 142" preserveAspectRatio="none" fill="none" aria-hidden="true">
      <defs><filter id={filterId} x="-10%" y="-100%" width="120%" height="300%"><feTurbulence type="fractalNoise" baseFrequency=".035 .14" numOctaves="2" seed="8" result="grain" /><feDisplacementMap in="SourceGraphic" in2="grain" scale="5" xChannelSelector="R" yChannelSelector="G" /><feGaussianBlur stdDeviation=".6" /></filter></defs>
      <path className="lion-book-wave-wash" d={wavePath} filter={`url(#${filterId})`} />
      <path className="lion-book-wave-line" d={wavePath} />
      <path className="lion-book-wave-gold" d={wavePath} />
      <path className="lion-book-ink-flow" d={wavePath} pathLength="1" filter={`url(#${filterId})`} />
      {trail.from !== trail.to && <path key={trail.id} className="lion-book-ink-trail" d={wavePath} pathLength="1" filter={`url(#${filterId})`}
        strokeDasharray={`${Math.abs(trail.to - trail.from) / 6} 1`} strokeDashoffset={-Math.min(trail.from, trail.to) / 6} />}
    </svg>
    <span className="lion-book-traveling-lion" aria-hidden="true" style={{ left: `${currentPoint.x / 10}%`, top: `${currentPoint.y}px` }}><LionTimelineEmblem /></span>
    {lionBookPages.map((page, index) => <button type="button" key={page.id} data-book-page={page.id} className={index === 0 || index === 6 ? 'lion-book-endpoint' : ''}
      style={{ left: `${wavePoints[index].x / 10}%`, top: `${wavePoints[index].y - 18}px` }}
      aria-label={`翻阅${page.stage}：${page.title}`} aria-current={book.index === index ? 'step' : undefined} disabled={!book.ready || !playbackEnabled}
      onClick={() => {
        setTrail({ from: book.index, to: index, id: performance.now() });
        send('goTo', index);
      }}>
      <span className="lion-book-node" aria-hidden="true">{index === 0 ? '序' : index === 6 ? '终' : String(index).padStart(2, '0')}</span>
      <span className="lion-book-wave-label">{page.stage}</span><small>{index > 0 && index < 6 ? page.era : index === 0 ? '开启史册' : '南风有狮'}</small>
    </button>)}
  </nav>;
}

function hasConsumedIntro() {
  try { return introConsumedInThisPage || sessionStorage.getItem(introSessionKey) === '1'; }
  catch { return introConsumedInThisPage; }
}

function consumeIntro() {
  introConsumedInThisPage = true;
  try { sessionStorage.setItem(introSessionKey, '1'); }
  catch { /* Preserve once-per-page-session behavior when storage is unavailable. */ }
}

export default function LionBookExperience({ introDuration = 12, scale = 1.16, inkEnabled = true, playbackEnabled = true, onReady }) {
  const hostRef = useRef(null);
  const introDurationRef = useRef(introDuration);
  introDurationRef.current = introDuration;
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const frameRef = useRef(null);
  const channelRef = useRef(null);
  const playbackEnabledRef = useRef(playbackEnabled);
  const visibilityPublisher = useRef(null);
  const onReadyRef = useRef(onReady);
  playbackEnabledRef.current = playbackEnabled;
  onReadyRef.current = onReady;
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
    else if (action === 'intro-duration') command.seconds = value;
    else if (action === 'book-scale') command.scale = value;
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
    const publishVisibility = () => send('visibility', playbackEnabledRef.current && stageVisible && !document.hidden && document.hasFocus());
    visibilityPublisher.current = publishVisibility;
    // Focusing the sandbox also blurs the parent window. Wait until the focus
    // transfer completes, then test the whole document (including its iframe).
    const onWindowBlur = () => {
      clearTimeout(focusTimer);
      focusTimer = setTimeout(publishVisibility, 0);
    };
    const observer = new IntersectionObserver(([entry]) => {
      // A deliberately tall stage must still play in a short desktop window.
      // Require most of the paper stage, or a substantial part of the viewport.
      const requiredHeight = Math.min(entry.boundingClientRect.height * .6, window.innerHeight * .48);
      stageVisible = entry.isIntersecting && entry.intersectionRect.height >= requiredHeight;
      publishVisibility();
    }, { threshold: Array.from({ length: 101 }, (_, index) => index / 100) });
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
      send('intro-duration', introDurationRef.current);
      send('book-scale', scaleRef.current);
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
      visibilityPublisher.current = null;
    };
  }, [channelId, send]);

  useLayoutEffect(() => {
    send('intro-duration', introDuration);
  }, [introDuration, send]);
  useLayoutEffect(() => { send('book-scale', scale); }, [scale, send]);

  useLayoutEffect(() => { visibilityPublisher.current?.(); }, [playbackEnabled]);
  useEffect(() => {
    if (book.ready || book.error) onReadyRef.current?.(book.ready, book.error);
  }, [book.ready, book.error]);

  const retry = () => {
    setBook({ index: 0, turning: false, ready: false, intro: 'pending', error: null });
    setAttempt((value) => value + 1);
  };
  return <div className="lion-book-experience" data-book-ready={book.ready} data-book-index={book.index} data-book-turning={book.turning} data-book-intro={book.intro} data-book-error={Boolean(book.error)}
    onKeyDown={(event) => {
      if (event.metaKey || event.ctrlKey || event.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return;
      const action = { ArrowRight: 'next', ArrowLeft: 'previous', Home: 'goTo', End: 'goTo' }[event.key];
      if (!action || !book.ready || !playbackEnabled) return;
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
    <BookTimeline book={book} send={send} inkEnabled={inkEnabled} playbackEnabled={playbackEnabled} />
    <div className="lion-book-reading archive-reading-panel" data-surface="bookDetails" aria-live={book.intro === 'playing' ? 'off' : 'polite'} aria-atomic="true">
      <div className="lion-book-reading-title"><p>{current.era}</p><h3>{current.title}</h3></div>
      <div className="lion-book-reading-copy"><p>{current.description}</p><a href={current.sourceUrl} target="_blank" rel="noreferrer">资料依据：{current.source} <span aria-hidden="true">↗</span></a>
        {current.additionalSource && <a className="lion-book-additional-source" href={current.additionalSource.url} target="_blank" rel="noreferrer">{current.additionalSource.label} ↗</a>}
      </div>
    </div>
    <footer className="lion-book-provenance"><span>AI辅助绘制 · 历史主题示意，非文物或史料影像。年代为叙事分期，文化传承延续交叠。</span><span><a href={media.lionBookLicense} target="_blank" rel="noreferrer">Sketchbook · ThreeUI / MIT</a>{' · '}<a href={media.lionBookFontLicense} target="_blank" rel="noreferrer">字体许可</a></span></footer>
  </div>;
}
