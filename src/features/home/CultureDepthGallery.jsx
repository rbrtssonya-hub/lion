import { useEffect, useRef, useState } from 'react';
import { media } from '../../config/media.js';

export default function CultureDepthGallery({ stories, currentIndex, position, reducedMotion, isPageVisible, onVisibilityChange }) {
  const hostRef = useRef(null);
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const selectionRef = useRef({ currentIndex, position });
  const activeRef = useRef(false);
  const [isInView, setInView] = useState(false);
  const [hasEntered, setHasEntered] = useState(false);
  const [status, setStatus] = useState('static');
  selectionRef.current = { currentIndex, position };
  activeRef.current = isInView && isPageVisible && !reducedMotion;

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      setInView(entry.isIntersecting);
      onVisibilityChange(entry.isIntersecting);
      if (entry.isIntersecting) setHasEntered(true);
    }, { threshold: 0.15 });
    observer.observe(hostRef.current);
    return () => observer.disconnect();
  }, [onVisibilityChange]);

  useEffect(() => {
    if (!hasEntered || reducedMotion) {
      setStatus('static');
      return undefined;
    }
    let disposed = false;
    let engine;
    setStatus('loading');
    import('../../services/cultureDepthGallery.js').then(({ createCultureDepthGallery }) => {
      if (disposed) return;
      engine = createCultureDepthGallery({
        canvas: canvasRef.current,
        items: stories.map(({ photo }) => ({ src: media[photo.mediaKey], width: photo.width, height: photo.height })),
        onReady: () => { if (!disposed) setStatus('ready'); },
        onError: () => { if (!disposed) setStatus('fallback'); },
      });
      engineRef.current = engine;
      engine.select(selectionRef.current.currentIndex, selectionRef.current.position);
      engine.setActive(activeRef.current);
    }).catch(() => {
      if (!disposed) setStatus('fallback');
    });
    return () => {
      disposed = true;
      engineRef.current = null;
      engine?.dispose();
    };
  }, [hasEntered, reducedMotion, stories]);

  useEffect(() => {
    engineRef.current?.select(currentIndex, position);
  }, [currentIndex, position]);

  useEffect(() => {
    engineRef.current?.setActive(isInView && isPageVisible && !reducedMotion);
  }, [isInView, isPageVisible, reducedMotion, status]);

  return (
    <div className="culture-depth-gallery" ref={hostRef} data-depth-state={status} aria-hidden="true">
      <div className="culture-depth-atmosphere" />
      <span className="culture-depth-label">风土入画 <i /> 狮影成章</span>
      <canvas key={reducedMotion ? 'static' : 'animated'} ref={canvasRef} className="culture-depth-canvas" />
      <div className="culture-depth-axis"><span>近</span><i /><span>远</span></div>
    </div>
  );
}
