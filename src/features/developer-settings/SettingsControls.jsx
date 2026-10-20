import { useEffect, useId, useRef, useState } from 'react';

export function RangeControl({ name, label, value, min, max, step = 1, unit = 'px', onChange }) {
  const id = useId();
  const [draft, setDraft] = useState(String(value));
  useEffect(() => { setDraft(String(value)); }, [value]);
  const normalize = value => min + Math.round((Math.min(max, Math.max(min, value)) - min) / step) * step;
  const apply = raw => {
    const next = raw.trim() === '' || !Number.isFinite(Number(raw)) ? value : normalize(Number(raw));
    setDraft(String(next));
    if (next !== value) onChange(name, next);
  };
  return <div className="developer-range-control">
    <div className="developer-range-heading">
      <label htmlFor={id}>{label}</label>
      <span className="developer-range-value"><input id={`${id}-number`} type="number" aria-label={`${label}数值`}
        min={min} max={max} step={step} value={draft}
        onChange={event => {
          const raw = event.target.value; setDraft(raw);
          if (raw.trim() !== '' && Number.isFinite(Number(raw)) && Number(raw) >= min && Number(raw) <= max) {
            const next = normalize(Number(raw)); if (next !== value) onChange(name, next);
          }
        }} onBlur={() => apply(draft)} onKeyDown={event => {
          if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
          event.preventDefault(); apply(draft);
        }} /><span aria-hidden="true">{unit}</span></span>
    </div>
    <input id={id} type="range" min={min} max={max} step={step} value={value} aria-valuetext={`${value}${unit}`}
      onChange={event => { const next = Number(event.target.value); setDraft(String(next)); onChange(name, next); }} />
  </div>;
}

export function SettingsGroup({ title, note, children }) {
  return <section className="developer-settings-group">
    <div className="developer-settings-group-heading"><h4>{title}</h4>{note && <small>{note}</small>}</div>
    <div className="developer-settings-group-content">{children}</div>
  </section>;
}

export function ColorControl({ name, label, value, onChange }) {
  const id = useId();
  return <div className="developer-color-control"><label htmlFor={id}>{label}</label>
    <span><input id={id} type="color" value={value} onChange={event => onChange(name, event.target.value)} /><output htmlFor={id}>{value.toUpperCase()}</output></span>
  </div>;
}

export function ToggleControl({ name, label, value, onChange }) {
  const id = useId();
  return <label className="developer-settings-toggle" htmlFor={id}><span>{label}</span>
    <span className="developer-settings-switch"><input id={id} type="checkbox" checked={value} onChange={event => onChange(name, event.target.checked)} /><span aria-hidden="true" /></span>
  </label>;
}

export function MaterialControls({ prefix = '', label, values, onChange }) {
  return <>
    <RangeControl name={`${prefix}Transparency`} label={`${label}透明度`} value={values[`${prefix}Transparency`]} min={0} max={100} unit="%" onChange={onChange} />
    <RangeControl name={`${prefix}Blur`} label={`${label}模糊强度`} value={values[`${prefix}Blur`]} min={0} max={40} onChange={onChange} />
    <RangeControl name={`${prefix}Radius`} label={`${label}圆角`} value={values[`${prefix}Radius`]} min={0} max={100} onChange={onChange} />
    <ColorControl name={`${prefix}Color`} label={`${label}底色`} value={values[`${prefix}Color`]} onChange={onChange} />
  </>;
}

export function SettingsTabList({ id, label, items, value, onChange, vertical = false }) {
  const refs = useRef([]);
  return <div className={vertical ? 'developer-settings-tabs' : 'developer-settings-subtabs'} role="tablist" aria-label={label} aria-orientation={vertical ? 'vertical' : 'horizontal'}>
    {items.map((item,index) => <button key={item.id} id={`${id}-tab-${item.id}`} type="button" role="tab" aria-selected={value === item.id}
      aria-controls={`${id}-page-${item.id}`} tabIndex={value === item.id ? 0 : -1} ref={node => { refs.current[index] = node; }}
      onClick={() => onChange(item.id)} onKeyDown={event => {
        if (event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
        let next;
        if (['ArrowDown','ArrowRight'].includes(event.key)) next = (index + 1) % items.length;
        else if (['ArrowUp','ArrowLeft'].includes(event.key)) next = (index + items.length - 1) % items.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = items.length - 1;
        if (next === undefined) return;
        event.preventDefault(); event.stopPropagation(); onChange(items[next].id); refs.current[next]?.focus();
      }}>
      {item.icon && <svg viewBox="0 0 20 20" aria-hidden="true"><path d={item.icon} /></svg>}<span>{item.label}</span>
    </button>)}
  </div>;
}

export function SettingsSubpages({ label, items, value, onChange, children }) {
  const id = useId();
  return <>
    <SettingsTabList id={id} label={label} items={items} value={value} onChange={onChange} />
    {items.map(item => <div key={item.id} className="developer-settings-subpage" role="tabpanel" id={`${id}-page-${item.id}`} aria-labelledby={`${id}-tab-${item.id}`} tabIndex={0} hidden={value !== item.id}>
      {children(item.id)}
    </div>)}
  </>;
}
