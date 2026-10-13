import { useCallback, useEffect, useRef } from 'react';
import { media } from '../../config/media.js';
import { homeCultureSources, homeCultureStories } from '../../data/home-culture.js';
import { useCultureCarousel } from './useCultureCarousel.js';
import '../../styles/home-culture.css';

function PhotoCredit({ photo }) {
  return (
    <span className="home-culture-credit">
      摄影：<a href={photo.sourceUrl} target="_blank" rel="noreferrer">{photo.author}</a>
      {' · '}<a href={photo.licenseUrl} target="_blank" rel="noreferrer">{photo.license}</a>
      <span> · 缩放展示</span>
    </span>
  );
}

function CultureSlide({ story, active }) {
  return (
    <article
      className={`home-culture-slide${active ? ' is-active' : ''}`}
      data-culture-slide
      data-culture-id={story.id}
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
      <div className="home-culture-copy">
        <p className="home-culture-eyebrow">{story.eyebrow}</p>
        <h3 id={`culture-${story.id}`} className="home-culture-title">{story.title}</h3>
        <p className="home-culture-text">{story.text}</p>
        <p className="home-culture-note">{story.note}</p>
      </div>
    </article>
  );
}

export default function HomeCulture() {
  const sectionRef = useRef(null);
  const {
    currentIndex,
    isPlaying,
    next,
    previous,
    select,
    toggle,
    setHovered,
    setFocused,
  } = useCultureCarousel(homeCultureStories.length);
  const currentStory = homeCultureStories[currentIndex];
  const handleKeyDown = useCallback((event) => {
    if (event.key === 'ArrowRight') next();
    if (event.key === 'ArrowLeft') previous();
  }, [next, previous]);

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
      aria-labelledby="home-culture-title"
      data-culture-carousel="true"
      data-culture-index={currentIndex}
      data-culture-playing={isPlaying}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
      onKeyDown={handleKeyDown}
    >
      <div className="home-culture-inner">
        <header className="home-culture-intro" data-culture-reveal>
          <div>
            <p className="home-culture-overline">南风 · 狮语 <span>LION CULTURE / ARCHIVE</span></p>
            <h2 id="home-culture-title">一头醒狮，<br />一方风土。</h2>
          </div>
          <div className="home-culture-intro-copy">
            <p>醒狮文化自动图鉴</p>
            <p>从岭南的街巷到远方的节庆，图片与文字同步展开，让一头醒狮背后的风土、工艺、动作与默契逐项显影。</p>
            <span className="home-culture-intro-mark">资料整理 · 四项文化切片</span>
          </div>
        </header>

        <div className="home-culture-carousel" role="region" aria-roledescription="轮播" aria-label="醒狮文化自动图鉴">
          <div className="home-culture-carousel-stage" aria-live="polite">
            {homeCultureStories.map((story, index) => <CultureSlide key={story.id} story={story} active={index === currentIndex} />)}
          </div>
          <div className="home-culture-carousel-controls">
            <div className="home-culture-progress" aria-label={`当前第 ${currentIndex + 1} 项，共 ${homeCultureStories.length} 项`}>
              <span>{String(currentIndex + 1).padStart(2, '0')} / {String(homeCultureStories.length).padStart(2, '0')}</span>
              <span className="home-culture-progress-line"><i style={{ '--culture-progress': `${((currentIndex + 1) / homeCultureStories.length) * 100}%` }} /></span>
              <strong>{currentStory.eyebrow.split(' / ')[0]}</strong>
            </div>
            <div className="home-culture-control-group">
              <button type="button" className="home-culture-control" onClick={previous} aria-label="上一项">←</button>
              <div className="home-culture-dots" role="tablist" aria-label="选择文化图鉴项目">
                {homeCultureStories.map((story, index) => (
                  <button
                    key={story.id}
                    type="button"
                    role="tab"
                    aria-selected={index === currentIndex}
                    aria-label={`查看第 ${index + 1} 项：${story.eyebrow.split(' / ')[0]}`}
                    className={index === currentIndex ? 'is-current' : ''}
                    onClick={() => select(index)}
                  />
                ))}
              </div>
              <button type="button" className="home-culture-control" onClick={next} aria-label="下一项">→</button>
              <button type="button" className="home-culture-play" onClick={toggle} aria-label={isPlaying ? '暂停自动播放' : '开始自动播放'} aria-pressed={isPlaying}>
                <span aria-hidden="true">{isPlaying ? 'Ⅱ' : '▶'}</span>
                {isPlaying ? '暂停' : '播放'}
              </button>
            </div>
          </div>
        </div>

        <footer className="home-culture-sources">
          <span>文化资料整理</span>
          {homeCultureSources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.label}</a>)}
          <span className="home-culture-endnote">实景摄影 · 图片署名及许可见各图注</span>
        </footer>
      </div>
    </section>
  );
}
