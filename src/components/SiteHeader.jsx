import { useRef } from 'react';
import BrandLockup from './BrandLockup.jsx';
import ChapterNav from './ChapterNav.jsx';
import { media } from '../config/media.js';
import { useNavigationLayout } from '../hooks/useNavigationLayout.js';

const navigationFontFace = `@font-face {
  font-family: 'Nanfeng Navigation Brush';
  src: url(${JSON.stringify(media.navBrushFont)}) format('woff');
  font-style: normal;
  font-weight: 400;
  font-display: swap;
}`;

export default function SiteHeader({ current, onNavigate, settingsOpen, onToggleSettings, settingsTriggerRef }) {
  const headerRef = useRef(null);
  useNavigationLayout(headerRef);
  const navigate = (route) => {
    onNavigate(route);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  return <header className="site-header" ref={headerRef}>
    <style>{navigationFontFace}</style>
    <div className="site-header-inner">
      <BrandLockup />
      <ChapterNav current={current} onNavigate={navigate} settingsOpen={settingsOpen}
        onToggleSettings={onToggleSettings} settingsTriggerRef={settingsTriggerRef} />
    </div>
  </header>;
}
