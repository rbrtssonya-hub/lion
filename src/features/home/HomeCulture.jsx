import { useCallback, useEffect, useRef } from 'react';
import { media } from '../../config/media.js';
import { homeCultureSources, homeCultureStories } from '../../data/home-culture.js';
import { useCultureCarousel } from './useCultureCarousel.js';
import CultureDepthGallery from './CultureDepthGallery.jsx';
import LionArchiveOrnament from './LionArchiveOrnament.jsx';
import '../../styles/home-culture.css';

function PhotoCredit({ photo }) {
  return (
    <span className="home-culture-credit">
      摄影：<a href={photo.sourceUrl} target="_blank" rel="noreferrer">{photo.author}</a>
      {' · '}<a href={photo.licenseUrl} target="_blank" rel="noreferrer">{photo.license}</a>
      <span> · 等比缩放展示</span>
    </span>
  );
}

function CultureSlide({ story, active }) {
  return (
    <article
      className={`home-culture-slide${active ? ' is-active' : ''}`}
      data-culture-slide
      data-culture-id={story.id}
      id={`culture-panel-${story.id}`}
      aria-labelledby={`culture-${story.id}`}
      aria-hidden={!active}
      hidden={!active}
    >
      <figure className="home-culture-figure">
        <div className="home-culture-photo-wrap">
          <img
            className="home-culture-photo"
            src={media[story.photo.mediaKey]}
            alt={story.photo.alt}
            width={story.photo.width}
            height={story.photo.height}
            loading={active ? 'eager' : 'lazy'}
            decoding="async"
          />
          <span className="home-culture-photo-index" aria-hidden="true">{story.index}</span>
        </div>
        <figcaption>
          <span className="home-culture-caption">{story.photo.caption}</span>
          <PhotoCredit photo={story.photo} />
        </figcaption>
      </figure>
      <div className="home-culture-copy archive-reading-panel" data-surface="cultureBody">
        <p className="home-culture-eyebrow">{story.eyebrow}</p>
        <h3 id={`culture-${story.id}`} className="home-culture-title">{story.title}</h3>
        <p className="home-culture-text">{story.text}</p>
        <p className="home-culture-note">{story.note}</p>
      </div>
    </article>
  );
}

