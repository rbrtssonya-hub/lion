import assert from 'node:assert/strict';

export function readLosslessWebp(bytes) {
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
  assert.equal(bytes.readUInt32LE(4) + 8, bytes.length);
  assert.equal(bytes.toString('ascii', 8, 16), 'WEBPVP8L');
  assert.equal(bytes[20], 0x2f);
  const header = bytes.readUInt32LE(21);
  return { width: (header & 0x3fff) + 1, height: ((header >>> 14) & 0x3fff) + 1, alpha: Boolean(header & 0x10000000) };
}
