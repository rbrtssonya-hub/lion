import { useEffect, useState } from 'react';
import { media } from '../../config/media.js';

const tasks = new Map();
const listeners = new Set();
const weights = { media: 25, video: 5, model: 35, book: 20, gallery: 15 };
const names = { media: '图像与章节', video: '首页影像', model: '醒狮模型', book: '翻页史册', gallery: '文化图鉴' };
let preparing;

export function withStartupTimeout(promise, milliseconds = 25_000, message = '资源准备超时') {
  let timeout;
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error(message)), milliseconds); }),
  ]).finally(() => clearTimeout(timeout));
}

export function reportStartupTask(name, success = true) {
  tasks.set(name, success !== false);
  listeners.forEach(listener => listener());
}

function prepareMedia() {
  if (preparing) return preparing;
  // Below-fold type plates are lazy content, not a condition for entering the site.
  const images = Object.entries(media).filter(([key, src]) => !key.startsWith('lionType') && /\.(png|jpe?g|webp|svg)$/i.test(src)).map(([, src]) => src);
  preparing = withStartupTimeout(Promise.allSettled([
    ...images.map(src => new Promise((resolve, reject) => {
      const image = new Image();
      const timeout = setTimeout(() => { image.src = ''; reject(new Error('图像准备超时')); }, 25_000);
      const finish = callback => value => { clearTimeout(timeout); image.onload = image.onerror = null; callback(value); };
      image.onload = () => image.decode().then(finish(resolve), finish(reject));
      image.onerror = finish(reject);
      image.src = src;
    })),
    import('../model/ModelPage.jsx'),
    document.fonts.load('26px "Nanfeng Navigation Brush"'),
  ]), 25_000, '图像、字体或章节准备超时')
    .then(results => reportStartupTask('media', results.every(result => result.status === 'fulfilled')))
    .catch(() => reportStartupTask('media', false));
  return preparing;
}

export function useStartupLoading() {
  const [ready, setReady] = useState(() => !document.getElementById('startupLoading'));
  useEffect(() => {
    const overlay = document.getElementById('startupLoading');
    if (!overlay) return;
    const send = () => {
      const complete = Object.keys(weights).every(name => tasks.has(name));
      const failures = [...tasks].filter(([, success]) => !success).map(([name]) => names[name]);
      const pending = Object.keys(weights).filter(name => !tasks.has(name)).map(name => names[name]);
      overlay.contentWindow?.postMessage({ type: 'lion:startup-progress',
        progress: [...tasks.keys()].reduce((sum, name) => sum + (weights[name] || 0), 0) / 100,
        complete,
        message: complete ? failures.length ? `${failures.join('、')}使用预览 · 准备入场` : '狮已醒 · 欢迎入场' : `${pending[0]}准备中 · 墨韵渐成`,
      }, location.origin);
      overlay.dataset.ready = String(complete);
      overlay.dataset.failures = failures.join(',');
    };
    const receive = event => {
      if (event.source !== overlay.contentWindow || event.origin !== location.origin) return;
      if (event.data?.type === 'lion:loader-ready') send();
      if (event.data?.type === 'lion:loader-complete' && Object.keys(weights).every(name => tasks.has(name))) {
        listeners.delete(send);
        window.removeEventListener('message', receive);
        overlay.remove();
        setReady(true);
      }
    };
    listeners.add(send);
    window.addEventListener('message', receive);
    send();
    prepareMedia();
    return () => { listeners.delete(send); window.removeEventListener('message', receive); };
  }, []);
  return ready;
}
