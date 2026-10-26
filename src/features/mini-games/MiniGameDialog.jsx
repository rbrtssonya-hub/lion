import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { media } from '../../config/media.js';
import { useMediaAudioPreference, useMediaVolumePreference } from '../../hooks/useMediaAudioPreference.js';
import { loadGameArt } from './gameArt.js';
import { createGameAudio } from './gameAudio.js';
import { createRhythmGame } from './rhythmGame.js';
import { createPoleGame } from './poleGame.js';
import './mini-games.css';

const games = {
  rhythm: { title: '鼓点采青', chapter: '听鼓应声', hint: '金圈合拢时，按空格或点击舞台击鼓', create: createRhythmGame },
  poles: { title: '梅花桩落点', chapter: '观势起跃', hint: '按住空格或鼠标蓄力，金色段松开起跳', create: createPoleGame },
};
const phaseNames = { ready: '准备起跃', charging: '凝神蓄力', flight: '狮跃长空', landing: '稳稳落下', recovering: '回桩再来', complete: '好戏圆满' };
const WIDTH = 1400, HEIGHT = 760;

function GamePlayer({ gameId }) {
  const info = games[gameId];
  const canvasRef = useRef(null), controlsRef = useRef(null), audioRef = useRef(null), overlayActionRef = useRef(null);
  const [audioEnabled] = useMediaAudioPreference();
  const [volume] = useMediaVolumePreference();
  const [soundOn, setSoundOn] = useState(false);
  const preferences = useRef({ enabled: audioEnabled, volume, soundOn });
  preferences.current = { enabled: audioEnabled, volume, soundOn };
  const [attempt, setAttempt] = useState(0);
  const [playState, setPlayState] = useState('loading');
  const [hud, setHud] = useState({ phase: '', progress: 0, primary: '', secondary: '', hint: info.hint });
  const [result, setResult] = useState(null), [error, setError] = useState('');

  useEffect(() => {
    if (playState === 'playing') canvasRef.current?.focus({ preventScroll: true });
    else if (['paused', 'complete', 'error'].includes(playState)) overlayActionRef.current?.focus({ preventScroll: true });
  }, [playState]);

  useEffect(() => {
    const audio = audioRef.current;
    audio?.setVolume(volume);
    audio?.setEnabled(soundOn && audioEnabled && volume > 0);
  }, [audioEnabled, volume, soundOn]);

  useEffect(() => {
    const canvas = canvasRef.current, ctx = canvas.getContext('2d');
    const abort = new AbortController();
    const audio = createGameAudio();
    audioRef.current = audio;
    audio.setVolume(preferences.current.volume);
    audio.setEnabled(preferences.current.soundOn && preferences.current.enabled && preferences.current.volume > 0);
    let game, destroyed = false, state = 'loading', frame = 0, last = 0;
    setPlayState('loading'); setResult(null); setError('');
    setHud({ phase: '', progress: 0, primary: '', secondary: '', hint: info.hint });

    const clearInput = () => {
      game?.cancelInput?.(); game?.keyup('Space'); game?.keyup('ArrowLeft'); game?.keyup('ArrowRight'); game?.pointerup();
    };
    const draw = () => {
      if (!game || destroyed) return;
      const bounds = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
      const pixelWidth = Math.max(1, Math.round(bounds.width * dpr)), pixelHeight = Math.max(1, Math.round(bounds.height * dpr));
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) { canvas.width = pixelWidth; canvas.height = pixelHeight; }
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#241018'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      const fit = Math.min(bounds.width / WIDTH, bounds.height / HEIGHT);
      ctx.setTransform(dpr * fit, 0, 0, dpr * fit, (bounds.width - WIDTH * fit) / 2 * dpr, (bounds.height - HEIGHT * fit) / 2 * dpr);
      game.draw(ctx, WIDTH, HEIGHT);
    };
    const tick = now => {
      frame = 0;
      if (destroyed || state !== 'playing') return;
      const dt = last ? Math.min((now - last) / 1000, .05) : 0;
      last = now; game.update(dt); draw();
      if (state === 'playing') frame = requestAnimationFrame(tick);
    };
    const pause = () => {
      audio.setActive(false);
      if (state !== 'playing') return;
      clearInput(); state = 'paused'; setPlayState('paused');
      cancelAnimationFrame(frame); frame = 0; draw();
    };
    const resume = () => {
      if (state !== 'paused' || document.hidden) return;
      state = 'playing'; setPlayState('playing'); last = 0; audio.setActive(true);
      canvas.focus({ preventScroll: true }); frame = requestAnimationFrame(tick);
    };
    const visibility = () => { if (document.hidden) pause(); };
    const point = event => {
      const bounds = canvas.getBoundingClientRect(), fit = Math.min(bounds.width / WIDTH, bounds.height / HEIGHT);
      return { x: (event.clientX - bounds.left - (bounds.width - WIDTH * fit) / 2) / fit, y: (event.clientY - bounds.top - (bounds.height - HEIGHT * fit) / 2) / fit };
    };
    controlsRef.current = {
      pause, resume,
      keydown: code => { if (state === 'playing') game?.keydown(code); },
      keyup: code => { if (state === 'playing') game?.keyup(code); },
      pointerdown: event => { if (state === 'playing') { canvas.focus({ preventScroll: true }); canvas.setPointerCapture(event.pointerId); game?.pointerdown(point(event)); } },
      pointerup: event => { if (state === 'playing') game?.pointerup(point(event)); if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId); },
      cancelInput: clearInput,
    };
    window.addEventListener('blur', pause);
    document.addEventListener('visibilitychange', visibility);
    const resize = new ResizeObserver(() => { if (state !== 'playing') draw(); });
    resize.observe(canvas);
    loadGameArt({ posesUrl: media.lionGamePoses, signal: abort.signal }).then(art => {
      if (destroyed) return;
      game = info.create({
        art, sound: audio.sound,
        onHUD: data => { if (!destroyed) setHud(data); },
        onComplete: data => {
          if (destroyed || state !== 'playing') return;
          state = 'complete'; clearInput(); cancelAnimationFrame(frame); frame = 0;
          setResult(data); setPlayState('complete');
        },
      });
      state = 'playing'; setPlayState('playing');
      canvas.focus({ preventScroll: true }); draw();
      if (document.hidden || !document.hasFocus()) pause(); else frame = requestAnimationFrame(tick);
    }).catch(reason => {
      if (destroyed || reason.name === 'AbortError') return;
      state = 'error'; setPlayState('error'); setError('阿南的角色素材暂未载入，请重试。');
    });
    return () => {
      destroyed = true; abort.abort(); cancelAnimationFrame(frame); clearInput(); game?.destroy();
      resize.disconnect(); window.removeEventListener('blur', pause); document.removeEventListener('visibilitychange', visibility);
      audio.dispose(); if (audioRef.current === audio) audioRef.current = null;
      controlsRef.current = null;
    };
  }, [gameId, attempt, info]);

  const toggleSound = () => {
    const next = !soundOn;
    audioRef.current?.setEnabled(next && audioEnabled && volume > 0);
    setSoundOn(next);
  };
  const keydown = event => {
    if (!['Space', 'ArrowLeft', 'ArrowRight'].includes(event.code)) return;
    event.preventDefault(); if (!event.repeat) controlsRef.current?.keydown(event.code);
  };
  return <div className="mini-game-player" data-play-state={playState} data-game-phase={hud.phase}>
    <div className="mini-game-status-row">
      <div className="mini-game-hud" aria-label="本局状态"><span>{hud.primary || '正在准备舞台'}</span><span>{hud.secondary}</span><span>{hud.combo > 1 ? `${hud.combo} 次连贯` : phaseNames[hud.phase] || hud.phase}</span></div>
      <div className="mini-game-tools"><button type="button" data-sound-control aria-pressed={soundOn} onClick={toggleSound} title={!audioEnabled || volume === 0 ? '鼓音跟随网页静音设置' : '合成鼓音跟随网页音量'}>{!audioEnabled || volume === 0 ? '网页已静音' : soundOn ? '鼓音开启' : '鼓音关闭'}</button><button type="button" disabled={!['playing', 'paused'].includes(playState)} onClick={() => playState === 'paused' ? controlsRef.current?.resume() : controlsRef.current?.pause()}>{playState === 'paused' ? '继续游戏' : '暂停游戏'}</button></div>
    </div>
    <div className="mini-game-stage">
      <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} tabIndex="0" inert={playState !== 'playing'} aria-label={`${info.title}游戏舞台`}
        onBlur={() => controlsRef.current?.cancelInput()}
        onKeyDown={keydown} onKeyUp={event => controlsRef.current?.keyup(event.code)}
        onPointerDown={event => { if (event.button === 0) { event.preventDefault(); controlsRef.current?.pointerdown(event); } }}
        onPointerUp={event => controlsRef.current?.pointerup(event)} onPointerCancel={() => controlsRef.current?.cancelInput()} />
      <div className="mini-game-progress" aria-hidden="true"><span style={{ width: `${Math.min(1, Math.max(0, hud.progress || 0)) * 100}%` }} /></div>
      {playState === 'loading' && <div className="mini-game-overlay" role="status"><span className="mini-game-seal" aria-hidden="true">狮</span><h3>阿南正在候场</h3><p>舞台与角色准备中…</p></div>}
      {playState === 'error' && <div className="mini-game-overlay" role="status"><h3>稍等，再试一次</h3><p>{error}</p><button ref={overlayActionRef} type="button" className="mini-game-primary" onClick={() => setAttempt(value => value + 1)}>重试加载</button></div>}
      {playState === 'paused' && <div className="mini-game-overlay"><span className="mini-game-kicker">歇一拍，再起舞</span><h3>好戏稍候</h3><p>准备好后，和阿南继续这一局。</p><button ref={overlayActionRef} type="button" className="mini-game-primary" onClick={() => controlsRef.current?.resume()}>继续游戏</button></div>}
      {result && <div className="mini-game-overlay mini-game-result"><span className="mini-game-kicker">{result.rank}</span><h3>{result.title}</h3><p>{result.subtitle}</p><div className="mini-game-result-stats">{result.stats.map(item => <div key={item.label}><strong>{item.value}</strong><span>{item.label}</span></div>)}</div><button ref={overlayActionRef} type="button" className="mini-game-primary" onClick={() => setAttempt(value => value + 1)}>再来一局</button></div>}
    </div>
    <div className="mini-game-bottom"><p className="mini-game-hint" aria-live="polite">{hud.hint}</p><span>AI 辅助原创角色 · 创意互动演绎</span></div>
  </div>;
}

