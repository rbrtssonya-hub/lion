import { lionBookPages } from '../data/lion-book.js';
import { adaptLionSketchbookDocument } from './lionSketchbookDocument.js';

const CHANNEL_PREFIX = '#lion-book=';

/** Called by the build-time wrapper around the installed official factory. */
export function adaptLionSketchbookFactory(assetBaseUrl, createOriginalDocument) {
  let url;
  try { url = new URL(assetBaseUrl); } catch { return createOriginalDocument(assetBaseUrl); }
  if (!url.hash.startsWith(CHANNEL_PREFIX)) return createOriginalDocument(assetBaseUrl);
  let channelId;
  try { channelId = decodeURIComponent(url.hash.slice(CHANNEL_PREFIX.length)); } catch {
    throw new Error('Invalid lion archive channel.');
  }
  if (!/^[A-Za-z0-9_-]{1,160}$/.test(channelId)) throw new Error('Invalid lion archive channel.');
  url.hash = '';
  const cleanAssetBaseUrl = url.href;
  return adaptLionSketchbookDocument(createOriginalDocument(cleanAssetBaseUrl), {
    pages: lionBookPages,
    assetBaseUrl: cleanAssetBaseUrl,
    channelId,
  });
}
