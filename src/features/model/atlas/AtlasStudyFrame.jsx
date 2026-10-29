const corners = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

function CloudCorner({ corner }) {
  return <svg className={`atlas-frame-corner is-${corner}`} viewBox="0 0 64 64" aria-hidden="true" fill="none">
    <path className="atlas-corner-key" d="M3 25V3h22M8 24V8h16M3 16h13V3M8 12h4v12H3"/>
    <path className="atlas-corner-cloud" d="M11 48c-5-1-7-5-6-9 1-5 6-8 11-6-2-7 2-14 9-15 7-1 13 3 14 10 4-4 11-3 14 1 4 6 0 13-6 14-4 1-7-1-9-4-2 7-9 12-16 10-5-1-8-5-8-9"/>
    <path className="atlas-corner-scroll" d="M16 35c-5 0-8 6-3 9 3 2 7 0 6-3m3-8c-5-5-1-12 5-11 5 1 7 6 4 9-2 2-5 1-5-1m13 5c2-5 9-6 11-1 1 4-4 7-6 4M10 53h19M53 10v13"/>
    <path className="atlas-corner-key" d="m21 12 3-3 3 3-3 3z"/>
  </svg>;
}

export default function AtlasStudyFrame({ plate, part, chapter }) {
  return <figure className="atlas-study-frame" aria-label={`${part.name}图版画框`} style={{
    left: plate.x, top: plate.y, width: plate.width, height: plate.height,
    '--atlas-mat': `${plate.mat}px`, '--atlas-caption-height': `${plate.captionHeight}px`,
  }}>
    <div className="atlas-frame-inner-line" aria-hidden="true"/>
    {corners.map(corner => <CloudCorner key={corner} corner={corner}/>)}
    <figcaption className="atlas-frame-caption">
      <span>{part.number} · {part.name}</span>
      <span className="atlas-caption-detail">{chapter.caption}</span>
      <small>AI 造型转译</small>
    </figcaption>
  </figure>;
}
