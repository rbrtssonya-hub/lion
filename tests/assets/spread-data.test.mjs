import test from 'node:test';
import assert from 'node:assert/strict';
import { homeCultureStories } from '../../src/data/home-culture.js';
import { spreadMapPoints, spreadPlaces } from '../../src/data/spread.js';

test('地图按用户指定的三组收录十二个城市，编号与层级顺序稳定', () => {
  const expected = [
    ['foshan', 'guangdong', '01', '佛山'], ['guangzhou', 'guangdong', '02', '广州'],
    ['heshan', 'guangdong', '03', '鹤山'], ['suixi', 'guangdong', '04', '遂溪'],
    ['beijing', 'china', '05', '北京'], ['tianyang', 'china', '06', '田阳'],
    ['quanzhou', 'china', '07', '泉州'], ['hong-kong', 'china', '08', '香港'],
    ['singapore', 'world', '09', '新加坡'], ['kuala-lumpur', 'world', '10', '吉隆坡'],
    ['san-francisco', 'world', '11', '旧金山'], ['london', 'world', '12', '伦敦'],
  ];
  assert.deepEqual(spreadPlaces.map(place => [place.id, place.level, place.serial, place.name]), expected);
  assert.equal(new Set(spreadPlaces.map(place => place.id)).size, 12);
  for (const level of ['guangdong', 'china', 'world']) {
    assert.equal(spreadMapPoints[level].length, 4);
    assert.ok(spreadMapPoints[level].every(point => point.level === level));
  }
});

test('已有案例继续引用原 story 与照片，未提供资料的城市不借用其他地点照片', () => {
  const includedStories = spreadPlaces.flatMap(place => place.stories);
  assert.equal(new Set(includedStories).size, includedStories.length);
  assert.equal(spreadPlaces.find(place => place.id === 'heshan').stories.length, 0);
  assert.equal(spreadPlaces.find(place => place.id === 'suixi').stories.length, 0);
  assert.equal(spreadPlaces.find(place => place.id === 'beijing').stories.length, 0);
  assert.equal(spreadPlaces.find(place => place.id === 'tianyang').stories.length, 0);
  assert.equal(spreadPlaces.find(place => place.id === 'quanzhou').stories.length, 0);
  assert.equal(spreadPlaces.find(place => place.id === 'kuala-lumpur').stories.length, 0);
  assert.equal(spreadPlaces.find(place => place.id === 'london').stories.length, 0);
  for (const story of includedStories) {
    const original = homeCultureStories.find(item => item.id === story.id);
    assert.ok(original, `${story.id} is an existing story`);
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
    foshan: ['living-tradition'],
    guangzhou: ['lion-head-craft'],
    'hong-kong': ['shared-rhythm'],
    singapore: ['drum-language', 'expressive-lion', 'community-celebration'],
    'san-francisco': ['balance-in-air'],
  };
  for (const place of spreadPlaces) {
    assert.deepEqual(place.stories.map(story => story.id), expected[place.id] ?? []);
    assert.equal(place.photoYears.length, place.stories.length);
    place.stories.forEach((story, index) => assert.ok(story.photo.caption.endsWith(String(place.photoYears[index]))));
    assert.equal(place.coordinates.length, 2);
    assert.ok(place.coordinates[0] >= -180 && place.coordinates[0] <= 180);
    assert.ok(place.coordinates[1] >= -90 && place.coordinates[1] <= 90);
  }
  assert.equal(spreadPlaces.some(place => place.name === '埃德蒙顿'), false);
});
