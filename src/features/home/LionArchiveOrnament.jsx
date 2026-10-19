import { media } from '../../config/media.js';

const ornaments = { peeking: 'archiveOrnamentPeeking', paw: 'archiveOrnamentPaw', tail: 'archiveOrnamentTail' };

export default function LionArchiveOrnament({ kind = 'tail' }) {
  return <span className="lion-archive-ornament" aria-hidden="true">
    <img src={media[ornaments[kind] || ornaments.tail]} alt="" width="48" height="48" loading="lazy" decoding="async" draggable="false" />
    <svg viewBox="0 0 86 42" fill="none" focusable="false">
      <path d="M3 32h58c14 0 17-18 4-20-1-11-19-14-25-4-12-3-21 6-17 15M23 23c-9-8-22-1-18 8M21 32c13 0 18-14 9-19M45 10c-12 0-15 14-5 17 7 2 15-5 10-10M62 21c-5-5-13-1-10 6M28 38h45M73 32h8" />
    </svg>
  </span>;
}
