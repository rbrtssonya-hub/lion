import { chapters } from '../config/chapters.js';

export default function ChapterIdentity({ chapter, eyebrow, title, description, className = '', titleAs: Title = 'h2' }) {
  const { number, phase } = chapters.find(item => item.route === chapter);
  return <div className={`chapter-identity ${className}`} data-chapter-identity={chapter}>
    <div className="chapter-identity__masthead">
      <span className="chapter-identity__number">{number} <small>/ 04</small></span>
      <span className="chapter-identity__phase">{phase}</span>
      <span className="chapter-identity__eyebrow">{eyebrow}</span>
    </div>
    {title && <Title className="chapter-identity__title">{title}</Title>}
    {description && <p className="chapter-identity__description">{description}</p>}
    <span className="chapter-identity__rule" aria-hidden="true" />
  </div>;
}
