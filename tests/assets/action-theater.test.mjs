import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseScreen, constrainOrbit, containedVideoScale, shortestAngle, THEATER_ORBIT } from '../../src/services/actionTheaterMath.js';

const rad = degrees => degrees * Math.PI / 180;
const forward = degrees => [Math.sin(rad(degrees)), .3, -Math.cos(rad(degrees))];
const definitions = [
  { id: 'tanqing', direction: [0, 0, -1] },
  { id: 'doumao', direction: [1, 0, 0] },
  { id: 'tuqiu', direction: [0, 0, 1] },
  { id: 'meihuazhuang', direction: [-1, 0, 0] },
];
const select = (degrees, state, now) => chooseScreen({ forward: forward(degrees), definitions, ...state, now });

test('巨幕方向选择在边界保留当前屏，超过12度优势后仍等待180毫秒', () => {
  const initial = { activeId: 'tanqing', pendingId: null, pendingSince: 0 };
  assert.deepEqual(select(50, initial, 100), initial);
  const pending = select(52, initial, 100);
  assert.deepEqual(pending, { activeId: 'tanqing', pendingId: 'doumao', pendingSince: 100 });
  assert.deepEqual(select(52, pending, 279), pending);
  assert.deepEqual(select(52, pending, 280), { activeId: 'doumao', pendingId: null, pendingSince: 0 });
});

test('巨幕边界抖动取消旧停留，换向和回看必须重新观察完整停留期', () => {
  const initial = { activeId: 'tanqing', pendingId: null, pendingSince: 0 };
  const pending = select(60, initial, 100);
  const reset = select(47, pending, 240);
  assert.deepEqual(reset, initial);
  const restarted = select(60, reset, 260);
  assert.equal(select(60, restarted, 400).activeId, 'tanqing');
  const current = select(60, restarted, 440);
  assert.equal(current.activeId, 'doumao');
  assert.equal(select(40, current, 700).activeId, 'doumao');
  assert.equal(select(35, current, 800).pendingId, 'tanqing');
});

test('四个方向及±180度接缝均选择正确主屏，垂直观看不引起切换', () => {
  for (const [degrees, id] of [[0, 'tanqing'], [90, 'doumao'], [180, 'tuqiu'], [-180, 'tuqiu'], [-90, 'meihuazhuang']]) {
    const first = select(degrees, { activeId: null, pendingId: null, pendingSince: 0 }, 100);
    assert.equal(select(degrees, first, 280).activeId, id);
  }
  assert.deepEqual(chooseScreen({ forward: [0, 1, 0], definitions, activeId: 'tuqiu', pendingId: 'doumao', pendingSince: 100, now: 900 }), { activeId: 'tuqiu', pendingId: null, pendingSince: 0 });
});

test('动作空间镜头插值始终选择跨接缝的最短角度', () => {
  assert.ok(Math.abs(shortestAngle(rad(359), rad(1)) - rad(2)) < 1e-12);
  assert.ok(Math.abs(shortestAngle(rad(1), rad(359)) + rad(2)) < 1e-12);
  assert.ok(Math.abs(shortestAngle(rad(-179), rad(179)) + rad(2)) < 1e-12);
  assert.ok(Math.abs(shortestAngle(rad(20), rad(740))) < 1e-12);
});

test('巨幕环绕同时约束半径、高度和俯仰，极限滚轮与拖拽不会离开室内', () => {
  const { target, radiusMin, radiusMax, heightMin, heightMax, polarMin, polarMax } = THEATER_ORBIT;
  for (const radius of [0, .1, 2, radiusMin, radiusMax, 15, 1000]) {
    for (const y of [-100, 0, target[1], heightMin, (heightMin + heightMax) / 2, heightMax, 100]) {
      for (const angle of [-180, -90, 0, 90, 180]) {
        const point = constrainOrbit([Math.sin(rad(angle)) * radius, y, Math.cos(rad(angle)) * radius]);
        const offset = point.map((value, index) => value - target[index]);
        const distance = Math.hypot(...offset);
        const polar = Math.acos(offset[1] / distance);
        assert.ok(point.every(Number.isFinite));
        assert.ok(distance >= radiusMin - 1e-9 && distance <= radiusMax + 1e-9);
        assert.ok(point[1] >= heightMin - 1e-9 && point[1] <= heightMax + 1e-9);
        assert.ok(polar >= polarMin - 1e-9 && polar <= polarMax + 1e-9);
      }
    }
  }
});

test('环绕约束保留合法视角和水平目标偏移，不因模型旋转改变目标', () => {
  const { target, radiusMin, radiusMax, heightMin, heightMax, polarMin, polarMax } = THEATER_ORBIT;
  const radius = (radiusMin + radiusMax) / 2;
  const lowY = Math.max(heightMin - target[1], radius * Math.cos(polarMax));
  const highY = Math.min(heightMax - target[1], radius * Math.cos(polarMin));
  const y = (lowY + highY) / 2;
  const horizontal = Math.sqrt(radius ** 2 - y ** 2);
  const point = [target[0] + horizontal / Math.sqrt(2), target[1] + y, target[2] + horizontal / Math.sqrt(2)];
  const constrained = constrainOrbit(point);
  constrained.forEach((value, index) => assert.ok(Math.abs(value - point[index]) < 1e-12));
  const movedTarget = [target[0] + 10, target[1], target[2] - 3];
  const movedPoint = [point[0] + 10, point[1], point[2] - 3];
  const moved = constrainOrbit(movedPoint, movedTarget);
  moved.forEach((value, index) => assert.ok(Math.abs(value - movedPoint[index]) < 1e-12));
});

test('巨幕完整容纳16:9、宽屏和竖屏视频，保留比例并对未知尺寸安全回退', () => {
  assert.deepEqual(containedVideoScale(2560, 1440), [1, 1]);
  assert.deepEqual(containedVideoScale(4, 3), [.75, 1]);
  assert.deepEqual(containedVideoScale(32, 9), [1, .5]);
  assert.deepEqual(containedVideoScale(9, 16), [81 / 256, 1]);
  assert.deepEqual(containedVideoScale(0, 1440), [1, 1]);
  assert.deepEqual(containedVideoScale(2560, 0), [1, 1]);
});
