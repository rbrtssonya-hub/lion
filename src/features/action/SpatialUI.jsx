// DOM remains owned by React; the scene only updates the plane transforms.
// Controls are attached exclusively to the canvas, so UI never starts an orbit.
export function InteractionBoundary({ children, className = '', ...props }) {
  const stop = event => event.stopPropagation();
  return <div {...props} className={className} data-spatial-interactive="true"
    onPointerDown={stop} onPointerMove={stop} onPointerUp={stop} onPointerCancel={stop}
    onWheel={stop} onTouchStart={stop} onTouchMove={stop} onTouchEnd={stop}>
    {children}
  </div>;
}

export default function SpatialUI({ introRef, infoRefs, playRefs, layerRef, clips, activeId, playing,
  onSelect, onScreenPlayback, flatMode }) {
  return <div ref={layerRef} className="theater-spatial-layer" aria-label="展厅空间信息">
    <div className="theater-spatial-plane theater-intro-plane" ref={introRef}>
      <InteractionBoundary className="theater-plaque theater-intro" aria-label="四面观狮介绍牌">
        <span className="theater-cloud" aria-hidden="true">如意 · 观狮</span>
        <p className="theater-plaque-eyebrow">南风有狮 <span>/ 动作</span></p>
        <h2>四面观狮</h2>
        <p>拖动视角 · 滚轮缩放 · 左右切换观赏</p>
        <span className="theater-plaque-foot">一狮四景，随目而观</span>
      </InteractionBoundary>
    </div>
    {clips.map((clip, index) => <div key={clip.id}
      ref={element => { if (element) infoRefs.current.set(clip.id, element); else infoRefs.current.delete(clip.id); }}
      className="theater-spatial-plane theater-info-plane" data-info-screen={clip.id}
      id={!flatMode && activeId === clip.id ? 'theaterObservation' : undefined}>
      <InteractionBoundary className="theater-plaque theater-screen-info" aria-label={`${clip.name}空间解读`}>
        <p className="theater-caption-kicker">当前巨幕 <span>{String(index + 1).padStart(2, '0')} / 04</span></p>
        <h2 id={!flatMode && activeId === clip.id ? 'theaterActionName' : undefined}>{clip.name}</h2>
        <p className="theater-description">{clip.description}</p>
        <p className="theater-keywords">{clip.keywords?.join(' · ')}</p>
        <button type="button" onClick={() => onScreenPlayback(clip.id)}
          aria-label={`${activeId === clip.id && playing ? '暂停' : '播放'}${clip.name}巨幕`}>
          <span aria-hidden="true">{activeId === clip.id && playing ? 'Ⅱ' : '▷'}</span>
          {activeId === clip.id && playing ? '暂停观看' : '继续观看'}
        </button>
      </InteractionBoundary>
    </div>)}
    {clips.map((clip, index) => <div key={clip.id}
      ref={element => { if (element) playRefs.current.set(clip.id, element); else playRefs.current.delete(clip.id); }}
      className="theater-spatial-plane theater-play-plane" data-play-screen={clip.id}>
      <InteractionBoundary className="theater-screen-play">
        <button type="button" aria-label={`选择${clip.name}巨幕播放`} onClick={() => onScreenPlayback(clip.id)}>
          <span aria-hidden="true">{activeId === clip.id && playing ? 'Ⅱ' : '▷'}</span>
          {String(index + 1).padStart(2, '0')} · {clip.name}
        </button>
        <button type="button" aria-label={`聚焦${clip.name}巨幕`} onClick={() => onSelect(clip.id)}>转向</button>
      </InteractionBoundary>
    </div>)}
  </div>;
}
