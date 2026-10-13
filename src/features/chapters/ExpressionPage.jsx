import { useCallback, useEffect, useRef, useState } from 'react';
import { media } from '../../config/media.js';
import { lionExpressions } from '../../data/lion-expressions.js';

function Cloud({ className = '' }) {
  return <svg className={`expression-cloud ${className}`} viewBox="0 0 100 56" aria-hidden="true" focusable="false">
    <path d="M2 47c21 2 28-8 32-14-13 6-22-1-17-11 4-8 14-6 17-1-7-19 14-29 25-17 5 6 5 13 0 18 15-8 28 5 22 15 12-2 16 5 14 10-19 9-43-4-55-1-15 6-27 7-38 1Z" fill="currentColor" opacity=".3" />
    <path d="M2 47c21 2 28-8 32-14M34 21c-7-19 14-29 25-17 5 6 5 13 0 18M59 22c15-8 28 5 22 15M81 37c12-2 16 5 14 10-19 9-43-4-55-1-15 6-27 7-38 1M47 16c-7-5-14 3-9 9 5 5 13 0 9-4M67 34c-9-5-16 7-8 12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>;
}

export default function ExpressionPage() {
  const [selection, setSelection] = useState({ index: 0, previous: null, direction: 'next', revision: 0 });
  const stageRef = useRef(null);
  const current = lionExpressions[selection.index];
  const select = useCallback((value) => {
    setSelection(previous => {
      const target = typeof value === 'function' ? value(previous.index) : value;
      const index = (target + lionExpressions.length) % lionExpressions.length;
      if (index === previous.index) return previous;
      return { index, previous: previous.index, direction: target > previous.index ? 'next' : 'previous', revision: previous.revision + 1 };
    });
  }, []);
  const step = useCallback(direction => select(index => index + direction), [select]);

  useEffect(() => {
    const stage = stageRef.current;
    let lastWheel = -Infinity;
    let delta = 0;
    let consumed = false;
    const onWheel = event => {
      if (event.ctrlKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
      event.preventDefault();
      const now = performance.now();
      if (now - lastWheel > 180) { delta = 0; consumed = false; }
      lastWheel = now;
      if (consumed) return;
      delta += event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? stage.clientHeight : 1);
      if (Math.abs(delta) < 36) return;
      consumed = true;
      step(delta > 0 ? 1 : -1);
    };
    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => stage.removeEventListener('wheel', onWheel);
  }, [step]);

  const handleKey = event => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      step(event.key === 'ArrowDown' ? 1 : -1);
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      select(event.key === 'Home' ? 0 : lionExpressions.length - 1);
    }
  };

  return <>
    <section className="chapter-stage chapter-stage--state expression-page" id="chapterStage" data-chapter="state" data-expression={current.name} aria-label="醒狮八态图鉴">
      <h1 className="sr-only" id="chapterTitle">神态</h1>
      <div className="expression-hero">
        <nav className="expression-state-nav" aria-label="醒狮八态" style={{ '--active-state': selection.index }}>
          <div className="expression-active-badge" aria-hidden="true"><img className="expression-badge-lion" src={media.navLion} alt="" /><Cloud /></div>
          {lionExpressions.map((expression, index) => <button type="button" key={expression.name} className={`expression-state-button${index === selection.index ? ' is-active' : ''}`} aria-pressed={index === selection.index} aria-controls="expressionStateCopy expressionDetails" onClick={() => select(index)}>
            <span className="expression-state-dot" aria-hidden="true" /><strong>{expression.name}</strong>
          </button>)}
          <p className="expression-nav-caption">醒狮八态</p>
        </nav>

        <div className="expression-lion-stage" id="expressionObservation" ref={stageRef} role="region" aria-label="醒狮神态切换" aria-describedby="expressionInteractionHint" tabIndex={0} onKeyDown={handleKey}>
          <svg className="expression-brush-ring" viewBox="0 0 600 600" aria-hidden="true"><circle cx="300" cy="300" r="263" /><circle cx="300" cy="300" r="273" /><circle cx="300" cy="300" r="283" /></svg>
          <button type="button" className="expression-step expression-step--previous" id="expressionPrevious" aria-label="上一神态" onClick={() => step(-1)}><svg viewBox="0 0 40 24" aria-hidden="true"><path d="m4 20 16-16 16 16" /></svg></button>
          <div className="expression-lion-stack">
            {selection.previous !== null && <div className="expression-lion-layer is-leaving" key={`out-${selection.revision}`} data-direction={selection.direction} aria-hidden="true"><div className="expression-lion-pose" data-expression={lionExpressions[selection.previous].name}><img className="expression-lion-image" src={media.expressionLion} alt="" draggable="false" /></div></div>}
            <div className="expression-lion-layer is-current" key={`in-${selection.revision}`} data-direction={selection.direction}><div className="expression-lion-pose" data-expression={current.name}><img className="expression-lion-image" id="expressionLion" src={media.expressionLion} alt="白毛红纹醒狮正面狮头，AI辅助视觉" draggable="false" /></div></div>
          </div>
          <button type="button" className="expression-step expression-step--next" id="expressionNext" aria-label="下一神态" onClick={() => step(1)}><svg viewBox="0 0 40 24" aria-hidden="true"><path d="m4 4 16 16 16-16" /></svg></button>
          <p className="expression-interaction-hint" id="expressionInteractionHint">在狮头上滚动切换 · 也可点击八态或上下箭头</p>
        </div>

        <div className="expression-copy" id="expressionStateCopy" aria-live="polite" aria-atomic="true">
          <div key={`copy-${selection.revision}`} className="expression-copy-content">
            <div className="expression-state-heading"><strong className="expression-state-character" id="expressionStateTitle">{current.name}</strong><Cloud /></div>
            <h2 id="expressionSummary">{current.summary}</h2>
            <div className="expression-copy-rule" aria-hidden="true" />
            <div className="expression-description">{current.description.map(line => <p key={line}>{line}</p>)}</div>
            <p className="expression-state-count">八态图鉴 <span>{String(selection.index + 1).padStart(2, '0')} / 08</span></p>
          </div>
        </div>
      </div>

      <section className="expression-details" id="expressionDetails" aria-labelledby="expressionDetailTitle">
        <div className="expression-detail-copy" key={`detail-${selection.revision}`}>
          <div className="expression-detail-heading"><img src={media.navLion} alt="" aria-hidden="true" /><h2 id="expressionDetailTitle"><span>{current.name}</span>态怎么看</h2><Cloud /></div>
          <p className="expression-detail-subtitle">从目光到动作，读懂{current.meaning}。</p>
          <div className="expression-cues">
            <div><span className="expression-cue-icon" aria-hidden="true">✦</span><div><h3>神情线索</h3><p id="expressionEmotionCue">{current.emotion}</p></div></div>
            <div><span className="expression-cue-icon" aria-hidden="true">❋</span><div><h3>动作线索</h3><p id="expressionMotionCue">{current.motion}</p></div></div>
          </div>
        </div>
        <div className="expression-detail-images">
          <figure className="expression-detail-crop expression-detail-crop--eye"><div className="expression-crop-window"><img src={media.expressionLion} alt="醒狮眼神细节，AI辅助视觉" draggable="false" /></div><figcaption>眼神 · 观察目光的回应</figcaption></figure>
          <figure className="expression-detail-crop expression-detail-crop--mouth"><div className="expression-crop-window"><img src={media.expressionLion} alt="醒狮嘴部细节，AI辅助视觉" draggable="false" /></div><figcaption>嘴部 · 观察开合的节奏</figcaption></figure>
        </div>
      </section>
      <p className="expression-evidence" id="chapterEvidence">AI辅助视觉 · 八态定性观察提示 · 等待真实图片/视频样本校核</p>
    </section>
    <footer className="site-footer"><span>AI辅助创作 · 结构资料整理 · 交互原型</span><span>广府醒狮 / 04</span></footer>
  </>;
}
