import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { PerspectiveCamera, Vector3 } from 'three';
import { frameLayout, FULLSCREEN_REFERENCE_ASPECT, FULLSCREEN_VARIANTS, nearestFullscreenVariant, fullscreenImageUrl } from '../src/interaction/layout.mjs';
import { CHAPTERS } from '../src/content/chapters.js';

test('camera keeps its 3:2 aperture and the full viewport image docks against the top-left', () => {
  for (const [width,height] of [[1280,800],[1440,900],[1536,960],[1920,1080],[2560,1440]]) {
    const layout=frameLayout(width,height);
    assert.ok(Math.abs(layout.width/layout.height-1.5)<1e-12);
    assert.equal(layout.homeX+layout.width/2,width/2);
    assert.equal(layout.homeY+layout.height/2,height/2);
    assert.ok(layout.width<=width && layout.height<=height);
    assert.ok(Math.abs(layout.artworkWidth/layout.artworkHeight-FULLSCREEN_REFERENCE_ASPECT)<1e-12);
    assert.ok(Math.abs(layout.height-layout.artworkHeight)<1e-12, 'camera aperture height follows the complete registered image');
    assert.equal(layout.artworkX+layout.artworkWidth/2,width/2);
    assert.equal(layout.artworkY+layout.artworkHeight/2,height/2);
    assert.ok(Math.min(width-layout.artworkWidth,height-layout.artworkHeight)<1e-9, 'image fits at least one entire viewport dimension');
    assert.equal(layout.studyX,0);
    assert.equal(layout.studyY,0);
    assert.ok(Math.abs(layout.studyWidth/layout.studyHeight-width/height)<1e-12);
    assert.equal(layout.studyScale,layout.studyWidth/width);
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

test('desktop window ratios select the closest independently generated full-screen image', () => {
  for (const [width, height, id] of [[1536, 960, '16x10'], [1920, 1080, '16x9'], [1920, 1020, 'reference'], [2560, 1080, 'ultrawide']]) {
    assert.equal(nearestFullscreenVariant(width, height).id, id);
    const expected = id === 'reference' ? '/images/fullscreen/mouth.png' : `/images/fullscreen/${id}/mouth.png`;
    assert.equal(fullscreenImageUrl('mouth', id), expected);
  }
});

test('the same camera rays map to the same position inside the complete artwork at desktop sizes', () => {
  const camera = new PerspectiveCamera(34, 1.5, .1, 100);
  const points = [new Vector3(0, 0, -5), new Vector3(1, .5, -5), new Vector3(-1.2, -.4, -7)];
  const project = (width, height) => {
    const l = frameLayout(width, height);
    camera.setViewOffset(l.width, l.height, -l.homeX, -l.homeY, width, height);
    return points.map(point => {
      const p = point.clone().project(camera);
      const screenX = (p.x + 1) * width / 2;
      const screenY = (1 - p.y) * height / 2;
      return [(screenX - l.artworkX) / l.artworkWidth, (screenY - l.artworkY) / l.artworkHeight];
    });
  };
  const reference = project(1920, 1020);
  for (const [width, height] of [[1920, 1080], [1536, 960], [1280, 800], [2560, 1080]]) {
    const actual = project(width, height);
    for (let i = 0; i < points.length; i++) for (let axis = 0; axis < 2; axis++) {
      assert.ok(Math.abs(actual[i][axis] - reference[i][axis]) < 1e-10, `registered projection at ${width}×${height}`);
    }
  }
});

test('six controls have distinct full-screen images for every registered desktop ratio', async () => {
  const ids=['brows','crown','beard','body','trim','mouth'];
  assert.deepEqual(Object.keys(CHAPTERS),ids);
  const oldHashes = await Promise.all(['gaze','textile','mane'].map(async name=>createHash('sha256').update(await readFile(`public/images/${name}-study.png`)).digest('hex')));
  const hashes=[];
  for(const variant of FULLSCREEN_VARIANTS) for(const id of ids){
    const url=fullscreenImageUrl(id, variant.id);
    if (variant.id === 'reference') assert.equal(url, CHAPTERS[id].image);
    const png=await readFile(`public${url}`);
    assert.equal(png.subarray(1,4).toString(),'PNG');
    const width=png.readUInt32BE(16), height=png.readUInt32BE(20);
    assert.ok(width>=1200 && height>=800, `${id} ${variant.id} has sufficient source resolution`);
    assert.ok(Math.abs(width/height - variant.aspect)<.005, `${id} ${variant.id} matches its registered window aspect`);
    const hash=createHash('sha256').update(png).digest('hex');
    assert.ok(!oldHashes.includes(hash),`${id} ${variant.id} must be new artwork`);
    hashes.push(hash);
  }
  assert.equal(new Set(hashes).size,24);
});
