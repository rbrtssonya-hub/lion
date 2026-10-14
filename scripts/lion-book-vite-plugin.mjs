import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FACTORY_IMPORT = 'virtual:lion-book-sketchbook-factory';
const FACTORY_PATH = fileURLToPath(new URL('../src/services/lionSketchbookFactory.js', import.meta.url)).replaceAll('\\', '/');
const PACKAGE_FILE = new URL('../node_modules/@designcodeio/threeui/package.json', import.meta.url);
const DOCUMENT_MODULE = /(?:^|\/)node_modules\/@designcodeio\/threeui\/lib-dist\/shaders\/sketchbook\/sketchbookDocument\.js$/;
const EXPECTED_SHA256 = '69e007c4214b1d3e58de71b8baabf64e5d45a4fd5f5144dffa1c8b7cacf39be7';
const ORIGINAL_RETURN = '  return t.replaceAll("sketchbook/", e).replace("</head>", `${a}</head>`);';

/** Adapt the official factory result before React receives its srcDoc prop. */
export function lionBookPlugin() {
  return {
    name: 'lion-book-threeui-document',
    enforce: 'pre',
    resolveId(id) {
      return id === FACTORY_IMPORT ? FACTORY_PATH : null;
    },
    transform(code, id) {
      const sourcePath = id.split('?')[0].replaceAll('\\', '/');
      if (!DOCUMENT_MODULE.test(sourcePath)) return null;
      const version = JSON.parse(readFileSync(PACKAGE_FILE, 'utf8')).version;
      const digest = createHash('sha256').update(code.replace(/\r\n/g, '\n')).digest('hex');
      if (version !== '1.2.0' || digest !== EXPECTED_SHA256 || code.split(ORIGINAL_RETURN).length !== 2) {
        throw new Error('ThreeUI Sketchbook factory changed; audit the locked 1.2.0 source before adapting it.');
      }
      // The canonical HTML, embedded paper engine and original host stylesheet
      // remain byte for byte. Only the factory return is wrapped. Unmarked
      // Sketchbook instances still receive their unchanged upstream document.
      const wrappedReturn = `  return __lionBookFactory(n, (cleanAssetBaseUrl) => {
    const e = cleanAssetBaseUrl.endsWith("/") ? cleanAssetBaseUrl : cleanAssetBaseUrl + "/";
    return t.replaceAll("sketchbook/", e).replace("</head>", \`\${a}</head>\`);
  });`;
      return {
        code: `import { adaptLionSketchbookFactory as __lionBookFactory } from ${JSON.stringify(FACTORY_IMPORT)};\n${code.replace(ORIGINAL_RETURN, () => wrappedReturn)}`,
        map: null,
      };
    },
  };
}
