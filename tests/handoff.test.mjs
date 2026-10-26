import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { frameLayout } from '../src/interaction/layout.mjs';
import { CHAPTERS } from '../src/content/chapters.js';

test('desktop flight uses the largest complete 3:2 aperture before the image docks against the top-left', () => {
  for (const [width,height] of [[1280,800],[1440,900],[1536,960],[1920,1080],[2560,1440]]) {
    const layout=frameLayout(width,height);
    assert.equal(layout.width/layout.height,1.5);
    assert.equal(layout.width%3,0);
    assert.equal(layout.homeX+layout.width/2,width/2);
    assert.equal(layout.homeY+layout.height/2,height/2);
    assert.ok(layout.width<=width && layout.height<=height);
    assert.ok(Math.min(width-layout.width,(height-layout.height)*1.5)<3,'full-screen aperture has no reserved panel/nav margins');
    assert.equal(layout.studyX,0);
    assert.equal(layout.studyY,0);
    assert.equal(layout.studyWidth/layout.studyHeight,1.5);
    assert.equal(layout.studyWidth%3,0);
    assert.equal(layout.studyScale,layout.studyWidth/layout.width);
    assert.ok(layout.studyScale>0 && layout.studyScale<1);
    assert.ok(layout.studyWidth<layout.textX);
    assert.ok(layout.textX+layout.textWidth<=width);
    assert.ok(layout.textWidth>width*.30,'right-hand reader gains meaningful horizontal room');
    assert.ok(layout.textY>=0 && layout.textY+layout.textHeight<=height);
    assert.ok(layout.studyHeight<height-125,'image leaves room for the left-hand controls');
    assert.equal(layout.homeNavX+layout.navWidth/2,width/2);
    assert.equal(layout.studyNavX+layout.navWidth/2,layout.studyWidth/2);
    assert.ok(layout.studyNavX<layout.homeNavX,'all six art controls move into the left-hand image column');
    assert.ok(layout.studyNavX>=0 && layout.studyNavX+layout.navWidth<=layout.studyWidth);
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
