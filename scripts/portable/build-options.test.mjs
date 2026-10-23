import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveBundledIcon } from './build-options.mjs';

test('an explicit icon path overrides the bundled default and keeps spaces', () => {
  assert.equal(
    resolveBundledIcon(['F:/deliverables/build', '--icon=F:/数媒竞赛/醒狮素材/UI狮头.png'], 'F:/project', 'source/public/assets/entry/nav-lion-head.png'),
    'F:\\数媒竞赛\\醒狮素材\\UI狮头.png',
  );
});

test('an empty explicit icon path is rejected instead of silently using another icon', () => {
  assert.throws(
    () => resolveBundledIcon(['--icon='], 'F:/project', 'source/public/assets/entry/nav-lion-head.png'),
    /icon path cannot be empty/i,
  );
});
