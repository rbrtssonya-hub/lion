/*
 * Content adapter for the MIT-licensed ThreeUI Sketchbook 1.2.0.
 * The installed Sketchbook supplies the document. Its curved strips, paper
 * lighting, springs, pointer handlers and turn functions remain unchanged.
 * Upstream: https://github.com/MengTo/threeui/tree/main/src/shaders/sketchbook
 * Copyright (c) 2026 Meng To. Full notice: /assets/licenses/threeui-LICENSE.txt.
 */

const STYLE_START = '/* ---------------- sketchbook ---------------- */';
const STYLE_END = '/* ---------------- painted rules + sections ---------------- */';
const LOUPE_STYLE_START = '/* ---- the loupe: a real magnifier lying on the page.';
const LOUPE_SCRIPT_START = '/* --------------------------------------------------- loupe + controls */';
const INDEX_SCRIPT_START = '/* --------------------------------------------------------- the index */';
const PAGE_FILES = ['cover.png', 'origin.png', 'formation.png', 'martial.png', 'spread.png', 'modern.png', 'ending.png'];

function fail(message) {
  throw new Error(`ThreeUI Sketchbook 1.2.0 adaptation failed: ${message}`);
}

// A version/structure guard, not a security hash. Only the asset directory is
// normalized; changes to any upstream engine instruction require a new audit.
function fingerprint(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16);
}

function onePosition(value, needle) {
  const position = value.indexOf(needle);
  if (position < 0 || value.indexOf(needle, position + needle.length) >= 0) fail(`expected one ${needle.slice(0, 65)}`);
  return position;
}

function between(value, start, end) {
  const from = onePosition(value, start);
  const to = onePosition(value, end);
  if (to <= from) fail('unexpected document order');
  return value.slice(from, to);
}

function replaceOne(value, before, after) {
  onePosition(value, before);
  return value.replace(before, () => after);
}

function scriptJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

function checkOptions(pages, assetBaseUrl, channelId, maxWidth) {
  if (!Array.isArray(pages) || pages.length !== PAGE_FILES.length) fail('exactly seven archive spreads are required');
  const ids = new Set();
  pages.forEach((page, index) => {
    if (!page || page.file !== PAGE_FILES[index]) fail(`unexpected spread file at ${index}`);
    for (const key of ['id', 'title', 'era', 'description']) {
      if (typeof page[key] !== 'string' || !page[key].trim()) fail(`missing ${key} at ${index}`);
    }
    if (ids.has(page.id)) fail('duplicate spread id');
    ids.add(page.id);
    if (page.stage !== null && !['string', 'number'].includes(typeof page.stage)) fail(`invalid stage at ${index}`);
  });
  let base;
  try { base = new URL(assetBaseUrl); } catch { fail('an absolute assetBaseUrl is required'); }
  if (!['http:', 'https:'].includes(base.protocol) || base.search || base.hash || base.username || base.password) fail('invalid assetBaseUrl');
  if (typeof channelId !== 'string' || !channelId || channelId.length > 160) fail('invalid channelId');
  if (!Number.isFinite(maxWidth) || maxWidth < 320 || maxWidth > 2400) fail('invalid maxWidth');
  return base.href.endsWith('/') ? base.href : `${base.href}/`;
}

