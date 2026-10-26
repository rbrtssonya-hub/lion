import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { media } from '../../config/media.js';
import { homeCultureSources, homeCultureStories } from '../../data/home-culture.js';

const story = homeCultureStories.find(item => item.id === 'lion-head-craft');
const source = homeCultureSources.find(item => item.id === 'fut-hok-craft');
const MiniGameDialog = lazy(() => import('../mini-games/MiniGameDialog.jsx'));
const stages = [
  { name: '扎', line: '立起形的轮廓' },
  { name: '扑', line: '承接面的塑造' },
  { name: '画', line: '让色与纹传神' },
  { name: '装', line: '完成外观装饰' },
];

function GameIcon({ poles = false }) {
  return <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
    {poles ? <><path d="M10 26v16m14-24v24m14-30v30M7 42h6m8 0h6m8 0h6" /><ellipse cx="10" cy="25" rx="6" ry="3" /><ellipse cx="24" cy="17" rx="6" ry="3" /><ellipse cx="38" cy="11" rx="6" ry="3" /><path d="M8 13c7-9 15-6 22-7" strokeDasharray="2 4" /></> : <><ellipse cx="24" cy="14" rx="15" ry="7" /><path d="M9 14v15c0 9 30 9 30 0V14M12 32l-4 10m28-10 4 10M8 42h32M15 4l7 8m14-8-8 8" /><ellipse cx="24" cy="22" rx="15" ry="7" strokeDasharray="2 4" /></>}
  </svg>;
}

export default function CraftSection({ active = true }) {
  const [failed, setFailed] = useState(false);
  const [gameId, setGameId] = useState(null);
  const returnFocusRef = useRef(null);
  useEffect(() => { if (!active) setGameId(null); }, [active]);
  const openGame = (id, event) => { returnFocusRef.current = event.currentTarget; setGameId(id); };
  const { photo } = story;
  return <section className="model-craft" aria-labelledby="model-craft-title">
    <figure className="model-craft-figure">
      <div className="model-craft-photo">
        {failed ? <div className="model-craft-fallback" role="status"><span aria-hidden="true">狮</span><p>实景照片暂不可用</p><small>右侧工艺线索与下方来源仍可阅读</small></div> :
          <img src={media[photo.mediaKey]} width={photo.width} height={photo.height} alt={photo.alt}
            loading="lazy" decoding="async" onError={() => setFailed(true)} />}
        <span className="model-craft-photo-label">完成品实景</span>
      </div>
      <figcaption>
        <strong>{photo.caption}</strong>
        <span>摄影：{photo.author} · 等比展示</span>
        <span className="model-craft-photo-links"><a href={photo.sourceUrl} target="_blank" rel="noreferrer">照片来源</a><a href={photo.licenseUrl} target="_blank" rel="noreferrer">{photo.license}</a></span>
      </figcaption>
    </figure>
    <div className="model-craft-reading">
      <header>
        <p className="model-craft-eyebrow">狮头工艺 · 从制作线索看外观</p>
        <h2 id="model-craft-title">扎、扑、画、装</h2>
        <p className="model-craft-lead">一扎一画，狮有了神采</p>
      </header>
      <p className="model-craft-description">{story.text}</p>
      <ol className="model-craft-stages" aria-label="狮头制作的四工序概念顺序">
        {stages.map((stage, index) => <li key={stage.name}>
          <span className="model-craft-stage-index" aria-hidden="true">0{index + 1}</span>
          <strong>{stage.name}</strong><span>{stage.line}</span>
        </li>)}
      </ol>
      <p className="model-craft-sequence-note">四工序概念线索 · 结合成品观察，不作为制作操作图。</p>
      <div className="model-craft-source">
        <span>工艺资料</span><a href={source.url} target="_blank" rel="noreferrer">{source.label} · {source.title} ↗</a>
      </div>
      <p className="model-craft-note">{story.note}</p>
      <section className="model-craft-games" aria-label="醒狮互动小游戏">
        <div className="model-craft-games-heading"><h3>小试狮艺</h3><span>跟鼓采青 · 跃上梅花桩</span></div>
        <div className="model-craft-game-grid">
          <button type="button" className="model-craft-game" aria-label="体验鼓点采青" aria-haspopup="dialog" onClick={event => openGame('rhythm', event)}>
            <span className="model-craft-game-icon"><GameIcon /></span><span className="model-craft-game-copy"><strong>鼓点采青</strong><span>看金圈 · 跟鼓点</span></span><span className="model-craft-game-action">玩一局 <b aria-hidden="true">↗</b></span>
          </button>
          <button type="button" className="model-craft-game" aria-label="挑战梅花桩" aria-haspopup="dialog" onClick={event => openGame('poles', event)}>
            <span className="model-craft-game-icon"><GameIcon poles /></span><span className="model-craft-game-copy"><strong>梅花桩落点</strong><span>蓄一点力 · 稳稳落桩</span></span><span className="model-craft-game-action">试身手 <b aria-hidden="true">↗</b></span>
          </button>
        </div>
      </section>
    </div>
    {active && gameId && <Suspense fallback={<div className="model-craft-game-loading" role="status">正在准备小游戏…</div>}><MiniGameDialog gameId={gameId} onClose={() => setGameId(null)} returnFocus={returnFocusRef.current} /></Suspense>}
  </section>;
}
