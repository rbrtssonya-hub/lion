import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { media } from '../../config/media.js';
import './surprise-lion.css';

// Original photograph coordinates, 1254 × 1254. The moving pieces retain the
// photograph's pixels; generated underpaint appears only in the revealed gaps.
const parts = [
  { name: 'eye-left', origin: '431px 524px', delay: 80, duration: 640,
    path: 'M369 387 C333 417 308 465 296 517 C287 548 281 577 293 594 C309 614 350 612 390 603 L508 575 C521 563 522 541 511 518 C486 463 430 418 369 387 Z',
    peak: 'translateY(-2px) scale(1.035, 1.065)' },
  { name: 'eye-right', origin: '889px 524px', delay: 80, duration: 640,
    path: 'M948 386 C981 423 1002 474 1013 527 C1022 559 1029 584 1014 598 C997 615 958 610 918 599 L837 577 C823 568 822 548 831 525 C854 470 898 420 948 386 Z',
    peak: 'translateY(-2px) scale(1.035, 1.065)' },
  { name: 'jaw', origin: '673px 849px', delay: 160, duration: 560,
    path: 'M674 786 C624 786 581 796 545 817 C515 833 491 845 468 850 C453 859 447 874 449 890 C457 931 491 963 542 981 C579 994 621 999 669 999 C753 1000 833 978 876 929 C899 902 907 869 895 843 C870 838 841 828 808 812 C767 792 719 785 674 786 Z',
    peak: 'translateY(18px) scaleY(1.035)' },
  { name: 'brow-left', origin: '385px 330px', delay: 0, duration: 720,
    path: 'M190 368 C192 313 229 264 284 235 C342 203 406 199 463 219 C514 237 548 277 564 328 C582 389 572 450 543 493 L510 537 C492 520 479 493 460 467 C438 438 409 420 379 411 C347 400 327 409 310 434 L291 468 C267 477 239 465 220 443 C201 422 193 395 190 368 Z',
    peak: 'translateY(-22px) rotate(-1.2deg)' },
  { name: 'brow-right', origin: '938px 330px', delay: 0, duration: 720,
    path: 'M761 361 C764 308 799 269 847 244 C901 217 964 214 1020 230 C1075 246 1102 284 1105 334 C1108 379 1086 422 1054 452 C1038 467 1016 475 999 459 L975 423 C961 403 942 393 923 402 C892 418 863 445 843 477 L817 523 C794 513 778 485 771 451 C765 423 760 391 761 361 Z',
    peak: 'translateY(-24px) rotate(1.1deg)' },
];

export default function SurpriseLion({ src, alt, revision, active }) {
  const prefix = `surprise-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
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
    const images = [src, media.expressionSurpriseUnderpaint].map(url => {
      const image = new Image();
      image.src = url;
      return image;
    });
    Promise.all(images.map(image => image.decode())).then(() => {
      if (!disposed) setReady(true);
    }).catch(() => { if (!disposed) setReady(false); });
    return () => { disposed = true; };
  }, [src]);

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
      { transform: part.peak, offset: .32 },
      { transform: part.peak, offset: .47, easing: 'cubic-bezier(.3,0,.3,1)' },
      { transform: 'none', offset: 1 },
    ], { duration: part.duration, delay: part.delay, fill: 'both' }));
    running.current = animations;
    Promise.all(animations.map(animation => animation.finished)).then(() => {
      if (running.current === animations) stop();
    }).catch(() => {});
    return stop;
  }, [revision, active, ready, stop]);

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
    <svg className="surprise-lion-rig" ref={svgRef} viewBox="0 0 1254 1254" preserveAspectRatio="xMidYMid meet"
      aria-hidden="true" focusable="false" data-ready={ready} data-playing="false">
      <defs>
        <filter id={`${prefix}-soft`} x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="1.3" /></filter>
        <mask id={`${prefix}-static`} maskUnits="userSpaceOnUse" x="0" y="0" width="1254" height="1254" style={{ maskType: 'luminance' }}>
          <rect width="1254" height="1254" fill="white" />
          <g fill="black" filter={`url(#${prefix}-soft)`}>{parts.map(part => <path d={part.path} key={part.name} />)}</g>
        </mask>
        <clipPath id={`${prefix}-windows`}>{parts.map(part => <path d={part.path} key={part.name} />)}</clipPath>
        {parts.map(part => <mask key={part.name} id={`${prefix}-${part.name}`} maskUnits="userSpaceOnUse" x="0" y="0" width="1254" height="1254">
          <path d={part.path} fill="white" filter={`url(#${prefix}-soft)`} />
        </mask>)}
        <clipPath id={`${prefix}-pompoms`}><circle cx="551" cy="250" r="50" /><circle cx="800" cy="248" r="54" /><circle cx="563" cy="530" r="61" /><circle cx="783" cy="529" r="61" /><circle cx="672" cy="573" r="66" /></clipPath>
      </defs>
      <image href={media.expressionSurpriseUnderpaint} width="1254" height="1254" clipPath={`url(#${prefix}-windows)`} />
      <image href={src} width="1254" height="1254" mask={`url(#${prefix}-static)`} />
      {parts.map(part => <g key={part.name} data-face-part={part.name} style={{ transformOrigin: part.origin }}>
        <image href={src} width="1254" height="1254" mask={`url(#${prefix}-${part.name})`} />
      </g>)}
      <image href={src} width="1254" height="1254" clipPath={`url(#${prefix}-pompoms)`} />
    </svg>
  </>;
}
