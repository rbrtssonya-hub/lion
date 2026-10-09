import ChapterNav from '../../components/ChapterNav.jsx';
import VideoStage from '../../components/VideoStage.jsx';
import TitleMotionLayer from '../../components/TitleMotionLayer.jsx';
import { media } from '../../config/media.js';
import { chapters } from '../../config/chapters.js';

export default function HomePage({ onNavigate }) {
  return <section className="entry-gate final-home" aria-label="作品入口">
    <VideoStage id="entryLionVideo" src={media.home} poster={media.cover} loop label="循环播放的醒狮首页视频" className="entry-visual entry-visual-video" />
    <div className="entry-vignette" aria-hidden="true" />
    <div className="entry-ornaments" aria-hidden="true">
      <svg className="entry-cloud entry-cloud-top" viewBox="0 0 100 32"><path d="M5 22h72c12 0 12-12 0-12H41c-11 0-11 12 0 12h18M18 16h30M38 10h22c10 0 10-8 0-8H48M28 22h24c11 0 11 8 0 8H14" /></svg>
      <svg className="entry-cloud entry-cloud-side" viewBox="0 0 100 32"><path d="M5 22h72c12 0 12-12 0-12H41c-11 0-11 12 0 12h18M18 16h30M38 10h22c10 0 10-8 0-8H48M28 22h24c11 0 11 8 0 8H14" /></svg>
    </div>
    <header className="entry-header">
      <div className="entry-brand">南风有狮</div>
      <ChapterNav current="intro" onNavigate={onNavigate} />
    </header>
    <div className="entry-copy">
      <h1 className="sr-only">南风有狮</h1>
      <TitleMotionLayer />
      <button className="entry-cta" id="enterWork" type="button" onClick={() => onNavigate('intro')}>
        <span>探索更多</span><svg className="entry-cta-arrow" viewBox="0 0 32 20" aria-hidden="true"><path d="M1 10h29m-8-8 8 8-8 8" /></svg>
      </button>
      <p className="entry-motto"><span>醒&nbsp;&nbsp;狮&nbsp;&nbsp;传&nbsp;&nbsp;文&nbsp;&nbsp;化</span><span>南&nbsp;&nbsp;风&nbsp;&nbsp;载&nbsp;&nbsp;未&nbsp;&nbsp;来</span></p>
      <p className="entry-english">WHERE THE SOUTHERN WIND AWAKENS THE LION</p>
    </div>
    <nav className="entry-bottom-nav" aria-label="信息可视化模块">
      {chapters.slice(1).map(({ route, label, description, icon, viewBox }, index) => (
        <button key={route} className="entry-bottom-item" type="button" onClick={() => onNavigate(route)}>
          <span className="entry-icon" aria-hidden="true"><svg viewBox={viewBox}><path d={icon} /></svg></span>
          <span><b>{String(index + 1).padStart(2, '0')}</b><strong>{label}</strong><small>{description}</small></span>
        </button>
      ))}
    </nav>
  </section>;
}
