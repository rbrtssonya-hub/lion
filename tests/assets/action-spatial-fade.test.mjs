import test from 'node:test';
import assert from 'node:assert/strict';
import { advancePanelOpacity, projectedPanelVisibility } from '../../src/services/actionSpatialMotion.js';

const integrate = (current, target, seconds, frames, fadeIn = 380, fadeOut = 320) => {
  for (let frame = 0; frame < frames; frame++) current = advancePanelOpacity(current, target, seconds / frames, fadeIn, fadeOut);
  return current;
};
const close = (actual, expected, epsilon = 1e-12) => assert.ok(Math.abs(actual - expected) < epsilon, `${actual} is within ${epsilon} of ${expected}`);

test('相同经过时间在60/120/144Hz产生相同alpha，默认时长到达新目标95%', () => {
  const expected = 1 - Math.exp(-3);
  for (const frames of [23, 46, 55, 60, 120, 144]) close(integrate(0, 1, .38, frames), expected);
  for (const frames of [19, 38, 46, 60, 120, 144]) close(integrate(1, 0, .32, frames), 1 - expected);
  close(advancePanelOpacity(.4, .9, 0, 380, 320), .4);
  close(advancePanelOpacity(.4, .9, -.1, 380, 320), .4);
});

test('快速反向从当前alpha续接，下一帧立即改变方向且渐显/渐隐参数独立生效', () => {
  const faded = integrate(1, 0, .1, 6);
  const reversed = advancePanelOpacity(faded, 1, 1 / 60, 380, 320);
  assert.ok(faded > .3 && faded < .5);
  assert.ok(reversed > faded && reversed < 1);
  assert.ok(reversed - faded < .15, 'no reset to either endpoint on reversal');
  const reverseAgain = advancePanelOpacity(reversed, 0, 1 / 60, 380, 320);
  assert.ok(reverseAgain < reversed && reverseAgain > 0);
  const fastIn = integrate(.2, .8, .15, 9, 150, 800);
  const slowIn = integrate(.2, .8, .15, 9, 800, 800);
  assert.ok(fastIn - slowIn > .25);
  const fastOut = integrate(.8, .2, .15, 9, 800, 150);
  const slowOut = integrate(.8, .2, .15, 9, 800, 800);
  assert.ok(slowOut - fastOut > .25);
  close(integrate(.2, .8, .2, 12, 380, 150), integrate(.2, .8, .2, 12, 380, 800));
  close(integrate(.8, .2, .2, 12, 150, 320), integrate(.8, .2, .2, 12, 800, 320));
});

test('真实投影进入12%边缘区即连续减弱，跨边缘/反向回到视野没有离散开关', () => {
  const visibility = (left, zone = .12, facing = 1) => projectedPanelVisibility({ left, right: left + .3, top: .3, bottom: .6 }, zone, facing);
  close(visibility(.18), 1);
  assert.ok(visibility(.06) > 0 && visibility(.06) < 1, 'fade begins while the entire panel is still inside the viewport');
  assert.ok(visibility(0) > 0 && visibility(0) < visibility(.06));
  assert.ok(visibility(-.1) > 0 && visibility(-.1) < visibility(0));
  close(visibility(-.13), 0);
  let previous = 1;
  for (let left = .18; left >= -.18; left -= .001) {
    const current = visibility(left);
    assert.ok(current >= 0 && current <= previous + 1e-12);
    assert.ok(previous - current < .02, 'a small projected movement cannot cause an alpha target jump');
    previous = current;
  }
  assert.ok(visibility(.1, .25) < visibility(.1, .05), 'the public edge-zone parameter changes the actual target');
  close(visibility(.18, .12, 0), 0);
  assert.ok(visibility(.18, .12, .09) > 0 && visibility(.18, .12, .09) < 1);
});
