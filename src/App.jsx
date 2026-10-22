import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
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
import { useNavigationMotion } from './features/navigation/useNavigationMotion.js';
import { withStartupTimeout } from './features/loading/useStartupLoading.js';
import { getGlobalSurfaceStyles } from './features/developer-settings/surfaceSettings.js';
import ModelPreparationBoundary from './features/model/ModelPreparationBoundary.jsx';

const ModelPage = lazy(() => withStartupTimeout(import('./features/model/ModelPage.jsx'), 25_000, '模型组件准备超时'));
const chapterBackgrounds = {
  model: media.modelBackground,
  action: media.actionBackground,
  state: media.stateBackground,
};

export default function App() {
  const navigationCaptureRef = useRef(null);
  const beforeRouteChange = useCallback(() => navigationCaptureRef.current?.(), []);
  const [route, navigate] = useChapterRoute(beforeRouteChange);
  const { settings, changeSettings, previewSettings, commitSettings, resetSettings, applySurfaceSettings,
    beginSettingsEditing, saveSettings, discardSettings, hasUnsavedChanges, settingsFeedback, exportSettings } = useDeveloperSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsPage, setSettingsPage] = useState('common');
  const actionViewEditing = settingsOpen && route === 'action' && settingsPage === 'view';
  const [discardPromptOpen, setDiscardPromptOpen] = useState(false);
  const panelRef = useRef(null);
  const triggerRef = useRef(null);
  const wasSettingsOpen = useRef(false);
  const headerRef = useRef(null);
  const captureNavigation = useNavigationMotion(headerRef, route, settings);
  const [observation, setObservation] = useState(null);
  const modelReturn = useRef(null);
  useLayoutEffect(() => { navigationCaptureRef.current = captureNavigation; }, [captureNavigation]);
  const navigateTo = useCallback((target, context) => {
    if (target === 'state' && route === 'model' && context?.expressionId) {
      modelReturn.current = { scrollY: window.scrollY, partId: context.returnPartId };
      setObservation(context);
    } else {
      modelReturn.current = null;
      setObservation(null);
    }
    if (target !== route) captureNavigation();
    navigate(target);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [route, navigate, captureNavigation]);
  const returnToModel = useCallback(() => {
    captureNavigation();
    navigate('model');
  }, [captureNavigation, navigate]);
  const modelPartChanged = useCallback(id => {
    if (modelReturn.current && modelReturn.current.partId !== id) {
      modelReturn.current = null;
      setObservation(null);
    }
  }, []);
  const canPush = useSettingsPanelLayout(settingsOpen, panelRef, settings.panelWidth);
  const pushing = settingsOpen && settings.pushPage && canPush;
  // CSS variables are consumed by the built stylesheet in dist/assets.
  // Resolve media at the document first so './assets' cannot become assets/assets.
  const chapterBackground = chapterBackgrounds[route]
    ? new URL(chapterBackgrounds[route], window.location.href).href : undefined;
  const finishClosingSettings = useCallback(() => {
    setDiscardPromptOpen(false);
    setSettingsOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  }, []);
  const closeSettings = useCallback(() => {
    if (hasUnsavedChanges) { setDiscardPromptOpen(true); return; }
    discardSettings();
    finishClosingSettings();
  }, [hasUnsavedChanges, discardSettings, finishClosingSettings]);
  const openSettings = useCallback(() => {
    beginSettingsEditing();
    setSettingsOpen(true);
  }, [beginSettingsEditing]);
  const handleSaveSettings = useCallback(() => {
    if (saveSettings({ keepEditing: actionViewEditing }) && !actionViewEditing) finishClosingSettings();
  }, [saveSettings, finishClosingSettings, actionViewEditing]);
  const discardAndCloseSettings = useCallback(() => {
    discardSettings();
    finishClosingSettings();
  }, [discardSettings, finishClosingSettings]);
  const handleSettingsKey = useCallback(event => {
    if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing || event.nativeEvent?.isComposing) return;
    if (document.documentElement.classList.contains('lion-resizing-x') || document.documentElement.classList.contains('lion-resizing-y')) return;
    event.preventDefault();
    event.stopPropagation();
    if (discardPromptOpen) setDiscardPromptOpen(false);
    else if (!actionViewEditing) closeSettings();
  }, [closeSettings, discardPromptOpen, actionViewEditing]);
  useEffect(() => {
    if (!settingsOpen) {
      if (wasSettingsOpen.current) triggerRef.current?.focus({ preventScroll: true });
      wasSettingsOpen.current = false;
      return;
    }
    if (!wasSettingsOpen.current) panelRef.current?.querySelector('button')?.focus({ preventScroll: true });
    wasSettingsOpen.current = true;
    document.addEventListener('keydown', handleSettingsKey);
    return () => document.removeEventListener('keydown', handleSettingsKey);
  }, [settingsOpen, handleSettingsKey]);
  useEffect(() => {
    document.body.dataset.state = route;
    if (route === 'model' && modelReturn.current) {
      const top = modelReturn.current.scrollY;
      const deadline = performance.now() + 1000;
      let frame;
      const restore = () => {
        const button = document.getElementById('modelExpressionLink');
        if (!button) return;
        // A reduced-motion Hash update can expose the DOM one paint before
        // inherited visibility settles. Only retry while this return is pending.
        if (!button.checkVisibility({ visibilityProperty: true }) || button.closest('[inert]')) {
          if (performance.now() < deadline) frame = requestAnimationFrame(restore);
          return;
        }
        window.scrollTo({ top, behavior: 'instant' });
        button.focus({ preventScroll: true });
      };
      frame = requestAnimationFrame(restore);
      return () => cancelAnimationFrame(frame);
    }
    if (route !== 'state') { modelReturn.current = null; setObservation(null); }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [route]);

  const variables = {
    ...getGlobalSurfaceStyles(settings),
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
    '--nav-helper-font-size': `${settings.helperFontSize}px`,
    '--sound-control-font-size': `${settings.soundControlFontSize}px`,
    '--sound-control-width': `${settings.soundControlWidth}px`,
    '--sound-wave-width': `${settings.soundWaveWidth}px`,
    '--sound-control-height': `${settings.soundControlFontSize * 5.5}px`,
    '--requested-nav-icon-size': `${settings.navIconSize}px`,
    '--compact-nav-gap': `${settings.compactNavGap}px`,
    '--compact-nav-inset': `${settings.compactNavInset}px`,
    '--helper-opacity': 1 - settings.helperTransparency / 100,
    '--brand-padding': `${settings.brandPadding}px`,
    '--home-brand-offset': `${settings.homeBrandOffset}px`,
    '--navigation-duration': `${settings.navigationDuration}ms`,
    '--settings-panel-width': `${settings.panelWidth}px`,
    '--settings-page-reserve': pushing ? `${settings.panelWidth}px` : '0px',
    '--resize-header-width': settingsOpen ? `calc(100% - min(${settings.panelWidth}px, 100vw))` : '100%',
    '--settings-backdrop-image': `url("${new URL(chapterBackground || media.cover, window.location.href).href}")`,
  };

  return <div className="site-shell" style={variables} data-settings-open={settingsOpen}
    data-settings-layout={pushing ? 'push' : 'overlay'}>
    <div className="site-page" data-page-hit-enabled={settings.pageHitEnabled}>
      <SiteHeader current={route} onNavigate={navigateTo} settingsOpen={settingsOpen} settingsCancelOnly={actionViewEditing}
        headerRef={headerRef} settings={settings}
        onToggleSettings={() => {
          if (!settingsOpen) openSettings();
          else if (actionViewEditing) panelRef.current?.focus({ preventScroll: true });
          else closeSettings();
        }}
        settingsTriggerRef={triggerRef} />
      <main id="react-app" data-route={route}>
        <div className="prewarmed-page" data-active={route === 'entry'} inert={route !== 'entry'} aria-hidden={route !== 'entry'}>
          <HomePage onNavigate={navigateTo} settings={settings} playbackEnabled={route === 'entry'} />
        </div>
        <div className="prewarmed-page" data-active={route === 'model'} inert={route !== 'model'} aria-hidden={route !== 'model'}>
          <ModelPreparationBoundary>
          <Suspense fallback={<div className="page-loading" role="status">正在加载章节…</div>}>
            <ModelPage lightingSettings={settings} active={route === 'model'} onObserve={context => navigateTo('state', context)} onPartChange={modelPartChanged} />
          </Suspense>
          </ModelPreparationBoundary>
        </div>
        {route !== 'entry' && route !== 'model' && <ChapterPage lightingSettings={settings} route={route} observation={observation} onReturnToModel={returnToModel} />}
      </main>
    </div>
    {settingsOpen && !actionViewEditing && <div className="settings-outside-guard" aria-hidden="true" onClick={closeSettings} />}
    {settingsFeedback && <div className="settings-status" role="status">{settingsFeedback}</div>}
    <ResizeHandle label="调整顶栏高度" axis="y" value={settings.headerHeight} min={64} max={180}
      defaultValue={defaultDeveloperSettings.headerHeight} className="lion-topbar-resize-handle"
      onChange={value => previewSettings('headerHeight', value)} onCommit={commitSettings} onCancel={commitSettings} />
    <DeveloperSettingsPanel open={settingsOpen} settings={settings} onChange={changeSettings} onApplyMaterial={applySurfaceSettings}
      activePage={settingsPage} onPageChange={setSettingsPage} actionViewEditing={actionViewEditing}
      onClose={closeSettings} onReset={resetSettings} panelRef={panelRef} canPush={canPush}
      hasUnsavedChanges={hasUnsavedChanges} onSave={handleSaveSettings} onExport={exportSettings}
      discardPromptOpen={discardPromptOpen} onContinueEditing={() => setDiscardPromptOpen(false)} onDiscard={discardAndCloseSettings}
      onKeyDown={handleSettingsKey} resizeHandle={<ResizeHandle label="调整侧栏宽度" axis="x"
        value={settings.panelWidth} min={280} max={760} direction={-1}
        defaultValue={defaultDeveloperSettings.panelWidth} className="lion-sidebar-resize-handle"
        onChange={value => previewSettings('panelWidth', value)} onCommit={commitSettings} onCancel={commitSettings} />} />
  </div>;
}
