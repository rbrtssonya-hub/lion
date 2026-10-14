import { useCallback, useEffect, useRef, useState } from 'react';
import { media } from '../../config/media.js';
import { actionClips } from './actionClips.js';
import ActionTimeline from './ActionTimeline.jsx';
import ActionVideo from './ActionVideo.jsx';
import './action.css';

function Cloud() {
  return <svg className="action-cloud" viewBox="0 0 100 50" fill="none" aria-hidden="true"><path d="M7 34C-4 16 22 12 25 23 17 1 50-1 51 19 63 5 85 19 74 30 103 24 107 45 78 45H24C5 45 2 37 7 34Zm20 0c-11-10 6-19 11-9-3-18 22-20 21-5 9-6 24 8 11 14M39 36c-7-1-8-8-3-11" /></svg>;
}
function Lines({ lines }) { return <div className="action-intro-lines">{lines.map(line => <p key={line}>{line}</p>)}</div>; }

// Props are ordinary content inputs; the default page never supplies test media.
export default function ActionPage({ clips = actionClips, assets = media }) {
  const [selectedId, setSelectedId] = useState(clips[0].id);
  const selected = clips.find(clip => clip.id === selectedId) || clips[0];
  const selectedIndex = clips.indexOf(selected);
  const players = useRef(new Map());
  const rows = useRef(new Map());
  const detailBar = useRef(null);
  const jump = useRef(null);
  const landed = useRef(null);
  const jumpTimer = useRef(null);
  const stopAll = useCallback((except) => players.current.forEach((player, id) => { if (id !== except) player?.pause(); }), []);
  const onStart = useCallback((playerId, clipId) => { stopAll(playerId); setSelectedId(clipId); }, [stopAll]);
  const selectHero = useCallback(id => { jump.current = null; landed.current = { top: scrollY }; stopAll(); setSelectedId(id); }, [stopAll]);
  const goToClip = useCallback(id => {
    const row = rows.current.get(id);
    if (!row) return;
    stopAll(); setSelectedId(id);
    const headerHeight = document.querySelector('.site-header')?.getBoundingClientRect().height || 88;
    const barHeight = detailBar.current?.getBoundingClientRect().height || 80;
    const top = Math.max(0, Math.min(row.getBoundingClientRect().top + scrollY - headerHeight - barHeight - 24,
      document.documentElement.scrollHeight - innerHeight));
    jump.current = { id, top };
    landed.current = null;
    clearTimeout(jumpTimer.current);
    jumpTimer.current = setTimeout(() => { jump.current = null; }, 1800);
    window.scrollTo({ top, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }, [stopAll]);
  useEffect(() => {
    let frame;
    const update = () => {
      frame = null;
      if (jump.current) {
        if (Math.abs(scrollY - jump.current.top) > 3) return;
        // Keep the clicked row selected at its top anchor, even when the
        // viewport midpoint falls in a following row on tall/narrow layouts.
        landed.current = { top: scrollY };
        jump.current = null; clearTimeout(jumpTimer.current);
        return;
      }
      if (landed.current && Math.abs(scrollY - landed.current.top) <= 3) return;
      landed.current = null;
      const bar = detailBar.current?.getBoundingClientRect();
      const visibleTop = Math.max(document.querySelector('.site-header')?.getBoundingClientRect().bottom || 88, bar?.bottom < innerHeight ? bar.bottom : 88);
      const middle = visibleTop + (innerHeight - visibleTop) * .4;
      const visible = clips.map(clip => ({ id: clip.id, rect: rows.current.get(clip.id)?.getBoundingClientRect() }))
        .filter(({ rect }) => rect && rect.top <= middle && rect.bottom >= middle);
      if (visible.length) setSelectedId(visible[0].id);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const cancelJump = event => {
      if (event.type === 'keydown' && !['PageDown','PageUp','ArrowDown','ArrowUp','Home','End',' '].includes(event.key)) return;
      if (!jump.current) return;
      // Cancel Chrome's native smooth scroll too, not just our selection lock.
      window.scrollTo({ top: scrollY, behavior: 'instant' });
      jump.current = null; clearTimeout(jumpTimer.current); schedule();
    };
    const observer = new IntersectionObserver(schedule, { rootMargin: '-30% 0px -30% 0px' });
    rows.current.forEach(row => observer.observe(row));
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    window.addEventListener('wheel', cancelJump, { passive: true });
    window.addEventListener('pointerdown', cancelJump);
    window.addEventListener('keydown', cancelJump);
    return () => {
      observer.disconnect(); cancelAnimationFrame(frame); clearTimeout(jumpTimer.current);
      window.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule);
      window.removeEventListener('wheel', cancelJump); window.removeEventListener('pointerdown', cancelJump);
      window.removeEventListener('keydown', cancelJump); stopAll();
    };
  }, [clips, stopAll]);
  const register = id => player => { if (player) players.current.set(id, player); else players.current.delete(id); };
  const watch = id => { landed.current = { top: scrollY }; setSelectedId(id); players.current.get(`clip-${id}`)?.play(); };
  return <>
    <section className="chapter-stage action-page" id="chapterStage" data-chapter="action" data-active-action={selected.id} aria-label="醒狮动作图鉴">
      <h1 className="sr-only" id="chapterTitle">动作</h1>
      <section className="action-hero" id="actionHero" aria-label="动作片段首屏">
        <div className="action-hero-grid">
          <ActionVideo key={selected.id} ref={register('hero')} clip={selected} playerId="hero" assets={assets} hero onStart={onStart} />
          <div className="action-hero-copy" aria-live="polite">
            <p className="action-counter" data-action-count><b>{String(selectedIndex + 1).padStart(2, '0')}</b> / 04</p>
            <div className="action-heading-decoration"><img src={assets.navLion} alt="" /><Cloud /></div>
            <h2 data-action-name>{selected.name}</h2>
            <span className="action-copy-rule" />
            <Lines lines={selected.lines} />
            <p className="action-copy-note">{selected.sourceNote}</p>
          </div>
        </div>
        <ActionTimeline items={clips} activeId={selected.id} onSelect={selectHero} placement="hero" />
        <a className="action-explore-link" href="#/action" onClick={event => { event.preventDefault(); goToClip(selected.id); }}>向下读懂动作 <span>↓</span></a>
      </section>
      <section className="action-details" id="actionDetails" aria-labelledby="actionGuideTitle">
        <div ref={detailBar} className="action-sticky-index"><ActionTimeline items={clips} activeId={selected.id} onSelect={goToClip} placement="details" /></div>
        <header className="action-guide-heading">
          <div><Cloud /><h2 id="actionGuideTitle"><em>动作</em>怎么读</h2><img src={assets.navLion} alt="" /><Cloud /></div>
          <p>从狮头、步伐与身体配合看懂表演。</p>
        </header>
        <div className="action-clip-list">
          {clips.map((clip, index) => <article className={`action-clip${selected.id === clip.id ? ' is-selected' : ''}`}
            key={clip.id} id={`action-clip-${clip.id}`} ref={row => { if (row) rows.current.set(clip.id, row); else rows.current.delete(clip.id); }}
            aria-labelledby={`action-name-${clip.id}`}>
            <ActionVideo ref={register(`clip-${clip.id}`)} clip={clip} playerId={`clip-${clip.id}`} assets={assets} onStart={onStart} />
            <div className="action-clip-copy">
              <div className="action-clip-heading"><span>{String(index + 1).padStart(2, '0')}</span><h3 id={`action-name-${clip.id}`}>{clip.name}</h3><Cloud /></div>
              <Lines lines={clip.lines} />
              <button type="button" className="action-watch" data-watch-clip onClick={() => watch(clip.id)}>观看片段 →</button>
              <p className="action-copy-note">{clip.sourceNote}</p>
            </div>
          </article>)}
        </div>
        <p className="action-evidence" id="chapterEvidence">动作参考示意 · 四段独立视频待接入 · 以实际视频为准</p>
      </section>
    </section>
    <footer className="site-footer"><span>AI辅助参考提取 · 动作观察提示</span><span>广府醒狮 / 动作档案</span></footer>
  </>;
}
