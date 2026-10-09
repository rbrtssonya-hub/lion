import { chapters } from '../config/chapters.js';

export default function ChapterNav({ current, onNavigate, variant = 'entry' }) {
  const isEntry = variant === 'entry';
  const nav = (
    <nav className={isEntry ? 'entry-chapter-nav' : 'chapter-rail'} aria-label="作品章节导航">
      {chapters.map(({ route, index, label }) => (
        <button key={route} data-route={route} type="button"
          className={`${isEntry ? 'entry-nav-item' : 'chapter-route'} ${current === route ? 'is-current' : ''}`}
          onClick={() => onNavigate(route)} aria-current={current === route ? 'page' : undefined}>
          {isEntry ? <><span>{index}</span><strong>{label}</strong></> : label}
        </button>
      ))}
      {!isEntry && <button type="button" className="chapter-route chapter-home" onClick={() => onNavigate('entry')}>返回首页</button>}
    </nav>
  );
  return isEntry ? <div className="entry-nav-shell">{nav}</div> : nav;
}
