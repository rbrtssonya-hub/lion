// Run with: node source/design/lion-mini-games/rhythm-check.cjs
// Removing hit timing, input latching, or the settlement guard must fail this check.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const filename = path.join(__dirname, 'rhythm.js');
const window = {};
if (fs.existsSync(filename)) vm.runInNewContext(fs.readFileSync(filename, 'utf8'), { window, Math });
assert.equal(typeof window.LionArcade?.games?.rhythm?.create, 'function', 'rhythm must register its playable factory');

function session(sound = () => {}) {
  const reports = [];
  let hud;
  let time = 0;
  const game = window.LionArcade.games.rhythm.create({
    onComplete: (report) => reports.push(report),
    onHUD: (value) => { hud = value; },
    sound,
    art: {},
  });
  return {
    game, reports,
    get hud() { return hud; },
    to(target) {
      while (time < target - 1e-9) {
        const dt = Math.min(1 / 120, target - time);
        game.update(dt);
        time += dt;
      }
    },
    hit() { game.keydown('Space'); game.keyup('Space'); },
  };
}

// Accurate keyboard and pointer taps both score; release is required between taps.
const accurate = session();
accurate.to(4);
accurate.hit();
assert.equal(accurate.hud.combo, 1, 'a tap at the converged circle must score');
accurate.to(5.15);
accurate.game.pointerdown({ x: 382, y: 388 });
accurate.game.pointerup({ x: 382, y: 388 });
assert.equal(accurate.hud.combo, 2, 'pointer and keyboard must share the scoring rule');
accurate.to(26);
assert.equal(accurate.reports.length, 1);
assert.equal(accurate.reports[0].stats.find((stat) => stat.label === '命中').value, '2 / 18');
assert.ok(accurate.reports[0].score > 0);
accurate.game.keydown('Space');
accurate.to(30);
assert.equal(accurate.reports.length, 1, 'settlement must only fire once');

// Holding Space and sending browser repeat events cannot earn more hits.
const held = session();
held.to(4);
held.game.keydown('Space');
held.to(5.15);
held.game.keydown('Space');
held.game.keydown('Space');
assert.equal(held.hud.combo, 1, 'repeat keydown must not score a second beat');
held.to(5.5);
assert.equal(held.hud.combo, 0, 'an unplayed second beat must break the combo');
held.to(26);
assert.equal(held.reports[0].stats.find((stat) => stat.label === '命中').value, '1 / 18');

// Early taps do not consume the upcoming beat; missed beats and zero-input runs finish.
const early = session();
early.to(3.4);
early.hit();
assert.equal(early.hud.combo, 0);
early.to(4);
early.hit();
assert.equal(early.hud.combo, 1, 'an early tap must allow a later correctly timed tap');
early.to(5.5);
assert.equal(early.hud.combo, 0, 'missing a beat must reset the combo');
const empty = session(() => { throw new Error('audio unavailable'); });
empty.to(26);
assert.equal(empty.reports.length, 1, 'zero hits must still reach a replayable result');
assert.equal(empty.reports[0].score, 0);
assert.equal(empty.reports[0].stats.find((stat) => stat.label === '命中').value, '0 / 18');

// Destroyed games stop callbacks; a new factory instance starts cleanly for replay.
const stopped = session();
stopped.game.destroy();
stopped.to(26);
assert.equal(stopped.reports.length, 0);
const replay = session();
replay.to(4);
replay.hit();
assert.equal(replay.hud.combo, 1);

const full = session();
for (const target of [4, 5.15, 6.3, 7.45, 8.6, 9.75, 10.9, 12.05, 13.2, 14.35, 15.5, 16.65, 17.8, 18.95, 20.1, 21.25, 22.4, 23.55]) {
  full.to(target);
  full.hit();
  if (target === 15.5) assert.ok(!full.hud.hint.includes('采青'), 'the hanging greens must remain before twelve hits');
  if (target === 16.65) assert.ok(full.hud.hint.includes('采青到手'), 'the twelfth hit must visibly collect the greens');
}
full.to(26);
assert.equal(full.reports[0].score, 1000, 'eighteen precisely timed taps must achieve the maximum game score');
assert.equal(full.reports[0].stats.find((stat) => stat.label === '最高连击').value, '18 连');

// Exercise the real drawing path at demo, approaching, hit, missed, and end states.
// Pixel/layout quality is checked separately with the actual browser and shared artwork.
const gradient = { addColorStop() {} };
const ctx = new Proxy({
  createLinearGradient: () => gradient,
  createRadialGradient: () => gradient,
}, { get: (object, property) => object[property] || (() => {}) });
const drawing = window.LionArcade.games.rhythm.create({ art: {
  text() {}, lion() {}, backdrop() {}, roundRect() {},
} });
for (const dt of [0, 1.5, 0.6, 1.3, 0.6, 0.8, 21]) {
  drawing.update(dt);
  assert.doesNotThrow(() => drawing.draw(ctx, 1400, 760));
}
console.log('rhythm check: hits, held input, misses, audio fallback, replay, perfect round, drawing path, and one-time settlement passed');
