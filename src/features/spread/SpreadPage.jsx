import { useState } from 'react';
import { spreadPlaces, spreadMapLevels, spreadMapPoints } from '../../data/spread.js';
import ChapterIdentity from '../../components/ChapterIdentity.jsx';
import SpreadMap from './SpreadMap.jsx';
import SpreadStampBoard from './SpreadStampBoard.jsx';
import '../../styles/spread.css';

export default function SpreadPage({ onNavigate, settings, onStampPreviewReady }) {
  const [mapLevel, setMapLevel] = useState('guangdong');
  const [selectedId, setSelectedId] = useState(spreadPlaces[0].id);
  const place = spreadPlaces.find(item => item.id === selectedId) ?? spreadPlaces[0];
  const selectPlace = id => {
    if (spreadMapPoints[mapLevel].some(point => point.placeId === id)) setSelectedId(id);
  };
  const changeMapLevel = nextLevel => {
    if (!spreadMapLevels.some(level => level.id === nextLevel)) return;
    setMapLevel(nextLevel);
    setSelectedId(current => spreadMapPoints[nextLevel].some(point => point.placeId === current)
      ? current : spreadMapPoints[nextLevel][0].placeId);
  };
  return <section id="spreadStage" className="spread-page spread-page--stamps" aria-label="狮行远方 · 传章">
    <header className="spread-heading">
      <ChapterIdentity chapter="spread" title="狮行远方" eyebrow="A LIVING TRADITION" titleAs="h1" />
      <p>狮行万里 · 从岭南到世界<br /><span>FROM LINGNAN TO THE WORLD</span></p>
    </header>
    <div className="spread-layout">
      <SpreadMap activeId={place.id} level={mapLevel} settings={settings} onSelect={selectPlace} onLevelChange={changeMapLevel} />
      <SpreadStampBoard level={mapLevel} selectedPlaceId={place.id} onSelect={selectPlace} settings={settings} onPreviewReady={onStampPreviewReady} />
    </div>
    <p className="sr-only" role="status">当前城市：{place.name}，地图与地域邮票对应。</p>
    <footer className="spread-closing"><div><h2>鼓声未远</h2><p>在一场相聚里，传统继续走向生活。</p></div><nav aria-label="传章去向"><button type="button" onClick={() => onNavigate?.('action')}>返回戏台 <span aria-hidden="true">↗</span></button><button type="button" onClick={() => onNavigate?.('entry')}>回到序章 <span aria-hidden="true">↗</span></button></nav></footer>
  </section>;
}
