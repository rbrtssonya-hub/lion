import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getChapterGuide, answerLocally } from '../../src/features/assistant/knowledge.js';
import { chapterForRoute, pageRoutes } from '../../src/config/chapters.js';

test('dance chooser has its own guide while the theater keeps its action knowledge', () => {
  assert.ok(pageRoutes.includes('theater'));
  assert.equal(chapterForRoute('theater'), 'action');
  const guide = getChapterGuide('dance');
  assert.match(guide.answer, /两个/);
  assert.match(guide.answer, /拖动/);
  assert.ok(guide.sources.some(source => source.id === 'page-action'));
  assert.match(getChapterGuide('action').answer, /四面巨幕动作展厅/);
  assert.equal(answerLocally('讲解本页', 'dance').answer, guide.answer);
});
