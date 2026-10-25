import { chapterGuides } from './knowledge.js';

export const voiceProfile = Object.freeze({
  label: '小醒 · 清亮中文女声',
  recordingVoice: 'Microsoft Yaoyao',
  recordingPitch: '+10%',
  recordingRate: '-3%',
  browserPitch: 1.08,
  browserRate: 0.98,
});

export const narrationMediaKeys = Object.freeze({
  entry: 'xiaoxingVoiceEntry', model: 'xiaoxingVoiceModel',
  action: 'xiaoxingVoiceAction', state: 'xiaoxingVoiceState',
});

// Use a known Chinese female voice family. A random default can be an English
// or male voice and would break the chosen character's vocal identity.
const femaleVoiceFamilies = [/xiaoxiao|晓晓/i, /xiaoyi|晓伊/i, /yaoyao|瑶瑶/i, /huihui|慧慧/i];

export function chooseChineseFemaleVoice(voices = []) {
  const chinese = voices.filter(voice => /^zh(?:[-_]|$)/i.test(voice.lang || ''));
  for (const family of femaleVoiceFamilies) {
    const match = chinese.find(voice => family.test(voice.name || ''));
    if (match) return match;
  }
  return null;
}

export function fixedNarrationChapter(text) {
  if (typeof text !== 'string') return null;
  return Object.keys(chapterGuides).find(chapter => chapterGuides[chapter].guide === text.trim()) ?? null;
}
