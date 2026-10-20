import { media } from '../../config/media.js';
import { homeCultureSources, homeCultureStories } from '../../data/home-culture.js';
import { heritageSources } from '../../data/home-heritage.js';
import { HeritageMotif } from './HeritageElements.jsx';
import { PhotoCredit } from './HomeCulture.jsx';
import LionArchiveOrnament from './LionArchiveOrnament.jsx';

export default function HomeCultureSources() {
  return <div className="heritage-sources-wrap"><div className="heritage-inner">
    <footer id="homeCultureSources" className="home-culture-sources" data-surface="cultureSources" aria-labelledby="culture-sources-title">
      <div className="home-culture-sources-heading">
        <span className="home-culture-sources-emblem" aria-hidden="true"><img src={media.archiveOrnamentPaw} alt="" width="40" height="40" loading="lazy" decoding="async" /><svg viewBox="0 0 56 56" fill="none"><path d="M8 13c8-3 15-2 20 3 5-5 12-6 20-3v31c-8-3-15-2-20 2-5-4-12-5-20-2ZM28 16v30M14 22l9 2m-9 5 9 2m10-7 9-2m-9 9 9-2" /></svg></span>
        <div className="heritage-sources-title"><div><h2 id="culture-sources-title">参考资料</h2><LionArchiveOrnament /></div></div>
        <p className="home-culture-sources-intro">循着资料，读到更深处。</p>
      </div>
      <div className="home-culture-source-cards">{homeCultureSources.map((source, index) => <a className="home-culture-source-card" data-surface="cultureSourceCard" key={source.url} href={source.url} target="_blank" rel="noreferrer">
        <span className="home-culture-source-number"><span>0{index + 1}</span><HeritageMotif kind={['horn','drum','pompom'][index]} /><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12" /></svg></span>
        <span className="home-culture-source-publisher">{source.label}</span><strong>{source.title}</strong><span className="home-culture-source-description">{source.description}</span>
      </a>)}</div>
      <div className="heritage-source-groups"><section className="heritage-source-group" aria-label="种类资料"><h3><HeritageMotif kind="horn" />种类资料</h3><ul>{heritageSources.filter(source => source.group === 'types').map(source => <li key={source.id}><a href={source.url} target="_blank" rel="noreferrer"><span>{source.title}</span><small>{source.publisher} ↗</small></a></li>)}</ul></section></div>
      <details className="home-culture-photo-licenses">
        <summary><span className="heritage-license-label"><HeritageMotif /><span>摄影署名与许可</span></span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></summary>
        <div className="home-culture-photo-license-grid">{homeCultureStories.map(story => <div key={story.id} className="home-culture-photo-license"><span>{story.index}</span><div><p>{story.photo.caption}</p><PhotoCredit photo={story.photo} /></div></div>)}</div>
      </details>
      <details className="archive-provenance">
        <summary>图像说明与工程许可</summary>
        <p>书册水彩与三幅类型图为AI辅助示意，不作为历史或实物鉴定证据。年代为叙事分期，文化传承延续交叠。</p>
        <p>实景摄影按各自Creative Commons许可使用，保留作者、原始来源与许可链接。<br /><a href={media.lionBookLicense} target="_blank" rel="noreferrer">Sketchbook · ThreeUI / MIT</a>{' · '}<a href={media.lionBookFontLicense} target="_blank" rel="noreferrer">字体许可</a></p>
      </details>
      <div className="heritage-source-cloud" aria-hidden="true"><svg viewBox="0 0 220 28" fill="none"><path d="M1 23h218M78 18c-10-9 1-18 10-13 3-8 17-5 18 3 12-5 24 5 18 12M79 18h62c10 0 10-12 1-12-4-6-11-5-14 0M96 17c-7-8 9-12 9-3" /></svg></div>
    </footer>
  </div></div>;
}