function bridgeSource(channelId, pages) {
  return `
/* The archive bridge observes the original engine; it does not replace it. */
(() => {
  const channelId=${scriptJson(channelId)};
  const files=${scriptJson(pages.map((page) => page.file))};
  let disposed=false, imagesReady=false, ready=false, failure='', lastState='';
  let bookObserver=null, readyObserver=null;
  const pendingImages=new Set();
  const post=(value)=>parent.postMessage({channelId,...value},'*');
  const report=(force=false)=>{
    if(disposed)return;
    const state={type:'lion-book:state',index:typeof idx==='number'?idx:0,
      turning:typeof turn!=='undefined'&&!!turn,ready:ready&&!failure};
    if(failure)state.error=failure;
    const signature=JSON.stringify(state);
    if(force||signature!==lastState){lastState=signature;post(state);}
  };
  const onError=(event)=>{
    failure='史册交互加载失败，请重新载入。';ready=false;report();
    if(event.type==='unhandledrejection')event.preventDefault();
  };
  const validateReady=()=>{
    ready=imagesReady&&document.body.dataset.ready==='1'&&!failure;
    report();
  };
  const dispose=()=>{
    disposed=true;
    bookObserver?.disconnect();readyObserver?.disconnect();
    removeEventListener('message',onCommand);
    removeEventListener('wheel',onWheel);
    removeEventListener('keydown',onArchiveKey);
    removeEventListener('error',onError);
    removeEventListener('unhandledrejection',onError);
    removeEventListener('pagehide',dispose);
    for(const image of pendingImages){image.onload=image.onerror=null;image.src='';}
    pendingImages.clear();
    if(typeof raf!=='undefined'&&raf!==null){cancelAnimationFrame(raf);raf=null;}
    if(typeof spring!=='undefined')spring=null;
    if(typeof viewActive!=='undefined')viewActive=false;
    if(typeof drag!=='undefined')drag=null;
    if(typeof introOn!=='undefined')introOn=false;
  };
  function onCommand(event){
    if(event.source!==parent||disposed)return;
    const data=event.data;
    if(!data||data.type!=='lion-book:command'||data.channelId!==channelId)return;
    if(data.action==='dispose'){dispose();return;}
    if(data.action==='sync'){report(true);return;}
    if(!ready)return;
    if(data.action==='goTo'&&Number.isInteger(data.index)&&data.index>=0&&data.index<files.length)goTo(data.index);
    else if(data.action==='next')step('next');
    else if(data.action==='previous')step('prev');
    report();
  }
  function onWheel(event){
    if(disposed||event.ctrlKey||event.metaKey||event.cancelable===false)return;
    // Chrome already chains a wheel out of an overflow-hidden iframe. Delegate
    // its cancelable event once so the host bridge cannot double that scroll.
    event.preventDefault();
    const line=parseFloat(getComputedStyle(document.body).lineHeight)||16;
    const unit=event.deltaMode===1?line:event.deltaMode===2?innerHeight:1;
    post({type:'lion-book:wheel',deltaX:event.deltaX*unit,deltaY:event.deltaY*unit,deltaMode:0});
  }
  function onArchiveKey(event){
    if(!ready||disposed||event.metaKey||event.ctrlKey||event.altKey)return;
    if(event.key!=='Home'&&event.key!=='End')return;
    const target=event.target;
    if(target&&(target.tagName==='INPUT'||target.tagName==='TEXTAREA'||target.isContentEditable))return;
    event.preventDefault();goTo(event.key==='Home'?0:files.length-1);
  }
  addEventListener('message',onCommand);
  addEventListener('wheel',onWheel,{passive:false});
  addEventListener('keydown',onArchiveKey);
  addEventListener('error',onError);
  addEventListener('unhandledrejection',onError);
  addEventListener('pagehide',dispose,{once:true});
  if(window.__lionBookInitialError||typeof idx!=='number'||typeof step!=='function'){
    failure='史册交互加载失败，请重新载入。';report();return;
  }
  bookObserver=new MutationObserver(()=>report());
  bookObserver.observe(book,{childList:true,subtree:true});
  readyObserver=new MutationObserver(validateReady);
  readyObserver.observe(document.body,{attributes:true,attributeFilter:['data-ready']});
  report(true);
  // The upstream boot tolerates missing images. The archive must not report
  // ready until all seven complete, sufficiently detailed spreads load in the
  // original 1760/1240 geometry. Imagegen may return proportional dimensions.
  Promise.all(PAGES.map((page,index)=>new Promise((resolve,reject)=>{
    const image=new Image();pendingImages.add(image);
    image.onload=()=>{
      pendingImages.delete(image);
      if(image.naturalWidth<1024||Math.abs(image.naturalWidth/image.naturalHeight-1760/1240)>0.01){reject(new Error(files[index]));return;}
      if(image.decode)image.decode().then(resolve,reject);else resolve();
    };
    image.onerror=()=>{pendingImages.delete(image);reject(new Error(files[index]));};
    image.src=page.url;
  }))).then(()=>{
    if(disposed)return;imagesReady=true;validateReady();
  }).catch(()=>{
    if(disposed)return;failure='史册书页加载失败，请重新载入。';ready=false;report();
  });
})();
`;
}

