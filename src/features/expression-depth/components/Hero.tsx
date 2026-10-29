import { projects } from '../data/projects'
import { Arrow, LionEmblem, CloudScroll } from './Icons'
import { NarrationControls } from './NarrationControls'
import type { NarrationController } from '../hooks/useNarration'

export function Hero({ navigate, narration }: { navigate: (id: string) => void; narration: NarrationController }) {
  return <section id="depth-home" data-depth-id="home" className="chapter hero" aria-labelledby="depth-hero-title">
    <div className="chapter-stage hero-stage">
      <div className="hero-eyebrow"><span className="status-dot" /> 南风有狮 / 神态观察图鉴</div>
      <h1 id="depth-hero-title" className="hero-title" aria-label="醒狮八态"><span><b className="brush-atlas-glyph glyph-wake">醒</b><b className="brush-atlas-glyph glyph-lion">狮</b><CloudScroll className="hero-title-cloud" /></span><span><b className="brush-atlas-glyph glyph-eight">八</b><b className="brush-atlas-glyph glyph-state">态</b><span className="title-period">。</span><i className="title-seal" aria-hidden="true">岭南<br />狮韵</i></span></h1>
      <div className="hero-dial" aria-label="从八态字谱选择神态">
        <div className="dial-ring" aria-hidden="true" />
        <div className="dial-center" aria-hidden="true"><LionEmblem /><span><b className="brush-atlas-glyph glyph-from">由</b><b className="brush-atlas-glyph glyph-form">形</b></span><span><b className="brush-atlas-glyph glyph-enter">入</b><b className="brush-atlas-glyph glyph-spirit">神</b></span><i /></div>
        {projects.map((project, index) => {
          const angle = (index * 45 - 112.5) * Math.PI / 180
          return <button key={project.id} className="dial-state" style={{ left: `${50 + Math.cos(angle) * 43}%`, top: `${50 + Math.sin(angle) * 43}%` }} onClick={() => navigate(project.id)} aria-label={`走近${project.title}态`}><small>{project.number}</small><span className="state-brush-glyph" style={{ maskImage: `url("${project.glyph}")`, WebkitMaskImage: `url("${project.glyph}")` }}>{project.title}</span><i aria-hidden="true" /></button>
        })}
        <p className="dial-caption">一缕狮韵，八种神采</p>
      </div>
      <div className="hero-narration"><NarrationControls narration={narration} compact /></div>
      <div className="hero-bottom">
        <a className="hero-contact text-link" href="#/state" onClick={event => { event.preventDefault(); navigate('joy') }}><span>循着一缕狮韵，走近八种神态。</span><span>开始观态 <Arrow diagonal /></span></a>
        <button className="scroll-cue" onClick={() => navigate('about')} aria-label="进入神态导言"><span className="scroll-track"><span /></span><span>向下滚动 · 步入纵深</span></button>
        <p className="hero-intro">以眉眼读神，以身段知意。<br />穿行喜怒哀乐，静观动静惊疑。<br /><span>AI辅助视觉 · 八态定性观察图鉴</span></p>
      </div>
      <div className="hero-baseline"><span>南风有狮 / 醒狮八态</span><span>循形入境 · 由近及远</span></div>
    </div>
  </section>
}
