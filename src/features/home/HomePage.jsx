import { useEffect, useRef, useState } from 'react';
import VideoStage from '../../components/VideoStage.jsx';
import SoundControl from '../../components/SoundControl.jsx';
import { getMediaVolumePreference, useMediaAudioPreference, useMediaVolumePreference } from '../../hooks/useMediaAudioPreference.js';
import TitleMotionLayer from '../../components/TitleMotionLayer.jsx';
import ChapterIdentity from '../../components/ChapterIdentity.jsx';
import { media } from '../../config/media.js';
import HomeLionBook from './HomeLionBook.jsx';
import HomeCultureSources from './HomeCultureSources.jsx';
import HomeArchiveNav from './HomeArchiveNav.jsx';
import { useEntryPlayback } from './useEntryPlayback.js';
import EntryAnimationOverlay from './EntryAnimationOverlay.jsx';
import useHomeExhibit from './useHomeExhibit.js';
import '../../styles/home-archive.css';
import '../../styles/home-exhibit.css';
import '../../styles/home-journey.css';

export default function HomePage({ settings, playbackEnabled = true, assistantSource, onBookReady, onGalleryReady, onVideoReady, onNavigate }) {
  const { introActive, entryAnimationActive, playbackId, finishIntro, finishVideo, finishEntryAnimation, replayIntro } = useEntryPlayback(playbackEnabled);
  const [audioEnabled, setAudioEnabled] = useMediaAudioPreference();
  const [volume, setVolume] = useMediaVolumePreference();
  const [audioState, setAudioState] = useState({ enabled: false, pending: false });
  const resumeAudioRef = useRef(null);
  const sourcesRef = useRef(null);
  const sourceTriggerRef = useRef(null);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const exhibit = useHomeExhibit(playbackEnabled && !introActive && !entryAnimationActive);
  const consumedSource = useRef(null);
  useEffect(() => {
    if (!assistantSource || consumedSource.current === assistantSource || !playbackEnabled || introActive || entryAnimationActive) return undefined;
    const section = assistantSource.section;
    if (section === 'homeLionBook') {
      let frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          consumedSource.current = assistantSource;
          exhibit.select(0);
        });
      });
      return () => cancelAnimationFrame(frame);
    }
    if (!['homeCulture', 'homeLionTypes', 'homeCultureSources'].includes(section)) return undefined;
    consumedSource.current = assistantSource;
    setSourcesOpen(true);
    return undefined;
  }, [assistantSource, playbackEnabled, introActive, entryAnimationActive, exhibit.select]);

  useEffect(() => {
    const dialog = sourcesRef.current;
    if (sourcesOpen && playbackEnabled) dialog.showModal();
    else if (dialog.open) dialog.close();
  }, [sourcesOpen, playbackEnabled]);

  return <div className="home-page" data-intro-active={introActive} data-page-hit-enabled={settings.pageHitEnabled}>
  <section className={`entry-gate final-home${introActive ? ' is-intro-playing' : ''}`} aria-label="入场首页">
    <VideoStage key={introActive ? `intro-${playbackId}` : 'home-loop'}
      id={introActive ? 'introVideo' : 'entryLionVideo'} src={introActive ? media.intro : media.home}
      poster={media.cover} loop={!introActive} playing={playbackEnabled && !entryAnimationActive} audioEnabled={audioEnabled} volume={volume} onAudioState={setAudioState} resumeAudioRef={resumeAudioRef} hitEnabled={settings.pageHitEnabled} onReady={onVideoReady}
      onEnded={introActive ? finishVideo : undefined} onContinue={introActive ? finishVideo : undefined} continueLabel="继续浏览首页"
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
      {introActive && <button type="button" id="skipIntro" onClick={finishIntro}>跳过入场 <span aria-hidden="true">→</span></button>}
      {introActive && <span className="entry-video-note">开场影像 · AI辅助创作</span>}
    </div>
    <div className="entry-copy">
      <h1 className="sr-only">南风有狮</h1>
      <TitleMotionLayer />
      <ChapterIdentity chapter="entry" eyebrow="南风有狮 · 醒狮展览" className="chapter-identity--cinema" />
      <button className="entry-cta interaction-cue interaction-cue--dark" id="enterWork" type="button" aria-label="探索更多" onClick={exhibit.enter}>
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
    {playbackEnabled && <SoundControl id="toggleHomeAudio" variant="line" enabled={audioState.enabled} pending={audioState.pending} settings={settings}
      volume={volume} onVolumeChange={value => {
        const nextVolume = setVolume(value);
        resumeAudioRef.current?.(nextVolume, nextVolume > 0 && !audioState.enabled);
      }} onToggle={() => {
        if (audioState.enabled) setAudioEnabled(false);
        else {
          setAudioEnabled(true);
          resumeAudioRef.current?.(getMediaVolumePreference());
        }
      }} />}
  </section>
  <div className="home-archive-scene home-exhibit" ref={exhibit.archiveRef} data-open={exhibit.visible} data-active-panel={exhibit.active} style={{ '--archive-background-image': `url("${new URL(media.homeArchiveBackground, document.baseURI).href}")`, '--archive-panel-opacity': 1 - settings.archivePanelTransparency / 100 }}>
    {['top', 'side', 'bottom'].map(position => <div key={position} className={`archive-background-layer is-${position}`} aria-hidden="true" />)}
    <div className="home-archive-panel" hidden={exhibit.active !== 0} inert={!exhibit.visible || !playbackEnabled}>
      <HomeLionBook settings={settings} preload={true} playbackEnabled={playbackEnabled && exhibit.visible && exhibit.active === 0} onReady={onBookReady} onArchiveWheel={exhibit.wheel} />
    </div>
    <button className="home-sources-trigger" ref={sourceTriggerRef} type="button" onClick={() => setSourcesOpen(true)} aria-haspopup="dialog">资料与许可</button>
  </div>
  <HomeArchiveNav playbackEnabled={playbackEnabled} particlesEnabled={settings.bookInkEnabled} current={exhibit.active} visible={exhibit.visible} onSelect={exhibit.select} onReturnHome={exhibit.returnHome} onNavigate={onNavigate} />
  <dialog className="home-sources-dialog" ref={sourcesRef} aria-label="资料与许可" onWheelCapture={event => event.stopPropagation()} onKeyDownCapture={event => event.stopPropagation()} onClose={() => {
    setSourcesOpen(false);
    if (playbackEnabled) sourceTriggerRef.current?.focus({ preventScroll: true });
  }}>
    <div className="home-sources-dialog-top"><span>南风有狮 · 阅读依据</span><button type="button" onClick={() => sourcesRef.current.close()} aria-label="关闭资料与许可">关闭 <span aria-hidden="true">×</span></button></div>
    {sourcesOpen && <HomeCultureSources settings={settings} />}
  </dialog>
  {playbackEnabled && entryAnimationActive && <EntryAnimationOverlay onComplete={finishEntryAnimation} onSkip={finishIntro} />}
  </div>;
}
