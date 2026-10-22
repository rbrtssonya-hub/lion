import test from 'node:test';
import assert from 'node:assert/strict';
import { surfaceDefaults, getSurfaceStyle, migrateReadingPaper, readingPaperVersion } from '../../src/features/developer-settings/surfaceSettings.js';

const old = Object.fromEntries([
  ...['bookTitle', 'bookDetails', 'cultureTitle', 'cultureBody'].map(prefix => [prefix, ['#fff9ee', 40, 5, 14]]),
  ['cultureSources', ['#f8edda', 0, 0, 18]],
  ['cultureSourceCard', ['#fff8eb', 0, 0, 9]],
  ['expressionOverlay', ['#fff8ea', 22, 6, 24]],
].flatMap(([prefix, values]) => ['Color', 'Transparency', 'Blur', 'Radius'].map((suffix, i) => [`${prefix}${suffix}`, values[i]])));

test('paper defaults distinguish feathered headings, reading and reference surfaces', () => {
  for (const prefix of ['bookTitle', 'cultureTitle', 'bookDetails', 'cultureBody', 'cultureSources', 'cultureSourceCard', 'expressionOverlay']) {
    assert.equal(surfaceDefaults[`${prefix}Color`], '#f7f5f0');
    assert.equal(surfaceDefaults[`${prefix}Blur`], 0);
    const title = prefix.endsWith('Title');
    assert.equal(surfaceDefaults[`${prefix}Radius`], title ? 0 : 10);
    assert.equal(surfaceDefaults[`${prefix}Transparency`], title ? 35 : prefix.startsWith('cultureSource') ? 5 : 10);
  }
});

test('legacy defaults migrate field by field without changing unrelated preferences or mutating input', () => {
  const saved = { ...old, bookTitleWidth: 61, cultureBodyHeight: 320, bookTitleSpacing: 77, navFontSize: 27, bookPageInterval: 19, modelOverlayColor: '#68170f', actionOverlayBlur: 10, videoOverlayTransparency: 12 };
  const copy = structuredClone(saved), migrated = migrateReadingPaper(saved);
  for (const name of Object.keys(old)) assert.equal(migrated[name], surfaceDefaults[name], name);
  for (const name of ['bookTitleWidth', 'cultureBodyHeight', 'bookTitleSpacing', 'navFontSize', 'bookPageInterval', 'modelOverlayColor', 'actionOverlayBlur', 'videoOverlayTransparency']) assert.equal(migrated[name], saved[name]);
  assert.equal(migrated.readingPaperVersion, readingPaperVersion);
  assert.deepEqual(saved, copy);
});

test('custom material fields survive a mixed migration and old values chosen afterwards survive reload', () => {
  const migrated = migrateReadingPaper({ ...old, cultureBodyColor: '#fafafa', bookTitleBlur: 13, expressionOverlayTransparency: 72 });
  assert.equal(migrated.cultureBodyColor, '#fafafa');
  assert.equal(migrated.bookTitleBlur, 13);
  assert.equal(migrated.expressionOverlayTransparency, 72);
  assert.equal(migrated.cultureBodyRadius, 10);
  const manual = { ...migrated, ...old };
  assert.deepEqual(migrateReadingPaper(manual), manual);
});

test('missing storage fields stay missing so current defaults and legacy shared opacity can resolve normally', () => {
  assert.deepEqual(migrateReadingPaper({ bookTitleWidth: 53 }), { bookTitleWidth: 53, readingPaperVersion });
});

test('fully transparent material disables blur but does not fade the text or alter size', () => {
  for (const transparency of [0, 100]) {
    const style = getSurfaceStyle({ ...surfaceDefaults, bookTitleTransparency: transparency, bookTitleBlur: 14 }, 'bookTitle');
    assert.equal(style['--surface-opacity'], 1 - transparency / 100);
    assert.equal(style['--surface-blur'], transparency === 100 ? 'none' : 'blur(14px)');
    assert.equal(style['--surface-width'], '69%');
    assert.ok(!Object.hasOwn(style, 'opacity'));
  }
});
