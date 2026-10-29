import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { chapterIds, projects } from '../data/projects'
import { motionState } from '../lib/motion'
import type { NarrationController } from './useNarration'
import type { NavigationTiming } from './useScrollExperience'

type TourStatus = 'off' | 'running' | 'paused' | 'ended'
type TourPhase = 'moving' | 'viewing' | 'animating' | 'reading'
type PauseReason = 'button' | 'manual' | 'hidden' | 'blocked'
interface TourOptions {
  rootRef: RefObject<HTMLDivElement | null>
  moveDuration: number
  readingDuration: number
  navigate: (id: string, timing?: NavigationTiming) => void
  cancelNavigation: () => void
  narration: NarrationController
  blocked: boolean
  ready: boolean
  openReading: (project: number) => void
  closeReading: () => void
}
interface TourSnapshot {
  status: TourStatus; phase: TourPhase; station: number; stationTitle: string
  progress: number; message: string; readingRemaining: number
}
export interface AutoTourController extends TourSnapshot {
  start: () => void; pause: () => void; takeControl: () => void
  resume: () => void; exit: () => void
  beginAnimation: (project: number) => boolean
  faceComplete: (project: number) => void
  completeReading: () => void
}
const lastStation = chapterIds.length - 1

const initialSnapshot: TourSnapshot = { status: 'off', phase: 'viewing', station: 0, stationTitle: '入境', progress: 0, message: '缓慢运镜，到站点击狮头观态。', readingRemaining: 12 }
const stationAt = (chapter: number) => Math.max(0, Math.min(lastStation, Math.round(chapter)))
const stationTitle = (station: number) => station === 0 ? '入境' : station === 1 ? '观神' : station === lastStation ? '回望' : `${projects[station - 2].number} · ${projects[station - 2].title}态`
const noCommands = () => ({ start() {}, pause() {}, takeControl() {}, resume() {}, exit() {}, beginAnimation(_project: number) { return false }, faceComplete(_project: number) {}, completeReading() {} })

