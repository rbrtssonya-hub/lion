export default function ExpressionMotif({ kind = 'lion', className = '' }) {
  return <svg className={`expression-motif ${className}`} viewBox="0 0 56 56" fill="none" aria-hidden="true" focusable="false">
    {kind === 'drum' ? <>
      <ellipse cx="28" cy="19" rx="19" ry="8" /><path d="M9 19v18c0 11 38 11 38 0V19M12 30c9 6 23 6 32 0M17 27v14m11-12v16m11-18v14M5 5l16 9M51 5l-16 9" />
      <path d="m11 13 3-4m28 4-3-4M21 18c4 3 10 3 14 0" />
    </> : <>
      <path d="M13 19c-9-7-10 10-2 12M43 19c9-7 10 10 2 12M13 17c1-7 9-9 15-6 6-3 14-1 15 6l3 14-5 10-6 7-7-3-7 3-6-7-5-10 3-14Z" />
      <circle cx="28" cy="9" r="5" /><circle cx="28" cy="9" r="2" />
      <path d="M14 20c4-6 9-3 10 1M42 20c-4-6-9-3-10 1M14 25c2-6 9-5 10 0-2 5-9 5-10 0Zm28 0c-2-6-9-5-10 0 2 5 9 5 10 0ZM22 34c3-6 9-6 12 0M17 35c3 4 6 2 11 3 5-1 8 1 11-3M20 40c5 5 11 5 16 0M24 47l-1 4m5-6v8m4-6 1 4" />
      <circle cx="19" cy="24" r="1.5" /><circle cx="37" cy="24" r="1.5" />
    </>}
  </svg>;
}
