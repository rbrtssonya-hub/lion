import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const media = {
  home: 'assets/entry/home-lion-loop.mp4',
  intro: 'assets/intro/entry-intro.mp4',
  title: 'assets/entry/title-nanfeng-youshi.png',
  model: 'assets/models/lion-overall.glb',
};

const chapters = [
  ['intro', '01', '入场'],
  ['model', '02', '整体'],
  ['structure', '03', '结构'],
  ['action', '04', '动作'],
  ['state', '05', '神态'],
  ['score', '06', '评分'],
];

const chapterDetails = {
  model: ['认识广府醒狮', 'M3 17c7-8 13-8 20-1 7-7 13-7 22 1M10 8c5-5 10-5 15 0 5-5 10-5 16 0', '0 0 48 24'],
  structure: ['解析醒狮构造', 'm24 4 16 9v18l-16 9-16-9V13zM8 13l16 9 16-9M24 22v18', '0 0 48 48'],
  action: ['探秘经典招式', 'M9 36c10-2 14-10 15-24M22 12l3-5 4 5M25 25c7 1 10 5 14 12M11 16c6 1 9 4 12 9', '0 0 48 48'],
  state: ['解读狮之神韵', 'M3 16S11 5 24 5s21 11 21 11-8 11-21 11S3 16 3 16ZM29 16a5 5 0 1 1-10 0a5 5 0 1 1 10 0', '0 0 48 32'],
  score: ['欣赏与评价', 'm24 4 6 12 14 2-10 10 3 14-13-7-13 7 3-14L4 18l14-2z', '0 0 48 48'],
};

