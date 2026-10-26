import ExpressionPage from './ExpressionPage.jsx';
import ActionPage from '../action/ActionPage.jsx';

export default function ChapterPage({ route, active = true, observation, onReturnToModel, lightingSettings }) {
  return route === 'state' ? <ExpressionPage active={active} observation={observation} onReturnToModel={onReturnToModel} settings={lightingSettings} /> : <ActionPage lightingSettings={lightingSettings} />;
}
