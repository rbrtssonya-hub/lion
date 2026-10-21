import { useLayoutEffect, useId, useRef, useState } from 'react';
import { surfaceDefaults, surfaceDefinitions, surfaceScopes } from './surfaceSettings.js';
import { hdriDefaults, hdriRanges } from '../../config/hdri.js';
import { viewDefaults, viewRanges } from '../../config/viewSettings.js';
import HdriSourceControls from './HdriSourceControls.jsx';
import { ColorControl, MaterialControls, RangeControl, SettingsGroup, SettingsSubpages, SettingsTabList, ToggleControl } from './SettingsControls.jsx';
import './developer-settings.css';
import './surface-settings.css';

const pages = [
  { id:'common', label:'公共模块', title:'公共材质模板', note:'同一套材质应用到所选范围，各区域尺寸与文字不受影响。', icon:'M3 3h6v6H3zM11 3h6v6h-6zM3 11h6v6H3zM11 11h6v6h-6z' },
  { id:'appearance', label:'外观', title:'顶栏与设置面板', note:'全局界面材质；内容底板在首页、章节和资料中分别管理。', icon:'M4 5h12v10H4zM4 9h12M8 9v6' },
  { id:'navigation', label:'导航', title:'导航文字与位置', note:'统一管理顶部导航的字号、图案及品牌留白。', icon:'M4 6h12M4 10h8M4 14h12' },
  { id:'home', label:'首页', title:'首页阅读与书册', note:'按书册、文化图鉴分开管理，独立调整尺寸和材质。', icon:'M3 5q4-2 7 0 3-2 7 0v11q-4-2-7 0-3-2-7 0zM10 5v11' },
  { id:'chapters', label:'章节', title:'章节专属设置', note:'结构、动作与神态各有独立子页，不混入全局导航。', icon:'M3 4h14v12H3zM7 4v12M12 4v12' },
  { id:'view', label:'视角', title:'结构与动作观看视角', note:'分别调整结构模型缩放边界和动作场景的观察范围。', icon:'M2 10q8-11 16 0-8 11-16 0M7 10a3 3 0 1 0 6 0 3 3 0 1 0-6 0' },
  { id:'hdri', label:'HDRI', title:'HDRI环境照明', note:'结构与动作共用同一套照明参数，调整后即时生效并自动保存。', icon:'M3 10a7 7 0 1 1 14 0 7 7 0 1 1-14 0M3 10h14M10 3c-4 4-4 10 0 14 4-4 4-10 0-14' },
  { id:'sources', label:'资料', title:'参考资料底板', note:'外区与资料卡分别管理，来源与许可保持可读。', icon:'M5 3h10v14H5zM8 7h4M8 10h4M8 13h4' },
  { id:'animation', label:'动画', title:'全局过渡与粒子', note:'导航变速与两套首页导航的粒子开关；书册时长在首页。', icon:'M3 14c4 0 5-8 10-8h4m-3-3 3 3-3 3' },
  { id:'carousel', label:'轮播', title:'文化照片轮播', note:'只影响首页文化图鉴的照片与文字切换。', icon:'M5 4h10v12H5zM2 7v6M18 7v6m-10-3 4 2-4 2z' },
  { id:'layout', label:'布局', title:'面板布局与页面交互', note:'调整设置面板宽度、推开方式与文字选择。', icon:'M3 4h14v12H3zM12 4v12' },
];
const homePages = [{id:'book',label:'书册'},{id:'culture',label:'图鉴'}];
const chapterPages = [{id:'model',label:'结构'},{id:'action',label:'动作'},{id:'expression',label:'神态'}];
const easingOptions = [
  {value:'smooth',label:'平滑进出',note:'缓慢起步，加速移动，再平稳停下。'},
  {value:'swift',label:'快速收拢',note:'快速响应，接近终点时逐渐减速。'},
  {value:'soft',label:'柔和缓出',note:'柔和启动，以更长的减速过程落位。'},
];
const defaultMaterial = Object.fromEntries(['Transparency','Blur','Radius','Color'].map(suffix => [suffix,surfaceDefaults[`cultureBody${suffix}`]]));

