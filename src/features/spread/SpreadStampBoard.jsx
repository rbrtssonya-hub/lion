import { useEffect, useMemo, useRef, useState } from 'react';
import { spreadStamps, stampsForLevel, stampForPlace } from '../../data/spread-stamps.js';
import { resolveSpreadStampParameters } from '../../config/spreadStampSettings.js';
import { prepareStampArtwork, createStampArtwork } from '../../services/spread-stamps/artwork.js';
import { getSpreadStampHome, getSpreadStampFocus } from './stampLayout.js';
import './spread-stamps.css';

export default function SpreadStampBoard({ level, selectedPlaceId, onSelect, settings, onPreviewReady }) {
  const host = useRef(null), buttons = useRef({}), label = useRef(null), focusUi = useRef(null), chrome = useRef(null);
  const gallery = useRef(null), latest = useRef({});
  const synchronizedFocus = useRef(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [view, setView] = useState({ phase: 'idle', activeId: null, hoverId: null });
  const [fallbackArt, setFallbackArt] = useState({});
  const [fallbackActive, setFallbackActive] = useState(null);
  const [size, setSize] = useState({ width: 1, height: 1 });
  const parameters = useMemo(() => resolveSpreadStampParameters(settings), [settings]);
  latest.current = { level, selectedPlaceId, onSelect, parameters, onPreviewReady };
  const focused = spreadStamps.find(stamp => stamp.id === view.activeId);
  const hovered = spreadStamps.find(stamp => stamp.id === view.hoverId);
  const mapSelected = stampForPlace(selectedPlaceId);

  useEffect(() => {
    const observer = new ResizeObserver(() => {
      const { width, height } = host.current.getBoundingClientRect();
      if (width && height) setSize({ width, height });
    });
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false, renderer;
    setStatus('loading');
    setError('');
    setView({ phase: 'idle', activeId: null, hoverId: null });
    setFallbackActive(null);
    synchronizedFocus.current = null;
    const preview = focused => latest.current.onPreviewReady?.({
      focus: () => renderer?.focus((stampForPlace(latest.current.selectedPlaceId) ?? stampsForLevel(latest.current.level)[0]).id),
      close: () => renderer?.close(), focused,
    });
    Promise.all([prepareStampArtwork(), import('../../services/spread-stamps/StampGallery.js')]).then(([, { createStampGallery }]) => {
      if (cancelled) return;
      renderer = createStampGallery({
        host: host.current, buttons: buttons.current, label: label.current,
        focusUi: focusUi.current, chrome: chrome.current,
        parameters: latest.current.parameters, series: latest.current.level,
        getHome: getSpreadStampHome, getFocus: getSpreadStampFocus,
        onReady: api => {
          if (!cancelled) {
            // Read-only observations of the renderer that drew this canvas.
            host.current.getStampDiagnostics = () => api.getDiagnostics();
            setStatus('ready');
            preview(false);
          }
        },
        onState: next => {
          if (cancelled) return;
          setView(next);
          if (renderer) preview(Boolean(next.activeId));
          const selected = spreadStamps.find(stamp => stamp.id === next.activeId);
          if (selected && next.phase !== 'returning' && selected.id !== synchronizedFocus.current && selected.series === latest.current.level) {
            latest.current.onSelect?.(selected.placeId);
          }
          synchronizedFocus.current = next.activeId;
        },
        onError: reason => {
          if (cancelled) return;
          setStatus('error');
          setView({ phase: 'idle', activeId: null, hoverId: null });
          synchronizedFocus.current = null;
          latest.current.onPreviewReady?.(null);
          setError(reason?.message || '邮票光影暂未载入。');
        },
      });
      gallery.current = renderer;
    }).catch(reason => {
      if (!cancelled) { setStatus('error'); setError(reason.message); }
    });
    return () => {
      cancelled = true;
      renderer?.dispose();
      if (host.current) delete host.current.getStampDiagnostics;
      latest.current.onPreviewReady?.(null);
      if (gallery.current === renderer) gallery.current = null;
    };
  }, [attempt]);

  useEffect(() => { gallery.current?.configure?.(parameters); }, [parameters]);
  useEffect(() => {
    gallery.current?.setSelected?.(mapSelected?.id ?? null);
    if (view.activeId && view.activeId !== mapSelected?.id) gallery.current?.close?.();
    if (fallbackActive && fallbackActive !== mapSelected?.id) setFallbackActive(null);
  }, [mapSelected?.id, status]);
  useEffect(() => {
    setFallbackActive(null);
    gallery.current?.setSeries?.(level);
  }, [level]);
  useEffect(() => {
    if (status !== 'error') return;
    setFallbackArt(Object.fromEntries(spreadStamps.map(stamp => {
      try { return [stamp.id, createStampArtwork(stamp.id, 600, Math.round(600 / stamp.ratio)).toDataURL()]; }
      catch { return [stamp.id, stamp.image]; }
    })));
  }, [status]);

  const fallbackStyle = stamp => {
    const active = fallbackActive === stamp.id;
    const pose = active ? getSpreadStampFocus(stamp, size.width, size.height, parameters) : getSpreadStampHome(stamp, size.width, size.height);
    return { left: pose.x, top: pose.y, width: pose.width, height: pose.height, zIndex: active ? 3 : 1,
      opacity: fallbackActive && !active ? .28 : 1, transform: `translate(-50%, -50%) rotate(${pose.angle}deg)` };
  };

  return <section id="spreadPlaceCard" className="spread-stamp-board" data-surface="spreadOverlay"
    data-stamp-level={level} data-stamp-status={status} data-stamp-phase={view.phase}
    aria-label={`${level === 'guangdong' ? '广东' : level === 'china' ? '中国' : '世界'}地域醒狮邮票`}>
    <div className="spread-stamp-host" ref={host} aria-busy={status === 'loading'} onKeyDown={event => {
      if (status === 'error' && event.key === 'Escape') { event.preventDefault(); setFallbackActive(null); }
    }}>
      <div className="spread-stamp-controls" role="group" aria-label="地域邮票收藏">
        {spreadStamps.map(stamp => <button key={stamp.id}
          ref={node => { buttons.current[stamp.id] = node; }}
          className="spread-stamp-hit" data-stamp={stamp.id} data-place={stamp.placeId}
          data-map-selected={mapSelected?.id === stamp.id} hidden={stamp.series !== level || status === 'error'}
          aria-label={`查看${stamp.place}邮票 · ${stamp.title}`} aria-pressed={view.activeId === stamp.id}
          disabled={status !== 'ready'}><span className="sr-only">{stamp.name}</span></button>)}
      </div>
      <div className="spread-stamp-hover-label" ref={label} aria-hidden="true">{hovered?.name ?? ''}</div>
      <div className="spread-stamp-focus-ui" ref={focusUi} aria-hidden={!focused}>
        <button className="close-focus" type="button" aria-label="返回本组邮票" tabIndex={focused ? 0 : -1}>× <span>返回本组邮票</span></button>
      </div>
      <div className="spread-stamp-note" ref={chrome} hidden={status === 'error'}><span>AI辅助艺术邮票 · 非历史发行邮票</span><small>悬停观光影 · 点击看细节</small></div>
      {status === 'loading' && <p className="spread-stamp-loading" role="status">正在装裱邮票…</p>}
      {status === 'error' && <div className="spread-stamp-fallback">
        {stampsForLevel(level).map(stamp => <button key={stamp.id} className={`spread-stamp-fallback-item${fallbackActive === stamp.id ? ' is-active' : ''}`}
          style={fallbackStyle(stamp)} aria-label={`查看${stamp.place}静态邮票`} aria-pressed={fallbackActive === stamp.id}
          onClick={() => { setFallbackActive(current => current === stamp.id ? null : stamp.id); onSelect?.(stamp.placeId); }}>
          <img src={fallbackArt[stamp.id] || stamp.image} alt={stamp.name}/>
        </button>)}
        {fallbackActive && <button type="button" className="spread-stamp-fallback-close" onClick={() => setFallbackActive(null)}>返回本组邮票</button>}
        <p className="spread-stamp-error" role="status"><span>AI辅助艺术邮票 · 非历史发行邮票</span><span>光影暂不可用，已显示静态邮票。<button type="button" onClick={() => setAttempt(value => value + 1)}>重新载入光影</button></span><span className="sr-only">{error}</span></p>
      </div>}
    </div>
    <span className="sr-only" role="status">{focused ? `${focused.name}，聚焦查看。按Escape返回。` : `当前显示${stampsForLevel(level).map(stamp => stamp.place).join('、')}四张邮票。`}</span>
  </section>;
}
