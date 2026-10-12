import EntryLionEmblem from './EntryLionEmblem.jsx';

export default function BrandLockup({ className = '' }) {
  return <div className={`site-brand ${className}`.trim()}>
    <EntryLionEmblem />
    <div className="site-brand-copy">
      <span className="site-brand-name">南风有狮</span>
    </div>
  </div>;
}
