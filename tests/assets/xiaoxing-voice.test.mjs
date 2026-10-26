import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { chapterGuides } from '../../src/features/assistant/knowledge.js';
import { voiceProfile, chooseChineseFemaleVoice, fixedNarrationChapter, narrationMediaKeys } from '../../src/features/assistant/voiceProfile.js';

test('dynamic voice selection preserves a known Chinese female family and refuses arbitrary defaults', () => {
  const male = { name: 'Microsoft Kangkang', lang: 'zh-CN' };
  const english = { name: 'Microsoft Xiaoxiao', lang: 'en-US' };
  const huihui = { name: 'Microsoft Huihui Desktop - Chinese (Simplified)', lang: 'zh-CN' };
  const yaoyao = { name: 'Microsoft Yaoyao - Chinese', lang: 'zh-CN' };
  const xiaoxiao = { name: 'Microsoft Xiaoxiao Online (Natural)', lang: 'zh-CN' };
  assert.equal(chooseChineseFemaleVoice([male, english]), null);
  assert.equal(chooseChineseFemaleVoice([male, huihui, yaoyao]), yaoyao);
  assert.equal(chooseChineseFemaleVoice([male, huihui, yaoyao, xiaoxiao]), xiaoxiao);
  assert.equal(chooseChineseFemaleVoice([{ name: 'Default', lang: 'zh-CN' }]), null);
  assert.equal(chooseChineseFemaleVoice([]), null);
  assert.ok(voiceProfile.browserPitch >= 1.05 && voiceProfile.browserPitch <= 1.12);
  assert.ok(voiceProfile.browserRate >= 0.94 && voiceProfile.browserRate <= 1.03);
});

test('fixed narration recognizes exact guide text and uses clips only for chapters with current recordings', () => {
  const recordedChapters = ['model', 'action', 'state'];
  for (const [chapter, guide] of Object.entries(chapterGuides)) {
    assert.equal(fixedNarrationChapter(guide.guide), chapter);
    assert.equal(fixedNarrationChapter(` ${guide.guide}\n`), chapter);
    assert.equal(typeof narrationMediaKeys[chapter], recordedChapters.includes(chapter) ? 'string' : 'undefined');
  }
  assert.equal(fixedNarrationChapter('你好，小醒'), null);
  assert.equal(fixedNarrationChapter(chapterGuides.entry.guide.slice(0, 20)), null);
  assert.equal(fixedNarrationChapter(undefined), null);
});

function waveFacts(bytes) {
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
  assert.equal(bytes.toString('ascii', 8, 12), 'WAVE');
  let format, pcm;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const kind = bytes.toString('ascii', offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    assert.ok(offset + 8 + size <= bytes.length);
    if (kind === 'fmt ') format = {
      codec: bytes.readUInt16LE(offset + 8), channels: bytes.readUInt16LE(offset + 10),
      sampleRate: bytes.readUInt32LE(offset + 12), byteRate: bytes.readUInt32LE(offset + 16), bits: bytes.readUInt16LE(offset + 22),
    };
    if (kind === 'data') pcm = bytes.subarray(offset + 8, offset + 8 + size);
    offset += 8 + size + size % 2;
  }
  assert.ok(format && pcm);
  let energy = 0;
  for (let index = 0; index + 2 <= pcm.length; index += 2) energy += pcm.readInt16LE(index) ** 2;
  return { ...format, seconds: pcm.length / format.byteRate, rms: Math.sqrt(energy / (pcm.length / 2)) };
}

test('three unchanged packaged recordings retain the selected female profile and exact source guide text', () => {
  const profile = JSON.parse(readFileSync(new URL('../../source/characters/xiaoxing/voice/profile.json', import.meta.url), 'utf8'));
  assert.equal(profile.voice.gender, 'Female');
  assert.equal(profile.voice.culture, 'zh-CN');
  assert.equal(profile.voice.name, voiceProfile.recordingVoice);
  assert.equal(profile.prosody.pitch, voiceProfile.recordingPitch);
  assert.equal(profile.prosody.rate, voiceProfile.recordingRate);
  assert.deepEqual(profile.records.map(record => record.chapter), ['model', 'action', 'state']);
  for (const record of profile.records) {
    assert.equal(record.text, chapterGuides[record.chapter].guide);
    const bytes = readFileSync(new URL(`../../${record.runtime}`, import.meta.url));
    assert.equal(bytes.length, record.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), record.sha256);
    const facts = waveFacts(bytes);
    assert.deepEqual([facts.codec, facts.channels, facts.sampleRate, facts.bits], [1, 1, 22050, 16]);
    assert.ok(facts.seconds > 15 && facts.seconds < 100, `${record.chapter}: ${facts.seconds}s`);
    assert.ok(facts.rms > 100, `${record.chapter}: recording must contain actual non-silent speech`);
    const ssml = readFileSync(new URL(`../../${record.ssml}`, import.meta.url), 'utf8');
    assert.ok(ssml.includes('pitch="+10%" rate="-3%"'));
    assert.ok(ssml.includes(record.text));
  }
  const audition = readFileSync(new URL(`../../${profile.sample.path}`, import.meta.url));
  const sample = waveFacts(audition);
  assert.equal(createHash('sha256').update(audition).digest('hex'), profile.sample.sha256);
  assert.ok(sample.seconds > 3 && sample.seconds < 12);
  assert.ok(sample.rms > 100);
});
