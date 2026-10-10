import { useId } from 'react';

export default function EntryLionEmblem() {
  const artworkId = useId().replaceAll(':', '');
  const paint = (name) => `url(#${artworkId}-${name})`;

  return <svg className="entry-lion-emblem" viewBox="0 0 166 140" fill="none" aria-hidden="true" focusable="false" strokeLinecap="round" strokeLinejoin="round">
    <defs>
      <linearGradient id={`${artworkId}-red`} x1="56" y1="15" x2="127" y2="110" gradientUnits="userSpaceOnUse">
        <stop stopColor="#ff6137" /><stop offset=".43" stopColor="#cf231a" /><stop offset="1" stopColor="#8e100e" />
      </linearGradient>
      <linearGradient id={`${artworkId}-gold`} x1="69" y1="15" x2="109" y2="114" gradientUnits="userSpaceOnUse">
        <stop stopColor="#fff0b3" /><stop offset=".48" stopColor="#e9b968" /><stop offset="1" stopColor="#ffdda0" />
      </linearGradient>
      <linearGradient id={`${artworkId}-ivory`} x1="76" y1="63" x2="96" y2="123" gradientUnits="userSpaceOnUse">
        <stop stopColor="#fffbed" /><stop offset="1" stopColor="#efd2a8" />
      </linearGradient>
      <radialGradient id={`${artworkId}-mirror`} cx=".35" cy=".26" r=".76">
        <stop stopColor="#fffdf0" /><stop offset=".32" stopColor="#ffdca0" /><stop offset=".69" stopColor="#be7834" /><stop offset="1" stopColor="#542519" />
      </radialGradient>
      <radialGradient id={`${artworkId}-eye`} cx=".34" cy=".25" r=".76">
        <stop stopColor="#4f7269" /><stop offset=".34" stopColor="#183c35" /><stop offset=".63" stopColor="#111c19" /><stop offset="1" stopColor="#080c0b" />
      </radialGradient>
    </defs>

    <g stroke="#e9b96c" strokeWidth="1.8">
      <path d="M57 111H31c-6 0-10-3-10-8-10 2-16-2-16-8 0-5 4-8 9-8-3-7 2-14 9-14 4-11 17-13 23-5 8-2 15 4 14 12 11 2 14 13 8 20Z" fill="#b41d16" />
      <path d="M26 103c-8 0-10-7-5-11 4-3 10-1 10 4m-14-10c6-4 15-1 15 6m-5-20c-3 6 0 13 6 14 8 1 11-7 6-11-3-2-7-1-7 3m13-9c-2 5 2 8 6 8m-17 27h17" stroke="#f9d994" strokeWidth="1.5" />
      <path d="M5 92 1 91m14 11-9 2m45 9 8 3" stroke="#f9d994" />
      <path d="M135 85c8-8 19-5 21 2 8-2 13 6 9 11-2 3-7 3-10 1-2 9-16 12-24 7l-6-12Z" fill="#b51f16" />
      <path d="M145 87c-5 1-7 7-3 10 4 3 9 0 7-4m6 6c-7-3-14 0-14 5" stroke="#f5d28b" strokeWidth="1.5" />
    </g>

    <g transform="rotate(-8 96 69)">
      <path d="m51 48-6-7 6-3-4-8 10-1-1-9 10 3 3-10 9 7 7-9 7 10 10-7 4 11 10-4 1 10 11-1-3 10 10 3-7 9 10 7-8 7 8 8-10 5 4 10-10 3-2 10-10-2-5 9-8-6-9 6-6-9-10 1-1-9-10-3 4-9-10-5 7-9-8-7 7-7Z" fill="#8c160f" stroke="#f6ce86" strokeWidth="2.6" />
      <path d="M57 43c-9-5-14-17-9-23 4-6 14-2 17 6l3 12Zm61-11c-1-12 5-21 12-19 9 3 7 18 2 26Z" fill={paint('ivory')} stroke="#a92716" strokeWidth="2.7" />
      <path d="M57 37c-6-5-8-11-5-13 3-2 9 2 11 8m61-2c0-7 3-12 6-11 3 2 1 9-2 13" stroke="#d93322" strokeWidth="4.6" />
      <path d="M55 51c-5-18 13-31 28-30 10-7 20-4 26 4 18-2 30 10 26 27 8 11 9 23 1 33-2 16-17 27-36 27-23 0-43-9-48-25-8-11-8-25 3-36Z" fill={paint('red')} stroke="#ffd999" strokeWidth="2.3" />

      <g stroke="#ff7b4d" strokeWidth="1.6">
        <path d="m55 48-5-3m10-8-4-5m11-1-3-6m16 4-2-5m30 5 2-5m8 11 5-3m0 12 6-2m-78 30-6-2m4 12-7 1m14 10-4 6m70-21 7-2m-9 12 6 3m-16 8 3 5" />
        <path d="M64 26c5 2 8 6 8 10m42-8c-5 2-8 6-7 10M49 59c2 3 3 8 2 12m85-15c-3 5-3 11-2 16" />
      </g>

      <path d="M84 24c-2-7 0-13 5-15l4 7 4-9 5 8 6-5c4 5 4 11 0 17" fill="#dc3522" stroke="#ffe0a1" strokeWidth="1.7" />
      <path d="m88 24 8-8 10 9" stroke="#fff2bb" strokeWidth="1.3" />
      <path d="M90 28c-12-3-19 3-23 11m39-10c11-4 18 0 21 8" stroke="#fff0b6" strokeWidth="2" />
      <path d="M75 37c-6 0-10 4-9 8 1 5 8 5 9 1m43-10c6-2 10 1 10 5 0 4-5 6-7 3" stroke="#f4c472" strokeWidth="1.7" />
      <path d="m89 35 7-13 10 13-4 13-9 1Z" fill="#276553" stroke="#f6d08a" strokeWidth="1.5" />
      <circle cx="98" cy="34" r="12.1" fill="#9b3720" stroke="#fbd699" strokeWidth="2.6" />
      <circle cx="98" cy="34" r="8.4" fill={paint('mirror')} stroke="#ffedb4" strokeWidth="1.2" />
      <path d="M92 32c0-4 4-6 7-5m-8 10c2 3 5 4 8 4" stroke="#fff9e2" strokeWidth="1.7" />
      <circle cx="97" cy="19.4" r="1.9" fill="#fff0b5" /><circle cx="111.8" cy="33.1" r="1.6" fill="#fff0b5" /><circle cx="83.9" cy="35" r="1.6" fill="#fff0b5" />

      <g transform="rotate(-15 73 59)">
        <ellipse cx="73" cy="59" rx="22" ry="24" fill="#721e15" stroke="#ffe1a1" strokeWidth="2.2" />
        <ellipse cx="73" cy="59" rx="18.6" ry="20.9" fill={paint('ivory')} stroke="#c77b3b" strokeWidth="1.2" />
        <ellipse cx="76" cy="61" rx="12.8" ry="14.1" fill={paint('eye')} stroke="#a8b59a" strokeWidth="1.7" />
        <ellipse cx="78.5" cy="61.9" rx="7.4" ry="9.3" fill="#070c0b" />
        <ellipse cx="72.7" cy="54.1" rx="4.5" ry="5.4" fill="#fffef2" />
        <circle cx="82.2" cy="66" r="2.2" fill="#fffcef" />
        <path d="M62 64c0 5 3 9 7 10" stroke="#f9fbda" strokeWidth="1.2" />
      </g>
      <g transform="rotate(12 119 55)">
        <ellipse cx="119" cy="55" rx="19.7" ry="22" fill="#731c14" stroke="#ffe1a1" strokeWidth="2.2" />
        <ellipse cx="119" cy="55" rx="16.4" ry="18.8" fill={paint('ivory')} stroke="#c77b3b" strokeWidth="1.2" />
        <ellipse cx="117" cy="57" rx="11.5" ry="12.9" fill={paint('eye')} stroke="#a8b59a" strokeWidth="1.6" />
        <ellipse cx="118.9" cy="58" rx="6.7" ry="8.4" fill="#070c0b" />
        <ellipse cx="112.9" cy="50.9" rx="3.8" ry="4.9" fill="#fffef2" />
        <circle cx="122" cy="61.8" r="1.9" fill="#fffcef" />
        <path d="M126 57c1 4-1 8-4 10" stroke="#f9fbda" strokeWidth="1.2" />
      </g>

      <path d="M50 49c0-8 6-14 14-15l-1 4 6-5 1 4 7-4-1 5 6-1-3 5c-10-3-19 2-24 10Z" fill="#fff5dd" stroke="#be6d31" strokeWidth="1.1" />
      <path d="M109 37c6-9 17-9 23-4l-4 2 6 2-4 3 7 2-4 3c-7-6-15-7-23-3Z" fill="#fff5dd" stroke="#be6d31" strokeWidth="1.1" />
      <path d="M54 42c3-3 8-5 11-5m48 1c5-4 10-4 14-1" stroke="#fffef0" strokeWidth="1.7" />

      <path d="M48 71c-5 7-1 17 7 19 8 2 12-4 9-9-2-4-7-3-7 0 0 2 2 3 3 2m76-16c6 4 6 11 1 16-4 4-9 1-8-3 1-3 5-3 5 0" stroke="#fff0ce" strokeWidth="5" />
      <path d="M46 71c-2 7 1 14 7 16m86-20c4 6 3 11-1 15" stroke="#e49f58" strokeWidth="1.2" />
      <path d="M68 92c-1 8 1 18 8 25l3-4 4 8 5-4 5 10 4-5 6 7 4-7 6 4 1-7 7 1-2-7 7-3-6-9Z" fill={paint('ivory')} stroke="#c78349" strokeWidth="1.2" />
      <path d="m80 103 6 14m8-12 3 15m11-16-2 14m13-17-7 12" stroke="#fffbed" strokeWidth="2.4" />

      <path d="M66 81c-8-1-12 6-9 13 4 10 13 14 24 12 13 9 35 6 46-7 11-3 14-12 7-18-7-5-16-5-22-1-9-5-21-5-29 0-6-4-12-3-17 1Z" fill={paint('ivory')} stroke="#9e5025" strokeWidth="1.7" />
      <path d="M65 91c17 5 41 5 60-3-1 10-15 17-31 16-12 0-23-5-29-13Z" fill="#4c1b16" stroke="#bb5b2d" strokeWidth="1.4" />
      <path d="M72 94c14 3 32 2 46-2l-3 5-7 2-1-4-1 5-7 1-1-5-2 5-7-1-1-5-1 4-8-2Z" fill="#fffce8" stroke="#dfbf8f" strokeWidth=".7" />
      <path d="M80 101c9 3 21 3 30-1" stroke="#e46549" strokeWidth="2.8" />
      <path d="M60 90c1 7 7 12 13 12m53-17c7-1 10 4 6 8" stroke="#fffbed" strokeWidth="2.3" />
      <path d="M76 88c-9 5-16-2-11-7 3-3 9-2 11 2m42 3c7 3 13-3 9-7-3-3-7-1-7 2" stroke="#bb6832" strokeWidth="1.3" />

      <path d="M82 75c7-8 23-8 31-2 4 4 0 12-6 15-9 5-23 3-28-4-3-4-2-7 3-9Z" fill="#cc2c1e" stroke="#f2bd6c" strokeWidth="2.2" />
      <path d="M84 76c6-3 15-4 22-1" stroke="#fff0bc" strokeWidth="2.7" />
      <path d="M84 82c-1-3 4-5 7-2m12-1c3-3 8-2 8 1" stroke="#591f16" strokeWidth="3.1" />
      <path d="M94 85c2 2 5 2 7 0" stroke="#ed6a43" strokeWidth="1.8" />

      <g fill="#fff0b6">
        <circle cx="49" cy="62" r="1.8" /><circle cx="143" cy="57" r="1.7" />
        <path d="m61 102 3 4-4 2-2-4Zm67-4 4-3 2 4-4 3Z" />
      </g>
    </g>
  </svg>;
}
