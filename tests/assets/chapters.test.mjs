import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chapters, navigationIcons } from '../../src/config/chapters.js';
import { assetPaths } from '../../src/config/assetPaths.js';

test('章节与设置图案保留透明PNG，显示取景不超出原图', () => {
  for (const route of [...chapters.map(chapter => chapter.route), 'settings']) {
    const { mediaKey, viewBox } = navigationIcons[route];
    const bytes = readFileSync(new URL(`../../source/public/${assetPaths[mediaKey]}`, import.meta.url));
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(bytes[25], 6, `${route} requires the original RGBA transparency`);
    const [x, y, width, height] = viewBox.split(' ').map(Number);
    assert.ok(x >= 0 && y >= 0 && width > 0 && height > 0);
    assert.ok(x + width <= bytes.readUInt32BE(16) && y + height <= bytes.readUInt32BE(20));
  }
});
