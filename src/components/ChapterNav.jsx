import { chapters } from '../config/chapters.js';
import EntryNavTools from './EntryNavTools.jsx';

export default function ChapterNav({ current, onNavigate, variant = 'entry' }) {
  const isEntry = variant === 'entry';
  const activeRoute = current === 'entry' ? 'intro' : current;
  const nav = (
    <nav className={isEntry ? 'entry-chapter-nav' : 'chapter-rail'} aria-label="作品章节导航">
      {chapters.map(({ route, index, label }) => (
        <button key={route} data-route={route} type="button"
          className={`${isEntry ? 'entry-nav-item' : 'chapter-route'} ${activeRoute === route ? 'is-current' : ''}`}
          onClick={() => onNavigate(route)} aria-current={activeRoute === route ? 'page' : undefined}>
          {isEntry ? <><span>{index}</span><strong>{label}</strong></> : label}
        </button>
      ))}
      {!isEntry && <button type="button" className="chapter-route chapter-home" onClick={() => onNavigate('entry')}>返回首页</button>}
    </nav>
  );
  return isEntry ? <EntryNavTools current={activeRoute} onNavigate={onNavigate}>{nav}</EntryNavTools> : nav;
}
