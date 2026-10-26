import { media } from '../../config/media.js';
import { homeCultureSources, homeCultureStories } from '../../data/home-culture.js';
import { heritageSources } from '../../data/home-heritage.js';
import { lionBookPages } from '../../data/lion-book.js';
import { HeritageMotif } from './HeritageElements.jsx';
import { PhotoCredit } from './HomeCulture.jsx';
import LionArchiveOrnament from './LionArchiveOrnament.jsx';
import '../../styles/home-exhibit-content.css';

// The three featured cards stay; the grouped index only adds unique URLs.
const indexedUrls = new Set(homeCultureSources.map(source => source.url));
const additionalSources = [
  ...lionBookPages.flatMap(page => [{ id: `book-${page.id}`, group: 'history', title: page.source, publisher: '史册资料', url: page.sourceUrl }, ...(page.additionalSource ? [{ id: `book-${page.id}-additional`, group: 'history', title: page.additionalSource.label, publisher: '史册补充', url: page.additionalSource.url }] : [])]),
  ...heritageSources.filter(source => source.group === 'types'),
].filter(source => {
  if (indexedUrls.has(source.url)) return false;
  indexedUrls.add(source.url);
  return true;
});

export default function HomeCultureSources({ settings }) {
  const typography = {
    '--sources-title-size': `${settings?.sourcesTitleFontSize ?? 32}px`,
    '--sources-body-size': `${settings?.sourcesBodyFontSize ?? 18}px`,
    '--sources-meta-size': `${settings?.sourcesMetaFontSize ?? 16}px`,
  };
  return <div className="heritage-sources-wrap" style={typography}><div className="heritage-inner">
    <footer id="homeCultureSources" className="home-culture-sources" data-surface="cultureSources" aria-labelledby="culture-sources-title">
      <div className="home-culture-sources-heading">
        <span className="home-culture-sources-emblem" aria-hidden="true"><img src={media.archiveOrnamentPaw} alt="" width="40" height="40" loading="lazy" decoding="async" /><svg viewBox="0 0 56 56" fill="none"><path d="M8 13c8-3 15-2 20 3 5-5 12-6 20-3v31c-8-3-15-2-20 2-5-4-12-5-20-2ZM28 16v30M14 22l9 2m-9 5 9 2m10-7 9-2m-9 9 9-2" /></svg></span>
        <div className="heritage-sources-title"><div><h2 id="culture-sources-title">参考资料</h2><LionArchiveOrnament /></div></div>
        <p className="home-culture-sources-intro">滚动各栏，查阅完整资料与许可。</p>
      </div>
      <div className="exhibit-sources-body">
      <div className="exhibit-source-scroll exhibit-references" role="region" aria-label="参考文献与文化资料" tabIndex={0}>
      <div className="home-culture-source-cards">{homeCultureSources.map((source, index) => <a className="home-culture-source-card interaction-cue" data-surface="cultureSourceCard" key={source.url} href={source.url} target="_blank" rel="noreferrer">
        <span className="home-culture-source-number"><span>0{index + 1}</span><HeritageMotif kind={['horn','drum','pompom'][index]} /><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12" /></svg></span>
        <span className="home-culture-source-publisher">{source.label}</span><strong>{source.title}</strong><span className="home-culture-source-description">{source.description}</span>
      </a>)}</div>
      <div className="heritage-source-groups">{[['history', '历史与文化', 'drum'], ['types', '形制与工艺', 'horn']].map(([group, title, motif]) => <section key={group} className="heritage-source-group" aria-label={title}><h3><HeritageMotif kind={motif} />{title}</h3><ul>{additionalSources.filter(source => source.group === group).map(source => <li key={source.id}><a className="interaction-cue" href={source.url} target="_blank" rel="noreferrer"><span>{source.title}</span><small>{source.publisher} ↗</small></a></li>)}</ul></section>)}</div>
      </div>
      <div className="exhibit-source-scroll exhibit-licenses" role="region" aria-label="摄影与工程许可" tabIndex={0}>
      <section className="home-culture-photo-licenses" aria-labelledby="photo-licenses-title">
        <h3 id="photo-licenses-title" className="heritage-license-label"><HeritageMotif />摄影署名与许可</h3>
        <div className="home-culture-photo-license-grid">{homeCultureStories.map(story => <div key={story.id} className="home-culture-photo-license"><span>{story.index}</span><div><p>{story.photo.caption}</p><PhotoCredit photo={story.photo} /></div></div>)}</div>
      </section>
      <section className="archive-provenance" aria-labelledby="archive-provenance-title">
        <h3 id="archive-provenance-title">图像说明与工程许可</h3>
        <p>书册水彩与三幅类型图为AI辅助示意，不作为历史或实物鉴定证据。年代为叙事分期，文化传承延续交叠。神态页是本项目的八态定性观察框架，不宣称所有流派采用同一分类，也不提供情绪评分。</p>
        <p>实景摄影按各自Creative Commons许可使用，保留作者、原始来源与许可链接。<br /><a className="interaction-cue" href={media.lionBookLicense} target="_blank" rel="noreferrer">Sketchbook · ThreeUI / MIT</a>{' · '}<a className="interaction-cue" href={media.lionBookFontLicense} target="_blank" rel="noreferrer">字体许可</a></p>
      </section>
      </div>
      </div>
    </footer>
  </div></div>;
}
