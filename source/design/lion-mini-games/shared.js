(function () {
  'use strict';
  const arcade = window.LionArcade ||= { games: {} };
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const frames = {
    idle: { cell: [0, 0], box: [90, 107, 576, 595] },
    crouch: { cell: [627, 0], box: [62, 220, 554, 597] },
    jump: { cell: [0, 627], box: [121, 34, 598, 457] },
    land: { cell: [627, 627], box: [47, 122, 560, 517] },
  };
  const assets = {};
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('角色图像未能加载：' + src));
      img.src = src;
    });
  }
  arcade.ready = Promise.all([
    loadImage('assets/lion-ip.png').then(img => { assets.ip = img; }),
    loadImage('assets/lion-poses.png').then(img => { assets.poses = img; }),
  ]);
  function roundRect(ctx, x, y, w, h, r, fill, stroke) {
    ctx.beginPath(); ctx.roundRect(x, y, Math.max(0, w), Math.max(0, h), r);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
  }
  function text(ctx, value, x, y, size, color, align = 'left') {
    ctx.save(); ctx.fillStyle = color || '#f4e6c9';
    ctx.font = `${size}px "STKaiti", "KaiTi", "Microsoft YaHei", serif`;
    ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(String(value), x, y); ctx.restore();
  }
  function lion(ctx, x, footY, width, options = {}) {
    const frame = frames[options.pose] || frames.idle;
    if (!assets.poses) return;
    const [left, top, right, bottom] = frame.box;
    const padding = 5, scale = width / 500;
    const sourceX = frame.cell[0] + left - padding, sourceY = frame.cell[1] + top - padding;
    const sw = right - left + padding * 2, sh = bottom - top + padding * 2;
    ctx.save(); ctx.translate(x, footY);
    ctx.rotate(options.tilt || 0);
    ctx.scale((options.flip ? -1 : 1) * (options.stretchX || 1), options.stretchY || 1);
    ctx.globalAlpha *= options.alpha ?? 1;
    ctx.drawImage(assets.poses, sourceX, sourceY, sw, sh, -sw * scale / 2, -(sh - padding) * scale, sw * scale, sh * scale);
    ctx.restore();
  }
  function cloud(ctx, x, y, scale, alpha) {
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
    ctx.strokeStyle = `rgba(221,176,112,${alpha})`; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-90, 20); ctx.lineTo(45, 20); ctx.bezierCurveTo(100, 20, 82, -12, 56, -4);
    ctx.bezierCurveTo(80, -48, 18, -55, 13, -22); ctx.bezierCurveTo(-8, -42, -41, -14, -27, 1);
    ctx.bezierCurveTo(-74, -20, -93, 13, -70, 20); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-55, 32); ctx.lineTo(82, 32); ctx.stroke(); ctx.restore();
  }
  function lantern(ctx, x, y, scale) {
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
    ctx.strokeStyle = '#bd865262'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -130); ctx.lineTo(0, -38); ctx.stroke();
    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 95); glow.addColorStop(0, '#f2ab4d24'); glow.addColorStop(1, '#f2ab4d00');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, 95, 0, Math.PI * 2); ctx.fill();
    const red = ctx.createLinearGradient(-27, 0, 27, 0); red.addColorStop(0, '#5e1b23'); red.addColorStop(.5, '#b74b32'); red.addColorStop(1, '#6c242a');
    ctx.fillStyle = red; ctx.beginPath(); ctx.ellipse(0, 0, 30, 43, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#d7a45c73'; ctx.lineWidth = 1; ctx.stroke();
    [-14, 0, 14].forEach(offset => { ctx.beginPath(); ctx.ellipse(offset * .3, 0, 10 + Math.abs(offset) / 3, 43, 0, 0, Math.PI * 2); ctx.stroke(); });
    roundRect(ctx, -14, -43, 28, 5, 1, '#b6864d'); roundRect(ctx, -14, 38, 28, 5, 1, '#b6864d');
    ctx.beginPath(); ctx.moveTo(0, 43); ctx.lineTo(0, 68); ctx.stroke();
    for (let i = -6; i <= 6; i += 3) { ctx.beginPath(); ctx.moveTo(i, 66); ctx.lineTo(i, 84); ctx.stroke(); }
    ctx.restore();
  }
  function backdrop(ctx, w, h, options = {}) {
    const time = reduced ? 0 : options.time || 0;
    ctx.save(); ctx.scale(w / 1400, h / 760);
    const bg = ctx.createLinearGradient(0, 0, 0, 760); bg.addColorStop(0, '#28121c'); bg.addColorStop(.55, '#501f27'); bg.addColorStop(1, '#251017');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, 1400, 760);
    const halo = ctx.createRadialGradient(options.mode === 'poles' ? 720 : 1000, 270, 20, 810, 350, 690);
    halo.addColorStop(0, '#cf78452e'); halo.addColorStop(.5, '#96503a12'); halo.addColorStop(1, '#cf784500'); ctx.fillStyle = halo; ctx.fillRect(0, 0, 1400, 760);
    // Curved beams and paired pillars frame the small theatre.
    ctx.fillStyle = '#160c15a8'; ctx.fillRect(0, 0, 1400, 28);
    ctx.strokeStyle = '#b584483b'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 35); ctx.quadraticCurveTo(700, 80, 1400, 35); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 46); ctx.quadraticCurveTo(700, 91, 1400, 46); ctx.stroke();
    [45, 1355].forEach(x => {
      const pillar = ctx.createLinearGradient(x - 13, 0, x + 13, 0); pillar.addColorStop(0, '#36151c'); pillar.addColorStop(.5, '#7a3930'); pillar.addColorStop(1, '#35151b');
      roundRect(ctx, x - 13, 30, 26, 545, 4, pillar, '#b8824d24');
      roundRect(ctx, x - 22, 555, 44, 14, 2, '#7c5136');
      roundRect(ctx, x - 18, 50, 36, 9, 2, '#9b6e423b');
    });
    lantern(ctx, 117, 157 + Math.sin(time * .7) * 2, .75);
    lantern(ctx, 1282, 169 + Math.sin(time * .6) * 2, .67);
    cloud(ctx, 239, 223, 1.5, .12); cloud(ctx, 1146, 350, 1.8, .12);
    cloud(ctx, 725, 182, 2.4, .065); cloud(ctx, 142, 474, 1.8, .08);
    // Warm pools of light on the lacquered floor.
    ctx.fillStyle = '#140b12a3'; ctx.fillRect(0, 590, 1400, 170);
    const floorGlow = ctx.createRadialGradient(720, 600, 10, 720, 650, 620); floorGlow.addColorStop(0, '#b4724238'); floorGlow.addColorStop(1, '#b4724200');
    ctx.fillStyle = floorGlow; ctx.fillRect(0, 580, 1400, 180);
    ctx.strokeStyle = '#d7a96024'; ctx.beginPath(); ctx.moveTo(0, 590); ctx.lineTo(1400, 590); ctx.stroke();
    ctx.strokeStyle = '#d1a26d0c';
    for (let x = -400; x <= 1800; x += 180) { ctx.beginPath(); ctx.moveTo(700 + (x - 700) * .6, 590); ctx.lineTo(x, 760); ctx.stroke(); }
    [627, 690, 752].forEach(y => { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1400, y); ctx.stroke(); });
    for (let i = 0; i < 21; i++) {
      const x = (i * 187.3 + Math.sin(time * .17 + i) * 18) % 1400;
      const y = 150 + ((i * 71.4 - time * (3 + i % 3)) % 410 + 410) % 410;
      ctx.fillStyle = `rgba(237,192,119,${.1 + Math.sin(i + time) * .06})`;
      ctx.beginPath(); ctx.arc(x, y, i % 4 === 0 ? 1.6 : 1, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  arcade.art = { lion, backdrop, text, roundRect };

  let context, master, enabled = false;
  function enableSound(value) {
    enabled = value;
    if (!enabled) { if (master && context) master.gain.setTargetAtTime(0, context.currentTime, .03); return; }
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      context ||= new Audio();
      if (!master) { master = context.createGain(); master.gain.value = .22; master.connect(context.destination); }
      master.gain.setTargetAtTime(.22, context.currentTime, .03);
      context.resume().catch(() => {});
    } catch (_) { /* Sound is optional; the visual beat remains playable. */ }
  }
  function sound(kind) {
    if (!enabled || !context || context.state !== 'running') return;
    const now = context.currentTime;
    const oscillator = context.createOscillator(), envelope = context.createGain();
    oscillator.connect(envelope); envelope.connect(master);
    const drum = kind === 'drum' || kind === 'land';
    const frequencies = { good: 523.25, miss: 136, jump: 261.63, win: 659.25 };
    oscillator.type = drum ? 'sine' : kind === 'miss' ? 'triangle' : 'sine';
    oscillator.frequency.setValueAtTime(drum ? 165 : frequencies[kind] || 330, now);
    oscillator.frequency.exponentialRampToValueAtTime(drum ? 42 : (frequencies[kind] || 330) * (kind === 'jump' ? 1.8 : .85), now + .2);
    envelope.gain.setValueAtTime(.001, now); envelope.gain.exponentialRampToValueAtTime(drum ? .8 : .18, now + .008); envelope.gain.exponentialRampToValueAtTime(.001, now + (drum ? .32 : .28));
    oscillator.start(now); oscillator.stop(now + .38);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
    if (drum) {
      const buffer = context.createBuffer(1, Math.round(context.sampleRate * .08), context.sampleRate);
      const samples = buffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = (Math.random() * 2 - 1) * (1 - i / samples.length) ** 2;
      const noise = context.createBufferSource(), filter = context.createBiquadFilter(), gain = context.createGain();
      filter.type = 'lowpass'; filter.frequency.value = 1200; gain.gain.value = .22;
      noise.buffer = buffer; noise.connect(filter); filter.connect(gain); gain.connect(master); noise.start();
      noise.onended = () => { noise.disconnect(); filter.disconnect(); gain.disconnect(); };
    }
  }
  arcade.audio = { enable: enableSound, sound };
}());
