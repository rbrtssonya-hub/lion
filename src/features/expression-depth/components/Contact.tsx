import { media } from '../../../config/media.js'
import { Asterisk, Arrow } from './Icons'

const brushGlyphs: Record<string, { atlas: string; position: string }> = {
  '狮': { atlas: media.depthTitleAtlas, position: '33.333333% 0%' },
  '八': { atlas: media.depthTitleAtlas, position: '66.666667% 0%' },
  '态': { atlas: media.depthTitleAtlas, position: '100% 0%' },
  '一': { atlas: media.depthContactAtlas, position: '0% 0%' },
  '面': { atlas: media.depthContactAtlas, position: '33.333333% 0%' },
  '情': { atlas: media.depthContactAtlas, position: '66.666667% 0%' },
  '随': { atlas: media.depthContactAtlas, position: '100% 0%' },
  '鼓': { atlas: media.depthContactAtlas, position: '0% 100%' },
  '生': { atlas: media.depthContactAtlas, position: '33.333333% 100%' },
  '再': { atlas: media.depthContactAtlas, position: '66.666667% 100%' },
  '观': { atlas: media.depthContactAtlas, position: '100% 100%' },
}

function ContactBrushText({ text }: { text: string }) {
  return <span className="contact-brush-text" aria-hidden="true">{Array.from(text).map((character, index) => {
    const glyph = brushGlyphs[character]
    if (!glyph) return <span className="contact-brush-punctuation" key={`${character}-${index}`}>{character}</span>
    const image = `url("${glyph.atlas}")`
    return <span className="contact-brush-glyph" key={`${character}-${index}`} style={{ maskImage: image, WebkitMaskImage: image, maskPosition: glyph.position, WebkitMaskPosition: glyph.position }}>{character}</span>
  })}</span>
}

export function Contact({ navigate }: { navigate: (id: string) => void }) {
  return <section id="depth-contact" data-depth-id="contact" className="chapter contact" aria-labelledby="depth-contact-title">
    <div className="chapter-stage contact-stage">
      <div className="contact-eyebrow" data-reveal><span className="status-dot" /> 回望 / 八态皆有神</div>
      <h2 id="depth-contact-title" aria-label="一狮八面，情随鼓生。" data-reveal><ContactBrushText text="一狮八面，情随鼓生。" /></h2>
      <a className="contact-email" href="#/state" aria-label="再观八态。" onClick={event => { event.preventDefault(); navigate('joy') }} data-reveal><ContactBrushText text="再观八态。" /><Arrow diagonal /></a>
      <div className="email-row" data-reveal><span>喜 · 怒 · 哀 · 乐 · 动 · 静 · 惊 · 疑</span><button onClick={() => navigate('home')}>回到序章 ↗</button></div>
      <div className="contact-details" data-reveal><p>神态须与情节、身段和锣鼓合看。<br />AI辅助示意，等待真实图片 / 视频样本校核。</p><div className="contact-seal"><Asterisk /><span>观形见意。<br />由形入神。</span></div></div>
      <footer className="site-footer"><span>南风有狮 / 醒狮八态</span><span>八态纵深图鉴 · 定性观察框架</span><button onClick={() => navigate('home')}>返回起点 <Arrow diagonal /></button></footer>
    </div>
  </section>
}
