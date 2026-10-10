import { useRef, useState } from 'react';
import { chapters } from '../config/chapters.js';

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
      {children}
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
