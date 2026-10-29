import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import XiaoxingAvatar from './XiaoxingAvatar.jsx';
import usePetPosition from './usePetPosition.js';
import useNarration from './useNarration.js';
import { chapterGuides, danceEntranceGuide, getChapterGuide, getSuggestedQuestions } from './knowledge.js';
import { askXiaoxing } from './client.js';
import './assistant.css';

const petSize = { width: 152, height: 194 };
const spreadPetSize = { width: 120, height: 160 };
const chapterTitles = { entry: '入境 · 首页', model: '造 · 观形', action: '舞 · 动作', dance: '舞 · 空间入口', state: '舞 · 神态', spread: '传 · 狮行远方' };
const Icon = ({ type }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
  {type === 'close' ? <path d="m6 6 12 12M18 6 6 18" /> : type === 'send' ? <><path d="m4 11 16-7-6 16-3-6-7-3Z" /><path d="m11 14 9-10" /></> : type === 'voice' ? <><path d="M11 5 6 9H3v6h3l5 4V5ZM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" /></> : <><path d="M4 5h6c2 0 2 1 2 1s0-1 2-1h6v14h-6c-2 0-2 1-2 1s0-1-2-1H4V5Z" /><path d="M12 6v14" /></>}
</svg>;

function useStageVisibility(suppressed) {
  const [blocked, setBlocked] = useState(false);
  const [animated, setAnimated] = useState(true);
  useEffect(() => {
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      setBlocked(Boolean(document.fullscreenElement || document.querySelector('.entry-transition-stage, .prewarmed-page[data-active="true"] .is-intro-playing, .site-shell[data-settings-open="true"]')));
      setAnimated(!document.hidden && !motion.matches);
    };
    const observer = new MutationObserver(update);
    const root = document.getElementById('root');
    if (root) observer.observe(root, { childList: true, subtree: true, attributes: true,
      attributeFilter: ['class', 'data-active', 'data-settings-open', 'data-intro-active'] });
    document.addEventListener('fullscreenchange', update);
    document.addEventListener('visibilitychange', update);
    motion.addEventListener('change', update); update();
    return () => {
      observer.disconnect(); document.removeEventListener('fullscreenchange', update);
      document.removeEventListener('visibilitychange', update);
      motion.removeEventListener('change', update);
    };
  }, []);
  return { hidden: Boolean(suppressed || blocked), animated };
}

