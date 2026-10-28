import { useState } from 'react';
import { HomeLionTypes } from '../home/HomeHeritage.jsx';
import { handleHeritageTabs } from '../home/HeritageElements.jsx';
import CraftSection from './CraftSection.jsx';
import AtlasExperience from './atlas/AtlasExperience.jsx';
import '../../styles/model-journey.css';

const readingTabs = [{ id: 'form', label: '观形' }, { id: 'types', label: '形制' }, { id: 'craft', label: '工艺' }];

export default function ModelPage({ active = true, onReady, onPartChange, lightingSettings }) {
  const [readingTab, setReadingTab] = useState('form');
  return <section id="modelStage" className="model-stage model-journey" data-chapter="model"
    data-reading-tab={readingTab} aria-label="醒狮整体与结构">
    <div className="model-journey-bar">
      <p className="model-journey-intro">从形入艺<span>一头狮，三重观看</span></p>
      <div className="model-reading-tabs" role="tablist" aria-label="造章局部阅读">
        {readingTabs.map((tab, index) => <button key={tab.id} type="button" role="tab"
          id={`model-reading-tab-${tab.id}`} aria-selected={readingTab === tab.id}
          aria-controls={`model-reading-panel-${tab.id}`} tabIndex={readingTab === tab.id ? 0 : -1}
          onClick={() => setReadingTab(tab.id)}
          onKeyDown={event => handleHeritageTabs(event, index, readingTabs.length, next => setReadingTab(readingTabs[next].id))}>
          <small aria-hidden="true">0{index + 1}</small>{tab.label}
        </button>)}
      </div>
    </div>
    <div id="model-reading-panel-form" className="model-journey-panel model-form-panel" role="tabpanel"
      aria-labelledby="model-reading-tab-form" hidden={readingTab !== 'form'}>
      <AtlasExperience active={active && readingTab === 'form'} onReady={onReady}
        onPartChange={onPartChange} lightingSettings={lightingSettings} />
    </div>
    <div id="model-reading-panel-types" className="model-journey-panel model-types-panel" role="tabpanel"
      aria-labelledby="model-reading-tab-types" tabIndex={0} hidden={readingTab !== 'types'}><HomeLionTypes /></div>
    <div id="model-reading-panel-craft" className="model-journey-panel model-craft-panel" role="tabpanel"
      aria-labelledby="model-reading-tab-craft" tabIndex={0} hidden={readingTab !== 'craft'}>
      <CraftSection active={active && readingTab === 'craft'} settings={lightingSettings} />
    </div>
  </section>;
}
