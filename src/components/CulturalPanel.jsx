import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import gsap from 'gsap';
import { CHAPTERS } from '../content/chapters.js';
import { CULTURE } from '../content/culture.js';

const makePath = (points, close = false) => points.length ? points.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ') + (close ? ' Z' : '') : '';
const normalize = (points, x = 10, y = 10, width = 300, height = 65) => {
  if (!points.length) return [];
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const scale = Math.min(width / (maxX - minX || 1), height / (maxY - minY || 1));
  return points.map(p => [x + width / 2 + (p[0] - (maxX + minX) / 2) * scale, y + height / 2 - (p[1] - (maxY + minY) / 2) * scale]);
};

function ShapeTrace({ part, analysis, uvStudy }) {
  if (!analysis) return null;
  const profile = analysis.profile?.samples?.filter(s => s.count && s.center) || [];
  let content;
  if (part.id === 'brows') {
    const samples = analysis.radial.samples.filter(s => s.count);
    const points = normalize(samples.map(s => [Math.cos(s.angle) * s.radius, Math.sin(s.angle) * s.radius]), 76, 8, 168, 70);
    content = <><circle cx="160" cy="43" r="34" className="trace-guide"/><path d="M110 43H210M160 6V80" className="trace-guide"/><path className="trace-path" d={makePath(points, true)}/>{points.filter((_,i) => i % 4 === 0).map((p,i) => <circle key={i} cx={p[0]} cy={p[1]} r="1.4"/>)}</>;
  } else if (part.id === 'crown' || part.id === 'mouth') {
    const components = analysis.components;
    const projected = normalize(components.map(c => part.id === 'mouth' ? [c.center[0], c.center[1]] : [c.center[0] - c.center[2] * .7, c.center[1] - c.center[2] * .25]), 48, 15, 224, 53);
    content = <>{components.map((c,i) => {
      const w = Math.max(14, c.size[0] / Math.max(...components.map(p => p.size[0]), .01) * 150);
      const p = projected[i];
      return <g key={c.name}><path className="trace-guide" d={`M160 43L${p[0]} ${p[1]}`}/><path className="trace-path" d={`M${p[0]-w/2} ${p[1]-7}h${w}v14h-${w}Z`}/><circle cx={p[0]} cy={p[1]} r="2"/></g>;
    })}</>;
  } else if (part.id === 'beard') {
    const max = Math.max(...profile.map(s => s.width), .001);
    content = <>{profile.filter((_,i)=>i%2===0).map((s,i,all) => <path className="trace-path" key={i} d={`M${160-s.width/max*105} ${9+i/(all.length-1||1)*67}H${160+s.width/max*105}`}/>)}<path className="trace-guide" d="M160 4V82"/></>;
  } else if (part.id === 'body') {
    const points = (uvStudy?.uvPoints || []).filter((_,i)=>i%3===0);
    const bounds = uvStudy?.uvBounds || { min: [0, 0], size: [1, 1] };
    content = <><path className="trace-path" d="M118 5H200V81H118Z"/>{points.map((p,i) => <circle key={i} cx={118 + (p[0]-bounds.min[0]) / (bounds.size[0]||1) * 82} cy={81 - (p[1]-bounds.min[1]) / (bounds.size[1]||1) * 76} r=".7" className="trace-uv-point"/>)}</>;
  } else {
    const max = Math.max(...profile.map(s => s.width), .001);
    const raw = profile.map((s,i) => [10+i/(profile.length-1||1)*300, 72-s.width/max*56]);
    const smooth = raw.map((p,i) => [p[0], raw.slice(Math.max(0,i-2),i+3).reduce((sum,q)=>sum+q[1],0)/raw.slice(Math.max(0,i-2),i+3).length]);
    content = <><path className="trace-guide" d={makePath(raw)}/><path className="trace-path" d={makePath(smooth)}/></>;
  }
  return <svg viewBox="0 0 320 86" className="shape-trace" role="img" aria-label={CHAPTERS[part.id].diagram}>{content}</svg>;
}

