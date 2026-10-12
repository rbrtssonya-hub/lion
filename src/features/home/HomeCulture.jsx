import { useEffect, useRef } from 'react';
import { media } from '../../config/media.js';
import { homeCultureSources, homeCultureStories } from '../../data/home-culture.js';
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
  const sectionRef = useRef(null);

  useEffect(() => {
    const section = sectionRef.current;
    const targets = [...section.querySelectorAll('[data-culture-reveal]')];
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let observer;

    const observe = () => {
      observer?.disconnect();
      if (reducedMotion.matches || typeof IntersectionObserver === 'undefined') {
        section.classList.remove('culture-motion-enabled');
        targets.forEach((target) => target.classList.add('is-visible'));
        return;
      }

      section.classList.add('culture-motion-enabled');
      observer = new IntersectionObserver((entries) => {
        entries.forEach(({ target, isIntersecting }) => {
          if (!isIntersecting) return;
          target.classList.add('is-visible');
          observer.unobserve(target);
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -32px 0px' });
      targets.filter((target) => !target.classList.contains('is-visible')).forEach((target) => observer.observe(target));
    };

    observe();
    reducedMotion.addEventListener('change', observe);
    return () => {
      observer?.disconnect();
      reducedMotion.removeEventListener('change', observe);
      section.classList.remove('culture-motion-enabled');
    };
  }, []);

  return (
    <section className="home-culture" id="homeCulture" ref={sectionRef} aria-labelledby="home-culture-title">
      <div className="home-culture-inner">
        <header className="home-culture-intro" data-culture-reveal>
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

        <div className="home-culture-stories">
          {homeCultureStories.map((story) => (
            <article className="home-culture-story" key={story.id} data-culture-reveal data-culture-id={story.id} aria-labelledby={`culture-${story.id}`}>
              <figure className="home-culture-figure">
                <div className="home-culture-photo-wrap">
                  <img
                    className="home-culture-photo"
                    src={media[story.photo.mediaKey]}
                    alt={story.photo.alt}
                    width={story.photo.width}
                    height={story.photo.height}
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <figcaption>
                  <span className="home-culture-caption">{story.photo.caption}</span>
                  <PhotoCredit photo={story.photo} />
                </figcaption>
              </figure>
              <div className="home-culture-copy">
                <span className="home-culture-number" aria-hidden="true">{story.index}</span>
                <p className="home-culture-eyebrow">{story.eyebrow}</p>
                <h3 id={`culture-${story.id}`}>{story.title}</h3>
                <p className="home-culture-text">{story.text}</p>
                <p className="home-culture-note">{story.note}</p>
              </div>
            </article>
          ))}
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
