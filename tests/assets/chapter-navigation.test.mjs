import test from 'node:test';
import assert from 'node:assert/strict';
import * as navigation from '../../src/config/chapters.js';

test('four public chapters keep the expression page registered under the stage', () => {
  assert.deepEqual(navigation.chapters.map(chapter => chapter.route), ['entry', 'model', 'action', 'spread']);
  assert.deepEqual(navigation.chapters.map(chapter => chapter.label), ['序', '造', '舞', '传']);
  assert.ok(navigation.pageRoutes.includes('state'));
  assert.equal(navigation.chapterForRoute('state'), 'action');
  assert.equal(navigation.getChapter('state').number, '03');
  assert.equal(navigation.getChapter('spread').number, '04');
});

test('every visible chapter has an existing icon and independent page identity', () => {
  for (const chapter of navigation.chapters) {
    assert.ok(navigation.navigationIcons[chapter.route]?.mediaKey);
    assert.equal(navigation.getChapter(chapter.route), chapter);
    assert.equal(navigation.chapterForRoute(chapter.route), chapter.route);
  }
});
