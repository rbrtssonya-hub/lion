import { useId, useMemo } from 'react';
import './research-visuals.css';

const W = 400, H = 228;
const clamp = value => Math.max(0, Math.min(1, Number.isFinite(Number(value)) ? Number(value) : .5));
const fmt = value => Number.isFinite(value) ? value.toFixed(2) : '—';
const nice = value => Number.isFinite(value) ? value.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '—';
const path = (points, close = false) => points.length ? `${points.map((point, index) => `${index ? 'L' : 'M'}${point[0].toFixed(2)},${point[1].toFixed(2)}`).join(' ')}${close ? ' Z' : ''}` : '';
const extent = points => points.reduce((acc, point) => [Math.min(acc[0], point[0]), Math.max(acc[1], point[0]), Math.min(acc[2], point[1]), Math.max(acc[3], point[1])], [Infinity, -Infinity, Infinity, -Infinity]);

function projection(points, box = [38, 28, 324, 160]) {
  const bounds = extent(points);
  if (!Number.isFinite(bounds[0])) return () => [W / 2, H / 2];
  const dx = Math.max(bounds[1] - bounds[0], .00001), dy = Math.max(bounds[3] - bounds[2], .00001);
  const scale = Math.min(box[2] / dx, box[3] / dy);
  return point => [box[0] + box[2] / 2 + (point[0] - (bounds[0] + bounds[1]) / 2) * scale,
    box[1] + box[3] / 2 - (point[1] - (bounds[2] + bounds[3]) / 2) * scale];
}

function Grid({ id }) {
  return <><defs><pattern id={id} width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" className="rv-grid-line" fill="none" /></pattern></defs><rect x="20" y="12" width="360" height="190" fill={`url(#${id})`} /><path d="M20 202H380M20 12V202" className="rv-axis" fill="none" /><text x="22" y="219" className="rv-micro">0</text><text x="376" y="219" textAnchor="end" className="rv-micro">NORMALIZED SPACE</text></>;
}

function Figure({ number, title, english, source, note, children, className = '' }) {
  const id = useId().replace(/:/g, '');
  return <figure className={`rv-figure ${className}`}><figcaption className="rv-figure-heading"><span className="rv-figure-number">{number}</span><div><h4>{title}</h4><span>{english}</span></div><small className={source === '设计推演' ? 'rv-source rv-source-design' : 'rv-source'}>{source}</small></figcaption><svg className="rv-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}，${source}`}><Grid id={`grid-${id}`} />{children}</svg><p className="rv-caption">{note}</p></figure>;
}

function EmptyPlot({ message = '正在读取真实几何数据' }) {
  return <><path d="M174 104H226M200 78V130" className="rv-axis" /><text x="200" y="156" textAnchor="middle" className="rv-empty">{message}</text></>;
}

function HullStudy({ analysis }) {
  const hull = analysis.hull || [];
  const project = projection(hull);
  const plotted = hull.map(project);
  const bounds = hull.length ? extent(hull) : null;
  return <Figure number="01" title="投影外包络" english="ORTHOGRAPHIC ENVELOPE" source="模型采样" note="采样顶点的二维凸包，保留外缘比例；不包含凹陷、孔洞或遮挡轮廓。">{hull.length ? <><path d={path(plotted, true)} className="rv-area" /><path d={path(plotted, true)} className="rv-accent-stroke" /><path d="M200 20V194M32 108H368" className="rv-dashed" />{plotted.filter((_, index) => index % Math.max(1, Math.ceil(plotted.length / 20)) === 0).map((point, index) => <circle key={index} cx={point[0]} cy={point[1]} r="2" className="rv-point" />)}<text x="30" y="28" className="rv-micro">{hull.length} HULL VERTICES</text><text x="370" y="192" textAnchor="end" className="rv-data">W:H {fmt((bounds[1] - bounds[0]) / (bounds[3] - bounds[2] || 1))}</text></> : <EmptyPlot />}</Figure>;
}