function VideoStage({ src, poster, loop = false, onEnded, label, className = '', id }) {
  const ref = useRef(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return undefined;
    const attempt = video.play();
    attempt?.catch?.(() => video.classList.add('is-play-blocked'));
    return () => {
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [src]);

  return (
    <video
      ref={ref}
      id={id}
      className={`media-video ${className}`}
      src={src}
      poster={poster}
      autoPlay
      muted
      loop={loop}
      playsInline
      preload="auto"
      onEnded={onEnded}
      aria-label={label}
    />
  );
}

function TitleMotionLayer() {
  const rootRef = useRef(null);
  const titleRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current?.closest('.final-home');
    const title = titleRef.current;
    if (!root || !title || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;

    let pointerX = 0;
    let pointerY = 0;
    let frame = 0;
    const render = (time) => {
      const driftX = Math.sin(time / 2600) * 2.4;
      const driftY = Math.cos(time / 3100) * 2.2;
      title.style.setProperty('--title-shift-x', `${(pointerX * 10 + driftX).toFixed(2)}px`);
      title.style.setProperty('--title-shift-y', `${(pointerY * 7 + driftY).toFixed(2)}px`);
      frame = window.requestAnimationFrame(render);
    };
    const onPointerMove = (event) => {
      const bounds = root.getBoundingClientRect();
      pointerX = Math.min(1, Math.max(-1, ((event.clientX - bounds.left) / bounds.width) * 2 - 1));
      pointerY = Math.min(1, Math.max(-1, ((event.clientY - bounds.top) / bounds.height) * 2 - 1));
    };
    const reset = () => { pointerX = 0; pointerY = 0; };
    root.addEventListener('pointermove', onPointerMove);
    root.addEventListener('pointerleave', reset);
    frame = window.requestAnimationFrame(render);
    return () => {
      root.removeEventListener('pointermove', onPointerMove);
      root.removeEventListener('pointerleave', reset);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={rootRef} className="entry-title-live2d" data-title-live2d="true">
      <img ref={titleRef} className="entry-title-art" src={media.title} alt="南风有狮" />
    </div>
  );
}

function ChapterNav({ current, onNavigate }) {
  return (
    <div className="entry-nav-shell">
      <nav className="entry-chapter-nav" aria-label="作品章节导航">
        {chapters.map(([route, index, label]) => (
          <button
            key={route}
            className={`entry-nav-item ${current === route ? 'is-current' : ''}`}
            type="button"
            onClick={() => onNavigate(route)}
            aria-current={current === route ? 'page' : undefined}
          >
            <span>{index}</span><strong>{label}</strong>
          </button>
        ))}
      </nav>
    </div>
  );
}

function HomePage({ onNavigate }) {
  return (
    <section className="entry-gate final-home" aria-label="作品入口">
      <VideoStage id="entryLionVideo" src={media.home} poster="assets/entry/home-cover.png" loop label="循环播放的醒狮首页视频" className="entry-visual entry-visual-video" />
      <div className="entry-vignette" aria-hidden="true" />
      <header className="entry-header">
        <div className="entry-brand">南风有狮</div>
        <ChapterNav current="intro" onNavigate={onNavigate} />
      </header>

      <div className="entry-copy">
        <h1 className="sr-only">南风有狮</h1>
        <TitleMotionLayer />
        <button className="entry-cta" id="enterWork" type="button" onClick={() => onNavigate('intro')}>
          <span>探索更多</span><span aria-hidden="true">→</span>
        </button>
        <p className="entry-motto"><span>醒&nbsp;&nbsp;狮&nbsp;&nbsp;传&nbsp;&nbsp;文&nbsp;&nbsp;化</span><span>南&nbsp;&nbsp;风&nbsp;&nbsp;载&nbsp;&nbsp;未&nbsp;&nbsp;来</span></p>
        <p className="entry-english">WHERE THE SOUTHERN WIND AWAKENS THE LION</p>
      </div>

      <nav className="entry-bottom-nav" aria-label="信息可视化模块">
        {chapters.slice(1).map(([route, index, label], i) => (
          <button key={route} className="entry-bottom-item" type="button" onClick={() => onNavigate(route)}>
            <span className="entry-icon" aria-hidden="true"><svg viewBox={chapterDetails[route][2]}><path d={chapterDetails[route][1]} /></svg></span>
            <span><b>{String(i + 1).padStart(2, '0')}</b><strong>{label}</strong><small>{chapterDetails[route][0]}</small></span>
          </button>
        ))}
      </nav>
    </section>
  );
}

function IntroPage({ onEnded }) {
  return (
    <section className="intro-stage react-intro-stage" id="introStage" aria-label="AI醒狮开场视频">
      <VideoStage id="introVideo" src={media.intro} label="AI醒狮开场视频" onEnded={onEnded} className="intro-video" />
    </section>
  );
}

function HandoffPage({ route, onNavigate }) {
  const frameRef = useRef(null);
  useEffect(() => {
    const handle = (event) => {
      if (event.origin === location.origin && event.source === frameRef.current?.contentWindow && event.data?.type === 'nanfeng:navigate' && event.data.route === 'intro') onNavigate('intro');
    };
    window.addEventListener('message', handle);
    return () => window.removeEventListener('message', handle);
  }, [onNavigate]);
  return (
    <section className="legacy-stage" data-model-source={media.model}>
      <iframe ref={frameRef} src={`legacy.html?chapter=${route}`} title="醒狮整体模型与信息可视化章节" />
      <button className="legacy-home" type="button" onClick={() => onNavigate('entry')}>返回首页</button>
    </section>
  );
}

function App() {
  const [route, setRoute] = useState('entry');
  useEffect(() => {
    document.body.dataset.state = route;
  }, [route]);
  const navigate = (nextRoute) => setRoute(nextRoute === 'entry' ? 'entry' : nextRoute);
  const page = route === 'entry'
    ? <HomePage onNavigate={navigate} />
    : route === 'intro'
      ? <IntroPage onEnded={() => navigate('model')} />
      : <HandoffPage route={route} onNavigate={navigate} />;

  return <main id="react-app" data-route={route}>{page}</main>;
}

createRoot(document.getElementById('root')).render(<App />);
