import { useEffect, useId, useState } from 'react';

export default function HdriSourceControls({ settings, onChange }) {
  const id = useId();
  const [url, setUrl] = useState(settings.hdriUrl);
  const [error, setError] = useState('');
  useEffect(() => { setUrl(settings.hdriUrl); }, [settings.hdriUrl]);
  return <>
    <div className="developer-settings-select-control">
      <label htmlFor={`${id}-source`}>HDRI来源</label>
      <select id={`${id}-source`} value={settings.hdriSource} onChange={event => {
        setError(''); onChange('hdriSource', event.target.value);
      }}>
        <option value="forest">Blender森林（forest.exr）</option>
        <option value="default">工程内置环境</option>
        <option value="url">自定义链接</option>
        <option value="local">本地EXR / HDR文件</option>
      </select>
    </div>
    {settings.hdriSource === 'default' && <p className="developer-settings-note">citrus_orchard_road_puresky_4k.exr</p>}
    {settings.hdriSource === 'forest' && <p className="developer-settings-note">forest.exr · 与Blender材质预览使用同一环境贴图。</p>}
    {settings.hdriSource === 'url' && <form className="developer-settings-source-control" onSubmit={event => {
      event.preventDefault();
      const value = url.trim();
      try {
        if (!value || value.length > 2048 || !['http:', 'https:'].includes(new URL(value, window.location.href).protocol)) throw new Error();
        setError(''); onChange('hdriUrl', value);
      } catch { setError('请输入可访问的EXR或HDR链接，也可以使用工程内的相对路径。'); }
    }}>
      <label htmlFor={`${id}-url`}>HDRI文件链接</label>
      <input id={`${id}-url`} type="text" value={url} placeholder="https://…/forest.exr" onChange={event => setUrl(event.target.value)} spellCheck={false} />
      <button type="submit" className="developer-settings-apply">应用HDRI链接</button>
      <p className="developer-settings-note">应用后即时预览，点击“保存设置”后记住链接；外部服务器需要允许跨域读取。</p>
    </form>}
    {settings.hdriSource === 'local' && <div className="developer-settings-source-control">
      <label htmlFor={`${id}-file`}>选择本地HDRI文件</label>
      <input id={`${id}-file`} type="file" accept=".exr,.hdr" onChange={event => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        if (!/\.(exr|hdr)$/i.test(file.name)) { setError('请选择.exr或.hdr环境贴图。'); return; }
        setError(''); onChange('hdriFile', file);
      }} />
      <p className="developer-settings-note" role="status">{settings.hdriFile ? `当前文件：${settings.hdriFile.name}` : '尚未选择本地文件，暂用森林环境。'}</p>
      <p className="developer-settings-note">本地文件仅当前会话使用，刷新后恢复森林环境。</p>
    </div>}
    {error && <p className="developer-settings-note" role="alert">{error}</p>}
  </>;
}
