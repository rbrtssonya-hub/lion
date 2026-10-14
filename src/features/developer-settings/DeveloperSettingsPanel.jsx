import { useEffect, useId, useRef, useState } from 'react';
import './developer-settings.css';

function normalizeValue(value, min, max, step) {
  const clamped = Math.min(max, Math.max(min, value));
  return min + Math.round((clamped - min) / step) * step;
}

function RangeControl({ name, label, value, min, max, step = 1, unit = 'px', onChange }) {
  const id = useId();
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  function apply(rawValue) {
    const parsed = Number(rawValue);
    const next = rawValue.trim() === '' || !Number.isFinite(parsed)
      ? value
      : normalizeValue(parsed, min, max, step);
    setDraft(String(next));
    if (next !== value) onChange(name, next);
  }

  return (
    <div className="developer-range-control">
      <div className="developer-range-heading">
        <label htmlFor={id}>{label}</label>
        <span className="developer-range-value">
          <input
            id={`${id}-number`}
            type="number"
            aria-label={`${label}数值`}
            min={min}
            max={max}
            step={step}
            value={draft}
            onChange={event => {
              const rawValue = event.target.value;
              setDraft(rawValue);
              if (rawValue.trim() === '') return;
              const parsed = Number(rawValue);
              if (Number.isFinite(parsed) && parsed >= min && parsed <= max) {
                const next = normalizeValue(parsed, min, max, step);
                if (next !== value) onChange(name, next);
              }
            }}
            onBlur={() => apply(draft)}
            onKeyDown={event => {
              if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
              event.preventDefault();
              apply(draft);
            }}
          />
          <span aria-hidden="true">{unit}</span>
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={`${value}${unit}`}
        onChange={event => {
          const next = Number(event.target.value);
          setDraft(String(next));
          onChange(name, next);
        }}
      />
    </div>
  );
}

function SettingsGroup({ title, note, children }) {
  return (
    <section className="developer-settings-group">
      <div className="developer-settings-group-heading">
        <h4>{title}</h4>
        <small>{note}</small>
      </div>
      <div className="developer-settings-group-content">{children}</div>
    </section>
  );
}

const pages = [
  { id: 'appearance', label: '外观', title: '外观材质', note: '分别调整顶栏与设置侧栏的透明和模糊。', icon: 'M4 5h12v10H4zM4 9h12M8 9v6' },
  { id: 'navigation', label: '导航', title: '导航文字与尺寸', note: '首页导航的文字层级、图标和顶栏留白。', icon: 'M4 6h12M4 10h8M4 14h12' },
  { id: 'animation', label: '动画', title: '导航与品牌过渡', note: '进入章节时，图标与文字一起收拢，品牌向左归位；返回首页时恢复展开。', icon: 'M3 14c4 0 5-8 10-8h4m-3-3 3 3-3 3' },
  { id: 'carousel', label: '轮播', title: '首页照片轮播', note: '调整醒狮文化图鉴的播放节奏与照片动效。', icon: 'M5 4h10v12H5zM2 7v6M18 7v6m-10-3 4 2-4 2z' },
  { id: 'layout', label: '布局', title: '面板与页面布局', note: '选择覆盖或推开页面，并调整面板宽度。', icon: 'M3 4h14v12H3zM12 4v12' },
];

const easingOptions = [
  { value: 'smooth', label: '平滑进出', note: '缓慢起步，加速移动，再平稳停下。' },
  { value: 'swift', label: '快速收拢', note: '快速响应，接近终点时逐渐减速。' },
  { value: 'soft', label: '柔和缓出', note: '柔和启动，以更长的减速过程落位。' },
];

