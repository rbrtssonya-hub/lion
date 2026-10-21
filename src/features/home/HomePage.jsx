import { useState } from 'react';
import VideoStage from '../../components/VideoStage.jsx';
import TitleMotionLayer from '../../components/TitleMotionLayer.jsx';
import { media } from '../../config/media.js';
import HomeCulture from './HomeCulture.jsx';
import HomeLionBook from './HomeLionBook.jsx';
import { HomeLionTypes } from './HomeHeritage.jsx';
import HomeCultureSources from './HomeCultureSources.jsx';
import HomeArchiveNav from './HomeArchiveNav.jsx';
import { useEntryPlayback } from './useEntryPlayback.js';
import '../../styles/home-archive.css';

export default function HomePage({ settings, playbackEnabled = true, onBookReady, onGalleryReady, onVideoReady }) {
  const { introActive, playbackId, finishIntro, replayIntro } = useEntryPlayback(playbackEnabled);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const exploreCulture = () => {
    const book = document.querySelector('#homeLionBook');
    if (!book) return;
    const headerBottom = document.querySelector('.site-header')?.getBoundingClientRect().bottom ?? 0;
    // Align the archive boundary exactly below the fixed navigation: the video
    // finishes behind the navigation instead of leaving a visible red strip.
    const top = window.scrollY + book.getBoundingClientRect().top - headerBottom;
    window.scrollTo({ top, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  };

  return <div className="home-page" data-intro-active={introActive} data-page-hit-enabled={settings.pageHitEnabled}>
  <section className={`entry-gate final-home${introActive ? ' is-intro-playing' : ''}`} aria-label="入场首页">
    <VideoStage key={introActive ? `intro-${playbackId}` : 'home-loop'}
      id={introActive ? 'introVideo' : 'entryLionVideo'} src={introActive ? media.intro : media.home}
      poster={media.cover} loop={!introActive} playing={playbackEnabled} audioEnabled={audioEnabled} hitEnabled={settings.pageHitEnabled} onReady={onVideoReady}
      onEnded={introActive ? finishIntro : undefined} onContinue={introActive ? finishIntro : undefined} continueLabel="继续浏览首页"
      label={introActive ? 'AI辅助创作的醒狮入场视频' : '循环播放的醒狮首页视频'} className="entry-visual entry-visual-video" />
    <div className="entry-vignette" aria-hidden="true" />
    <div className="entry-ornaments" aria-hidden="true">
      <svg className="entry-cloud entry-cloud-top" viewBox="0 0 100 32"><path d="M5 22h72c12 0 12-12 0-12H41c-11 0-11 12 0 12h18M18 16h30M38 10h22c10 0 10-8 0-8H48M28 22h24c11 0 11 8 0 8H14" /></svg>
      <svg className="entry-cloud entry-cloud-side" viewBox="0 0 100 32"><path d="M5 22h72c12 0 12-12 0-12H41c-11 0-11 12 0 12h18M18 16h30M38 10h22c10 0 10-8 0-8H48M28 22h24c11 0 11 8 0 8H14" /></svg>
    </div>
    <div className="entry-playback-tools">
      <button type="button" id="replayIntro" className="entry-replay" onClick={replayIntro} aria-label="重播入场">
        <span className="entry-replay-icon" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="21" /><path d="M34.5 19a12 12 0 1 0 .7 8M34.5 10.5V19H26" /><path className="entry-replay-play" d="m21 17 10 7-10 7Z" /><path className="entry-replay-spark" d="M11 8.5h5M13.5 6v5M36.5 35h5M39 32.5v5" /></svg></span>
        <span><strong>重播入场</strong><small>再听一声醒狮鼓</small></span>
      </button>
      <button type="button" id="toggleHomeAudio" aria-label={audioEnabled ? '关闭首页声音' : '开启首页声音'}
        aria-pressed={audioEnabled} onClick={() => setAudioEnabled(value => !value)}>
        {audioEnabled ? '关闭声音' : '开启声音'}
      </button>
      {introActive && <button type="button" id="skipIntro" onClick={finishIntro}>跳过入场 <span aria-hidden="true">→</span></button>}
      {introActive && <span className="entry-video-note">开场影像 · AI辅助创作</span>}
    </div>
    <div className="entry-copy">
      <h1 className="sr-only">南风有狮</h1>
      <TitleMotionLayer />
      <button className="entry-cta" id="enterWork" type="button" aria-label="探索更多" onClick={exploreCulture}>
        {['left', 'right'].map((side) => <svg key={side} className={`entry-cta-cloud entry-cta-cloud-${side}`} viewBox="0 0 72 76" aria-hidden="true" focusable="false">
          <path className="entry-cta-cloud-line" d="M26 5C11 9 5 20 7 33M27 9C16 12 11 20 12 28" />
          <path className="entry-cta-cloud-fill" d="M65 69H35C20 69 7 62 5 51C-2 47 0 35 8 32C9 22 21 20 27 27C36 25 42 32 40 40C51 38 58 48 54 56C60 58 63 64 65 69Z" />
          <path className="entry-cta-cloud-detail" d="M8 33C16 29 24 33 23 40C22 47 12 47 12 41C12 37 17 36 18 39M27 28C19 26 15 32 18 35M39 40C30 39 26 47 31 52C36 57 44 53 41 48C39 45 35 47 36 50M7 51C12 59 23 61 30 59M32 65H53L44 59M54 56C50 56 47 59 47 62" />
        </svg>)}
        <img className="entry-cta-calligraphy" src={media.exploreMoreCalligraphy} alt="" aria-hidden="true" draggable="false" />
        <svg className="entry-cta-arrow" viewBox="0 0 32 20" aria-hidden="true"><path d="M1 10h29m-8-8 8 8-8 8" /></svg>
      </button>
      <p className="entry-motto"><span>醒狮传文化</span><span>南风载未来</span></p>
      <p className="entry-english">WHERE THE SOUTHERN WIND AWAKENS THE LION</p>
    </div>
  </section>
  <div className="home-archive-scene" style={{ '--archive-background-image': `url("${new URL(media.homeArchiveBackground, document.baseURI).href}")`, '--archive-panel-opacity': 1 - settings.archivePanelTransparency / 100 }}>
    {['top', 'side', 'bottom'].map(position => <div key={position} className={`archive-background-layer is-${position}`} aria-hidden="true" />)}
    <HomeLionBook settings={settings} introDuration={settings.bookIntroDuration} preload={true} playbackEnabled={playbackEnabled} onReady={onBookReady} />
    <div className="home-archive-next">
      <div className="home-archive-peek" aria-hidden="true">
        <img src={media.homeArchivePeek} alt="" draggable="false" loading="lazy" width="1536" height="1024" />
      </div>
      <HomeCulture settings={settings} preload={true} playbackEnabled={playbackEnabled} onReady={onGalleryReady} />
      <HomeLionTypes />
      <HomeCultureSources />
    </div>
  </div>
  <HomeArchiveNav playbackEnabled={playbackEnabled} particlesEnabled={settings.bookInkEnabled} />
  </div>;
}
