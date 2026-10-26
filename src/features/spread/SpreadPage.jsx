import { useState } from 'react';
import { media } from '../../config/media.js';
import { spreadPlaces, spreadMapPoints } from '../../data/spread.js';
import { homeCultureSources } from '../../data/home-culture.js';
import ChapterIdentity from '../../components/ChapterIdentity.jsx';
import SpreadMap from './SpreadMap.jsx';
import '../../styles/spread.css';

function SpreadPhoto({ story }) {
  const [failed, setFailed] = useState(false);
  const photo = story.photo;
  return <div className="spread-photo-frame">
    {failed || !media[photo.mediaKey]
      ? <div className="spread-photo-fallback" role="status"><span aria-hidden="true">狮</span><p>实景照片暂未载入</p><a href={photo.sourceUrl} target="_blank" rel="noreferrer">查看原始照片 ↗</a></div>
      : <img className="spread-photo" src={media[photo.mediaKey]} alt={photo.alt} width={photo.width} height={photo.height} decoding="async" onError={() => setFailed(true)} />}
  </div>;
}

export default function SpreadPage({ onNavigate, settings }) {
  const [mapLevel, setMapLevel] = useState('guangdong');
  const [selection, setSelection] = useState({ placeId: spreadPlaces[0].id, photoIndex: 0 });
  const place = spreadPlaces.find(item => item.id === selection.placeId) ?? spreadPlaces[0];
  const story = place.stories[selection.photoIndex] ?? place.stories[0];
  const selectPlace = (placeId, photoIndex = 0) => setSelection({ placeId, photoIndex });
  const changeMapLevel = nextLevel => {
    setMapLevel(nextLevel);
    setSelection(current => spreadMapPoints[nextLevel].some(point => point.placeId === current.placeId && (point.photoIndex === undefined || point.photoIndex === current.photoIndex))
      ? current : { placeId: spreadMapPoints[nextLevel][0].placeId, photoIndex: spreadMapPoints[nextLevel][0].photoIndex ?? 0 });
  };
  const changePhoto = delta => setSelection(current => ({ ...current, photoIndex: (current.photoIndex + delta + place.stories.length) % place.stories.length }));
  const typography = { '--spread-body-size': `${settings?.sourcesBodyFontSize ?? 17}px` };

  return <section id="spreadStage" className="spread-page" style={typography} aria-label="狮行远方 · 传章">
    <header className="spread-heading">
      <ChapterIdentity chapter="spread" title="狮行远方" eyebrow="A LIVING TRADITION" titleAs="h1" />
      <p>一方锣鼓，万里相逢。<br /><span>从广东到中国，再放眼世界。</span></p>
    </header>
    <div className="spread-layout">
      <SpreadMap activeId={place.id} photoIndex={selection.photoIndex} level={mapLevel} onSelect={selectPlace} onLevelChange={changeMapLevel} />
      <article id="spreadPlaceCard" className="spread-case" data-surface="spreadOverlay" aria-labelledby="spreadPlaceTitle">
        <header className="spread-place-heading">
          <div><p className="spread-place-kicker">{place.english}<span>{place.context}</span></p><div className="spread-place-title-row"><h2 id="spreadPlaceTitle">{place.name}</h2><span>{place.location}</span></div></div>
          <span className="spread-case-seal" aria-hidden="true">实景</span>
        </header>
        {story ? <>
          <figure className="spread-figure">
            <SpreadPhoto story={story} key={story.id} />
            <figcaption>
              <div className="spread-caption-top"><span className="spread-photo-caption">{story.photo.caption}</span><span className="spread-photo-year">拍摄年 · {place.photoYears[selection.photoIndex] ?? place.photoYears[0]}</span></div>
              <span className="spread-photo-credit">摄影：<a href={story.photo.sourceUrl} target="_blank" rel="noreferrer">{story.photo.author}</a>{' · '}<a href={story.photo.licenseUrl} target="_blank" rel="noreferrer">{story.photo.license}</a></span>
            </figcaption>
          </figure>
          <div className="spread-photo-controls">
            <span className="spread-photo-count">{String(selection.photoIndex + 1).padStart(2, '0')} / {String(place.stories.length).padStart(2, '0')}</span>
            <span className="spread-photo-controls-label">{place.stories.length > 1 ? '同地实景' : '一幅实景，一次相逢'}</span>
            {place.stories.length > 1 && <div><button type="button" aria-label="上一幅照片" onClick={() => changePhoto(-1)}>←</button><button type="button" aria-label="下一幅照片" onClick={() => changePhoto(1)}>→</button></div>}
          </div>
          <div className="spread-case-reading" role="region" aria-label={`${place.name}案例说明与资料`} tabIndex={0}>
            <h3>{story.title}</h3><p>{story.text}</p>
            <div className="spread-source-links">{story.sources.map(id => {
              const source = homeCultureSources.find(item => item.id === id);
              return source && <a key={id} href={source.url} target="_blank" rel="noreferrer">{source.label} ↗</a>;
            })}</div>
          </div>
        </> : <p className="spread-empty" role="status">此地案例资料暂未载入，请选择另一地点。</p>}
      </article>
    </div>
    <p className="sr-only" role="status">当前案例：{place.name}，第{selection.photoIndex + 1}幅，共{place.stories.length}幅。</p>
    <footer className="spread-closing"><div><h2>鼓声未远</h2><p>在一场相聚里，传统继续走向生活。</p></div><nav aria-label="传章去向"><button type="button" onClick={() => onNavigate?.('action')}>返回戏台 <span aria-hidden="true">↗</span></button><button type="button" onClick={() => onNavigate?.('entry')}>回到序章 <span aria-hidden="true">↗</span></button></nav></footer>
  </section>;
}
