// Keep the prototype's short synthesized percussion; no audio files or global state.
export function createGameAudio() {
  let context, master, enabled = false, active = true, volume = 1, disposed = false;
  const voices = new Set();

  function safely(action) {
    try { action()?.catch?.(() => {}); } catch { /* Audio is optional. */ }
  }

  function updateVolume() {
    if (!master || !context) return;
    safely(() => {
      master.gain.cancelScheduledValues(context.currentTime);
      master.gain.setValueAtTime(enabled && active ? 0.22 * volume : 0, context.currentTime);
    });
  }

  function stopVoices() {
    for (const stop of voices) stop(true);
  }

  function sync() {
    updateVolume();
    if (!enabled || !active) {
      stopVoices();
      if (context) safely(() => context.suspend());
    } else if (context) {
      safely(() => context.resume());
    }
  }

  function setEnabled(value) {
    if (disposed) return;
    enabled = Boolean(value);
    if (enabled && !context) {
      safely(() => {
        const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!Audio) return;
        context = new Audio();
        master = context.createGain();
        master.connect(context.destination);
      });
    }
    sync();
  }

  function sound(kind) {
    if (disposed || !enabled || !active || volume === 0 || !master || context?.state !== 'running') return;
    const nodes = [], sources = [];
    let remaining = 0, ended = false;
    const track = (node, source = false) => {
      nodes.push(node);
      if (source) sources.push(node);
      return node;
    };
    const cleanup = (stop = false) => {
      if (ended) return;
      ended = true;
      for (const source of sources) {
        source.onended = null;
        if (stop) safely(() => source.stop(0));
      }
      for (const node of nodes) safely(() => node.disconnect());
      voices.delete(cleanup);
    };
    voices.add(cleanup);
    try {
      const now = context.currentTime;
      const drum = kind === 'drum' || kind === 'land';
      const frequencies = { good: 523.25, miss: 136, jump: 261.63, win: 659.25 };
      const frequency = frequencies[kind] || 330;
      const oscillator = track(context.createOscillator(), true);
      const envelope = track(context.createGain());
      oscillator.connect(envelope); envelope.connect(master);
      oscillator.type = kind === 'miss' ? 'triangle' : 'sine';
      oscillator.frequency.setValueAtTime(drum ? 165 : frequency, now);
      oscillator.frequency.exponentialRampToValueAtTime(drum ? 42 : frequency * (kind === 'jump' ? 1.8 : 0.85), now + 0.2);
      envelope.gain.setValueAtTime(0.001, now);
      envelope.gain.exponentialRampToValueAtTime(drum ? 0.8 : 0.18, now + 0.008);
      envelope.gain.exponentialRampToValueAtTime(0.001, now + (drum ? 0.32 : 0.28));

      if (drum) {
        const buffer = context.createBuffer(1, Math.round(context.sampleRate * 0.08), context.sampleRate);
        const samples = buffer.getChannelData(0);
        for (let i = 0; i < samples.length; i++) samples[i] = (Math.random() * 2 - 1) * (1 - i / samples.length) ** 2;
        const noise = track(context.createBufferSource(), true);
        const filter = track(context.createBiquadFilter());
        const gain = track(context.createGain());
        filter.type = 'lowpass'; filter.frequency.value = 1200; gain.gain.value = 0.22;
        noise.buffer = buffer; noise.connect(filter); filter.connect(gain); gain.connect(master);
      }
      remaining = sources.length;
      for (const source of sources) {
        source.onended = () => { if (--remaining === 0) cleanup(); };
        source.start(now);
      }
      oscillator.stop(now + 0.38);
    } catch {
      cleanup(true);
    }
  }

  return {
    setEnabled,
    setActive(value) {
      if (disposed) return;
      active = Boolean(value);
      sync();
    },
    setVolume(value) {
      if (disposed || !Number.isFinite(value)) return;
      volume = Math.max(0, Math.min(1, value));
      updateVolume();
    },
    sound,
    dispose() {
      if (disposed) return;
      disposed = true; enabled = false; active = false;
      updateVolume(); stopVoices();
      if (master) safely(() => master.disconnect());
      if (context) safely(() => context.close());
      master = undefined; context = undefined;
    },
  };
}
