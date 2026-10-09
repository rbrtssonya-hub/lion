import { useEffect, useRef, useState } from 'react';
import ChapterNav from '../../components/ChapterNav.jsx';
import { media } from '../../config/media.js';
import lionStructure from '../../data/lion-structure.json';

const structureCallouts = [
  { key: 'head', depth: 18, label: '狮头主体' },
  { key: 'eye', depth: 42, label: '眼部神态' },
  { key: 'mirror', depth: 64, label: '铜镜与饰件' },
  { key: 'fur', depth: 82, label: '鬃毛与胡须' },
];
const initialStatus = { phase: 'loading', message: '正在载入醒狮模型' };

export default function ModelPage({ route = 'model', onNavigate }) {
  const hotspots = lionStructure.hotspots;
  const [selectedId, setSelectedId] = useState(hotspots[0]?.id);
  const [structureDepth, setStructureDepth] = useState(18);
  const [autoRotate, setAutoRotate] = useState(true);
  const [status, setStatus] = useState(initialStatus);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const autoRotateRef = useRef(autoRotate);
  const structure = route === 'structure';
  const selectedIndex = hotspots.findIndex((item) => item.id === selectedId);
  const selected = hotspots[selectedIndex] ?? hotspots[0];

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

  return (
    <section
      id="modelStage"
      className={`model-stage${structure ? ' is-structure' : ''}`}
      data-chapter={route}
      aria-label={structure ? '醒狮结构框架' : '可操作醒狮模型'}
    >
      <header className="model-header">
        <div className="brand-lockup">
          <span className="brand-mark">广府醒狮</span>
          <span className="brand-divider" />
          <span>一头醒狮的出场</span>
        </div>
        <ChapterNav current={route} onNavigate={onNavigate} variant="chapter" />
        <div className="model-header-meta">
          <span className="live-dot" />
          <span id="modelStatus" role="status">
            {status.phase === 'ready' && structure ? '结构框架 · 模型可视化' : status.message}
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
        <div className="scene-column">
          <div className="scene-kicker">
            {structure ? '结构框架 / STRUCTURE GUIDE' : '整体视图 / OVERALL FORM'}
          </div>
          <div className="scene-frame" id="sceneFrame">
            <div className="scene-glow" />
            <div className="scene-grid" />
            <div
              id="sceneContainer"
              className="scene-container"
              ref={containerRef}
              aria-label="可旋转醒狮三维模型"
              style={{ visibility: status.phase === 'ready' ? 'visible' : 'hidden' }}
            />
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
              <span>{structure ? '结构分区示意' : '整体轮廓'}</span>
              <span>GLB / 01</span>
            </div>
            <div className="hotspots" id="hotspots" aria-label="醒狮部件热点">
              {hotspots.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`hotspot${selectedId === item.id ? ' active' : ''}`}
                  data-id={item.id}
                  style={{ left: item.position.left, top: item.position.top }}
                  aria-label={`查看${item.name}`}
                  aria-pressed={selectedId === item.id}
                  onClick={() => setSelectedId(item.id)}
                >
                  <span aria-hidden="true">+</span>
                  <span className="hotspot-label">{item.name}</span>
                </button>
              ))}
            </div>
            <div
              className="structure-layer"
              id="structureLayer"
              hidden={!structure}
              style={{ '--structure-depth': structureDepth / 100 }}
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
                <label htmlFor="structureDepth">拆解进度</label>
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
        </div>

        <aside className="detail-panel" id="detailPanel" aria-live="polite">
          <div className="panel-index" id="panelIndex">
            {String(selectedIndex + 1).padStart(2, '0')} / {String(hotspots.length).padStart(2, '0')}
          </div>
          <p className="panel-kicker" id="panelKicker">{selected.kicker}</p>
          <h2 id="panelTitle">{selected.name}</h2>
          <p className="panel-material" id="panelMaterial">{selected.material}</p>
          <div className="panel-rule" />
          <p className="panel-description" id="panelDescription">{selected.description}</p>
          <div className="function-block">
            <span className="label">功能</span>
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
                onClick={() => setSelectedId(item.id)}
              >
                <span className="list-number">{String(index + 1).padStart(2, '0')}</span>
                <span className="list-name">{item.name}</span>
              </button>
            ))}
          </nav>
        </aside>
      </div>
      <div className="scroll-cue" aria-hidden="true"><span />向下探索</div>
    </section>
  );
}
