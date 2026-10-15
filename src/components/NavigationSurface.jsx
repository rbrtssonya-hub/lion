export default function NavigationSurface() {
  return <span className="navigation-surface" aria-hidden="true">
    <svg viewBox="0 0 360 90" preserveAspectRatio="none" focusable="false">
      <path className="navigation-surface-border" d="M28 5H332Q355 5 355 28V62Q355 85 332 85H28Q5 85 5 62V28Q5 5 28 5Z" />
      <path className="navigation-surface-corners" d="M11 30Q11 11 32 11H70M290 11H328Q349 11 349 30M349 60Q349 79 328 79H290M70 79H32Q11 79 11 60" />
      <path className="navigation-surface-clouds" d="M18 65c12 2 20-3 25-9-11 5-19-4-13-10 4-5 10-1 10 3-5-15 15-20 20-7 3 6-1 12-6 13 12-5 21 5 14 12 11-2 16 6 7 10M267 23c10-9 23-6 25 2-7-3-12 3-8 8 5 5 11-1 9-6 8-13 28-8 23 5 15-4 23 13 10 18M95 80c28-13 44-10 68 0m18 0c30-13 51-11 79 0" />
    </svg>
  </span>;
}
