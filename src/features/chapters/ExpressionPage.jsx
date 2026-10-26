import { useCallback, useEffect, useRef, useState } from 'react';
import { media } from '../../config/media.js';
import { expressionFeedbackDefaults } from '../../config/expressionFeedbackSettings.js';
import { lionExpressions, expressionComparisons } from '../../data/lion-expressions.js';
import ExpressionMotif from './ExpressionMotif.jsx';
import ExpressionComparison from './ExpressionComparison.jsx';
import useExpressionMotion from './useExpressionMotion.js';
import useExpressionReaction from './useExpressionReaction.js';
import ExpressionLion from './ExpressionLion.jsx';
import ChapterIdentity from '../../components/ChapterIdentity.jsx';
import '../../styles/expression-motion.css';

const glyphKeys = ['expressionGlyphJoy', 'expressionGlyphAnger', 'expressionGlyphSorrow', 'expressionGlyphDelight',
  'expressionGlyphMotion', 'expressionGlyphStillness', 'expressionGlyphSurprise', 'expressionGlyphDoubt'];

function Cloud({ className = '' }) {
  return <svg className={`expression-cloud ${className}`} viewBox="0 -4 100 60" aria-hidden="true" focusable="false">
    <path d="M2 47c21 2 28-8 32-14-13 6-22-1-17-11 4-8 14-6 17-1-7-19 14-29 25-17 5 6 5 13 0 18 15-8 28 5 22 15 12-2 16 5 14 10-19 9-43-4-55-1-15 6-27 7-38 1Z" fill="currentColor" opacity=".3" />
    <path d="M2 47c21 2 28-8 32-14M34 21c-7-19 14-29 25-17 5 6 5 13 0 18M59 22c15-8 28 5 22 15M81 37c12-2 16 5 14 10-19 9-43-4-55-1-15 6-27 7-38 1M47 16c-7-5-14 3-9 9 5 5 13 0 9-4M67 34c-9-5-16 7-8 12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>;
}

