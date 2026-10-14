import ExpressionPage from './ExpressionPage.jsx';
import ActionPage from '../action/ActionPage.jsx';

export default function ChapterPage({ route }) {
  return route === 'state' ? <ExpressionPage /> : <ActionPage />;
}
