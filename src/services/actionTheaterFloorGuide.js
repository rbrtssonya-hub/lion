import { CanvasTexture, Group, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace } from 'three';

const FADE_MS = 700;
const IDLE_MS = 5000;
const SETTLE_MS = 500;
const wrapAngle = value => Math.atan2(Math.sin(value), Math.cos(value));
const ease = value => 1 - (1 - value) ** 3;

function drawCloud(ctx, x, y, direction = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(direction, 1);
  ctx.beginPath();
  ctx.moveTo(-36, 9);
  ctx.bezierCurveTo(-18, 9, -25, -13, -8, -13);
  ctx.bezierCurveTo(9, -13, 14, 9, -1, 9);
  ctx.bezierCurveTo(-13, 9, -9, -2, -1, -2);
  ctx.moveTo(-44, 18);
  ctx.bezierCurveTo(-17, 18, 6, 18, 24, 8);
  ctx.stroke();
  ctx.restore();
}

function makeProjection({ title, subtitle, kind }) {
  const canvas = document.createElement('canvas');
  canvas.width = kind === 'compass' ? 1024 : 640;
  canvas.height = 320;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(canvas.width / 1024, 1);
  ctx.strokeStyle = 'rgba(189,134,65,.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(56, 36); ctx.lineTo(400, 36);
  ctx.moveTo(624, 36); ctx.lineTo(968, 36);
  ctx.moveTo(56, 36); ctx.lineTo(56, 252); ctx.lineTo(200, 252);
  ctx.moveTo(968, 36); ctx.lineTo(968, 252); ctx.lineTo(824, 252);
  ctx.stroke();
  drawCloud(ctx, 125, 62);
  drawCloud(ctx, 899, 62, -1);
  ctx.restore();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ebc17b';
  ctx.font = `${kind === 'compass' ? 64 : 96}px "Microsoft YaHei", "Noto Sans CJK SC", sans-serif`;
  ctx.fillText(title, canvas.width / 2, 126);
  ctx.fillStyle = '#ebc17b';
  ctx.font = `${kind === 'compass' ? 46 : 72}px "Microsoft YaHei", "Noto Sans CJK SC", sans-serif`;
  ctx.fillText(subtitle, canvas.width / 2, 219);
  ctx.strokeStyle = 'rgba(235,193,123,.8)';
  ctx.lineWidth = 3;
  if (kind === 'compass') {
    // The dial sits on the same plane as the inscription, not in a HUD.
    ctx.beginPath();
    ctx.ellipse(512, 56, 53, 35, 0, 0, Math.PI * 2);
    ctx.moveTo(491, 56); ctx.lineTo(533, 56);
    ctx.moveTo(512, 36); ctx.lineTo(512, 76);
    ctx.moveTo(280, 130); ctx.lineTo(235, 130); ctx.lineTo(253, 111);
    ctx.moveTo(235, 130); ctx.lineTo(253, 149);
    ctx.moveTo(744, 130); ctx.lineTo(789, 130); ctx.lineTo(771, 111);
    ctx.moveTo(789, 130); ctx.lineTo(771, 149);
    ctx.stroke();
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** Floor decals share the room's RAF and depth buffer. Nothing follows the lens per frame. */
export function createTheaterFloorGuide({ scene }) {
  const root = new Group();
  root.name = 'Spatial_Floor_Interaction_Projection';
  const sideGeometry = new PlaneGeometry(1.5, 1.4);
  const compassGeometry = new PlaneGeometry(1.95, .55);
  const sideTilt = Math.PI / 9;
  const textures = [];
  const panels = [];
  let disposed = false;
  let lastActivity = performance.now();
  let lastMotion = lastActivity;
  let opacity = 1;
  let lastUpdate = 0;
  let aligning = false;
  let rotationEnabled = true;
  const add = (x, z, title, subtitle, kind) => {
    const texture = makeProjection({ title, subtitle, kind });
    textures.push(texture);
    const material = new MeshBasicMaterial({
      map: texture, transparent: true, opacity: .85,
      depthTest: true, depthWrite: false, toneMapped: false,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    });
    const mesh = new Mesh(kind === 'compass' ? compassGeometry : sideGeometry, material);
    mesh.name = `Spatial_Floor_${kind}`;
    const side = kind !== 'compass';
    // A shallow projection rises from the floor instead of foreshortening its
    // glyphs to a few pixels at the low entry camera. Its near edge stays on
    // the floor, and every corner remains outside the existing dais.
    mesh.rotation.x = -Math.PI / 2 + (side ? sideTilt : 0);
    mesh.position.set(x, .036 + (side ? .7 * Math.sin(sideTilt) : 0), z);
    mesh.renderOrder = 2;
    root.add(mesh);
    panels.push({ mesh, kind });
  };
  // Side-aisle instructions sit farther from the lens than the quiet compass,
  // giving the floor lettering enough projected depth at the low entry camera.
  add(-5.4, 1.8, '拖动 · 旋转', '滚轮 · 缩放', 'mouse');
  add(0, 5.05, '观察四周', '左右方向键 · 选择巨幕', 'compass');
  add(5.4, 1.8, '醒狮 · 自转', '选屏 · 转向', 'rotation');
  scene.add(root);

  return {
    reveal() { if (!disposed) lastActivity = performance.now(); },
    setRotationEnabled(value) {
      if (disposed || rotationEnabled === Boolean(value)) return;
      rotationEnabled = Boolean(value);
      const panel = panels.find(item => item.kind === 'rotation');
      const old = panel.mesh.material.map;
      const texture = makeProjection({
        title: rotationEnabled ? '醒狮 · 自转' : '醒狮 · 停转',
        subtitle: '选屏 · 转向', kind: 'rotation',
      });
      panel.mesh.material.map = texture;
      textures.splice(textures.indexOf(old), 1, texture);
      old.dispose();
    },
    update({ now = performance.now(), camera, moving = false, interacting = false }) {
      if (disposed) return;
      const elapsed = lastUpdate ? Math.min(100, Math.max(0, now - lastUpdate)) : 16;
      lastUpdate = now;
      const busy = moving || interacting;
      if (busy) { lastMotion = now; lastActivity = now; }
      const desiredAngle = camera ? Math.atan2(camera.position.x, camera.position.z) : root.rotation.y;
      const difference = Math.abs(wrapAngle(desiredAngle - root.rotation.y));
      if (difference > .035 && now - lastMotion >= SETTLE_MS && !busy) aligning = true;
      const target = aligning ? 0 : now - lastActivity < IDLE_MS ? 1 : 0;
      // Bounded rate provides a smooth fade even when frame delivery is uneven.
      opacity += Math.sign(target - opacity) * Math.min(Math.abs(target - opacity), elapsed / FADE_MS);
      if (aligning && opacity < .015) {
        root.rotation.y = desiredAngle;
        aligning = false;
      }
      const strength = ease(opacity);
      panels.forEach(({ mesh, kind }) => {
        const resting = kind === 'compass' && !aligning ? .13 : 0;
        mesh.material.opacity = Math.max(resting, strength * .85);
        mesh.visible = mesh.material.opacity > .005;
      });
      root.visible = true;
    },
    diagnostics() {
      return {
        mode: opacity > .05 ? 'expanded' : 'quiet',
        opacity, azimuth: root.rotation.y, aligning, rotationEnabled,
        floorY: .036, radius: 5.05, idleMs: IDLE_MS,
        panels: panels.map(({ mesh, kind }) => ({ kind, position: mesh.position.toArray(), tiltDegrees: kind === 'compass' ? 0 : 20 })),
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      root.removeFromParent();
      panels.forEach(({ mesh }) => mesh.material.dispose());
      textures.forEach(texture => texture.dispose());
      sideGeometry.dispose();
      compassGeometry.dispose();
      root.clear();
    },
  };
}