export default function DeveloperSettingsPanel({
  open,
  settings,
  onChange,
  onClose,
  onReset,
  panelRef,
  canPush,
  onKeyDown,
  resizeHandle,
}) {
  const pushId = useId();
  const carouselAutoplayId = useId();
  const panelId = useId();
  const easingId = useId();
  const [activePage, setActivePage] = useState('appearance');
  const tabRefs = useRef([]);
  const scrollRef = useRef(null);
  const scrollPositions = useRef({});

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollPositions.current[activePage] ?? 0;
    }
  }, [activePage, open]);

  if (!open) return null;

  function selectPage(pageId) {
    if (scrollRef.current) scrollPositions.current[activePage] = scrollRef.current.scrollTop;
    setActivePage(pageId);
  }

  function navigateTabs(event, index) {
    if (event.nativeEvent.isComposing) return;
    let nextIndex;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % pages.length;
    else if (event.key === 'ArrowLeft') nextIndex = (index + pages.length - 1) % pages.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = pages.length - 1;
    else return;
    event.preventDefault();
    selectPage(pages[nextIndex].id);
    tabRefs.current[nextIndex]?.focus();
  }

  const range = (name, label, min, max, step = 1, unit = 'px') => (
    <RangeControl
      name={name}
      label={label}
      value={settings[name]}
      min={min}
      max={max}
      step={step}
      unit={unit}
      onChange={onChange}
    />
  );

  return (
    <aside
      className="developer-settings-panel"
      id="developerSettingsPanel"
      role="region"
      aria-label="开发者参数设置"
      tabIndex={-1}
      ref={panelRef}
      onKeyDown={onKeyDown}
    >
      {resizeHandle}
      <div className="developer-settings-header">
        <div className="developer-settings-heading">
          <div>
            <span className="developer-settings-eyebrow">南风有狮 · 界面调整</span>
            <h2>开发者参数设置</h2>
          </div>
          <button
            className="developer-settings-close"
            type="button"
            aria-label="关闭开发者参数"
            onClick={onClose}
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="m5 5 10 10M15 5 5 15" />
            </svg>
          </button>
        </div>
        <p className="developer-settings-intro">按用途分组，调整后立即预览。</p>
      </div>

      <div className="developer-settings-tabs" role="tablist" aria-label="设置分类">
        {pages.map((page, index) => (
          <button
            key={page.id}
            id={`${panelId}-tab-${page.id}`}
            type="button"
            role="tab"
            aria-selected={activePage === page.id}
            aria-controls={`${panelId}-page-${page.id}`}
            tabIndex={activePage === page.id ? 0 : -1}
            ref={element => { tabRefs.current[index] = element; }}
            onClick={() => selectPage(page.id)}
            onKeyDown={event => navigateTabs(event, index)}
          >
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d={page.icon} /></svg>
            <span>{page.label}</span>
          </button>
        ))}
      </div>

      <div className="developer-settings-scroll" ref={scrollRef}>
        {pages.map(page => (
          <div
            key={page.id}
            className="developer-settings-page"
            id={`${panelId}-page-${page.id}`}
            role="tabpanel"
            aria-labelledby={`${panelId}-tab-${page.id}`}
            tabIndex={0}
            hidden={activePage !== page.id}
          >
            <div className="developer-settings-page-heading">
              <h3>{page.title}</h3>
              <p className="developer-settings-note">{page.note}</p>
            </div>

            {page.id === 'appearance' && <>
              <SettingsGroup title="顶栏外观" note="透明与模糊">
                {range('headerTransparency', '顶栏透明度', 0, 100, 1, '%')}
                {range('headerBlur', '顶栏模糊强度', 0, 30)}
                <p className="developer-settings-note">透明度越高，越能透出页面；模糊让背景更柔和。</p>
              </SettingsGroup>

              <SettingsGroup title="侧栏外观" note="透明与模糊">
                {range('sidebarTransparency', '侧栏透明度', 0, 100, 1, '%')}
                {range('sidebarBlur', '侧栏模糊强度', 0, 30)}
                <p className="developer-settings-note">调整侧栏背景，文字和控件保持清楚。</p>
              </SettingsGroup>
            </>}

            {page.id === 'navigation' && <>
              <SettingsGroup title="导航尺寸" note="字号与间距">
                {range('headerHeight', '顶栏高度', 64, 180)}
                {range('navFontSize', '导航标题字号', 14, 28)}
                {range('helperFontSize', '导航辅助文字字号', 10, 28)}
                {range('navIconSize', '导航图标尺寸', 24, 56)}
                {range('brandPadding', '品牌左侧留白', 8, 80)}
                {range('helperTransparency', '辅助文字透明度', 0, 100, 1, '%')}
                <p className="developer-settings-note">标题与辅助文字独立调节。切换章节时，图标与文字一起过渡；窗口空间不足时，导航按可用宽度调整。</p>
              </SettingsGroup>
            </>}

            {page.id === 'animation' && <>
              <SettingsGroup title="运动节奏" note="曲线变速">
                {range('navigationDuration', '导航动画时长', 200, 1600, 10, 'ms')}
                <div className="developer-settings-select-control">
                  <label htmlFor={easingId}>动画变速曲线</label>
                  <select
                    id={easingId}
                    value={settings.navigationEasing}
                    onChange={event => onChange('navigationEasing', event.target.value)}
                  >
                    {easingOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  <p className="developer-settings-note">{easingOptions.find(option => option.value === settings.navigationEasing)?.note}</p>
                </div>
              </SettingsGroup>
              <SettingsGroup title="导航与品牌位置" note="位置与间距">
                {range('compactNavGap', '紧凑导航图标间距', 4, 36)}
                {range('compactNavInset', '紧凑导航右侧留白', 16, 160)}
                {range('homeBrandOffset', '首页品牌右移距离', 0, 160)}
                <p className="developer-settings-note">首页的狮头与“南风有狮”一起右移，进入章节后向左归位；品牌左侧留白另在导航页调整。</p>
                <p className="developer-settings-note">下方横线标记当前章节。系统开启减少动态效果时，导航与品牌直接切换到目标位置。</p>
              </SettingsGroup>
            </>}

            {page.id === 'carousel' && <>
              <SettingsGroup title="播放节奏" note="自动与恢复">
                <label className="developer-settings-toggle" htmlFor={carouselAutoplayId}>
                  <span>照片自动播放</span>
                  <span className="developer-settings-switch">
                    <input
                      id={carouselAutoplayId}
                      type="checkbox"
                      checked={settings.carouselAutoplay}
                      onChange={event => onChange('carouselAutoplay', event.target.checked)}
                    />
                    <span aria-hidden="true" />
                  </span>
                </label>
                {range('carouselInterval', '自动播放间隔', 2, 30, 1, '秒')}
                {range('carouselResumeDelay', '离开后恢复等待', 1, 15, 1, '秒')}
                <p className="developer-settings-note">仅悬停前景照片时暂停，点击照片可查看下一张。离开照片后先等待，再重新计算播放间隔。</p>
              </SettingsGroup>
              <SettingsGroup title="照片动效" note="过渡与聚焦">
                {range('carouselTransitionDuration', '照片过渡时长', 300, 1600, 50, 'ms')}
                {range('carouselFocusScale', '照片聚焦比例', 101, 110, 1, '%')}
                <p className="developer-settings-note">悬停前景照片时轻微放大，104% 表示原尺寸的 1.04 倍。系统开启减少动态效果时，保留静态图片与手动切换。</p>
              </SettingsGroup>
            </>}

            {page.id === 'layout' && <>
              <SettingsGroup title="面板布局" note="覆盖或推开">
                <label className="developer-settings-toggle" htmlFor={pushId}>
                  <span>设置面板推开页面</span>
                  <span className="developer-settings-switch">
                    <input
                      id={pushId}
                      type="checkbox"
                      checked={settings.pushPage}
                      onChange={event => onChange('pushPage', event.target.checked)}
                    />
                    <span aria-hidden="true" />
                  </span>
                </label>
                <p className="developer-settings-note" aria-live="polite">
                  {settings.pushPage && !canPush
                    ? '窗口空间不足，暂时覆盖显示；加宽窗口后自动推开页面。'
                    : settings.pushPage
                      ? '页面为侧栏留出空间，关闭面板后恢复。'
                      : '面板覆盖在页面右侧，页面保持原有宽度。'}
                </p>
                {range('panelWidth', '设置面板宽度', 280, 760)}
                <p className="developer-settings-note">悬停顶栏底边或侧栏左边，也可拖动调节尺寸。</p>
              </SettingsGroup>
            </>}
          </div>
        ))}
      </div>

      <div className="developer-settings-footer">
        <p className="developer-settings-note">参数在此浏览器自动保存</p>
        <button className="developer-settings-reset" type="button" onClick={onReset}>
          恢复默认参数
        </button>
      </div>
    </aside>
  );
}
