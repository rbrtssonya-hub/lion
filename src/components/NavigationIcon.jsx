import { navigationIcons } from '../config/chapters.js';
import { media } from '../config/media.js';

export default function NavigationIcon({ name }) {
  const { mediaKey, viewBox } = navigationIcons[name];
  return <span className="site-nav-icon" aria-hidden="true">
    <svg viewBox={viewBox} focusable="false">
      <image href={media[mediaKey]} width="1254" height="1254" />
    </svg>
  </span>;
}
