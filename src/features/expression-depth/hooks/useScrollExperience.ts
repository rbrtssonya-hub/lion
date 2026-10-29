import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import Lenis from 'lenis'
import { chapterIds } from '../data/projects'
import { clamp, motionState, smootherstep } from '../lib/motion'

export interface NavigationTiming { duration: number; easing?: (t: number) => number }
type ElementRef = RefObject<HTMLDivElement | null>

// The chapter playhead lives in this feature's scroll viewport, never window/hash.
export function useScrollExperience(reducedMotion: boolean, rootRef: ElementRef, scrollRef: ElementRef, contentRef: ElementRef, initialId: string, wheelSpeed = 100) {
  const lenisRef = useRef<Lenis | null>(null)
  const navigator = useRef<(id: string, timing?: NavigationTiming) => void>(() => {})
  const wheelRef = useRef(wheelSpeed)
  wheelRef.current = wheelSpeed
  const [chapter, setChapter] = useState(0)
  const [progress, setProgress] = useState(0)
  const locked = useRef(false)
  const initial = useRef(initialId)
  useLayoutEffect(() => {
    const root = rootRef.current!, scroller = scrollRef.current!, content = contentRef.current!
    let disposed = false, raf = 0
    let anchors: number[] = []
    let navigation: { id: string; timing?: NavigationTiming; active: boolean } | null = null
    let measured = false
    motionState.chapter = 0; motionState.pointerX = 0; motionState.pointerY = 0
    const lenis = reducedMotion ? null : new Lenis({
      wrapper: scroller, content, eventsTarget: root, autoRaf: false, lerp: .11, smoothWheel: true, anchors: false, allowNestedScroll: true,
      virtualScroll: data => {
        if (data.event.type !== 'wheel' || data.event.ctrlKey || locked.current || data.event.composedPath().some(node => node instanceof HTMLElement && node.hasAttribute('data-lenis-prevent'))) return true
        navigation = null
        const direction = Math.sign(data.deltaY)
        if (!direction) return true
        const pending = lenis!.targetScroll - lenis!.animatedScroll
        if (Math.sign(pending) !== direction && Math.abs(pending) > 1) lenis!.scrollTo(lenis!.animatedScroll, { immediate: true })
        const lead = lenis!.targetScroll - lenis!.animatedScroll
        const input = clamp(data.deltaY * .85 * wheelRef.current / 100, -160, 160)
        const next = clamp(lead + input, -Math.min(480, scroller.clientHeight * .45), Math.min(480, scroller.clientHeight * .45))
        data.deltaY = Math.abs(next - lead) > .001 ? next - lead : direction * .001
        return true
      },
    })
    lenisRef.current = lenis
    const sample = () => {
      const scroll = scroller.scrollTop
      let index = 0
      while (index < anchors.length - 1 && scroll >= anchors[index + 1]) index++
      const span = (anchors[index + 1] ?? anchors[index]) - (anchors[index] ?? 0)
      const value = index + (span > 0 ? clamp((scroll - anchors[index]) / span) : 0)
      motionState.chapter = value
      setChapter(Math.round(value))
      setProgress(Math.round(clamp(scroll / Math.max(1, scroller.scrollHeight - scroller.clientHeight)) * 100))
    }
    const topOf = (id: string) => anchors[chapterIds.indexOf(id)]
    const go = (id: string, timing?: NavigationTiming) => {
      const top = topOf(id)
      if (top === undefined) return
      navigation = { id, timing, active: true }
      const ticket = navigation
      if (lenis) lenis.scrollTo(top, { duration: timing?.duration ?? clamp(.65 + Math.abs(top - scroller.scrollTop) / scroller.clientHeight * .14, .7, 1.65), easing: timing?.easing ?? smootherstep, onComplete: () => { if (navigation === ticket) navigation.active = false } })
      else { scroller.scrollTo({ top, behavior: 'instant' }); ticket.active = false; sample() }
    }
    navigator.current = go
    const measure = () => {
      const current = motionState.chapter
      anchors = chapterIds.map(id => (content.querySelector(`[data-depth-anchor="${id}"]`) as HTMLElement).offsetTop)
      lenis?.resize()
      if (!measured) {
        measured = true
        const top = topOf(initial.current) ?? 0
        if (lenis) lenis.scrollTo(top, { immediate: true })
        else scroller.scrollTop = top
      } else if (navigation?.active) go(navigation.id, navigation.timing)
      else {
        const i = Math.min(anchors.length - 1, Math.floor(current))
        const top = anchors[i] + ((anchors[i + 1] ?? anchors[i]) - anchors[i]) * (current - i)
        if (lenis) lenis.scrollTo(top, { immediate: true })
        else scroller.scrollTop = top
      }
      sample()
    }
    measure()
    const resize = new ResizeObserver(measure)
    resize.observe(root)
    const tick = (time: number) => { if (disposed) return; lenis?.raf(time); raf = requestAnimationFrame(tick) }
    raf = requestAnimationFrame(tick)
    scroller.addEventListener('scroll', sample, { passive: true })
    const onMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || reducedMotion) return
      const rect = root.getBoundingClientRect()
      motionState.pointerX = (event.clientX - rect.left) / rect.width * 2 - 1
      motionState.pointerY = -((event.clientY - rect.top) / rect.height * 2 - 1)
    }
    const leave = () => { motionState.pointerX = 0; motionState.pointerY = 0 }
    const onKey = (event: KeyboardEvent) => {
      if (locked.current || (event.target instanceof Element && event.target.closest('button,a,input,textarea,select,[role=dialog]'))) return
      let top: number | undefined
      if (event.key === 'Home') top = 0
      if (event.key === 'End') top = scroller.scrollHeight
      if (['ArrowDown','ArrowUp','PageDown','PageUp',' '].includes(event.key)) top = scroller.scrollTop + (['ArrowUp','PageUp'].includes(event.key) ? -1 : 1) * scroller.clientHeight * (event.key.startsWith('Arrow') ? .12 : .85)
      if (top === undefined) return
      event.preventDefault(); navigation = null
      if (lenis) lenis.scrollTo(top, { duration: .7 })
      else scroller.scrollTop = top
    }
    root.addEventListener('pointermove', onMove, { passive: true }); root.addEventListener('pointerleave', leave)
    root.addEventListener('keydown', onKey)
    const onNativeWheel = (event: WheelEvent) => {
      if (lenis || locked.current || event.ctrlKey || (event.target instanceof Element && event.target.closest('[data-lenis-prevent]'))) return
      event.preventDefault(); scroller.scrollTop += event.deltaY * wheelRef.current / 100
    }
    root.addEventListener('wheel', onNativeWheel, { passive: false })
    return () => {
      disposed = true; cancelAnimationFrame(raf); resize.disconnect(); lenis?.destroy(); lenisRef.current = null
      scroller.removeEventListener('scroll', sample); root.removeEventListener('pointermove', onMove); root.removeEventListener('pointerleave', leave)
      root.removeEventListener('keydown', onKey); root.removeEventListener('wheel', onNativeWheel); navigator.current = () => {}; leave()
    }
  }, [reducedMotion, rootRef, scrollRef, contentRef])
  const navigate = useCallback((id: string, timing?: NavigationTiming) => navigator.current(id, timing), [])
  const setScrollLocked = useCallback((value: boolean) => { locked.current = value; if (value) lenisRef.current?.stop(); else lenisRef.current?.start() }, [])
  return { chapter, progress, navigate, setScrollLocked }
}
