import { CloudScroll } from './Icons'
import { SafeImage } from './SafeImage'
import { projects } from '../data/projects'

interface Props { chapter: number; navigate: (id: string) => void }

export function Navigation({ chapter, navigate }: Props) {
  return <nav className="state-rail" aria-label="八态目录">
    <span className="rail-label" aria-hidden="true">醒狮八态</span>
    {projects.map((project, index) => <a key={project.id} href="#/state" aria-label={project.title} aria-current={chapter === index + 2 ? 'location' : undefined} className={chapter === index + 2 ? 'is-active' : ''} onClick={event => { event.preventDefault(); navigate(project.id) }}>
      <small aria-hidden="true">·</small>
      <SafeImage className="rail-lion" src={project.images[0]} alt="" aria-hidden="true" />
      <span aria-hidden="true">{project.title}</span>
      <CloudScroll className="rail-cloud" />
    </a>)}
    <span className="rail-foot" aria-hidden="true">循形 · 传神</span>
  </nav>
}