export default function HomeCulture({ settings, preload = false, playbackEnabled = true, onReady }) {
  const sectionRef = useRef(null);
  const {
    currentIndex,
    position,
    reducedMotion,
    isPageVisible,
    isAutoplaying,
    playbackStatus,
    isHovered,
    next,
    previous,
    select,
    setHovered,
    setFocused,
    setInView,
  } = useCultureCarousel(homeCultureStories.length, {
    autoplay: settings.carouselAutoplay && playbackEnabled,
    interval: settings.carouselInterval * 1000,
    resumeDelay: settings.carouselResumeDelay * 1000,
  });
  const currentStory = homeCultureStories[currentIndex];
  const handleKeyDown = useCallback((event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return;
    if (event.key === 'ArrowRight') { event.preventDefault(); next(); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); previous(); }
    if (event.key === 'Home') { event.preventDefault(); select(0); }
    if (event.key === 'End') { event.preventDefault(); select(homeCultureStories.length - 1); }
  }, [next, previous, select]);

  useEffect(() => {
    const section = sectionRef.current;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const intro = section?.querySelector('[data-culture-reveal]');
    if (!section || !intro) return undefined;
    const reveal = () => {
      section.classList.toggle('culture-motion-enabled', !reducedMotion.matches);
      intro.classList.add('is-visible');
    };
    reveal();
    reducedMotion.addEventListener('change', reveal);
    return () => reducedMotion.removeEventListener('change', reveal);
  }, []);

  return (
    <section
      className="home-culture"
      id="homeCulture"
      ref={sectionRef}
      style={{ '--culture-focus-scale': settings.carouselFocusScale / 100 }}
      aria-labelledby="home-culture-title"
      data-culture-carousel="true"
      data-culture-index={currentIndex}
      data-culture-playing={isAutoplaying}
      data-culture-status={playbackStatus}
      data-culture-focused={isHovered}
      onPointerDownCapture={() => setFocused(false)}
      onFocusCapture={(event) => {
        setFocused(event.target.matches(':focus-visible'));
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
      onKeyDown={handleKeyDown}
    >
      <div className="home-culture-inner">
        <header className="home-culture-intro archive-reading-panel" data-culture-reveal data-surface="cultureTitle">
          <div>
            <p className="home-culture-overline">南风 · 狮语 <span>LION CULTURE / ARCHIVE</span></p>
            <div className="lion-archive-title-line"><h2 id="home-culture-title">一头醒狮，一方风土。</h2><LionArchiveOrnament /></div>
          </div>
          <div className="home-culture-intro-copy">
            <p>醒狮文化 · 纵深图鉴</p>
            <p>从岭南的街巷到远方的节庆，图片与文字同步展开，让一头醒狮背后的风土、工艺、动作与默契逐项显影。</p>
            <span className="home-culture-intro-mark">资料整理 · 八项文化切片</span>
          </div>
        </header>

        <div className="home-culture-carousel" role="region" aria-roledescription="轮播" aria-label="醒狮文化纵深图鉴">
          <div className="home-culture-carousel-stage">
            <CultureDepthGallery stories={homeCultureStories} currentIndex={currentIndex} position={position}
              reducedMotion={reducedMotion} isPageVisible={isPageVisible && playbackEnabled} onVisibilityChange={setInView}
              settings={settings} onPhotoHover={setHovered} onNext={next} preload={preload} onReady={onReady} />
            {homeCultureStories.map((story, index) => <CultureSlide key={story.id} story={story} active={index === currentIndex} />)}
          </div>
          <p className="sr-only" aria-live={isAutoplaying ? 'off' : 'polite'} aria-atomic="true">{currentStory.index} / {String(homeCultureStories.length).padStart(2, '0')}：{currentStory.title}</p>
          <p id="culture-photo-instructions" className="sr-only">点击照片查看下一张，左右方向键切换，Home和End到首尾；悬停暂停，离开后按设置恢复自动播放。</p>
        </div>

        <footer className="home-culture-sources" data-surface="cultureSources" aria-labelledby="culture-sources-title">
          <div className="home-culture-sources-heading">
            <span className="home-culture-sources-emblem" aria-hidden="true"><svg viewBox="0 0 56 56" fill="none"><path d="M8 13c8-3 15-2 20 3 5-5 12-6 20-3v31c-8-3-15-2-20 2-5-4-12-5-20-2Z" /><path d="M28 16v30M14 21c3-.4 6 0 9 1.5M14 28c3-.4 6 0 9 1.5M14 35c3-.4 6 0 9 1.5M33 22.5c3-1.5 6-1.9 9-1.5M33 29.5c3-1.5 6-1.9 9-1.5M33 36.5c3-1.5 6-1.9 9-1.5" /></svg></span>
            <div><p className="home-culture-sources-kicker">文化资料整理 / SOURCES & CREDITS</p><h2 id="culture-sources-title">参考资料</h2></div>
            <p className="home-culture-sources-intro">循着资料，读到更深处。<br /><span>文化文字据公开资料整理，点击卡片可查阅原文。</span></p>
          </div>
          <div className="home-culture-source-cards">
            {homeCultureSources.map((source, index) => <a className="home-culture-source-card" data-surface="cultureSourceCard" key={source.url} href={source.url} target="_blank" rel="noreferrer">
              <span className="home-culture-source-number">0{index + 1}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12" /></svg></span>
              <span className="home-culture-source-publisher">{source.label}</span><strong>{source.title}</strong><span className="home-culture-source-description">{source.description}</span>
            </a>)}
          </div>
          <details className="home-culture-photo-licenses">
            <summary><span>摄影署名与许可 <small>{homeCultureStories.length} 张实景摄影 · Wikimedia Commons</small></span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></summary>
            <div className="home-culture-photo-license-grid">{homeCultureStories.map(story => <div key={story.id} className="home-culture-photo-license"><span>{story.index}</span><div><p>{story.photo.caption}</p><PhotoCredit photo={story.photo} /></div></div>)}</div>
          </details>
          <p className="home-culture-endnote">图片按各自 Creative Commons 许可使用，保留作者、原始来源与许可链接；照片等比展示。<br />书册中的水彩图为 AI 辅助创作，真实摄影与示意图分别标注。</p>
        </footer>
      </div>
    </section>
  );
}
