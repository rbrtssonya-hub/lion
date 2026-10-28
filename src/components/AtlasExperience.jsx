import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import gsap from 'gsap';
import ModelCanvas from './ModelCanvas.jsx';
import LionBreakdownStage from './LionBreakdownStage.jsx';
import LionDetailModal from './LionDetailModal.jsx';
import { PARTS } from '../content/parts.js';
import { CHAPTERS } from '../content/chapters.js';
import { LION_BREAKDOWNS } from '../content/lionBreakdowns.js';
import { frameLayout, nearestFullscreenVariant, fullscreenImageUrl } from '../interaction/layout.mjs';

const imagePromises = new Map();
function prepareImage(url) {
  if (!imagePromises.has(url)) {
    const promise = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => img.decode().then(() => resolve(img)).catch(reject);
      img.onerror = () => reject(new Error('图版暂未载入，请重试。'));
      img.src = url;
    }).catch(error => { imagePromises.delete(url); throw error; });
    imagePromises.set(url, promise);
  }
  return imagePromises.get(url);
}

export default function AtlasExperience() {
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selected, setSelected] = useState(null);
  const [phase, setPhase] = useState('overview');
  const [error, setError] = useState(null);
  const [variant, setVariant] = useState(() => nearestFullscreenVariant(window.innerWidth, window.innerHeight));
  const [layout, setLayout] = useState(() => frameLayout(window.innerWidth, window.innerHeight, nearestFullscreenVariant(window.innerWidth, window.innerHeight).aspect));
  const [outgoing, setOutgoing] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const world = useRef(null), registry = useRef(null);
  const frame = useRef(null), controls = useRef(null), modelLayer = useRef(null), imageLayer = useRef(null), image = useRef(null);
  const variantRef = useRef(variant), resizeVersion = useRef(0);
  const presentation = useRef({ progress: 0 });
  const dissolve = useRef({ progress: 0 });
  const epoch = useRef(0), pendingTweens = useRef(new Set()), phaseRef = useRef('overview'), selectedRef = useRef(null), layoutRef = useRef(layout), disposed = useRef(false);
  const detailOpenRef = useRef(false);
  layoutRef.current = layout;
  const part = PARTS.find(p => p.id === selected);
  const chapter = selected && CHAPTERS[selected];
  const { artworkWidth, artworkHeight } = layout;
  const artworkUrl = selected && fullscreenImageUrl(selected, variant.id);
  const getReferenceAspect = useCallback(() => variantRef.current.aspect, []);
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const changePhase = next => { phaseRef.current = next; setPhase(next); };
  const changeSelected = id => { selectedRef.current = id; setSelected(id); };
  const openDetails = () => { detailOpenRef.current = true; setDetailOpen(true); };
  const closeDetails = () => { detailOpenRef.current = false; setDetailOpen(false); };

  const commitVariant = useCallback(next => {
    variantRef.current = next;
    setVariant(next);
    setLayout(frameLayout(window.innerWidth, window.innerHeight, next.aspect));
  }, []);

  const syncViewport = useCallback(() => {
    const width = window.innerWidth, height = window.innerHeight;
    const current = variantRef.current;
    setLayout(frameLayout(width, height, current.aspect));
    const target = nearestFullscreenVariant(width, height);
    const version = ++resizeVersion.current;
    if (target.id === current.id) return;
    if (!selectedRef.current && phaseRef.current === 'overview') {
      commitVariant(target);
      return;
    }
    // A flight or its handoff keeps the same registered image. Re-evaluate
    // once it has finished, so resizing cannot swap assets mid-dissolve.
    if (phaseRef.current !== 'study' || !selectedRef.current) return;
    const id = selectedRef.current;
    prepareImage(fullscreenImageUrl(id, target.id)).then(photo => {
      if (disposed.current || version !== resizeVersion.current || phaseRef.current !== 'study' || selectedRef.current !== id || nearestFullscreenVariant(window.innerWidth, window.innerHeight).id !== target.id) return;
      const actualAspect = photo.naturalWidth / photo.naturalHeight;
      if (!Number.isFinite(actualAspect) || Math.abs(actualAspect - target.aspect) > .04) return;
      setOutgoing({ id: version, url: fullscreenImageUrl(id, current.id), layout: layoutRef.current });
      commitVariant({ ...target, aspect: actualAspect });
    }).catch(() => {}); // Retain the decoded current image if an alternate fails.
  }, [commitVariant]);

  const placeFrame = useCallback(() => {
    const l = layoutRef.current, p = presentation.current.progress;
    const mix = (a, b) => a + (b - a) * p;
    gsap.set(frame.current, { x: l.studyX, y: l.studyY, scale: mix(1, l.studyScale) });
    gsap.set(controls.current, { x: mix(l.homeNavX, l.studyNavX) });
    // Keep the source-aligned image centered for handoff, then dock its own
    // complete bounds to the upper left.
    if (image.current) gsap.set(image.current, { x: -l.artworkX * p, y: -l.artworkY * p });
  }, []);

  const animate = useCallback((target, values) => new Promise(resolve => {
    const job = { tween: null, done: false, finish: result => {
      if (job.done) return;
      job.done = true;
      pendingTweens.current.delete(job);
      resolve(result);
    } };
    pendingTweens.current.add(job);
    job.tween = gsap.to(target, { ...values, onComplete: () => job.finish(true), onInterrupt: () => job.finish(false) });
  }), []);

  // Animate one normalized value so resizing cannot leave stale pixel destinations.
  const arrange = useCallback((progress, duration) => animate(presentation.current, {
    progress, duration, ease: 'power2.inOut', onUpdate: placeFrame,
  }), [animate, placeFrame]);

  const placeDissolve = useCallback(() => {
    const p = dissolve.current.progress;
    gsap.set(imageLayer.current, { autoAlpha: p });
    gsap.set(modelLayer.current, { autoAlpha: 1 - p });
  }, []);
  const crossfade = useCallback((progress, duration) => animate(dissolve.current, {
    progress, duration, ease: 'sine.inOut', onUpdate: placeDissolve,
  }), [animate, placeDissolve]);

  const begin = useCallback(() => {
    epoch.current++;
    resizeVersion.current++;
    if (!disposed.current) setOutgoing(null);
    gsap.killTweensOf(modelLayer.current);
    [...pendingTweens.current].forEach(job => { job.tween?.kill(); job.finish(false); });
    world.current?.cancelFlight();
    return epoch.current;
  }, []);

  const select = useCallback(async id => {
    const w = world.current, reg = registry.current;
    if (!w || !reg || !CHAPTERS[id] || !LION_BREAKDOWNS[id]) return;
    if (selectedRef.current === id && phaseRef.current !== 'returning') return;
    const request = begin(), current = () => epoch.current === request && !disposed.current;
    setError(null);
    w.setInteractive(false);
    try {
      if (selectedRef.current) {
        changePhase('switching');
        // Bring the old picture back to the full viewport before revealing its camera.
        await arrange(0, reduced() ? .01 : (presentation.current.progress > .001 ? .85 : 0));
        if (!current()) return;
        w.setActive(true);
        await crossfade(0, reduced() ? .01 : .42);
        if (!current()) return;
      }
      w.setActive(true);
      dissolve.current.progress = 0;
      placeDissolve();
      changeSelected(id);
      changePhase('travel');
      gsap.set(imageLayer.current, { autoAlpha: 0 });
      const activeVariant = variantRef.current;
      const [flight, photo] = await Promise.all([
        w.flyToPart(id, { duration: reduced() ? .01 : 2.15 }),
        prepareImage(fullscreenImageUrl(id, activeVariant.id)),
        prepareImage(LION_BREAKDOWNS[id].image),
      ]);
      if (!current() || !flight.completed) return;
      if (!photo.naturalWidth || !photo.naturalHeight) throw new Error('图版尺寸需要检查，请稍后重试。');
      const actualAspect = photo.naturalWidth / photo.naturalHeight;
      if (Math.abs(actualAspect - activeVariant.aspect) > .04) throw new Error('图版比例与登记构图不一致，请稍后重试。');
      if (actualAspect !== activeVariant.aspect) commitVariant({ ...activeVariant, aspect: actualAspect });
      await image.current?.decode();
      if (!current()) return;
      changePhase('handoff');
      // One identical viewport, no crop, zoom or frame replacement during the dissolve.
      await crossfade(1, reduced() ? .03 : 1.05);
      if (!current()) return;
      gsap.set(modelLayer.current, { autoAlpha: 0 });
      w.setActive(false);
      changePhase('arranging');
      await arrange(1, reduced() ? .01 : 1.15);
      if (!current()) return;
      changePhase('study');
    } catch (failure) {
      if (!current()) return;
      [...pendingTweens.current].forEach(job => { job.tween?.kill(); job.finish(false); });
      w.cancelFlight();
      setError(failure.message || '图版载入失败，请重试。');
      changePhase('returning');
      w.setActive(true);
      dissolve.current.progress = 0;
      placeDissolve();
      await Promise.all([
        w.restoreOverview({ duration: reduced() ? .01 : .8 }),
        arrange(0, reduced() ? .01 : .8),
      ]);
      if (!current()) return;
      changeSelected(null);
      changePhase('overview');
      w.setInteractive(true);
    }
  }, [arrange, begin, commitVariant, crossfade, placeDissolve]);

  const returnHome = useCallback(async () => {
    if (!registry.current || phaseRef.current === 'overview' || phaseRef.current === 'returning') return;
    const request = begin(), current = () => epoch.current === request && !disposed.current;
    const w = world.current;
    changePhase('returning');
    w.setInteractive(false);
    await arrange(0, reduced() ? .01 : (presentation.current.progress > .001 ? .85 : 0));
    if (!current()) return;
    w.setActive(true);
    await crossfade(0, reduced() ? .02 : .65);
    if (!current()) return;
    await w.restoreOverview({ duration: reduced() ? .01 : 1.65 });
    if (!current()) return;
    changeSelected(null);
    changePhase('overview');
    w.setInteractive(true);
  }, [arrange, begin, crossfade]);

  const onReady = useCallback(reg => {
    registry.current = reg;
    setReady(true);
    gsap.fromTo(modelLayer.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: .8 });
  }, []);

  useLayoutEffect(() => {
    placeFrame();
    world.current?.resize(false);
  }, [layout, variant, placeFrame]);
  useEffect(() => {
    if (phase === 'overview' || phase === 'study') syncViewport();
  }, [phase, syncViewport]);
  useEffect(() => {
    const keys = event => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
      if (detailOpenRef.current) return;
      if (event.key === 'Escape') returnHome();
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        const index = PARTS.findIndex(p => p.id === selectedRef.current);
        select(PARTS[(index + (event.key === 'ArrowRight' ? 1 : 5) + 6) % 6].id);
      }
    };
    window.addEventListener('resize', syncViewport);
    window.addEventListener('keydown', keys);
    return () => { window.removeEventListener('resize', syncViewport); window.removeEventListener('keydown', keys); };
  }, [select, returnHome, syncViewport]);
  useEffect(() => () => { disposed.current = true; begin(); }, [begin]);

  return <main className="lion-experience" data-phase={phase} data-ready={ready} data-selected={selected || ''} aria-busy={!['overview', 'study'].includes(phase)}>
    {selected && <button className="return-home" onClick={returnHome}><ArrowLeft size={14}/>返回整体</button>}
    <div className="visual-frame" ref={frame} style={{ width: layout.viewportWidth, height: layout.viewportHeight }}>
      <div className="model-layer" ref={modelLayer} aria-hidden={phase === 'study' || phase === 'arranging'}><ModelCanvas worldRef={world} onSelect={select} onReady={onReady} onProgress={setProgress} onError={setError} getReferenceAspect={getReferenceAspect}/></div>
      <div className="artwork-layer" ref={imageLayer} aria-hidden={phase === 'overview' || phase === 'travel'}>
        {chapter && <>
          <img ref={image} className="chapter-artwork" src={artworkUrl} alt={chapter.imageAlt} draggable="false" style={{ width: artworkWidth, height: artworkHeight, left: layout.artworkX, top: layout.artworkY }}/>
          {outgoing && <img key={outgoing.id} className="variant-outgoing" src={outgoing.url} alt="" aria-hidden="true" draggable="false" onAnimationEnd={() => setOutgoing(previous => previous?.id === outgoing.id ? null : previous)} style={{ width: outgoing.layout.artworkWidth, height: outgoing.layout.artworkHeight, left: outgoing.layout.artworkX * (1 - presentation.current.progress), top: outgoing.layout.artworkY * (1 - presentation.current.progress) }}/>}
        </>}
      </div>
    </div>
    {phase === 'study' && <div className="artwork-credit" style={{ left: 18, top: artworkHeight * layout.studyScale + 15, width: artworkWidth * layout.studyScale - 36 }}><span>{part.number} / {part.name} · {chapter.caption}</span><small>AI 造型转译</small></div>}
    {part && <div className="cultural-column" aria-hidden="true" style={{ left: layout.textX, top: layout.textY, width: layout.textWidth, height: layout.textHeight }}/>}
    {phase === 'study' && part && <LionBreakdownStage
      part={part}
      breakdown={LION_BREAKDOWNS[part.id]}
      style={{ left: layout.textX, top: layout.textY, width: layout.textWidth, height: layout.textHeight }}
      onOpen={openDetails}
    />}
    {detailOpen && part && <LionDetailModal part={part} breakdown={LION_BREAKDOWNS[part.id]} onClose={closeDetails}/>}
    {!ready && <div className="initial-loader" role="status"><span>{error ? '载入未完成' : '载入醒狮'}</span><i><b style={{ width: `${Math.max(3, progress)}%` }}/></i><small>{error || `${Math.round(progress)}%`}</small>{error && <button onClick={() => location.reload()}>重新载入</button>}</div>}
    {ready && error && <div className="experience-error" role="alert">{error}<button onClick={() => setError(null)}>关闭</button></div>}
    <nav className="chapter-controls" ref={controls} style={{ width: layout.navWidth }} aria-label="六个造型研究控件">
      {PARTS.map(item => <button className={`chapter-control ${selected === item.id ? 'is-selected' : ''}`} key={item.id} data-part={item.id} aria-pressed={selected === item.id} aria-label={`${item.number} ${item.name}`} disabled={!ready} onClick={() => select(item.id)}><span className="control-number">{item.number}</span><img className="control-art" src={`/images/navigation/${item.id}.png`} alt="" width="80" height="80" draggable="false"/><span className="control-name">{item.name}</span></button>)}
    </nav>
    {ready && phase === 'overview' && <button className="reset-camera" title="还原视角" aria-label="还原视角" onClick={() => world.current?.reset()}><RotateCcw size={14}/></button>}
    {['travel', 'handoff', 'switching'].includes(phase) && <div className="flight-status" role="status"><i/>{part?.number} / {part?.name}</div>}
  </main>;
}
