import { chapterContent } from '../../config/chapters.js';
import ExpressionPage from './ExpressionPage.jsx';

export default function ChapterPage({ route }) {
  if (route === 'state') return <ExpressionPage />;
  const content = chapterContent.action;
  return <>
    <section className="chapter-stage chapter-stage--action" id="chapterStage" aria-label="信息可视化章节" data-chapter="action">
      <div className="chapter-layout chapter-layout--three-column">
        <aside className="chapter-side-panel chapter-side-panel--left" aria-label="动作说明">
          <p className="chapter-panel-index" id="chapterPanelIndex">{content.module}</p>
          <p className="chapter-kicker" id="chapterKicker">{content.kicker}</p>
          <h2>动作解读</h2>
          <p className="chapter-side-lead">{content.lead}</p>
          <div className="chapter-info-block"><span>动作重点</span><p>从入场、展开到收势，先记录动作的观看顺序，再补充经视频核对的时间点。</p></div>
          <div className="chapter-source-pill" id="chapterSourceTag">公开视频样本分析 · 待接入</div>
          <p className="chapter-status-note">动作专用视频提供后，再接入首帧、时间点与文字说明。</p>
        </aside>

        <div className="chapter-main-visual">
          <div className="chapter-visual-header">
            <div><p className="chapter-kicker">MOVEMENT STUDY / MEDIA</p><h1 id="chapterTitle">{content.title}</h1><p id="chapterLead">让动作成为一条可回看的节奏线。</p></div>
            <span className="chapter-index" id="chapterIndex">{content.index}</span>
          </div>
          <div className="chapter-media-frame" id="chapterMediaPlaceholder" data-media-state="pending" role="img" aria-label="动作视频待接入">
            <div className="chapter-media-viewport" id="chapterMediaViewport">
              <div className="chapter-media-inner"><span className="chapter-media-play" aria-hidden="true">▶</span><strong>动作视频待接入</strong><small>等待专用动作样本，不复用入场视频</small></div>
            </div>
            <div className="chapter-media-controls" id="chapterMediaControls">
              <button type="button" className="chapter-media-control-button" aria-label="动作视频待接入" disabled>▶</button>
              <span>动作视频待接入</span><span>资料状态 · 待核对</span>
            </div>
          </div>
          <div className="chapter-visual-footer"><span>动作视频待接入</span><span>资料状态 · 待核对</span></div>
        </div>

        <aside className="chapter-side-panel chapter-side-panel--right" aria-label="动作时间轴">
          <p className="chapter-panel-index">TIMELINE / QUALITATIVE</p>
          <h2>动作节点</h2>
          <p className="chapter-side-lead">{content.panelText}</p>
          <div className="chapter-timeline chapter-timeline--horizontal" id="chapterTrack" aria-label="动作时间轴">
            <span className="chapter-timeline-line" />
            {content.nodes.map((node, index) => <div className="chapter-timeline-node" key={node}><i /><strong>{node}</strong><small>{['ENTRY', 'OPEN', 'SETTLE'][index]}</small></div>)}
          </div>
          <div className="chapter-panel-rule" />
          <p className="chapter-evidence" id="chapterEvidence">视频接入后补充可核对的动作节点；当前不填写未经样本核对的持续时间、频次或评分。</p>
        </aside>
      </div>
    </section>
    <footer className="site-footer"><span>AI辅助创作 · 结构资料整理 · 交互原型</span><span>广府醒狮 / 03</span></footer>
  </>;
}
