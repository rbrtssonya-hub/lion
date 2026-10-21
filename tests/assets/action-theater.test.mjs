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

test('巨幕方向选择以7度角优势迟滞，越界在当前调用立即切换', () => {
  const initial = { activeId: 'tanqing', pendingId: null, pendingSince: 0 };
  assert.deepEqual(select(48, initial, 100), initial);
  assert.deepEqual(select(49, initial, 100), { activeId: 'doumao', pendingId: null, pendingSince: 0 });
  assert.deepEqual(select(90, initial, 100), { activeId: 'doumao', pendingId: null, pendingSince: 0 });
});

test('巨幕边界往返由角优势防抖，快速反转不排队也不等待停留', () => {
  const initial = { activeId: 'tanqing', pendingId: null, pendingSince: 0 };
  let current = initial;
  for (const angle of [44, 46, 44, 47, 43]) {
    current = select(angle, current, 100);
    assert.equal(current.activeId, 'tanqing');
  }
  current = select(50, current, 100);
  assert.equal(current.activeId, 'doumao');
  for (const angle of [44, 46, 43, 47]) {
    current = select(angle, current, 100);
    assert.equal(current.activeId, 'doumao');
  }
  current = select(40, current, 100);
  assert.deepEqual(current, initial);
  assert.equal(select(90, { ...current, pendingId: 'tuqiu', pendingSince: 99999 }, 100).activeId, 'doumao');
});

test('四个方向及±180度接缝均选择正确主屏，垂直观看不引起切换', () => {
  for (const [degrees, id] of [[0, 'tanqing'], [90, 'doumao'], [180, 'tuqiu'], [-180, 'tuqiu'], [-90, 'meihuazhuang']]) {
    const first = select(degrees, { activeId: null, pendingId: null, pendingSince: 0 }, 100);
    assert.equal(select(degrees, first, 280).activeId, id);
  }
  assert.deepEqual(chooseScreen({ forward: [0, 1, 0], definitions, activeId: 'tuqiu', pendingId: 'doumao', pendingSince: 100, now: 900 }), { activeId: 'tuqiu', pendingId: null, pendingSince: 0 });
});

test('空间角度选择排除视锥外和背向屏幕，当前失去可见性时即时接续', () => {
  const scores = [
    { id: 'tanqing', angle: rad(42), visible: true, frontFacing: true },
    { id: 'doumao', angle: rad(44), visible: true, frontFacing: true },
    { id: 'tuqiu', angle: rad(1), visible: false, frontFacing: true },
    { id: 'meihuazhuang', angle: rad(0), visible: true, frontFacing: false },
  ];
  const selectScores = activeId => chooseScreen({ forward: forward(0), definitions, activeId, scores });
  assert.equal(selectScores('doumao').activeId, 'doumao');
  assert.equal(selectScores('tanqing').activeId, 'tanqing');
  scores[0].visible = false;
  assert.equal(selectScores('tanqing').activeId, 'doumao');
  scores[1].visible = false;
  assert.equal(selectScores('tanqing').activeId, 'tanqing');
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
