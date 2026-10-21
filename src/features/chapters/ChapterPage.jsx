import ExpressionPage from './ExpressionPage.jsx';
import ActionPage from '../action/ActionPage.jsx';

export default function ChapterPage({ route, observation, onReturnToModel, lightingSettings, spatialSettings }) {
  return route === 'state' ? <ExpressionPage observation={observation} onReturnToModel={onReturnToModel} /> : <ActionPage lightingSettings={lightingSettings} spatialSettings={spatialSettings} />;
}
