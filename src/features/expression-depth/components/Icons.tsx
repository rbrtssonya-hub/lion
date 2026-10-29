export function Arrow({ diagonal = false, className = '' }: { diagonal?: boolean; className?: string }) {
  return <svg aria-hidden="true" className={className} width="24" height="24" viewBox="0 0 24 24" fill="none">
    {diagonal ? <path d="M5 19 19 5M5 5h14v14" stroke="currentColor" strokeWidth="1.25" /> : <path d="M4 12h15m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.25" />}
  </svg>
}

export function Asterisk({ className = '' }: { className?: string }) {
  return <svg aria-hidden="true" className={className} width="48" height="48" viewBox="0 0 48 48" fill="none">
    <path d="M24 3v42M3 24h42M9.15 9.15l29.7 29.7m0-29.7-29.7 29.7" stroke="currentColor" strokeWidth="2" />
  </svg>
}

// Linework inspired by a lion head's brow, forehead mirror and open mouth.
export function LionEmblem({ className = '' }: { className?: string }) {
  return <svg aria-hidden="true" className={className} viewBox="0 0 64 64" fill="none">
    <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 13c-4-7-11-5-12 0-6 0-8 6-5 10-3 6-1 13 4 16 0 10 8 17 23 20 15-3 23-10 23-20 5-3 7-10 4-16 3-4 1-10-5-10-1-5-8-7-12 0" />
      <path d="M24 10 28 4l4 4 4-4 4 6M17 20c5-3 10-2 12 3M47 20c-5-3-10-2-12 3M12 28c3-6 11-7 16-1-3 8-12 10-16 1Zm40 0c-3-6-11-7-16-1 3 8 12 10 16 1Z" />
      <circle cx="32" cy="17" r="5" /><circle cx="21" cy="28" r="3" /><circle cx="43" cy="28" r="3" />
      <path d="M27 35c0-4 10-4 10 0-1 4-9 4-10 0ZM11 39c7-6 14-5 21 0 7-5 14-6 21 0M18 42c3 11 25 11 28 0M23 44l2 5m7-4v6m9-7-2 5M16 49l-3 3m35-3 3 3M27 55l5 4 5-4" />
    </g>
  </svg>
}

export function CloudScroll({ className = '' }: { className?: string }) {
  return <svg aria-hidden="true" className={className} viewBox="0 0 90 42" fill="none">
    <path d="M5 33h57c15 0 22-4 22-10 0-7-9-11-14-6 4-13-14-18-18-7-7-8-21-2-18 7-12-4-19 7-13 13M36 21c-8-5-2-15 5-10m17 15c-9 2-14-7-8-12m19 13c-2-6 5-9 9-5M7 37h73" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
}
