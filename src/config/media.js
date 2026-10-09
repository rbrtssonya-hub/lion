// Files live in source/public; Vite serves and copies them without altering bytes.
import { assetPaths } from './assetPaths.js';
export { assetPaths } from './assetPaths.js';

export const media = Object.fromEntries(
  Object.entries(assetPaths).map(([key, path]) => [key, `${import.meta.env.BASE_URL}${path}`]),
);