function RadialStudy({ analysis, parameter }) {
  const radial = analysis.radial;
  const samples = radial?.samples?.filter(sample => sample.count > 0) || [];
  const scale = 75 / (radial?.maxRadius || 1);
  const point = (sample, radius) => [200 + Math.cos(sample.angle) * radius * scale, 108 - Math.sin(sample.angle) * radius * scale];
  const outer = samples.map(sample => point(sample, sample.radius));
  const interpolation = samples.map(sample => point(sample, sample.meanRadius + (sample.radius - sample.meanRadius) * parameter));
  return <Figure number="02" title="径向提炼" english="RADIAL REDUCTION" source="设计推演" note="48 个角度分箱统计最大与平均半径。朱线在二者间插值，仅表示外缘提炼。">{samples.length ? <><g className="rv-polar-grid">{[25, 50, 75].map(radius => <circle key={radius} cx="200" cy="108" r={radius} />)}{[0, 1, 2, 3, 4, 5, 6, 7].map(index => <path key={index} d={`M200 108L${200 + Math.cos(index * Math.PI / 4) * 82} ${108 + Math.sin(index * Math.PI / 4) * 82}`} />)}</g><path d={path(outer, true)} className="rv-muted-stroke" /><path d={path(interpolation, true)} className="rv-accent-stroke" />{samples.map((sample, index) => <circle key={index} cx={point(sample, sample.radius)[0]} cy={point(sample, sample.radius)[1]} r="1.5" className="rv-teal-point" />)}<circle cx="200" cy="108" r="3" className="rv-point" /><text x="289" y="110" className="rv-micro">0°</text><text x="200" y="24" textAnchor="middle" className="rv-micro">90°</text><text x="30" y="35" className="rv-data">α {parameter.toFixed(2)}</text><text x="30" y="188" className="rv-micro">实测外缘 / 朱线：插值推演</text></> : <EmptyPlot />}</Figure>;
}

const iso = point => [point[0] - point[2] * .72, point[1] - (point[0] + point[2]) * .28];
const componentSize = component => Math.max(...component.size);
const goodComponents = analysis => (analysis.components || []).filter(component => component.center?.length >= 3 && component.size?.length >= 3 && [...component.center, ...component.size].every(Number.isFinite));

function ComponentStudy({ analysis, parameter, mouth = false }) {
  const components = goodComponents(analysis).sort((a, b) => componentSize(b) - componentSize(a)).slice(0, mouth ? 14 : 28);
  const corners = component => {
    const [x, y, z] = component.center, [sx, sy, sz] = component.size;
    return [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1], [-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1]].map(([a, b, c]) => [x + a * sx / 2, y + b * sy / 2, z + c * sz / 2]);
  };
  const to2d = point => mouth ? [point[0], point[1]] : iso(point);
  const project = projection(components.flatMap(component => corners(component).map(to2d)), [52, 29, 296, 151]);
  const centers = components.map(component => project(to2d(component.center)));
  const maxSize = Math.max(...components.map(componentSize), 1e-8);
  const average = centers.length ? centers.reduce((sum, point) => [sum[0] + point[0] / centers.length, sum[1] + point[1] / centers.length], [0, 0]) : [200, 100];
  return <Figure number="01" title={mouth ? '构件正交关系' : '构件空间关系'} english={mouth ? 'COMPONENT PROJECTION' : 'COMPONENT RELATIONS'} source="模型测量" note={mouth ? '逐构件外包围盒与中心的正面投影，不代表实体截面。' : '真实构件中心与外包围盒的轴测投影。按最长轴尺度筛选强调，不改变模型结构。'}>{components.length ? <><g>{components.map((component, index) => {
    const visible = mouth || componentSize(component) / maxSize >= parameter * .8;
    const points = corners(component).map(point => project(to2d(point)));
    return <g key={`${component.name}-${index}`} opacity={visible ? .9 : .16}><path d={`M${average}L${centers[index]}`} className="rv-dashed" />{(mouth ? [[0, 1, 5, 4, 0]] : [[0, 1, 2, 3, 0], [4, 5, 6, 7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]).map((indices, j) => <path key={j} d={path(indices.map(i => points[i]))} className={index % 3 ? 'rv-muted-stroke' : 'rv-accent-stroke'} />)}<circle cx={centers[index][0]} cy={centers[index][1]} r="2.3" className="rv-point" />{index < 5 && <text x={centers[index][0] + 5} y={centers[index][1] - 5} className="rv-micro">{String(index + 1).padStart(2, '0')}</text>}</g>;
  })}</g><text x="30" y="30" className="rv-micro">{components.length} COMPONENTS SHOWN</text></> : <EmptyPlot message="暂无独立构件数据" />}</Figure>;
}

