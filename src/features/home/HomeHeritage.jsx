import { useLayoutEffect, useRef, useState } from 'react';
import { media } from '../../config/media.js';
import { lionTypes } from '../../data/home-heritage.js';
import { HeritageLinks, HeritageMotif, handleHeritageTabs } from './HeritageElements.jsx';
import LionArchiveOrnament from './LionArchiveOrnament.jsx';
import '../../styles/home-heritage.css';
import '../../styles/home-exhibit-content.css';

function HeritageTitle({ id, title, children }) {
  return <header className="heritage-heading archive-reading-panel" data-surface="cultureTitle">
    <div className="lion-archive-title-line"><h2 id={id}>{title}</h2><LionArchiveOrnament kind={id === 'lion-types-title' ? 'peeking' : 'paw'} /></div>
    <p className="heritage-lead">{children}</p>
  </header>;
}

function TypeFigure({ type, onCompare }) {
  const [failed, setFailed] = useState(false);
  return <figure className="heritage-figure">
    <button className="heritage-type-image interaction-cue" type="button" aria-label={`对照${type.name}形制`} onClick={onCompare}>
      {failed ? <span className="heritage-image-fallback"><HeritageMotif kind="horn" /><strong>{type.name}</strong><span>示意图暂不可用 · 右侧介绍仍可阅读</span></span> :
        <img src={media[type.imageKey]} alt={`${type.name}水彩类型示意，非实物鉴定图`} width="1536" height="1024" loading="lazy" decoding="async" draggable="false" onError={() => setFailed(true)} />}
    </button>
    <figcaption><span>类型示意 · AI辅助绘制</span><button type="button" className="heritage-image-action interaction-cue" onClick={onCompare}>进入形制对照 ↗</button></figcaption>
  </figure>;
}

function TypeComparisonIllustration({ type }) {
  const [failed, setFailed] = useState(false);
  return <figure className="heritage-comparison-figure">
    {failed ? <div className="heritage-image-fallback"><HeritageMotif kind="horn" /><span>示意图暂不可用，仍可阅读下方介绍</span></div> : <img src={media[type.imageKey]} alt={`${type.name}类型示意，非实物鉴定图`} width="1536" height="1024" loading="lazy" decoding="async" onError={() => setFailed(true)} />}
    <figcaption>类型示意 · AI辅助绘制</figcaption>
  </figure>;
}

function TypeComparisonCard({ type, side, onSelect }) {
  const label = side === 0 ? '左侧醒狮形制' : '右侧醒狮形制';
  return <article className="heritage-comparison-card archive-reading-panel" data-surface="cultureBody" data-type-id={type.id}>
    <label className="heritage-comparison-select">{label}<select className="interaction-cue" aria-label={label} value={type.id} onChange={event => onSelect(event.target.value)}>
      {lionTypes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select></label>
    <TypeComparisonIllustration key={type.id} type={type} />
    <h3>{type.name}</h3><p className="heritage-kind">{type.kind}</p>
    <dl>{Object.entries(type.comparison).map(([label, text]) => <div key={label}><dt>{label}</dt><dd>{text}</dd></div>)}</dl>
    <HeritageLinks ids={type.sourceIds} />
  </article>;
}

export function HomeLionTypes() {
  const [typeId, setTypeId] = useState(lionTypes[0].id);
  const [mode, setMode] = useState('single');
  const [pair, setPair] = useState(['foshan', 'heshan']);
  const compareButton = useRef(null);
  const restoreModeFocus = useRef(false);
  const type = lionTypes.find(item => item.id === typeId);
  const select = index => setTypeId(lionTypes[index].id);
  const compareCurrent = () => {
    setPair([typeId, lionTypes.find(item => item.id !== typeId).id]);
    compareButton.current?.focus({ preventScroll: true });
    setMode('compare');
  };
  const exitComparison = () => { restoreModeFocus.current = true; setMode('single'); };
  const selectComparison = (side, id) => setPair(previous => {
    const next = [...previous];
    if (next[1 - side] === id) next[1 - side] = next[side];
    next[side] = id;
    return next;
  });
  useLayoutEffect(() => {
    if (mode === 'single' && restoreModeFocus.current) {
      restoreModeFocus.current = false;
      compareButton.current?.focus({ preventScroll: true });
    }
  }, [mode]);
  return <section id="homeLionTypes" className="home-heritage-section" aria-labelledby="lion-types-title" data-reading-mode={mode} onKeyDown={event => {
    if (mode === 'compare' && event.key === 'Escape' && !event.isComposing) { event.preventDefault(); event.stopPropagation(); exitComparison(); }
  }}>
    <div className="heritage-inner">
      <HeritageTitle id="lion-types-title" title="一狮千面 · 认识广府醒狮">看形制，也看狮艺。从传统流派到融合形制，在眉眼与步履之间，读懂不同的神采。</HeritageTitle>
      <div className="heritage-controls">
      <div className="heritage-reading-modes" role="group" aria-label="醒狮阅读方式">
        <button className="interaction-cue" type="button" aria-pressed={mode === 'single'} onClick={exitComparison}>单狮阅读</button>
        <button className="interaction-cue" type="button" ref={compareButton} aria-pressed={mode === 'compare'} onClick={() => setMode('compare')}>形制对照</button>
      </div>
      <div className="heritage-tabs" role="tablist" aria-label="醒狮形制" hidden={mode !== 'single'}>{lionTypes.map((item, index) => <button className="interaction-cue" type="button" role="tab" key={item.id} id={`type-tab-${item.id}`} aria-selected={typeId === item.id} aria-controls="lion-type-panel" tabIndex={typeId === item.id ? 0 : -1} onClick={() => select(index)} onKeyDown={event => handleHeritageTabs(event, index, lionTypes.length, select)}>{item.name}<small>{item.kind}</small></button>)}</div>
      </div>
      {mode === 'compare' && <div className="heritage-comparison" aria-label="醒狮形制对照">{pair.map((id, side) => <TypeComparisonCard key={side} type={lionTypes.find(item => item.id === id)} side={side} onSelect={id => selectComparison(side, id)} />)}</div>}
      <div className="heritage-single" hidden={mode !== 'single'}>
      <div id="lion-type-panel" role="tabpanel" aria-labelledby={`type-tab-${type.id}`} tabIndex={-1}>
        <article key={type.id} data-type-id={type.id} className="heritage-layout heritage-type-reveal is-expanded">
          <TypeFigure key={type.id} type={type} onCompare={compareCurrent} />
          <div id={`type-${type.id}-description`} className="heritage-copy heritage-type-copy archive-reading-panel" data-surface="cultureBody">
            <p className="heritage-kind">{type.kind}</p><h3>{type.name}</h3><p className="heritage-summary">{type.summary}</p>
            <HeritageLinks ids={type.sourceIds} />
          </div>
          <ul className="heritage-observations archive-reading-panel" data-surface="cultureBody" aria-label="观察重点">{type.points.map(item => <li key={item.id}><h4>{item.label}</h4><p>{item.text}</p></li>)}</ul>
        </article>
      </div>
      </div>
      <div className="heritage-form-note"><p className="heritage-eyebrow">表演形式，不等同于流派</p><div>
        <article><HeritageMotif kind="drum" /><h3>传统地狮</h3><p>在地面与道具构成的场景中，以步法、神态和采青讲述狮子的行动。</p></article>
        <article><HeritageMotif kind="horn" /><h3>高桩表演</h3><p>以高桩为表演空间，突出腾跃、平衡与双人配合；不是另一种狮头流派。</p></article>
      </div><HeritageLinks ids={['performance-forms']} /></div>
    </div>
  </section>;
}
