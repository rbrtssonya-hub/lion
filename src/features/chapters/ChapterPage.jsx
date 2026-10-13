import { chapterContent } from '../../config/chapters.js';

export default function ChapterPage({ route }) {
  const content = chapterContent[route];
  const isAction = route === 'action';
  return <>
    <section className={`chapter-stage chapter-stage--${route}`} id="chapterStage" aria-label="信息可视化章节" data-chapter={route}>
      <div className="chapter-layout chapter-layout--three-column">
        <aside className="chapter-side-panel chapter-side-panel--left" aria-label={isAction ? '动作说明' : '神态局部观察'}>
          <p className="chapter-panel-index" id="chapterPanelIndex">{content.module}</p>
          {isAction ? <>
            <p className="chapter-kicker" id="chapterKicker">{content.kicker}</p>
            <h2>动作解读</h2>
            <p className="chapter-side-lead">{content.lead}</p>
            <div className="chapter-info-block"><span>动作重点</span><p>从入场、展开到收势，先记录动作的观看顺序，再补充经视频核对的时间点。</p></div>
            <div className="chapter-source-pill" id="chapterSourceTag">公开视频样本分析 · 待接入</div>
            <p className="chapter-status-note">动作专用视频提供后，再接入首帧、时间点与文字说明。</p>
          </> : <>
            <p className="chapter-kicker" id="chapterKicker">{content.kicker}</p>
            <h2>局部凝视</h2>
            <div className="expression-miniature" aria-label="神态局部示意图"><span className="expression-miniature-eye" /><span className="expression-miniature-pupil" /></div>
            <div className="chapter-info-block"><span>观察部位</span><p>眉部、眼神与嘴部是判断醒狮神态变化的主要观察入口。</p></div>
            <div className="chapter-source-pill">神态样本 · 定性观察</div>
          </>}
        </aside>

        <div className="chapter-main-visual">
          <div className="chapter-visual-header">
            <div>
              <p className="chapter-kicker">{isAction ? 'MOVEMENT STUDY / MEDIA' : 'OBSERVATION / LION SPIRIT'}</p>
              <h1 id="chapterTitle">{content.title}</h1>
              <p id="chapterLead">{isAction ? '让动作成为一条可回看的节奏线。' : '从眉眼、眼神与嘴部变化，观察醒狮由静到动的神态线索。'}</p>
            </div>
            <span className="chapter-index" id="chapterIndex">{content.index}</span>
          </div>

          {isAction ? <div className="chapter-media-frame" id="chapterMediaPlaceholder" data-media-state="pending" role="img" aria-label="动作视频待接入">
            <div className="chapter-media-viewport" id="chapterMediaViewport">
              <div className="chapter-media-inner"><span className="chapter-media-play" aria-hidden="true">▶</span><strong>动作视频待接入</strong><small>等待专用动作样本，不复用入场视频</small></div>
            </div>
            <div className="chapter-media-controls" id="chapterMediaControls">
              <button type="button" className="chapter-media-control-button" aria-label="动作视频待接入" disabled>▶</button>
              <span>动作视频待接入</span>
              <span>资料状态 · 待核对</span>
            </div>
          </div> : <div className="expression-observation" id="expressionObservation" aria-label="醒狮神态观察区">
            <div className="expression-observation-mark"><span className="expression-eye expression-eye--left"><i /></span><span className="expression-eye expression-eye--right"><i /></span><span className="expression-mouth" /></div>
            <span className="expression-callout expression-callout--brow">眉部 / BROW</span>
            <span className="expression-callout expression-callout--gaze">眼神 / GAZE</span>
            <span className="expression-callout expression-callout--mouth">嘴部 / MOUTH</span>
          </div>}

          <div className="chapter-visual-footer">
            <span>{isAction ? '动作视频待接入' : '定性观察区'}</span>
            <span>{isAction ? '资料状态 · 待核对' : '样本状态 · 待校核'}</span>
          </div>
        </div>

        <aside className="chapter-side-panel chapter-side-panel--right" aria-label={isAction ? '动作时间轴' : '神态标签'}>
          <p className="chapter-panel-index">{isAction ? 'TIMELINE / QUALITATIVE' : 'QUALITATIVE TAGS'}</p>
          <h2>{isAction ? '动作节点' : '神态标签'}</h2>
          <p className="chapter-side-lead">{content.panelText}</p>
          {isAction ? <div className="chapter-timeline chapter-timeline--horizontal" id="chapterTrack" aria-label="动作时间轴">
            <span className="chapter-timeline-line" />
            {content.nodes.map((node, index) => <div className="chapter-timeline-node" key={node}><i /><strong>{node}</strong><small>{index === 0 ? 'ENTRY' : index === 1 ? 'OPEN' : 'SETTLE'}</small></div>)}
          </div> : <div className="expression-tags" id="expressionTags">
            {content.nodes.map((node, index) => <div className="expression-tag-card" key={node}><span className="expression-tag">{node}</span><small>{['眼神方向 / 头部回应', '眼睑动作 / 眉部张力', '嘴部变化 / 节奏唤醒'][index]}</small></div>)}
          </div>}
          <div className="chapter-panel-rule" />
          <p className="chapter-evidence" id="chapterEvidence">{isAction ? '视频接入后补充可核对的动作节点；当前不填写未经样本核对的持续时间、频次或评分。' : '定性概念节点，等待真实图片/视频样本校核。当前不添加未经来源支持的量化结论。'}</p>
        </aside>
      </div>
    </section>
    <footer className="site-footer"><span>AI辅助创作 · 结构资料整理 · 交互原型</span><span>广府醒狮 / {isAction ? '03' : '04'}</span></footer>
  </>;
}
