import { useState } from 'react';
import { media } from '../../config/media.js';
import { spreadMapLevels, spreadMapPoints } from '../../data/spread.js';
import { handleHeritageTabs } from '../home/HeritageElements.jsx';
import useSpreadMapMotion from './useSpreadMapMotion.js';

// Pin dots are image-calibrated overlays on the Blender renders; canonical
// city coordinates remain in spread.js. Stamp labels stay offset for legibility.
const shots = {
  guangdong: {
    image: media.spreadMapGuangdong,
    points: {
      foshan: [468, 323, 340, 365],
      guangzhou: [505, 293, 600, 220],
      heshan: [455, 344, 580, 430],
      suixi: [222, 458, 280, 525],
    },
  },
  china: {
    image: media.spreadMapChina,
    points: {
      beijing: [628, 198, 720, 145],
      tianyang: [532, 368, 430, 420],
      quanzhou: [662, 357, 760, 425],
      'hong-kong': [612, 382, 865, 520],
    },
  },
  world: {
    image: media.spreadMapWorld,
    points: {
      singapore: [755, 314, 820, 415],
      'kuala-lumpur': [749, 310, 675, 415],
      'san-francisco': [200, 225, 120, 315],
      london: [500, 191, 555, 100],
    },
  },
};

export default function SpreadMap({ activeId, level, onSelect, onLevelChange, settings }) {
  const levelIndex = spreadMapLevels.findIndex(item => item.id === level);
  const current = spreadMapLevels[levelIndex];
  const frameRate = settings?.spreadMapFrameRate === 24 ? 24 : 60;
  const playbackRate = settings?.spreadMapPlaybackRate ?? 1;
  const { videosRef, displayLevel, motion, visibleVideo } = useSpreadMapMotion(level, frameRate, playbackRate);
  const points = spreadMapPoints[displayLevel];
  const inMotion = motion === 'loading' || motion === 'moving';
  const isSelected = point => point.placeId === activeId;
  const shot = shots[displayLevel];
  const [failedImage, setFailedImage] = useState(null);
  return <section className="spread-map" aria-labelledby="spreadMapTitle" data-map-level={level} data-map-motion={motion} data-map-frame-rate={frameRate}>
    <div className="spread-map-heading">
      <h3 id="spreadMapTitle">所收录案例分布示意</h3>
      <span>{current.collection} · {current.count}</span>
    </div>
    <div className="spread-level-tabs" role="tablist" aria-label="地图范围">
      {spreadMapLevels.map((item, index) => <button key={item.id} type="button" role="tab" id={`spread-level-${item.id}`}
        aria-label={item.name} aria-selected={level === item.id} aria-controls="spreadMapView" tabIndex={level === item.id ? 0 : -1}
        onClick={() => onLevelChange(item.id)} onKeyDown={event => handleHeritageTabs(event, index, spreadMapLevels.length, next => onLevelChange(spreadMapLevels[next].id))}>
        <small aria-hidden="true">0{index + 1}</small><span>{item.name}</span><i aria-hidden="true">{item.subtitle}</i>
      </button>)}
    </div>
    <div className="spread-map-viewport" id="spreadMapView" role="tabpanel" aria-labelledby={`spread-level-${level}`}>
      <div className="spread-world" data-motion={motion} aria-busy={inMotion}>
        {[
          ['forward', 24, media.spreadMapMotionForward], ['reverse', 24, media.spreadMapMotionReverse],
          ['forward', 60, media.spreadMapMotionForward60], ['reverse', 60, media.spreadMapMotionReverse60],
        ].map(([direction, fps, src]) => {
          const key = `${direction}-${fps}`;
          return <video key={key} ref={element => { if (element) videosRef.current[key] = element; else delete videosRef.current[key]; }}
            className="spread-map-video" data-direction={direction} data-frame-rate={fps} data-visible={visibleVideo === key}
            src={src} muted playsInline preload={fps === frameRate ? 'auto' : 'none'} aria-hidden="true" />;
        })}
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
        <div className="spread-map-buttons" role="group" aria-label="选择城市邮票" aria-hidden={inMotion} inert={inMotion || undefined}>
          {points.map(place => <button key={place.id} type="button"
            className="spread-map-place" data-place={place.id} data-serial={place.serial} aria-pressed={isSelected(place)}
            aria-label={`选择${place.name}邮票`} aria-controls="spreadPlaceCard"
            style={{ left: `${shot.points[place.id][2] / 10}%`, top: `${shot.points[place.id][3] / 6.5}%` }}
            onClick={() => onSelect(place.placeId, place.photoIndex)}>
            <span className="spread-map-place-serial" aria-hidden="true">{place.serial}</span>
            <span className="spread-map-place-name">{place.name}</span>
          </button>)}
        </div>
      </div>
    </div>
    <span className="sr-only" role="status">{inMotion ? '地图镜头移动中' : motion === 'failed' ? '地图动画未能载入，已显示静态画面' : ''}</span>
    <div className="spread-map-actions">
      <span>0{levelIndex + 1} <i>/ 03</i></span>
      {levelIndex > 0 && <button type="button" className="spread-map-previous" onClick={() => onLevelChange(spreadMapLevels[levelIndex - 1].id)}>返回{spreadMapLevels[levelIndex - 1].name}</button>}
      {current.nextLabel ? <button type="button" className="spread-map-next" onClick={() => onLevelChange(spreadMapLevels[levelIndex + 1].id)}>{current.nextLabel}<span aria-hidden="true">→</span></button>
        : <button type="button" className="spread-map-next" onClick={() => onLevelChange('guangdong')}>回看广东<span aria-hidden="true">↗</span></button>}
    </div>
    <p className="spread-map-note">每个范围显示本组四个地点；点位仅作案例索引，拍摄年份不表示传播先后。
      <span className="spread-map-attribution">地图为用户提供的三维场景示意，点位为近似位置。</span>
    </p>
  </section>;
}
