import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import gsap from 'gsap';
import ModelCanvas from './ModelCanvas.jsx';
import CulturalPanel from './CulturalPanel.jsx';
import { PARTS } from '../content/parts.js';
import { CHAPTERS } from '../content/chapters.js';
import { frameLayout } from '../interaction/layout.mjs';
import { analyzeTextureStudy } from '../analysis/textureStudy.js';

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
  const [analysis, setAnalysis] = useState(null);
  const [uvStudy, setUvStudy] = useState(null);
  const [error, setError] = useState(null);
  const [layout, setLayout] = useState(() => frameLayout(window.innerWidth, window.innerHeight));
  const world = useRef(null), registry = useRef(null);
  const frame = useRef(null), controls = useRef(null), modelLayer = useRef(null), imageLayer = useRef(null), image = useRef(null);
  const presentation = useRef({ progress: 0 });
  const dissolve = useRef({ progress: 0 });
  const epoch = useRef(0), pendingTweens = useRef(new Set()), phaseRef = useRef('overview'), selectedRef = useRef(null), layoutRef = useRef(layout), disposed = useRef(false);
  const cachedUv = useRef(new Map());
  layoutRef.current = layout;
  const part = PARTS.find(p => p.id === selected);
  const chapter = selected && CHAPTERS[selected];
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const changePhase = next => { phaseRef.current = next; setPhase(next); };
  const changeSelected = id => { selectedRef.current = id; setSelected(id); };

  const placeFrame = useCallback(() => {
    const l = layoutRef.current, p = presentation.current.progress;
    const mix = (a, b) => a + (b - a) * p;
    gsap.set(frame.current, { x: mix(l.homeX, l.studyX), y: mix(l.homeY, l.studyY), scale: mix(1, l.studyScale) });
    gsap.set(controls.current, { x: mix(l.homeNavX, l.studyNavX) });
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
    // During the overlap, soften the image edges so an opaque 3:2 rectangle
    // cannot cut across the still-visible model. Restore every image pixel as
    // the model disappears; reversing the same progress also reverses this.
    const feather = Math.min(48, Math.max(0, (1 - p) * 240));
    imageLayer.current.style.maskImage = p > 0 && feather > .01
      ? `linear-gradient(to right, transparent, black ${feather}px, black calc(100% - ${feather}px), transparent), linear-gradient(to bottom, transparent, black ${feather}px, black calc(100% - ${feather}px), transparent)`
      : 'none';
  }, []);
  const crossfade = useCallback((progress, duration) => animate(dissolve.current, {
    progress, duration, ease: 'sine.inOut', onUpdate: placeDissolve,
  }), [animate, placeDissolve]);

  const begin = useCallback(() => {
    epoch.current++;
    gsap.killTweensOf(modelLayer.current);
    [...pendingTweens.current].forEach(job => { job.tween?.kill(); job.finish(false); });
    world.current?.cancelFlight();
    return epoch.current;
  }, []);

  const select = useCallback(async id => {
    const w = world.current, reg = registry.current;
    if (!w || !reg || !CHAPTERS[id]) return;
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
      setAnalysis(reg.analyze(id));
      setUvStudy(cachedUv.current.get(id) || null);
      gsap.set(imageLayer.current, { autoAlpha: 0 });
      const uv = id === 'body'
        ? (cachedUv.current.has(id) ? Promise.resolve(cachedUv.current.get(id)) : analyzeTextureStudy(reg.get(id).meshes.filter(m => !m.userData.derivedHair), 2200).then(data => { cachedUv.current.set(id, data); return data; }))
        : Promise.resolve(null);
      const [flight, photo, uvResult] = await Promise.all([
        w.flyToPart(id, { duration: reduced() ? .01 : 2.15 }),
        prepareImage(CHAPTERS[id].image),
        uv,
      ]);
      if (!current() || !flight.completed) return;
      if (Math.abs(photo.naturalWidth / photo.naturalHeight - 1.5) > .002) throw new Error('图版比例需要检查，请稍后重试。');
      setUvStudy(uvResult);
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
  }, [arrange, begin, crossfade, placeDissolve]);

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
    setAnalysis(null);
    setUvStudy(null);
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
  }, [layout, placeFrame]);
  useEffect(() => {
    const resize = () => setLayout(frameLayout(window.innerWidth, window.innerHeight));
    const keys = event => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
      if (event.key === 'Escape') returnHome();
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        const index = PARTS.findIndex(p => p.id === selectedRef.current);
        select(PARTS[(index + (event.key === 'ArrowRight' ? 1 : 5) + 6) % 6].id);
      }
    };
    window.addEventListener('resize', resize);
    window.addEventListener('keydown', keys);
    return () => { window.removeEventListener('resize', resize); window.removeEventListener('keydown', keys); };
  }, [select, returnHome]);
  useEffect(() => () => { disposed.current = true; begin(); }, [begin]);

  return <main className="lion-experience" data-phase={phase} data-ready={ready} data-selected={selected || ''} aria-busy={!['overview', 'study'].includes(phase)}>
    {selected && <button className="return-home" onClick={returnHome}><ArrowLeft size={14}/>返回整体</button>}
    <div className="visual-frame" ref={frame} style={{ width: layout.width, height: layout.height }}>
      <div className="model-layer" ref={modelLayer} style={{ left: -layout.homeX, top: -layout.homeY, width: layout.viewportWidth, height: layout.viewportHeight }} aria-hidden={phase === 'study' || phase === 'arranging'}><ModelCanvas worldRef={world} onSelect={select} onReady={onReady} onProgress={setProgress} onError={setError}/></div>
      <div className="artwork-layer" ref={imageLayer} aria-hidden={phase === 'overview' || phase === 'travel'}>
        {chapter && <img ref={image} className="chapter-artwork" src={chapter.image} width="1536" height="1024" alt={chapter.imageAlt} draggable="false"/>}
      </div>
    </div>
    {phase === 'study' && <div className="artwork-credit" style={{ left: 18, top: layout.studyHeight + 15, width: layout.studyWidth - 36 }}><span>{part.number} / {part.name} · {chapter.caption}</span><small>AI 造型转译</small></div>}
    {part && <div className="cultural-column" inert={phase !== 'study'} aria-hidden={phase !== 'study'} style={{ left: layout.textX, top: layout.textY, width: layout.textWidth, height: layout.textHeight }}><CulturalPanel key={part.id} part={part} analysis={analysis} uvStudy={uvStudy} visible={phase === 'study'}/></div>}
    {!ready && <div className="initial-loader" role="status"><span>{error ? '载入未完成' : '载入醒狮'}</span><i><b style={{ width: `${Math.max(3, progress)}%` }}/></i><small>{error || `${Math.round(progress)}%`}</small>{error && <button onClick={() => location.reload()}>重新载入</button>}</div>}
    {ready && error && <div className="experience-error" role="alert">{error}<button onClick={() => setError(null)}>关闭</button></div>}
    <nav className="chapter-controls" ref={controls} style={{ width: layout.navWidth }} aria-label="六个造型研究控件">
      {PARTS.map(item => <button className={`chapter-control ${selected === item.id ? 'is-selected' : ''}`} key={item.id} data-part={item.id} aria-pressed={selected === item.id} aria-label={`${item.number} ${item.name}`} disabled={!ready} onClick={() => select(item.id)}><span className="control-number">{item.number}</span><img className="control-art" src={`/images/navigation/${item.id}.png`} alt="" width="80" height="80" draggable="false"/><span className="control-name">{item.name}</span></button>)}
    </nav>
    {ready && phase === 'overview' && <button className="reset-camera" title="还原视角" aria-label="还原视角" onClick={() => world.current?.reset()}><RotateCcw size={14}/></button>}
    {['travel', 'handoff', 'switching'].includes(phase) && <div className="flight-status" role="status"><i/>{part?.number} / {part?.name}</div>}
  </main>;
}
