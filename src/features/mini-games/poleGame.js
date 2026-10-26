// Ported from the retained source/design/lion-mini-games/poles.js.
const GOLD = '#f3cf82', PAPER = '#fff0cd', MUTED = '#d4bda8';
const POLES = [
  { x: 290, y: 504 }, { x: 590, y: 461 }, { x: 910, y: 505 },
  { x: 1210, y: 431 }, { x: 1540, y: 481 }, { x: 1860, y: 443 },
];
const CENTERS = [0.56, 0.64, 0.49, 0.61, 0.54];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = value => value * value * (3 - 2 * value);

export function createPoleGame({ onComplete = () => {}, onHUD = () => {}, sound = () => {}, art } = {}) {
  const reducedMotion = Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
  const held = new Set();
  let phase = 'ready', time = 0, stageTime = 0, charge = 0.03, direction = 1;
  let landed = 0, perfect = 0, misses = 0, combo = 0, bestCombo = 0, points = 0;
  let camera = POLES[0].x - 395, flight = null, flash = 0, feedback = '', feedbackTimer = 0;
  let done = false, destroyed = false, lastHUD = '';

  function play(kind) {
    try {
      const pending = sound(kind);
      if (pending && typeof pending.catch === 'function') pending.catch(() => {});
    } catch { /* Visual feedback remains playable if audio is unavailable. */ }
  }

  function targetBand() {
    const center = CENTERS[Math.min(landed, 4)];
    return { center, min: center - 0.105, max: center + 0.105 };
  }

  function report() {
    if (destroyed) return;
    const remaining = Math.max(0, Math.ceil(45 - time));
    const data = {
      phase,
      progress: landed / 5,
      primary: `本局落点 ${landed} / 5`,
      secondary: `余 ${remaining} 秒 · ${perfect} 次轻盈落点`,
      combo,
      hint: phase === 'charging' ? '看准金色段 · 松开空格 / 鼠标起跳'
        : phase === 'flight' ? '狮跃长空，目随下一桩'
          : phase === 'recovering' ? '回到上一桩，再试一次'
            : phase === 'landing' ? '稳住身形 · 准备下一跃'
              : '按住空格 / 鼠标蓄力，金色段松手 · ← → 可微调速度',
    };
    const signature = JSON.stringify(data);
    if (signature !== lastHUD) { lastHUD = signature; onHUD(data); }
  }

  function complete() {
    if (done || destroyed) return;
    done = true;
    phase = 'complete';
    held.clear();
    const continuity = Math.round(points / 5);
    report();
    play('win');
    onComplete({
      title: landed === 5 ? '五桩踏稳，一跃生风' : '狮步初成，下回更稳',
      rank: landed === 5 && perfect >= 4 ? '落点如风' : landed >= 3 ? '狮步渐稳' : '初试高桩',
      score: `${continuity}%`,
      subtitle: landed === 5 ? '五个落点已完成，阿南向你抖了抖狮被。' : '本轮 45 秒已到，带着这次的手感再来一跃。',
      stats: [
        { label: '本局落点', value: `${landed} / 5` },
        { label: '轻盈落点', value: `${perfect} 次` },
        { label: '连贯度', value: `${continuity}%` },
        { label: '最长连续落点', value: `${bestCombo} 桩` },
        { label: '重新站稳', value: `${misses} 次` },
      ],
    });
  }

  function begin() {
    if (done || destroyed || phase !== 'ready') return;
    phase = 'charging';
    charge = 0.03;
    direction = 1;
    stageTime = 0;
    play('drum');
    report();
  }

  function release() {
    if (done || destroyed || phase !== 'charging') return;
    const start = POLES[landed], target = POLES[landed + 1];
    const error = charge - targetBand().center;
    const safe = Math.abs(error) <= 0.18;
    const clean = Math.abs(error) <= 0.105;
    flight = {
      start, target, safe, clean, error,
      x: target.x + (safe ? error / 0.18 * 36 : Math.sign(error) * (112 + Math.abs(error) * 70)),
      duration: 0.92 + (target.x - start.x) / 1800,
    };
    phase = 'flight';
    stageTime = 0;
    play('jump');
    report();
  }

  function settle() {
    stageTime = 0;
    if (flight.safe) {
      landed++;
      combo++;
      bestCombo = Math.max(bestCombo, combo);
      if (flight.clean) perfect++;
      points += flight.clean ? 100 : 70;
      phase = 'landing';
      flash = 1;
      feedback = flight.clean ? '轻盈落点' : '稳住了，再来一跃';
      feedbackTimer = 1.4;
      play('land');
      play(flight.clean ? 'good' : 'drum');
    } else {
      misses++;
      combo = 0;
      phase = 'recovering';
      feedback = '没关系，回桩再来';
      feedbackTimer = 1.8;
      play('miss');
    }
    report();
  }

  function cancelInput() {
    held.clear();
    if (phase === 'charging') {
      phase = 'ready';
      charge = 0.03;
      stageTime = 0;
      report();
    }
  }

  function update(dt) {
    if (destroyed || done || !Number.isFinite(dt) || dt <= 0) return;
    dt = Math.min(dt, 0.1);
    time += dt;
    stageTime += dt;
    flash = Math.max(0, flash - dt * 2.4);
    feedbackTimer = Math.max(0, feedbackTimer - dt);
    if (time >= 45) { complete(); return; }
    if (phase === 'charging') {
      const fine = (held.has('ArrowRight') ? 0.1 : 0) - (held.has('ArrowLeft') ? 0.1 : 0);
      charge += dt * (0.48 + fine) * direction;
      if (charge > 0.98) { charge = 1.96 - charge; direction = -1; }
      if (charge < 0.02) { charge = 0.04 - charge; direction = 1; }
    } else if (phase === 'flight' && stageTime >= flight.duration) {
      settle();
    } else if (phase === 'landing' && stageTime >= 0.48) {
      if (landed === 5) { complete(); return; }
      phase = 'ready';
      stageTime = 0;
    } else if (phase === 'recovering' && stageTime >= 0.78) {
      phase = 'ready';
      stageTime = 0;
    }
    let focus = POLES[landed].x;
    if (phase === 'flight') focus = lerp(flight.start.x, flight.target.x, ease(clamp(stageTime / flight.duration, 0, 1)));
    camera = lerp(camera, focus - 395, 1 - Math.exp(-dt * (reducedMotion ? 14 : 3.3)));
    report();
  }

  function pole(ctx, position, index) {
    const x = position.x - camera, y = position.y;
    if (x < -130 || x > 1530) return;
    const target = index === landed + 1 && landed < 5;
    const visited = index <= landed;
    ctx.save();
    ctx.globalAlpha = visited || target ? 1 : 0.42;
    ctx.fillStyle = '#15080b66';
    ctx.beginPath(); ctx.ellipse(x + 20, 608, 92, 18, 0, 0, Math.PI * 2); ctx.fill();
    const side = ctx.createLinearGradient(x - 28, 0, x + 30, 0);
    side.addColorStop(0, '#5b1720'); side.addColorStop(0.42, '#b33736'); side.addColorStop(0.75, '#91282d'); side.addColorStop(1, '#41141d');
    art.roundRect(ctx, x - 27, y + 4, 54, 600 - y, 7, side, '#d7955566');
    ctx.fillStyle = '#e4b16b99'; ctx.fillRect(x - 20, y + 25, 3, 572 - y);
    for (const bandY of [y + 26, 567]) {
      art.roundRect(ctx, x - 31, bandY, 62, 12, 3, '#c1874b', '#f4cb83');
      ctx.fillStyle = '#f3ca8866'; ctx.fillRect(x - 27, bandY + 2, 53, 2);
    }
    ctx.save();
    ctx.translate(x, (y + 580) / 2); ctx.rotate(Math.PI / 4);
    art.roundRect(ctx, -10, -10, 20, 20, 2, '#c99153', '#f0c580');
    ctx.restore();
    ctx.fillStyle = '#4c1720'; ctx.beginPath(); ctx.ellipse(x, y + 9, 68, 19, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = target ? '#d49a4c' : '#b06b3e'; ctx.beginPath(); ctx.ellipse(x, y, 68, 18, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = target ? '#6e2927' : '#57212a'; ctx.beginPath(); ctx.ellipse(x, y - 2, 59, 13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = target ? '#ffdda1' : '#dfae70'; ctx.lineWidth = target ? 3 : 2;
    ctx.beginPath(); ctx.ellipse(x, y - 2, 66, 17, 0, 0, Math.PI * 2); ctx.stroke();
    if (target) {
      const pulse = reducedMotion ? 0.5 : (Math.sin(time * 3) + 1) / 2;
      ctx.strokeStyle = `rgba(243,207,130,${0.24 + pulse * 0.24})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x, y - 2, 79 + pulse * 6, 24 + pulse * 2, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([3, 8]); ctx.strokeStyle = '#edc47966';
      ctx.beginPath(); ctx.moveTo(x, y - 115); ctx.lineTo(x, y - 44); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = GOLD; ctx.beginPath(); ctx.moveTo(x - 7, y - 49); ctx.lineTo(x + 7, y - 49); ctx.lineTo(x, y - 38); ctx.fill();
      art.text(ctx, '下一落点', x, y - 132, 20, GOLD, 'center');
    }
    art.text(ctx, index === 0 ? '起' : `0${index}`, x, 632, 17, target ? GOLD : '#b98b70', 'center');
    ctx.restore();
  }

  function drawGauge(ctx) {
    const band = targetBand(), x = 456, y = 674, width = 516;
    art.roundRect(ctx, 378, 642, 668, 92, 19, '#250e15e8', '#bc88574d');
    if (phase === 'charging') {
      art.text(ctx, '蓄力中 · 看到金色就松手', 712, 664, 20, PAPER, 'center');
    } else {
      art.text(ctx, '按住蓄力', 540, 664, 19, PAPER, 'center');
      art.text(ctx, '金色段松手起跳', 851, 664, 19, GOLD, 'center');
    }
    art.roundRect(ctx, x, y, width, 19, 9, '#542733', '#885044');
    art.roundRect(ctx, x + (band.min - 0.075) * width, y + 2, (0.36) * width, 15, 7, '#9e7449');
    art.roundRect(ctx, x + band.min * width, y, (band.max - band.min) * width, 19, 5, GOLD);
    ctx.fillStyle = '#ffedb9'; ctx.fillRect(x + band.center * width - 1, y + 2, 2, 15);
    if (phase === 'charging') {
      ctx.save();
      const needle = x + charge * width;
      ctx.shadowColor = '#fff0bf'; ctx.shadowBlur = reducedMotion ? 0 : 10;
      art.roundRect(ctx, needle - 3, y - 6, 6, 31, 3, '#fff8e7');
      ctx.fillStyle = '#fff8e7'; ctx.beginPath(); ctx.moveTo(needle - 6, y - 11); ctx.lineTo(needle + 6, y - 11); ctx.lineTo(needle, y - 4); ctx.fill();
      ctx.restore();
    }
    art.text(ctx, '轻', x - 22, y + 15, 17, MUTED, 'center');
    art.text(ctx, '重', x + width + 24, y + 15, 17, MUTED, 'center');
    art.text(ctx, '空格 / 鼠标长按后松开   ·   ← → 细调', 712, 719, 15, '#c9a78b', 'center');
  }

  function draw(ctx, width, height) {
    if (destroyed) return;
    ctx.save();
    ctx.scale(width / 1400, height / 760);
    art.backdrop(ctx, 1400, 760, { mode: 'poles', time: reducedMotion ? 0 : time, progress: landed / 5 });
    art.text(ctx, '五点成线 · 一跃生风', 83, 88, 27, GOLD, 'left');
    art.text(ctx, '看下一根发光桩，跟着手感稳稳落下', 85, 123, 18, MUTED, 'left');
    art.text(ctx, `${Math.max(0, Math.ceil(45 - time))}`, 1298, 91, 34, PAPER, 'right');
    art.text(ctx, '秒', 1323, 91, 17, MUTED, 'right');
    for (let index = 0; index < 5; index++) {
      const x = 1153 + index * 31;
      ctx.beginPath(); ctx.arc(x, 119, 6, 0, Math.PI * 2);
      ctx.fillStyle = index < landed ? GOLD : '#713b36'; ctx.fill();
    }
    const floor = ctx.createLinearGradient(0, 540, 0, 650);
    floor.addColorStop(0, '#441c2400'); floor.addColorStop(1, '#1c0b16cf');
    ctx.fillStyle = floor; ctx.fillRect(0, 540, 1400, 100);
    for (let index = POLES.length - 1; index >= 0; index--) pole(ctx, POLES[index], index);

    const current = POLES[landed];
    let x = current.x, y = current.y - 9, pose = 'idle', tilt = 0, stretchX = 1, stretchY = 1, alpha = 1;
    if (phase === 'charging') {
      pose = 'crouch'; stretchX = 1.025; stretchY = 0.97;
      y += 3 + charge * 7;
    } else if (phase === 'flight') {
      const p = clamp(stageTime / flight.duration, 0, 1);
      x = lerp(flight.start.x, flight.x, ease(p));
      y = lerp(flight.start.y, flight.target.y, p) - Math.sin(Math.PI * p) * (reducedMotion ? 145 : 198) - 9;
      if (!flight.safe && p > 0.74) y += Math.pow((p - 0.74) / 0.26, 2) * 300;
      pose = 'jump'; tilt = reducedMotion ? 0 : Math.sin(p * Math.PI * 2) * 0.055;
      stretchX = 1.025; stretchY = 1.035;
      ctx.save();
      ctx.globalAlpha = 0.24 * (1 - Math.sin(p * Math.PI) * 0.4);
      ctx.fillStyle = '#160909'; ctx.beginPath(); ctx.ellipse(x - camera, lerp(flight.start.y, flight.target.y, p) - 2, 51 - Math.sin(p * Math.PI) * 17, 10, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    } else if (phase === 'landing') {
      const bounce = Math.exp(-stageTime * 8) * Math.sin(stageTime * 21);
      pose = 'land'; stretchX = 1 + bounce * 0.07; stretchY = 1 - bounce * 0.08;
      tilt = flight.clean || reducedMotion ? 0 : Math.sin(stageTime * 26) * Math.exp(-stageTime * 5) * 0.13;
    } else if (phase === 'recovering') {
      pose = 'land'; alpha = clamp(stageTime / 0.35, 0, 1);
    } else if (!reducedMotion) {
      stretchY = 1 + Math.sin(time * 2) * 0.007;
    }
    if (phase !== 'flight') {
      ctx.save(); ctx.globalAlpha = 0.36;
      ctx.fillStyle = '#17080c'; ctx.beginPath(); ctx.ellipse(x - camera, current.y - 1, 53, 10, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    if (flash > 0 && !reducedMotion) {
      ctx.save(); ctx.strokeStyle = `rgba(246,210,136,${flash * 0.65})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(current.x - camera, current.y - 4, 67 + (1 - flash) * 55, 16 + (1 - flash) * 11, 0, 0, Math.PI * 2); ctx.stroke();
      for (let spark = 0; spark < 7; spark++) {
        const angle = spark / 7 * Math.PI + Math.PI;
        const length = 14 + (1 - flash) * 42;
        ctx.fillStyle = `rgba(246,210,136,${flash * 0.7})`;
        ctx.beginPath(); ctx.arc(current.x - camera + Math.cos(angle) * length, current.y - 8 + Math.sin(angle) * length * 0.6, 2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    art.lion(ctx, x - camera, y, 254, { pose, tilt, stretchX, stretchY, alpha });
    if (feedbackTimer > 0) {
      ctx.save(); ctx.globalAlpha = Math.min(1, feedbackTimer * 2);
      art.text(ctx, feedback, 700, 213, 34, phase === 'recovering' ? PAPER : GOLD, 'center');
      ctx.restore();
    }
    drawGauge(ctx);
    ctx.restore();
  }

  report();
  return {
    update, draw, cancelInput,
    keydown(code) {
      if (destroyed || done || held.has(code)) return;
      held.add(code);
      if (code === 'Space') begin();
    },
    keyup(code) {
      if (!code) { cancelInput(); return; }
      const active = held.delete(code);
      if (code === 'Space' && active) release();
    },
    pointerdown() {
      if (destroyed || done || held.has('pointer')) return;
      held.add('pointer'); begin();
    },
    pointerup(point) {
      if (!point) { cancelInput(); return; }
      const active = held.delete('pointer');
      if (active) release();
    },
    destroy() { destroyed = true; held.clear(); flight = null; },
    get debug() {
      return Object.freeze({ phase, time, charge, landed, perfect, misses, combo, points, targetBand: Object.freeze(targetBand()) });
    },
  };
}