export function useAutoTour(options: TourOptions): AutoTourController {
  const latest = useRef(options)
  latest.current = options
  const [snapshot, setSnapshot] = useState(initialSnapshot)
  const commands = useRef(noCommands())
  useEffect(() => {
    let disposed = false
    let status: TourStatus = 'off'
    let phase: TourPhase = 'viewing'
    let station = 0, elapsed = 0, lastTick = performance.now(), moveSince = 0
    let arriveSince: number | null = null
    let pausedBy: PauseReason = 'button'
    let pausedAudio = false, enabledNarration = false
    let message = initialSnapshot.message, previous = initialSnapshot
    const readingMs = () => latest.current.readingDuration * 1000
    const isState = () => station >= 2 && station < lastStation
    const dwellTime = () => station === 0 ? 2400 : station === 1 ? 3500 : 3000
    const waitingMessage = () => isState() ? '已停靠 · 点击狮头，动效结束后解读' : '停驻片刻 · 循序前行'
    const publish = () => {
      if (disposed) return
      const fraction = phase === 'reading' ? elapsed / readingMs() : phase === 'viewing' && !isState() ? elapsed / dwellTime() : 0
      const next: TourSnapshot = { status, phase, station, stationTitle: stationTitle(station), progress: status === 'ended' ? 1 : Math.min(1, (station + Math.min(1, fraction) * .6) / chapterIds.length), message, readingRemaining: phase === 'reading' ? Math.max(0, Math.ceil((readingMs() - elapsed) / 1000)) : latest.current.readingDuration }
      if ((Object.keys(next) as (keyof TourSnapshot)[]).some(key => next[key] !== previous[key])) { previous = next; setSnapshot(next) }
    }
    const pause = (reason: PauseReason = 'button') => {
      if (status === 'paused' && reason === 'manual') { pausedBy = reason; message = '已交还手动浏览，可继续巡游。'; publish(); return }
      if (status !== 'running') return
      status = 'paused'; pausedBy = reason
      latest.current.cancelNavigation()
      // Cancellation returns to a click-ready stop, never to a reading completion.
      if (phase === 'animating') phase = 'viewing'
      const audio = latest.current.narration
      pausedAudio = audio.enabled
      if (pausedAudio) audio.pausePlayback()
      message = reason === 'hidden' ? '页面暂离，点击继续巡游。' : reason === 'manual' ? '已交还手动浏览，可继续巡游。' : phase === 'reading' ? '解读读秒已暂停，继续后恢复。' : '镜头已暂停，可继续或退出。'
      publish()
    }
    const moveTo = (next: number) => {
      station = next; phase = 'moving'; elapsed = 0; arriveSince = null; moveSince = performance.now()
      message = `缓慢前行 · ${stationTitle(station)}`
      const distance = Math.abs(station - motionState.chapter)
      latest.current.navigate(chapterIds[station], { duration: distance < .025 ? .1 : Math.max(.5, Math.min(30, distance * latest.current.moveDuration)), easing: t => t })
      publish()
    }
    const restoreNarration = () => {
      if (enabledNarration && latest.current.narration.enabled) latest.current.narration.toggleEnabled()
      else if (latest.current.narration.enabled) latest.current.narration.releasePlaybackHold()
      enabledNarration = false; pausedAudio = false
    }
    const advance = () => {
      if (station === lastStation) { status = 'ended'; message = '八态巡游完毕，可再次启程。'; restoreNarration(); publish() }
      else moveTo(station + 1)
    }
    const completeReading = () => {
      if (phase !== 'reading' || status !== 'running') return
      latest.current.closeReading(); advance()
    }
    commands.current = {
      start() {
        if (!latest.current.ready || latest.current.blocked || document.hidden) return
        enabledNarration = !latest.current.narration.enabled
        if (enabledNarration) latest.current.narration.toggleEnabled()
        latest.current.narration.resumePlayback(); pausedAudio = false
        status = 'running'; lastTick = performance.now()
        const here = stationAt(motionState.chapter)
        moveTo(here === lastStation ? 0 : here)
      },
      pause() { pause('button') }, takeControl() { pause('manual') },
      resume() {
        if (status !== 'paused' || !latest.current.ready || latest.current.blocked || document.hidden) return
        const next = pausedBy === 'manual' && phase !== 'reading' ? stationAt(motionState.chapter) : station
        status = 'running'; lastTick = performance.now()
        if (pausedAudio && latest.current.narration.enabled) latest.current.narration.resumePlayback()
        pausedAudio = false
        if (phase === 'reading') { message = '正在解读 · 读完后前往下一态'; publish() }
        else if (next !== station || phase === 'moving' || Math.abs(motionState.chapter - next) > .025) moveTo(next)
        else { message = waitingMessage(); publish() }
      },
      exit() {
        if (phase === 'reading') latest.current.closeReading()
        if (status === 'running') latest.current.cancelNavigation()
        status = 'off'; phase = 'viewing'; elapsed = 0; station = stationAt(motionState.chapter)
        message = initialSnapshot.message; restoreNarration(); publish()
      },
      beginAnimation(project) {
        if (status !== 'running' || phase !== 'viewing' || station !== project + 2 || Math.abs(motionState.chapter - station) > .12) return false
        phase = 'animating'; message = '正在观态 · 动效结束后打开解读'; publish(); return true
      },
      faceComplete(project) {
        if (status !== 'running' || phase !== 'animating' || station !== project + 2) return
        phase = 'reading'; elapsed = 0; lastTick = performance.now()
        message = `正在解读 · ${latest.current.readingDuration}秒后继续前行`
        latest.current.openReading(project); publish()
      },
      completeReading,
    }
    const tick = () => {
      const now = performance.now(), delta = Math.min(250, Math.max(0, now - lastTick))
      lastTick = now
      if (status !== 'running') return
      if (latest.current.blocked) { pause('blocked'); return }
      if (document.hidden || !latest.current.ready) { pause('hidden'); return }
      const audio = latest.current.narration
      if (audio.enabled && audio.activeIndex !== null && audio.status === 'paused') { pause(); return }
      if (phase === 'moving') {
        if (Math.abs(motionState.chapter - station) <= .025) {
          arriveSince ??= now
          if (now - arriveSince >= 180) { phase = 'viewing'; elapsed = 0; message = waitingMessage() }
        } else arriveSince = null
        if (now - moveSince > 20000) pause('manual')
      } else if (Math.abs(motionState.chapter - station) > .13) pause('manual')
      else if (phase === 'reading') { elapsed += delta; if (elapsed >= readingMs()) completeReading() }
      else if (phase === 'viewing' && !isState()) { elapsed += delta; if (elapsed >= dwellTime()) advance() }
      publish()
    }
    const insideReading = (target: EventTarget | null) => phase === 'reading' && target instanceof Element && Boolean(target.closest('.gallery'))
    const onWheel = (event: Event) => { if (!insideReading(event.target)) pause('manual') }
    const onKey = (event: KeyboardEvent) => {
      const target = event.target instanceof Element ? event.target : null
      if (insideReading(target) || target?.closest('input,textarea,select,[contenteditable=true]')) return
      if (event.key === ' ' && target?.closest('button,a,[role=button]')) return
      if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' ', 'Escape'].includes(event.key)) pause('manual')
    }
    const onPointer = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null
      if (!target || insideReading(target) || target.closest('.auto-tour,.narration-controls,.project-open,.project-main-fallback,.scene-canvas')) return
      if (target.closest('a,button')) pause('manual')
    }
    const onVisibility = () => { if (document.hidden) pause('hidden') }
    const timer = window.setInterval(tick, 100)
    const root = latest.current.rootRef.current!
    root.addEventListener('wheel', onWheel, { passive: true, capture: true })
    root.addEventListener('touchstart', onWheel, { passive: true, capture: true })
    root.addEventListener('keydown', onKey, true); root.addEventListener('pointerdown', onPointer, true)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      disposed = true; window.clearInterval(timer)
      root.removeEventListener('wheel', onWheel, true); root.removeEventListener('touchstart', onWheel, true)
      root.removeEventListener('keydown', onKey, true); root.removeEventListener('pointerdown', onPointer, true)
      document.removeEventListener('visibilitychange', onVisibility); commands.current = noCommands()
    }
  }, [])
  useEffect(() => { if (options.blocked || !options.ready) commands.current.pause() }, [options.blocked, options.ready])
  const start = useCallback(() => commands.current.start(), [])
  const pause = useCallback(() => commands.current.pause(), [])
  const takeControl = useCallback(() => commands.current.takeControl(), [])
  const resume = useCallback(() => commands.current.resume(), [])
  const exit = useCallback(() => commands.current.exit(), [])
  const beginAnimation = useCallback((project: number) => commands.current.beginAnimation(project), [])
  const faceComplete = useCallback((project: number) => commands.current.faceComplete(project), [])
  const completeReading = useCallback(() => commands.current.completeReading(), [])
  return { ...snapshot, start, pause, takeControl, resume, exit, beginAnimation, faceComplete, completeReading }
}
