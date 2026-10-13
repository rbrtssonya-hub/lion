import { useRef } from 'react';
import { media } from '../../config/media.js';
import { homeCultureSources } from '../../data/home-culture.js';
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

export default function HomeCulture() {
  const carouselRef = useRef(null);
  const {
    activeIndex,
    activeStory,
    isPlaying,
    goTo,
    next,
    previous,
    togglePlaying,
    pauseOnHover,
    resumeAfterHover,
    pauseOnFocus,
    resumeAfterFocus,
  } = useCultureCarousel();
  const story = activeStory;

  return (
    <section className="home-culture" id="homeCulture" aria-labelledby="home-culture-title">
      <div className="home-culture-inner">
        <header className="home-culture-intro">
          <div>
            <p className="home-culture-overline">南风 · 狮语 <span>LION CULTURE</span></p>
            <h2 id="home-culture-title">一头醒狮，<br />一方风土。</h2>
          </div>
          <div className="home-culture-intro-copy">
            <p>看见狮的形，也听见它背后的故事。</p>
            <p>从岭南的街巷到远方的节庆，醒狮以身段、色彩与锣鼓，把一方文化带到人们眼前。</p>
            <span className="home-culture-intro-mark" aria-hidden="true">岭南有狮</span>
          </div>
        </header>

        <div
          className="home-culture-carousel"
          data-culture-carousel
          data-culture-active-id={story.id}
          aria-live="polite"
          aria-roledescription="轮播"
          aria-label="醒狮文化自动图鉴"
          ref={carouselRef}
          onMouseEnter={pauseOnHover}
          onMouseLeave={resumeAfterHover}
          onFocusCapture={pauseOnFocus}
          onBlurCapture={resumeAfterFocus}
        >
          <div className="home-culture-slide">
            <figure className="home-culture-figure">
              <div className="home-culture-photo-wrap">
                <img
                  key={story.id}
                  className="home-culture-photo"
                  src={media[story.photo.mediaKey]}
                  alt={story.photo.alt}
                  width={story.photo.width}
                  height={story.photo.height}
                  loading="lazy"
                  decoding="async"
                />
                <span className="home-culture-photo-index" aria-hidden="true">{story.index}</span>
              </div>
              <figcaption>
                <span className="home-culture-caption">{story.photo.caption}</span>
                <PhotoCredit photo={story.photo} />
              </figcaption>
            </figure>

            <article className="home-culture-copy" aria-labelledby={'culture-' + story.id}>
              <p className="home-culture-eyebrow">{story.eyebrow}</p>
              <h3 id={'culture-' + story.id}>{story.title}</h3>
              <p className="home-culture-text">{story.text}</p>
              <p className="home-culture-note">{story.note}</p>
              <div className="home-culture-source-strip">
                <span>档案来源</span>
                {story.sources.map((sourceIndex) => (
                  <a key={homeCultureSources[sourceIndex].url} href={homeCultureSources[sourceIndex].url} target="_blank" rel="noreferrer">
                    {homeCultureSources[sourceIndex].label}
                  </a>
                ))}
              </div>
            </article>
          </div>

          <div className="home-culture-controls" aria-label="文化图鉴控制">
            <button type="button" className="home-culture-arrow" onClick={previous} aria-label="上一项">←</button>
            <div className="home-culture-progress" aria-label="文化图鉴进度">
              <span className="home-culture-progress-label">{String(activeIndex + 1).padStart(2, '0')} / 04</span>
              <span className="home-culture-progress-line" aria-hidden="true"><i style={{ width: ((activeIndex + 1) / 4) * 100 + '%' }} /></span>
            </div>
            <div className="home-culture-dots" role="tablist" aria-label="选择文化图鉴主题">
              {[0, 1, 2, 3].map((index) => (
                <button
                  key={index}
                  type="button"
                  role="tab"
                  className={'home-culture-dot' + (index === activeIndex ? ' is-current' : '')}
                  aria-label={'第' + (index + 1) + '项：' + ['岭南风土', '狮头工艺', '采青狮艺', '声与身段'][index]}
                  aria-current={index === activeIndex ? 'true' : undefined}
                  onClick={() => goTo(index)}
                />
              ))}
            </div>
            <button
              type="button"
              className="home-culture-play"
              onClick={togglePlaying}
              aria-pressed={isPlaying}
              aria-label={isPlaying ? '暂停自动切换' : '播放自动切换'}
            >
              <span aria-hidden="true">{isPlaying ? 'Ⅱ' : '▶'}</span>
              {isPlaying ? '暂停' : '播放'}
            </button>
            <button type="button" className="home-culture-arrow" onClick={next} aria-label="下一项">→</button>
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
