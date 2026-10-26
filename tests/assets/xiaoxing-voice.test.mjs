import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { chapterGuides } from '../../src/features/assistant/knowledge.js';
import { voiceProfile, fixedNarrationChapter, narrationMediaKeys } from '../../src/features/assistant/voiceProfile.js';

test('selected reference voice covers every current chapter without a browser voice profile', () => {
  assert.equal(voiceProfile.recordingVoice, 'GPT-SoVITS v2ProPlus · 用户参考音色');
  assert.deepEqual(Object.keys(narrationMediaKeys), Object.keys(chapterGuides));
  for (const [chapter, guide] of Object.entries(chapterGuides)) {
    assert.equal(fixedNarrationChapter(guide.guide), chapter);
    assert.equal(fixedNarrationChapter(` ${guide.guide}\n`), chapter);
    assert.equal(typeof narrationMediaKeys[chapter], 'string');
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

test('user-selected MP3 is preserved byte for byte and the inference excerpt is 3–10 seconds', () => {
  const original = readFileSync(new URL('../../source/characters/xiaoxing/voice/reference.mp3', import.meta.url));
  assert.equal(createHash('sha256').update(original).digest('hex'), '9c5a4f87f24095c4a4329d79417629c47279777351188a639deb7529464cda5f');
  const reference = waveFacts(readFileSync(new URL('../../source/characters/xiaoxing/voice/reference.wav', import.meta.url)));
  assert.deepEqual([reference.codec, reference.channels, reference.sampleRate, reference.bits], [1, 1, 32000, 16]);
  assert.ok(reference.seconds >= 3 && reference.seconds <= 10);
  assert.ok(Math.abs(reference.seconds - 7.2) < 0.01);
  assert.ok(reference.rms > 100);
});

test('five generated recordings match the current guide text, exact reference and authenticated WAV files', () => {
  const profile = JSON.parse(readFileSync(new URL('../../source/characters/xiaoxing/voice/profile.json', import.meta.url), 'utf8'));
  assert.equal(profile.voice.engine, 'GPT-SoVITS v2ProPlus');
  assert.equal(profile.voice.name, voiceProfile.recordingVoice);
  assert.equal(profile.voice.culture, 'zh-CN');
  assert.equal(profile.inference.mode, 'zero-shot');
  assert.equal(profile.inference.pitchShift, 0);
  assert.equal(profile.generator, 'scripts/xiaoxing/build-gpt-narration.mjs');
  for (const [fileKey, hashKey] of [['original', 'originalSha256'], ['clip', 'clipSha256']]) {
    const reference = readFileSync(new URL(`../../${profile.reference[fileKey]}`, import.meta.url));
    assert.equal(createHash('sha256').update(reference).digest('hex'), profile.reference[hashKey]);
  }
  assert.deepEqual(profile.records.map(record => record.chapter), Object.keys(chapterGuides));
  assert.equal(new Set(profile.records.map(record => record.sha256)).size, profile.records.length);
  for (const record of profile.records) {
    assert.equal(record.text, chapterGuides[record.chapter].guide);
    const bytes = readFileSync(new URL(`../../${record.runtime}`, import.meta.url));
    assert.equal(bytes.length, record.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), record.sha256);
    const facts = waveFacts(bytes);
    assert.deepEqual([facts.codec, facts.channels, facts.sampleRate, facts.bits], [1, 1, 32000, 16]);
    assert.ok(facts.seconds > 12 && facts.seconds < 180, `${record.chapter}: ${facts.seconds}s`);
    assert.ok(facts.rms > 100, `${record.chapter}: recording must contain non-silent speech`);
  }
  const audition = readFileSync(new URL(`../../${profile.sample.path}`, import.meta.url));
  const sample = waveFacts(audition);
  assert.equal(createHash('sha256').update(audition).digest('hex'), profile.sample.sha256);
  assert.ok(sample.seconds > 2 && sample.seconds < 20);
  assert.ok(sample.rms > 100);
});