export default function MiniGameDialog({ gameId, onClose, returnFocus }) {
  const dialogRef = useRef(null), closingRef = useRef(false);
  const info = games[gameId];
  const dismiss = () => { if (!closingRef.current) { closingRef.current = true; onClose(); } };
  useEffect(() => {
    const dialog = dialogRef.current;
    closingRef.current = false;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; dialog.showModal();
    return () => {
      closingRef.current = true; if (dialog.open) dialog.close();
      document.body.style.overflow = previousOverflow;
      if (returnFocus?.isConnected && !returnFocus.closest('[hidden], [inert]')) returnFocus.focus({ preventScroll: true });
    };
  }, [returnFocus]);
  const trapKeys = event => {
    event.stopPropagation();
    if (event.key !== 'Tab') return;
    const items = [...event.currentTarget.querySelectorAll('button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])')]
      .filter(node => !node.closest('[inert]') && node.getClientRects().length > 0);
    const first = items[0], last = items.at(-1), focused = document.activeElement;
    if (event.shiftKey && (focused === first || !items.includes(focused))) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && (focused === last || !items.includes(focused))) { event.preventDefault(); first?.focus(); }
  };
  return createPortal(<dialog ref={dialogRef} className="mini-game-dialog" aria-label={info.title} data-game={gameId}
    onCancel={event => { event.preventDefault(); dismiss(); }} onClose={() => { if (!dialogRef.current?.open) dismiss(); }}
    onKeyDown={trapKeys} onWheel={event => event.stopPropagation()}>
    <header className="mini-game-dialog-top"><div><span>狮艺小试 · {info.chapter}</span><h2>{info.title}</h2></div><button type="button" aria-label="关闭小游戏" onClick={dismiss}>返回工艺 <span aria-hidden="true">×</span></button></header>
    <GamePlayer gameId={gameId} />
  </dialog>, document.body);
}
