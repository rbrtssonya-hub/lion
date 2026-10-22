import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { media } from '../../config/media.js';
import { theaterActions } from './actionClips.js';
import { useTheaterPlayback } from './useTheaterPlayback.js';
import SoundControl from '../../components/SoundControl.jsx';
import './action-theater.css';

const clock = value => {
  const seconds = Math.max(0, Number.isFinite(value) ? value : 0);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
};

function Icon({ kind }) {
  const paths = {
    play: 'm9 5 12 9-12 9Z', pause: 'M9 6v16M19 6v16',
    sound: 'M5 11h5l6-5v16l-6-5H5ZM20 9q7 5 0 10',
    muted: 'M5 11h5l6-5v16l-6-5H5ZM21 10l6 8M27 10l-6 8',
    fullscreen: 'M4 11V4h7M17 4h7v7M24 17v7h-7M11 24H4v-7',
  };
  return <svg viewBox="0 0 28 28" aria-hidden="true"><path d={paths[kind]} /></svg>;
}

function ActionCaption({ clip, index, leaving = false }) {
  return <div className={`theater-caption ${leaving ? 'is-leaving' : 'is-current'}`} aria-hidden={leaving || undefined}>
    <p className="theater-caption-kicker">当前巨幕 <span>{String(index + 1).padStart(2, '0')} / 04</span></p>
    <h2 id={leaving ? undefined : 'theaterActionName'}>{clip.name}</h2>
    <p className="theater-description">{clip.description}</p>
    <p className="theater-keywords">{clip.keywords?.join(' · ')}</p>
  </div>;
}

