import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { media } from '../../config/media.js';
import { theaterActions } from './actionClips.js';
import { useTheaterPlayback } from './useTheaterPlayback.js';
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
    mouse: 'M9 3h10a5 5 0 0 1 5 5v12a7 7 0 0 1-14 0V8a5 5 0 0 1 5-5ZM17 3v8m-7 0h14',
    wheel: 'M14 2a7 7 0 0 1 7 7v10a7 7 0 0 1-14 0V9a7 7 0 0 1 7-7Zm0 5v5m0 4v1m0 3v1',
    eye: 'M2 14s4-8 12-8 12 8 12 8-4 8-12 8S2 14 2 14Zm16 0a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
    monitor: 'M3 4h22v16H3Zm7 21h8m-4-5v5',
    left: 'm18 7-8 7 8 7M10 14h15',
    right: 'm10 7 8 7-8 7M3 14h15',
    compass: 'm14 3 10 11-10 11L4 14Zm0 0v22M4 14h20',
  };
  return <svg viewBox="0 0 28 28" aria-hidden="true"><path d={paths[kind]} /></svg>;
}

function GoldCorners() {
  return <span className="theater-gold-corners" aria-hidden="true">{[0, 1, 2, 3].map(corner =>
    <svg key={corner} className={`theater-gold-corner corner-${corner}`} viewBox="0 0 56 56">
      <path d="M2 52V19Q2 2 19 2h33M7 42V20Q7 7 20 7h22M3 28q17 0 17-14 0-8-7-8M8 33q20 0 20-20M14 27q-8-5-3-10t10 0M28 3q0 17-14 17M33 8q0 20-20 20M22 33q-1-12 11-11-1 12-11 11Z" />
    </svg>)}</span>;
}

function ActionCaption({ clip, index, active, flat = false }) {
  return <article className={`theater-caption ${active ? 'is-current' : ''} ${flat ? 'is-flat-caption' : 'theater-world-caption theater-gold-panel'}`}
    {...(!flat && { 'data-spatial-panel': 'caption', 'data-screen-id': clip.id })}
    id={active ? 'theaterObservation' : undefined} aria-label={`${clip.name}动作解读`}>
    {!flat && <GoldCorners />}
    <p className="theater-caption-kicker">当前巨幕 <span>{String(index + 1).padStart(2, '0')} / 04</span></p>
    <h2 id={active ? 'theaterActionName' : undefined}>{clip.name}</h2>
    <p className="theater-description">{clip.description}</p>
    <p className="theater-keywords">{clip.keywords?.join(' · ')}</p>
    {!flat && <span className="theater-caption-seal" aria-hidden="true">狮<br />艺</span>}
  </article>;
}

