import { useEffect, useRef } from 'react';
import { media } from '../../config/media.js';
import { getStructureAtlasEntry } from '../../data/structure-atlas.js';

const folios = ['壹', '贰', '叁', '肆', '伍', '陆'];
const shortPartNames = { outer_shell: '狮头', eyes: '眉眼', mirror: '额饰', mouth: '狮嘴', fur_and_bells: '须毛', lion_cloth: '狮被' };

function StructurePartNavigation({ hotspots, selectedIndex, onSelect }) {
  const directoryRef = useRef(null);
  useEffect(() => {
    const directory = directoryRef.current;
    if (!directory) return undefined;
    const revealCurrent = () => {
      const current = directory.querySelector('[aria-current="true"]');
      if (!current || directory.scrollHeight <= directory.clientHeight) return;
      const directoryBounds = directory.getBoundingClientRect();
      const currentBounds = current.getBoundingClientRect();
      if (currentBounds.top < directoryBounds.top + 4) directory.scrollTop += currentBounds.top - directoryBounds.top - 4;
      else if (currentBounds.bottom > directoryBounds.bottom - 4) directory.scrollTop += currentBounds.bottom - directoryBounds.bottom + 4;
    };
    revealCurrent();
    const resizeObserver = new ResizeObserver(revealCurrent);
    resizeObserver.observe(directory);
    return () => resizeObserver.disconnect();
  }, [selectedIndex]);

  const navigateWithKeyboard = (event, index) => {
    let nextIndex;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') nextIndex = (index + 1) % hotspots.length;
    else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') nextIndex = (index - 1 + hotspots.length) % hotspots.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = hotspots.length - 1;
    else return;
    event.preventDefault();
    const buttons = event.currentTarget.closest('nav').querySelectorAll('button');
    buttons[nextIndex]?.focus({ preventScroll: true });
    onSelect?.(hotspots[nextIndex].id);
  };

  return (
    <nav className="structure-part-directory" aria-label="结构部件目录" ref={directoryRef}>
      <div className="structure-directory-heading" aria-hidden="true"><span>形制</span><span>目录</span></div>
      <ol>
        {hotspots.map((part, index) => (
          <li key={part.id}>
            <button type="button" className="interaction-cue" data-part-id={part.id}
              aria-label={`查看${part.name}`} aria-current={selectedIndex === index ? 'true' : undefined}
              aria-controls="modelDetailContent" tabIndex={selectedIndex === index ? 0 : -1}
              title={part.name} onClick={() => onSelect?.(part.id)}
              onKeyDown={(event) => navigateWithKeyboard(event, index)}>
              <span className="structure-directory-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              <span className="structure-directory-name">{shortPartNames[part.id] ?? part.name}</span>
            </button>
          </li>
        ))}
      </ol>
      <div className="structure-directory-position" role="progressbar" aria-label="图鉴页码"
        aria-valuemin={1} aria-valuemax={hotspots.length} aria-valuenow={selectedIndex + 1}
        aria-valuetext={`第${selectedIndex + 1}部件，共${hotspots.length}部件`}
        style={{ '--structure-directory-progress': `${((selectedIndex + 1) / hotspots.length) * 100}%` }}>
        <span aria-hidden="true">{String(selectedIndex + 1).padStart(2, '0')}<i> / {String(hotspots.length).padStart(2, '0')}</i></span>
        <b aria-hidden="true" />
      </div>
    </nav>
  );
}

function CloudMotif({ className = '' }) {
  return (
    <svg className={`structure-cloud ${className}`} viewBox="0 0 64 36" fill="none" aria-hidden="true">
      <path d="M5 27h43c8 0 11-5 11-10s-4-9-10-9c-2 0-4 1-6 3C41 4 35 2 30 4c-5 2-7 7-6 11-5-5-12-2-12 3 0 4 4 6 8 4" />
      <path d="M10 33h34M31 20c-2-5 2-9 6-8 4 1 5 6 1 8" />
    </svg>
  );
}

