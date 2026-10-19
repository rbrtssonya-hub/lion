import { chapters } from '../config/chapters.js';
import NavigationIcon from './NavigationIcon.jsx';

export default function ChapterNav({ current, onNavigate, settingsOpen, onToggleSettings, settingsTriggerRef }) {
  return <nav className="site-navigation" aria-label="作品章节导航">
    {chapters.map(({ route, label, description }) => (
      <button key={route} data-route={route} type="button"
        className={`site-nav-item${current === route ? ' is-current' : ''}`}
        onClick={() => onNavigate(route)} aria-label={label} title={label}
        aria-current={current === route ? 'page' : undefined}>
        <span className="site-nav-symbol">
          <NavigationIcon name={route} />
        </span>
        <span className="site-nav-copy">
          <span className="site-nav-heading"><strong>{label}</strong></span>
          <span className="site-nav-description" aria-hidden={current !== 'entry' ? true : undefined}>{description}</span>
        </span>
      </button>
    ))}
    <button type="button" className={`site-nav-item site-nav-settings${settingsOpen ? ' is-settings-open' : ''}`}
      ref={settingsTriggerRef} data-action="settings" onClick={onToggleSettings}
      aria-label={settingsOpen ? '收起开发者参数设置' : '打开开发者参数设置'}
      aria-expanded={settingsOpen} aria-controls="developerSettingsPanel">
      <span className="site-nav-symbol">
        <NavigationIcon name="settings" />
      </span>
      <span className="site-nav-copy">
        <span className="site-nav-heading"><strong>设置</strong></span>
        <span className="site-nav-description" aria-hidden={current !== 'entry' ? true : undefined}>界面参数</span>
      </span>
    </button>
  </nav>;
}