export default function ExpressionPage({ active = true, observation, onReturnToModel, settings = expressionFeedbackDefaults }) {
  const initialIndex = Math.max(0, lionExpressions.findIndex(item => item.id === observation?.expressionId));
  const [selection, setSelection] = useState({ index: initialIndex, previous: null, direction: 'next', revision: 0 });
  const [reactionRevision, setReactionRevision] = useState(0);
  const [faceRevision, setFaceRevision] = useState(0);
  const [viewMode, setViewMode] = useState(observation ? 'details' : 'overview');
  const [comparing, setComparing] = useState(false);
  const [pairId, setPairId] = useState(expressionComparisons[0].id);
  const compareButton = useRef(null);
  const stageRef = useRef(null);
  const triggerRef = useRef(null);
  const responseRef = useRef(null);
  const copyRef = useRef(null);
  const characterRef = useRef(null);
  const spaceActivation = useRef(null);
  const interactionRef = useRef(null);
  interactionRef.current = { index: selection.index, viewMode };
  const current = lionExpressions[selection.index];
  const clickPercentage = settings.expressionClickScale ?? expressionFeedbackDefaults.expressionClickScale;
  const clickScale = clickPercentage / 100;
  const clickDuration = settings.expressionClickDuration ?? expressionFeedbackDefaults.expressionClickDuration;
  const { capture: captureMotion, reset: resetMotion } = useExpressionMotion(copyRef, characterRef, current.id, viewMode, comparing);
  const stopReaction = useExpressionReaction(triggerRef, current.id, reactionRevision, comparing || !active);
  const showComparison = () => {
    resetMotion();
    stopReaction();
    responseRef.current?.cancel();
    spaceActivation.current = null;
    setPairId((expressionComparisons.find(pair => pair.ids.includes(current.id)) ?? expressionComparisons[0]).id);
    setComparing(true);
  };
  const exitComparison = () => { resetMotion(); setComparing(false); compareButton.current?.focus({ preventScroll: true }); };
  const select = useCallback((value) => {
    if (spaceActivation.current !== null) spaceActivation.current = false;
    responseRef.current?.cancel();
    stopReaction();
    setReactionRevision(previous => previous + 1);
    const previousInteraction = interactionRef.current;
    const target = typeof value === 'function' ? value(previousInteraction.index) : value;
    const index = (target + lionExpressions.length) % lionExpressions.length;
    if (index === previousInteraction.index && previousInteraction.viewMode === 'overview') return;
    captureMotion();
    interactionRef.current = { index, viewMode: 'overview' };
    setViewMode('overview');
    setSelection(previous => {
      if (index === previous.index) return previous;
      return { index, previous: previous.index, direction: target > previous.index ? 'next' : 'previous', revision: previous.revision + 1 };
    });
  }, [captureMotion, stopReaction]);
  const step = useCallback(direction => select(index => index + direction), [select]);
  const returnToOverview = () => {
    if (interactionRef.current.viewMode !== 'overview') captureMotion();
    interactionRef.current = { ...interactionRef.current, viewMode: 'overview' };
    responseRef.current?.cancel();
    setViewMode('overview');
    triggerRef.current?.focus({ preventScroll: true });
  };
  const showDetails = () => {
    stopReaction();
    setFaceRevision(previous => previous + 1);
    if (interactionRef.current.viewMode !== 'details') captureMotion();
    interactionRef.current = { ...interactionRef.current, viewMode: 'details' };
    setViewMode('details');
    responseRef.current?.cancel();
    if (clickScale > 1 && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      responseRef.current = triggerRef.current.animate([
        { transform: 'scale(1)', offset: 0 }, { transform: `scale(${clickScale})`, offset: .5 }, { transform: 'scale(1)', offset: 1 },
      ], { duration: clickDuration, easing: 'ease-out' });
    }
  };

  useEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const stopResponse = () => responseRef.current?.cancel();
    preference.addEventListener('change', stopResponse);
    return () => { stopResponse(); preference.removeEventListener('change', stopResponse); };
  }, [clickScale, clickDuration]);

  useEffect(() => {
    if (comparing) return;
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
  }, [step, comparing]);

  const handleKey = event => {
    if (event.target !== event.currentTarget && event.target !== triggerRef.current) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      step(event.key === 'ArrowDown' ? 1 : -1);
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      select(event.key === 'Home' ? 0 : lionExpressions.length - 1);
    }
  };

  return <>
    <section className="chapter-stage chapter-stage--state expression-page" id="chapterStage" data-chapter="state" data-expression={current.name} data-comparing={comparing}
      style={{ '--expression-click-scale': clickScale }} aria-label="醒狮八态图鉴" onKeyDown={event => {
      if (event.key === 'Escape' && comparing && !event.isComposing) { event.preventDefault(); event.stopPropagation(); exitComparison(); return; }
      if (event.key === 'Escape' && viewMode === 'details' && !event.isComposing) {
        event.preventDefault(); event.stopPropagation(); returnToOverview();
      }
    }}>
      <h1 className="sr-only" id="chapterTitle">神态</h1>
      <div className="expression-toolbar">
        <ChapterIdentity chapter="state" eyebrow="南风有狮 · 神态图鉴" title="醒狮八态" description="观眉眼，读神韵。" />
        {observation && <button type="button" className="expression-model-return" onClick={onReturnToModel}>返回{observation.partLabel}部位</button>}
        <div className="expression-reading-modes" role="group" aria-label="神态阅读方式"><button type="button" aria-pressed={!comparing} onClick={exitComparison}>八态浏览</button><button type="button" ref={compareButton} aria-pressed={comparing} onClick={showComparison}>神态对照</button></div>
      </div>
      {comparing && <ExpressionComparison pairId={pairId} onSelect={setPairId} />}
      <div className="expression-hero" hidden={comparing}>
        <nav className="expression-state-nav" aria-label="醒狮八态" style={{ '--active-state': selection.index }}>
          <div className="expression-active-badge" aria-hidden="true"><img className="expression-badge-lion" src={media[current.imageKey]} alt="" /><Cloud /></div>
          {lionExpressions.map((expression, index) => <button type="button" key={expression.name} className={`expression-state-button${index === selection.index ? ' is-active' : ''}`} aria-pressed={index === selection.index} aria-controls="expressionStateCopy" onClick={() => select(index)}>
            <span className="expression-state-dot" aria-hidden="true" /><strong>{expression.name}</strong>
          </button>)}
          <p className="expression-nav-caption">醒狮八态</p>
        </nav>

        <div className="expression-lion-stage" id="expressionObservation" ref={stageRef} role="region" aria-label="醒狮神态切换" aria-describedby="expressionInteractionHint" tabIndex={0} onKeyDown={handleKey}>
          <svg className="expression-brush-ring" viewBox="0 0 600 600" aria-hidden="true"><circle cx="300" cy="300" r="263" /><circle cx="300" cy="300" r="273" /><circle cx="300" cy="300" r="283" /></svg>
          <button type="button" className="expression-step expression-step--previous" id="expressionPrevious" aria-label="上一神态" onClick={() => step(-1)}><svg viewBox="0 0 40 24" aria-hidden="true"><path d="m4 20 16-16 16 16" /></svg></button>
          <button type="button" className="expression-lion-stack expression-lion-trigger" id="expressionLionTrigger" ref={triggerRef}
            data-expression-click-scale={clickPercentage} data-expression-click-duration={clickDuration}
            aria-label={`查看${current.name}态详细解读`} aria-controls="expressionStateCopy" aria-pressed={viewMode === 'details'} onClick={showDetails}
            onKeyDown={event => { if (event.key === ' ' && !event.repeat) spaceActivation.current = true; }}
            onKeyUp={event => {
              if (event.key !== ' ') return;
              if (spaceActivation.current === false) event.preventDefault();
              spaceActivation.current = null;
            }} onBlur={() => { spaceActivation.current = null; }}>
            {selection.previous !== null && <div className="expression-lion-layer is-leaving" key={`out-${selection.revision}`} data-direction={selection.direction} aria-hidden="true"><div className="expression-lion-pose" data-expression={lionExpressions[selection.previous].name}><img className="expression-lion-image" src={media[lionExpressions[selection.previous].imageKey]} alt="" draggable="false" /></div></div>}
            <div className="expression-lion-layer is-current" key={`in-${selection.revision}`} data-direction={selection.direction}><div className="expression-lion-pose" data-expression={current.name}>
              <ExpressionLion expressionId={current.id} src={media[current.imageKey]} alt={`${current.name}态醒狮，按用户八态参考图AI辅助提取`} revision={faceRevision} active={active && !comparing} />
            </div></div>
          </button>
          <button type="button" className="expression-step expression-step--next" id="expressionNext" aria-label="下一神态" onClick={() => step(1)}><svg viewBox="0 0 40 24" aria-hidden="true"><path d="m4 4 16 16 16-16" /></svg></button>
          <button type="button" className="expression-interaction-hint interaction-cue" id="expressionInteractionHint" onClick={showDetails}>点击狮头，眉眼狮口分别响应 <span aria-hidden="true">↗</span><small>滚轮或箭头切态</small></button>
        </div>

        <div className="expression-copy" id="expressionStateCopy" ref={copyRef} data-view={viewMode} data-surface="expressionOverlay" aria-live="polite" aria-atomic="true">
          <div className="expression-copy-content">
            <p className="expression-copy-kicker" data-expression-reveal><ExpressionMotif />{viewMode === 'overview' ? '醒狮八态 · 神态简介' : '狮艺解读 · 观形识意'}</p>
            <div className="expression-copy-heading">
              <div className="expression-state-heading"><strong className="expression-state-character" id="expressionStateTitle" ref={characterRef}><span className="sr-only">{current.name}</span><img className="expression-state-glyph" src={media[glyphKeys[selection.index]]} alt="" aria-hidden="true" draggable="false" /></strong><Cloud /></div>
              {viewMode === 'overview' ? <h2 id="expressionSummary" data-expression-reveal>{current.summary}</h2>
                : <h2 id="expressionDetailTitle" data-expression-reveal>{current.name}态怎么看</h2>}
              <p className="expression-detail-subtitle" data-expression-reveal>{viewMode === 'overview' ? current.verse : `从狮头到鼓点，寻找${current.meaning}的线索。`}</p>
            </div>
            <div className="expression-copy-rule" aria-hidden="true" />
            {viewMode === 'overview' ? <div className="expression-description">{current.description.map(line => <p key={line} data-expression-reveal>{line}</p>)}</div> : <>
              <div className="expression-cues">
                <div className="expression-cue" data-expression-reveal><span className="expression-cue-emblem"><ExpressionMotif /><span>壹</span></span><div><h3>看狮头 · 眉眼与狮口</h3><p id="expressionEmotionCue">{current.emotion}</p></div></div>
                <div className="expression-cue" data-expression-reveal><span className="expression-cue-emblem"><ExpressionMotif kind="drum" /><span>贰</span></span><div><h3>听锣鼓 · 身段与步法</h3><p id="expressionMotionCue">{current.motion}</p></div></div>
              </div>
              <button type="button" className="expression-return interaction-cue" data-expression-reveal onClick={returnToOverview}>返回神态简介 <span aria-hidden="true">↗</span></button>
            </>}
            <p className="expression-state-count" data-expression-reveal><span>一狮一态 · 八面生辉</span><span>{String(selection.index + 1).padStart(2, '0')} / 08</span></p>
          </div>
        </div>
      </div>

      <p className="expression-evidence" id="chapterEvidence">AI辅助视觉 · 八态定性观察提示 · 等待真实图片/视频样本校核</p>
    </section>
  </>;
}
