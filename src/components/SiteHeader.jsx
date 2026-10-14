import BrandLockup from './BrandLockup.jsx';
import ChapterNav from './ChapterNav.jsx';
import { media } from '../config/media.js';
import { useNavigationLayout } from '../hooks/useNavigationLayout.js';
import NavigationSurface from './NavigationSurface.jsx';

const navigationFontFace = `@font-face {
  font-family: 'Nanfeng Navigation Brush';
  src: url(${JSON.stringify(media.navBrushFont)}) format('woff');
  font-style: normal;
  font-weight: 400;
  font-display: swap;
}`;

export default function SiteHeader({ current, onNavigate, settingsOpen, onToggleSettings, settingsTriggerRef, headerRef, settings }) {
  useNavigationLayout(headerRef, current, settings);
  const navigate = (route) => {
    onNavigate(route);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  return <header className="site-header" ref={headerRef} data-nav-mode={current === 'entry' ? 'expanded' : 'compact'}>
    <style>{navigationFontFace}</style>
    <div className="site-header-inner">
      <button type="button" className="site-brand-capsule" onClick={() => navigate('entry')} aria-label="南风有狮，返回首页">
        <NavigationSurface />
        <BrandLockup />
      </button>
      <ChapterNav current={current} onNavigate={navigate} settingsOpen={settingsOpen}
        onToggleSettings={onToggleSettings} settingsTriggerRef={settingsTriggerRef} />
    </div>
  </header>;
}
