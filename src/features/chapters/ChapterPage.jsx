import ExpressionPage from './ExpressionPage.jsx';
import ActionPage from '../action/ActionPage.jsx';
import SpreadPage from '../spread/SpreadPage.jsx';

export default function ChapterPage({ route, active = true, observation, onReturnToModel, lightingSettings, onNavigate, onStampPreviewReady }) {
  if (route === 'spread') return <SpreadPage onNavigate={onNavigate} settings={lightingSettings} onStampPreviewReady={onStampPreviewReady} />;
  return route === 'state'
    ? <ExpressionPage active={active} observation={observation} onReturnToModel={onReturnToModel} onReturnToAction={() => onNavigate('action')} settings={lightingSettings} />
    : <ActionPage lightingSettings={lightingSettings} onNavigate={onNavigate} />;
}
