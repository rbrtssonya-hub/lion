import { useEffect, useRef } from 'react';
import { media } from '../../config/media.js';

const completionMessage = 'nanfeng-entry-transition-complete';
const fallbackDuration = 30_000;

export default function EntryAnimationOverlay({ onComplete, onSkip }) {
  const frameRef = useRef(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const frameWindow = frameRef.current?.contentWindow;
    if (!frameWindow) return undefined;

    let active = true;
    const finish = () => {
      if (!active) return;
      active = false;
      window.removeEventListener('message', handleMessage);
      window.clearTimeout(fallbackTimer);
      onCompleteRef.current?.();
    };
    const handleMessage = event => {
      if (event.source !== frameWindow || event.origin !== window.location.origin || event.data?.type !== completionMessage) return;
      finish();
    };
    const fallbackTimer = window.setTimeout(finish, fallbackDuration);
    window.addEventListener('message', handleMessage);
    return () => {
      active = false;
      window.removeEventListener('message', handleMessage);
      window.clearTimeout(fallbackTimer);
    };
  }, []);

  return <div className="entry-transition-stage">
    <iframe ref={frameRef} id="entryTransitionFrame" title="醒狮入场动画" src={media.entryTransition} />
    <button id="skipIntro" className="entry-transition-skip" type="button" onClick={onSkip}>
      跳过动画 <span aria-hidden="true">→</span>
    </button>
  </div>;
}
