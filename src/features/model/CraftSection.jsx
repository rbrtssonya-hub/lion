import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { media } from '../../config/media.js';
import { lionHeadCraftNote, lionHeadCraftSources, lionHeadCraftStages } from '../../data/lion-head-craft.js';
import { useCultureCarousel } from '../home/useCultureCarousel.js';
import CultureDepthGallery from '../home/CultureDepthGallery.jsx';

const MiniGameDialog = lazy(() => import('../mini-games/MiniGameDialog.jsx'));
const defaultCarouselSettings = { carouselAutoplay: true, carouselInterval: 6, carouselResumeDelay: 3,
  carouselTransitionDuration: 800, carouselFocusScale: 104 };

function GameIcon({ poles = false }) {
  return <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
    {poles ? <><path d="M10 26v16m14-24v24m14-30v30M7 42h6m8 0h6m8 0h6" /><ellipse cx="10" cy="25" rx="6" ry="3" /><ellipse cx="24" cy="17" rx="6" ry="3" /><ellipse cx="38" cy="11" rx="6" ry="3" /><path d="M8 13c7-9 15-6 22-7" strokeDasharray="2 4" /></> : <><ellipse cx="24" cy="14" rx="15" ry="7" /><path d="M9 14v15c0 9 30 9 30 0V14M12 32l-4 10m28-10 4 10M8 42h32M15 4l7 8m14-8-8 8" /><ellipse cx="24" cy="22" rx="15" ry="7" strokeDasharray="2 4" /></>}
  </svg>;
}

