import { useEffect, useId, useRef, useState } from 'react';
import { ColorControl, ToggleControl } from './SettingsControls.jsx';
import { DEFAULT_PARAMETERS, PARAMETER_GROUPS, applyLightPreset, getLightPreset, isLightPresetModified,
  parseParameters, resolveSpreadStampParameters, serializeParameters, spreadStampSettingKey, spreadStampSettingsForParameters } from '../../config/spreadStampSettings.js';

function StampNumberControl({ field, value, onChange }) {
  const id = useId();
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const change = next => onChange(spreadStampSettingKey(field.key), next);
  const commit = () => {
    const next = draft.trim() === '' || !Number.isFinite(Number(draft)) ? value : Math.min(field.max, Math.max(field.min, Number(draft)));
    setDraft(String(next));
    if (next !== value) change(next);
  };
  return <div className="developer-range-control" title={field.hint} data-stamp-parameter={field.key}>
    <div className="developer-range-heading"><label htmlFor={id}>{field.label}</label>
      <span className="developer-range-value"><input type="number" aria-label={`${field.label}数值`} min={field.min} max={field.max}
        step={field.step} value={draft} onChange={event => {
          const raw = event.target.value;
          setDraft(raw);
          if (raw.trim() !== '' && Number.isFinite(Number(raw)) && Number(raw) >= field.min && Number(raw) <= field.max) change(Number(raw));
        }} onBlur={commit} onKeyDown={event => {
          if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
          event.preventDefault(); commit();
        }} /><span aria-hidden="true">{field.unit}</span></span>
    </div>
    <input id={id} type="range" data-parameter={field.key} min={field.min} max={field.max} step={field.step} value={value}
      aria-valuetext={`${value}${field.unit}`} onChange={event => { setDraft(event.target.value); change(Number(event.target.value)); }} />
  </div>;
}

function StampField({ field, value, onChange, onAlgorithm }) {
  const id = useId();
  const name = spreadStampSettingKey(field.key);
  if (field.type === 'number') return <StampNumberControl field={field} value={value} onChange={onChange} />;
  if (field.type === 'select') return <div className="developer-settings-select-control" data-stamp-parameter={field.key}>
    <label htmlFor={id}>{field.label}</label>
    <select id={id} data-parameter={field.key} value={value} onChange={event => onAlgorithm(event.target.value)}>
      {field.options.map(option => <option value={option.value} key={option.value}>{option.label}</option>)}
    </select>
  </div>;
  return <div data-stamp-parameter={field.key} title={field.hint}>
    {field.type === 'color'
      ? ['backgroundColor', 'focusBackground'].includes(field.key)
        ? <fieldset disabled className="developer-stamp-unused-color"><ColorControl name={name} label={field.label} value={value} onChange={onChange} /><p className="developer-settings-note">邮票直接呈现在章节背景上，不使用独立底色。</p></fieldset>
        : <ColorControl name={name} label={field.label} value={value} onChange={onChange} />
      : <ToggleControl name={name} label={field.label} value={value} onChange={onChange} />}
  </div>;
}