export default function ActionPage({ clips = theaterActions, assets = media, lightingSettings }) {
  const stageRef = useRef(null);
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const lightingSettingsRef = useRef(lightingSettings);
  lightingSettingsRef.current = lightingSettings;
  const requestedScreen = useRef(clips[0].id);
  const activeRef = useRef(clips[0].id);
  const visibleRef = useRef(true);
  const flatRef = useRef(false);
  const [activeId, setActiveId] = useState(clips[0].id);
  const [sceneState, setSceneState] = useState('loading');
  const [sceneError, setSceneError] = useState('');
  const [lightingStatus, setLightingStatus] = useState({ phase: 'loading' });
  const [drumState, setDrumState] = useState('loading');
  const [sceneVersion, setSceneVersion] = useState(0);
  const [flatMode, setFlatMode] = useState(false);
  const [visible, setVisible] = useState(!document.hidden);
  const [fullscreen, setFullscreen] = useState(false);
  const [notice, setNotice] = useState('');
  const [caption, setCaption] = useState({ current: clips[0].id, previous: null });
  const previousCaption = useRef(clips[0].id);
  const active = clips.find(clip => clip.id === activeId) || clips[0];
  const playback = useTheaterPlayback({ clips, activeId, enabled: visible, flatMode });
  activeRef.current = activeId;
  visibleRef.current = visible;
  flatRef.current = flatMode;

  useLayoutEffect(() => {
    const previous = previousCaption.current;
    if (previous === activeId) return;
    previousCaption.current = activeId;
    setCaption({ current: activeId, previous });
    const timeout = setTimeout(() => setCaption(current => ({ ...current, previous: null })), 460);
    return () => clearTimeout(timeout);
  }, [activeId]);

  useEffect(() => {
    let intersecting = true;
    const update = () => setVisible(intersecting && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => { intersecting = entry.isIntersecting; update(); });
    observer.observe(stageRef.current);
    document.addEventListener('visibilitychange', update);
    update();
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', update); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let handle;
    setSceneState('loading');
    setDrumState('loading');
    setSceneError('');
    import('../../services/actionTheaterScene.js').then(({ createActionTheater }) => {
      if (cancelled) return;
      handle = createActionTheater({
        lightingSettings: lightingSettingsRef.current,
        onLightingStatus: next => { if (!cancelled) setLightingStatus(next); },
        onDrumStatus: next => { if (!cancelled) setDrumState(next); },
        container: containerRef.current, modelUrl: assets.actionTheaterScene, screenDefinitions: clips,
        onActiveScreen: id => {
          if (cancelled) return;
          requestedScreen.current = id;
          activeRef.current = id;
          setActiveId(id);
        },
        onReady: () => {
          if (cancelled) return;
          setSceneState('ready');
          handle.focusScreen(requestedScreen.current, { instant: true });
        },
        onError: () => {
          if (cancelled) return;
          setSceneState('error');
          setSceneError('动作空间暂时无法载入，可继续观看视频。');
          setFlatMode(true);
        },
      });
      sceneRef.current = handle;
      clips.forEach(clip => handle.setVideo(clip.id, playback.getVideo(clip.id)));
      handle.setVisible(visibleRef.current && !flatRef.current);
    }).catch(() => {
      if (!cancelled) {
        setSceneState('error');
        setSceneError('动作空间暂时无法载入，可继续观看视频。');
        setFlatMode(true);
      }
    });
    return () => {
      cancelled = true;
      if (sceneRef.current === handle) sceneRef.current = null;
      handle?.dispose();
    };
  }, [assets.actionTheaterScene, clips, playback.getVideo, sceneVersion]);

  useEffect(() => { sceneRef.current?.setVisible(visible && !flatMode); }, [visible, flatMode]);
  useEffect(() => { sceneRef.current?.setLightingSettings(lightingSettingsRef.current); },
    [lightingSettings?.hdriEnabled, lightingSettings?.hdriIntensity, lightingSettings?.hdriRotation,
      lightingSettings?.hdriExposure, lightingSettings?.hdriLightIntensity, lightingSettings?.hdriSource, lightingSettings?.hdriUrl, lightingSettings?.hdriFile,
      lightingSettings?.structureMinDistanceRatio, lightingSettings?.structureMaxDistanceRatio, lightingSettings?.structureFov,
      lightingSettings?.actionMinDistance, lightingSettings?.actionMaxDistance, lightingSettings?.actionMinPolarAngle, lightingSettings?.actionMaxPolarAngle, lightingSettings?.actionFov]);
  useEffect(() => {
    const update = () => setFullscreen(document.fullscreenElement === stageRef.current);
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);

  const selectAction = useCallback(id => {
    requestedScreen.current = id;
    if (flatRef.current || !sceneRef.current || sceneState !== 'ready') {
      setActiveId(id);
      sceneRef.current?.focusScreen(id, { instant: true });
    } else sceneRef.current.focusScreen(id);
  }, [sceneState]);
  const retryScene = () => { setFlatMode(false); setSceneVersion(value => value + 1); };
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement === stageRef.current) await document.exitFullscreen();
      else await stageRef.current.requestFullscreen();
      setNotice('');
    } catch { setNotice('当前环境未能进入全屏，可继续原位观看。'); }
  };
  const onKeyDown = event => {
    if (event.target.closest('button, input, select, textarea') || event.altKey || event.ctrlKey || event.metaKey) return;
    const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    selectAction(clips[(clips.findIndex(clip => clip.id === activeRef.current) + delta + clips.length) % clips.length].id);
  };
  const playing = playback.playingIntent && !['paused', 'blocked', 'error', 'idle'].includes(playback.view.status);
  const currentCaption = clips.find(clip => clip.id === caption.current) || active;
  const previous = clips.find(clip => clip.id === caption.previous);
  const duration = Number.isFinite(playback.view.duration) && playback.view.duration > 0 ? playback.view.duration : 0;

  return <section className="chapter-stage action-page action-theater-page" id="chapterStage" data-chapter="action" data-active-action={activeId} aria-label="醒狮动作巨幕厅">
    <h1 className="sr-only" id="chapterTitle">动作</h1>
    <div id="actionTheater" ref={stageRef} className="action-theater" tabIndex={0} onKeyDown={onKeyDown}
      data-scene-state={sceneState} data-active-action={activeId} data-view={flatMode ? 'flat' : 'theater'} data-playing={playing}>
      <div id="theaterSceneContainer" className="theater-scene" ref={containerRef} aria-label="拖拽环绕的四面巨幕与醒狮" />
      <div className="theater-video-bank" aria-hidden={!flatMode}>
        {clips.map(clip => <video key={clip.id} data-action-id={clip.id} data-current={clip.id === activeId}
          {...playback.bindVideo(clip.id)} src={assets[clip.videoKey]} poster={assets[clip.posterKey]}
          muted playsInline loop preload="auto" tabIndex={-1} aria-label={`${clip.name}视频`} />)}
      </div>
      <div className="theater-vignette" aria-hidden="true" />
      <header className="theater-topline">
        <p>南风有狮 <span>/ 动作</span></p><h2>四面观狮</h2>
        <p className="theater-gesture-hint">{flatMode ? '选择动作，观看完整片段' : '拖拽环绕 · 滚轮缩放 · 左右方向键切换'}</p>
      </header>
      <div className="theater-view-tools">
        <button type="button" onClick={() => setFlatMode(value => !value)} disabled={sceneState === 'error'}>
          {flatMode ? '返回巨幕' : '平面观看'}
        </button>
        <button type="button" aria-label={fullscreen ? '退出动作空间全屏' : '全屏观看动作空间'} onClick={toggleFullscreen}>
          <Icon kind="fullscreen" />
        </button>
      </div>

      {sceneState === 'loading' && !flatMode && <div className="theater-loading" role="status">
        <span className="theater-loading-ring" aria-hidden="true" /><p>正在进入四面巨幕…</p>
        <button type="button" onClick={() => setFlatMode(true)}>先看视频</button>
      </div>}
      {sceneError && <div className="theater-scene-error" role="status"><span>{sceneError}</span>
        <button type="button" onClick={retryScene}>重新载入动作空间</button></div>}
      {lightingStatus.phase === 'error' && <div className="theater-hdri-notice" role="status">
        <span>HDRI 环境光载入失败</span>
        <button type="button" onClick={() => sceneRef.current?.retryHdri()?.catch(() => {})}>重新载入 HDRI</button>
      </div>}
      {drumState === 'error' && <div className="theater-drum-notice" role="status">
        <span>场景鼓暂未载入</span>
        <button type="button" onClick={() => sceneRef.current?.retryDrums()?.catch(() => {})}>重新载入鼓</button>
      </div>}

      <aside className="theater-observation" id="theaterObservation" aria-live="polite" aria-label="当前动作解读">
        {previous && <ActionCaption key={`previous-${previous.id}`} clip={previous} index={clips.indexOf(previous)} leaving />}
        <ActionCaption key={currentCaption.id} clip={currentCaption} index={clips.indexOf(currentCaption)} />
      </aside>

      <div className="theater-bottom">
        <nav className="theater-action-nav" aria-label="四面动作巨幕">
          {clips.map((clip, index) => <button type="button" key={clip.id} data-action-id={clip.id}
            aria-label={`转向${clip.name}`} aria-pressed={activeId === clip.id} onClick={() => selectAction(clip.id)}>
            <span>{String(index + 1).padStart(2, '0')}</span><strong>{clip.name}</strong>
          </button>)}
        </nav>
        <div id="theaterControls" className="theater-controls" aria-label="当前动作播放控制">
          <button type="button" aria-label={playing ? '暂停动作视频' : '播放动作视频'} onClick={playback.togglePlayback}><Icon kind={playing ? 'pause' : 'play'} /></button>
          <span className="theater-time">{clock(playback.view.currentTime)} <i>/</i> {clock(duration)}</span>
          <input type="range" min="0" max={duration || 1} step=".01" value={duration ? Math.min(playback.view.currentTime || 0, duration) : 0}
            style={{ '--theater-seek-head': `url("${new URL(assets.navLion ?? media.navLion, document.baseURI).href}")` }}
            disabled={!duration} aria-label="当前动作播放进度" onChange={event => playback.seek(Number(event.target.value))} />
        </div>
        <p className="theater-source-note" id="chapterEvidence">{active.sourceNote} <span>· 广府醒狮 / 动作空间</span></p>
      </div>
      <SoundControl enabled={playback.audioEnabled} pending={playback.audioPending} onToggle={playback.toggleAudio} />
      {(playback.view.error || notice) && <div className="theater-playback-notice" role="status">
        <span>{notice || playback.view.error}</span>
        {playback.view.error && <button type="button" onClick={playback.retry}>重试当前动作视频</button>}
      </div>}
    </div>
  </section>;
}