export default function CraftSection({ active = true, settings = defaultCarouselSettings }) {
  const [failedId, setFailedId] = useState(null);
  const [gameId, setGameId] = useState(null);
  const [autoplayEnabled, setAutoplayEnabled] = useState(settings.carouselAutoplay);
  const returnFocusRef = useRef(null);
  useEffect(() => { if (!active) setGameId(null); }, [active]);
  useEffect(() => { setAutoplayEnabled(settings.carouselAutoplay); }, [settings.carouselAutoplay]);
  const { currentIndex, position, reducedMotion, isPageVisible, isAutoplaying, playbackStatus, isHovered,
    next, previous, select, setHovered, setFocused, setInView } = useCultureCarousel(lionHeadCraftStages.length, {
    autoplay: autoplayEnabled && active && !gameId,
    interval: settings.carouselInterval * 1000,
    resumeDelay: settings.carouselResumeDelay * 1000,
  });
  const handleKeyDown = useCallback(event => {
    if (!event.currentTarget.contains(event.target) || event.altKey || event.ctrlKey || event.metaKey ||
      /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return;
    if (event.key === 'ArrowRight') { event.preventDefault(); next(); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); previous(); }
    if (event.key === 'Home') { event.preventDefault(); select(0); }
    if (event.key === 'End') { event.preventDefault(); select(lionHeadCraftStages.length - 1); }
  }, [next, previous, select]);
  const openGame = (id, event) => { returnFocusRef.current = event.currentTarget; setGameId(id); };
  const story = lionHeadCraftStages[currentIndex];
  const { photo } = story;
  return <section className="model-craft" aria-labelledby="model-craft-title"
    data-craft-index={currentIndex} data-craft-current-id={story.id} data-craft-playing={isAutoplaying}
    data-craft-status={playbackStatus} data-craft-focused={isHovered}
    onPointerDownCapture={() => setFocused(false)}
    onFocusCapture={event => { if (event.currentTarget.contains(event.target)) setFocused(event.target.matches(':focus-visible')); }}
    onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}
    onKeyDown={handleKeyDown}>
    <div className="model-craft-carousel" role="region" aria-roledescription="轮播" aria-label="醒狮工艺图文轮播">
    <figure className="model-craft-figure">
      <div className="model-craft-depth-stage" data-photo-failed={failedId === story.id}>
        <CultureDepthGallery stories={lionHeadCraftStages} currentIndex={currentIndex} position={position}
          reducedMotion={reducedMotion} isPageVisible={isPageVisible && active && !gameId}
          onVisibilityChange={setInView} settings={settings} onPhotoHover={setHovered} onNext={next}
          panelIdPrefix="craft-panel" instructionsId="craft-photo-instructions"
          photoActionLabel="下一张工艺图片" showNextButton={false} />
        <img key={story.id} className="model-craft-photo" src={media[photo.mediaKey]}
          width={photo.width} height={photo.height} alt={photo.alt}
          loading={active ? 'eager' : 'lazy'} decoding="async" onError={() => setFailedId(story.id)} />
        {failedId === story.id && <div className="model-craft-fallback" role="status"><span aria-hidden="true">{story.step}</span><p>工艺示意图暂不可用</p><small>仍可切换工序，阅读右侧制作线索</small></div>}
        <span className="model-craft-photo-label" data-depth-decoration>工艺示意 · AI辅助绘制</span>
        <div className="model-craft-depth-axis" data-depth-decoration aria-hidden="true"><span>由形入艺</span><i /><span>扎 · 扑 · 画 · 装</span></div>
      </div>
      <figcaption>
        <strong>{photo.caption}</strong>
        <span>工艺示意 · AI辅助绘制 · 等比展示</span>
        <div className="model-craft-navigation" aria-label="工艺轮播控制">
          <button type="button" aria-label="上一道" aria-controls={`craft-panel-${story.id}`} onClick={previous}><span aria-hidden="true">←</span> 上一道</button>
          <span className="model-craft-counter" aria-hidden="true">{String(currentIndex + 1).padStart(2, '0')} <i /> 04</span>
          <button type="button" aria-label="下一道" aria-controls={`craft-panel-${story.id}`} onClick={next}>下一道 <span aria-hidden="true">→</span></button>
          <button type="button" className="model-craft-playback" aria-label={autoplayEnabled ? '暂停轮播' : '播放轮播'}
            onClick={() => setAutoplayEnabled(value => !value)}><span aria-hidden="true">{autoplayEnabled ? 'Ⅱ' : '▷'}</span>{autoplayEnabled ? '暂停轮播' : '播放轮播'}</button>
        </div>
      </figcaption>
    </figure>
    <div className="model-craft-reading" id={`craft-panel-${story.id}`}>
      <header>
        <p className="model-craft-eyebrow"><span>{String(currentIndex + 1).padStart(2, '0')} / 04</span> 狮头工艺 · 从骨架到神采</p>
        <h2 id="model-craft-title">{story.step} <span aria-hidden="true">·</span> {story.title}</h2>
        <p className="model-craft-lead">{story.subtitle}</p>
      </header>
      <p className="model-craft-description">{story.text}</p>
      <dl className="model-craft-observations">
        <div><dt>材料线索</dt><dd>{story.materials}</dd></div>
        <div><dt>看这一处</dt><dd>{story.observation}</dd></div>
      </dl>
      <ol className="model-craft-stages" aria-label="狮头制作的四工序概念顺序">
        {lionHeadCraftStages.map((stage, index) => <li key={stage.id}>
          <button type="button" aria-label={`查看${stage.step}工序`} aria-pressed={index === currentIndex}
            aria-controls={`craft-panel-${story.id}`} onClick={() => select(index)}>
            <span className="model-craft-stage-index" aria-hidden="true">0{index + 1}</span>
            <strong>{stage.step}</strong><span>{stage.title}</span>
          </button>
        </li>)}
      </ol>
      <div className="model-craft-source">
        <span>工艺资料</span>{lionHeadCraftSources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.label} ↗</a>)}
      </div>
      <p className="model-craft-note">{lionHeadCraftNote}</p>
      <section className="model-craft-games" aria-label="醒狮互动小游戏">
        <div className="model-craft-games-heading"><h3>小试狮艺</h3><span>跟鼓采青 · 跃上梅花桩</span></div>
        <div className="model-craft-game-grid">
          <button type="button" className="model-craft-game" aria-label="体验鼓点采青" aria-haspopup="dialog" onClick={event => openGame('rhythm', event)}>
            <span className="model-craft-game-icon"><GameIcon /></span><span className="model-craft-game-copy"><strong>鼓点采青</strong><span>看金圈 · 跟鼓点</span></span><span className="model-craft-game-action">玩一局 <b aria-hidden="true">↗</b></span>
          </button>
          <button type="button" className="model-craft-game" aria-label="挑战梅花桩" aria-haspopup="dialog" onClick={event => openGame('poles', event)}>
            <span className="model-craft-game-icon"><GameIcon poles /></span><span className="model-craft-game-copy"><strong>梅花桩落点</strong><span>蓄一点力 · 稳稳落桩</span></span><span className="model-craft-game-action">试身手 <b aria-hidden="true">↗</b></span>
          </button>
        </div>
      </section>
    </div>
    <p className="sr-only" aria-live={isAutoplaying ? 'off' : 'polite'} aria-atomic="true">第{currentIndex + 1}道工序：{story.step}，{story.title}。</p>
    <p id="craft-photo-instructions" className="sr-only">点击图片查看下一道工序，左右方向键切换，Home和End到首尾；悬停前景图片或键盘聚焦时暂停，离开后按设置恢复自动播放。</p>
    </div>
    {active && gameId && <Suspense fallback={<div className="model-craft-game-loading" role="status">正在准备小游戏…</div>}><MiniGameDialog gameId={gameId} onClose={() => setGameId(null)} returnFocus={returnFocusRef.current} /></Suspense>}
  </section>;
}
