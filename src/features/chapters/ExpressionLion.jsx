import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { media } from '../../config/media.js';
import './surprise-lion.css';
import { faceProfiles } from './face-profiles/index.js';

// Original photograph coordinates, 1254 × 1254. The moving pieces retain the
// photograph's pixels; generated underpaint appears only in the revealed gaps.
const faceDuration = 3000;

export default function ExpressionLion({ expressionId = 'surprise', src, alt, revision, active }) {
  const profile = faceProfiles[expressionId];
  const parts = profile.parts;
  const underpaint = media[profile.underpaintKey];
  const timing = { peak: .1, hold: .42, relax: .56, second: .7, secondHold: .8, ...profile.timing };
  const prefix = `face-${expressionId}-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const imageRef = useRef(null);
  const svgRef = useRef(null);
  const running = useRef([]);
  const played = useRef(revision);
  const latestRevision = useRef(revision);
  latestRevision.current = revision;
  const [ready, setReady] = useState(false);
  const stop = useCallback(() => {
    for (const animation of running.current) animation.cancel();
    running.current = [];
    svgRef.current?.setAttribute('data-playing', 'false');
    imageRef.current?.style.removeProperty('opacity');
  }, []);

  useEffect(() => {
    let disposed = false;
    setReady(false);
    const images = [src, underpaint].map(url => {
      const image = new Image();
      image.src = url;
      return image;
    });
    Promise.all(images.map(image => image.decode())).then(() => {
      if (!disposed) setReady(true);
    }).catch(() => { if (!disposed) setReady(false); });
    return () => { disposed = true; };
  }, [src, underpaint]);

  useLayoutEffect(() => {
    stop();
    if (!active || matchMedia('(prefers-reduced-motion: reduce)').matches || document.hidden) {
      played.current = revision;
      return;
    }
    if (!ready || played.current === revision) return;
    played.current = revision;
    const svg = svgRef.current;
    imageRef.current.style.opacity = '0';
    svg.setAttribute('data-playing', 'true');
    const animations = parts.map(part => svg.querySelector(`[data-face-part="${part.name}"]`).animate([
      { transform: 'none', offset: 0, easing: 'cubic-bezier(.22,.65,.3,1)' },
      { transform: part.peak, offset: timing.peak },
      { transform: part.peak, offset: timing.hold, easing: 'cubic-bezier(.3,0,.3,1)' },
      { transform: part.relaxed, offset: timing.relax, easing: 'cubic-bezier(.22,.65,.3,1)' },
      { transform: part.peak, offset: timing.second },
      { transform: part.peak, offset: timing.secondHold, easing: 'cubic-bezier(.3,0,.3,1)' },
      { transform: 'none', offset: 1 },
    ], { duration: faceDuration - part.delay, delay: part.delay, fill: 'both' }));
    running.current = animations;
    Promise.all(animations.map(animation => animation.finished)).then(() => {
      if (running.current === animations) stop();
    }).catch(() => {});
    return stop;
  }, [revision, active, ready, stop, profile]);

  useEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const changePreference = () => { if (preference.matches) { played.current = latestRevision.current; stop(); } };
    const hide = () => { if (document.hidden) { played.current = latestRevision.current; stop(); } };
    preference.addEventListener('change', changePreference);
    document.addEventListener('visibilitychange', hide);
    return () => {
      preference.removeEventListener('change', changePreference);
      document.removeEventListener('visibilitychange', hide);
      stop();
    };
  }, [stop]);

  return <>
    <img className="expression-lion-image" id="expressionLion" ref={imageRef} src={src} alt={alt} draggable="false" />
    <svg className={`expression-face-rig${expressionId === 'surprise' ? ' surprise-lion-rig' : ''}`} data-expression-id={expressionId} ref={svgRef} viewBox="0 0 1254 1254" preserveAspectRatio="xMidYMid meet"
      aria-hidden="true" focusable="false" data-ready={ready} data-playing="false">
      <defs>
        <filter id={`${prefix}-soft`} x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="1.3" /></filter>
        <mask id={`${prefix}-static`} maskUnits="userSpaceOnUse" x="0" y="0" width="1254" height="1254" style={{ maskType: 'luminance' }}>
          <rect width="1254" height="1254" fill="white" />
          <g fill="black" filter={`url(#${prefix}-soft)`}>{parts.map(part => <path d={part.path} key={part.name} />)}</g>
        </mask>
        {/* Back the entire feathered edge, including the pixels outside the
            original contour, so the page never leaks through as a pale seam. */}
        <mask id={`${prefix}-windows`} maskUnits="userSpaceOnUse" x="0" y="0" width="1254" height="1254">
          <g fill="white" stroke="white" strokeWidth="8" strokeLinejoin="round">{parts.map(part => <path d={part.path} key={part.name} />)}</g>
        </mask>
        {parts.map(part => <mask key={part.name} id={`${prefix}-${part.name}`} maskUnits="userSpaceOnUse" x="0" y="0" width="1254" height="1254">
          <path d={part.path} fill="white" filter={`url(#${prefix}-soft)`} />
        </mask>)}
        <clipPath id={`${prefix}-pompoms`}>
          {(profile.foreground ?? []).map((circle, index) => <circle key={`circle-${index}`} {...circle} />)}
          {(profile.foregroundPaths ?? []).map((path, index) => <path key={`path-${index}`} d={path} />)}
        </clipPath>
      </defs>
      <image href={underpaint} width="1254" height="1254" mask={`url(#${prefix}-windows)`} />
      <image href={src} width="1254" height="1254" mask={`url(#${prefix}-static)`} />
      {parts.map(part => <g key={part.name} data-face-part={part.name} style={{ transformOrigin: part.origin }}>
        <image href={src} width="1254" height="1254" mask={`url(#${prefix}-${part.name})`} />
      </g>)}
      <image href={src} width="1254" height="1254" clipPath={`url(#${prefix}-pompoms)`} />
    </svg>
  </>;
}