export default function DeveloperSettingsPanel({ open, settings, onChange, onApplyMaterial, onClose, onReset, panelRef, canPush, onKeyDown, resizeHandle }) {
  const panelId = useId(), scopeId = useId(), easingId = useId();
  const [activePage, setActivePage] = useState('common');
  const [subpages, setSubpages] = useState({home:'book',chapters:'model'});
  const [scope, setScope] = useState('home');
  const [material, setMaterial] = useState(defaultMaterial);
  const [message, setMessage] = useState('尚未应用。编辑模板后，点击下方按钮生效。');
  const scrollRef = useRef(null), scrollPositions = useRef({});
  useLayoutEffect(() => {
    if (open && scrollRef.current) scrollRef.current.scrollTop = scrollPositions.current[activePage] ?? 0;
  }, [activePage, open, subpages]);
  if (!open) return null;
  const selectPage = id => {
    if (scrollRef.current) scrollPositions.current[activePage] = scrollRef.current.scrollTop;
    setActivePage(id);
  };
  const selectSubpage = (group,id) => {
    scrollPositions.current[activePage] = 0;
    setSubpages(current => ({...current,[group]:id}));
  };
  const range = (name,label,min,max,step=1,unit='px') => <RangeControl name={name} label={label} value={settings[name]} min={min} max={max} step={step} unit={unit} onChange={onChange} />;
  const hdriRange = (name,label,unit) => range(name,label,...hdriRanges[name],unit);
  const viewRange = (name,label,unit) => range(name,label,...viewRanges[name],unit);
  const surfaces = prefixes => surfaceDefinitions.filter(surface => prefixes.includes(surface.prefix)).map(surface => {
    const {prefix,label,heightStep=10} = surface;
    return <SettingsGroup key={prefix} title={label} note="独立设置">
      {range(`${prefix}Width`,`${label}宽度`,40,100,1,'%')}
      {range(`${prefix}Height`,`${label}${prefix === 'bookTitle' ? '最小高度' : '高度'}`,0,900,heightStep)}
      {prefix === 'bookTitle' && range('bookTitleSpacing','标题底板留白',50,150,1,'%')}
      <MaterialControls prefix={prefix} label={label} values={settings} onChange={onChange} />
      <p className="developer-settings-note">宽度相对所属区域；最小高度 0 为自动，内容不会被裁掉。透明度 100 时底色、模糊与淡纹理一并移除。</p>
    </SettingsGroup>;
  });
  const content = id => {
    switch (id) {
      case 'common': return <>
        <SettingsGroup title="公共材质" note="应用后统一保存">
          <div className="developer-settings-select-control"><label htmlFor={scopeId}>应用范围</label>
            <select id={scopeId} value={scope} onChange={event => {setScope(event.target.value);setMessage('范围已更改，点击应用后生效。');}}>
              {Object.entries(surfaceScopes).map(([value,item]) => <option key={value} value={value}>{item.label}</option>)}
            </select>
          </div>
          <MaterialControls label="公共" values={material} onChange={(name,value) => { setMaterial(current => ({...current,[name]:value})); setMessage('模板已修改，点击应用后生效。'); }} />
          <button type="button" className="developer-settings-apply" onClick={() => {
            onApplyMaterial(scope,material);
            setMessage(`已应用到${surfaceScopes[scope].prefixes.length}处底板；宽高、字号与播放偏好保持不变。`);
          }}>应用公共材质</button>
          <p className="developer-settings-note developer-settings-feedback" role="status">{message}</p>
        </SettingsGroup>
        <SettingsGroup title="首页阅读快速调整" note="即时预览">
          {range('archivePanelTransparency','首页阅读底板透明度',0,100,1,'%')}
          <p className="developer-settings-note">仅同步书册与图鉴的四处透明度。独立微调请前往“首页”；此项不改公共模板。</p>
        </SettingsGroup>
      </>;
      case 'appearance': return <>
        <SettingsGroup title="顶栏外观" note="导航底板">
          {range('headerWidth','顶栏宽度',60,100,1,'%')}{range('headerHeight','顶栏高度',64,180)}
          {range('headerTransparency','顶栏透明度',0,100,1,'%')}{range('headerBlur','顶栏模糊强度',0,30)}
          {range('headerRadius','顶栏圆角',0,100)}<ColorControl name="headerColor" label="顶栏底色" value={settings.headerColor} onChange={onChange}/>
        </SettingsGroup>
        <SettingsGroup title="侧栏外观" note="设置背板">
          {range('sidebarHeight','侧栏高度',50,100,1,'%')}{range('sidebarTransparency','侧栏透明度',0,100,1,'%')}
          {range('sidebarBlur','侧栏模糊强度',0,30)}{range('sidebarRadius','侧栏圆角',0,100)}
          <ColorControl name="sidebarColor" label="侧栏底色" value={settings.sidebarColor} onChange={onChange}/>
        </SettingsGroup>
      </>;
      case 'navigation': return <>
        <SettingsGroup title="导航文字与图案" note="全站通用">
          {range('navFontSize','导航标题字号',14,28)}{range('helperFontSize','导航辅助文字字号',10,28)}
          {range('navIconSize','导航图标尺寸',24,56)}{range('helperTransparency','辅助文字透明度',0,100,1,'%')}
        </SettingsGroup>
        <SettingsGroup title="导航与品牌位置" note="位置与间距">
          {range('brandPadding','品牌左侧留白',8,80)}{range('compactNavGap','紧凑导航图标间距',4,36)}
          {range('compactNavInset','紧凑导航右侧留白',16,160)}{range('homeBrandOffset','首页品牌右移距离',0,160)}
        </SettingsGroup>
      </>;
      case 'home': return <SettingsSubpages label="首页设置分区" items={homePages} value={subpages.home} onChange={id => selectSubpage('home',id)}>{value => value === 'book' ? <>
        {surfaces(['bookTitle','bookDetails'])}
        <SettingsGroup title="画册首次翻阅" note="自动开卷节奏">
          {range('bookScale','书册放大比例',90,145,1,'%')}{range('bookStageHeight','书册展示区高度',480,960,10)}
          {range('bookIntroDuration','画册首次翻阅时长',3,30,1,'秒')}
          <p className="developer-settings-note">默认12秒完成七次翻页；调整不会重播已完成的首次翻阅，也不改变手动翻页物理。</p>
        </SettingsGroup>
      </> : surfaces(['cultureTitle','cultureBody'])}</SettingsSubpages>;
      case 'chapters': return <SettingsSubpages label="章节设置分区" items={chapterPages} value={subpages.chapters} onChange={id => selectSubpage('chapters',id)}>{value => <>
        {surfaces(value === 'model' ? ['modelOverlay'] : value === 'action' ? ['actionOverlay','videoOverlay'] : ['expressionOverlay'])}
        {value === 'expression' && <SettingsGroup title="神态文字" note="简介与解读">
          {range('expressionOverviewFontSize','神态简介字号',16,32)}{range('expressionDetailFontSize','神态解读字号',16,32)}
        </SettingsGroup>}
      </>}</SettingsSubpages>;
      case 'sources': return surfaces(['cultureSources','cultureSourceCard']);
      case 'view': return <>
        <SettingsGroup title="结构模型视角" note="缩放阈值">
          {viewRange('structureMinDistanceRatio','结构最近观看距离','×')}
          {viewRange('structureMaxDistanceRatio','结构最远观看距离','×')}
          {viewRange('structureFov','结构镜头视野','°')}
          <p className="developer-settings-note">距离以整体标准观看距离为基准；聚焦部件时，最近距离按该部件的标准观看距离计算。最近距离限制放大，最远距离限制缩小；窗口变化时同步适配。</p>
        </SettingsGroup>
        <SettingsGroup title="动作场景视角" note="自由观察">
          {viewRange('actionMinDistance','动作最近观看距离','m')}
          {viewRange('actionMaxDistance','动作最远观看距离','m')}
          {viewRange('actionMinPolarAngle','动作俯视角度下限','°')}
          {viewRange('actionMaxPolarAngle','动作仰视角度上限','°')}
          {viewRange('actionFov','动作镜头视野','°')}
          <p className="developer-settings-note">默认开放接近完整的俯仰范围；极角0°为正上方，90°为水平，180°为正下方。</p>
        </SettingsGroup>
        <button type="button" className="developer-settings-reset" onClick={() => {
          for (const [name,value] of Object.entries(viewDefaults)) onChange(name,value);
        }}>恢复视角默认参数</button>
      </>;
      case 'hdri': return <>
        <SettingsGroup title="环境贴图" note="结构 · 动作">
          <HdriSourceControls settings={settings} onChange={onChange} />
          <ToggleControl name="hdriEnabled" label="HDRI环境照明" value={settings.hdriEnabled} onChange={onChange}/>
          <p className="developer-settings-note">贴图只用于照明与反射，保留结构页背景与动作剧场场景。</p>
        </SettingsGroup>
        <SettingsGroup title="HDRI参数" note="两章同步">
          {hdriRange('hdriIntensity','HDRI强度','倍')}
          {hdriRange('hdriRotation','HDRI水平旋转','°')}
          {hdriRange('hdriExposure','HDRI曝光补偿','EV')}
          <p className="developer-settings-note">旋转改变光线方向；曝光作用于整个3D画面，每增加1 EV，曝光倍率翻倍。</p>
        </SettingsGroup>
        <SettingsGroup title="辅助灯光" note="配合环境光">
          {hdriRange('hdriLightIntensity','辅助灯光强度','倍')}
          <p className="developer-settings-note">调节场景原有主光、补光、轮廓光与建筑灯。设为0可关闭辅助灯光；视频与发光装饰不受影响。</p>
          <button type="button" className="developer-settings-reset" onClick={() => {
            for (const [name,value] of Object.entries(hdriDefaults)) onChange(name,value);
          }}>恢复HDRI默认参数</button>
        </SettingsGroup>
        <SettingsGroup title="材质对照" note="Blender与网页">
          <p className="developer-settings-note">醒狮使用接近Blender的均衡环境照明，保留原有造型、配色与材质。实时发丝采样和毛发自遮挡仍有差异，同一HDRI不保证两端画面完全一致。</p>
          <p className="developer-settings-note">可先用森林环境、HDRI强度1、曝光0 EV、辅助灯光0.35倍进行对照，再按画面调整。两张对照图的取景、显示变换也需要一致。</p>
        </SettingsGroup>
      </>;
      case 'animation': return <>
        <SettingsGroup title="运动节奏" note="全局导航">
          {range('navigationDuration','导航动画时长',200,1600,10,'ms')}
          <div className="developer-settings-select-control"><label htmlFor={easingId}>动画变速曲线</label>
            <select id={easingId} value={settings.navigationEasing} onChange={event => onChange('navigationEasing',event.target.value)}>
              {easingOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select><p className="developer-settings-note">{easingOptions.find(option => option.value === settings.navigationEasing)?.note}</p>
          </div>
        </SettingsGroup>
        <SettingsGroup title="首页导航粒子" note="两套导航共用">
          <ToggleControl name="bookInkEnabled" label="书册导航粒子拖尾" value={settings.bookInkEnabled} onChange={onChange}/>
          <p className="developer-settings-note">同步控制七年代角色与左侧栏目导航的粒子。减少动态时自动停止；书册尺寸与时长在“首页→书册”。</p>
        </SettingsGroup>
      </>;
      case 'carousel': return <>
        <SettingsGroup title="播放节奏" note="自动与恢复">
          <ToggleControl name="carouselAutoplay" label="照片自动播放" value={settings.carouselAutoplay} onChange={onChange}/>
          {range('carouselInterval','自动播放间隔',2,30,1,'秒')}{range('carouselResumeDelay','离开后恢复等待',1,15,1,'秒')}
          <p className="developer-settings-note">悬停前景照片暂停；点击查看下一张，移开后等待再恢复。</p>
        </SettingsGroup>
        <SettingsGroup title="照片动效" note="过渡与聚焦">
          {range('carouselTransitionDuration','照片过渡时长',300,1600,50,'ms')}{range('carouselFocusScale','照片聚焦比例',101,110,1,'%')}
          <p className="developer-settings-note">减少动态时保留静态图片与手动切换，不自动播放。</p>
        </SettingsGroup>
      </>;
      case 'layout': return <>
        <SettingsGroup title="页面命中" note="文字选择">
          <ToggleControl name="pageHitEnabled" label="网页页面是否能被命中" value={settings.pageHitEnabled} onChange={onChange}/>
          <p className="developer-settings-note">默认关闭正文选中与视频命中；导航、模型、书册按钮仍可操作。</p>
        </SettingsGroup>
        <SettingsGroup title="面板布局" note="覆盖或推开">
          <ToggleControl name="pushPage" label="设置面板推开页面" value={settings.pushPage} onChange={onChange}/>
          <p className="developer-settings-note" aria-live="polite">{settings.pushPage && !canPush ? '窗口空间不足，暂时覆盖显示；加宽窗口后自动推开页面。' : settings.pushPage ? '页面为侧栏留出空间，关闭面板后恢复。' : '面板覆盖在页面右侧，页面保持原有宽度。'}</p>
          {range('panelWidth','设置面板宽度',280,760)}
          <p className="developer-settings-note">顶栏底边与面板左边仍可拖动，参数会自动保存。</p>
        </SettingsGroup>
      </>;
    }
  };
  return <aside className="developer-settings-panel" id="developerSettingsPanel" role="region" aria-label="开发者参数设置" tabIndex={-1} ref={panelRef} onKeyDown={onKeyDown}>
    {resizeHandle}
    <div className="developer-settings-header"><div className="developer-settings-heading"><div>
      <span className="developer-settings-eyebrow">南风有狮 · 界面调整</span><h2>开发者参数设置</h2>
    </div><button className="developer-settings-close" type="button" aria-label="关闭开发者参数" onClick={onClose}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15"/></svg></button></div>
    <p className="developer-settings-intro">选择分类后展开所需参数，公共模板按范围应用。</p></div>
    <SettingsTabList id={panelId} label="设置分类" items={pages} value={activePage} onChange={selectPage} vertical/>
    <div className="developer-settings-scroll" ref={scrollRef} onScroll={() => { scrollPositions.current[activePage] = scrollRef.current.scrollTop; }}>
      {pages.map(page => <div key={page.id} className="developer-settings-page" id={`${panelId}-page-${page.id}`} role="tabpanel" aria-labelledby={`${panelId}-tab-${page.id}`} tabIndex={0} hidden={activePage !== page.id}>
        <div className="developer-settings-page-heading"><h3>{page.title}</h3><p className="developer-settings-note">{page.note}</p></div>
        {content(page.id)}
      </div>)}
    </div>
    <div className="developer-settings-footer"><p className="developer-settings-note">独立参数与应用结果自动保存 · 模板草稿仅本次会话</p>
      <button className="developer-settings-reset" type="button" onClick={() => {onReset();setMaterial(defaultMaterial);setScope('home');setMessage('已恢复默认参数与公共模板。');}}>恢复默认参数</button>
    </div>
  </aside>;
}
