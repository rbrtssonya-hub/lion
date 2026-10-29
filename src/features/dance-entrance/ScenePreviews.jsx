import { Component, lazy, Suspense, useEffect, useRef, useState } from 'react';
import { media } from '../../config/media.js';
import { theaterActions } from '../action/actionClips.js';

const DepthScene = lazy(() => import('../expression-depth/scene/Scene.tsx'));

export function usePreviewActivity(rootRef) {
  const [active, setActive] = useState(!document.hidden);
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    let visible = true;
    const update = () => setActive(visible && !document.hidden);
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const motion = () => setReduced(preference.matches);
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); });
    observer.observe(rootRef.current);
    document.addEventListener('visibilitychange', update);
    preference.addEventListener('change', motion);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', update);
      preference.removeEventListener('change', motion);
    };
  }, [rootRef]);
  return { active, reduced };
}

function PreviewStatus({ status }) {
  return status !== 'ready' && <span className="portal-preview-status">
    {status === 'error' ? '空间预览暂不可用，仍可点击进入' : '正在打开空间…'}
  </span>;
}

export function TheaterPreview({ view, active, reduced, settings }) {
  const container = useRef(null);
  const scene = useRef(null);
  const videos = useRef([]);
  const activeRef = useRef(active);
  activeRef.current = active;
  const preview = useRef({ view, reduced });
  preview.current.reduced = reduced;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const [status, setStatus] = useState('loading');
  useEffect(() => {
    let cancelled = false;
    let handle;
    const elements = videos.current.filter(Boolean);
    // StrictMode replays setup after releasing these same DOM media elements.
    elements.forEach((video, index) => { video.src = media[theaterActions[index].videoKey]; });
    setStatus('loading');
    import('../../services/actionTheaterScene.js').then(({ createActionTheater }) => {
      if (cancelled) return;
      handle = createActionTheater({
        container: container.current, modelUrl: media.actionTheaterScene, screenDefinitions: theaterActions,
        lightingSettings: settingsRef.current, preview: preview.current,
        onReady: () => { if (!cancelled) setStatus('ready'); },
        onError: () => { if (!cancelled) { setStatus('error'); handle?.dispose(); } },
      });
      scene.current = handle;
      elements.forEach((video, index) => handle.setVideo(theaterActions[index].id, video));
      handle.setVisible(activeRef.current);
    }).catch(() => { if (!cancelled) setStatus('error'); });
    return () => {
      cancelled = true;
      if (scene.current === handle) scene.current = null;
      handle?.dispose();
      elements.forEach(video => { video.pause(); video.removeAttribute('src'); video.load(); });
    };
  }, [view]);
  useEffect(() => { scene.current?.setLightingSettings(settings); }, [settings]);
  useEffect(() => {
    scene.current?.setVisible(active);
    videos.current.forEach(video => {
      if (!video) return;
      if (active && !reduced && status === 'ready') void video.play().catch(() => {});
      else video.pause();
    });
  }, [active, reduced, status]);
  return <div className="portal-world theater-preview" data-scene="theater" data-preview-state={status} aria-hidden="true">
    <div className="portal-live-scene" ref={container} />
    {theaterActions.map((clip, index) => <video key={clip.id} ref={element => { videos.current[index] = element; }} hidden muted playsInline loop preload="auto" src={media[clip.videoKey]} />)}
    <PreviewStatus status={status} />
    <div className="portal-scene-caption"><span>四面环幕</span><i />身随鼓动 · 形随狮行</div>
  </div>;
}

class PreviewBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? null : this.props.children; }
}

export function ExpressionPreview({ view, active, reduced, settings }) {
  const [status, setStatus] = useState('loading');
  return <div className="portal-world expression-preview" data-scene="expressions" data-preview-state={status} aria-hidden="true"
    style={{ '--preview-paper': `url("${new URL(media.depthPaperBackground, document.baseURI).href}")` }}>
    <div className="portal-paper-atmosphere" />
    <PreviewBoundary onFailure={() => setStatus('error')}><Suspense fallback={null}>
      {status !== 'error' && <DepthScene chapter={1.9} preview={view} active={active} reduced={reduced} blocked settings={settings}
        onReady={() => setStatus('ready')} onFailure={() => setStatus('error')} />}
    </Suspense></PreviewBoundary>
    <PreviewStatus status={status} />
    <div className="portal-scene-caption"><span>喜怒哀乐 · 动静惊疑</span><i />循神入境</div>
  </div>;
}
