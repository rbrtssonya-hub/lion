import { useState } from 'react';
import { media } from '../../config/media.js';
import { homeCultureSources, homeCultureStories } from '../../data/home-culture.js';

const story = homeCultureStories.find(item => item.id === 'lion-head-craft');
const source = homeCultureSources.find(item => item.id === 'fut-hok-craft');
const stages = [
  { name: '扎', line: '立起形的轮廓' },
  { name: '扑', line: '承接面的塑造' },
  { name: '画', line: '让色与纹传神' },
  { name: '装', line: '完成外观装饰' },
];

export default function CraftSection() {
  const [failed, setFailed] = useState(false);
  const { photo } = story;
  return <section className="model-craft" aria-labelledby="model-craft-title">
    <figure className="model-craft-figure">
      <div className="model-craft-photo">
        {failed ? <div className="model-craft-fallback" role="status"><span aria-hidden="true">狮</span><p>实景照片暂不可用</p><small>右侧工艺线索与下方来源仍可阅读</small></div> :
          <img src={media[photo.mediaKey]} width={photo.width} height={photo.height} alt={photo.alt}
            loading="lazy" decoding="async" onError={() => setFailed(true)} />}
        <span className="model-craft-photo-label">完成品实景</span>
      </div>
      <figcaption>
        <strong>{photo.caption}</strong>
        <span>摄影：{photo.author} · 等比展示</span>
        <span className="model-craft-photo-links"><a href={photo.sourceUrl} target="_blank" rel="noreferrer">照片来源</a><a href={photo.licenseUrl} target="_blank" rel="noreferrer">{photo.license}</a></span>
      </figcaption>
    </figure>
    <div className="model-craft-reading">
      <header>
        <p className="model-craft-eyebrow">狮头工艺 · 从制作线索看外观</p>
        <h2 id="model-craft-title">扎、扑、画、装</h2>
        <p className="model-craft-lead">一扎一画，狮有了神采</p>
      </header>
      <p className="model-craft-description">{story.text}</p>
      <ol className="model-craft-stages" aria-label="狮头制作的四工序概念顺序">
        {stages.map((stage, index) => <li key={stage.name}>
          <span className="model-craft-stage-index" aria-hidden="true">0{index + 1}</span>
          <strong>{stage.name}</strong><span>{stage.line}</span>
        </li>)}
      </ol>
      <p className="model-craft-sequence-note">四工序概念线索 · 结合成品观察，不作为制作操作图。</p>
      <div className="model-craft-source">
        <span>工艺资料</span><a href={source.url} target="_blank" rel="noreferrer">{source.label} · {source.title} ↗</a>
      </div>
      <p className="model-craft-note">{story.note}</p>
    </div>
  </section>;
}
