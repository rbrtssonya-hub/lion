import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// The outgoing words are a short-lived, inert picture of the old reading layout.
// Inline computed styles let it keep its old layout without duplicate IDs, CSS
// selectors or accessible content after React has rendered the new explanation.
function snapshotCopy(panel) {
  const source = panel.querySelector('.expression-copy-content');
  const copy = source.cloneNode(true);
  const sources = [source, ...source.querySelectorAll('*')];
  const copies = [copy, ...copy.querySelectorAll('*')];
  let character;
  sources.forEach((element, index) => {
    const clone = copies[index];
    const style = getComputedStyle(element);
    for (const property of style) clone.style.setProperty(property, style.getPropertyValue(property));
    for (const attribute of [...clone.attributes]) {
      if (attribute.name !== 'style' && attribute.name !== 'src' && attribute.name !== 'viewBox'
        && !['d', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'opacity'].includes(attribute.name)) {
        clone.removeAttribute(attribute.name);
      }
    }
    clone.style.animation = 'none';
    clone.style.transition = 'none';
    if (element.id === 'expressionStateTitle') character = clone;
  });
  const panelBox = panel.getBoundingClientRect();
  const contentBox = source.getBoundingClientRect();
  const layer = document.createElement('div');
  layer.dataset.expressionGhost = 'true';
  layer.setAttribute('aria-hidden', 'true');
  layer.inert = true;
  Object.assign(layer.style, {
    position: 'fixed', left: `${panelBox.left}px`, top: `${panelBox.top}px`,
    width: `${panelBox.width}px`, height: `${panelBox.height}px`,
    overflow: 'hidden', pointerEvents: 'none', zIndex: '8',
  });
  Object.assign(copy.style, {
    position: 'absolute', left: `${contentBox.left - panelBox.left}px`, top: `${contentBox.top - panelBox.top}px`,
    margin: '0', width: `${contentBox.width}px`, height: `${contentBox.height}px`,
  });
  layer.append(copy);
  return { layer, character };
}

export default function useExpressionMotion(panelRef, characterRef, expressionId, viewMode, comparing) {
  const pending = useRef(null);
  const running = useRef(new Map());
  const ghost = useRef(null);
  const currentId = useRef(expressionId);

  const stop = useCallback(() => {
    for (const [element, animation] of running.current) {
      animation.onfinish = null;
      animation.cancel();
      element.style.removeProperty('will-change');
    }
    running.current.clear();
    ghost.current?.remove();
    ghost.current = null;
    if (panelRef.current) panelRef.current.dataset.motion = 'idle';
  }, [panelRef]);

  const reset = useCallback(() => { pending.current = null; stop(); }, [stop]);
  const capture = useCallback(() => {
    const panel = panelRef.current;
    const character = characterRef.current;
    if (!panel || !character || !panel.getClientRects().length || reduceMotion()) { reset(); return; }
    // Includes the current animated rectangle when the reader reverses mid-flight.
    pending.current = {
      id: currentId.current, rect: character.getBoundingClientRect(),
      opacity: getComputedStyle(character).opacity, ...snapshotCopy(panel),
    };
  }, [panelRef, characterRef, reset]);

  useLayoutEffect(() => {
    const previous = pending.current;
    pending.current = null;
    currentId.current = expressionId;
    stop();
    const panel = panelRef.current;
    const character = characterRef.current;
    if (!previous || comparing || reduceMotion() || !panel || !character) return;

    panel.dataset.motion = 'running';
    const animate = (element, frames, options) => {
      element.style.willChange = 'transform, opacity';
      const animation = element.animate(frames, { fill: 'both', ...options });
      running.current.set(element, animation);
      animation.finished.catch(() => {});
      animation.onfinish = () => {
        if (running.current.get(element) !== animation) return;
        running.current.delete(element);
        animation.onfinish = null;
        animation.cancel();
        element.style.removeProperty('will-change');
        if (element === ghost.current) { ghost.current.remove(); ghost.current = null; }
        if (!running.current.size && panel.isConnected) panel.dataset.motion = 'idle';
      };
    };

    const sameExpression = previous.id === expressionId;
    if (sameExpression && previous.character) previous.character.style.opacity = '0';
    ghost.current = previous.layer;
    document.body.append(previous.layer);
    animate(previous.layer, [
      { opacity: 1, transform: 'translateY(0)' },
      { opacity: 0, transform: 'translateY(-8px)' },
    ], { duration: 160, easing: 'ease-out' });

    const target = character.getBoundingClientRect();
    if (target.width && target.height && previous.rect.width && previous.rect.height) {
      const dx = previous.rect.left - target.left;
      const dy = previous.rect.top - target.top;
      const sx = previous.rect.width / target.width;
      const sy = previous.rect.height / target.height;
      animate(character, [
        { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, opacity: sameExpression ? previous.opacity : 0, transformOrigin: '0 0' },
        { transform: 'translate(0, 0) scale(1)', opacity: 1, transformOrigin: '0 0' },
      ], { duration: 580, easing: 'cubic-bezier(.22, 1, .36, 1)' });
    }

    const shrinkingTitle = sameExpression && previous.rect.width > target.width * 1.2;
    const detailDelays = [85, 220, 260, 285, 320, 355, 390];
    for (const [index, element] of [...panel.querySelectorAll('[data-expression-reveal]')].entries()) {
      animate(element, [
        { opacity: 0, transform: 'translateY(14px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ], { duration: 350, delay: shrinkingTitle ? detailDelays[Math.min(index, 6)] : 85 + Math.min(index, 6) * 38,
        easing: 'cubic-bezier(.22, 1, .36, 1)' });
    }
  }, [expressionId, viewMode, comparing, panelRef, characterRef, stop]);

  useLayoutEffect(() => reset, [reset]);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onPreference = () => { if (preference.matches) reset(); };
    preference.addEventListener('change', onPreference);
    return () => { reset(); preference.removeEventListener('change', onPreference); };
  }, [reset]);

  return { capture, reset };
}