export default function XiaoxingAssistant({ chapter = 'entry', onNavigate, suppressed = false }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [answering, setAnswering] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [mode, setMode] = useState('local');
  const currentPetSize = chapter === 'spread' ? spreadPetSize : petSize;
  const [sourceTarget, setSourceTarget] = useState(null);
  const { position, viewport, dragging, consumeClick, handlers } = usePetPosition(currentPetSize, chapter);
  const { hidden, animated } = useStageVisibility(suppressed);
  const narration = useNarration();
  const narrationRef = useRef(narration); narrationRef.current = narration;
  const availableRef = useRef({ open, hidden, chapter }); availableRef.current = { open, hidden, chapter };
  const triggerRef = useRef(null), inputRef = useRef(null), logRef = useRef(null);
  const requestRef = useRef(null), answeringTimer = useRef(null), idRef = useRef(0), messagesRef = useRef(messages);
  messagesRef.current = messages;

  const finishAnswer = useCallback((reply, requestChapter) => {
    setMode(reply.mode);
    const message = { ...reply, id: ++idRef.current, role: 'assistant', chapter: requestChapter };
    setMessages(current => [...current, message]);
    setAnswering(true);
    clearTimeout(answeringTimer.current);
    answeringTimer.current = setTimeout(() => setAnswering(false), 4200);
    if (narrationRef.current.enabled && !availableRef.current.hidden
      && availableRef.current.chapter === requestChapter) narrationRef.current.speak(reply.answer);
  }, []);
  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    if (!open) return undefined;
    inputRef.current?.focus({ preventScroll: true });
    const escape = event => {
      if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing || availableRef.current.hidden) return;
      event.preventDefault(); close();
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [open, close]);
  useEffect(() => {
    requestRef.current?.abort(); requestRef.current = null;
    clearTimeout(answeringTimer.current);
    setThinking(false); setAnswering(false);
    narrationRef.current.stop();
  }, [chapter]);
  useEffect(() => { if (hidden) narrationRef.current.stop(); }, [hidden]);
  useEffect(() => () => { requestRef.current?.abort(); clearTimeout(answeringTimer.current); }, []);
  useLayoutEffect(() => {
    if (open && logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages, thinking, open]);
  useEffect(() => {
    if (!sourceTarget || chapter !== sourceTarget.chapter) return undefined;
    if (chapter === 'entry' || !sourceTarget.section) { setSourceTarget(null); return undefined; }
    let frame, attempts = 0;
    const reveal = () => {
      const element = document.getElementById(sourceTarget.section);
      if (element && !element.closest('[inert], [hidden]') && element.checkVisibility()) {
        element.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' });
        setSourceTarget(null);
      } else if (++attempts < 90) frame = requestAnimationFrame(reveal);
      else setSourceTarget(null);
    };
    frame = requestAnimationFrame(reveal);
    return () => cancelAnimationFrame(frame);
  }, [sourceTarget, chapter]);

  const ask = async question => {
    const text = question.trim().slice(0, 500);
    if (!text || thinking) return;
    const requestChapter = chapter;
    const controller = new AbortController(); requestRef.current?.abort(); requestRef.current = controller;
    narrationRef.current.stop(); setAnswering(false); clearTimeout(answeringTimer.current);
    setInput(''); setThinking(true);
    const history = messagesRef.current.map(message => ({ role: message.role, content: message.content || message.answer }));
    const message = { id: ++idRef.current, role: 'user', content: text, chapter: requestChapter };
    setMessages(current => [...current, message]);
    try {
      const reply = await askXiaoxing({ question: text, chapter: requestChapter, history, signal: controller.signal });
      if (!controller.signal.aborted) finishAnswer(reply, requestChapter);
    } catch (error) {
      if (error.name !== 'AbortError') console.error('小醒讲解暂不可用');
    } finally {
      if (requestRef.current === controller) { requestRef.current = null; setThinking(false); }
    }
  };
  const guide = () => {
    requestRef.current?.abort(); requestRef.current = null; setThinking(false);
    narrationRef.current.stop();
    const message = { id: ++idRef.current, role: 'user', content: '讲解本页', chapter };
    setMessages(current => [...current, message]);
    finishAnswer(getChapterGuide(chapter), chapter);
  };
  const toggleVoice = () => {
    if (!narration.toggleEnabled()) return;
    const latest = messagesRef.current.findLast(message => message.role === 'assistant' && message.chapter === chapter);
    if (latest && narration.speak(latest.answer)) return;
    // toggleEnabled updates the hook's enabledRef immediately, so the user's
    // click can start audio without waiting for a second render or gesture.
    const reply = getChapterGuide(chapter);
    guide();
    narration.speak(reply.answer);
  };
  const toggleNarrationPlayback = () => {
    if (narration.speaking || narration.preparing) { narration.stop(); return; }
    if (!narration.enabled) narration.toggleEnabled();
    const latest = messagesRef.current.findLast(message => message.role === 'assistant' && message.chapter === chapter);
    narration.speak(latest?.answer || getChapterGuide(chapter).answer);
  };
  const visitSource = source => {
    setSourceTarget(source.section ? source : null);
    // Keep the existing action knowledge/recording while its page now has a subroute.
    const route = source.chapter === 'action' && source.section === 'actionTheater' ? 'theater' : source.chapter;
    onNavigate?.(route, { assistantSource: source }); close();
  };
  const panelWidth = Math.min(378, viewport.width - 28);
  const topInset = viewport.height < 600 ? 14 : 100;
  const panelHeight = Math.min(566, viewport.height - topInset - 14);
  const panelX = Math.max(14, Math.min(viewport.width - panelWidth - 14,
    position.x > viewport.width / 2 ? position.x - panelWidth - 10 : viewport.width - panelWidth - 24));
  const panelY = Math.max(topInset, Math.min(viewport.height - panelHeight - 14, position.y + currentPetSize.height - panelHeight));
  const narrationX = Math.max(8, Math.min(viewport.width - 40,
    position.x > viewport.width / 2 ? position.x - 38 : position.x + currentPetSize.width + 6));
  const narrationY = Math.max(8, Math.min(viewport.height - 40, position.y + currentPetSize.height - 38));
  const state = thinking || narration.preparing ? 'thinking' : narration.speaking || answering ? 'answering' : open || focused || hovered ? 'listening' : 'idle';
  const caption = narration.preparing ? '正在准备声音' : { idle: '点我对话', listening: '在听你说', thinking: '整理资料中', answering: '说给你听' }[state];
  const suggestions = getSuggestedQuestions(chapter).slice(0, 3);

  return createPortal(<aside className="xiaoxing-companion" hidden={hidden} data-state={state} data-chapter={chapter} data-dragging={dragging} aria-label="小醒讲解员">
    <button ref={triggerRef} type="button" className="xiaoxing-pet" aria-label="与小醒对话" aria-describedby="xiaoxingMoveHelp"
      title="点击对话，按住拖动小醒" aria-expanded={open} aria-controls="xiaoxingDialog" style={{ left: position.x, top: position.y }} {...handlers}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onClick={() => { if (!consumeClick()) { if (open) close(); else setOpen(true); } }}>
      <span className="xiaoxing-pet-shadow" aria-hidden="true" />
      <XiaoxingAvatar state={state} animated={animated && !dragging} />
      <span className="xiaoxing-pet-caption"><span className="xiaoxing-pet-dot" />小醒<span aria-hidden="true"> · </span><small>{caption}</small></span>
    </button>
    <button type="button" className="xiaoxing-narration-toggle" aria-label="当前章节语音讲解" aria-pressed={narration.speaking}
      aria-busy={narration.preparing} data-enabled={narration.enabled}
      title={narration.preparing ? '正在准备声音，点击停止' : narration.speaking ? '停止当前讲解' : `${narration.voiceLabel} · 点击播放当前章节讲解`} disabled={!narration.supported}
      style={{ left: narrationX, top: narrationY }} onClick={toggleNarrationPlayback}><Icon type="voice" /></button>
    <span id="xiaoxingMoveHelp" className="sr-only">可按住鼠标拖动小醒；聚焦后用方向键移动，按回车打开对话。</span>
    {open && <section id="xiaoxingDialog" className="xiaoxing-dialog" role="dialog" aria-modal="false" aria-labelledby="xiaoxingDialogTitle"
      style={{ left: panelX, top: panelY, width: panelWidth, height: panelHeight }}>
      <header className="xiaoxing-dialog-header">
        <div className="xiaoxing-title"><span className="xiaoxing-title-mark" aria-hidden="true">狮</span><div><h2 id="xiaoxingDialogTitle">小醒 · 醒狮讲解员</h2><p>{chapterTitles[chapter] || chapterTitles.entry}</p></div></div>
        <button type="button" className="xiaoxing-icon-button" aria-label="收起小醒对话" onClick={close}><Icon type="close" /></button>
      </header>
      <div className="xiaoxing-conversation" ref={logRef} role="log" aria-label="小醒对话记录" aria-live="polite" aria-relevant="additions" aria-busy={thinking}>
        {!messages.length && <div className="xiaoxing-welcome"><span className="xiaoxing-welcome-eyebrow">南风有狮 · 一路相伴</span><h3>这一程，跟小醒看醒狮</h3><p>你现在来到{chapter === 'dance' ? danceEntranceGuide.shortTitle : chapterGuides[chapter]?.shortTitle || '醒狮展览'}。想听一段讲解，还是从一个好奇开始？</p><span className="xiaoxing-welcome-flourish" aria-hidden="true">✦</span></div>}
        {messages.map(message => <article className={`xiaoxing-message is-${message.role}`} data-mode={message.mode} key={message.id}>
          <p className="xiaoxing-message-name">{message.role === 'user' ? '你' : '小醒'}{message.role === 'assistant' && <span>{chapterTitles[message.chapter]}</span>}</p>
          <p className="xiaoxing-message-text">{message.content || message.answer}</p>
          {message.sources?.length > 0 && <nav className="xiaoxing-sources" aria-label="回答来源">{message.sources.map((source, index) =>
            <button key={`${source.id}-${index}`} type="button" onClick={() => visitSource(source)}><span aria-hidden="true">↗</span>{source.label}</button>)}</nav>}
        </article>)}
        {thinking && <p className="xiaoxing-thinking" role="status">小醒正在整理资料<span aria-hidden="true">···</span></p>}
      </div>
      <div className="xiaoxing-actions">
        <div className="xiaoxing-guide-row"><button className="xiaoxing-guide-button" type="button" onClick={guide}><Icon type="book" />讲解本页</button><span className="xiaoxing-service-label">{mode === 'online' ? '智能问答' : '本地讲解'}</span></div>
        <div className="xiaoxing-suggestions" aria-label="推荐问题">{suggestions.map(question => <button key={question} type="button" disabled={thinking} onClick={() => ask(question)}>{question}<span aria-hidden="true">→</span></button>)}</div>
        <form className="xiaoxing-form" onSubmit={event => { event.preventDefault(); ask(input); }}>
          <label className="sr-only" htmlFor="xiaoxingQuestion">向小醒提问</label>
          <input id="xiaoxingQuestion" ref={inputRef} value={input} maxLength={500} autoComplete="off" placeholder="想了解醒狮的什么？"
            onChange={event => setInput(event.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
            onKeyDown={event => { if (event.key === 'Enter' && event.nativeEvent.isComposing) event.preventDefault(); }} />
          <button type="submit" aria-label="发送问题" disabled={thinking || !input.trim()}><Icon type="send" /></button>
        </form>
        <div className="xiaoxing-footnote"><button type="button" className="xiaoxing-voice" aria-label="语音讲解" aria-pressed={narration.enabled} disabled={!narration.supported}
          title={narration.supported ? narration.voiceLabel : '此电脑暂不支持音频播放，仍可阅读文字'} onClick={toggleVoice}><Icon type="voice" />语音讲解{narration.enabled ? ' · 开' : ''}</button><span className="xiaoxing-voice-status" role="status" title={narration.voiceLabel}>{narration.status || '收起后也可点播'}</span></div>
      </div>
    </section>}
  </aside>, document.body);
}
