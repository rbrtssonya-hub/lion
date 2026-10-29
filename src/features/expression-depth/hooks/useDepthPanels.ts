import { useLayoutEffect, type RefObject } from 'react'
import gsap from 'gsap'
import { motionState } from '../lib/motion'
import { panelState } from '../lib/journey'

export function useDepthPanels(rootRef: RefObject<HTMLDivElement | null>) {
  useLayoutEffect(() => {
    const stages = [...rootRef.current!.querySelectorAll<HTMLElement>('.chapter-stage')]
    let previous = Number.NaN
    const update = () => {
      const chapter = motionState.chapter
      if (chapter === previous) return
      previous = chapter
      stages.forEach((stage, index) => {
        const state = panelState(chapter, index)
        stage.style.opacity = String(state.opacity)
        stage.style.visibility = state.opacity > .015 ? 'visible' : 'hidden'
        stage.style.transform = `translate3d(0, ${state.y}px, 0) scale(${state.scale})`
        stage.inert = state.opacity < .45
      })
    }
    update(); gsap.ticker.add(update)
    return () => { gsap.ticker.remove(update); stages.forEach(stage => { stage.style.removeProperty('opacity'); stage.style.removeProperty('visibility'); stage.style.removeProperty('transform'); stage.inert = false }) }
  }, [rootRef])
}
