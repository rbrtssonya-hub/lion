import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chapterGuides } from '../../src/features/assistant/knowledge.js';

const root = path.resolve(import.meta.dirname, '../..');
const work = path.join(root, 'tmp/xiaoxing-reference-voice');
const source = 'source/characters/xiaoxing/voice';
const runtime = 'source/public/assets/xiaoxing/voice';
const endpoint = process.env.XIAOXING_NARRATION_API_URL || 'http://127.0.0.1:8787/api/xiaoxing/speech';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const original = await fs.readFile(path.join(root, source, 'reference.mp3'));
const reference = await fs.readFile(path.join(root, source, 'reference.wav'));
const approval = JSON.parse(await fs.readFile(path.join(root, source, 'approval.json'), 'utf8'));
if (approval.referenceSha256 !== sha(reference) || approval.sha256 !== sha(await fs.readFile(path.join(root, approval.audition)))) throw Error('已认可试听与当前参考音频不匹配，请先核实音色来源。');
const sampleText = '你好呀，我是小醒。让我陪你一起走进醒狮的世界吧。';
await fs.mkdir(work, { recursive: true });

function waveFacts(bytes) {
  if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE') throw Error('服务未返回WAV音频');
  let format, data;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const kind = bytes.toString('ascii', offset, offset + 4), size = bytes.readUInt32LE(offset + 4);
    if (offset + 8 + size > bytes.length) throw Error('WAV音频不完整');
    if (kind === 'fmt ') format = { codec: bytes.readUInt16LE(offset + 8), channels: bytes.readUInt16LE(offset + 10), sampleRate: bytes.readUInt32LE(offset + 12), byteRate: bytes.readUInt32LE(offset + 16), bits: bytes.readUInt16LE(offset + 22) };
    if (kind === 'data') data = bytes.subarray(offset + 8, offset + 8 + size);
    offset += 8 + size + size % 2;
  }
  if (!format || !data || format.codec !== 1 || format.bits !== 16 || format.channels !== 1) throw Error('需要单声道PCM16音频');
  let energy = 0;
  for (let index = 0; index < data.length; index += 2) energy += data.readInt16LE(index) ** 2;
  const seconds = data.length / format.byteRate, rms = Math.sqrt(energy / (data.length / 2));
  if (seconds < 1 || seconds > 240 || rms < 100) throw Error(`合成音频时长或能量不合理: ${seconds}s, ${rms}`);
  return { ...format, seconds, rms };
}

const outputs = [];
for (const [chapter, text] of [['sample', sampleText], ...Object.entries(chapterGuides).map(([key, value]) => [key, value.guide])]) {
  const key = sha(Buffer.from(`${sha(reference)}:GPT-SoVITS-v2ProPlus:seed42:${text}`));
  const file = path.join(work, `${chapter}-${key.slice(0, 12)}.wav`);
  let bytes;
  try { bytes = await fs.readFile(file); waveFacts(bytes); }
  catch {
    console.log(`Generating ${chapter} (${text.length} characters)…`);
    const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }), signal: AbortSignal.timeout(180_000) });
    if (!response.ok) throw Error(`${chapter}: 语音接口返回${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
    waveFacts(bytes);
    await fs.writeFile(file, bytes);
  }
  const facts = waveFacts(bytes);
  outputs.push({ chapter, text, file, bytes: bytes.length, sha256: sha(bytes), seconds: facts.seconds, sampleRate: facts.sampleRate });
  console.log(`${chapter}: ${facts.seconds.toFixed(2)}s, ${bytes.length} bytes`);
}

const profile = {
  version: 2, generator: 'scripts/xiaoxing/build-gpt-narration.mjs', generatedAt: new Date().toISOString(),
  textSource: 'src/features/assistant/knowledge.js#chapterGuides',
  voice: { engine: 'GPT-SoVITS v2ProPlus', name: 'GPT-SoVITS v2ProPlus · 用户参考音色', culture: 'zh-CN', gender: 'Female' },
  approval,
  reference: { original: `${source}/reference.mp3`, originalSha256: sha(original), clip: `${source}/reference.wav`, clipSha256: sha(reference), startSeconds: 0, seconds: waveFacts(reference).seconds, promptText: '', promptLanguage: 'zh' },
  inference: { mode: 'zero-shot', repository: 'https://github.com/RVC-Boss/GPT-SoVITS', codeRevision: 'b4570b876f5c086819ba84e3215472733c6a7b70', weightsRevision: '8f8857563c040d542de108a2c18b0425abd6c9c5', seed: 42, speedFactor: 1, pitchShift: 0 },
  audio: { container: 'WAV', codec: 'PCM signed 16-bit little-endian', sampleRate: outputs[0].sampleRate, channels: 1 },
  records: outputs.filter(item => item.chapter !== 'sample').map(({ chapter, text, bytes, sha256, seconds }) => ({ chapter, text, spokenText: text.replace(/\bAI\b/gi, '人工智能'), runtime: `${runtime}/${chapter}.wav`, bytes, sha256, seconds })),
  sample: { text: sampleText, path: `${source}/sample.wav`, bytes: outputs[0].bytes, sha256: outputs[0].sha256, seconds: outputs[0].seconds },
};
await fs.writeFile(path.join(work, 'profile.json'), JSON.stringify(profile, null, 2) + '\n');
if (process.argv.includes('--apply')) {
  for (const item of outputs) await fs.copyFile(item.file, path.join(root, item.chapter === 'sample' ? profile.sample.path : `${runtime}/${item.chapter}.wav`));
  await fs.writeFile(path.join(root, source, 'profile.json'), JSON.stringify(profile, null, 2) + '\n');
  console.log('Applied all generated clips and their exact text/hash profile. Run register-assets.mjs next.');
} else console.log(`Review candidates at ${work}; use --apply after the real GPT-SoVITS synthesis succeeds.`);
