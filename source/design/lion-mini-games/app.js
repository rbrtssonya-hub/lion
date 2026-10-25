(function () {
  'use strict';
  const arcade = window.LionArcade;
  const $ = id => document.getElementById(id);
  const body = document.body, canvas = $('game-canvas'), ctx = canvas.getContext('2d');
  const W = 1400, H = 760;
  let game = null, currentId = null, state = 'idle', lastTime = 0, animation = 0, soundOn = false;
  let priorFocus = null, characterReturnDialog = null;
  const labels = {
    rhythm: { title: '鼓点采青', chapter: '01 · 听鼓应声' },
    poles: { title: '梅花桩落点', chapter: '02 · 观势起跃' },
  };
  const phaseNames = { ready: '准备起跃', charging: '凝神蓄力', flight: '狮跃长空', landing: '稳稳落下', recovering: '回桩再来', complete: '好戏圆满' };
  function setState(next) { state = next; body.dataset.playState = next; }
  function clearInput() {
    game?.cancelInput?.(); game?.keyup('Space'); game?.keyup('ArrowLeft'); game?.keyup('ArrowRight'); game?.pointerup();
  }
  function destroyGame() {
    clearInput(); game?.destroy(); game = null; cancelAnimationFrame(animation); animation = 0;
  }
  function updateHUD(data) {
    const values = {
      'hud-primary': data.primary,
      'hud-secondary': data.secondary,
      'hud-phase': data.combo > 1 ? `${data.combo} 次连贯` : phaseNames[data.phase] || data.phase,
      'game-hint': data.hint,
    };
    for (const [id, value] of Object.entries(values)) if ($(id).textContent !== value) $(id).textContent = value;
    $('game-progress-fill').style.width = `${Math.max(0, Math.min(1, data.progress || 0)) * 100}%`;
  }
  function render() {
    if (!game) return;
    const bounds = canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const pixelWidth = Math.max(1, Math.round(bounds.width * dpr)), pixelHeight = Math.max(1, Math.round(bounds.height * dpr));
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) { canvas.width = pixelWidth; canvas.height = pixelHeight; }
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#241018'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const fit = Math.min(bounds.width / W, bounds.height / H);
    ctx.setTransform(dpr * fit, 0, 0, dpr * fit, (bounds.width - W * fit) / 2 * dpr, (bounds.height - H * fit) / 2 * dpr);
    game.draw(ctx, W, H);
  }
  function frame(now) {
    const dt = lastTime ? Math.min((now - lastTime) / 1000, .05) : 0;
    lastTime = now;
    if (state === 'playing' && game) game.update(dt);
    render();
    if (state === 'playing') animation = requestAnimationFrame(frame);
  }
  function openModal(element) {
    priorFocus = document.activeElement; element.hidden = false;
    element.querySelector('button')?.focus({ preventScroll: true });
  }
  function closeModal(element) { element.hidden = true; priorFocus?.focus?.({ preventScroll: true }); }
  function complete(result) {
    if (state !== 'playing') return;
    setState('complete'); clearInput();
    $('result-title').textContent = result.title;
    $('result-rank').textContent = result.rank;
    $('result-subtitle').textContent = result.subtitle;
    $('result-stats').replaceChildren();
    for (const item of result.stats || []) {
      const box = document.createElement('div'), value = document.createElement('strong'), label = document.createElement('span');
      value.textContent = item.value; label.textContent = item.label; box.append(value, label); $('result-stats').append(box);
    }
    openModal($('result-dialog'));
  }
  function start(id) {
    if (body.dataset.ready !== 'true' || !arcade.games[id]) return;
    destroyGame(); currentId = id;
    $('pause-dialog').hidden = true; $('result-dialog').hidden = true;
    $('character-dialog').hidden = true; characterReturnDialog = null;
    $('menu-view').hidden = true; $('play-view').hidden = false;
    body.dataset.view = 'play'; body.dataset.game = id;
    $('game-title').textContent = labels[id].title; $('game-chapter').textContent = labels[id].chapter;
    $('hud-primary-label').textContent = '本局表现'; $('hud-secondary-label').textContent = '本局进度';
    setState('playing');
    game = arcade.games[id].create({ onComplete: complete, onHUD: updateHUD, art: arcade.art, sound: arcade.audio.sound });
    lastTime = 0; canvas.focus({ preventScroll: true }); animation = requestAnimationFrame(frame);
  }
  function menu() {
    destroyGame(); setState('idle');
    $('pause-dialog').hidden = true; $('result-dialog').hidden = true;
    $('character-dialog').hidden = true; characterReturnDialog = null;
    $('play-view').hidden = true; $('menu-view').hidden = false;
    body.dataset.view = 'menu'; delete body.dataset.game;
    document.querySelector(`[data-game="${currentId || 'rhythm'}"]`)?.focus({ preventScroll: true });
  }
  function pause() {
    if (state !== 'playing') return;
    clearInput(); setState('paused'); cancelAnimationFrame(animation); animation = 0;
    render(); openModal($('pause-dialog'));
  }
  function resume() {
    if (state !== 'paused' || !$('character-dialog').hidden) return;
    $('pause-dialog').hidden = true; setState('playing'); lastTime = 0;
    canvas.focus({ preventScroll: true }); animation = requestAnimationFrame(frame);
  }
  function point(event) {
    const bounds = canvas.getBoundingClientRect(), fit = Math.min(bounds.width / W, bounds.height / H);
    return { x: (event.clientX - bounds.left - (bounds.width - W * fit) / 2) / fit, y: (event.clientY - bounds.top - (bounds.height - H * fit) / 2) / fit };
  }
  document.querySelectorAll('[data-game]').forEach(button => button.addEventListener('click', () => start(button.dataset.game)));
  $('brand-home').addEventListener('click', event => { event.preventDefault(); menu(); });
  $('menu-button').addEventListener('click', menu); $('pause-menu').addEventListener('click', menu); $('result-menu').addEventListener('click', menu);
  $('pause-button').addEventListener('click', pause); $('resume-button').addEventListener('click', resume);
  $('replay-button').addEventListener('click', () => start(currentId));
  $('sound-button').addEventListener('click', () => {
    soundOn = !soundOn; arcade.audio.enable(soundOn);
    $('sound-button').setAttribute('aria-pressed', String(soundOn)); $('sound-label').textContent = soundOn ? '声音已开启' : '声音已关闭';
    if (soundOn) arcade.audio.sound('drum');
  });
  $('character-open').addEventListener('click', () => {
    if (state === 'playing') pause();
    characterReturnDialog = [...document.querySelectorAll('.modal')].findLast(item => !item.hidden) || null;
    if (characterReturnDialog) characterReturnDialog.hidden = true;
    openModal($('character-dialog'));
  });
  function closeCharacter() {
    closeModal($('character-dialog'));
    if (characterReturnDialog) {
      characterReturnDialog.hidden = false;
      characterReturnDialog.querySelector('button')?.focus({ preventScroll: true });
      characterReturnDialog = null;
    } else $('character-open').focus({ preventScroll: true });
  }
  $('character-close').addEventListener('click', closeCharacter);
  canvas.addEventListener('pointerdown', event => {
    if (state !== 'playing' || event.button !== 0) return;
    event.preventDefault(); canvas.focus({ preventScroll: true }); canvas.setPointerCapture(event.pointerId); game.pointerdown(point(event));
  });
  canvas.addEventListener('pointerup', event => {
    if (state === 'playing') game.pointerup(point(event));
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointercancel', clearInput);
  window.addEventListener('keydown', event => {
    if (event.code === 'Escape') {
      event.preventDefault();
      if (!$('character-dialog').hidden) closeCharacter(); else if (state === 'playing') pause(); else if (state === 'paused') resume();
      return;
    }
    const modal = [...document.querySelectorAll('.modal')].findLast(item => !item.hidden);
    if (modal) {
      if (event.key === 'Tab') {
        const controls = [...modal.querySelectorAll('button:not(:disabled)')];
        const index = controls.indexOf(document.activeElement);
        if (event.shiftKey && index <= 0) { event.preventDefault(); controls.at(-1)?.focus(); }
        else if (!event.shiftKey && index === controls.length - 1) { event.preventDefault(); controls[0]?.focus(); }
      }
      return;
    }
    if (state === 'playing' && ['Space', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
      if (document.activeElement !== canvas && document.activeElement?.tagName === 'BUTTON') return;
      event.preventDefault(); if (!event.repeat) game.keydown(event.code);
    }
  });
  window.addEventListener('keyup', event => { if (state === 'playing') game?.keyup(event.code); });
  window.addEventListener('blur', pause);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  window.addEventListener('resize', () => { if (state !== 'playing') render(); });
  window.addEventListener('pagehide', destroyGame);
  arcade.preview = Object.freeze({ get state() { return state; }, get activeGame() { return game; }, get gameId() { return currentId; } });
  arcade.ready.then(() => {
    body.dataset.ready = 'true'; document.querySelectorAll('[data-game]').forEach(button => { button.disabled = false; });
    $('asset-status').textContent = '舞台已就绪 · 选一出，和阿南一起开场';
  }).catch(error => {
    $('asset-status').textContent = '角色素材未载入，请保留 assets 文件夹后刷新页面。';
    console.error(error.message);
  });
}());
