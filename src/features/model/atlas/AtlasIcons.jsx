const paths = {
  ArrowLeft: <><path d="m12 19-7-7 7-7"/><path d="M5 12h14"/></>,
  RotateCcw: <><path d="M3 11a9 9 0 1 1 2.6 6.4"/><path d="M3 4v7h7"/></>,
  ArrowUpRight: <><path d="M7 17 17 7M7 7h10v10"/></>,
  X: <path d="m18 6-12 12M6 6l12 12"/>,
};
const icon = name => function Icon({ size = 24, strokeWidth = 2, ...props }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>;
};
export const ArrowLeft = icon('ArrowLeft');
export const RotateCcw = icon('RotateCcw');
export const ArrowUpRight = icon('ArrowUpRight');
export const X = icon('X');
