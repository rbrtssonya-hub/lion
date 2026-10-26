/** The live camera and every artwork always share one uncropped 3:2 viewport. */
export function frameLayout(width, height) {
  const padding = Math.max(28, Math.min(72, width * .035));
  const textWidth = Math.max(318, Math.min(455, width * .25));
  const bottom = 112;
  const availableHeight = Math.max(260, height - bottom - 115);
  const frameWidth = Math.floor(Math.max(300, Math.min(width - textWidth - padding * 3, availableHeight * 1.5)) / 3) * 3;
  const frameHeight = frameWidth / 1.5;
  const studyX = padding + Math.max(0, (width - textWidth - padding * 3 - frameWidth) / 2);
  return {
    width: frameWidth, height: frameHeight,
    homeX: (width - frameWidth) / 2,
    studyX,
    y: Math.max(57, (height - bottom - frameHeight) / 2),
    textX: studyX + frameWidth + padding,
    textWidth: Math.max(260, width - studyX - frameWidth - padding * 2),
    padding,
  };
}
