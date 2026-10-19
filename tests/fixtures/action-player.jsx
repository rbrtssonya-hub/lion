// Isolated test harness. Vite bundles it in memory for Playwright only.
// These short video bytes are TEST MEDIA ONLY, never production action content.
import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import ActionPage from '../../src/features/action/ActionPage.jsx';
import { actionClips } from '../../src/features/action/actionClips.js';
import { media } from '../../src/config/media.js';
import '../../src/styles/base.css';
import '../../src/styles/navigation.css';

const assets = { ...media };
const clips = actionClips.map(clip => {
  assets[`test_${clip.id}`] = `/__action-fixture__/${clip.id}.mp4`;
  return { ...clip, videoKey: `test_${clip.id}`, sourceNote: 'TEST MEDIA ONLY · 非正式动作样本' };
});
function Fixture() {
  const [mounted, setMounted] = useState(true);
  const [revision, setRevision] = useState(0);
  const query = new URLSearchParams(location.search);
  const header = Number(query.get('header')) || 88;
  const width = Number(query.get('pageWidth')) || innerWidth;
  const currentAssets = revision ? { ...assets, [`test_${clips[0].id}`]: `/__action-fixture__/${clips[0].id}-alt.mp4` } : assets;
  return <div className="site-shell" style={{ '--site-header-height': `${header}px`, '--header-height': `${header}px`, '--chapter-background-image': `url("${media.actionBackground}")` }}>
    <div className="site-page" style={{ width }}><header className="site-header" style={{ height: header, width }} aria-label="测试媒体夹具">TEST MEDIA ONLY
      <button id="fixtureUnmount" onClick={() => setMounted(false)}>结束测试媒体</button>
      <button id="fixtureReplace" onClick={() => setRevision(1)}>换测试媒体来源</button>
    </header>{mounted && <ActionPage clips={clips} assets={currentAssets} />}</div>
  </div>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
