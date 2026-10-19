import { PlaneGeometry, Vector2 } from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';

// One modest planar render target is shared by the stone foreground. Spatial
// blur and a varying stone finish keep this a polished floor, not a mirror.
export function createTheaterReflection({ size = 768, floorY = 0.012 } = {}) {
  const shader = {
    name: 'Theater_Rough_Obsidian_Reflection',
    uniforms: {
      color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null },
      texel: { value: new Vector2(1 / size, 1 / size) },
    },
    vertexShader: `
      uniform mat4 textureMatrix;
      varying vec4 reflectedUv;
      varying vec2 stoneUv;
      #include <common>
      #include <logdepthbuf_pars_vertex>
      void main() {
        reflectedUv = textureMatrix * vec4(position, 1.0);
        stoneUv = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform vec2 texel;
      varying vec4 reflectedUv;
      varying vec2 stoneUv;
      #include <common>
      #include <logdepthbuf_pars_fragment>
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.)),f.x),f.y);
      }
      void main() {
        #include <logdepthbuf_fragment>
        vec2 uv = reflectedUv.xy / reflectedUv.w;
        float grain = noise(stoneUv*3.6);
        float cloud = noise(stoneUv*.75 + vec2(noise(stoneUv*.2)*3.0));
        float vein = pow(abs(sin(stoneUv.x*.9 + stoneUv.y*.57 + cloud*8.0)), 22.0);
        vec2 blur = texel*(2.0 + grain*3.0);
        vec3 reflection = texture2D(tDiffuse,uv).rgb*.20;
        reflection += texture2D(tDiffuse,uv+vec2(blur.x,0.)).rgb*.12;
        reflection += texture2D(tDiffuse,uv-vec2(blur.x,0.)).rgb*.12;
        reflection += texture2D(tDiffuse,uv+vec2(0.,blur.y)).rgb*.12;
        reflection += texture2D(tDiffuse,uv-vec2(0.,blur.y)).rgb*.12;
        reflection += texture2D(tDiffuse,uv+blur).rgb*.08;
        reflection += texture2D(tDiffuse,uv-blur).rgb*.08;
        reflection += texture2D(tDiffuse,uv+vec2(blur.x,-blur.y)).rgb*.08;
        reflection += texture2D(tDiffuse,uv+vec2(-blur.x,blur.y)).rgb*.08;
        vec3 stone = vec3(.018,.010,.007)*(0.75+cloud*.6) + vein*vec3(.009,.006,.003);
        gl_FragColor = vec4(stone + reflection*mix(.19,.32,cloud),1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  };
  const reflector = new Reflector(new PlaneGeometry(20, 20), {
    textureWidth: size, textureHeight: size, clipBias: 0.004,
    multisample: 0, shader,
  });
  reflector.name = 'Theater_Polished_Stone_Reflection';
  reflector.rotation.x = -Math.PI / 2;
  reflector.position.y = floorY;
  const renderReflection = reflector.onBeforeRender;
  let lastUpdate = -Infinity;
  let passes = 0;
  let maxHz = 18;
  let enabled = true;
  // Reflector reuses its virtual camera/matrices; no allocations in this hook.
  reflector.onBeforeRender = function (...args) {
    const now = performance.now();
    if (!enabled || now - lastUpdate < 1000 / maxHz) return;
    lastUpdate = now;
    renderReflection.apply(this, args);
    passes += 1;
  };
  return {
    object: reflector,
    diagnostics: () => ({ enabled, size, passes, maxHz, blurTaps: 9 }),
    reduceQuality() {
      size = 512;
      maxHz = 9;
      reflector.getRenderTarget().setSize(size, size);
      reflector.material.uniforms.texel.value.set(1 / size, 1 / size);
    },
    setEnabled(value) { enabled = Boolean(value); reflector.visible = enabled; },
    dispose() { reflector.dispose(); },
  };
}
