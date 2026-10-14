import { chapters } from '../config/chapters.js';
import NavigationIcon from './NavigationIcon.jsx';
import NavigationSurface from './NavigationSurface.jsx';

export default function ChapterNav({ current, onNavigate, settingsOpen, onToggleSettings, settingsTriggerRef }) {
  return <nav className="site-navigation" aria-label="作品章节导航">
    <NavigationSurface />
    {chapters.map(({ route, label, description }) => (
      <button key={route} data-route={route} type="button"
        className={`site-nav-item${current === route ? ' is-current' : ''}`}
        onClick={() => onNavigate(route)} aria-label={label} title={label}
        aria-hidden={current !== 'entry' && route === 'entry' ? true : undefined}
        tabIndex={current !== 'entry' && route === 'entry' ? -1 : undefined}
        aria-current={current === route ? 'page' : undefined}>
        <span className="site-nav-symbol">
          <NavigationIcon name={route} />
          <span className="site-nav-short-label" aria-hidden="true">{label}</span>
        </span>
        <span className="site-nav-copy" aria-hidden={current !== 'entry' ? true : undefined}>
          <span className="site-nav-heading"><strong>{label}</strong></span>
          <span className="site-nav-description">{description}</span>
        </span>
      </button>
    ))}
    <button type="button" className={`site-nav-item site-nav-settings${settingsOpen ? ' is-settings-open' : ''}`}
      ref={settingsTriggerRef} data-action="settings" onClick={onToggleSettings}
      aria-label={settingsOpen ? '收起开发者参数设置' : '打开开发者参数设置'}
      aria-expanded={settingsOpen} aria-controls="developerSettingsPanel">
      <span className="site-nav-symbol">
        <NavigationIcon name="settings" />
        <span className="site-nav-short-label" aria-hidden="true">设置</span>
      </span>
      <span className="site-nav-copy" aria-hidden={current !== 'entry' ? true : undefined}>
        <span className="site-nav-heading"><strong>设置</strong></span>
        <span className="site-nav-description">界面参数</span>
      </span>
    </button>
  </nav>;
}
