import { chapters, chapterForRoute, navigationLabelMediaKeys } from '../config/chapters.js';
import { media } from '../config/media.js';
import NavigationIcon from './NavigationIcon.jsx';

export default function ChapterNav({ current, onNavigate, settingsOpen, settingsCancelOnly, onToggleSettings, settingsTriggerRef }) {
  const activeChapter = chapterForRoute(current);
  return <nav className="site-navigation" aria-label="作品章节导航">
    {chapters.map(({ route, label, description }) => (
      <button key={route} data-route={route} type="button"
        className={`site-nav-item${activeChapter === route ? ' is-current' : ''}`}
        onClick={() => onNavigate(route)} aria-label={label} title={label}
        aria-current={activeChapter === route ? 'page' : undefined}>
        <span className="site-nav-symbol">
          <NavigationIcon name={route} />
        </span>
        <span className="site-nav-copy">
          <span className="site-nav-heading">
            <strong aria-hidden="true">{label}</strong>
            <img className="site-nav-lettering" src={media[navigationLabelMediaKeys[route]]} alt="" aria-hidden="true" draggable="false" />
          </span>
          <span className="site-nav-description" aria-hidden={current !== 'entry' ? true : undefined}>{description}</span>
        </span>
      </button>
    ))}
    <button type="button" className={`site-nav-item site-nav-settings${settingsOpen ? ' is-settings-open' : ''}`}
      ref={settingsTriggerRef} data-action="settings" onClick={onToggleSettings}
      aria-label={settingsCancelOnly ? '返回视角设置，点击取消退出' : settingsOpen ? '收起开发者参数设置' : '打开开发者参数设置'}
      aria-expanded={settingsOpen} aria-controls="developerSettingsPanel">
      <span className="site-nav-symbol">
        <NavigationIcon name="settings" />
      </span>
      <span className="site-nav-copy">
        <span className="site-nav-heading">
          <strong aria-hidden="true">设置</strong>
          <img className="site-nav-lettering" src={media[navigationLabelMediaKeys.settings]} alt="" aria-hidden="true" draggable="false" />
        </span>
        <span className="site-nav-description" aria-hidden={current !== 'entry' ? true : undefined}>界面参数</span>
      </span>
    </button>
  </nav>;
}
