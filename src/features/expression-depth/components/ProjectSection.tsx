import type { Project } from '../data/projects'
import { Arrow, LionEmblem, CloudScroll } from './Icons'
import { SafeImage } from './SafeImage'
import { NarrationControls } from './NarrationControls'
import type { NarrationController } from '../hooks/useNarration'

export function ProjectSection({ project, index, onOpen, narration }: { project: Project; index: number; onOpen: (project: number, image?: number) => void; narration: NarrationController }) {
  return <section id={`depth-${project.id}`} data-depth-id={project.id} className={`chapter project-section ${index % 2 ? 'is-reversed' : ''}`} aria-labelledby={`depth-${project.id}-title`}>
    <div className="chapter-stage project-stage">
      <div className="project-topline"><span>南风有狮 · 神态图鉴</span><span>{project.number} / 08</span><span>{project.category}</span></div>
      <div className="project-copy" data-surface="expressionOverlay" data-reveal>
        <div className="project-number"><LionEmblem />第 {project.number} 态 / {project.location}</div>
        <div className="state-title-row"><h2 id={`depth-${project.id}-title`}><span className="state-brush-glyph" style={{ maskImage: `url("${project.glyph}")`, WebkitMaskImage: `url("${project.glyph}")` }}>{project.title}</span></h2><CloudScroll /><span className="state-title-seal" aria-hidden="true">狮韵</span></div>
        <p className="project-subtitle">{project.subtitle}</p>
        <p className="project-description">{project.description}</p>
        <button className="line-button project-open" onClick={() => onOpen(index)}>观狮头 · 读{project.title}态 <Arrow diagonal /></button>
        <NarrationControls narration={narration} />
      </div>
      <div className="project-art-fallback fallback-art">
        <button className="project-main-fallback" aria-label={`查看${project.title}态解读`} onClick={() => onOpen(index)}><SafeImage src={project.images[0]} alt={`${project.title}态醒狮，${project.subtitle}，AI辅助示意`} loading="lazy" /></button>
      </div>
      <div className="project-photo-note"><span>{project.number} — {project.location.toUpperCase()}</span><span>{project.coordinates}</span></div>
      <div className="project-bottomline"><span>AI辅助视觉 · 定性观察提示</span><span>等待真实图片 / 视频样本校核</span></div>
    </div>
  </section>
}