/** Culture enters only after the matching full-frame artwork replaces 3D. */
export default function CulturalPanel({ part, analysis, uvStudy, visible }) {
  const root = useRef(null), timeline = useRef(null), reader = useRef(null), detail = useRef(null);
  const [tab, setTab] = useState('culture'), [step, setStep] = useState(0);
  const uid = useId();
  const chapter = CHAPTERS[part.id];
  const culture = CULTURE[part.id];
  const ratio = analysis ? analysis.bounds.size[0] / Math.max(analysis.bounds.size[1], .001) : 0;
  useLayoutEffect(() => {
    const context = gsap.context(() => {
      gsap.set(root.current, { autoAlpha: 0, y: 0 });
      const paths = gsap.utils.toArray('.trace-path');
      paths.forEach(path => { const length = path.getTotalLength(); gsap.set(path, { strokeDasharray: length, strokeDashoffset: length }); });
      const tl = gsap.timeline({ paused: true });
      tl.fromTo('.chapter-eyebrow', { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: .6 }, 0)
        .fromTo('.title-character', { yPercent: 110, rotate: 4, opacity: .2 }, { yPercent: 0, rotate: 0, opacity: 1, duration: .9, stagger: .045, ease: 'power3.out' }, .1)
        .fromTo('.chapter-english', { x: 16, opacity: 0 }, { x: 0, opacity: 1, duration: .7 }, .6)
        .fromTo('.editorial-rule', { scaleX: 0 }, { scaleX: 1, duration: .8, transformOrigin: 'left' }, .65)
        .fromTo('[data-copy]', { y: 17, opacity: 0 }, { y: 0, opacity: 1, stagger: .08, duration: .8, ease: 'power2.out' }, .75)
        .to(paths, { strokeDashoffset: 0, stagger: .035, duration: 1.2, ease: 'power2.inOut' }, 1.05)
        .fromTo('.chapter-data, .chapter-source', { y: 10, opacity: 0 }, { y: 0, opacity: 1, stagger: .12, duration: .65 }, 1.1);
      timeline.current = tl;
    }, root);
    return () => { timeline.current?.kill(); gsap.killTweensOf(root.current); context.revert(); };
  }, [part.id, analysis, uvStudy]);
  useEffect(() => {
    if (visible) {
      gsap.to(root.current, { autoAlpha: 1, y: 0, duration: .35, overwrite: true });
      timeline.current?.restart();
    }
    else {
      timeline.current?.pause();
      gsap.to(root.current, { autoAlpha: 0, y: 8, duration: .22, overwrite: true });
    }
  }, [visible, part.id, analysis, uvStudy]);

  useLayoutEffect(() => {
    if (reader.current) reader.current.scrollTop = 0;
    if (!visible) return;
    const context = gsap.context(() => {
      gsap.fromTo('.reader-page:not([hidden])', { opacity: .2, y: 9 }, { opacity: 1, y: 0, duration: .4, ease: 'power2.out' });
      if (tab === 'data') gsap.utils.toArray('.trace-path').forEach(path => {
        const length = path.getTotalLength();
        gsap.fromTo(path, { strokeDasharray: length, strokeDashoffset: length }, { strokeDashoffset: 0, duration: 1, ease: 'power2.inOut' });
      });
    }, root);
    return () => context.revert();
  }, [tab]);

  const palette = uvStudy?.palette || [];
  const chooseStep = index => {
    setStep(index);
    requestAnimationFrame(() => detail.current?.scrollIntoView({ block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }));
  };
  const changeTabByKey = event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    const next = event.key === 'Home' ? 'culture' : event.key === 'End' ? 'data' : tab === 'culture' ? 'data' : 'culture';
    setTab(next);
    document.getElementById(`${uid}-${next}-tab`)?.focus();
  };

  return <article ref={root} className="cultural-panel" aria-hidden={!visible} data-chapter={part.id}>
    <header className="chapter-heading">
    <div className="chapter-eyebrow"><span>{part.number} / {part.name}</span><span>THE LION ATLAS</span></div>
    <h1 aria-label={chapter.title.join('，')}>{chapter.title.map((line,i) => <span className="title-line" key={line}>{[...line].map((char,j) => <span className="title-character" key={j}>{char}</span>)}{i === 1 && <i>。</i>}</span>)}</h1>
    <p className="chapter-english">{part.english}</p>
    <div className="editorial-rule"/>
    <p className="chapter-lead" data-copy>{chapter.lead}</p>
    </header>
    <div className="reader-tabs" role="tablist" aria-label="章节阅读内容" onKeyDown={changeTabByKey}>
      <button id={`${uid}-culture-tab`} role="tab" tabIndex={tab === 'culture' ? 0 : -1} aria-selected={tab === 'culture'} aria-controls={`${uid}-culture`} onClick={() => setTab('culture')}><span>01</span>文化图解</button>
      <button id={`${uid}-data-tab`} role="tab" tabIndex={tab === 'data' ? 0 : -1} aria-selected={tab === 'data'} aria-controls={`${uid}-data`} onClick={() => setTab('data')}><span>02</span>形态数据</button>
      <small>向下阅读 ↓</small>
    </div>
    <div ref={reader} className="chapter-reader" tabIndex="0" aria-label={`${part.name}图文阅读区`}>
      <section className="reader-page culture-page" id={`${uid}-culture`} role="tabpanel" aria-labelledby={`${uid}-culture-tab`} hidden={tab !== 'culture'}>
        <div className="reader-section-title"><h2>{culture.heading}</h2><small>{culture.english}</small></div>
        <p className="culture-copy">{culture.intro}</p>
        <figure className={`culture-figure culture-figure--${culture.layout}`}>
          <img className="culture-art" src={culture.image} width="1536" height="1024" alt={culture.alt} draggable="false"/>
          <div className="culture-zones">{culture.steps.map((item, index) => <button key={item.title} className={`culture-zone ${step === index ? 'is-active' : ''}`} aria-label={`查看${item.title}图解`} aria-pressed={step === index} onClick={() => chooseStep(index)}><span>{String(index + 1).padStart(2, '0')}</span></button>)}</div>
          <figcaption><span>艺术示意 · 点击图中编号解读</span><small>{String(step + 1).padStart(2, '0')} / {String(culture.steps.length).padStart(2, '0')}</small></figcaption>
        </figure>
        <div className="culture-step-controls" style={{ '--steps': culture.steps.length }} aria-label="图解分项">{culture.steps.map((item, index) => <button key={item.title} aria-pressed={step === index} onClick={() => chooseStep(index)}><small>{String(index + 1).padStart(2, '0')}</small>{item.title}</button>)}</div>
        <div ref={detail} className="culture-detail" aria-live="polite" aria-atomic="true"><span className="culture-word">{culture.steps[step].word}</span><div><h3>{culture.steps[step].title}</h3><p>{culture.steps[step].text}</p></div></div>
        <section className="culture-context"><div className="reader-section-title"><h2>{culture.contextTitle}</h2><small>CULTURAL CONTEXT</small></div><p>{culture.context}</p><ol className="culture-vocabulary">{culture.vocabulary.map((word, index) => <li key={word}><small>{String(index + 1).padStart(2, '0')}</small><span>{word}</span></li>)}</ol></section>
        <p className="reading-note"><span>读图</span>{culture.reading}</p>
        <div className="chapter-sources">{culture.sources.map(source => <a key={source.url} className="chapter-source" href={source.url} target="_blank" rel="noreferrer">{source.title}<ArrowUpRight size={11}/></a>)}</div>
      </section>
      <section className="reader-page data-page" data-chart={part.id} id={`${uid}-data`} role="tabpanel" aria-labelledby={`${uid}-data-tab`} hidden={tab !== 'data'}>
        <div className="reader-section-title"><h2>从模型中读出形态</h2><small>MEASURED FROM THE MODEL</small></div>
        <p className="culture-copy">{chapter.shapeText}</p>
        <figure className="chapter-diagram"><figcaption><span>{chapter.diagram}</span><small>{chapter.diagramEnglish}</small></figcaption><ShapeTrace part={part} analysis={analysis} uvStudy={uvStudy}/><div className="chart-legend">{culture.legend.map((label,i) => <span className={`legend-item legend-item--${i}`} key={label}>{label}</span>)}</div></figure>
        <p className="data-explainer">{culture.dataReading}</p>
        <div className="chapter-data"><span><b>{analysis?.objectCount ?? '—'}</b>原始构件</span><span><b>{ratio.toFixed(2)}<small> : 1</small></b>宽高比例</span><span className="data-evidence">真实模型<br/><small>静态形态分析</small></span></div>
        <div className="dimension-study"><div className="reader-section-title"><h2>三个方向的尺度</h2><small>MODEL UNITS</small></div>{(analysis?.bounds.size || []).map((value, index, sizes) => <div className="dimension-row" key={index}><span>{['宽 · X', '高 · Y', '深 · Z'][index]}</span><i><b style={{ width: `${value / Math.max(...sizes, .001) * 100}%` }}/></i><code>{value.toFixed(3)}</code></div>)}<p>按模型坐标测量外包围盒；长度为统一显示尺度下的模型单位。</p></div>
        {part.id === 'body' && palette.length > 0 && <div className="texture-palette"><div className="reader-section-title"><h2>织锦表面的色彩</h2><small>TEXTURE COLOUR STUDY</small></div><div className="palette-band">{palette.map((color,i) => <span key={i} title={color.color} style={{ backgroundColor: color.color, flex: color.share }}/>)}</div><p>贴图与基础色按三角表面积估计；不包含灯光和材质着色效果。</p></div>}
        <p className="reading-note"><span>方法</span>{chapter.note}</p>
        <div className="sample-note"><span>顶点样本</span><b>{(analysis?.points.length || 0).toLocaleString()}</b><span>网格顶点</span><b>{(analysis?.vertexCount || 0).toLocaleString()}</b></div>
      </section>
    </div>
  </article>;
}