export default function SpreadStampControls({ settings, onChange, preview }) {
  const parameters = resolveSpreadStampParameters(settings);
  const preset = getLightPreset(parameters.lightAlgorithm);
  const fileInput = useRef(null);
  const mounted = useRef(true), importRequest = useRef(0);
  const jsonId = useId();
  const [message, setMessage] = useState('悬停看光影，点击邮票聚焦；保存后记住本次设置。');
  const [importOpen, setImportOpen] = useState(false);
  const [json, setJson] = useState('');
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; importRequest.current += 1; };
  }, []);
  const replace = next => {
    for (const [key, value] of Object.entries(spreadStampSettingsForParameters(next))) onChange(key, value);
  };
  const algorithm = id => {
    replace(applyLightPreset(parameters, id));
    setMessage(`已预览「${getLightPreset(id).name}」，点击保存后记住。`);
  };
  const importJson = text => {
    try {
      const parsed = JSON.parse(text);
      if (parsed?.format === 'nanfeng-lion-settings' && parsed.version === 1 && parsed.settings && typeof parsed.settings === 'object' && !Array.isArray(parsed.settings)) {
        replace(resolveSpreadStampParameters(parsed.settings));
      } else replace(parseParameters(text));
      setMessage('已导入邮票参数并即时预览；点击保存后记住，取消可恢复。');
      setImportOpen(false);
    } catch (error) { setMessage(error instanceof SyntaxError ? '参数 JSON 格式不正确，请检查后重试。' : error.message); }
  };
  const copy = async () => {
    const text = serializeParameters(parameters);
    try { await navigator.clipboard.writeText(text); setMessage('已复制邮票参数 JSON；复制不会保存未保存的预览。'); }
    catch { setJson(text); setImportOpen(true); setMessage('复制未完成，可在文本框中手动复制参数。'); }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([`${serializeParameters(parameters)}\n`], { type: 'application/json;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = '南风有狮-邮票参数.json'; document.body.append(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    setMessage('已导出52项邮票参数；导出不会保存未保存的预览。');
  };
  return <div className="developer-stamp-controls" data-stamp-settings>
    <p className="developer-settings-note">传章右侧的纸面、六种光影与聚焦交互在这里统一调整；光只影响邮票，不改变其他章节背景。</p>
    <div className="developer-stamp-transfer">
      <button type="button" className="developer-settings-reset" disabled={!preview} onClick={() => preview?.focus()}>聚焦当前邮票</button>
      <button type="button" className="developer-settings-reset" disabled={!preview?.focused} onClick={() => preview?.close()}>返回本组邮票</button>
    </div>
    {!preview && <p className="developer-settings-note">在传章中可直接预览邮票。</p>}
    {PARAMETER_GROUPS.map((group, index) => <details className="developer-settings-group" key={group.id} open={index === 0 || group.id === 'light'}>
      <summary className="developer-settings-group-heading"><h4>{group.title}</h4><small>{group.fields.length}项</small><span className="developer-settings-group-chevron" aria-hidden="true" /></summary>
      <div className="developer-settings-group-content">
        <p className="developer-settings-note">{group.note.replace('自动保存', '保存后记住')}</p>
        {group.fields.map(field => <div key={field.key} className="developer-stamp-field">
          <StampField field={field} value={parameters[field.key]} onChange={onChange} onAlgorithm={algorithm} />
          {field.hint && <p className="developer-settings-note">{field.hint}</p>}
          {field.key === 'lightAlgorithm' && <div className="developer-stamp-preset">
            <p className="developer-settings-note">{preset.description}</p>
            <p className="developer-settings-note" data-preset-state>{isLightPresetModified(parameters) ? '当前光影已微调' : '当前为预设原值'}</p>
            <button className="developer-settings-reset" type="button" onClick={() => algorithm(parameters.lightAlgorithm)}>恢复此光影预设</button>
          </div>}
        </div>)}
        <button className="developer-settings-reset" type="button" onClick={() => {
          replace({ ...parameters, ...Object.fromEntries(group.fields.map(field => [field.key, DEFAULT_PARAMETERS[field.key]])) });
          setMessage(`已预览${group.title}默认值，点击保存后记住。`);
        }}>重置{group.title}</button>
      </div>
    </details>)}
    <div className="developer-stamp-transfer">
      <button type="button" className="developer-settings-reset" onClick={copy}>复制邮票参数</button>
      <button type="button" className="developer-settings-reset" onClick={download}>导出邮票参数</button>
      <button type="button" className="developer-settings-reset" onClick={() => fileInput.current?.click()}>导入邮票参数</button>
      <button type="button" className="developer-settings-reset" onClick={() => { setImportOpen(value => !value); setJson(''); }}>粘贴参数 JSON</button>
      <button type="button" className="developer-settings-reset" onClick={() => { replace(DEFAULT_PARAMETERS); setMessage('已预览全部邮票默认参数，点击保存后记住。'); }}>恢复全部邮票默认参数</button>
      <input ref={fileInput} type="file" className="sr-only" tabIndex={-1} accept=".json,application/json" aria-label="导入邮票参数 JSON 文件" onChange={async event => {
        const input = event.currentTarget, file = input.files?.[0];
        const request = ++importRequest.current;
        if (file) {
          if (file.size > 100000) setMessage('参数文件过大，请选择导出的参数 JSON。');
          else {
            try {
              const contents = await file.text();
              if (mounted.current && importRequest.current === request) importJson(contents);
            } catch { if (mounted.current && importRequest.current === request) setMessage('参数文件无法读取，请重试。'); }
          }
        }
        input.value = '';
      }} />
    </div>
    {importOpen && <div className="developer-stamp-import">
      <label htmlFor={jsonId}>邮票参数 JSON</label>
      <textarea id={jsonId} value={json} onChange={event => setJson(event.target.value)} spellCheck={false} />
      <div><button className="developer-settings-apply" type="button" onClick={() => importJson(json)}>应用邮票参数 JSON</button>
        <button className="developer-settings-reset" type="button" onClick={() => setImportOpen(false)}>收起参数文本框</button></div>
    </div>}
    <p className="developer-settings-note developer-settings-feedback" role="status">{message}</p>
  </div>;
}