function ScaleStudy({ analysis }) {
  const components = goodComponents(analysis).sort((a, b) => componentSize(b) - componentSize(a)).slice(0, 6);
  const max = Math.max(...components.map(componentSize), 1e-8);
  return <Figure number="02" title="尺度层级" english="DIMENSION HIERARCHY" source="模型测量" note="比较各构件外包围盒的最长轴；以最大构件为 1，不赋予毫米等物理单位。">{components.length ? <>{components.map((component, index) => <g key={index} transform={`translate(35 ${36 + index * 27})`}><text y="10" className="rv-micro">{String(index + 1).padStart(2, '0')}</text><path d="M25 7H293" className="rv-grid-line" /><rect x="25" y="2" width={componentSize(component) / max * 242} height="8" className={index % 2 ? 'rv-teal-fill' : 'rv-accent-fill'} /><text x="332" y="10" textAnchor="end" className="rv-data">{fmt(componentSize(component) / max)}</text></g>)}<text x="35" y="193" className="rv-micro">LONGEST BOUNDING AXIS / MAXIMUM</text></> : <EmptyPlot message="暂无独立构件数据" />}</Figure>;
}

function WidthStudy({ analysis, line = false }) {
  const profile = analysis.profile;
  const samples = profile?.samples?.filter(sample => sample.count > 0) || [];
  const maxWidth = Math.max(...samples.map(sample => sample.width), 1e-8);
  const min = profile?.min || 0, span = (profile?.max - min) || 1;
  const yy = position => 185 - (position - min) / span * 151;
  const left = samples.map(sample => [200 - sample.width / maxWidth * 116, yy(sample.position)]);
  const right = samples.map(sample => [200 + sample.width / maxWidth * 116, yy(sample.position)]);
  const curve = samples.map(sample => [35 + (sample.position - min) / span * 325, 181 - sample.width / maxWidth * 128]);
  return <Figure number="01" title={line ? '宽度节律' : '层间体量'} english={line ? 'BINNED WIDTH RHYTHM' : 'LAYERED WIDTH PROFILE'} source="模型采样" note={line ? `沿 ${profile?.axis || 'y'} 轴分箱，统计采样点在 ${profile?.crossAxes?.[0] || 'x'} 轴的跨度；空箱不生成测量值。` : '每条横线对应一个真实分箱的横向跨度。对称铺排用于比较宽度，不代表原网格对称。'}>{samples.length ? line ? <><path d={path(curve)} className="rv-accent-stroke" />{curve.map((point, index) => <g key={index}><path d={`M${point[0]} 187V${point[1]}`} className="rv-dashed" /><circle cx={point[0]} cy={point[1]} r="2.5" className="rv-point" /></g>)}<text x="32" y="30" className="rv-micro">MAX WIDTH {fmt(maxWidth)} / SCENE UNIT</text></> : <><path d={path(left.concat([...right].reverse()), true)} className="rv-area" /><path d="M200 24V192" className="rv-dashed" />{samples.map((sample, index) => <g key={index}><path d={`M${left[index]}L${right[index]}`} className={index % 3 ? 'rv-muted-stroke' : 'rv-accent-stroke'} /><circle cx={right[index][0]} cy={right[index][1]} r="1.8" className="rv-point" /></g>)}<text x="30" y="30" className="rv-micro">{samples.length} OCCUPIED BINS</text></> : <EmptyPlot />}</Figure>;
}

