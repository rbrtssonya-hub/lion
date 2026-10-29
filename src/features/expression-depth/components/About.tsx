import { LionEmblem, CloudScroll, Arrow } from './Icons'
import { projects } from '../data/projects'
import { NarrationControls } from './NarrationControls'
import type { NarrationController } from '../hooks/useNarration'

export function About({ navigate, narration }: { navigate: (id: string) => void; narration: NarrationController }) {
  return <section id="depth-about" data-depth-id="about" className="chapter about" aria-labelledby="depth-about-title">
    <div className="chapter-stage about-stage">
      <div className="section-eyebrow" data-reveal><span>序 / 从形到神</span><LionEmblem /></div>
      <h2 id="depth-about-title" data-reveal>观神<CloudScroll className="section-title-cloud" /><span>观眉眼，读狮口，会神韵。</span></h2>
      <div className="about-bottom" data-reveal>
        <div className="about-reading"><p className="about-verse">喜怒哀乐，见情意。<br />动静惊疑，藏神采。</p><p>由眉眼与狮口入手，沿头部朝向、身段与鼓点，寻找醒狮的神态线索。八态是本项目的定性观察框架，须结合完整表演理解。</p><button className="line-button" onClick={() => navigate('joy')}>走近第一态 · 喜 <Arrow diagonal /></button><NarrationControls narration={narration} compact /></div>
        <div className="about-directory" aria-label="八态索引">{projects.map(project => <button key={project.id} onClick={() => navigate(project.id)} aria-label={`直达${project.title}态`}><small>{project.number}</small><span className="state-brush-glyph" style={{ maskImage: `url("${project.glyph}")`, WebkitMaskImage: `url("${project.glyph}")` }}>{project.title}</span><em>{project.location}</em><CloudScroll className="directory-cloud" /></button>)}</div>
      </div>
      <div className="works-heading"><span>醒狮八态 / 神态观察</span><span>眉眼 · 狮口 · 身段</span><span>(01 — 08) ↓</span></div>
    </div>
  </section>
}
