import EntryLionEmblem from './EntryLionEmblem.jsx';

export default function BrandLockup({ className = '', caption }) {
  return <div className={`site-brand ${className}`.trim()}>
    <EntryLionEmblem />
    <div className="site-brand-copy">
      <span className="site-brand-name">南风有狮</span>
      {caption && <span className="site-brand-caption">{caption}</span>}
    </div>
  </div>;
}
