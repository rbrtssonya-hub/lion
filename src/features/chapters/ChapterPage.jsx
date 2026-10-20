import ExpressionPage from './ExpressionPage.jsx';
import ActionPage from '../action/ActionPage.jsx';

export default function ChapterPage({ route, observation, onReturnToModel }) {
  return route === 'state' ? <ExpressionPage observation={observation} onReturnToModel={onReturnToModel} /> : <ActionPage />;
}
