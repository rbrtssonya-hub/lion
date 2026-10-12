import { chapterContent } from '../../config/chapters.js';

export default function ChapterPage({ route }) {
  const content = chapterContent[route];
  return <>
    <section className="chapter-stage" id="chapterStage" aria-label="信息可视化章节" data-chapter={route}>
      <div className="chapter-layout">
        <div className="chapter-canvas">
          <div className="chapter-index" id="chapterIndex">{content.index}</div>
          <div className="chapter-signal" aria-hidden="true"><span /><span /><span /><span /></div>
          <div className="chapter-copy"><p className="chapter-kicker" id="chapterKicker">{content.kicker}</p><h1 id="chapterTitle">{content.title}</h1><p id="chapterLead">{content.lead}</p></div>
          <div className="chapter-track" id="chapterTrack" aria-label="章节内容节点">
            <span className="chapter-track-line" />
            {content.nodes.map((node, index) => <div className="chapter-node" key={node}><b>{String(index + 1).padStart(2, '0')}</b><span>{node}</span></div>)}
          </div>
        </div>
        <aside className="chapter-panel">
          <p className="chapter-panel-index" id="chapterPanelIndex">{content.module}</p>
          <h2 id="chapterPanelTitle">{content.panelTitle}</h2><p id="chapterPanelText">{content.panelText}</p>
          <div className="chapter-panel-rule" />
          <div className="chapter-panel-list" id="chapterPanelList"><span>素材入口</span><span>时间轴</span><span>动作说明</span></div>
        </aside>
      </div>
    </section>
    <footer className="site-footer"><span>AI辅助创作 · 结构资料整理 · 交互原型</span><span>广府醒狮 / 01</span></footer>
  </>;
}
