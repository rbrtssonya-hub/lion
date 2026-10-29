import { lazy, Suspense } from 'react';

const ExpressionDepth = lazy(() => import('../expression-depth/ExpressionDepth.tsx'));

// Keep the host route, original navigation and structure/action return contracts.
export default function ExpressionPage(props) {
  return <div id="expressionObservation"><Suspense fallback={<div className="page-loading" role="status">正在展开醒狮八态…</div>}><ExpressionDepth {...props} /></Suspense></div>;
}
