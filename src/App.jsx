import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import HomePage from './features/home/HomePage.jsx';
import ChapterPage from './features/chapters/ChapterPage.jsx';
import { useChapterRoute } from './hooks/useChapterRoute.js';
import SiteHeader from './components/SiteHeader.jsx';
import DeveloperSettingsPanel from './features/developer-settings/DeveloperSettingsPanel.jsx';
import { useDeveloperSettings } from './features/developer-settings/useDeveloperSettings.js';
import { useSettingsPanelLayout } from './features/developer-settings/useSettingsPanelLayout.js';
import ResizeHandle from './components/ResizeHandle.jsx';
import { defaultDeveloperSettings } from './features/developer-settings/useDeveloperSettings.js';
import { media } from './config/media.js';

const ModelPage = lazy(() => import('./features/model/ModelPage.jsx'));
const chapterBackgrounds = {
  model: media.modelBackground,
  action: media.actionBackground,
  state: media.stateBackground,
};

export default function App() {
  const [route, navigate] = useChapterRoute();
  const { settings, changeSettings, previewSettings, commitSettings, resetSettings } = useDeveloperSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const panelRef = useRef(null);
  const triggerRef = useRef(null);
  const wasSettingsOpen = useRef(false);
  const canPush = useSettingsPanelLayout(settingsOpen, panelRef, settings.panelWidth);
  const pushing = settingsOpen && settings.pushPage && canPush;
  const chapterBackground = chapterBackgrounds[route];
  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  }, []);
  const handleSettingsKey = useCallback(event => {
    if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing || event.nativeEvent?.isComposing) return;
    if (document.documentElement.classList.contains('lion-resizing-x') || document.documentElement.classList.contains('lion-resizing-y')) return;
    event.preventDefault();
    event.stopPropagation();
    closeSettings();
  }, [closeSettings]);
  useEffect(() => {
    if (!settingsOpen) {
      if (wasSettingsOpen.current) triggerRef.current?.focus({ preventScroll: true });
      wasSettingsOpen.current = false;
      return;
    }
    wasSettingsOpen.current = true;
    panelRef.current?.querySelector('button')?.focus({ preventScroll: true });
    document.addEventListener('keydown', handleSettingsKey);
    return () => document.removeEventListener('keydown', handleSettingsKey);
  }, [settingsOpen, handleSettingsKey]);
  useEffect(() => {
    document.body.dataset.state = route;
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [route]);

  let page;
  if (route === 'entry') page = <HomePage />;
  else if (route === 'model') page = <ModelPage />;
  else page = <ChapterPage route={route} />;

  const variables = {
    '--page-background-color': chapterBackground ? '#f8f2e9' : '#68170f',
    '--chapter-background-image': chapterBackground ? `url("${chapterBackground}")` : 'none',
    '--header-height': `${settings.headerHeight}px`,
    '--header-fill-opacity': 1 - settings.headerTransparency / 100,
    '--header-backdrop-filter': settings.headerBlur > 0 ? `blur(${settings.headerBlur}px)` : 'none',
    '--header-decoration-opacity': 1 - settings.headerTransparency / 100,
    '--sidebar-fill-opacity': 1 - settings.sidebarTransparency / 100,
    '--sidebar-backdrop-filter': settings.sidebarBlur > 0 ? `blur(${settings.sidebarBlur}px)` : 'none',
    '--sidebar-decoration-opacity': 1 - settings.sidebarTransparency / 100,
    '--nav-font-size': `${settings.navFontSize}px`,
    '--requested-nav-icon-size': `${settings.navIconSize}px`,
    '--helper-opacity': 1 - settings.helperTransparency / 100,
    '--brand-padding': `${settings.brandPadding}px`,
    '--settings-panel-width': `${settings.panelWidth}px`,
    '--settings-page-reserve': pushing ? `${settings.panelWidth}px` : '0px',
    '--resize-header-width': settingsOpen ? `calc(100% - min(${settings.panelWidth}px, 100vw))` : '100%',
    '--settings-backdrop-image': `url("${chapterBackground || media.cover}")`,
  };

  return <div className="site-shell" style={variables} data-settings-open={settingsOpen}
    data-settings-layout={pushing ? 'push' : 'overlay'}>
    <div className="site-page">
      <SiteHeader current={route} onNavigate={navigate} settingsOpen={settingsOpen}
        onToggleSettings={() => settingsOpen ? closeSettings() : setSettingsOpen(true)}
        settingsTriggerRef={triggerRef} />
      <main id="react-app" data-route={route}>
        <Suspense fallback={<div className="page-loading" role="status">正在加载章节…</div>}>{page}</Suspense>
      </main>
    </div>
    <ResizeHandle label="调整顶栏高度" axis="y" value={settings.headerHeight} min={64} max={180}
      defaultValue={defaultDeveloperSettings.headerHeight} className="lion-topbar-resize-handle"
      onChange={value => previewSettings('headerHeight', value)} onCommit={commitSettings} onCancel={commitSettings} />
    {settingsOpen && <DeveloperSettingsPanel open settings={settings} onChange={changeSettings}
      onClose={closeSettings} onReset={resetSettings} panelRef={panelRef} canPush={canPush}
      onKeyDown={handleSettingsKey} resizeHandle={<ResizeHandle label="调整侧栏宽度" axis="x"
        value={settings.panelWidth} min={280} max={760} direction={-1}
        defaultValue={defaultDeveloperSettings.panelWidth} className="lion-sidebar-resize-handle"
        onChange={value => previewSettings('panelWidth', value)} onCommit={commitSettings} onCancel={commitSettings} />} />}
  </div>;
}
