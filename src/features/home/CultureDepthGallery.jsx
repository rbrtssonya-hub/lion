import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { media } from '../../config/media.js';

export default function CultureDepthGallery({ stories, currentIndex, position, reducedMotion, isPageVisible, onVisibilityChange, settings, onPhotoHover, onNext }) {
  const hostRef = useRef(null);
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const selectionRef = useRef({ currentIndex, position });
  const activeRef = useRef(false);
  const interactionRef = useRef({ settings, onPhotoHover, onNext });
  const fallbackPointerRef = useRef(null);
  const [isInView, setInView] = useState(false);
  const [hasEntered, setHasEntered] = useState(false);
  const [status, setStatus] = useState('static');
  selectionRef.current = { currentIndex, position };
  activeRef.current = isInView && isPageVisible && !reducedMotion;
  interactionRef.current = { settings, onPhotoHover, onNext };
  const photo = stories[currentIndex].photo;

  const engineSettings = (value) => ({ transitionDuration: value.carouselTransitionDuration, focusScale: value.carouselFocusScale / 100 });

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
        settings: engineSettings(interactionRef.current.settings),
        onFocusChange: (focused) => { if (!disposed) interactionRef.current.onPhotoHover(focused); },
        onNext: () => { if (!disposed) interactionRef.current.onNext(); },
        onReady: () => {
          if (disposed) return;
          // Retire the fallback pause. After the canvas is revealed, hand its
          // last real pointer input over and verify the new photo's hit area.
          interactionRef.current.onPhotoHover(false);
          setStatus('ready');
        },
        onError: () => { if (!disposed) { setStatus('fallback'); interactionRef.current.onPhotoHover(false); } },
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
    engineRef.current?.setSettings(engineSettings(settings));
  }, [settings.carouselTransitionDuration, settings.carouselFocusScale]);

  useEffect(() => onPhotoHover(false), [reducedMotion, onPhotoHover]);

  useEffect(() => {
    const clearPointer = () => {
      fallbackPointerRef.current = null;
      onPhotoHover(false);
    };
    window.addEventListener('blur', clearPointer);
    return () => window.removeEventListener('blur', clearPointer);
  }, [onPhotoHover]);

  useEffect(() => {
    engineRef.current?.select(currentIndex, position);
  }, [currentIndex, position]);

  useLayoutEffect(() => {
    engineRef.current?.setActive(isInView && isPageVisible && !reducedMotion);
  }, [isInView, isPageVisible, reducedMotion, status]);

  useLayoutEffect(() => {
    if (status !== 'ready') return;
    // Complete the handoff within this DOM commit, before a newer leave/move
    // can arrive and then be overwritten by the loading pointer snapshot.
    const pointer = fallbackPointerRef.current;
    fallbackPointerRef.current = null;
    if (pointer) engineRef.current?.syncPointer(pointer);
  }, [status]);

  const handleFallbackPointer = (event) => {
    if (status === 'ready') return;
    fallbackPointerRef.current = { clientX: event.clientX, clientY: event.clientY };
    onPhotoHover(true);
  };
  const clearFallbackPointer = () => {
    if (status === 'ready') return;
    fallbackPointerRef.current = null;
    onPhotoHover(false);
  };

  return (
    <div className="culture-depth-gallery" ref={hostRef} data-depth-state={status}
      style={{ '--culture-photo-aspect': photo.width / photo.height, '--culture-focus-scale': settings.carouselFocusScale / 100 }}>
      <div className="culture-depth-atmosphere" aria-hidden="true" />
      <span className="culture-depth-label" aria-hidden="true">风土入画 <i /> 狮影成章</span>
      <canvas key={reducedMotion ? 'static' : 'animated'} ref={canvasRef} className="culture-depth-canvas" aria-hidden="true" />
      <button className="culture-depth-photo-action" type="button" aria-label="下一张文化照片"
        aria-describedby="culture-photo-instructions" aria-controls={`culture-panel-${stories[currentIndex].id}`}
        onClick={onNext} onPointerEnter={handleFallbackPointer} onPointerMove={handleFallbackPointer}
        onPointerLeave={clearFallbackPointer} onPointerCancel={clearFallbackPointer} />
      <div className="culture-depth-axis" aria-hidden="true"><span>近</span><i /><span>远</span></div>
    </div>
  );
}
