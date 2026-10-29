import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { assetPaths } from '../../src/config/assetPaths.js';

const posters = {
  structureAtlasBreakdownBrows: '74e61b44a3557072bc1735b7af172df6933425e55319c74fae1931c7e630b89d',
  structureAtlasBreakdownCrown: '41460cf24279f01e025dd1c3e6b13270033de6f215346897e98c0e36cbf076f5',
  structureAtlasBreakdownBeard: '089836692091237860a25298c3214b0007dd668fefa27a0bb136475b91313447',
  structureAtlasBreakdownBody: 'd6299e9d8bdf1c025a70b940bb7aa80367982ce370cc698a5a569414aaf02969',
  structureAtlasBreakdownTrim: 'c2844d1ea4c54efa542b33c39df72455ae4bc163d2b37953660af8ebfed54c53',
  structureAtlasBreakdownMouth: '465bc8049b7c567e37a2bbf4deb04a57a94b976c0e725cb12fbb1a727cded4db',
};

test('观形六个部位分别使用用户提供的对应海报原图', () => {
  for (const [key, expected] of Object.entries(posters)) {
    const actual = createHash('sha256').update(readFileSync(`source/public/${assetPaths[key]}`)).digest('hex');
    assert.equal(actual, expected, key);
  }
});
