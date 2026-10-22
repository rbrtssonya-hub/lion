// Share the right-side advance area without loading the WebGL engine into the
// static gallery. Labels and the near/far scale remain decoration in both views.
export function cultureGalleryPointerBounds(container, canvas, event) {
  if (!canvas || event.clientX < 0 || event.clientX >= window.innerWidth ||
    event.clientY < 0 || event.clientY >= window.innerHeight ||
    document.elementFromPoint(event.clientX, event.clientY) !== canvas) return null;
  const bounds = canvas.getBoundingClientRect();
  if (!bounds.width || !bounds.height || event.clientX < bounds.left || event.clientX > bounds.right ||
    event.clientY < bounds.top || event.clientY > bounds.bottom) return null;
  for (const decoration of container.querySelectorAll('.culture-depth-label, .culture-depth-axis, [data-depth-decoration]')) {
    const box = decoration.getBoundingClientRect();
    if (event.clientX >= box.left && event.clientX <= box.right &&
      event.clientY >= box.top && event.clientY <= box.bottom) return null;
  }
  return bounds;
}

export function cultureGalleryRightSide(container, event, bounds) {
  if (!bounds) return false;
  // The existing accessible photo button describes the stable, unzoomed front
  // photograph. Use its right edge so gaps between rear images also advance.
  const photo = container.querySelector('.culture-depth-photo-action')?.getBoundingClientRect();
  return Boolean(photo?.width && event.clientX >= photo.right && event.clientX <= bounds.right);
}
