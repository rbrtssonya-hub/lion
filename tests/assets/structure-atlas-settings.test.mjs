import test from 'node:test';
import assert from 'node:assert/strict';
import {
  surfaceDefaults, getSurfaceStyle, migrateReadingPaper,
  migrateStructureAtlas, structureAtlasVersion,
} from '../../src/features/developer-settings/surfaceSettings.js';
import { restoreDeveloperSettings } from '../../src/features/developer-settings/useDeveloperSettings.js';

const oldStructure = {
  modelOverlayColor: '#68170f', modelOverlayTransparency: 20,
  modelOverlayBlur: 12, modelOverlayRadius: 24,
  modelOverlayWidth: 100, modelOverlayHeight: 620,
};
const paperStructure = {
  modelOverlayColor: '#f7f4ed', modelOverlayTransparency: 5,
  modelOverlayBlur: 0, modelOverlayRadius: 10,
  modelOverlayWidth: 100, modelOverlayHeight: 0,
};

test('structure reading paper starts warm, nearly opaque and without glass blur', () => {
  for (const [name, value] of Object.entries(paperStructure)) assert.equal(surfaceDefaults[name], value, name);
  const style = getSurfaceStyle(surfaceDefaults, 'modelOverlay');
  assert.equal(style['--surface-rgb'], '247 244 237');
  assert.equal(style['--surface-opacity'], .95);
  assert.equal(style['--surface-blur'], 'none');
  assert.equal(style['--surface-radius'], '10px');
  assert.ok(!Object.hasOwn(style, 'opacity'), 'paper material must not fade the reading text');
});

test('independent structure migration upgrades every historical default without touching other pages', () => {
  const saved = { ...oldStructure, readingPaperVersion: 1, bookTitleColor: '#fff9ee',
    expressionOverlayBlur: 6, actionOverlayColor: '#faf7f1', headerColor: '#801d17', hdriIntensity: 1.35 };
  const before = structuredClone(saved);
  const migrated = migrateStructureAtlas(saved);
  for (const [name, value] of Object.entries(paperStructure)) assert.equal(migrated[name], value, name);
  for (const name of ['readingPaperVersion', 'bookTitleColor', 'expressionOverlayBlur', 'actionOverlayColor', 'headerColor', 'hdriIntensity']) {
    assert.equal(migrated[name], saved[name], name);
  }
  assert.equal(migrated.structureAtlasVersion, structureAtlasVersion);
  assert.deepEqual(saved, before, 'migration must not mutate the saved preferences');
  assert.equal(migrateReadingPaper({ ...oldStructure }).modelOverlayColor, '#68170f', 'the older reading-paper migration retains its scope');
});

test('mixed structure material preferences migrate field by field and preserve custom dimensions', () => {
  const saved = { ...oldStructure, modelOverlayColor: '#e6d4b8', modelOverlayTransparency: 37,
    modelOverlayBlur: 8, modelOverlayWidth: 74, modelOverlayHeight: 710 };
  const migrated = migrateStructureAtlas(saved);
  for (const name of ['modelOverlayColor', 'modelOverlayTransparency', 'modelOverlayBlur', 'modelOverlayWidth', 'modelOverlayHeight']) {
    assert.equal(migrated[name], saved[name], name);
  }
  assert.equal(migrated.modelOverlayRadius, 10, 'only the untouched historical radius upgrades');
});

test('structure upgrade runs once, so historical material chosen afterwards survives reload', () => {
  const upgraded = migrateStructureAtlas(oldStructure);
  const manuallyRestored = { ...upgraded, ...oldStructure };
  assert.equal(migrateStructureAtlas(manuallyRestored), manuallyRestored);
  const future = { ...oldStructure, structureAtlasVersion: structureAtlasVersion + 1 };
  assert.equal(migrateStructureAtlas(future), future);
});

test('partial structure migration keeps missing fields absent for normal default resolution', () => {
  const saved = { modelOverlayWidth: 57, modelOverlayBlur: 12, actionOverlayTransparency: 42 };
  assert.deepEqual(migrateStructureAtlas(saved), {
    modelOverlayWidth: 57, modelOverlayBlur: 0, actionOverlayTransparency: 42, structureAtlasVersion,
  });
});

test('storage restoration applies the structure upgrade even when reading paper was already migrated', () => {
  const saved = { ...oldStructure, readingPaperVersion: 1, bookTitleLayoutVersion: 1, navigationTypographyVersion: 2,
    bookTitleWidth: 57, bookTitleColor: '#fff9ee', archivePanelTransparency: 71,
    expressionOverlayBlur: 9, actionOverlayTransparency: 42, headerBlur: 23, hdriIntensity: 1.35 };
  const restored = restoreDeveloperSettings(saved);
  for (const [name, value] of Object.entries(paperStructure)) assert.equal(restored[name], value, name);
  for (const name of ['bookTitleWidth', 'bookTitleColor', 'archivePanelTransparency', 'expressionOverlayBlur', 'actionOverlayTransparency', 'headerBlur', 'hdriIntensity']) {
    assert.equal(restored[name], saved[name], name);
  }
  assert.equal(restored.structureAtlasVersion, structureAtlasVersion);
  assert.equal(restored.bookTitleTransparency, 71, 'legacy shared-opacity restoration still works');
  assert.deepEqual(restoreDeveloperSettings(JSON.parse(JSON.stringify(restored))), restored);
  const manual = { ...restored, ...oldStructure };
  assert.deepEqual(restoreDeveloperSettings(JSON.parse(JSON.stringify(manual))), manual);
});

test('fresh or invalid storage resolves current structure defaults with a persisted upgrade marker', () => {
  for (const saved of [undefined, null, [], 'invalid', {}]) {
    const restored = restoreDeveloperSettings(saved);
    assert.equal(restored.structureAtlasVersion, structureAtlasVersion);
    for (const [name, value] of Object.entries(paperStructure)) assert.equal(restored[name], value, name);
  }
});
