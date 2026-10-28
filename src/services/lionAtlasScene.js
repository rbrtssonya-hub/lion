import { media } from '../config/media.js';
import { createLionScene } from './lionScene.js';

// Camera composition retained from 炫技5. The underlying model, full strands,
// AgX output and HDRI lighting remain owned by lionScene, never by the demo.
const framings = {
  brows: { direction: [.30, .05, 1], offset: [.10, -.10, 0], distanceFactor: 1 },
  crown: { direction: [.38, .85, 1], offset: [0, .10, 0], distanceFactor: 1.55 },
  beard: { direction: [.60, -.17, 1], offset: [0, -.10, .05], distanceFactor: 1.05 },
  body: { direction: [1, .36, -.08], offset: [0, 0, 0], distanceFactor: .85 },
  trim: { direction: [.85, .85, -1], offset: [0, .10, -.15], distanceFactor: 1.02 },
  mouth: { direction: [.25, -.20, 1], offset: [0, -.05, .05], distanceFactor: .95 },
};
// Source-space bounds registered by 炫技5/public/models/lion.glb and its
// public/data/handoff-cameras.json (source SHA cc5f72c3… is unchanged here).
// These include the experiment's sampled hair silhouette. Referencing their
// composition keeps the photograph handoff stable while the current engine
// continues drawing every original strand instead of those sampled ribbons.
const registeredBounds = {
  brows: { min: [-.2674725893884897, .6300641596317291, .5450076460838318], max: [.2653828915208578, .9049769639968872, .7799858003854752] },
  crown: { min: [-.09730876563116908, .7131207436323166, .35955269634723663], max: [.0981134888716042, .9999999776482582, .7449191231280565] },
  beard: { min: [-.3544592373073101, .18537843227386475, .12724947929382324], max: [.3534652180969715, .7051056027412415, .7548273801803589] },
  body: { min: [-.35502736642956734, .07387679815292358, -.6109684091061354], max: [.3588434271514416, .7639043629169464, .6040153279900551] },
  trim: { min: [-.3165824548341334, .3057231158018112, -.5578588247299194], max: [.31101600965484977, .7878578901290894, .2724246606230736] },
  mouth: { min: [-.13928601145744324, .3854926824569702, .5770141929388046], max: [.13928602635860443, .49269211292266846, .7322186827659607] },
};
const definitions = [
  ['brows', /Lion_Brow/], ['crown', /Lion_Crown|Lion_Forehead|Lion_Head/],
  ['beard', /Lion_Beard|Ivory|Beard_Hair/], ['body', /^Lion_Body(?:[._]\d+)?$/],
  ['trim', /Lion_Body_Red_Trim/], ['mouth', /上牙|牙下|立方体|Tongue|Teeth/],
].map(([id, names]) => ({
  id,
  referenceBounds: registeredBounds[id],
  matches(object) {
    // GLTFLoader sanitizes dots in node names and can place primitives below
    // their named parent. Match its preserved source name at either level.
    for (let node = object; node; node = node.parent) {
      if (names.test(node.userData.sourceName || node.userData.name || node.name)) return true;
    }
    return false;
  },
}));

export async function createLionAtlasScene({
  container, lightingSettings, onSelect = () => {}, onReady = () => {},
  onProgress = () => {}, onError = () => {}, getReferenceAspect,
  active = true, signal, onLightingStatus,
}) {
  const scene = await createLionScene({
    container, interactionElement: container, modelUrl: media.model,
    lightingSettings, active, signal, onLightingStatus,
    atlas: { parts: definitions, framings, getReferenceAspect, headAlias: /Lion_Nose/ },
    onSelectPart: onSelect,
    onStatus(status) {
      if (status.phase === 'ready') onProgress(100);
      else if (status.phase === 'error') onError(status.message);
      else {
        const percentage = status.message.match(/(\d+)%/);
        if (percentage) onProgress(Number(percentage[1]));
      }
    },
  });
  const world = { ...scene, reset: () => scene.resetView() };
  onReady(scene.registry);
  return world;
}
