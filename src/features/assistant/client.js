import { answerLocally } from './knowledge.js';

const chapters = new Set(['entry', 'model', 'action', 'dance', 'state', 'spread']);
const cancelled = () => new DOMException('讲解已取消', 'AbortError');

export async function askXiaoxing({ question, chapter = 'entry', history = [], signal }) {
  const text = String(question || '').trim().slice(0, 500);
  const local = reason => ({ ...answerLocally(text, chapter), mode: 'local', reason });
  if (signal?.aborted) throw cancelled();
  if (!text || (typeof navigator !== 'undefined' && navigator.onLine === false)) return local('offline');
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 18_000);
  try {
    const response = await fetch('/api/xiaoxing/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
      body: JSON.stringify({ question: text, chapter: chapters.has(chapter) ? chapter : 'entry',
        history: history.filter(message => ['user', 'assistant'].includes(message.role)).slice(-6)
          .map(message => ({ role: message.role, content: String(message.content || message.answer || '').slice(0, 500) })) }),
    });
    if (!response.ok) return local('service-unavailable');
    const reply = await response.json();
    if (typeof reply.answer !== 'string' || !reply.answer.trim() || reply.answer.length > 12_000
      || !['local', 'online'].includes(reply.mode) || !Array.isArray(reply.sources)) return local('invalid-response');
    return { answer: reply.answer, mode: reply.mode, reason: reply.reason,
      sources: reply.sources.filter(source => source && chapters.has(source.chapter)
        && typeof source.label === 'string' && source.label.length <= 160)
        .slice(0, 8).map(source => ({ id: String(source.id || source.label), label: source.label,
          chapter: source.chapter, ...(typeof source.section === 'string' && source.section.length < 100 ? { section: source.section } : {}) })) };
  } catch (error) {
    if (signal?.aborted) throw cancelled();
    return local(controller.signal.aborted ? 'timeout' : 'service-unavailable');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}