function FlowStudy({ analysis, parameter }) {
  const profile = analysis.profile;
  const samples = profile?.samples?.filter(sample => sample.count > 0 && sample.center) || [];
  const axes = { x: 0, y: 1, z: 2 };
  const cross = axes[profile?.crossAxes?.[0]] ?? 0, along = axes[profile?.axis] ?? 1;
  const raw = samples.map(sample => [sample.center[cross], sample.center[along]]);
  const project = projection(raw, [160, 35, 80, 146]);
  const centers = raw.map(project);
  return <Figure number="02" title="质心导流" english="CENTROID FLOW STUDY" source="设计推演" note="青线连接分箱顶点的平均位置；朱线依据实测宽度扩展成流线，偏移强度为设计参数。">{samples.length ? <>{[-1, -.67, -.33, .33, .67, 1].map((offset, index) => {
    const max = Math.max(...samples.map(sample => sample.width), 1e-8);
    const shifted = centers.map((center, i) => [center[0] + samples[i].width / max * offset * (34 + parameter * 85), center[1]]);
    return <path key={index} d={path(shifted)} className="rv-accent-stroke" opacity={.25 + Math.abs(offset) * .5} />;
  })}<path d={path(centers)} className="rv-teal-stroke" />{centers.filter((_, i) => i % 3 === 0).map((point, index) => <circle key={index} cx={point[0]} cy={point[1]} r="2.3" className="rv-teal-point" />)}<text x="30" y="31" className="rv-micro">MEASURED CENTROIDS + OFFSET FIELD</text><text x="30" y="190" className="rv-data">偏移强度 {parameter.toFixed(2)}</text></> : <EmptyPlot />}</Figure>;
}

function UVStudy({ analysis }) {
  const raw = Array.isArray(analysis.uvStudy) ? analysis.uvStudy : analysis.uvStudy?.points || analysis.uvStudy?.uvPoints || [];
  const points = raw.map(point => Array.isArray(point) ? point : [point.u, point.v]).filter(point => point.length >= 2 && point.slice(0, 2).every(Number.isFinite));
  const project = projection(points.concat([[0, 0], [1, 1]]), [77, 23, 246, 161]);
  const zero = project([0, 0]), one = project([1, 1]);
  const uvBounds = points.length ? extent(points) : [0, 1, 0, 1];
  return <Figure number="01" title="表面坐标" english="UV COORDINATE SAMPLES" source="模型采样" note={points.length ? `${nice(points.length)} 个真实 UV 样本。坐标分布展示表面映射，不推断原织锦纹样的文化含义。` : '当前部位未提供 UV 样本。这里保留空白，不以生成纹样冒充原始贴图。'}>{points.length ? <><rect x={zero[0]} y={one[1]} width={one[0] - zero[0]} height={zero[1] - one[1]} className="rv-uv-boundary" />{points.filter((_, i) => i % Math.max(1, Math.ceil(points.length / 1600)) === 0).map((point, index) => <circle key={index} cx={project(point)[0]} cy={project(point)[1]} r="1.05" className="rv-teal-point" opacity=".3" />)}<text x="30" y="29" className="rv-micro">U {fmt(uvBounds[0])}–{fmt(uvBounds[1])}</text><text x="30" y="192" className="rv-micro">V {fmt(uvBounds[2])}–{fmt(uvBounds[3])}</text><text x={one[0] + 5} y={one[1] + 2} className="rv-micro">1,1</text></> : <EmptyPlot message="未提供 UV 样本" />}</Figure>;
}

function RepeatStudy({ analysis, parameter }) {
  const hull = analysis.hull || [];
  const count = 3 + Math.round(parameter * 4);
  const palette = analysis.palette?.colors || [];
  const project = projection(hull, [0, 0, 26, 23]);
  const motif = hull.map(project);
  const repeats = Array.from({ length: count * 4 }, (_, index) => ({ x: 42 + index % count * 312 / count, y: 34 + Math.floor(index / count) * 35 }));
  return <Figure number="02" title="轮廓成序" english="MOTIF REPETITION" source="设计推演" note="将该部位的投影凸包作为单元，以材质基色重组。此图为当代设计推演，并非提取的原织锦纹样。">{motif.length ? <>{repeats.map((repeat, index) => <g key={index} transform={`translate(${repeat.x} ${repeat.y})`}><path d={path(motif, true)} fill={palette[index % Math.max(palette.length, 1)]?.color || 'var(--accent, #a3412f)'} fillOpacity=".28" stroke={palette[index % Math.max(palette.length, 1)]?.color || 'var(--accent, #a3412f)'} strokeWidth=".7" /></g>)}<text x="30" y="192" className="rv-data">{count} × 4 / REPEAT ARRAY</text></> : <EmptyPlot />}</Figure>;
}

