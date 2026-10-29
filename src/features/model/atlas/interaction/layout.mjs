import { structureAtlasMedia } from '../../../../config/media.js';
// The six generated images share the aspect of the registered 1920×1020
// reference, within the image generator's native output precision.
export const FULLSCREEN_REFERENCE_ASPECT = 1720 / 914;
export const FULLSCREEN_VARIANTS = [
  { id: '16x10', aspect: 16 / 10 },
  { id: '16x9', aspect: 16 / 9 },
  { id: 'reference', aspect: FULLSCREEN_REFERENCE_ASPECT },
  { id: 'ultrawide', aspect: 2560 / 1080 },
];

export function nearestFullscreenVariant(width, height) {
  const ratio = width / height;
  return FULLSCREEN_VARIANTS.reduce((best, candidate) =>
    Math.abs(Math.log(candidate.aspect / ratio)) < Math.abs(Math.log(best.aspect / ratio)) ? candidate : best);
}

export function fullscreenImageUrl(id, variant) {
  return structureAtlasMedia.fullscreen[id]?.[variant];
}

/** The camera's registered 3:2 aperture follows the complete artwork. */
export function frameLayout(width, height, artworkAspect = FULLSCREEN_REFERENCE_ASPECT) {
  const padding = Math.max(24, Math.min(48, width * .022));
  const artworkWidth = Math.min(width, height * artworkAspect);
  const artworkHeight = artworkWidth / artworkAspect;
  const frameHeight = artworkHeight;
  const frameWidth = frameHeight * 1.5;
  const columnWidth = width * .64;
  const compact = height <= 650;
  const navHeight = compact ? 78 : 104;
  const navBottom = compact ? 8 : 18;
  const mat = Math.max(10, Math.min(18, width * .008));
  const captionHeight = compact ? 26 : 32;
  const frameTop = Math.max(12, Math.min(20, height * .02));
  const frameLeft = padding * 1.65;
  const maxFrameWidth = columnWidth - frameLeft - padding * .65;
  const maxPictureHeight = height - frameTop - navHeight - navBottom - 28 - mat * 2 - captionHeight;
  const studyScale = Math.min((maxFrameWidth - mat * 2) / artworkWidth, Math.max(1, maxPictureHeight) / artworkHeight);
  const studyWidth = width * studyScale;
  const studyHeight = height * studyScale;
  const pictureWidth = artworkWidth * studyScale;
  const pictureHeight = artworkHeight * studyScale;
  const plateWidth = pictureWidth + mat * 2;
  const plateHeight = pictureHeight + mat * 2 + captionHeight;
  const plateX = frameLeft + (maxFrameWidth - plateWidth) / 2;
  // The existing companion and sound button occupy the lower-left corner.
  const companionReserve = Math.min(172, columnWidth * .23);
  const navWidth = Math.min(1008, columnWidth - companionReserve - padding * .5);
  return {
    viewportWidth: width, viewportHeight: height,
    artworkWidth, artworkHeight,
    artworkX: (width - artworkWidth) / 2,
    artworkY: (height - artworkHeight) / 2,
    width: frameWidth, height: frameHeight,
    homeX: (width - frameWidth) / 2,
    homeY: (height - frameHeight) / 2,
    studyX: plateX + mat, studyY: frameTop + mat, studyWidth, studyHeight, studyScale,
    plate: { x: plateX, y: frameTop, width: plateWidth, height: plateHeight, mat, captionHeight },
    textX: columnWidth + padding * .35,
    textY: frameTop,
    textWidth: width - columnWidth - padding * 1.35,
    textHeight: height - frameTop * 2,
    navWidth, homeNavX: (width - navWidth) / 2,
    studyNavX: companionReserve + (columnWidth - companionReserve - navWidth) / 2,
    padding,
  };
}
