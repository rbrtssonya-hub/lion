import { chapters } from '../config/chapters.js';
import EntryNavTools from './EntryNavTools.jsx';

export default function ChapterNav({ current, onNavigate, variant = 'entry' }) {
  const isEntry = variant === 'entry';
  const nav = (
    <nav className={isEntry ? 'entry-chapter-nav' : 'chapter-rail'} aria-label="作品章节导航">
      {chapters.map(({ route, index, label }) => (
        <button key={route} data-route={route} type="button"
          className={`${isEntry ? 'entry-nav-item' : 'chapter-route'} ${current === route ? 'is-current' : ''}`}
          onClick={() => onNavigate(route)} aria-current={current === route ? 'page' : undefined}>
          {isEntry ? <>
            {current === route && <svg className="entry-nav-plaque" viewBox="0 0 150 90" preserveAspectRatio="none" aria-hidden="true" focusable="false">
              <path d="M33 5H117Q124 5 127 13Q140 13 141 26Q149 30 144 40Q151 45 144 50Q149 60 141 64Q140 77 127 77Q124 85 117 85H33Q26 85 23 77Q10 77 9 64Q1 60 6 50Q-1 45 6 40Q1 30 9 26Q10 13 23 13Q26 5 33 5Z" />
              <path className="entry-nav-plaque-inset" d="M34 9H116Q122 9 124 17Q137 17 137 29Q144 32 140 41Q146 45 140 49Q144 58 137 61Q137 73 124 73Q122 81 116 81H34Q28 81 26 73Q13 73 13 61Q6 58 10 49Q4 45 10 41Q6 32 13 29Q13 17 26 17Q28 9 34 9Z" />
              <path className="entry-nav-plaque-scroll" d="M15 30C25 23 30 33 24 38C20 42 15 38 19 35M13 52C24 46 29 57 22 61C17 64 14 60 17 57M135 30C125 23 120 33 126 38C130 42 135 38 131 35M137 52C126 46 121 57 128 61C133 64 136 60 133 57" />
            </svg>}
            <span>{index}</span><strong>{label}</strong>
          </> : label}
        </button>
      ))}
      {!isEntry && <button type="button" className="chapter-route chapter-home" onClick={() => onNavigate('entry')}>返回首页</button>}
    </nav>
  );
  return isEntry ? <EntryNavTools onNavigate={onNavigate}>{nav}</EntryNavTools> : nav;
}
