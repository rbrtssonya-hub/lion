import { chapterContent } from '../../config/chapters.js';

function ActionMedia() {
  return (
    <div className="chapter-media" aria-label="动作视频状态">
      <div className="chapter-media-orbit" aria-hidden="true" />
      <p className="chapter-media-status">动作视频待接入</p>
      <p className="chapter-media-meta">VIDEO SOURCE / PENDING</p>
      <span className="chapter-media-play" aria-hidden="true">▶</span>
    </div>
  );
}

function ExpressionObservation() {
  return (
    <div className="chapter-expression-observation" aria-label="神态观察区">
      <p className="chapter-observation-kicker">EXPRESSION STUDY</p>
      <h2>醒狮的灵性，藏在一眨一望之间</h2>
      <div className="chapter-expression-graphic" aria-hidden="true">
        <span className="chapter-expression-eye"><i /></span>
        <span className="chapter-expression-eye"><i /></span>
      </div>
      <p className="chapter-expression-label">眼神 · 眉部 · 嘴部</p>
    </div>
  );
}

export default function ChapterPage({ route }) {
  const content = chapterContent[route];
  return (
    <>
      <section className="chapter-stage" id="chapterStage" aria-label="信息可视化章节" data-chapter={route}>
        <div className="chapter-layout">
          <aside className="chapter-info-panel">
            <p className="chapter-kicker" id="chapterKicker">{content.kicker}</p>
            <h1 id="chapterTitle">{content.title}</h1>
            <p className="chapter-lead" id="chapterLead">{content.lead}</p>
            <div className="chapter-info-rule" />
            <p className="chapter-source-label">资料状态</p>
            <p className="chapter-source-text">{route === 'action' ? '公开视频样本分析' : '神态样本 / 定性观察'}</p>
            <p className="chapter-source-note">{route === 'action' ? '专用动作视频待提供，当前不复用入场视频。' : '概念节点先作为观察入口，等待真实图片或视频样本。'}</p>
          </aside>

          <div className="chapter-center">
            <div className="chapter-center-meta">
              <span className="chapter-index" id="chapterIndex">{content.index}</span>
              <span className="chapter-center-label">广府醒狮 · 交互式数字档案</span>
              <div className="chapter-signal" aria-hidden="true"><span /><span /><span /><span /></div>
            </div>
            {route === 'action' ? <ActionMedia /> : <ExpressionObservation />}
            <div className="chapter-track" id="chapterTrack" aria-label="章节内容节点">
              <span className="chapter-track-line" />
              {content.nodes.map((node, index) => (
                <div className={'chapter-node' + (index === 0 ? ' is-current' : '')} key={node}>
                  <b>{String(index + 1).padStart(2, '0')}</b>
                  <span>{node}</span>
                </div>
              ))}
            </div>
            <p className="chapter-center-note">{route === 'action' ? '动作说明只使用已有定性节点，时间、频次与难度等待视频样本核对。' : '当前使用定性观察节点，不将概念标签写成完整研究结论。'}</p>
          </div>

          <aside className="chapter-panel">
            <p className="chapter-panel-index" id="chapterPanelIndex">{content.module}</p>
            <h2 id="chapterPanelTitle">{content.panelTitle}</h2>
            <p id="chapterPanelText">{content.panelText}</p>
            <div className="chapter-panel-rule" />
            <div className="chapter-panel-list" id="chapterPanelList">
              {content.nodes.map((node, index) => <span key={node}><b>{String(index + 1).padStart(2, '0')}</b>{node}</span>)}
            </div>
          </aside>
        </div>
      </section>
      <footer className="site-footer"><span>AI辅助创作 · 结构资料整理 · 交互原型</span><span>广府醒狮 / {content.index.split(' / ')[0]}</span></footer>
    </>
  );
}
