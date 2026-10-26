// Ported from the retained source/design/lion-mini-games/rhythm.js.
const GOLD = '#efc779';
const PAPER = '#fff0cf';
const RED = '#9d2f27';
const FIRST_BEAT = 4;
const BEAT_GAP = 1.15;
const BEAT_COUNT = 18;
const DURATION = 25;
const HIT_WINDOW = 0.24;
const PERFECT_WINDOW = 0.11;
const APPROACH = 1.05;
const DRUM_X = 382;
const DRUM_Y = 388;
const TARGET_RADIUS = 174;

export function createRhythmGame({ onComplete = () => {}, onHUD = () => {}, sound = () => {}, art } = {}) {
  const reducedMotion = Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
  const beats = Array.from({ length: BEAT_COUNT }, (_, index) => ({
    time: FIRST_BEAT + index * BEAT_GAP, result: null,
  }));
  let time = 0;
  let destroyed = false;
  let complete = false;
  let keyHeld = false;
  let pointerHeld = false;
  let combo = 0;
  let bestCombo = 0;
  let hitCount = 0;
  let perfectCount = 0;
  let points = 0;
  let lastHit = -10;
  let lastStrike = -10;
  let qingAt = -1;
  let lastNotice = '';
  let noticeUntil = 0;
  let lastHUD = '';
  let demoPlayed = false;
  let particles = [];

  function play(kind) {
    // A blocked or unavailable audio context must never interrupt the game.
    try {
      const pending = sound(kind);
      if (pending && typeof pending.catch === 'function') pending.catch(() => {});
    } catch (_) { /* visual feedback remains available */ }
  }

  function publish() {
    const hud = {
      phase: complete ? '结束' : time < 3 ? '看一次示范' : '鼓点采青',
      progress: Math.min(time / DURATION, 1),
      primary: `命中 ${hitCount} / ${BEAT_COUNT}`,
      secondary: `剩余 ${Math.max(0, Math.ceil(DURATION - time))} 秒`,
      combo,
      hint: time < noticeUntil ? lastNotice
        : time < 3 ? '先看金圈合拢，正式鼓点马上开始' : '金圈合拢时，按空格或点击鼓面',
    };
    // HUD changes are quantized to avoid replacing DOM text every animation frame.
    const signature = [hud.phase, Math.floor(hud.progress * 100), hud.primary, hud.secondary, combo, hud.hint].join('|');
    if (signature !== lastHUD) {
      lastHUD = signature;
      onHUD(hud);
    }
  }

  function notice(text, seconds = 0.8) {
    lastNotice = text;
    noticeUntil = time + seconds;
  }

  function burst(x, y, count, bright) {
    if (reducedMotion) return;
    for (let index = 0; index < count; index++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 190;
      particles.push({
        x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 60,
        life: 0.6 + Math.random() * 0.35, age: 0,
        size: 2 + Math.random() * 4, spin: angle, bright,
      });
    }
  }

  function strike() {
    if (destroyed || complete) return;
    lastStrike = time;
    play('drum');
    if (time < 3) {
      notice('试敲成功 · 稍后跟着金圈敲', 0.9);
      burst(DRUM_X, DRUM_Y, 8, true);
      publish();
      return;
    }

    let candidate;
    let distance = Infinity;
    for (const beat of beats) {
      const delta = Math.abs(beat.time - time);
      if (!beat.result && delta < distance) { candidate = beat; distance = delta; }
    }

    if (candidate && distance <= HIT_WINDOW + 1e-7) {
      const perfect = distance <= PERFECT_WINDOW + 1e-7;
      candidate.result = perfect ? 'perfect' : 'good';
      hitCount++;
      if (perfect) perfectCount++;
      combo++;
      bestCombo = Math.max(combo, bestCombo);
      points += perfect ? 100 : 70;
      lastHit = time;
      notice(perfect ? '正合拍！' : time < candidate.time ? '接住了 · 再等一点更准' : '接住了 · 下次早一点', 0.8);
      if (hitCount === 12) {
        qingAt = time;
        notice('采青到手！鼓点继续', 1.1);
      }
      burst(DRUM_X, DRUM_Y, perfect ? 22 : 14, true);
      burst(1020, 390, perfect ? 12 : 7, true);
      play('good');
    } else {
      combo = 0;
      const justPassed = beats.some((beat) => time > beat.time + HIT_WINDOW && time - beat.time < 0.66);
      notice(justPassed ? '晚了一点 · 跟住下一圈'
        : candidate && time < candidate.time && candidate.time - time <= APPROACH ? '早了一点 · 等金圈合拢'
          : '空拍 · 等下一圈出现再敲', 0.9);
      play('miss');
    }
    publish();
  }

  function finish() {
    if (complete || destroyed) return;
    complete = true;
    keyHeld = false;
    pointerHeld = false;
    play('win');
    publish();
    onComplete({
      title: hitCount >= 12 ? '一鼓生风，采青归来' : hitCount ? '鼓声已起，再来一局' : '第一声鼓，等你敲响',
      rank: hitCount >= 16 ? '采青高手' : hitCount >= 12 ? '鼓韵正盛' : hitCount >= 6 ? '渐入佳境' : '初试鼓点',
      score: Math.round(points / (BEAT_COUNT * 100) * 1000),
      subtitle: hitCount >= 12 ? '阿南跟上了你的鼓点，舞台也被点亮。'
        : '盯住收拢的金圈，一圈敲一下，就能找到节奏。',
      stats: [
        { label: '命中', value: `${hitCount} / ${BEAT_COUNT}` },
        { label: '正合拍', value: `${perfectCount} 次` },
        { label: '最高连击', value: `${bestCombo} 连` },
      ],
    });
  }

  function update(dt) {
    if (destroyed || complete || !Number.isFinite(dt) || dt <= 0) return;
    time = Math.min(DURATION, time + dt);
    if (!demoPlayed && time >= 2.1) {
      demoPlayed = true;
      play('drum');
    }
    for (const beat of beats) {
      if (!beat.result && time > beat.time + HIT_WINDOW + 1e-7) {
        beat.result = 'miss';
        combo = 0;
        notice('漏了一拍 · 下一圈继续', 0.68);
      }
    }
    for (const particle of particles) {
      particle.age += dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += dt * 240;
      particle.spin += dt * 2;
    }
    particles = particles.filter((particle) => particle.age < particle.life);
    if (time >= DURATION) finish();
    else publish();
  }

  function circle(ctx, x, y, radius, fill, stroke, width = 1) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
  }

  function drawDrum(ctx) {
    const strikeAge = time - lastStrike;
    const impact = strikeAge < 0.22 ? Math.sin(strikeAge / 0.22 * Math.PI) : 0;
    ctx.save();
    ctx.translate(DRUM_X, DRUM_Y + impact * 4);

    const shadow = ctx.createRadialGradient(0, 231, 10, 0, 231, 206);
    shadow.addColorStop(0, 'rgba(8,0,0,.48)');
    shadow.addColorStop(1, 'rgba(8,0,0,0)');
    ctx.fillStyle = shadow;
    ctx.beginPath(); ctx.ellipse(0, 231, 208, 29, 0, 0, Math.PI * 2); ctx.fill();
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#321713'; ctx.lineWidth = 25;
    for (const direction of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(direction * 80, 125); ctx.lineTo(direction * 112, 225); ctx.stroke();
    }
    ctx.strokeStyle = '#b67b3e'; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.moveTo(-109, 221); ctx.lineTo(80, 139); ctx.moveTo(109, 221); ctx.lineTo(-80, 139); ctx.stroke();

    const wood = ctx.createLinearGradient(-154, 0, 154, 0);
    wood.addColorStop(0, '#671d1e'); wood.addColorStop(0.38, '#be4a35'); wood.addColorStop(0.65, '#a1322b'); wood.addColorStop(1, '#57171b');
    ctx.fillStyle = wood;
    ctx.beginPath();
    ctx.moveTo(-151, 19); ctx.lineTo(-130, 161);
    ctx.bezierCurveTo(-97, 193, 95, 193, 130, 161);
    ctx.lineTo(151, 19); ctx.closePath(); ctx.fill();
    for (let index = -3; index <= 3; index++) {
      ctx.strokeStyle = index % 2 ? 'rgba(255,196,122,.12)' : 'rgba(37,0,4,.17)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(index * 36, 112); ctx.lineTo(index * 31, 171); ctx.stroke();
    }
    ctx.strokeStyle = '#cb9752'; ctx.lineWidth = 9;
    ctx.beginPath(); ctx.ellipse(0, 158, 131, 28, 0, 0.1, Math.PI - 0.1); ctx.stroke();
    circle(ctx, 0, 0, 155, '#3c1b1a', '#e0a756', 5);
    circle(ctx, 0, 0, 148, '#c99754', '#6e3928', 2);
    const skin = ctx.createRadialGradient(-46, -64, 10, 0, 0, 141);
    skin.addColorStop(0, '#fff4d3'); skin.addColorStop(0.68, '#efd6a4'); skin.addColorStop(1, '#c6985e');
    circle(ctx, 0, 0, 137, skin, '#fff0bd', 2);
    circle(ctx, 0, 0, 123, null, 'rgba(146,70,40,.25)', 1);
    circle(ctx, 0, 0, 111, null, 'rgba(146,70,40,.12)', 2);
    for (let index = 0; index < 24; index++) {
      const angle = index / 24 * Math.PI * 2;
      circle(ctx, Math.cos(angle) * 146, Math.sin(angle) * 146, 3.3, '#f8dda0', '#885431', 1);
    }

    // Restrained hand-painted curls give the skin a drum identity without a UI target grid.
    ctx.strokeStyle = 'rgba(163,67,39,.25)'; ctx.lineWidth = 3;
    for (const direction of [-1, 1]) {
      ctx.save(); ctx.scale(direction, 1);
      ctx.beginPath(); ctx.moveTo(65, -50); ctx.bezierCurveTo(106, -68, 117, -9, 89, -10);
      ctx.bezierCurveTo(70, -9, 78, -33, 91, -24); ctx.stroke(); ctx.restore();
    }
    const call = time < 3 ? '鼓' : time - lastHit < 0.55 ? '好！'
      : beats.some((beat) => !beat.result && Math.abs(beat.time - time) < HIT_WINDOW) ? '敲！' : '鼓';
    art.text(ctx, call, 0, -12, 72, RED, 'center');
    art.text(ctx, time < 3 ? '先试着敲一下' : '空格 / 鼠标点击', 0, 55, 19, '#9f5435', 'center');

    if (impact > 0) circle(ctx, 0, 0, 136, `rgba(255,251,211,${impact * 0.28})`);
    ctx.restore();

    // The fixed gold circle is the target; the lighter outer circle converges toward it.
    circle(ctx, DRUM_X, DRUM_Y, TARGET_RADIUS, null, 'rgba(244,195,104,.72)', 3);
    circle(ctx, DRUM_X, DRUM_Y, TARGET_RADIUS + 5, null, 'rgba(244,195,104,.15)', 1);
    for (let index = 0; index < 4; index++) {
      const angle = index * Math.PI / 2;
      const x = DRUM_X + Math.cos(angle) * TARGET_RADIUS;
      const y = DRUM_Y + Math.sin(angle) * TARGET_RADIUS;
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4);
      ctx.fillStyle = GOLD; ctx.fillRect(-3, -3, 6, 6); ctx.restore();
    }

    let target = beats.find((beat) => !beat.result && beat.time >= time - HIT_WINDOW);
    if (time < 2.36) target = { time: 2.1 };
    if (target) {
      const until = target.time - time;
      if (until <= APPROACH && until >= -HIT_WINDOW) {
        const radius = TARGET_RADIUS + Math.max(0, until) / APPROACH * 85;
        const near = Math.abs(until) < HIT_WINDOW;
        ctx.save();
        ctx.shadowColor = '#ffda8b'; ctx.shadowBlur = near ? 18 : 9;
        circle(ctx, DRUM_X, DRUM_Y, radius, null, near ? '#fff4bb' : '#ecc279', near ? 7 : 4);
        ctx.restore();
        if (near) circle(ctx, DRUM_X, DRUM_Y, 163, null, 'rgba(255,237,162,.4)', 2);
      }
    }

    if (time < 3 && time >= 2.1) {
      const age = time - 2.1;
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - age / 0.75);
      circle(ctx, DRUM_X, DRUM_Y, TARGET_RADIUS + age * 62, null, GOLD, 4);
      ctx.restore();
    }
  }

  function drawQing(ctx) {
    const age = qingAt < 0 ? -1 : time - qingAt;
    if (age >= 0.72 || reducedMotion && age >= 0) return;
    const sway = reducedMotion ? 0 : Math.sin(time * 1.9) * 0.045;
    ctx.save();
    if (age < 0) {
      ctx.translate(1240, 82); ctx.rotate(sway);
      ctx.strokeStyle = 'rgba(231,186,99,.65)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 122); ctx.stroke();
      ctx.translate(0, 132);
    } else {
      const progress = age / 0.72;
      const ease = progress * progress * (3 - 2 * progress);
      const x = 1240 - 105 * ease;
      const y = 214 + 186 * ease - Math.sin(progress * Math.PI) * 25;
      ctx.globalAlpha = 1 - Math.max(0, progress - 0.7) / 0.3;
      ctx.strokeStyle = 'rgba(242,203,128,.48)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(1240, 214); ctx.quadraticCurveTo(1230, y - 35, x, y); ctx.stroke();
      ctx.translate(x, y); ctx.rotate(-progress * 0.3);
      ctx.scale(1 - progress * 0.45, 1 - progress * 0.45);
    }
    for (let index = -2; index <= 2; index++) {
      ctx.save(); ctx.rotate(index * 0.43);
      const leaf = ctx.createLinearGradient(0, -40, 0, 9);
      leaf.addColorStop(0, '#bdd586'); leaf.addColorStop(1, '#4b714b');
      ctx.fillStyle = leaf; ctx.strokeStyle = '#d7d592'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(0, 10);
      ctx.bezierCurveTo(-33, -6, -25, -44, 0, -43);
      ctx.bezierCurveTo(25, -44, 33, -6, 0, 10); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(241,232,170,.45)'; ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(0, -33); ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = '#d04c32';
    ctx.beginPath(); ctx.moveTo(-8, 7); ctx.lineTo(10, 7); ctx.lineTo(19, 59); ctx.lineTo(3, 49); ctx.lineTo(-7, 61); ctx.closePath(); ctx.fill();
    circle(ctx, 0, 9, 8, '#f1cb80', '#ae6d37', 2);
    ctx.restore();
  }

  function drawTimeline(ctx) {
    const start = 346;
    const step = 42;
    const y = 687;
    ctx.strokeStyle = 'rgba(224,174,95,.18)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(start, y); ctx.lineTo(start + (BEAT_COUNT - 1) * step, y); ctx.stroke();
    beats.forEach((beat, index) => {
      const active = !beat.result && beat.time - time < APPROACH && beat.time - time > -HIT_WINDOW;
      const fill = beat.result === 'perfect' ? '#ffdfa0' : beat.result === 'good' ? '#d8a65d'
        : beat.result === 'miss' ? '#785349' : active ? '#ffe7a3' : '#63352e';
      circle(ctx, start + index * step, y, active ? 7 : 5, fill, active ? '#fff4c6' : null, 2);
      if (beat.result === 'perfect') circle(ctx, start + index * step, y, 9, null, 'rgba(240,196,111,.24)', 1);
    });
    art.text(ctx, time < 3 ? '看圈 · 等合拢 · 敲一下' : `十八声鼓 · ${hitCount >= 12 ? '采青到手' : hitCount >= 6 ? '渐入佳境' : '慢慢找到节奏'}`,
      700, 730, 19, '#dfbd8b', 'center');
  }

  function draw(ctx, w, h) {
    if (destroyed) return;
    ctx.save();
    ctx.scale(w / 1400, h / 760);
    art.backdrop(ctx, 1400, 760, { mode: 'rhythm', time, progress: hitCount / BEAT_COUNT });

    // A warm pool of light belongs to the character, and grows with successful beats.
    const glow = ctx.createRadialGradient(1025, 486, 30, 1025, 486, 290);
    glow.addColorStop(0, `rgba(236,173,72,${0.08 + hitCount / BEAT_COUNT * 0.12})`);
    glow.addColorStop(1, 'rgba(236,173,72,0)');
    ctx.fillStyle = glow; ctx.fillRect(725, 180, 610, 480);

    if (qingAt < 0) drawQing(ctx);
    const hitAge = time - lastHit;
    const bounce = hitAge < 0.6 ? Math.sin(hitAge / 0.6 * Math.PI) * (combo >= 4 ? 49 : 34) : 0;
    const demoBounce = time >= 2.1 && time < 2.7 ? Math.sin((time - 2.1) / 0.6 * Math.PI) * 28 : 0;
    const pose = hitAge < 0.34 || demoBounce > 10 ? 'jump' : hitAge < 0.63 ? 'land' : 'idle';
    art.lion(ctx, 1030, 620 - bounce - demoBounce, 460, {
      pose, flip: false,
      tilt: reducedMotion ? 0 : hitAge < 0.6 ? Math.sin(hitAge * 8) * 0.055 : Math.sin(time * 1.7) * 0.015,
      stretchX: hitAge >= 0.38 && hitAge < 0.63 ? 1.04 : 1,
      stretchY: hitAge >= 0.38 && hitAge < 0.63 ? 0.96 : 1,
      alpha: 1,
    });
    if (qingAt >= 0) drawQing(ctx);
    drawDrum(ctx);

    art.text(ctx, time < 3 ? '先看金圈合拢' : time < FIRST_BEAT - APPROACH ? '准备，鼓点来了' : '金圈合拢时，敲一下',
      382, 101, 29, PAPER, 'center');
    art.text(ctx, time < 3 ? '阿南先示范一次，试敲不计分' : '一次按下敲一声 · 松开后再敲', 382, 650, 17, '#d2aa7d', 'center');

    const feedbackVisible = time < noticeUntil && time >= 3;
    if (feedbackVisible) {
      const good = time - lastHit < 0.81;
      art.text(ctx, lastNotice, 1010, 140, good ? 32 : 25, good ? '#ffe2a2' : '#e6ba97', 'center');
      if (combo >= 2) art.text(ctx, `${combo} 连击`, 1010, 179, 21, GOLD, 'center');
    } else {
      art.text(ctx, hitCount >= 12 ? '采青到手，鼓舞不停' : '你敲鼓，阿南来起舞', 1010, 140, 26, PAPER, 'center');
    }

    for (const particle of particles) {
      ctx.save();
      ctx.globalAlpha = (1 - particle.age / particle.life) * 0.9;
      ctx.translate(particle.x, particle.y); ctx.rotate(particle.spin);
      ctx.fillStyle = particle.bright ? '#ffdf92' : '#d68f55';
      ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size * 0.6);
      ctx.restore();
    }
    drawTimeline(ctx);
    ctx.restore();
  }

  publish();
  return {
    update, draw,
    cancelInput() { keyHeld = false; pointerHeld = false; },
    keydown(code) {
      if (destroyed || complete || code !== 'Space' || keyHeld) return;
      const alreadyHeld = pointerHeld;
      keyHeld = true;
      if (!alreadyHeld) strike();
    },
    keyup(code) { if (!code || code === 'Space') keyHeld = false; },
    pointerdown() {
      if (destroyed || complete || pointerHeld) return;
      const alreadyHeld = keyHeld;
      pointerHeld = true;
      if (!alreadyHeld) strike();
    },
    pointerup() { pointerHeld = false; },
    destroy() {
      destroyed = true;
      keyHeld = false;
      pointerHeld = false;
      particles = [];
    },
  };
}
