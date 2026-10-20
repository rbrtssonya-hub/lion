import { useState } from 'react';
import { media } from '../../config/media.js';
import { lionExpressions, expressionComparisons } from '../../data/lion-expressions.js';

function ComparisonCard({ expression }) {
  const [failed, setFailed] = useState(false);
  return <article className="expression-comparison-card expression-copy" data-surface="expressionOverlay" data-expression-id={expression.id}>
    <figure>{failed ? <p className="expression-image-fallback">{expression.name}态示意图暂不可用，下方介绍仍可阅读。</p> : <img src={media[expression.imageKey]} alt={`${expression.name}态AI辅助示意，非真实表演样本`} loading="lazy" decoding="async" onError={() => setFailed(true)} />}</figure>
    <h2>{expression.name}</h2><p className="expression-comparison-summary">{expression.summary}</p>
    <dl>{[['姿态', expression.posture], ['眉眼与狮口', expression.emotion], ['表现意图', expression.intent]].map(([label, text]) => <div key={label}><dt>{label}</dt><dd>{text}</dd></div>)}</dl>
  </article>;
}

export default function ExpressionComparison({ pairId, onSelect }) {
  const pair = expressionComparisons.find(item => item.id === pairId) ?? expressionComparisons[0];
  const selectByKey = (event, index) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
    const next = { ArrowRight: (index + 1) % 3, ArrowLeft: (index + 2) % 3, Home: 0, End: 2 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    onSelect(expressionComparisons[next].id);
    event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[next]?.focus();
  };
  return <div className="expression-comparison">
    <div className="expression-comparison-tabs" role="tablist" aria-label="神态对照组合">{expressionComparisons.map((item, index) => <button type="button" role="tab" key={item.id} id={`compare-tab-${item.id}`} aria-selected={pair.id === item.id} aria-controls="expressionComparePanel" tabIndex={pair.id === item.id ? 0 : -1} onKeyDown={event => selectByKey(event, index)} onClick={() => onSelect(item.id)}>{item.label}</button>)}</div>
    <div id="expressionComparePanel" className="expression-comparison-grid" role="tabpanel" aria-labelledby={`compare-tab-${pair.id}`}>
      {pair.ids.map(id => <ComparisonCard key={id} expression={lionExpressions.find(item => item.id === id)} />)}
    </div>
  </div>;
}
