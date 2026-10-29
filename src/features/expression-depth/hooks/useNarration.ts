import { useCallback, useEffect, useRef, useState } from 'react'
import { projects } from '../data/projects'
import { motionState } from '../lib/motion'
import { useMediaAudioPreference, useMediaVolumePreference } from '../../../hooks/useMediaAudioPreference.js'

export type NarrationStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'error'

interface NarrationSnapshot {
  enabled: boolean
  status: NarrationStatus
  progress: number
  currentTime: number
  duration: number
  activeIndex: number | null
  message: string
}

export interface NarrationController extends NarrationSnapshot {
  toggleEnabled: () => void
  togglePlayback: () => void
  pausePlayback: () => void
  resumePlayback: () => void
  releasePlaybackHold: () => void
  replay: () => void
}

const initialSnapshot: NarrationSnapshot = {
  enabled: false, status: 'idle', progress: 0, currentTime: 0, duration: 0,
  activeIndex: null, message: '点击启用，进入八态后自动讲解。',
}

export function useNarration(chapter: number, blocked: boolean): NarrationController {
  const [volume] = useMediaVolumePreference()
  const [audioEnabled] = useMediaAudioPreference()
  const preferences = useRef({ volume, audioEnabled })
  preferences.current = { volume, audioEnabled }
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [snapshot, setSnapshot] = useState(initialSnapshot)
  const blockedRef = useRef(blocked)
  blockedRef.current = blocked
  const refresh = useRef<() => void>(() => {})
  const actions = useRef({ toggleEnabled() {}, togglePlayback() {}, pausePlayback() {}, resumePlayback() {}, releasePlaybackHold() {}, replay() {} })

  useEffect(() => {
    const audio = new Audio()
    audioRef.current = audio
    audio.volume = preferences.current.volume
    audio.muted = !preferences.current.audioEnabled
    audio.preload = 'metadata'
    let disposed = false
    let enabled = false
    let status: NarrationStatus = 'idle'
    let activeIndex: number | null = null
    let desired = false
    let held = false
    let suspended = blockedRef.current || document.hidden
    let candidate: number | null = null
    let candidateSince = 0
    let request = 0
    let issue = ''
    let previous = initialSnapshot

    const publish = () => {
      if (disposed) return
      const currentTime = activeIndex === null ? 0 : Math.round(audio.currentTime * 10) / 10
      const duration = activeIndex !== null && Number.isFinite(audio.duration) ? audio.duration : 0
      let message = '点击启用，进入八态后自动讲解。'
      if (enabled) {
        if (activeIndex === null) message = '进入并停留在一态，讲解将自动开始。'
        else if (blockedRef.current) message = '正在阅读神态解读，讲解已暂停。'
        else if (document.hidden) message = '页面暂离，讲解已暂停。'
        else if (status === 'error') message = issue
        else if (status === 'loading') message = '正在准备本态讲解…'
        else if (status === 'playing') message = `正在讲述${projects[activeIndex].title}态。`
        else if (status === 'ended') message = '本态讲解完毕，可重播或继续前行。'
        else if (status === 'paused') message = '讲解已暂停，可继续或重新播放。'
        else message = '本态讲解已就绪。'
      }
      const next: NarrationSnapshot = {
        enabled, status, activeIndex, currentTime, duration, message,
        progress: duration > 0 ? Math.min(1, currentTime / duration) : 0,
      }
      if ((Object.keys(next) as (keyof NarrationSnapshot)[]).some(key => next[key] !== previous[key])) {
        previous = next
        setSnapshot(next)
      }
    }

    const play = () => {
      if (disposed || !enabled || activeIndex === null || suspended || held || !desired) return
      if (Math.abs(motionState.chapter - (activeIndex + 2)) > .25) return
      const ticket = ++request
      issue = ''
      status = 'loading'
      if (audio.error) audio.load()
      publish()
      const failed = () => {
        if (disposed || ticket !== request) return
        status = 'error'
        desired = false
        audio.pause()
        issue = audio.error ? '本态讲解暂时无法播放，可点重播再试。' : '讲解尚未开始，请点继续讲解。'
        publish()
      }
      try {
        void audio.play().then(() => {
          if (disposed || ticket !== request) return
          status = 'playing'
          publish()
        }).catch(failed)
      } catch { failed() }
    }

    const reconcile = () => {
      if (disposed) return
      const nowSuspended = blockedRef.current || document.hidden
      if (nowSuspended !== suspended) {
        suspended = nowSuspended
        if (suspended) {
          request++
          audio.pause()
          if (activeIndex !== null && enabled && status !== 'ended' && status !== 'error') status = 'paused'
        } else if (desired && status !== 'ended' && status !== 'error') play()
      }

      const position = motionState.chapter
      if (activeIndex !== null && Math.abs(position - (activeIndex + 2)) > .25) {
        request++
        activeIndex = null
        desired = false
        status = 'idle'
        issue = ''
        audio.pause()
        audio.removeAttribute('src')
        audio.load()
      }
      const nearest = Math.round(position) - 2
      const nearStation = nearest >= 0 && nearest < projects.length && Math.abs(position - (nearest + 2)) <= .12
      if (activeIndex === null && nearStation) {
        if (candidate !== nearest) {
          candidate = nearest
          candidateSince = performance.now()
        } else if (performance.now() - candidateSince >= 240) {
          activeIndex = nearest
          desired = !held
          status = held ? 'paused' : 'idle'
          issue = ''
          audio.src = projects[nearest].narration
          audio.load()
          if (enabled) {
            if (suspended) status = 'paused'
            else play()
          }
        }
      } else candidate = null
      publish()
    }

    actions.current = {
      toggleEnabled() {
        enabled = !enabled
        held = false
        desired = enabled
        issue = ''
        if (enabled) play()
        else { request++; audio.pause(); status = 'idle' }
        publish()
      },
      togglePlayback() {
        if (!enabled || activeIndex === null || suspended) return
        if (!audio.paused || status === 'loading') {
          request++
          desired = false
          audio.pause()
          status = 'paused'
        } else {
          held = false
          desired = true
          if (audio.ended) audio.currentTime = 0
          play()
        }
        publish()
      },
      pausePlayback() {
        // A tour hold also covers a not-yet-created station track and remains
        // authoritative while the document or reading panel is suspended.
        held = true
        desired = false
        request++
        audio.pause()
        if (activeIndex !== null && status !== 'ended' && status !== 'error') status = 'paused'
        publish()
      },
      resumePlayback() {
        held = false
        if (!enabled) return
        desired = true
        if (audio.ended) audio.currentTime = 0
        play()
      },
      releasePlaybackHold() {
        // Leave this track paused, but restore normal auto-entry behaviour
        // for later stations when a previously enabled tour ends.
        held = false
      },
      replay() {
        if (!enabled || activeIndex === null || suspended) return
        held = false
        request++
        desired = true
        audio.pause()
        audio.currentTime = 0
        play()
      },
    }

    const onPlaying = () => {
      if (!enabled || suspended || held || !desired || activeIndex === null) { audio.pause(); return }
      status = 'playing'
      publish()
    }
    const onPause = () => {
      if (enabled && activeIndex !== null && status !== 'ended' && status !== 'error') status = 'paused'
      publish()
    }
    const onEnded = () => {
      if (activeIndex === null || !audio.ended) return
      desired = false
      status = 'ended'
      publish()
    }
    const onError = () => {
      if (activeIndex === null || !audio.error) return
      desired = false
      status = 'error'
      audio.pause()
      issue = '本态讲解暂时无法播放，可点重播再试。'
      publish()
    }
    const onWaiting = () => {
      if (enabled && desired && !suspended) { status = 'loading'; publish() }
    }
    const events: [string, () => void][] = [
      ['playing', onPlaying], ['pause', onPause], ['ended', onEnded], ['error', onError],
      ['waiting', onWaiting], ['loadedmetadata', publish], ['durationchange', publish], ['timeupdate', publish],
    ]
    events.forEach(([name, listener]) => audio.addEventListener(name, listener))
    document.addEventListener('visibilitychange', reconcile)
    const interval = window.setInterval(reconcile, 120)
    refresh.current = reconcile
    reconcile()

    return () => {
      disposed = true
      request++
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', reconcile)
      events.forEach(([name, listener]) => audio.removeEventListener(name, listener))
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
      if (audioRef.current === audio) audioRef.current = null
      refresh.current = () => {}
      actions.current = { toggleEnabled() {}, togglePlayback() {}, pausePlayback() {}, resumePlayback() {}, releasePlaybackHold() {}, replay() {} }
    }
  }, [])

  useEffect(() => {
    if (!audioRef.current) return
    audioRef.current.volume = volume
    audioRef.current.muted = !audioEnabled
  }, [volume, audioEnabled])

  useEffect(() => { refresh.current() }, [chapter, blocked])
  const toggleEnabled = useCallback(() => actions.current.toggleEnabled(), [])
  const togglePlayback = useCallback(() => actions.current.togglePlayback(), [])
  const pausePlayback = useCallback(() => actions.current.pausePlayback(), [])
  const resumePlayback = useCallback(() => actions.current.resumePlayback(), [])
  const releasePlaybackHold = useCallback(() => actions.current.releasePlaybackHold(), [])
  const replay = useCallback(() => actions.current.replay(), [])
  return { ...snapshot, toggleEnabled, togglePlayback, pausePlayback, resumePlayback, releasePlaybackHold, replay }
}
