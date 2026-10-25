import { useEffect, useState } from 'react';
import { media } from '../../config/media.js';

const parts = [
  ['body', 'xiaoxingBody'], ['head', 'xiaoxingHead'],
  ['eye-left', 'xiaoxingLeftEye'], ['eye-right', 'xiaoxingRightEye'],
  ['brow-left', 'xiaoxingLeftBrow'], ['brow-right', 'xiaoxingRightBrow'],
  ['mouth-closed', 'xiaoxingMouthClosed'], ['mouth-smile', 'xiaoxingMouthSmile'], ['mouth-talk', 'xiaoxingMouthTalk'],
];

export default function XiaoxingAvatar({ state = 'idle', animated = true }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    if (parts.some(([, key]) => !media[key])) return undefined;
    Promise.all(parts.map(([, key]) => {
      const image = new Image(); image.src = media[key]; return image.decode();
    })).then(() => { if (active) setReady(true); }).catch(() => { if (active) setReady(false); });
    return () => { active = false; };
  }, []);
  return <span className="xiaoxing-avatar" data-state={state} data-animated={animated} data-layered={ready} aria-hidden="true">
    {!ready && media.xiaoxingReference && <img className="xiaoxing-avatar-reference" src={media.xiaoxingReference} alt="" draggable="false" />}
    {ready && <>
      <img className="xiaoxing-layer xiaoxing-layer--body" src={media.xiaoxingBody} alt="" draggable="false" />
      <span className="xiaoxing-head-group">{parts.filter(([part]) => part !== 'body').map(([part, key]) =>
        <img key={part} className={`xiaoxing-layer xiaoxing-layer--${part}`} src={media[key]} alt="" draggable="false" />)}</span>
    </>}
  </span>;
}
