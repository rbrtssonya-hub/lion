import { chapterGuides } from './knowledge.js';

export const voiceProfile = Object.freeze({
  label: '小醒 · 选定参考音色',
  recordingVoice: 'GPT-SoVITS v2ProPlus · 用户参考音色',
});

export const narrationMediaKeys = Object.freeze({
  entry: 'xiaoxingVoiceEntry',
  model: 'xiaoxingVoiceModel',
  action: 'xiaoxingVoiceAction', state: 'xiaoxingVoiceState',
  spread: 'xiaoxingVoiceSpread',
});

export function fixedNarrationChapter(text) {
  if (typeof text !== 'string') return null;
  return Object.keys(chapterGuides).find(chapter => chapterGuides[chapter].guide === text.trim()) ?? null;
}
