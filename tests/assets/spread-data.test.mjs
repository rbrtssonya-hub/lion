import test from 'node:test';
import assert from 'node:assert/strict';
import { homeCultureStories } from '../../src/data/home-culture.js';
import { spreadPlaces } from '../../src/data/spread.js';

test('传章只收录现有实景案例，五个地点的 id 唯一且稳定', () => {
  assert.deepEqual(spreadPlaces.map(place => place.id), ['lingnan', 'hong-kong', 'singapore', 'san-francisco', 'edmonton']);
  assert.equal(new Set(spreadPlaces.map(place => place.id)).size, 5);
  assert.deepEqual(spreadPlaces.map(place => place.stories.length), [2, 1, 3, 1, 1]);
});

test('地点引用原 story 与照片对象，保留全部原图注、摄影者、来源及许可', () => {
  const includedStories = spreadPlaces.flatMap(place => place.stories);
  assert.equal(includedStories.length, homeCultureStories.length);
  assert.equal(new Set(includedStories).size, homeCultureStories.length);
  for (const story of includedStories) {
    const original = homeCultureStories.find(item => item.id === story.id);
    assert.equal(story, original);
    assert.equal(story.photo, original.photo);
    for (const field of ['caption', 'author', 'sourceUrl', 'license', 'licenseUrl', 'mediaKey']) {
      assert.ok(story.photo[field], `${story.id}: ${field}`);
      assert.equal(story.photo[field], original.photo[field]);
    }
  }
});

test('每幅照片归入真实地点，年份以拍摄年展示而不作为传播节点', () => {
  const expected = {
    lingnan: ['living-tradition', 'lion-head-craft'],
    'hong-kong': ['shared-rhythm'],
    singapore: ['drum-language', 'expressive-lion', 'community-celebration'],
    'san-francisco': ['balance-in-air'],
    edmonton: ['cai-qing'],
  };
  for (const place of spreadPlaces) {
    assert.deepEqual(place.stories.map(story => story.id), expected[place.id]);
    assert.equal(place.photoYears.length, place.stories.length);
    place.stories.forEach((story, index) => assert.ok(story.photo.caption.endsWith(String(place.photoYears[index]))));
    assert.equal(place.coordinates.length, 2);
    assert.ok(place.coordinates[0] >= -180 && place.coordinates[0] <= 180);
    assert.ok(place.coordinates[1] >= -90 && place.coordinates[1] <= 90);
  }
});
