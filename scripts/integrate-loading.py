"""Preserve the supplied design and wire its animation to real startup work."""
from pathlib import Path
import re
import base64
import sys

root = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1]) if len(sys.argv) > 1 else root / 'source/design/loading/supplied-loading.html'
original = source.read_bytes()
archive = root / 'source/design/loading/supplied-loading.html'
archive.parent.mkdir(parents=True, exist_ok=True)
archive.write_bytes(original)
html = original.decode('utf-8-sig').replace('\r\n', '\n')
runtime = root / 'source/public/assets/loading'
runtime.mkdir(parents=True, exist_ok=True)
match = re.search(r'data:image/png;base64,([A-Za-z0-9+/=\s]+)', html)
(runtime / 'painting.png').write_bytes(base64.b64decode(match[1]))
html = html[:match.start()] + './painting.png' + html[match.end():]
html = html.replace("const HOME_URL = './';", "let target = 0, complete = false, leaving = false, displayed = 0;\nwindow.addEventListener('message', event => {\n  if (event.source !== parent || event.origin !== location.origin || event.data?.type !== 'lion:startup-progress') return;\n  target = Math.max(target, Math.min(1, Number(event.data.progress) || 0));\n  complete = event.data.complete === true;\n  status.textContent = event.data.message || '墨色渐起 · 岭南将至';\n});\nparent.postMessage({type:'lion:loader-ready'}, location.origin);")
html = html.replace('const p=t*t*(3-2*t);', 'displayed += (Math.min(target, t*t*(3-2*t)) - displayed) * .1;\n  const p=complete && t===1 && displayed>.998 ? 1 : displayed;')
html = html.replace("if(t<1){frame=requestAnimationFrame(animate);return;}", "if(p<1 || !complete){frame=requestAnimationFrame(animate);return;}\n  if(leaving)return; leaving=true;")
html = html.replace("leaveTimer=setTimeout(()=>{loading.classList.add('leaving');leaveTimer=setTimeout(()=>location.assign(HOME_URL),reduced?0:800);},700);", "leaveTimer=setTimeout(()=>{loading.classList.add('leaving');leaveTimer=setTimeout(()=>parent.postMessage({type:'lion:loader-complete'},location.origin),reduced?0:800);},350);")
html = html.replace("status.textContent='狮已醒 · 欢迎入场';", "if(!status.textContent.includes('预览'))status.textContent='狮已醒 · 欢迎入场';")
html = html.replace('// 独立单文件，无外部依赖。通过开发服务器打开本文件，完成后前往同目录首页。', '// 保留用户原画面；由父页面实际资源准备任务驱动，不进行页面跳转。')
html = html.replace('// 双击文件为视觉预览模式：完成后停留，可点“再看一次”。百分比为入场动效，并非下载字节比例。', '// 百分比是准备任务的加权完成比例，不是下载字节比例。')
html = html.replace('aria-label="入场准备动效"', 'aria-label="入场资源准备进度"')
(runtime / 'index.html').write_text(html, encoding='utf-8', newline='\n')
print('Preserved supplied HTML; extracted painting; connected progress handshake.')
