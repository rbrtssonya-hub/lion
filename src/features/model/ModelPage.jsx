import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { media } from '../../config/media.js';
import lionStructure from '../../data/lion-structure.json';

const initialStatus = { phase: 'loading', message: '正在载入醒狮模型' };
const shortPartNames = { outer_shell: '狮头', eyes: '眉眼', mirror: '额饰', mouth: '狮嘴', fur_and_bells: '须毛', lion_cloth: '狮被' };

function DetailList({ entries, className = 'panel-detail-list' }) {
  return (
    <dl className={className}>
      {entries.map(([label, value]) => (
        <div key={label} className="panel-detail-row">
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function ModelPage({ active = true, onReady, onObserve, onPartChange }) {
  const hotspots = lionStructure.hotspots;
  const [selectedId, setSelectedId] = useState(hotspots[0]?.id);
  const [autoRotate, setAutoRotate] = useState(false);
  const [focusState, setFocusState] = useState('overall');
  const [detailTab, setDetailTab] = useState('structure');
  const [status, setStatus] = useState(initialStatus);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const containerRef = useRef(null);
  const interactionRef = useRef(null);
  const headerRef = useRef(null);
  const detailScrollRef = useRef(null);
  const scrollToTab = useRef(false);
  const hotspotOverlayRef = useRef(null);
  const projectedHotspotRefs = useRef(new Map());
  const sceneRef = useRef(null);
  const autoRotateRef = useRef(autoRotate);
  const activeRef = useRef(active);
  const onReadyRef = useRef(onReady);
  const selectedRef = useRef(null);
  const focusStateRef = useRef(focusState);
  const focusPointRef = useRef(null);
  const selectedIndex = hotspots.findIndex((item) => item.id === selectedId);
  const selected = hotspots[selectedIndex] ?? hotspots[0];
  const expressionLink = { eyes: { expressionId: 'surprise', name: '惊', partLabel: '眉眼' }, mouth: { expressionId: 'delight', name: '乐', partLabel: '狮嘴' } }[selected.id];
  activeRef.current = active;
  onReadyRef.current = onReady;
  selectedRef.current = selected;
  focusStateRef.current = focusState;

  const selectHotspot = (id, point) => {
    const next = hotspots.find((item) => item.id === id);
    if (!next) return;
    onPartChange?.(id);
    selectedRef.current = next;
    focusStateRef.current = id;
    focusPointRef.current = point ?? null;
    setSelectedId(id);
    setFocusState(id);
    setAutoRotate(false);
    if (detailScrollRef.current) detailScrollRef.current.scrollTop = 0;
    sceneRef.current?.focusOn({ id, target: next.focusTarget, distance: next.focusDistance, point });
  };

  const resetView = () => {
    onPartChange?.(hotspots[0]?.id);
    selectedRef.current = hotspots[0];
    focusStateRef.current = 'overall';
    focusPointRef.current = null;
    setSelectedId(hotspots[0]?.id);
    setFocusState('overall');
    setAutoRotate(false);
    sceneRef.current?.resetView();
  };

  const projectHotspots = (anchors) => {
    const frame = interactionRef.current;
    const overlay = hotspotOverlayRef.current;
    if (!frame || !overlay) return;
    const width = frame.clientWidth;
    const height = frame.clientHeight;
    if (!width || !height) return;
    const chipWidth = width < 540 ? 72 : 128;
    const compact = String(width < 540);
    if (overlay.dataset.compact !== compact) {
      overlay.dataset.compact = compact;
      overlay.style.setProperty('--model-hotspot-width', `${chipWidth}px`);
    }
    const leftParts = new Set(['mirror', 'eyes', 'fur_and_bells']);
    const columns = [[], []];
    const projected = new Map(anchors.map((anchor) => [anchor.id, anchor]));
    for (const item of hotspots) {
      const nodes = projectedHotspotRefs.current.get(item.id);
      const anchor = projected.get(item.id);
      const visible = Boolean(anchor?.visible && Number.isFinite(anchor.x) && Number.isFinite(anchor.y));
      if (!nodes?.button || !nodes.line || !nodes.dot) continue;
      if (nodes.button.hidden === visible) {
        nodes.button.hidden = !visible;
        nodes.button.dataset.visible = String(visible);
      }
      const display = visible ? '' : 'none';
      if (nodes.line.style.display !== display) nodes.line.style.display = display;
      if (nodes.dot.style.display !== display) nodes.dot.style.display = display;
      if (visible) columns[leftParts.has(item.id) ? 0 : 1].push({ anchor, nodes });
    }
    columns.forEach((entries, column) => {
      entries.sort((a, b) => a.anchor.y - b.anchor.y);
      const minY = 56;
      const maxY = Math.max(minY, height - 24);
      const gap = 44;
      const positions = entries.map(({ anchor }) => Math.min(maxY, Math.max(minY, anchor.y)));
      for (let index = 1; index < positions.length; index += 1) {
        positions[index] = Math.max(positions[index], positions[index - 1] + gap);
      }
      const overflow = Math.max(0, (positions.at(-1) ?? 0) - maxY);
      positions.forEach((position, index) => {
        const { anchor, nodes } = entries[index];
        const y = position - overflow;
        const x = column === 0 ? 4 : width - chipWidth - 4;
        const joinX = column === 0 ? x + chipWidth : x;
        const elbowX = joinX + (column === 0 ? 16 : -16);
        nodes.button.style.transform = `translate(${x}px, ${y - 16}px)`;
        nodes.button.dataset.anchorX = anchor.x.toFixed(1);
        nodes.button.dataset.anchorY = anchor.y.toFixed(1);
        nodes.button.dataset.labelX = x.toFixed(1);
        nodes.button.dataset.labelY = y.toFixed(1);
        nodes.line.setAttribute('d', `M ${joinX} ${y} L ${elbowX} ${y} L ${anchor.x} ${anchor.y}`);
        nodes.dot.setAttribute('cx', anchor.x);
        nodes.dot.setAttribute('cy', anchor.y);
      });
    });
  };

  const bindProjectedHotspot = (id, field, node) => {
    const nodes = projectedHotspotRefs.current.get(id) ?? {};
    nodes[field] = node;
    projectedHotspotRefs.current.set(id, nodes);
  };

  useEffect(() => {
    const syncActivity = () => sceneRef.current?.setActive(active && !document.hidden);
    syncActivity();
    document.addEventListener('visibilitychange', syncActivity);
    return () => document.removeEventListener('visibilitychange', syncActivity);
  }, [active]);

  useEffect(() => {
    autoRotateRef.current = autoRotate;
    sceneRef.current?.setAutoRotate(autoRotate);
  }, [autoRotate]);

  useEffect(() => {
    if (detailScrollRef.current) detailScrollRef.current.scrollTop = 0;
  }, [selectedId]);
  useLayoutEffect(() => {
    if (!scrollToTab.current) return;
    scrollToTab.current = false;
    const pane = detailScrollRef.current;
    const tabs = pane?.querySelector('.model-detail-tabs');
    if (pane && tabs && getComputedStyle(pane).overflowY === 'auto') {
      pane.scrollTop += tabs.getBoundingClientRect().top - pane.getBoundingClientRect().top - 8;
    }
  }, [detailTab]);
  const selectDetailTab = value => { scrollToTab.current = value !== detailTab; setDetailTab(value); };

  useEffect(() => {
    const controller = new AbortController();
    let mountedScene;
    setStatus(initialStatus);
    const preparationTimeout = setTimeout(() => {
      if (controller.signal.aborted) return;
      controller.abort();
      setStatus({ phase: 'error', message: '模型准备超时，可重新载入' });
      onReadyRef.current?.(false);
    }, 45_000);

    async function loadScene() {
      try {
        const { createLionScene } = await import('../../services/lionScene.js');
        if (controller.signal.aborted) return;
        mountedScene = await createLionScene({
          container: containerRef.current,
          interactionElement: interactionRef.current,
          layoutElement: headerRef.current,
          modelUrl: media.model,
          hotspots,
          onSelectPart: selectHotspot,
          onProjectParts: projectHotspots,
          signal: controller.signal,
          autoRotate: autoRotateRef.current,
          active: activeRef.current,
          onStatus: (nextStatus) => {
            if (!controller.signal.aborted) {
              setStatus(nextStatus);
              if (nextStatus.phase === 'error') {
                clearTimeout(preparationTimeout);
                onReadyRef.current?.(false);
              }
            }
          },
          onAutoRotateChange: (value) => {
            if (!controller.signal.aborted) setAutoRotate(value);
          },
        });
        if (controller.signal.aborted) {
          mountedScene.dispose();
          return;
        }
        sceneRef.current = mountedScene;
        clearTimeout(preparationTimeout);
        mountedScene.setAutoRotate(autoRotateRef.current);
        mountedScene.setActive(activeRef.current && !document.hidden);
        onReadyRef.current?.(true);
        const latestSelected = selectedRef.current;
        if (focusStateRef.current !== 'overall' && latestSelected) {
          mountedScene.focusOn({ id: latestSelected.id, target: latestSelected.focusTarget, distance: latestSelected.focusDistance, point: focusPointRef.current });
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        clearTimeout(preparationTimeout);
        console.error('醒狮三维场景无法载入', error);
        setStatus({ phase: 'error', message: '模型载入失败，可重新载入' });
        onReadyRef.current?.(false);
      }
    }

    loadScene();
    return () => {
      controller.abort();
      clearTimeout(preparationTimeout);
      mountedScene?.dispose();
      if (sceneRef.current === mountedScene) sceneRef.current = null;
    };
  }, [loadAttempt]);

  return (
    <section
      id="modelStage"
      className="model-stage"
      data-chapter="model"
      data-selected-id={selected?.id}
      data-focus-state={focusState}
      aria-label="醒狮整体与结构"
    >
      <div
        id="sceneContainer"
        className="scene-container"
        ref={containerRef}
        aria-hidden="true"
        style={{ visibility: status.phase === 'ready' ? 'visible' : 'hidden' }}
      />
      <div className="model-layout">
        <div className="scene-column">
          <div className="scene-frame" id="sceneFrame">
            {status.phase !== 'ready' && (
              <img className="model-fallback" id="modelFallback" src={media.poster} alt="" />
            )}
            <div className="scene-interaction" id="sceneInteraction" ref={interactionRef}
              aria-label="醒狮三维模型，可拖动旋转、滚轮缩放或点击部件聚焦" />
            <nav className="model-hotspots" id="modelHotspots" ref={hotspotOverlayRef}
              hidden={status.phase !== 'ready'} aria-label="模型对应结构">
              <p className="model-hotspots-caption" aria-hidden="true">对应结构<span>点击标签聚焦</span></p>
              <svg className="model-anchor-guides" aria-hidden="true">
                {hotspots.map((item) => (
                  <g key={item.id} className={focusState === item.id ? 'is-active' : ''}>
                    <path className="model-anchor-line" data-part={item.id}
                      ref={(node) => bindProjectedHotspot(item.id, 'line', node)} />
                    <circle className="model-anchor-dot" r="3"
                      ref={(node) => bindProjectedHotspot(item.id, 'dot', node)} />
                  </g>
                ))}
              </svg>
              {hotspots.map((item, index) => (
                <button key={item.id} type="button" className={`model-hotspot${focusState === item.id ? ' is-active' : ''}`}
                  data-id={item.id} data-visible="false" hidden
                  aria-label={`聚焦${item.name}`} title={item.name} aria-pressed={focusState === item.id}
                  ref={(node) => bindProjectedHotspot(item.id, 'button', node)}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => { event.stopPropagation(); selectHotspot(item.id); }}>
                  <span className="model-hotspot-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                  <span className="model-hotspot-label">{item.name}</span>
                  <span className="model-hotspot-short">{shortPartNames[item.id]}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>

        <aside className="info-panel structure-panel" id="structurePanel" aria-label="醒狮部件档案">
          <header className="model-header" ref={headerRef}>
            <div className="panel-section-mark"><span>结构 · 形中见艺</span><span>STRUCTURE</span></div>
            <h1>解构一头醒狮</h1>
            <p className="model-intro">从整体轮廓，走近每一处匠心。</p>
            <div className={`model-header-meta is-${status.phase}`}>
              {status.phase === 'loading' ? <span className="loader-ring" aria-hidden="true" /> : <span className="live-dot" aria-hidden="true" />}
              <span id="modelStatus" role="status">{status.message}</span>
              {status.phase === 'error' && <button className="model-retry" type="button" onClick={() => setLoadAttempt((value) => value + 1)}>重新载入</button>}
            </div>
          </header>

          <div className="model-view-tools">
            <div className="scene-action-row">
              <button type="button" id="resetView" disabled={status.phase !== 'ready'} onClick={resetView}>
                <span aria-hidden="true">↶</span> 复原整体
              </button>
              <button type="button" id="toggleRotate" className={autoRotate ? 'active' : ''}
                disabled={status.phase !== 'ready'} aria-pressed={autoRotate}
                aria-label={autoRotate ? '暂停自动旋转' : '开启自动旋转'}
                onClick={() => setAutoRotate((value) => !value)}>
                <span aria-hidden="true">↻</span> {autoRotate ? '暂停旋转' : '自动旋转'}
              </button>
            </div>
            <p className="scene-controls">拖动旋转<span aria-hidden="true">·</span>滚轮缩放<span aria-hidden="true">·</span>点击部件聚焦</p>
          </div>

          <div className="model-part-picker">
            <div className="part-picker-heading"><span>部件索引</span><span>点击模型或下方部件</span></div>
            <nav className="hotspot-list" id="hotspotList" aria-label="部件列表">
              {hotspots.map((item, index) => (
                <button key={item.id} type="button" data-id={item.id}
                  className={selectedId === item.id ? 'active' : ''}
                  aria-pressed={selectedId === item.id}
                  onClick={() => selectHotspot(item.id)}>
                  <span className="list-number">{String(index + 1).padStart(2, '0')}</span>
                  <span className="list-name">{item.name}</span>
                  <span className="list-arrow" aria-hidden="true">↗</span>
                </button>
              ))}
            </nav>
          </div>

          <div className="model-detail-scroll" id="modelDetailContent" ref={detailScrollRef} tabIndex={0}
            aria-labelledby={detailTab === 'structure' ? 'structureDetailTab' : 'cultureDetailTab'}>
            <div className="part-detail-heading">
              <div className="panel-index" id="panelIndex">{String(selectedIndex + 1).padStart(2, '0')} / {String(hotspots.length).padStart(2, '0')}</div>
              <span className="focus-indicator">{focusState === 'overall' ? '整体视图' : '局部聚焦'}</span>
            </div>
            <p className="panel-kicker">{selected.kicker}</p>
            <h2 id="structureTitle" aria-live="polite"><span id="panelTitle">{selected.name}</span></h2>
            <div className="function-block model-part-purpose"><span className="label">部位作用</span><p id="panelFunction">{selected.function}</p></div>
            <p className="panel-description model-observation" id="panelDescription">{selected.description}</p>
            {expressionLink && <div className="model-expression-recommendation"><button type="button" id="modelExpressionLink" onClick={() => onObserve?.({ ...expressionLink, returnPartId: selected.id })}>去神态页观察{expressionLink.name}态</button><p>观察推荐，并非部位与情绪的固定对应。</p></div>}
            <div className="model-detail-tabs" aria-label="部件解读内容">
              <button type="button" id="structureDetailTab" className={detailTab === 'structure' ? 'active' : ''}
                aria-pressed={detailTab === 'structure'} aria-controls="modelDetailContent" onClick={() => selectDetailTab('structure')}>结构与工艺</button>
              <button type="button" id="cultureDetailTab" className={detailTab === 'culture' ? 'active' : ''}
                aria-pressed={detailTab === 'culture'} aria-controls="modelDetailContent" onClick={() => selectDetailTab('culture')}>文化与造型</button>
            </div>
            <p className="panel-material" id="panelMaterial">{selected.material}</p>

            {detailTab === 'structure' ? (
              <section className="part-structure-detail" aria-label="当前部件结构与工艺">
                <DetailList entries={[
                  ['组成', selected.structure.parts.join(' · ')],
                  ['材料', selected.structure.material],
                  ['工艺', selected.structure.craft],
                  ['连接', selected.structure.connection],
                ]} />
              </section>
            ) : (
              <section className="culture-panel" id="culturePanel" aria-label="当前部件文化与造型">
                <p className="panel-lede">{selected.culture.meaning}</p>
                <DetailList className="culture-detail-list" entries={[
                  ['纹样', selected.culture.pattern],
                  ['造型', selected.culture.form],
                ]} />
              </section>
            )}
            <div className="source-tag" id="panelSource">{selected.sourceTag}</div>
            <details className="structure-boundary" id="structureBoundary">
              <summary>模型与资料说明</summary>
              <p>当前展示来自用户提供的 Blender 醒狮模型，支持点选可见结构。纸扎内骨架、活动连接与制作工艺仅作资料说明，未展示内部拆装；AI 辅助内容依各条来源标注。</p>
            </details>
          </div>
        </aside>
      </div>
    </section>
  );
}