/** Adapt the document emitted by the installed, unmodified Sketchbook. */
export function adaptLionSketchbookDocument(original, {
  pages, assetBaseUrl, channelId, maxWidth = 1200,
} = {}) {
  const base = checkOptions(pages, assetBaseUrl, channelId, maxWidth);
  if (typeof original !== 'string') fail('missing original document');
  const scripts = [...original.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  if (scripts.length !== 1) fail('expected one original engine script');
  let engine = scripts[0][1];
  const directory = engine.match(/const DIR='[^']*';/g);
  if (!directory || directory.length !== 1) fail('unexpected asset directory declaration');
  if (fingerprint(engine.replace(directory[0], "const DIR='sketchbook/';")) !== '9153f75') fail('upstream script changed');
  let styles = between(original, STYLE_START, STYLE_END);
  if (fingerprint(styles) !== 'ba7565bf') fail('upstream paper styles changed');

  // Keep the original paper/strip styles byte for byte. The independent lens
  // and toolbar styles are the only removed portion of this engine stylesheet.
  styles = styles.replace(between(styles, LOUPE_STYLE_START, '.sb-zone{'), '');
  let markup = between(original, '    <div class="sb-wrap" id="sbWrap">', '    <button class="hero-down"');
  markup = replaceOne(markup, '          <div class="zoomwrap" id="zoomWrap" aria-hidden="true"><div class="zoominner" id="zoomInner"></div></div>\n', '');
  markup = replaceOne(markup, '          <div class="loupe" id="loupe"><span class="grip"></span><span class="ring"><span class="lens" id="loupeLens"><span class="mag" id="loupeMag"></span></span></span></div>\n', '');
  markup = markup.replace(between(markup, '      <div class="sb-tools"', '      <p class="sb-hint"'), '');
  markup = replaceOne(markup, 'Drag the page to turn · Drag the glass across it', '拖动书页，翻阅醒狮文化史册');

  const originalPages = between(engine, 'const PAGES=[', 'PAGES.forEach(p=>p.url=DIR+p.file);');
  engine = engine.replace(originalPages, `const PAGES=${scriptJson(pages.map((page) => ({ ...page, place: page.era })))};\n`);
  engine = replaceOne(engine, directory[0], `const DIR=${scriptJson(base)};`);
  engine = replaceOne(engine, 'const M=PAGES.length, LAND=6;', 'const M=PAGES.length, LAND=0;');
  engine = replaceOne(engine, 'const Q=new URLSearchParams(location.search);', "const Q=new URLSearchParams('nointro');");
  const oldSiteHandler = between(engine, "document.getElementById('heroDown').onclick=", LOUPE_SCRIPT_START);
  engine = engine.replace(oldSiteHandler, '');
  // Compatibility hooks keep the original tick/paint/boot untouched while the
  // optional magnifier and view toolbar are completely absent.
  engine = engine.replace(between(engine, LOUPE_SCRIPT_START, INDEX_SCRIPT_START),
    '/* Optional lens and toolbar removed for the archive. */\nfunction loupeEase(){return false;}\nfunction syncZoom(){}\nfunction restLoupe(){}\n\n');
  engine = replaceOne(engine, '  setTimeout(startIntro,220);', '  /* Archive starts open at spread zero; automatic riffle is disabled. */');
  // A zoom reset belongs to the removed optional view controls, not page turns.
  engine = replaceOne(engine, "stage.addEventListener('dblclick',()=>setView(view.trx,view.try_,1));", '');

  const theme = `
:root{--paper:#f5f0e7;--ink:#302721;--ink-soft:#706358;--ink-faint:#9b796a;--hairline:rgba(133,49,35,.15);--earth:#a33024;--font:serif;--display:serif;--track-caps:.12em}
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent;color:var(--ink)}
body{font-family:"Noto Serif CJK SC","Songti SC",SimSun,serif;-webkit-font-smoothing:antialiased}
button{font:inherit}.page,.hero{width:100%;height:100%;min-height:0;margin:0;padding:0;display:grid;align-content:center;justify-items:center}
.sb-wrap{gap:0}.sb-3d{max-width:min(${maxWidth}px,100%)}.sb-arrow,.sb-captions,.sb-hint{display:none!important}
.sb-zone:focus-visible{outline:2px solid #a33024;outline-offset:-2px}
@media(prefers-reduced-motion:reduce){.sb-caption{animation:none}}
`;
  const initialErrors = `window.__lionBookInitialError=false;addEventListener('error',()=>{window.__lionBookInitialError=true;},{once:true});`;
  return `<!doctype html>\n<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>岭南醒狮志 · 南风有狮</title><style>${styles}\n${theme}</style></head><body><main class="page home"><section id="sketchbook" class="hero">${markup}</section><ol id="plateList" hidden></ol></main><script>${initialErrors}</script><script>${engine}</script><script>${bridgeSource(channelId, pages)}</script></body></html>`;
}
