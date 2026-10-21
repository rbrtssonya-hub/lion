import { useLayoutEffect, useRef, useState } from 'react';

const initialView = { status: 'idle', currentTime: 0, duration: 0, error: '' };
const visibleDocument = () => typeof document === 'undefined' || !document.hidden;
const finiteTime = value => Number.isFinite(value) && value >= 0 ? value : 0;
const stopDiscardedPlayback = event => {
  event.currentTarget.muted = true;
  event.currentTarget.pause();
};

function createPlaybackController(updateView, updateIntent, updateAudio, initialConfig) {
  const records = new Map();
  const bindings = new Map();
  let config = initialConfig;
  let mounted = false;

  const recordFor = id => {
    if (!records.has(id)) records.set(id, {
      node: null, wanted: false, revision: 0, pending: null, status: 'idle', error: '',
    });
    return records.get(id);
  };

  const mayPlay = (id, record, node = record.node) => mounted && config.enabled && visibleDocument()
    && config.playingIntent && config.ids.has(id) && (!config.flatMode || id === config.activeId)
    && node && record.node === node && node.isConnected;

  const publish = id => {
    if (!mounted || id !== config.activeId) return;
    const record = recordFor(id);
    const next = {
      status: record.status,
      currentTime: finiteTime(record.node?.currentTime),
      duration: finiteTime(record.node?.duration),
      error: record.error,
    };
    updateView(previous => Object.keys(next).every(key => previous[key] === next[key]) ? previous : next);
  };

  // Mute every element first: changing the primary screen never overlaps audio.
  const syncAudio = () => {
    for (const record of records.values()) if (record.node) record.node.muted = true;
    const primary = records.get(config.activeId);
    if (config.audioEnabled && primary?.wanted && mayPlay(config.activeId, primary)
      && primary.status !== 'blocked' && primary.status !== 'error') primary.node.muted = false;
  };

  const pauseRecord = (id, record) => {
    record.wanted = false;
    record.revision += 1;
    record.pending = null;
    if (record.status !== 'blocked' && record.status !== 'error') record.status = 'paused';
    if (record.node) {
      record.node.muted = true;
      record.node.pause();
    }
    publish(id);
  };

  const requestPlay = (id, record) => {
    const node = record.node;
    if (!mayPlay(id, record, node) || record.status === 'blocked' || record.status === 'error') return;
    if (record.wanted && (record.pending || !node.paused)) return;
    record.wanted = true;
    const revision = ++record.revision;
    if (node.paused) record.status = 'loading';
    record.error = '';
    syncAudio();
    publish(id);

    const succeeded = () => {
      // An abandoned promise can start a detached/hidden element late. A newer
      // desired request on this same element must remain free to keep playing.
      if (!mayPlay(id, record, node) || !record.wanted) {
        node.muted = true;
        node.pause();
        return;
      }
      if (revision !== record.revision) return;
      record.pending = null;
      record.status = node.paused ? 'paused' : 'playing';
      syncAudio();
      publish(id);
    };
    const failed = error => {
      // A deferred native play can flip paused=false even when it rejects
      // after its source was released. Stop abandoned failures as well as
      // successes, while leaving a newer desired request on this node alone.
      if (!mayPlay(id, record, node) || !record.wanted) {
        node.muted = true;
        node.pause();
        return;
      }
      if (!mounted || record.node !== node || revision !== record.revision) return;
      record.pending = null;
      record.wanted = false;
      node.muted = true;
      node.pause();
      if (error?.name === 'NotAllowedError') {
        record.status = 'blocked';
        record.error = '播放被浏览器阻止，请点击播放继续观看';
      } else {
        record.status = 'error';
        record.error = error?.name === 'AbortError'
          ? '视频播放被中断，请重试'
          : '视频暂时无法播放，请重试';
      }
      publish(id);
    };

    try {
      // This call stays in the original click stack for gesture authorization.
      const result = node.play();
      if (result?.then) {
        record.pending = { revision };
        result.then(succeeded, failed);
      } else succeeded();
    } catch (error) { failed(error); }
  };

  const reconcile = () => {
    syncAudio();
    for (const [id, record] of records) {
      if (!record.node) continue;
      if (!mayPlay(id, record)) {
        if (record.wanted || record.pending || !record.node.paused) pauseRecord(id, record);
        else if (record.status === 'idle') record.status = 'paused';
      } else requestPlay(id, record);
    }
    syncAudio();
    publish(config.activeId);
  };

  const eventFor = (id, event) => {
    const record = records.get(id);
    return record?.node === event.currentTarget ? record : null;
  };
  const onRunning = (id, event, status) => {
    const record = eventFor(id, event);
    if (!record) return;
    if (!mayPlay(id, record) || !record.wanted || record.status === 'error' || record.status === 'blocked') {
      event.currentTarget.muted = true;
      event.currentTarget.pause();
      return;
    }
    record.status = status;
    syncAudio();
    publish(id);
  };

  const bindVideo = id => {
    if (bindings.has(id)) return bindings.get(id);
    const props = {
      ref: node => {
        const record = recordFor(id);
        if (record.node === node) return;
        pauseRecord(id, record);
        record.node = node;
        record.status = node ? 'idle' : 'paused';
        record.error = '';
        if (node) {
          node.muted = true;
          node.loop = true;
          if (mounted) reconcile();
        }
      },
      onPlay: event => onRunning(id, event, 'loading'),
      onPlaying: event => onRunning(id, event, 'playing'),
      onPause: event => {
        const record = eventFor(id, event);
        if (!record || !event.currentTarget.paused) return;
        if (record.status !== 'blocked' && record.status !== 'error') record.status = 'paused';
        publish(id);
      },
      onWaiting: event => {
        const record = eventFor(id, event);
        if (!record || !record.wanted || !mayPlay(id, record)) return;
        record.status = 'loading';
        publish(id);
      },
      onCanPlay: event => {
        const record = eventFor(id, event);
        if (!record) return;
        if (mayPlay(id, record) && record.wanted && !event.currentTarget.paused
          && record.status !== 'error' && record.status !== 'blocked') record.status = 'playing';
        publish(id);
      },
      onLoadedMetadata: event => { if (eventFor(id, event)) publish(id); },
      onDurationChange: event => { if (eventFor(id, event)) publish(id); },
      onTimeUpdate: event => { if (eventFor(id, event)) publish(id); },
      onSeeked: event => { if (eventFor(id, event)) publish(id); },
      onError: event => {
        const record = eventFor(id, event);
        if (!record) return;
        pauseRecord(id, record);
        record.status = 'error';
        record.error = '视频暂时无法播放，请重试';
        publish(id);
      },
    };
    bindings.set(id, props);
    return props;
  };

  const setIntent = wanted => {
    config = { ...config, playingIntent: wanted };
    updateIntent(wanted);
  };

  const retry = () => {
    const record = records.get(config.activeId);
    if (!record?.node || !mounted) return;
    setIntent(true);
    pauseRecord(config.activeId, record);
    record.status = 'idle';
    record.error = '';
    // Loading is reserved for an explicit retry; switching primary screens and
    // ordinary play/pause never reset a clip's timeline or reload its source.
    record.node.load();
    reconcile();
  };
  const resume = () => {
    if (records.get(config.activeId)?.status === 'error') { retry(); return; }
    setIntent(true);
    for (const record of records.values()) {
      if (record.status === 'blocked') { record.status = 'paused'; record.error = ''; }
    }
    reconcile();
  };

  return {
    bindVideo,
    getVideo: id => records.get(id)?.node || null,
    configure(next) { config = next; reconcile(); },
    mount() {
      mounted = true;
      document.addEventListener('visibilitychange', reconcile);
      reconcile();
    },
    unmount() {
      mounted = false;
      document.removeEventListener('visibilitychange', reconcile);
      const nodes = [...records.entries()].map(([id, record]) => {
        pauseRecord(id, record);
        return record.node;
      }).filter(Boolean);
      // StrictMode performs a synchronous cleanup/setup rehearsal. Release
      // sources only after a real unmount, so that rehearsal keeps valid src.
      queueMicrotask(() => {
        if (mounted) return;
        for (const node of nodes) {
          // Detached media no longer bubbles play events to React. A delayed
          // native call can also leave its promise pending after src removal.
          // Keep a local guard on the discarded node, without retaining this
          // controller or registering anything on document/window.
          node.addEventListener('play', stopDiscardedPlayback);
          node.muted = true;
          node.pause();
          node.removeAttribute('src');
          node.load();
        }
      });
    },
    togglePlayback() {
      const active = records.get(config.activeId);
      if (config.playingIntent && (active?.status === 'playing' || active?.status === 'loading')) {
        setIntent(false);
        reconcile();
        return;
      }
      resume();
    },
    resume,
    toggleAudio() {
      const next = !config.audioEnabled;
      config = { ...config, audioEnabled: next };
      updateAudio(next);
      syncAudio();
      // A sound click can also authorize a previously blocked active video.
      if (next && config.playingIntent) {
        const active = records.get(config.activeId);
        if (active?.status === 'blocked') { active.status = 'paused'; active.error = ''; }
        reconcile();
      }
    },
    seek(value) {
      const active = records.get(config.activeId);
      if (!active?.node || !Number.isFinite(Number(value))) return;
      const duration = active.node.duration;
      if (!Number.isFinite(duration) || duration <= 0) return;
      active.node.currentTime = Math.min(duration, Math.max(0, Number(value)));
      publish(config.activeId);
    },
    retry,
  };
}

export function useTheaterPlayback({ clips, activeId, enabled, flatMode = false }) {
  const [view, setView] = useState(initialView);
  const [playingIntent, setPlayingIntent] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const controllerRef = useRef(null);
  const config = { ids: new Set(clips.map(clip => clip.id)), activeId, enabled, flatMode, playingIntent, audioEnabled };
  if (!controllerRef.current) controllerRef.current = createPlaybackController(setView, setPlayingIntent, setAudioEnabled, config);
  const controller = controllerRef.current;

  useLayoutEffect(() => {
    controller.mount();
    return () => controller.unmount();
  }, [controller]);
  // Commit current props before browser media events or user input can use them.
  // Stable bindings keep React from detaching/recreating video elements.
  useLayoutEffect(() => { controller.configure(config); });

  return {
    bindVideo: controller.bindVideo,
    getVideo: controller.getVideo,
    view,
    playingIntent,
    audioEnabled,
    togglePlayback: controller.togglePlayback,
    resume: controller.resume,
    toggleAudio: controller.toggleAudio,
    seek: controller.seek,
    retry: controller.retry,
  };
}
