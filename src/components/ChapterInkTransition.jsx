import { useId } from 'react';
import '../styles/chapter-ink-transition.css';

// Both edges stay outside the viewBox at the chapter swap. The existing hook
// owns all timing and cancellation; this layer never keeps a scene mounted.
const leftEdge = 'M-82-40 C-99 9-20 35-66 72 L-43 88-88 97 C-121 147-31 173-73 218 L-45 232-91 246 C-123 280-38 316-79 352 L-54 369-111 387 C-130 431-37 458-78 503 L-47 520-94 538 C-126 579-35 608-74 648 L-48 666-103 685 C-124 727-28 755-69 793 L-41 810-92 829 C-125 871-51 903-80 940';
const rightEdge = 'M1678-40 C1704 13 1613 42 1666 80 L1637 96 1692 112 C1720 154 1618 181 1665 220 L1639 239 1695 257 C1718 301 1610 335 1663 372 L1630 391 1682 409 C1714 449 1615 485 1662 527 L1638 544 1698 560 C1720 607 1613 637 1665 680 L1636 696 1690 714 C1719 760 1614 786 1666 829 L1639 847 1692 864 C1717 906 1643 923 1678 940';

export default function ChapterInkTransition({ phase }) {
  const id = useId();
  if (phase === 'idle') return null;
  const body = `${leftEdge} L1575 940 L1575-40Z ${rightEdge} L1575 940 L1575-40Z`;
  const outline = `${id}-outline`;
  const brush = `${id}-brush`;
  const color = `${id}-color`;
  const grain = `${id}-grain`;
  const texture = `${id}-texture`;

  return <div className="chapter-ink-transition" data-phase={phase} aria-hidden="true">
    <svg viewBox="0 0 1600 900" preserveAspectRatio="none" focusable="false">
      <defs>
        <linearGradient id={color} x1="0" y1="0" x2="1" y2=".2">
          <stop stopColor="#8d241c" />
          <stop offset=".4" stopColor="#b63827" />
          <stop offset="1" stopColor="#a42c20" />
        </linearGradient>
        <filter id={brush} x="-240" y="-70" width="2080" height="1040" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency=".018 .08" numOctaves="2" seed="9" result="edge" />
          <feDisplacementMap in="SourceGraphic" in2="edge" scale="16" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id={grain} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency=".52 .72" numOctaves="2" seed="8" stitchTiles="stitch" />
          <feColorMatrix type="matrix" values="0 0 0 0 .94  0 0 0 0 .71  0 0 0 0 .47  .16 0 0 0 0" />
        </filter>
        <pattern id={texture} width="256" height="256" patternUnits="userSpaceOnUse">
          <rect width="256" height="256" filter={`url(#${grain})`} />
        </pattern>
        <path id={outline} d={body} />
      </defs>
      <g className="chapter-ink-transition__sweep">
        <g filter={`url(#${brush})`}>
          <use href={`#${outline}`} fill={`url(#${color})`} />
          <use href={`#${outline}`} fill={`url(#${texture})`} />
          <path className="chapter-ink-transition__grain-strokes" d="M-60 128Q540 92 1680 142 M-70 329Q710 355 1690 292 M-80 611Q640 557 1690 596 M-70 797Q790 833 1690 774" />
          <path className="chapter-ink-transition__gold" d={leftEdge} />
          <path className="chapter-ink-transition__gold" d={rightEdge} />
          <path className="chapter-ink-transition__dry-edge" d="M-43 95L-56 136 M-51 268L-66 300 M-56 419L-40 446 M-49 558L-64 594 M-48 708L-35 741 M-44 852L-62 891" />
        </g>
      </g>
    </svg>
  </div>;
}
