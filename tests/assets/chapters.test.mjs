import test from 'node:test';
import assert from 'node:assert/strict';
import { chapters } from '../../src/config/chapters.js';

test('保留动作章节导航的完整狮舞图标路径', () => {
  const action = chapters.find(({ route }) => route === 'action');
  assert.equal(action?.icon, 'M12 15 8 12l2-5 5 1 3-4 5 2 1 6-4 5-7-2ZM14 8h1M10 12h6M20 16l9 8 7 9 4 9-4 2-5-8-7-5-3 4-5-2 4-6-5-5-3 2-7-4 1-4 6 2 1-4M28 24c6 0 8-4 7-8 5 0 5 8 0 12M25 31l-3 9-6 3-2-3 5-3 1-5');
});