export default function ActionPage({ clips = theaterActions, assets = media, lightingSettings, spatialSettings }) {
  const stageRef = useRef(null);
  const containerRef = useRef(null);
  const spatialRef = useRef(null);
  const sceneRef = useRef(null);
  const lightingSettingsRef = useRef(lightingSettings);
  lightingSettingsRef.current = lightingSettings;
  const spatialSettingsRef = useRef(spatialSettings);
  spatialSettingsRef.current = spatialSettings;
  const requestedScreen = useRef(clips[0].id);
  const activeRef = useRef(clips[0].id);
  const visibleRef = useRef(true);
  const flatRef = useRef(false);
  const autoRotateRef = useRef(true);
  const [activeId, setActiveId] = useState(clips[0].id);
  const [sceneState, setSceneState] = useState('loading');
  const [sceneError, setSceneError] = useState('');
  const [lightingStatus, setLightingStatus] = useState({ phase: 'loading' });
  const [sceneVersion, setSceneVersion] = useState(0);
  const [flatMode, setFlatMode] = useState(false);
  const [visible, setVisible] = useState(!document.hidden);
  const [fullscreen, setFullscreen] = useState(false);
  const [notice, setNotice] = useState('');
  const [autoRotate, setAutoRotate] = useState(true);
  const active = clips.find(clip => clip.id === activeId) || clips[0];
  const playback = useTheaterPlayback({ clips, activeId, enabled: visible, flatMode });
  activeRef.current = activeId;
  visibleRef.current = visible;
  flatRef.current = flatMode;

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
    setSceneError('');
    import('../../services/actionTheaterScene.js').then(({ createActionTheater }) => {
      if (cancelled) return;
      handle = createActionTheater({
        lightingSettings: lightingSettingsRef.current,
        spatialSettings: spatialSettingsRef.current,
        onLightingStatus: next => { if (!cancelled) setLightingStatus(next); },
        container: containerRef.current, modelUrl: assets.actionTheaterScene, screenDefinitions: clips,
        spatialLayer: spatialRef.current,
        onActiveScreen: id => {
          if (cancelled) return;
          requestedScreen.current = id;
          activeRef.current = id;
          // This callback only fires for a discrete screen change. Commit the
          // text before this rendering frame paints, independently of media.
          flushSync(() => setActiveId(id));
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
      handle.setAutoRotate(autoRotateRef.current);
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
  useLayoutEffect(() => { sceneRef.current?.setSpatialSettings(spatialSettingsRef.current); },
    [spatialSettings?.actionUiFadeInMs, spatialSettings?.actionUiFadeOutMs,
      spatialSettings?.actionUiEdgeZone, spatialSettings?.actionUiInteractionOpacity,
      spatialSettings?.actionUiHysteresis, spatialSettings?.actionUiOpacity, spatialSettings?.actionUiScale]);
  useEffect(() => { sceneRef.current?.setLightingSettings(lightingSettingsRef.current); },
    [lightingSettings?.hdriEnabled, lightingSettings?.hdriIntensity, lightingSettings?.hdriRotation,
      lightingSettings?.hdriExposure, lightingSettings?.hdriLightIntensity]);
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
  const toggleAutoRotate = () => {
    const next = !autoRotateRef.current;
    autoRotateRef.current = next;
    setAutoRotate(next);
    sceneRef.current?.setAutoRotate(next);
  };
  const stepAction = delta => selectAction(clips[(clips.findIndex(clip => clip.id === activeRef.current) + delta + clips.length) % clips.length].id);
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
      <div className="theater-spatial-layer" ref={spatialRef} aria-label="巨幕空间悬浮界面">
        <header className="theater-topline theater-gold-panel" data-spatial-panel="title" data-screen-id={clips[0].id}>
          <GoldCorners /><p>南风有狮 <span> / 动作空间</span></p><h2>四面观狮</h2>
          <p className="theater-gesture-hint">推动漫游视角 · 左右切换观赏</p>
        </header>
        {clips.map((clip, index) => <div className="theater-screen-label" key={`screen-${clip.id}`} data-spatial-panel="screen" data-screen-id={clip.id}>
          <span className="theater-screen-number">{String(index + 1).padStart(2, '0')}</span>
          <h3>{clip.name}</h3>
          <button type="button" aria-label={`观看${clip.name}`} onClick={() => selectAction(clip.id)}><Icon kind="play" /></button>
          <span className="theater-screen-status">{activeId === clip.id ? '正在观赏' : '转向此幕'}</span>
        </div>)}
        {clips.map((clip, index) => <ActionCaption key={clip.id} clip={clip} index={index} active={!flatMode && activeId === clip.id} />)}
      </div>
      {flatMode && <header className="theater-flat-title"><p>南风有狮 / 动作空间</p><h2>四面观狮</h2></header>}
      <div className="theater-view-tools">
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

      <p className="sr-only" aria-live="polite">当前动作 {String(clips.indexOf(active) + 1).padStart(2, '0')} / 04，{active.name}。{active.description}</p>
      {flatMode && <aside className="theater-flat-observation"><ActionCaption clip={active} index={clips.indexOf(active)} active flat /></aside>}

      <div className="theater-bottom">
        <div className="theater-gesture-panel theater-gold-panel">
          <GoldCorners /><div><Icon kind="mouse" /><p>拖动<span>旋转视角</span></p></div>
          <i /><div><Icon kind="wheel" /><p>滚轮<span>缩放远近</span></p></div>
        </div>
        <div className="theater-center-console">
          <div className="theater-compass" data-view-compass>
            <span className="theater-compass-north" aria-hidden="true">↑</span>
            <button type="button" aria-label="转向上一面巨幕" onClick={() => stepAction(-1)}><Icon kind="left" /></button>
            <button className="theater-compass-home" type="button" aria-label="回到探青采青正面视角" onClick={() => selectAction(clips[0].id)}><Icon kind="compass" /></button>
            <button type="button" aria-label="转向下一面巨幕" onClick={() => stepAction(1)}><Icon kind="right" /></button>
            <span className="theater-compass-south" aria-hidden="true">↓</span>
            <p>拖动观察四周 <span>{String(clips.indexOf(active) + 1).padStart(2, '0')} / 04</span></p>
          </div>
        <nav className="theater-action-nav" aria-label="四面动作巨幕">
          {clips.map((clip, index) => <button type="button" key={clip.id} data-action-id={clip.id}
            aria-label={`转向${clip.name}`} aria-pressed={activeId === clip.id} onClick={() => selectAction(clip.id)}>
            <span>{String(index + 1).padStart(2, '0')}</span><strong>{clip.name}</strong>
          </button>)}
        </nav>
        </div>
        <div className="theater-mode-panel theater-gold-panel">
          <GoldCorners />
          <button type="button" aria-label="醒狮自动旋转" aria-pressed={autoRotate} onClick={toggleAutoRotate}>
            <Icon kind="eye" /><span>自动旋转<small>{autoRotate ? '醒狮缓慢旋转' : '醒狮已暂停'}<i className={`theater-toggle ${autoRotate ? 'is-on' : ''}`} /></small></span>
          </button><i />
          <button type="button" aria-label={flatMode ? '返回巨幕' : '平面观看'} onClick={() => setFlatMode(value => !value)} disabled={sceneState === 'error'}>
            <Icon kind="monitor" /><span>视角切换<small>{flatMode ? '返回四面巨幕' : '自动播放对应视频'}</small></span>
          </button>
        </div>
      </div>
      <div className="theater-player-dock">
        <div id="theaterControls" className="theater-controls" aria-label="当前动作播放控制">
          <button type="button" aria-label={playing ? '暂停动作视频' : '播放动作视频'} onClick={playback.togglePlayback}><Icon kind={playing ? 'pause' : 'play'} /></button>
          <span className="theater-time">{clock(playback.view.currentTime)} <i>/</i> {clock(duration)}</span>
          <input type="range" min="0" max={duration || 1} step=".01" value={duration ? Math.min(playback.view.currentTime || 0, duration) : 0}
            disabled={!duration} aria-label="当前动作播放进度" onChange={event => playback.seek(Number(event.target.value))} />
          <button type="button" aria-label={playback.audioEnabled ? '关闭声音' : '开启声音'} aria-pressed={playback.audioEnabled} onClick={playback.toggleAudio}>
            <Icon kind={playback.audioEnabled ? 'sound' : 'muted'} />
          </button>
          <span className="theater-audio-note">{playback.audioEnabled ? '仅当前巨幕发声' : '静音播放'}</span>
        </div>
        <p className="theater-source-note" id="chapterEvidence">{active.sourceNote} <span>· 广府醒狮 / 动作空间</span></p>
      </div>
      {(playback.view.error || notice) && <div className="theater-playback-notice" role="status">
        <span>{notice || playback.view.error}</span>
        {playback.view.error && <button type="button" onClick={playback.retry}>重试当前动作视频</button>}
      </div>}
    </div>
  </section>;
}
