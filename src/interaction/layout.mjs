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
  return variant === 'reference'
    ? `/images/fullscreen/${id}.png`
    : `/images/fullscreen/${variant}/${id}.png`;
}

/** The camera's registered 3:2 aperture follows the complete artwork. */
export function frameLayout(width, height, artworkAspect = FULLSCREEN_REFERENCE_ASPECT) {
  const padding = Math.max(24, Math.min(48, width * .022));
  const artworkWidth = Math.min(width, height * artworkAspect);
  const artworkHeight = artworkWidth / artworkAspect;
  const frameHeight = artworkHeight;
  const frameWidth = frameHeight * 1.5;
  const studyWidth = Math.min(width * .62, (height - 148) * width / height);
  const studyHeight = studyWidth * height / width;
  const navWidth = Math.min(900, studyWidth);
  return {
    viewportWidth: width, viewportHeight: height,
    artworkWidth, artworkHeight,
    artworkX: (width - artworkWidth) / 2,
    artworkY: (height - artworkHeight) / 2,
    width: frameWidth, height: frameHeight,
    homeX: (width - frameWidth) / 2,
    homeY: (height - frameHeight) / 2,
    studyX: 0, studyY: 0, studyWidth, studyHeight,
    studyScale: studyWidth / width,
    textX: studyWidth + padding,
    textY: 72,
    textWidth: width - studyWidth - padding * 2,
    textHeight: height - 96,
    navWidth, homeNavX: (width - navWidth) / 2,
    studyNavX: (studyWidth - navWidth) / 2,
    padding,
  };
}
