import { useLayoutEffect, useRef, useState } from 'react';
import { media } from '../../config/media.js';
import { lionTypes, inheritors } from '../../data/home-heritage.js';
import { inheritorPhotos } from '../../data/inheritor-photos.js';
import { HeritageLinks, HeritageMotif, handleHeritageTabs } from './HeritageElements.jsx';
import LionArchiveOrnament from './LionArchiveOrnament.jsx';
import '../../styles/home-heritage.css';

function HeritageTitle({ id, title, children }) {
  return <header className="heritage-heading archive-reading-panel" data-surface="cultureTitle">
    <div className="lion-archive-title-line"><h2 id={id}>{title}</h2><LionArchiveOrnament kind={id === 'lion-types-title' ? 'peeking' : 'paw'} /></div>
    <p className="heritage-lead">{children}</p>
  </header>;
}

function TypeFigure({ type, expanded, onExpand, buttonRef }) {
  const [failed, setFailed] = useState(false);
  return <figure className="heritage-figure">
    <button ref={buttonRef} className="heritage-type-image" type="button" aria-label={`展开${type.name}介绍`} aria-expanded={expanded} aria-controls={`type-${type.id}-description`} onClick={onExpand}>
      {failed ? <span className="heritage-image-fallback"><HeritageMotif kind="horn" /><strong>{type.name}</strong><span>示意图暂不可用 · 点击阅读介绍</span></span> :
        <img src={media[type.imageKey]} alt={`${type.name}水彩类型示意，非实物鉴定图`} width="1536" height="1024" loading="lazy" decoding="async" draggable="false" onError={() => setFailed(true)} />}
    </button>
    <figcaption><span>类型示意 · AI辅助绘制</span>{!expanded && <span>点击图片，展开介绍</span>}</figcaption>
  </figure>;
}

export function HomeLionTypes() {
  const [typeId, setTypeId] = useState(lionTypes[0].id);
  const [expanded, setExpanded] = useState(false);
  const imageButton = useRef(null);
  const restoreImageFocus = useRef(false);
  const type = lionTypes.find(item => item.id === typeId);
  const select = index => { setTypeId(lionTypes[index].id); setExpanded(false); };
  const collapse = () => { restoreImageFocus.current = true; setExpanded(false); };
  useLayoutEffect(() => {
    if (expanded || !restoreImageFocus.current) return;
    restoreImageFocus.current = false;
    const button = imageButton.current;
    if (!button) return;
    button.focus({ preventScroll: true });
    const bounds = button.getBoundingClientRect();
    const header = document.querySelector('.site-header')?.getBoundingClientRect().bottom ?? 0;
    if (bounds.top < header + 12 || bounds.bottom > innerHeight - 12) {
      window.scrollTo({ top: scrollY + bounds.top - header - 24, behavior: 'instant' });
    }
  }, [expanded]);
  return <section id="homeLionTypes" className="home-heritage-section" aria-labelledby="lion-types-title">
    <div className="heritage-inner">
      <HeritageTitle id="lion-types-title" title="一狮千面 · 认识广府醒狮">看形制，也看狮艺。从传统流派到融合形制，在眉眼与步履之间，读懂不同的神采。</HeritageTitle>
      <div className="heritage-tabs" role="tablist" aria-label="醒狮形制">{lionTypes.map((item, index) => <button type="button" role="tab" key={item.id} id={`type-tab-${item.id}`} aria-selected={typeId === item.id} aria-controls="lion-type-panel" tabIndex={typeId === item.id ? 0 : -1} onClick={() => select(index)} onKeyDown={event => handleHeritageTabs(event, index, lionTypes.length, select)}>{item.name}<small>{item.kind}</small></button>)}</div>
      <div id="lion-type-panel" role="tabpanel" aria-labelledby={`type-tab-${type.id}`} tabIndex={-1}>
        <article key={type.id} data-type-id={type.id} className={`heritage-layout heritage-type-reveal${expanded ? ' is-expanded' : ''}`} onKeyDown={event => { if (event.key === 'Escape' && expanded) { event.preventDefault(); event.stopPropagation(); collapse(); } }}>
          <TypeFigure key={type.id} type={type} expanded={expanded} onExpand={() => setExpanded(true)} buttonRef={imageButton} />
          <div id={`type-${type.id}-description`} className="heritage-copy heritage-type-copy archive-reading-panel" data-surface="cultureBody" hidden={!expanded}>
            <button className="heritage-collapse" type="button" onClick={collapse}>收起介绍</button>
            <p className="heritage-kind">{type.kind}</p><h3>{type.name}</h3><p className="heritage-summary">{type.summary}</p>
            <ul className="heritage-observations" aria-label="观察重点">{type.points.map(item => <li key={item.id}><h4>{item.label}</h4><p>{item.text}</p></li>)}</ul>
            <HeritageLinks ids={type.sourceIds} />
          </div>
        </article>
      </div>
      <div className="heritage-form-note"><p className="heritage-eyebrow">表演形式，不等同于流派</p><div>
        <article><HeritageMotif kind="drum" /><h3>传统地狮</h3><p>在地面与道具构成的场景中，以步法、神态和采青讲述狮子的行动。</p></article>
        <article><HeritageMotif kind="horn" /><h3>高桩表演</h3><p>以高桩为表演空间，突出腾跃、平衡与双人配合；不是另一种狮头流派。</p></article>
      </div><HeritageLinks ids={['performance-forms']} /></div>
    </div>
  </section>;
}