function TextileStudy({ parameter }) {
  const id = useId().replace(/:/g, '');
  const size = 110 / (1 + parameter * 1.8);
  return <Figure number="02" title="纹样平铺" english="TEXTILE REPEAT STUDY" source="设计推演" note="使用模型内置的原始织锦贴图重排重复。密度为设计参数，不推断模型原有 UV 的实际平铺次数。"><defs><pattern id={`brocade-${id}`} patternUnits="userSpaceOnUse" x="35" y="25" width={size} height={size}><image href="/models/brocade.jpg" width={size} height={size}/><path d={`M0 ${size}V0H${size}`} fill="none" stroke="#fff6e5" strokeWidth=".7"/></pattern></defs><rect x="35" y="25" width="325" height="152" fill={`url(#brocade-${id})`}/><text x="35" y="192" className="rv-micro">ORIGINAL TEXTURE / VARIABLE REPEAT</text></Figure>;
}

function ReconstructionStudy({ analysis, parameter }) {
  const samples = analysis.profile?.samples?.filter(sample => sample.count > 0) || [];
  const max = Math.max(...samples.map(sample => sample.width), 1e-8);
  const radius = 1 + Math.round(parameter * 4);
  const raw = samples.map((sample, index) => [35 + index / Math.max(1, samples.length - 1) * 325, 181 - sample.width / max * 125]);
  const fitted = samples.map((sample, index) => {
    const neighbors = samples.slice(Math.max(0, index - radius), index + radius + 1);
    const average = neighbors.reduce((sum, neighbor) => sum + neighbor.width, 0) / neighbors.length;
    return [raw[index][0], 181 - average / max * 125];
  });
  return <Figure number="02" title="连续性重构" english="MOVING-AVERAGE RECONSTRUCTION" source="设计推演" note={`对分箱宽度采用半径 ${radius} 的移动平均。虚线为采样值，朱线为计算重构；不推断真实装饰周期。`}>{samples.length ? <><path d={path(raw)} className="rv-dashed" /><path d={path(fitted)} className="rv-accent-stroke" /><path d={path([[35, 187], ...fitted, [360, 187]], true)} className="rv-area" /><text x="30" y="30" className="rv-micro">WINDOW {radius * 2 + 1} / SLIDING MEAN</text><path d="M285 34H306" className="rv-dashed" /><text x="312" y="37" className="rv-micro">采样</text><path d="M285 49H306" className="rv-accent-stroke" /><text x="312" y="52" className="rv-micro">重构</text></> : <EmptyPlot />}</Figure>;
}

function MouthStudy({ analysis, parameter }) {
  const components = goodComponents(analysis).sort((a, b) => a.center[1] - b.center[1]);
  const middle = Math.ceil(components.length / 2);
  const groups = [components.slice(middle), components.slice(0, middle)];
  const groupBounds = group => group.reduce((box, component) => [Math.min(box[0], component.center[0] - component.size[0] / 2), Math.max(box[1], component.center[0] + component.size[0] / 2), Math.min(box[2], component.center[1] - component.size[1] / 2), Math.max(box[3], component.center[1] + component.size[1] / 2)], [Infinity, -Infinity, Infinity, -Infinity]);
  const bounds = groups.map(groupBounds);
  const maxWidth = Math.max(...bounds.map(box => box[1] - box[0]), .00001);
  return <Figure number="02" title="开合的可能" english="OPENING / CONTEMPORARY STUDY" source="设计推演" note="按构件质心高度分为两组，以实测横向尺度生成开合示意。这里不声称模型具有骨骼或真实活动关节。">{components.length > 1 ? <>{bounds.map((box, index) => {
    const width = (box[1] - box[0]) / maxWidth * 270;
    const y = index ? 130 + parameter * 29 : 77 - parameter * 29;
    return <g key={index}><rect x={200 - width / 2} y={y - 10} width={width} height="20" rx="10" className={index ? 'rv-muted-area' : 'rv-area'} /><path d={`M${200 - width / 2} ${y}H${200 + width / 2}`} className={index ? 'rv-muted-stroke' : 'rv-accent-stroke'} /><circle cx="200" cy={y} r="3" className="rv-point" /><text x="32" y={y + 3} className="rv-micro">{index ? 'LOWER' : 'UPPER'}</text></g>;
  })}<path d={`M350 ${77 - parameter * 29}V${130 + parameter * 29}M345 ${77 - parameter * 29}H355M345 ${130 + parameter * 29}H355`} className="rv-teal-stroke" /><text x="200" y="193" textAnchor="middle" className="rv-data">OPENING α {parameter.toFixed(2)}</text></> : <EmptyPlot message="单一构件，不虚构上下网格拆分" />}</Figure>;
}

