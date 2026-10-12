import { useEffect, useId, useState } from 'react';
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

function SettingsGroup({ title, note, initiallyOpen = false, children }) {
  const [expanded, setExpanded] = useState(initiallyOpen);
  return (
    <details
      className="developer-settings-group"
      open={expanded}
      onToggle={event => setExpanded(event.currentTarget.open)}
    >
      <summary>
        <span>{title}</span>
        <small>{note}</small>
        <svg aria-hidden="true" viewBox="0 0 20 20">
          <path d="m5 7.5 5 5 5-5" />
        </svg>
      </summary>
      <div className="developer-settings-group-content">{children}</div>
    </details>
  );
}

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
  if (!open) return null;

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
      <div className="developer-settings-scroll">
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
        <p className="developer-settings-intro">调整后立即预览，参数会在此浏览器记住。</p>
        <p className="developer-settings-note">悬停顶栏底边或侧栏左边，可拖动调节尺寸。</p>

        <SettingsGroup title="顶栏外观" note="透明与模糊" initiallyOpen>
          {range('headerTransparency', '顶栏透明度', 0, 100, 1, '%')}
          {range('headerBlur', '顶栏模糊强度', 0, 30)}
          <p className="developer-settings-note">透明度越高，越能透出页面；模糊让背景更柔和。</p>
        </SettingsGroup>

        <SettingsGroup title="侧栏外观" note="透明与模糊" initiallyOpen>
          {range('sidebarTransparency', '侧栏透明度', 0, 100, 1, '%')}
          {range('sidebarBlur', '侧栏模糊强度', 0, 30)}
          <p className="developer-settings-note">调整侧栏背景，文字和控件保持清楚。</p>
        </SettingsGroup>

        <SettingsGroup title="导航尺寸" note="字号与间距">
          {range('headerHeight', '顶栏高度', 64, 180)}
          {range('navFontSize', '导航文字字号', 14, 28)}
          {range('navIconSize', '导航图标尺寸', 24, 56)}
          {range('brandPadding', '品牌左侧留白', 8, 80)}
          {range('helperTransparency', '辅助文字透明度', 0, 100, 1, '%')}
          <p className="developer-settings-note">序号、标题与辅助文字保持同字号，辅助文字单独调整透明度。</p>
        </SettingsGroup>

        <SettingsGroup title="面板布局" note="覆盖或推开" initiallyOpen>
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
        </SettingsGroup>

        <div className="developer-settings-footer">
          <button className="developer-settings-reset" type="button" onClick={onReset}>
            恢复默认参数
          </button>
        </div>
      </div>
    </aside>
  );
}
