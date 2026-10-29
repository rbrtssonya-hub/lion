// Files live in source/public; Vite serves and copies them without altering bytes.
import { assetPaths } from './assetPaths.js';
export { assetPaths } from './assetPaths.js';

export const media = Object.fromEntries(
  Object.entries(assetPaths).map(([key, path]) => [key, `${import.meta.env.BASE_URL}${path}`]),
);

// Six complete picture families from the external 观形 study; model rendering stays in lionScene.
export const structureAtlasMedia = {
  fullscreen: {
    brows: { "reference": media.structureAtlasBrowsReference, "16x10": media.structureAtlasBrows16X10, "16x9": media.structureAtlasBrows16X9, "ultrawide": media.structureAtlasBrowsUltrawide },
    crown: { "reference": media.structureAtlasCrownReference, "16x10": media.structureAtlasCrown16X10, "16x9": media.structureAtlasCrown16X9, "ultrawide": media.structureAtlasCrownUltrawide },
    beard: { "reference": media.structureAtlasBeardReference, "16x10": media.structureAtlasBeard16X10, "16x9": media.structureAtlasBeard16X9, "ultrawide": media.structureAtlasBeardUltrawide },
    body: { "reference": media.structureAtlasBodyReference, "16x10": media.structureAtlasBody16X10, "16x9": media.structureAtlasBody16X9, "ultrawide": media.structureAtlasBodyUltrawide },
    trim: { "reference": media.structureAtlasTrimReference, "16x10": media.structureAtlasTrim16X10, "16x9": media.structureAtlasTrim16X9, "ultrawide": media.structureAtlasTrimUltrawide },
    mouth: { "reference": media.structureAtlasMouthReference, "16x10": media.structureAtlasMouth16X10, "16x9": media.structureAtlasMouth16X9, "ultrawide": media.structureAtlasMouthUltrawide },
  },
  navigation: { overall: media.structureAtlasNavOverall, brows: media.structureAtlasNavBrows, crown: media.structureAtlasNavCrown, beard: media.structureAtlasNavBeard, body: media.structureAtlasNavBody, trim: media.structureAtlasNavTrim, mouth: media.structureAtlasNavMouth },
  breakdowns: { brows: media.structureAtlasBreakdownBrows, crown: media.structureAtlasBreakdownCrown, beard: media.structureAtlasBreakdownBeard, body: media.structureAtlasBreakdownBody, trim: media.structureAtlasBreakdownTrim, mouth: media.structureAtlasBreakdownMouth },
  font: media.structureAtlasFont,
};