const groups = [{ id: 'all', label: '全部' }, { id: 'performance', label: '舞狮表演' }, { id: 'craft', label: '狮头扎作' }];

function InheritorFigure({ person }) {
  const [failed, setFailed] = useState(false);
  const photo = inheritorPhotos[person.id];
  const hasPhoto = photo?.src && photo.sourceUrl && photo.credit && photo.alt && photo.rights;
  const showPhoto = import.meta.env.DEV && new URLSearchParams(window.location.search).get('researchPhotos') === '1' && hasPhoto && !failed;
  return <figure className={showPhoto ? 'heritage-person-photo' : `heritage-person-plaque archive-reading-panel is-${person.group}`} data-surface={showPhoto ? undefined : 'cultureBody'} aria-label={showPhoto ? `${person.name}照片` : `${person.name}姓名档案牌`}>
    {showPhoto ? <img src={`${import.meta.env.BASE_URL}${photo.src.replace(/^\.\//, '')}`} alt={photo.alt} loading="lazy" decoding="async" onError={() => setFailed(true)} /> :
      <div className="heritage-plaque-paper"><HeritageMotif kind={person.group === 'craft' ? 'horn' : 'drum'} /><strong>{person.name}</strong><span>{person.project}</span><small>{person.region}</small></div>}
    <figcaption>{!showPhoto && <span>姓名档案牌 · 非人物肖像</span>}{hasPhoto && <>{showPhoto && <span>{photo.credit} · {photo.rights}</span>}<a href={photo.sourceUrl} target="_blank" rel="noreferrer">照片来源 <span aria-hidden="true">↗</span></a></>}</figcaption>
  </figure>;
}

export function HomeInheritors() {
  const [group, setGroup] = useState('all');
  const [personId, setPersonId] = useState(inheritors[0].id);
  const visible = inheritors.filter(person => group === 'all' || person.group === group);
  const person = visible.find(item => item.id === personId) || visible[0];
  const selectGroup = id => {
    setGroup(id);
    const items = inheritors.filter(item => id === 'all' || item.group === id);
    if (!items.some(item => item.id === personId)) setPersonId(items[0].id);
  };
  return <section id="homeInheritors" className="home-heritage-section" aria-labelledby="inheritors-title">
    <div className="heritage-inner">
      <HeritageTitle id="inheritors-title" title="薪火相传 · 广府狮艺人物">一代人的坚守，成为下一代的起点。循着舞狮与扎作两条线索，认识让狮艺延续的人。</HeritageTitle>
      <div className="heritage-filters" role="group" aria-label="传承领域">{groups.map(item => <button key={item.id} type="button" aria-pressed={group === item.id} onClick={() => selectGroup(item.id)}>{item.label}</button>)}</div>
      <div className="heritage-person-choices" role="group" aria-label="选择传承人物">{visible.map(item => <button key={item.id} type="button" className="heritage-person-choice" aria-label={`查看${item.name}档案`} aria-pressed={person.id === item.id} aria-controls="heritage-person-panel" onClick={() => setPersonId(item.id)}><strong>{item.name}</strong><small>{item.region}</small></button>)}</div>
      <article id="heritage-person-panel" key={person.id} data-person-id={person.id} className="heritage-layout heritage-detail">
        <InheritorFigure key={person.id} person={person} />
        <div className="heritage-copy heritage-person-detail archive-reading-panel" data-surface="cultureBody">
          <p className="heritage-kind">{person.group === 'craft' ? '狮头扎作' : '舞狮表演'} · {person.region}</p><h3>{person.name}</h3>
          <p className="heritage-person-level">{person.level}{person.recognition && <span> · {person.recognition}</span>}</p><p className="heritage-project">{person.project}</p>
          <p className="heritage-summary">{person.intro}</p><ul className="heritage-contributions">{person.contributions.map(text => <li key={text}>{text}</li>)}</ul>
          <div className="heritage-relation"><h4>有据可查的传承关系</h4><p>{person.relation}</p></div><HeritageLinks ids={person.sourceIds} />
        </div>
      </article>
      <p className="heritage-editorial-note">代表人物选编，非完整名录。认定批次不等于师承代数；舞狮与扎作分属不同项目。</p>
    </div>
  </section>;
}
