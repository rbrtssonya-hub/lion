import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { media } from '../../config/media.js';
import { cultureGalleryPointerBounds, cultureGalleryRightSide } from './cultureGalleryHitArea.js';

export default function CultureDepthGallery({ stories, currentIndex, position, reducedMotion, isPageVisible, onVisibilityChange, settings, onPhotoHover, onNext, preload = false, onReady }) {
  const hostRef = useRef(null);
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const selectionRef = useRef({ currentIndex, position });
  const activeRef = useRef(false);
  const interactionRef = useRef({ settings, onPhotoHover, onNext });
  const fallbackPointerRef = useRef(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
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
    if ((!hasEntered && !preload) || reducedMotion) {
      setStatus('static');
      if (reducedMotion) onReadyRef.current?.(true);
      return undefined;
    }
    let disposed = false;
    let engine;
    const preparationTimeout = setTimeout(() => {
      if (disposed) return;
      setStatus('fallback');
      onReadyRef.current?.(false);
      interactionRef.current.onPhotoHover(false);
      disposed = true;
      engine?.dispose();
      engineRef.current = null;
    }, 25_000);
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
          clearTimeout(preparationTimeout);
          // Retire the fallback pause. After the canvas is revealed, hand its
          // last real pointer input over and verify the new photo's hit area.
          interactionRef.current.onPhotoHover(false);
          setStatus('ready');
          onReadyRef.current?.(true);
        },
        onError: () => { if (!disposed) { clearTimeout(preparationTimeout); setStatus('fallback'); interactionRef.current.onPhotoHover(false); onReadyRef.current?.(false); } },
      });
      engineRef.current = engine;
      engine.select(selectionRef.current.currentIndex, selectionRef.current.position);
      engine.setActive(activeRef.current);
    }).catch(() => {
      if (!disposed) { clearTimeout(preparationTimeout); setStatus('fallback'); onReadyRef.current?.(false); }
    });
    return () => {
      disposed = true;
      clearTimeout(preparationTimeout);
      engineRef.current = null;
      engine?.dispose();
    };
  }, [hasEntered || preload, reducedMotion, stories]);

  useEffect(() => {
    engineRef.current?.setSettings(engineSettings(settings));
  }, [settings.carouselTransitionDuration, settings.carouselFocusScale]);

  useEffect(() => onPhotoHover(false), [reducedMotion, onPhotoHover]);

  useEffect(() => {
    const clearPointer = () => {
      fallbackPointerRef.current = null;
      if (hostRef.current) hostRef.current.style.cursor = '';
      onPhotoHover(false);
    };
    const clearHiddenPointer = () => { if (document.hidden) clearPointer(); };
    window.addEventListener('blur', clearPointer);
    document.addEventListener('visibilitychange', clearHiddenPointer);
    return () => {
      window.removeEventListener('blur', clearPointer);
      document.removeEventListener('visibilitychange', clearHiddenPointer);
    };
  }, [onPhotoHover]);

  useEffect(() => {
    engineRef.current?.select(currentIndex, position);
  }, [currentIndex, position]);

  useLayoutEffect(() => {
    engineRef.current?.setActive(isInView && isPageVisible && !reducedMotion);
    if (!isInView || !isPageVisible) {
      fallbackPointerRef.current = null;
      if (hostRef.current) hostRef.current.style.cursor = '';
      onPhotoHover(false);
    }
  }, [isInView, isPageVisible, reducedMotion, status, onPhotoHover]);

  useLayoutEffect(() => {
    if (status !== 'ready') return;
    hostRef.current.style.cursor = '';
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

  const isFallbackRightSide = event => cultureGalleryRightSide(hostRef.current, event,
    cultureGalleryPointerBounds(hostRef.current, canvasRef.current, event));

  return (
    <div className="culture-depth-gallery" ref={hostRef} data-depth-state={status}
      style={{ '--culture-photo-aspect': photo.width / photo.height, '--culture-focus-scale': settings.carouselFocusScale / 100 }}
      onClick={event => {
        if (status === 'ready' || event.button !== 0 || !isPageVisible ||
          event.target.closest('button') || !isFallbackRightSide(event)) return;
        onNext();
      }} onPointerMove={event => {
        if (status !== 'ready') event.currentTarget.style.cursor = isFallbackRightSide(event) ? 'pointer' : '';
      }} onPointerLeave={event => {
        if (status !== 'ready') event.currentTarget.style.cursor = '';
      }}>
      <div className="culture-depth-atmosphere" aria-hidden="true" />
      <canvas key={reducedMotion ? 'static' : 'animated'} ref={canvasRef} className="culture-depth-canvas" aria-hidden="true" />
      <button className="culture-depth-photo-action" type="button" aria-label="下一张文化照片"
        aria-describedby="culture-photo-instructions" aria-controls={`culture-panel-${stories[currentIndex].id}`}
        onClick={onNext} onPointerEnter={handleFallbackPointer} onPointerMove={handleFallbackPointer}
        onPointerLeave={clearFallbackPointer} onPointerCancel={clearFallbackPointer} />
      <button className="culture-depth-next interaction-cue" type="button" onClick={onNext}
        aria-controls={`culture-panel-${stories[currentIndex].id}`}>
        点击照片，换一幅风土 <span aria-hidden="true">{String(currentIndex + 1).padStart(2, '0')} / {String(stories.length).padStart(2, '0')} →</span>
      </button>
    </div>
  );
}
