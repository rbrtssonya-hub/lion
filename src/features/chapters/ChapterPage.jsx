import ExpressionPage from './ExpressionPage.jsx';
import ActionPage from '../action/ActionPage.jsx';

export default function ChapterPage({ route, observation, onReturnToModel, lightingSettings }) {
  return route === 'state' ? <ExpressionPage observation={observation} onReturnToModel={onReturnToModel} settings={lightingSettings} /> : <ActionPage lightingSettings={lightingSettings} />;
}
