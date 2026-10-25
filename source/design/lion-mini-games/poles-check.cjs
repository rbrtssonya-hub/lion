/* Standalone logic check: node source/design/lion-mini-games/poles-check.cjs */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const context = { window: { matchMedia: () => ({ matches: false }) }, Math };
vm.runInNewContext(fs.existsSync(path.join(__dirname, 'poles.js'))
  ? fs.readFileSync(path.join(__dirname, 'poles.js'), 'utf8') : '', context);
assert.equal(typeof context.window.LionArcade?.games?.poles?.create, 'function', 'poles registers a playable factory');

function session() {
  const results = [], hud = [], sounds = [];
  const game = context.window.LionArcade.games.poles.create({
    onComplete: result => results.push(result), onHUD: data => hud.push(data),
    sound: kind => sounds.push(kind), art: {},
  });
  function advance(seconds) {
    for (let left = seconds; left > 0; left -= 1 / 120) game.update(Math.min(left, 1 / 120));
  }
  function releaseAt(value) {
    game.keydown('Space');
    for (let n = 0; n < 1200 && game.debug.charge < value; n++) game.update(1 / 240);
    game.keyup('Space');
    advance(1.9);
  }
  return { game, results, hud, sounds, advance, releaseAt };
}

{
  const { game, advance, releaseAt, sounds } = session();
  releaseAt(game.debug.targetBand.center);
  assert.equal(game.debug.landed, 1, 'a release in the gold band lands on the next pole');
  assert.equal(game.debug.perfect, 1);
  assert(sounds.includes('land'));
  const current = game.debug.landed;
  game.keydown('Space');
  advance(0.25);
  const before = game.debug.charge;
  for (let n = 0; n < 25; n++) game.keydown('Space');
  advance(0.1);
  assert(game.debug.charge > before, 'key repeat does not reset charge');
  game.cancelInput();
  game.keyup('Space');
  game.pointerup({ x: 600, y: 500 });
  advance(2);
  assert.equal(game.debug.landed, current, 'pause cleanup cancels charging instead of jumping');
  assert.equal(game.debug.phase, 'ready');
  game.destroy();
}
{
  const { game, releaseAt } = session();
  releaseAt(game.debug.targetBand.center + 0.13);
  assert.equal(game.debug.landed, 1, 'a slightly late release still lands');
  assert.equal(game.debug.perfect, 0, 'near misses have a visibly wobbling ordinary landing');
  game.destroy();
}
{
  const { game, releaseAt } = session();
  releaseAt(0.03);
  assert.equal(game.debug.misses, 1);
  assert.equal(game.debug.landed, 0, 'a missed jump returns to the saved pole');
  assert.equal(game.debug.phase, 'ready');
  releaseAt(game.debug.targetBand.center);
  assert.equal(game.debug.landed, 1, 'the player can continue after recovery');
  game.destroy();
}
{
  const { game, advance } = session();
  game.keydown('Space');
  advance(0.7);
  game.keyup('Space');
  game.keydown('Space'); // Input during flight must not become a queued jump.
  advance(2);
  const phase = game.debug.phase;
  const attempts = game.debug.landed + game.debug.misses;
  advance(3);
  assert.equal(game.debug.phase, phase, 'holding a key does not queue repeated jumps');
  assert.equal(game.debug.landed + game.debug.misses, attempts, 'no extra jump is hidden between ready frames');
  game.keyup('Space');
  game.destroy();
}
{
  const { game, advance } = session();
  game.pointerdown({ x: 650, y: 450 });
  for (let n = 0; n < 1200 && game.debug.charge < game.debug.targetBand.center; n++) game.update(1 / 240);
  game.pointerup({ x: 650, y: 450 });
  advance(1.9);
  assert.equal(game.debug.landed, 1, 'mouse-only play can land without any keyboard input');
  game.pointerdown({ x: 650, y: 450 });
  advance(0.2);
  game.pointerup();
  advance(2);
  assert.equal(game.debug.landed, 1, 'pointer cleanup without a point cancels charging');
  game.destroy();
}
{
  const { game, releaseAt, advance, results } = session();
  for (let n = 0; n < 5; n++) releaseAt(game.debug.targetBand.center);
  assert.equal(game.debug.landed, 5);
  assert.equal(results.length, 1, 'five successful landings complete a round');
  advance(50);
  game.keydown('Space');
  game.keyup('Space');
  assert.equal(results.length, 1, 'natural completion fires once');
  assert.equal(results[0].stats.find(stat => stat.label === '本局落点').value, '5 / 5');
  game.destroy();
}
{
  const { game, advance, results } = session();
  advance(46);
  assert.equal(results.length, 1, 'an idle round times out by 45 seconds');
  advance(10);
  game.keydown('Space');
  game.keyup('Space');
  game.pointerdown({ x: 500, y: 500 });
  game.pointerup({ x: 500, y: 500 });
  assert.equal(results.length, 1, 'timeout and later inputs cannot complete twice');
  game.destroy();
  advance(3);
  assert.equal(results.length, 1);
}
console.log('PASS poles: golden and forgiving landings, recovery, held input, pause cleanup, five-pole completion and timeout.');
