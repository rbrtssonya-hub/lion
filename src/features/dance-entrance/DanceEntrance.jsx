import { useRef } from 'react';
import { media } from '../../config/media.js';
import { lionExpressions } from '../../data/lion-expressions.js';
import { usePortalView } from './usePortalView.js';
import ChapterIdentity from '../../components/ChapterIdentity.jsx';
import './dance-entrance.css';

function SceneImage({ src, alt = '', ...props }) {
  return <img src={src} alt={alt} draggable="false" decoding="async" {...props} onError={event => {
    event.currentTarget.hidden = true;
    event.currentTarget.parentElement.dataset.imageFailed = 'true';
  }} />;
}

function PortalFrame() {
  const shape = 'M32 6H568Q568 32 594 32V338Q568 338 568 364H32Q32 338 6 338V32Q32 32 32 6Z';
  return <svg className="portal-frame" viewBox="0 0 600 370" preserveAspectRatio="none" aria-hidden="true">
    <path d={shape} fill="none" stroke="#75251d" strokeWidth="11" />
    <path d={shape} fill="none" stroke="#be9256" strokeWidth="6" />
    <path d={shape} fill="none" stroke="#f1d8a4" strokeWidth="1.5" />
    <path d="M50 17H550M17 50V320M583 50V320M50 353H550" stroke="#d3ac70" strokeWidth="1" fill="none" />
  </svg>;
}

function TheaterPreview() {
  const posters = [media.actionTanqingPoster, media.actionDoumaoPoster, media.actionTuqiuPoster, media.actionMeihuazhuangPoster];
  return <div className="portal-world theater-preview" data-scene="theater" aria-hidden="true">
    <SceneImage className="theater-preview-back" src={media.actionEntryPoster} />
    <div className="preview-ceiling" />
    <div className="preview-floor" />
    {posters.map((src, index) => <div className={`preview-screen preview-screen-${index}`} key={src}>
      <SceneImage src={src} /><span>{['探青采青', '抖毛', '吐球', '跃梅花桩'][index]}</span>
    </div>)}
    <div className="theater-preview-glow" />
    <div className="portal-scene-caption"><span>四面环幕</span><i />身随鼓动 · 形随狮行</div>
  </div>;
}

function ExpressionPreview() {
  return <div className="portal-world expression-preview" data-scene="expressions" aria-hidden="true">
    <div className="expression-vanishing" /><div className="expression-floor" /><div className="expression-ceiling" />
    {lionExpressions.map((expression, index) => <div key={expression.name} className={`expression-scroll expression-scroll-${index}`} data-expression={expression.name} style={{ '--i': index }}>
      <span className="expression-scroll-number">0{index + 1}</span>
      <SceneImage src={media[expression.imageKey]} /><b>{expression.name}</b>
    </div>)}
    <SceneImage className="expression-preview-hero" src={media.expressionDoubt} />
    <div className="portal-scene-caption"><span>喜怒哀乐 · 动静惊疑</span><i />循神入境</div>
  </div>;
}

export default function DanceEntrance({ onNavigate }) {
  const rootRef = useRef(null);
  const stageRef = useRef(null);
  const { moved, reset } = usePortalView(rootRef, stageRef);
  const navigate = (event, route) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onNavigate(route);
  };

  return <section ref={rootRef} className="dance-entrance" aria-label="舞章空间入口" data-view-moved={moved}
    style={{ '--dance-paper': `url("${new URL(media.danceEntranceBackground, document.baseURI).href}")` }}>
    <header className="dance-heading">
      <div className="dance-heading-title"><img src={media.navLabelWu} alt="舞" /><span>形神之间</span></div>
      <p>一处观舞，一处观神。<span>循着狮韵，选择你的观看方式。</span></p>
      <ChapterIdentity chapter="action" title="观舞传神" titleAs="h1" className="dance-chapter-identity" />
    </header>
    <div className="dance-portals" ref={stageRef} role="group" aria-label="拖动环看两处空间" aria-describedby="danceViewHint" tabIndex={0}>
      <article className="dance-portal dance-portal--theater">
        <a className="portal-link" href="#/theater" onClick={event => navigate(event, 'theater')} aria-label="进入三维展厅">
          <div className="portal-card">
            <div className="portal-viewport"><TheaterPreview /></div><PortalFrame />
            <span className="portal-corner-seal" aria-hidden="true">观舞</span>
          </div>
          <div className="portal-label"><span className="portal-number">01 / 动作空间</span><h2>三维展厅</h2><p>环看四面巨幕，随锣鼓走近醒狮身段。</p><span className="portal-enter">进入展厅 <span aria-hidden="true">↗</span></span></div>
        </a>
      </article>
      <article className="dance-portal dance-portal--expressions">
        <a className="portal-link" href="#/state" onClick={event => navigate(event, 'state')} aria-label="走近醒狮八态">
          <div className="portal-card">
            <div className="portal-viewport"><ExpressionPreview /></div><PortalFrame />
            <span className="portal-corner-seal" aria-hidden="true">观神</span>
          </div>
          <div className="portal-label"><span className="portal-number">02 / 神态空间</span><h2>醒狮八态纵深空间</h2><p>穿行八种神态，寻眉眼与狮口之间的回应。</p><span className="portal-enter">走近八态 <span aria-hidden="true">↖</span></span></div>
        </a>
      </article>
    </div>
    <div className="dance-view-tools">
      <span className="dance-orbit-cue" aria-hidden="true"><i /><b>↔</b></span>
      <p id="danceViewHint">拖动旋转视角<span>聚焦景窗后，可用方向键环看</span></p>
      <button type="button" onClick={reset} aria-label="视角归位">视角归位 <span aria-hidden="true">↺</span></button>
    </div>
    <p className="dance-evidence">AI辅助场景预览 · 八态为定性观察提示</p>
  </section>;
}
