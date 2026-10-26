import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { frameLayout } from '../src/interaction/layout.mjs';
import { CHAPTERS } from '../src/content/chapters.js';

test('desktop camera and image viewport retain exact 3:2 without clipping or stretching', () => {
  for (const [width,height] of [[1280,800],[1440,900],[1536,960],[1920,1080],[2560,1440]]) {
    const layout=frameLayout(width,height);
    assert.equal(layout.width/layout.height,1.5);
    assert.equal(layout.width%3,0);
    assert.equal(layout.homeX+layout.width/2,width/2);
    assert.ok(layout.studyX>=0 && layout.studyX+layout.width<layout.textX);
    assert.ok(layout.textX+layout.textWidth<=width);
    assert.ok(layout.y+layout.height<height-100);
  }
});

test('six controls have six newly generated distinct full-size images, not the old three reused plates', async () => {
  const ids=['brows','crown','beard','body','trim','mouth'];
  assert.deepEqual(Object.keys(CHAPTERS),ids);
  const oldHashes = await Promise.all(['gaze','textile','mane'].map(async name=>createHash('sha256').update(await readFile(`public/images/${name}-study.png`)).digest('hex')));
  const hashes=[];
  for(const id of ids){
    const url=CHAPTERS[id].image;
    assert.equal(url,`/images/chapters/${id}.png`);
    const png=await readFile(`public${url}`);
    assert.equal(png.subarray(1,4).toString(),'PNG');
    assert.equal(png.readUInt32BE(16),1536);
    assert.equal(png.readUInt32BE(20),1024);
    const hash=createHash('sha256').update(png).digest('hex');
    assert.ok(!oldHashes.includes(hash),`${id} must be new artwork`);
    hashes.push(hash);
  }
  assert.equal(new Set(hashes).size,6);
});
