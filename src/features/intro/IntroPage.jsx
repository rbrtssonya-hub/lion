import VideoStage from '../../components/VideoStage.jsx';
import { media } from '../../config/media.js';

export default function IntroPage({ onEnded }) {
  return <section className="intro-stage react-intro-stage" id="introStage" aria-label="AI醒狮开场视频">
    <VideoStage id="introVideo" src={media.intro} label="AI醒狮开场视频" onEnded={onEnded} onContinue={onEnded} className="intro-video" />
  </section>;
}
