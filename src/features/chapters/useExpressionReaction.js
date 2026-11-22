import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

// One short gesture per illustration; the separate outer layer keeps the
// existing state crossfade and the configurable click enlargement independent.
const reactions = {
  joy: { duration: 640, poses: [
    { transform: 'translateY(-10px) rotate(-.6deg) scale(1.006)', offset: .45 },
  ] },
  anger: { duration: 430, poses: [
    { transform: 'translateY(3px) rotate(-2deg) scale(1.035)', offset: .24 },
    { transform: 'translateY(3px) rotate(-2deg) scale(1.035)', offset: .4 },
  ] },
  sorrow: { duration: 900, poses: [
    { transform: 'translateY(12px) rotate(1.4deg) scale(.992)', offset: .62 },
  ] },
  delight: { duration: 620, poses: [
    { transform: 'translateY(2.5px) scale(.99)', offset: .16 },
    { transform: 'translateY(-14px) rotate(1.1deg) scale(1.008)', offset: .48 },
    { transform: 'translateY(2px) scale(1.005)', offset: .75 },
  ] },
  motion: { duration: 660, poses: [
    { transform: 'translate(9px, -3px) rotate(2.4deg)', offset: .34 },
    { transform: 'translate(-4px, 1px) rotate(-1deg)', offset: .66 },
  ] },
  stillness: { duration: 880, poses: [
    { transform: 'translateY(-.8px) scale(1.008)', offset: .5 },
  ] },
  surprise: { duration: 500, poses: [
    { transform: 'translate(-3px, -9px) rotate(-1.2deg) scale(.975)', offset: .22 },
    { transform: 'translate(-3px, -9px) rotate(-1.2deg) scale(.975)', offset: .38 },
    { transform: 'translateY(1px) scale(1.005)', offset: .68 },
  ] },
  doubt: { duration: 780, poses: [
    { transform: 'translate(4px, -1px) rotate(4deg)', offset: .32 },
    { transform: 'translate(4px, -1px) rotate(4deg)', offset: .48 },
    { transform: 'translateX(-1px) rotate(-1.2deg)', offset: .72 },
  ] },
};

export default function useExpressionReaction(triggerRef, expressionId, revision, comparing) {
  const running = useRef(null);
  const playedRevision = useRef(0);
  const stop = useCallback(() => {
    const animation = running.current;
    if (!animation) return;
    animation.onfinish = null;
    animation.cancel();
    animation.effect.target.style.removeProperty('will-change');
    running.current = null;
  }, []);

  useLayoutEffect(() => {
    stop();
    if (playedRevision.current === revision) return;
    playedRevision.current = revision;
    const pose = triggerRef.current?.querySelector('.expression-lion-layer.is-current .expression-lion-pose');
    if (!pose || comparing || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const { duration, poses } = reactions[expressionId];
    // Let the existing image entrance settle so it cannot swallow or reverse
    // the gesture. Replaying the current state has no entrance to wait for.
    const delay = Math.max(0, ...pose.parentElement.getAnimations().filter(animation => animation.playState === 'running')
      .map(animation => Number(animation.effect.getComputedTiming().endTime) - Number(animation.currentTime)));
    pose.style.willChange = 'transform';
    const animation = pose.animate([
      { transform: 'none', offset: 0 }, ...poses, { transform: 'none', offset: 1 },
    ], { duration, delay, easing: 'ease-in-out', iterations: 1 });
    running.current = animation;
    animation.finished.catch(() => {});
    animation.onfinish = () => { if (running.current === animation) stop(); };
    return stop;
  }, [triggerRef, expressionId, revision, comparing, stop]);

  useEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const onPreference = () => { if (preference.matches) stop(); };
    preference.addEventListener('change', onPreference);
    return () => { stop(); preference.removeEventListener('change', onPreference); };
  }, [stop]);

  return stop;
}