const PARAMETER_LABELS = {
  brows: ['外缘提炼', '径向均值 → 最大外缘', '设计推演'],
  crown: ['尺度筛选', '全部构件 → 强调大构件', '数据筛选'],
  beard: ['流线展开', '收束 → 舒展', '设计推演'],
  body: ['重复密度', '疏 → 密', '设计推演'],
  trim: ['平滑范围', '局部变化 → 连续节律', '设计推演'],
  mouth: ['开合幅度', '收拢 → 张开', '设计推演'],
};

/** Independent SVG research panels. `analysis` is the PartRegistry geometry
 * output; `components:[{name,center:[x,y,z],size:[x,y,z]}]` and `uvStudy.points`
 * are optional. All measurement units remain normalized model coordinates.
 */
export default function ResearchVisuals({ part, analysis, parameter = .5, onParameterChange }) {
  const value = clamp(parameter);
  const id = part?.id;
  const label = PARAMETER_LABELS[id] || ['研究参数', '0 → 1', '设计推演'];
  const count = analysis?.sampling?.sampled ?? analysis?.points?.length;
  const panels = useMemo(() => {
    if (!analysis) return null;
    switch (id) {
      case 'brows': return <><HullStudy analysis={analysis} /><RadialStudy analysis={analysis} parameter={value} /></>;
      case 'crown': return <><ComponentStudy analysis={analysis} parameter={value} /><ScaleStudy analysis={analysis} /></>;
      case 'beard': return <><WidthStudy analysis={analysis} /><FlowStudy analysis={analysis} parameter={value} /></>;
      case 'body': return <><UVStudy analysis={analysis} /><TextileStudy parameter={value} /></>;
      case 'trim': return <><WidthStudy analysis={analysis} line /><ReconstructionStudy analysis={analysis} parameter={value} /></>;
      case 'mouth': return <><ComponentStudy analysis={analysis} parameter={value} mouth /><MouthStudy analysis={analysis} parameter={value} /></>;
      default: return <><HullStudy analysis={analysis} /><ScaleStudy analysis={analysis} /></>;
    }
  }, [analysis, id, value]);
  if (!analysis) return <div className="research-visuals rv-waiting" role="status"><span className="rv-loading-mark">＋</span><p>正在读取这一部位的真实几何</p><small>GEOMETRY ANALYSIS IN PROGRESS</small></div>;
  return <section className="research-visuals" aria-label={`${part?.name || part?.title || '部位'}几何研究`}><div className="rv-panel-grid">{panels}</div><div className="rv-parameter"><label><span>{label[0]}<small>{label[2]}</small></span><output>{value.toFixed(2)}</output><input type="range" min="0" max="1" step="0.01" value={value} onChange={event => onParameterChange?.(Number(event.target.value))} aria-label={label[0]} /></label><p>{label[1]}</p></div><div className="rv-method-note"><span>DATA / METHOD</span><p>{nice(count)} 个顶点样本 · {nice(analysis.triangleCount)} 个三角面。{analysis.sampling?.approximate ? '分箱与外包络为有限采样近似。' : '几何统计来自当前部位。'}材质色按真实三角面积加权；不包含光照与贴图色。</p></div></section>;
}
