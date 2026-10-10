import { useRef, useState } from 'react';
import { chapters } from '../config/chapters.js';
import EntryLionEmblem from './EntryLionEmblem.jsx';

export default function EntryNavTools({ children, onNavigate }) {
  const dialogRef = useRef(null);
  const [mode, setMode] = useState('menu');
  const [query, setQuery] = useState('');
  const matches = chapters.filter(({ label, description = '', index }) =>
    `${index} ${label} ${description}`.includes(query.trim()));

  const open = (nextMode) => {
    setMode(nextMode);
    setQuery('');
    dialogRef.current.showModal();
  };
  const navigate = (route) => {
    dialogRef.current.close();
    onNavigate(route);
  };

  return <>
    <div className="entry-nav-shell">
      <div className="entry-nav-ribbon">
        <EntryLionEmblem />
        {['left', 'right'].map((side) => <svg key={side} className={`entry-ribbon-cloud entry-ribbon-cloud-${side}`} viewBox="0 0 90 100" aria-hidden="true" focusable="false">
          <path className="entry-ribbon-cloud-base" d="M9 23C29 10 40 22 42 30C55 27 62 39 57 46C73 45 79 56 70 65C83 77 70 90 58 87L31 92L24 83L5 79C19 77 22 68 15 62C30 60 31 51 23 47C39 42 29 29 9 23Z" />
          <path className="entry-ribbon-cloud-line" d="M30 31C44 27 53 40 43 46C38 49 34 45 37 41M41 59C55 50 66 64 55 70C49 73 43 69 48 65M25 78C37 85 58 77 61 86" />
          <path className="entry-ribbon-cloud-gold" d="M16 21C23 15 23 5 33 7C40-2 53 3 53 10C65 8 71 17 67 23L86 24L76 29H47C31 34 21 30 16 21Z" />
          <path className="entry-ribbon-cloud-detail" d="M33 8C44 5 50 13 45 18C41 23 33 20 36 15M53 11C62 12 62 20 57 22M21 22C29 26 34 27 42 25" />
        </svg>)}
        {children}
      </div>
      <svg className="entry-nav-tassel" viewBox="0 0 40 138" aria-hidden="true" focusable="false">
        <path d="M20 0V23M20 49V78" stroke="#e6b15e" strokeWidth="2" />
        <circle cx="20" cy="37" r="13" fill="#a8160d" stroke="#ffdf9b" strokeWidth="2" />
        <circle cx="20" cy="37" r="9" fill="none" stroke="#e6b15e" />
        <path d="M20 27L27 37L20 47L13 37ZM20 27V47M13 37H27" fill="none" stroke="#f7d99a" strokeWidth="1.2" />
        <path d="M16 70H24L28 128L23 133L20 130L16 134L12 130Z" fill="#a3130a" stroke="#e6b15e" strokeWidth="1" />
        <path d="M17 81L16 125M20 81V128M23 81L25 124" stroke="#e94323" strokeWidth="1.5" />
        <path d="M14 77H26" stroke="#f6ce79" strokeWidth="3" />
      </svg>
      <div className="entry-nav-tools">
        <button type="button" className="entry-tool" aria-label="搜索章节" aria-haspopup="dialog" onClick={() => open('search')}>
          <svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="13.5" cy="13.5" r="9" /><path d="m20 20 7 7" /></svg>
        </button>
        <button type="button" className="entry-tool" aria-label="打开章节菜单" aria-haspopup="dialog" onClick={() => open('menu')}>
          <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 8h22M5 16h22M5 24h22" /></svg>
        </button>
      </div>
    </div>
    <dialog ref={dialogRef} className="entry-dialog" aria-labelledby="entry-dialog-title"
      onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.close(); }}>
      <div className="entry-dialog-body">
        <header className="entry-dialog-header">
          <h2 id="entry-dialog-title">{mode === 'search' ? '搜索章节' : '章节目录'}</h2>
          <button type="button" className="entry-tool" aria-label="关闭窗口" onClick={() => dialogRef.current.close()}>
            <svg viewBox="0 0 32 32" aria-hidden="true"><path d="m8 8 16 16M24 8 8 24" /></svg>
          </button>
        </header>
        {mode === 'search' && <form onSubmit={(event) => { event.preventDefault(); if (matches[0]) navigate(matches[0].route); }}>
          <input type="search" aria-label="搜索章节" placeholder="输入章节名称" value={query}
            ref={(input) => input?.focus()} onChange={(event) => setQuery(event.target.value)} />
        </form>}
        <nav className="entry-dialog-chapters" aria-label="章节目录">
          {(mode === 'search' ? matches : chapters).map(({ route, index, label, description }) =>
            <button type="button" key={route} onClick={() => navigate(route)}>
              <span>{index}</span><div><strong>{label}</strong>{description && <small>{description}</small>}</div>
              <svg viewBox="0 0 28 20" aria-hidden="true"><path d="M2 10h23m-7-7 7 7-7 7" /></svg>
            </button>)}
        </nav>
        {mode === 'search' && matches.length === 0 && <p role="status" className="entry-search-empty">没有匹配的章节，请换一个关键词。</p>}
      </div>
    </dialog>
  </>;
}