function DetailList({ entries }) {
  return (
    <dl className="structure-reading-list">
      {entries.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd id={label === '部位作用' ? 'panelFunction' : undefined}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function StructureReadingPanel({
  selected, selectedIndex, hotspots, focusState, detailScrollRef,
  onPrevious, onNext, onSelect, expressionLink, onObserve, artworkEnabled = true,
}) {
  const atlas = getStructureAtlasEntry(selected.id);
  const previous = hotspots[(selectedIndex - 1 + hotspots.length) % hotspots.length];
  const next = hotspots[(selectedIndex + 1) % hotspots.length];

  return (
    <aside className="info-panel structure-panel" id="structurePanel" aria-label="醒狮部件图鉴">
      <header className="structure-atlas-masthead">
        <div><CloudMotif /><span>岭南醒狮志 · 形制探微</span></div>
        <span lang="en">STRUCTURE</span>
      </header>

      <div className="structure-atlas-body">
        <StructurePartNavigation hotspots={hotspots} selectedIndex={selectedIndex} onSelect={onSelect} />
        <div className="model-detail-scroll" id="modelDetailContent" ref={detailScrollRef}
        tabIndex={0} aria-labelledby="structureTitle">
        <article className="structure-atlas-entry" key={selected.id} data-part-id={selected.id}>
          <div className="structure-atlas-hero">
            <figure className="structure-calligraphy">
              <img id="structureCalligraphy" src={artworkEnabled ? media[atlas.calligraphyKey] : undefined}
                alt={`${selected.name} · 朱砂书法「${atlas.character}」`}
                width="1024" height="1024" decoding="async" />
            </figure>
            <div className="structure-hero-margin" aria-hidden="true">
              <CloudMotif />
              <span>{selected.kicker.split('/').at(-1).trim()}</span>
            </div>
          </div>

          <div className="structure-part-heading">
            <h2 id="structureTitle" aria-live="polite"><span id="panelTitle">{selected.name}</span></h2>
            <p className="structure-poetic-subtitle">{atlas.subtitle}</p>
          </div>

          <div className="structure-introduction" aria-label="部件引言">
            {atlas.introduction.map((line) => <p key={line}>{line}</p>)}
          </div>

          <section className="structure-culture-section" aria-labelledby="structureFormHeading">
            <h3 id="structureFormHeading"><span aria-hidden="true">一</span>形制之美</h3>
            <p id="panelDescription">{selected.description}</p>
            <div className="structure-more-reading" data-reading="form">
              <DetailList entries={[
                ['组成', selected.structure.parts.join(' · ')],
                ['造型', selected.culture.form],
                ['部位作用', selected.function],
              ]} />
            </div>
          </section>

          <section className="structure-culture-section" aria-labelledby="structureCraftHeading">
            <h3 id="structureCraftHeading"><span aria-hidden="true">二</span>匠心之艺</h3>
            <p>{selected.structure.craft}</p>
            <div className="structure-more-reading" data-reading="craft">
              <p className="structure-material-note" id="panelMaterial">{selected.material}</p>
              <DetailList entries={[
                ['材料', selected.structure.material],
                ['连接', selected.structure.connection],
              ]} />
            </div>
          </section>

          <section className="structure-culture-section" aria-labelledby="structureCultureHeading">
            <h3 id="structureCultureHeading"><span aria-hidden="true">三</span>狮韵之意</h3>
            <p>{selected.culture.meaning}</p>
            <div className="structure-more-reading" data-reading="culture">
              <DetailList entries={[
                ['纹样', selected.culture.pattern],
              ]} />
            </div>
          </section>

          {expressionLink && <div className="model-expression-recommendation">
            <button type="button" className="interaction-cue" id="modelExpressionLink"
              onClick={() => onObserve?.({ ...expressionLink, returnPartId: selected.id })}>
              去神态页观察{expressionLink.name}态<span aria-hidden="true">↗</span>
            </button>
            <p>观察推荐，并非部位与情绪的固定对应。</p>
          </div>}

          <p className="structure-source" id="panelSource">{selected.sourceTag}</p>
          <aside className="structure-boundary" id="structureBoundary" aria-labelledby="structureBoundaryTitle">
            <h3 id="structureBoundaryTitle">模型与资料说明</h3>
            <p>当前展示来自用户提供的 Blender 醒狮模型，支持点选可见结构。纸扎内骨架、活动连接与制作工艺仅作资料说明，未展示内部拆装。本页六幅朱砂书法由 AI 辅助生成，用于展陈视觉。</p>
          </aside>
        </article>
        </div>
      </div>

      <footer className="structure-atlas-footer">
        <nav className="structure-folio-nav" aria-label="部件翻阅">
          <button type="button" className="interaction-cue" id="previousStructurePart" aria-label={`前一部件：${previous.name}`} onClick={onPrevious}>
            <span aria-hidden="true">←</span>前一部件
          </button>
          <p id="panelIndex" aria-label={`第${selectedIndex + 1}部件，共${hotspots.length}部件`}>
            <span>{folios[selectedIndex]}</span><i aria-hidden="true">/</i>{folios[hotspots.length - 1]}
          </p>
          <button type="button" className="interaction-cue" id="nextStructurePart" aria-label={`探下一处：${next.name}`} onClick={onNext}>
            探下一处<span aria-hidden="true">→</span>
          </button>
        </nav>
        <div className="structure-folio-note"><span>点击模型 · 翻阅形制</span><span>{focusState === 'overall' ? '整体视图' : '局部聚焦'}</span></div>
      </footer>
    </aside>
  );
}
