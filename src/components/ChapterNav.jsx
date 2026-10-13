import { chapters } from '../config/chapters.js';

export default function ChapterNav({ current, onNavigate, settingsOpen, onToggleSettings, settingsTriggerRef }) {
  return <nav className="site-navigation" aria-label="作品章节导航">
    {chapters.map(({ route, label, description, icon, viewBox }) => (
      <button key={route} data-route={route} type="button"
        className={`site-nav-item${current === route ? ' is-current' : ''}`}
        onClick={() => onNavigate(route)} aria-current={current === route ? 'page' : undefined}>
        <span className="site-nav-icon" aria-hidden="true">
          <svg viewBox={viewBox} focusable="false"><path d={icon} /></svg>
        </span>
        <span className="site-nav-copy">
          <span className="site-nav-heading"><strong>{label}</strong></span>
          <span className="site-nav-description">{description}</span>
        </span>
      </button>
    ))}
    <button type="button" className={`site-nav-item site-nav-settings${settingsOpen ? ' is-settings-open' : ''}`}
      ref={settingsTriggerRef} data-action="settings" onClick={onToggleSettings}
      aria-label={settingsOpen ? '收起开发者参数设置' : '打开开发者参数设置'}
      aria-expanded={settingsOpen} aria-controls="developerSettingsPanel">
      <span className="site-nav-icon" aria-hidden="true">
        <svg viewBox="0 0 48 48" focusable="false">
          <path d="m19 6-1.4 4.8-4.2 2.4-4.8-1.2-4 6.8 3.6 3.6v4.8L4.6 31l4 6.8 4.8-1.2 4.2 2.4 1.4 5.2h9.6L30 39l4.2-2.4 4.8 1.2 4-6.8-3.6-3.6v-4.8l3.6-3.6-4-6.8-4.8 1.2L30 11 28.6 6Z" />
          <circle cx="24" cy="25" r="6.4" />
        </svg>
      </span>
      <span className="site-nav-copy">
        <span className="site-nav-heading"><strong>设置</strong></span>
        <span className="site-nav-description">界面参数</span>
      </span>
    </button>
  </nav>;
}
