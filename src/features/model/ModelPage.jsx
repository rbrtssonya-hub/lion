import { useEffect, useRef, useState } from 'react';
import { media } from '../../config/media.js';
import lionStructure from '../../data/lion-structure.json';

const structureCallouts = [
  { key: 'head', depth: 18, label: '狮头主体' },
  { key: 'eye', depth: 42, label: '眼部神态' },
  { key: 'mirror', depth: 64, label: '铜镜与饰件' },
  { key: 'fur', depth: 82, label: '鬃毛与胡须' },
];
const initialStatus = { phase: 'loading', message: '正在载入醒狮模型' };

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

export default function ModelPage() {
  const hotspots = lionStructure.hotspots;
  const [selectedId, setSelectedId] = useState(hotspots[0]?.id);
  const [structureDepth, setStructureDepth] = useState(18);
  const [showGuide, setShowGuide] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [focusState, setFocusState] = useState('overall');
  const [hoveredId, setHoveredId] = useState(null);
  const [status, setStatus] = useState(initialStatus);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const containerRef = useRef(null);
  const interactionRef = useRef(null);
  const headerRef = useRef(null);
  const sceneRef = useRef(null);
  const autoRotateRef = useRef(autoRotate);
  const selectedRef = useRef(null);
  const focusStateRef = useRef(focusState);
  const selectedIndex = hotspots.findIndex((item) => item.id === selectedId);
  const selected = hotspots[selectedIndex] ?? hotspots[0];

  useEffect(() => {
    selectedRef.current = selected;
    focusStateRef.current = focusState;
  }, [selected, focusState]);

  useEffect(() => {
    autoRotateRef.current = autoRotate;
    sceneRef.current?.setAutoRotate(autoRotate);
  }, [autoRotate]);

  useEffect(() => {
    const controller = new AbortController();
    let mountedScene;
    setStatus(initialStatus);

    async function loadScene() {
      try {
        const { createLionScene } = await import('../../services/lionScene.js');
        if (controller.signal.aborted) return;
        mountedScene = await createLionScene({
          container: containerRef.current,
          interactionElement: interactionRef.current,
          layoutElement: headerRef.current,
          modelUrl: media.model,
          signal: controller.signal,
          autoRotate: autoRotateRef.current,
          onStatus: (nextStatus) => {
            if (!controller.signal.aborted) setStatus(nextStatus);
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
        mountedScene.setAutoRotate(autoRotateRef.current);
        const latestSelected = selectedRef.current;
        if (focusStateRef.current !== 'overall' && latestSelected) {
          mountedScene.focusOn({ target: latestSelected.focusTarget, distance: latestSelected.focusDistance });
        }
      } catch (error) {
        if (controller.signal.aborted || error.name === 'AbortError') return;
        console.error('醒狮三维场景无法载入', error);
        setStatus({ phase: 'error', message: '模型载入失败 · 保留结构预览' });
      }
    }

    loadScene();
    return () => {
      controller.abort();
      mountedScene?.dispose();
      if (sceneRef.current === mountedScene) sceneRef.current = null;
    };
  }, [loadAttempt]);

  const selectHotspot = (id) => {
    const next = hotspots.find((item) => item.id === id);
    if (!next) return;
    setSelectedId(id);
    setFocusState(id);
    sceneRef.current?.focusOn({ target: next.focusTarget, distance: next.focusDistance });
  };

  const resetView = () => {
    setSelectedId(hotspots[0]?.id);
    setFocusState('overall');
    setStructureDepth(18);
    sceneRef.current?.resetView();
  };

  const restoreStructure = () => {
    setShowGuide(false);
    resetView();
  };

  return (
    <section
      id="modelStage"
      className={`model-stage${showGuide ? ' is-guide-visible' : ''}`}
      data-chapter="model"
      data-guide-open={showGuide}
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
      <header className="model-header" ref={headerRef}>
        <div className="model-header-meta">
          <span className="live-dot" />
          <span id="modelStatus" role="status">
            {status.phase === 'ready' && showGuide ? '结构示意 · 模型可视化' : status.message}
          </span>
          <button
            className={`icon-button${autoRotate ? ' active' : ''}`}
            id="toggleRotate"
            type="button"
            disabled={status.phase !== 'ready'}
            aria-label={autoRotate ? '暂停自动旋转' : '继续自动旋转'}
            aria-pressed={autoRotate}
            onClick={() => setAutoRotate((value) => !value)}
          >
            ↻
          </button>
        </div>
      </header>

      <div className="model-layout">
        <aside className="info-panel culture-panel" id="culturePanel" aria-live="polite">
          <div className="panel-section-mark">岭南文化索引 / CULTURE</div>
          <div className="panel-index">{String(selectedIndex + 1).padStart(2, '0')} / {String(hotspots.length).padStart(2, '0')}</div>
          <p className="panel-kicker">{selected.kicker}</p>
          <h2 id="cultureTitle">{selected.name}</h2>
          <p className="panel-material">{selected.material}</p>
          <div className="panel-rule" />
          <p className="panel-lede">{selected.culture.meaning}</p>
          <DetailList className="culture-detail-list" entries={[
            ['纹样', selected.culture.pattern],
            ['造型表现', selected.culture.form],
          ]} />
          <div className="culture-note">
            <span className="note-label">观看提示</span>
            <p>移动到中央金色热点，先看轮廓，再进入部件信息。</p>
          </div>
        </aside>

        <div className="scene-column">
          <div className="scene-kicker">
            {showGuide ? '结构示意 / STRUCTURE GUIDE' : '整体视图 / OVERALL FORM'}
            <span>{focusState === 'overall' ? '完整轮廓' : `聚焦 · ${selected.name}`}</span>
          </div>
          <div className="scene-frame" id="sceneFrame">
            <div className="scene-interaction" ref={interactionRef} aria-label="可旋转醒狮三维模型" />
            <img
              className="model-fallback"
              id="modelFallback"
              src={media.poster}
              alt="醒狮整体参考图"
              style={{ opacity: status.phase === 'ready' ? 0 : 0.72 }}
            />
            {status.phase !== 'ready' && (
              <div className="loading-panel" id="loadingPanel" role="status">
                {status.phase === 'loading' && <span className="loader-ring" aria-hidden="true" />}
                <span id="loadingText">{status.message}</span>
                {status.phase === 'error' && (
                  <button type="button" onClick={() => setLoadAttempt((value) => value + 1)}>
                    重新载入
                  </button>
                )}
              </div>
            )}
            <div className="scene-caption">
              <span>{showGuide ? '结构分区示意' : '整体轮廓'}</span>
              <span>GLB / 01</span>
            </div>
            <div className={`hotspots${status.phase !== 'ready' ? ' is-disabled' : ''}`} id="hotspots" aria-label="醒狮部件热点">
              {hotspots.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`hotspot${selectedId === item.id ? ' active' : ''}${hoveredId === item.id ? ' is-hovered' : ''}`}
                  data-id={item.id}
                  style={{ left: item.position.left, top: item.position.top }}
                  aria-label={`查看${item.name}`}
                  aria-pressed={selectedId === item.id}
                  onMouseEnter={() => setHoveredId(item.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onFocus={() => setHoveredId(item.id)}
                  onBlur={() => setHoveredId(null)}
                  onClick={() => selectHotspot(item.id)}
                >
                  <span aria-hidden="true">+</span>
                  <span className="hotspot-label">{item.name}</span>
                </button>
              ))}
            </div>
            <div
              className="structure-layer"
              id="structureLayer"
              hidden={!showGuide}
            >
              <div className="structure-layer-head">
                <span>结构分区预览</span>
                <small>MERGED MESH / GUIDE</small>
              </div>
              {structureCallouts.map(({ key, depth, label }) => (
                <div
                  key={key}
                  className={`structure-callout structure-callout-${key}${structureDepth >= depth ? ' is-revealed' : ''}`}
                  data-depth={depth}
                >
                  <i aria-hidden="true" />
                  <span>{label}</span>
                </div>
              ))}
              <div className="structure-control">
                <label htmlFor="structureDepth">示意进度</label>
                <input
                  id="structureDepth"
                  type="range"
                  min="0"
                  max="100"
                  value={structureDepth}
                  onChange={(event) => setStructureDepth(Number(event.target.value))}
                />
                <output id="structureDepthValue" htmlFor="structureDepth">{structureDepth}%</output>
              </div>
            </div>
          </div>
          <div className="scene-controls">
            <span>拖动旋转</span>
            <span className="control-line" />
            <span>滚轮缩放</span>
            <span className="control-source">模型整体展示 · 合并网格</span>
          </div>
          <div className="scene-action-row">
            <button type="button" id="resetView" onClick={resetView}>重置视角</button>
            <button type="button" id="viewStructure" aria-controls="structureLayer" aria-expanded={showGuide}
              onClick={() => setShowGuide((value) => !value)}>{showGuide ? '关闭结构示意' : '查看结构示意'}</button>
          </div>
        </div>

        <aside className="info-panel structure-panel detail-panel" id="structurePanel" aria-live="polite">
          <div className="panel-section-mark">结构与工艺 / STRUCTURE</div>
          <div className="panel-index" id="panelIndex">{String(selectedIndex + 1).padStart(2, '0')} / {String(hotspots.length).padStart(2, '0')}</div>
          <p className="panel-kicker">{selected.kicker}</p>
          <h2 id="structureTitle"><span id="panelTitle">{selected.name}</span></h2>
          <p className="panel-material" id="panelMaterial">{selected.material}</p>
          <div className="panel-rule" />
          <p className="panel-description" id="panelDescription">{selected.description}</p>
          <DetailList entries={[
            ['组成', selected.structure.parts.join(' · ')],
            ['材料', selected.structure.material],
            ['工艺', selected.structure.craft],
            ['连接', selected.structure.connection],
          ]} />
          <div className="structure-diagram" aria-label="当前部件结构示意图">
            <div className="diagram-heading"><span>局部层次示意</span><span>{selected.structure.parts.length} LAYERS</span></div>
            <div className="diagram-bars">
              {selected.structure.parts.map((part, index) => (
                <div className="diagram-bar" key={part} style={{ '--bar-index': index }}>
                  <i aria-hidden="true" />
                  <span>{String(index + 1).padStart(2, '0')} {part}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="structure-boundary" id="structureBoundary">
            <span className="label">模型边界</span>
            <strong>合并网格 · 结构示意</strong>
            <p>当前 GLB 为单一合并网格，图中层次用于说明资料关系，不代表可独立拆出的真实零件。</p>
          </div>
          <div className="function-block">
            <span className="label">动作观察</span>
            <p id="panelFunction">{selected.function}</p>
          </div>
          <div className="source-tag" id="panelSource">{selected.sourceTag}</div>
          <nav className="hotspot-list" id="hotspotList" aria-label="部件列表">
            {hotspots.map((item, index) => (
              <button
                key={item.id}
                type="button"
                data-id={item.id}
                className={selectedId === item.id ? 'active' : ''}
                aria-pressed={selectedId === item.id}
                onClick={() => selectHotspot(item.id)}
              >
                <span className="list-number">{String(index + 1).padStart(2, '0')}</span>
                <span className="list-name">{item.name}</span>
              </button>
            ))}
          </nav>
          {showGuide && <button type="button" className="restore-structure" id="restoreStructure" onClick={restoreStructure}>复原结构 · 关闭示意</button>}
        </aside>
      </div>
      <div className="scroll-cue" aria-hidden="true"><span />向下探索</div>
    </section>
  );
}
