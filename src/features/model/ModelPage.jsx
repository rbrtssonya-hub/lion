import { useEffect, useRef, useState } from 'react';
import { media } from '../../config/media.js';
import manifest from '../../data/lion-interactive-parts.json';
import './interactive-model.css';

const parts = manifest.parts;
const initialStatus = { phase: 'loading', message: '正在准备醒狮展陈' };
const initialState = { selectedId: null, explode: 0, mode: 'explore', motionPlaying: false, isolated: false, separated: false, autoRotate: false };
const levelNames = ['完整合狮', '装饰分离', '主要模块', '细部展开'];

/** React owns the interface; the scene owns all transforms and rendering. */
export default function ModelPage({ active = true, onReady, onObserve, onPartChange, lightingSettings }) {
  const [status, setStatus] = useState(initialStatus);
  const [view, setView] = useState(initialState);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [labels, setLabels] = useState(true);
  const [category, setCategory] = useState('全部');
  const [query, setQuery] = useState('');
  const [intensity, setIntensity] = useState(.55);
  const [openPanel, setOpenPanel] = useState(null);
  const [animations, setAnimations] = useState([]);
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const labelRefs = useRef(new Map());
  const guideRefs = useRef(new Map());
  const labelStateRef = useRef(view);
  labelStateRef.current = view;
  const latest = useRef();
  latest.current = { active, onReady, onPartChange, lightingSettings };
  const ready = status.phase === 'ready';
  const selected = parts.find(part => part.id === view.selectedId);
  const categories = ['全部', ...new Set(parts.map(part => part.category))];
  const maxLevel = Math.max(1, ...parts.map(part => Number(part.explodeLevel) || 0));
  const filtered = parts.filter(part => (category === '全部' || part.category === category)
    && `${part.name} ${part.category}`.toLowerCase().includes(query.trim().toLowerCase()));

  // Leaders remain attached to measured mesh projections. Labels occupy two
  // ordered gutters, keeping the assembled face and nearby labels unobscured.
  const projectLabels = anchors => {
    const width = containerRef.current?.clientWidth ?? 0;
    const height = containerRef.current?.clientHeight ?? 0;
    const current = labelStateRef.current;
    const compact = width < 620;
    const representatives = new Set(compact ? ['head_shell', 'body', 'tail']
      : ['head_shell', 'forehead', 'ear_l', 'lower_mouth', 'body', 'tail']);
    const showAll = !compact && current.explode >= 2.8;
    labelRefs.current.forEach(element => { element.hidden = true; });
    guideRefs.current.forEach(element => { element.style.display = 'none'; });
    const minimumY = 54;
    const maximumY = Math.max(minimumY, height - 65);
    const gap = compact ? 36 : 34;
    const capacity = Math.max(1, Math.floor((maximumY - minimumY) / gap) + 1);
    const candidates = anchors.filter(anchor => anchor.visible && Number.isFinite(anchor.x) && Number.isFinite(anchor.y)
      && anchor.x > 5 && anchor.x < width - 5 && anchor.y > 20 && anchor.y < height - 35
      && (showAll || representatives.has(anchor.id) || anchor.id === current.selectedId));
    candidates.sort((a, b) => Number(b.id === current.selectedId) - Number(a.id === current.selectedId));
    const limited = candidates.slice(0, compact ? 4 : capacity * 2).sort((a, b) => a.x - b.x);
    const columns = [limited.slice(0, Math.ceil(limited.length / 2)), limited.slice(Math.ceil(limited.length / 2))];
    const labelWidth = compact ? 30 : Math.min(142, Math.max(106, width * .17));
    columns.forEach((column, side) => {
      column.sort((a, b) => a.y - b.y);
      const positions = column.map(anchor => Math.max(minimumY, Math.min(maximumY, anchor.y)));
      for (let index = 1; index < positions.length; index += 1) positions[index] = Math.max(positions[index], positions[index - 1] + gap);
      if (positions.at(-1) > maximumY) {
        positions[positions.length - 1] = maximumY;
        for (let index = positions.length - 2; index >= 0; index -= 1) positions[index] = Math.min(positions[index], positions[index + 1] - gap);
      }
      column.forEach((anchor, index) => {
        const element = labelRefs.current.get(anchor.id);
        const guide = guideRefs.current.get(anchor.id);
        if (!element || !guide) return;
        const x = side === 0 ? 10 : width - labelWidth - 10;
        const y = positions[index];
        const joinX = side === 0 ? x + labelWidth : x;
        const elbowX = joinX + (side === 0 ? 12 : -12);
        element.hidden = false;
        element.dataset.compact = String(compact);
        element.dataset.anchorX = anchor.x.toFixed(1);
        element.dataset.anchorY = anchor.y.toFixed(1);
        element.style.width = `${labelWidth}px`;
        element.style.transform = `translate(${x}px, ${y}px) translateY(-50%)`;
        guide.style.display = '';
        guide.querySelector('path').setAttribute('d', `M ${joinX} ${y} L ${elbowX} ${y} L ${anchor.x} ${anchor.y}`);
        guide.querySelector('circle').setAttribute('cx', anchor.x);
        guide.querySelector('circle').setAttribute('cy', anchor.y);
      });
    });
  };

  useEffect(() => {
    const controller = new AbortController();
    let mountedScene;
    setStatus(initialStatus);
    setView(initialState);
    setLabels(true);
    setIntensity(.55);
    setAnimations([]);
    const timeout = setTimeout(() => {
      if (controller.signal.aborted) return;
      controller.abort();
      mountedScene?.dispose();
      sceneRef.current = null;
      setStatus({ phase: 'error', message: '模型准备超时，请重新载入' });
      latest.current.onReady?.(false);
    }, 60_000);
    async function loadScene() {
      try {
        const { createLionInteractiveScene } = await import('../../services/lionInteractiveScene.js');
        if (controller.signal.aborted) return;
        mountedScene = await createLionInteractiveScene({
          container: containerRef.current, modelUrl: media.model, parts, signal: controller.signal,
          active: latest.current.active && !document.hidden, lightingSettings: latest.current.lightingSettings,
          onStatus(next) {
            if (controller.signal.aborted) return;
            setStatus(next);
            if (next.capabilities?.animations) setAnimations(next.capabilities.animations);
            if (next.phase === 'error') { clearTimeout(timeout); latest.current.onReady?.(false); }
          },
          onSelectPart(id) {
            if (controller.signal.aborted) return;
            setView(previous => ({ ...previous, selectedId: id }));
            latest.current.onPartChange?.(id);
          },
          onAutoRotateChange(value) { if (!controller.signal.aborted) setView(previous => ({ ...previous, autoRotate: value })); },
          onStateChange(next) {
            if (controller.signal.aborted) return;
            labelStateRef.current = { ...labelStateRef.current, ...next };
            setView(previous => ({ ...previous, ...next }));
          },
          onProjectParts(anchors) {
            if (controller.signal.aborted) return;
            projectLabels(anchors);
          },
        });
        if (controller.signal.aborted) { mountedScene.dispose(); return; }
        clearTimeout(timeout);
        sceneRef.current = mountedScene;
        mountedScene.setLightingSettings(latest.current.lightingSettings);
        mountedScene.setActive(latest.current.active && !document.hidden);
        mountedScene.setLabels(true);
        mountedScene.setMotionIntensity(.55);
        latest.current.onReady?.(true);
      } catch (error) {
        clearTimeout(timeout);
        if (controller.signal.aborted) return;
        console.error('醒狮展陈载入失败', error);
        setStatus({ phase: 'error', message: '模型未能载入，请重试' });
        latest.current.onReady?.(false);
      }
    }
    loadScene();
    return () => { controller.abort(); clearTimeout(timeout); mountedScene?.dispose(); if (sceneRef.current === mountedScene) sceneRef.current = null; };
  }, [loadAttempt]);
  useEffect(() => {
    const sync = () => sceneRef.current?.setActive(active && !document.hidden);
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, [active]);
  useEffect(() => { sceneRef.current?.setLightingSettings(lightingSettings); }, [lightingSettings]);

  const selectPart = id => {
    sceneRef.current?.selectPart(id);
    if (window.matchMedia('(max-width: 1000px)').matches) setOpenPanel('details');
  };
  const setMode = mode => { sceneRef.current?.setMode(mode); setView(previous => ({ ...previous, mode })); };
  const setExplode = value => { sceneRef.current?.setExplode(value); setView(previous => ({ ...previous, explode: value, mode: 'explore' })); };
  const returnToOverview = () => { sceneRef.current?.selectPart(null, { focus: false }); sceneRef.current?.resetView(); };
  const restore = () => {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.setMode('explore'); scene.setExplode(0); scene.setIsolate(false); scene.separateSelected(false);
    scene.selectPart(null, { focus: false }); scene.setAutoRotate(false); scene.resetMotion(); scene.resetView();
    setView(initialState);
  };
  const progress = Math.round(view.explode / maxLevel * 100);
  const selectedIndex = selected ? parts.indexOf(selected) + 1 : 0;

  return <section id="modelStage" className="model-stage lion-exhibit" data-chapter="model"
    data-selected-id={view.selectedId ?? ''} data-focus-state={view.selectedId ?? 'overall'} data-mode={view.mode}
    data-explode={view.explode.toFixed(3)} aria-label="醒狮交互式拆解展陈"
    onKeyDown={event => { if (event.key === 'Escape' && !event.defaultPrevented) { sceneRef.current?.selectPart(null, { focus: false }); setOpenPanel(null); } }}>
    <div className="lx-workspace">
      <header className="lx-toolbar">
        <div className="lx-identity"><span className="lx-seal" aria-hidden="true">狮</span><div><p className="lx-kicker">南风有狮 <span>／</span> 数字造物馆</p><h1>形艺解构<span>一狮一世界</span></h1></div></div>
        <div className="lx-mode-switch" role="tablist" aria-label="展示模式">
          <button type="button" role="tab" aria-selected={view.mode === 'explore'} disabled={!ready} onClick={() => setMode('explore')}><span aria-hidden="true">◈</span>结构探索</button>
          <button type="button" role="tab" aria-selected={view.mode === 'motion'} disabled={!ready} onClick={() => setMode('motion')}><span aria-hidden="true">◌</span>动态演示</button>
        </div>
        <div className="lx-view-tools" aria-label="模型视图工具">
          <button id="resetView" type="button" disabled={!ready} onClick={restore}><span aria-hidden="true">↶</span>复原整体</button>
          <button id="toggleRotate" type="button" aria-pressed={view.autoRotate} disabled={!ready} onClick={() => sceneRef.current?.setAutoRotate(!view.autoRotate)}><span aria-hidden="true">↻</span>{view.autoRotate ? '暂停旋转' : '自动旋转'}</button>
          <button type="button" aria-pressed={labels} disabled={!ready} onClick={() => { sceneRef.current?.setLabels(!labels); setLabels(!labels); }}><span aria-hidden="true">⌖</span>{labels ? '隐藏标注' : '显示标注'}</button>
        </div>
      </header>
      <div className="lx-compact-tools" aria-label="折叠信息面板">
        <button type="button" aria-expanded={openPanel === 'parts'} onClick={() => setOpenPanel(openPanel === 'parts' ? null : 'parts')}>部件目录 <span>{parts.length}</span></button>
        <span>旋转 · 缩放 · 点选</span><button type="button" aria-expanded={openPanel === 'details'} onClick={() => setOpenPanel(openPanel === 'details' ? null : 'details')}>造型解读 <span>↗</span></button>
      </div>
      <div className="lx-main">
        <aside className="lx-panel lx-directory" data-open={openPanel === 'parts'} aria-label="醒狮部件目录">
          <div className="lx-panel-heading"><div><p className="lx-kicker">PART COLLECTION</p><h2>造型部件<span>{String(parts.length).padStart(2, '0')}</span></h2></div><button type="button" className="lx-panel-close" aria-label="收起部件目录" onClick={() => setOpenPanel(null)}>×</button></div>
          <label className="lx-search"><span aria-hidden="true">⌕</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索部件名称" aria-label="搜索部件" /></label>
          <div className="lx-categories" role="group" aria-label="部件分类">{categories.map(name => <button key={name} type="button" aria-pressed={category === name} onClick={() => setCategory(name)}>{name}</button>)}</div>
          <nav className="lx-part-list" aria-label="部件清单">{categories.slice(1).filter(name => filtered.some(part => part.category === name)).map(name => <div className="lx-part-group" key={name}>
            <h3>{name}<span>{filtered.filter(part => part.category === name).length}</span></h3>
            {filtered.filter(part => part.category === name).map(part => <button type="button" key={part.id} data-part-id={part.id} disabled={!ready} aria-pressed={view.selectedId === part.id} onClick={() => selectPart(part.id)}><span className="lx-part-index">{String(parts.indexOf(part) + 1).padStart(2, '0')}</span><span>{part.name}</span><span className="lx-part-arrow" aria-hidden="true">↗</span></button>)}
          </div>)}{!filtered.length && <div className="lx-empty"><p>没有找到对应部件</p><button type="button" onClick={() => { setQuery(''); setCategory('全部'); }}>清除筛选</button></div>}</nav>
          <div className="lx-directory-note"><i /><span>点选部件，走近造型细节<br /><small>按原模型可分离结构整理</small></span></div>
        </aside>
        <div className="lx-viewport" aria-label="醒狮三维交互展台">
          <div className="lx-viewport-caption"><span>醒狮 · 原作造型</span><span>{view.mode === 'motion' ? 'MOTION STUDY' : 'STRUCTURE STUDY'}</span></div>
          <div id="sceneContainer" className="lx-scene" ref={containerRef} />
          <nav className="lx-labels" hidden={!labels || !ready} aria-label="模型部件标注">
            <svg className="lx-label-guides" aria-hidden="true">{parts.map(part => <g key={part.id} className={view.selectedId === part.id ? 'is-selected' : ''}
              ref={element => { if (element) guideRefs.current.set(part.id, element); else guideRefs.current.delete(part.id); }}><path /><circle r="2.5" /></g>)}</svg>
            {parts.map((part, index) => <button type="button" key={part.id} hidden className={view.selectedId === part.id ? 'is-selected' : ''} aria-label={`聚焦${part.name}`} title={part.name} data-label-id={part.id}
              ref={element => { if (element) labelRefs.current.set(part.id, element); else labelRefs.current.delete(part.id); }} onClick={() => selectPart(part.id)}><span>{String(index + 1).padStart(2, '0')}<b>{part.name}</b></span></button>)}
          </nav>
          {!ready && <div className="lx-load-state" role="status">{status.phase === 'loading' ? <><span className="lx-loading-mark" aria-hidden="true">狮</span><p>{status.message}</p><small>让每一处匠心，清晰可见</small></> : <><span aria-hidden="true">↻</span><p>{status.message}</p><button type="button" onClick={() => setLoadAttempt(value => value + 1)}>重新载入模型</button></>}</div>}
          {selected && ready && <button className="lx-overview" type="button" onClick={returnToOverview}>↶ 返回整体视角</button>}
          <div className="lx-viewport-bottom"><div className={`lx-scene-status is-${status.phase}`}><i /><span id="modelStatus" role="status">{ready ? '原作模型已就绪' : status.message}</span></div><span className="lx-orbit-help">拖动旋转 <b>·</b> 滚轮缩放 <b>·</b> 右键平移</span></div>
        </div>
        <aside className="lx-panel lx-details" data-open={openPanel === 'details'} aria-label="部件详情与文化信息">
          <div className="lx-panel-heading"><div><p className="lx-kicker">FORM & CULTURE</p><h2>形中见艺<span>{selected ? String(selectedIndex).padStart(2, '0') : '序'}</span></h2></div><button type="button" className="lx-panel-close" aria-label="收起造型解读" onClick={() => setOpenPanel(null)}>×</button></div>
          <div className="lx-detail-scroll" key={selected?.id ?? 'overview'}>
            <span className="lx-detail-category">{selected?.category ?? '整体造型'}</span><h3 className="lx-detail-title">{selected?.name ?? '醒狮，一身好戏'}</h3><div className="lx-title-rule" />
            <p className="lx-lead">{selected?.appearance ?? '由完整造型走近每一个细节。在转动、分离与合拢之间，观察醒狮丰富的色彩、纹样与轮廓。'}</p>
            {selected ? <>
              <section className="lx-detail-section"><h4><span>01</span>造型中的作用</h4><p>{selected.role}</p></section>
              <section className="lx-detail-section"><h4><span>02</span>材质与工艺</h4><p>{selected.material}</p></section>
              <section className="lx-culture-note"><span className="lx-culture-glyph" aria-hidden="true">藝</span><h4>一处造型，一份传承</h4><p>{selected.culture}</p></section>
            </> : <>
              <section className="lx-detail-section"><h4><span>01</span>从整体到细节</h4><p>从左侧目录或模型标注中选择部件，镜头会带你靠近。再次点选可取消选择，随时返回整体视角。</p></section>
              <section className="lx-culture-note"><span className="lx-culture-glyph" aria-hidden="true">藝</span><h4>狮头扎作</h4><p>扎、朴、写、装，将轮廓、色彩与装饰凝为一体。夸张的造型承载着醒狮的神采，也让工艺成为可观看的表情。</p></section>
            </>}
            <div className="lx-part-actions"><button type="button" disabled={!ready || !selected || view.mode !== 'explore'} aria-pressed={view.separated} onClick={() => sceneRef.current?.separateSelected(!view.separated)}>{view.separated ? '收回当前部件' : '单独分离部件'}</button><button type="button" disabled={!ready || !selected || view.mode !== 'explore'} aria-pressed={view.isolated} onClick={() => sceneRef.current?.setIsolate(!view.isolated)}>{view.isolated ? '显示全部部件' : '仅看当前部件'}</button></div>
            {selected && onObserve && /eye|mouth|眼|口/.test(`${selected.id} ${selected.name}`) && <button id="modelExpressionLink" className="lx-expression-link" type="button" onClick={() => onObserve({ expressionId: /eye|眼/.test(`${selected.id} ${selected.name}`) ? 'surprise' : 'delight', returnPartId: selected.id })}>走近醒狮神态 <span>↗</span></button>}
            <details className="lx-resource-note"><summary>模型与展示说明<span>＋</span></summary><p>当前拆解依据原模型的独立网格，用于观察造型关系。</p>{manifest.limitations?.map((item, index) => <p key={index}>{item}</p>)}<p>工艺背景资料：</p>{manifest.sources?.map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title ?? source.name} ↗</a>)}</details>
          </div>
        </aside>
      </div>
      <footer className="lx-console">
        {view.mode === 'explore' ? <>
          <div className="lx-console-heading"><div><p className="lx-kicker">LAYER BY LAYER</p><h2>层层观狮</h2></div><span>拆解进度 <b>{progress}<small>%</small></b></span></div>
          <div className="lx-explode-controls"><div className="lx-levels" role="group" aria-label="拆解层级">{Array.from({ length: maxLevel + 1 }, (_, level) => <button key={level} type="button" data-level={level} disabled={!ready} aria-pressed={Math.round(view.explode) === level} onClick={() => setExplode(level)}><span>0{level}</span>{levelNames[level] ?? `第 ${level} 级`}</button>)}</div><label className="lx-range"><span className="sr-only">拆解进度</span><input id="explodeProgress" type="range" aria-label="拆解进度" min="0" max={maxLevel} step="0.01" value={view.explode} disabled={!ready} style={{ '--range-fill': `${progress}%` }} onChange={event => setExplode(Number(event.target.value))} /><span>合</span><span>分</span></label></div>
          <div className="lx-console-actions"><button type="button" disabled={!ready || view.explode >= maxLevel} onClick={() => setExplode(Math.min(maxLevel, Math.floor(view.explode + .001) + 1))}>逐级拆解 <span>＋</span></button><button type="button" disabled={!ready || view.explode >= maxLevel} onClick={() => setExplode(maxLevel)}>全部拆解 <span>↗</span></button><button className="lx-primary" type="button" disabled={!ready || view.explode >= maxLevel} onClick={() => sceneRef.current?.playExplode('out')}>自动拆解 <span>▷</span></button><button type="button" disabled={!ready || view.explode <= 0} onClick={() => sceneRef.current?.playExplode('in')}>自动复原 <span>↶</span></button></div>
        </> : <>
          <div className="lx-console-heading"><div><p className="lx-kicker">A LIVING FORM</p><h2>醒狮有灵</h2></div><span>{view.motionPlaying ? '动态演示中' : '动作已暂停'}</span></div>
          <div className="lx-motion-controls"><div className="lx-motion-capabilities">{animations.length ? animations.map(animation => <span key={animation.id}>{animation.name ?? animation.label}</span>) : <span>当前模型无独立可控动作</span>}</div><label className="lx-intensity"><span>动作强度 <b>{Math.round(intensity * 100)}%</b></span><input type="range" aria-label="动作强度" min="0" max="1" step="0.01" value={intensity} disabled={!ready} onChange={event => { const value = Number(event.target.value); setIntensity(value); sceneRef.current?.setMotionIntensity(value); }} /></label></div>
          <div className="lx-console-actions"><button className="lx-primary" type="button" disabled={!ready || !animations.length} aria-pressed={view.motionPlaying} onClick={() => sceneRef.current?.setMotionPlaying(!view.motionPlaying)}>{view.motionPlaying ? '暂停动作' : '开始 / 继续'}<span>{view.motionPlaying ? 'Ⅱ' : '▷'}</span></button><button type="button" disabled={!ready} onClick={() => sceneRef.current?.resetMotion()}>动作归位 <span>↶</span></button></div>
        </>}
      </footer>
      <details className="lx-guide"><summary><span>ⓘ 操作指南</span><span>点选 · 拆解 · 观赏</span></summary><p>鼠标拖动旋转，滚轮缩放，右键拖动平移。触屏单指旋转，双指缩放与平移。点选模型、标注或部件目录可聚焦，再次点选取消。拖动进度滑块分离部件；「复原整体」恢复造型与视角。「动态演示」独立控制源模型中可运动的部件，暂停会保留当前姿态。</p></details>
    </div>
  </section>;
}
