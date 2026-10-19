import { useState } from 'react';
import { media } from '../../config/media.js';
import { lionTypes, inheritors } from '../../data/home-heritage.js';
import { HeritageHeading, HeritageLinks, HeritageMotif, handleHeritageTabs } from './HeritageElements.jsx';
import '../../styles/home-heritage.css';

function TypeFigure({ type, pointId, onPoint }) {
  const [failed, setFailed] = useState(false);
  return <figure className="heritage-figure">
    <div className="heritage-type-image">
      {failed ? <div className="heritage-image-fallback"><HeritageMotif kind="horn" /><strong>{type.name}</strong><span>示意图暂不可用 · 仍可选择观察点阅读</span></div> :
        <img src={media[type.imageKey]} alt={`${type.name}水彩类型示意，非实物鉴定图`} width="1536" height="1024" loading="lazy" decoding="async" draggable="false" onError={() => setFailed(true)} />}
      {type.points.map((point, index) => <button key={point.id} className="heritage-hotspot" type="button" aria-label={point.label} aria-pressed={pointId === point.id} aria-controls={`type-${type.id}-observation`} style={{ left: `${point.x}%`, top: `${point.y}%` }} onFocus={() => onPoint(point.id)} onClick={() => onPoint(point.id)}><span aria-hidden="true">0{index + 1}</span></button>)}
    </div>
    <figcaption><span>类型示意 · AI辅助绘制</span><span>点选图中标记，细读狮艺</span></figcaption>
  </figure>;
}

export function HomeLionTypes() {
  const [typeId, setTypeId] = useState(lionTypes[0].id);
  const [pointId, setPointId] = useState(lionTypes[0].points[0].id);
  const type = lionTypes.find(item => item.id === typeId);
  const point = type.points.find(item => item.id === pointId);
  const select = index => { setTypeId(lionTypes[index].id); setPointId(lionTypes[index].points[0].id); };
  return <section id="homeLionTypes" className="home-heritage-section" aria-labelledby="lion-types-title">
    <div className="heritage-inner">
      <HeritageHeading id="lion-types-title" eyebrow="南风 · 狮谱 / FORMS OF THE SOUTHERN LION" title="一狮千面 · 认识广府醒狮">看形制，也看狮艺。从传统流派到融合形制，在眉眼与步履之间，读懂不同的神采。</HeritageHeading>
      <div className="heritage-tabs" role="tablist" aria-label="醒狮形制">{lionTypes.map((item, index) => <button type="button" role="tab" key={item.id} id={`type-tab-${item.id}`} aria-selected={typeId === item.id} aria-controls="lion-type-panel" tabIndex={typeId === item.id ? 0 : -1} onClick={() => select(index)} onKeyDown={event => handleHeritageTabs(event, index, lionTypes.length, select)}>{item.name}<small>{item.kind}</small></button>)}</div>
      <div id="lion-type-panel" role="tabpanel" aria-labelledby={`type-tab-${type.id}`} tabIndex={-1}>
        <article key={type.id} data-type-id={type.id} className="heritage-layout heritage-detail">
          <TypeFigure key={type.id} type={type} pointId={pointId} onPoint={setPointId} />
          <div className="heritage-copy archive-reading-panel" data-surface="cultureBody">
            <p className="heritage-kind">{type.kind}</p><h3>{type.name}</h3><p className="heritage-summary">{type.summary}</p>
            <div className="heritage-point-list" aria-label="观察重点">{type.points.map((item, index) => <button type="button" key={item.id} aria-pressed={pointId === item.id} onClick={() => setPointId(item.id)}><span>0{index + 1}</span>{item.label}</button>)}</div>
            <div id={`type-${type.id}-observation`} className="heritage-observation" aria-live="polite" aria-atomic="true"><h4>{point.label}</h4><p>{point.text}</p></div>
            <HeritageLinks ids={type.sourceIds} />
          </div>
        </article>
      </div>
      <div className="heritage-form-note"><p className="heritage-eyebrow">另一个观察维度 / 表演形式，不等同于流派</p><div>
        <article><HeritageMotif kind="drum" /><h3>传统地狮</h3><p>在地面与道具构成的场景中，以步法、神态和采青讲述狮子的行动。</p></article>
        <article><HeritageMotif kind="horn" /><h3>高桩表演</h3><p>以高桩为表演空间，突出腾跃、平衡与双人配合；不是另一种狮头流派。</p></article>
      </div><HeritageLinks ids={['performance-forms']} /></div>
    </div>
  </section>;
}

const groups = [{ id: 'all', label: '全部' }, { id: 'performance', label: '舞狮表演' }, { id: 'craft', label: '狮头扎作' }];

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
      <HeritageHeading id="inheritors-title" eyebrow="南风 · 传艺 / KEEPERS OF THE CRAFT" title="薪火相传 · 广府狮艺人物">一代人的坚守，成为下一代的起点。循着舞狮与扎作两条线索，认识让狮艺延续的人。</HeritageHeading>
      <div className="heritage-filters" role="group" aria-label="传承领域">{groups.map(item => <button key={item.id} type="button" aria-pressed={group === item.id} onClick={() => selectGroup(item.id)}>{item.label}</button>)}</div>
      <div className="heritage-person-choices" role="group" aria-label="选择传承人物">{visible.map((item, index) => <button key={item.id} type="button" className="heritage-person-choice" aria-label={`查看${item.name}档案`} aria-pressed={person.id === item.id} aria-controls="heritage-person-panel" onClick={() => setPersonId(item.id)}><span>0{index + 1}</span><strong>{item.name}</strong><small>{item.region}</small></button>)}</div>
      <article id="heritage-person-panel" key={person.id} data-person-id={person.id} className="heritage-layout heritage-detail">
        <figure className={`heritage-person-plaque is-${person.group}`} aria-label={`${person.name}姓名档案牌`}>
          <div className="heritage-plaque-paper"><p>{person.group === 'craft' ? '竹篾为骨 · 彩绘传神' : '锣鼓为韵 · 狮艺传心'}</p><HeritageMotif kind={person.group === 'craft' ? 'horn' : 'drum'} /><strong>{person.name}</strong><span>{person.project}</span><small>{person.region}</small></div>
          <figcaption>姓名档案牌 · 非人物肖像</figcaption>
        </figure>
        <div className="heritage-copy heritage-person-detail archive-reading-panel" data-surface="cultureBody">
          <p className="heritage-kind">{person.group === 'craft' ? '狮头扎作' : '舞狮表演'} · {person.region}</p><h3>{person.name}</h3>
          <p className="heritage-person-level">{person.level}{person.recognition && <span> · {person.recognition}</span>}</p><p className="heritage-project">{person.project}</p>
          <p className="heritage-summary">{person.intro}</p><ul className="heritage-contributions">{person.contributions.map(text => <li key={text}>{text}</li>)}</ul>
          <div className="heritage-relation"><h4>有据可查的传承关系</h4><p>{person.relation}</p></div><HeritageLinks ids={person.sourceIds} />
        </div>
      </article>
      <p className="heritage-editorial-note">六位代表人物的代际档案，非完整名录。认定级别、认定批次与师承代数分别记录；舞狮表演和狮头扎作属于不同项目。</p>
    </div>
  </section>;
}
