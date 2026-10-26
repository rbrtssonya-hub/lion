/** Full-screen viewing first; the complete 3:2 artwork then docks at the upper left. */
export function frameLayout(width, height) {
  const padding = Math.max(24, Math.min(48, width * .022));
  const frameWidth = Math.floor(Math.min(width, height * 1.5) / 3) * 3;
  const frameHeight = frameWidth / 1.5;
  const studyWidth = Math.floor(Math.min(width * .62, (height - 148) * 1.5) / 3) * 3;
  const studyHeight = studyWidth / 1.5;
  const navWidth = Math.min(900, studyWidth);
  return {
    width: frameWidth, height: frameHeight,
    homeX: (width - frameWidth) / 2,
    homeY: (height - frameHeight) / 2,
    studyX: 0, studyY: 0, studyWidth, studyHeight,
    studyScale: studyWidth / frameWidth,
    textX: studyWidth + padding,
    textY: 72,
    textWidth: width - studyWidth - padding * 2,
    textHeight: height - 96,
    navWidth, homeNavX: (width - navWidth) / 2,
    studyNavX: (studyWidth - navWidth) / 2,
    padding,
  };
}
