import { spreadMapLevels, spreadMapPoints } from '../../data/spread.js';
import { useState } from 'react';
import { media } from '../../config/media.js';
import { handleHeritageTabs } from '../home/HeritageElements.jsx';

// Approximate city positions projected through the source Blender camera at
// frames 1, 100 and 200. The source is an illustrative map, not a survey.
const shots = {
  guangdong: { image: media.spreadMapGuangdong, points: { foshan: [468, 323, 345, 600], guangzhou: [480, 314, 625, 310] } },
  china: { image: media.spreadMapChina, points: { guangdong: [602, 374, 500, 485], 'hong-kong': [612, 382, 760, 480] } },
  world: { image: media.spreadMapWorld, points: { lingnan: [778, 260, 690, 205], 'hong-kong': [780, 263, 875, 275], singapore: [755, 314, 820, 440], 'san-francisco': [200, 225, 125, 300], edmonton: [221, 186, 255, 135] } },
};

export default function SpreadMap({ activeId, photoIndex, level, onSelect, onLevelChange }) {
  const levelIndex = spreadMapLevels.findIndex(item => item.id === level);
  const current = spreadMapLevels[levelIndex];
  const points = spreadMapPoints[level];
  const isSelected = point => point.placeId === activeId && (point.photoIndex === undefined || point.photoIndex === photoIndex);
  const shot = shots[level];
  const [failedImage, setFailedImage] = useState(null);
  return <section className="spread-map" aria-labelledby="spreadMapTitle" data-map-level={level}>
    <div className="spread-map-heading">
      <h3 id="spreadMapTitle">所收录案例分布示意</h3>
      <span>{current.count}</span>
    </div>
    <div className="spread-level-tabs" role="tablist" aria-label="地图范围">
      {spreadMapLevels.map((item, index) => <button key={item.id} type="button" role="tab" id={`spread-level-${item.id}`}
        aria-label={item.name} aria-selected={level === item.id} aria-controls="spreadMapView" tabIndex={level === item.id ? 0 : -1}
        onClick={() => onLevelChange(item.id)} onKeyDown={event => handleHeritageTabs(event, index, spreadMapLevels.length, next => onLevelChange(spreadMapLevels[next].id))}>
        <small aria-hidden="true">0{index + 1}</small><span>{item.name}</span><i aria-hidden="true">{item.subtitle}</i>
      </button>)}
    </div>
    <div className="spread-map-viewport" id="spreadMapView" role="tabpanel" aria-labelledby={`spread-level-${level}`}>
    <div className="spread-world" key={level}>
      {failedImage === shot.image
        ? <div className="spread-map-fallback" role="status">地图画面暂未载入。</div>
        : <img className="spread-map-render" src={shot.image} alt="" onError={() => setFailedImage(shot.image)} />}
      <svg className="spread-world-svg" viewBox="0 0 1000 650" aria-hidden="true" focusable="false">
        <g className="spread-pin-lines">{points.map(place => {
          const [x, y, labelX, labelY] = shot.points[place.id];
          return <path key={place.id} data-selected={isSelected(place)} d={`M${x} ${y}L${labelX} ${labelY}`} />;
        })}</g>
        <g className="spread-pins">{points.map(place => {
          const [x, y] = shot.points[place.id];
          return <g key={place.id} data-selected={isSelected(place)}>
            <circle className="spread-pin-halo" cx={x} cy={y} r="12" />
            <circle className="spread-pin-dot" cx={x} cy={y} r="4" />
          </g>;
        })}</g>
      </svg>
      <div className="spread-map-buttons" role="group" aria-label="选择案例地点">
        {points.map(place => <button key={place.id} type="button"
          className="spread-map-place" data-place={place.id} aria-pressed={isSelected(place)}
          aria-label={`选择${place.name}案例`} aria-controls="spreadPlaceCard"
          style={{ left: `${shot.points[place.id][2] / 10}%`, top: `${shot.points[place.id][3] / 6.5}%` }}
          onClick={() => onSelect(place.placeId, place.photoIndex)}>
          <span className="spread-map-place-dot" aria-hidden="true" />{place.name}
        </button>)}
      </div>
    </div>
    </div>
    <div className="spread-map-actions">
      <span>0{levelIndex + 1} <i>/ 03</i></span>
      {levelIndex > 0 && <button type="button" className="spread-map-previous" onClick={() => onLevelChange(spreadMapLevels[levelIndex - 1].id)}>返回{spreadMapLevels[levelIndex - 1].name}</button>}
      {current.nextLabel ? <button type="button" className="spread-map-next" onClick={() => onLevelChange(spreadMapLevels[levelIndex + 1].id)}>{current.nextLabel}<span aria-hidden="true">→</span></button>
        : <button type="button" className="spread-map-next" onClick={() => onLevelChange('guangdong')}>回看广东<span aria-hidden="true">↗</span></button>}
    </div>
    <p className="spread-map-note">范围逐级展开，点位仅作案例索引。拍摄年份不表示传播先后。
      <span className="spread-map-attribution">地图为用户提供的三维场景示意，点位为近似位置。</span>
    </p>
  </section>;
}
