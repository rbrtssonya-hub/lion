import {
  BoxGeometry, BufferGeometry, CatmullRomCurve3, CylinderGeometry, DataTexture, Float32BufferAttribute,
  Group, InstancedMesh, LinearFilter, LinearMipmapLinearFilter, Matrix4, Mesh, MeshPhysicalMaterial, MeshStandardMaterial,
  Quaternion, RepeatWrapping, RGBAFormat, TorusGeometry, TubeGeometry,
  UnsignedByteType, Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const THEATER_ARCHITECTURE = Object.freeze({
  floorY: 0.012,
  stageTop: 0.4,
  stageRadius: 4.7,
  roomScale: 1,
  columnOffset: 8.65,
  beamBottom: 8.99,
  screenWidth: 14.4,
  screenHeight: 8.1,
  screenCenterY: 4.85,
  screenDistance: 9.55,
});

// Every curl is actual raised brass geometry. Repeated copies are batched;
// no reference-image backdrop or emissive outline stands in for a carving.
function makePetalGeometry() {
  const outline = [[-0.5, 0, 0], [-0.16, 0.5, 0], [0.25, 0.34, 0], [0.5, 0, 0], [0.25, -0.34, 0], [-0.16, -0.5, 0]];
  const positions = [];
  // Two low ridges make a closed, faceted metal leaf rather than a decal.
  for (let index = 0; index < outline.length; index += 1) {
    const next = (index + 1) % outline.length;
    positions.push(0, 0, 0.16, ...outline[next], ...outline[index]);
    positions.push(0, 0, -0.07, ...outline[index], ...outline[next]);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(new Float32Array(positions.length / 3 * 2), 2));
  geometry.setIndex(Array.from({ length: positions.length / 3 }, (_, index) => index));
  geometry.computeVertexNormals();
  return geometry;
}

function makeScrollGeometry() {
  const parts = [];
  const tube = (points, radius = 0.017, segments = 12, radialSegments = 4, z = 0) => {
    parts.push(new TubeGeometry(new CatmullRomCurve3(points.map(([x, y]) => new Vector3(x, y, z))), segments, radius, radialSegments, false));
  };
  const petal = makePetalGeometry();
  const leaf = (x, y, angle, length, width, z = 0.006) => {
    parts.push(petal.clone().scale(length, width, 0.12).rotateZ(angle).translate(x, y, z));
  };
  for (const sign of [-1, 1]) {
    tube([[-0.48, 0], [-0.34, sign * 0.11], [-0.12, sign * 0.17], [0.07, sign * 0.12], [0.13, sign * 0.02], [0.04, -sign * 0.015], [-0.015, sign * 0.04]]);
    tube([[0.48, 0], [0.34, -sign * 0.11], [0.12, -sign * 0.17], [-0.07, -sign * 0.12], [-0.13, -sign * 0.02], [-0.04, sign * 0.015], [0.015, -sign * 0.04]]);
    tube([[-0.28, sign * 0.1], [-0.24, sign * 0.22], [-0.12, sign * 0.23], [-0.08, sign * 0.18]], 0.012);
    tube([[0.28, sign * 0.1], [0.24, sign * 0.22], [0.12, sign * 0.23], [0.08, sign * 0.18]], 0.012);
  }
  tube([[-0.1, 0], [0, 0.095], [0.1, 0], [0, -0.095], [-0.1, 0]], 0.016);
  for (const sign of [-1, 1]) {
    for (const [x, y, angle] of [[-0.32, sign * 0.14, sign * 2.5], [-0.18, sign * 0.185, sign * 0.38], [0.32, -sign * 0.14, -sign * 0.6], [0.18, -sign * 0.185, sign * (Math.PI + 0.38)]]) {
      leaf(x, y, angle, 0.14, 0.065);
    }
    // Small opposing volutes fill the previously empty eye-shaped outline.
    tube([[-0.43 * sign, 0], [-0.40 * sign, 0.07 * sign], [-0.33 * sign, 0.085 * sign], [-0.28 * sign, 0.04 * sign], [-0.30 * sign, -0.015 * sign], [-0.35 * sign, -0.008 * sign], [-0.36 * sign, 0.022 * sign]], 0.009, 8, 3, 0.008);
    for (const x of [-0.32, 0.32]) {
      const y = (x < 0 ? sign : -sign) * 0.14;
      tube([[x - 0.04, y - sign * 0.02], [x, y], [x + 0.04, y + sign * 0.02]], 0.0055, 6, 3, 0.024);
    }
  }
  for (let index = 0; index < 8; index += 1) {
    const angle = index * Math.PI / 4;
    leaf(Math.cos(angle) * 0.043, Math.sin(angle) * 0.043, angle, 0.082, 0.038, 0.013);
  }
  petal.dispose();
  const result = mergeGeometries(parts, false);
  parts.forEach((part) => part.dispose());
  result.computeBoundingSphere();
  return result;
}

function makeMeanderGeometry() {
  const points = [
    [-0.48, -0.13], [-0.48, 0.13], [-0.08, 0.13], [-0.08, -0.02],
    [-0.32, -0.02], [-0.32, -0.13], [0.48, -0.13], [0.48, 0.13],
    [0.08, 0.13], [0.08, -0.02], [0.32, -0.02],
  ];
  const bar = new BoxGeometry(1, 1, 1);
  const parts = [];
  const up = new Vector3(0, 1, 0);
  for (let i = 1; i < points.length; i += 1) {
    const from = new Vector3(...points[i - 1], 0);
    const to = new Vector3(...points[i], 0);
    const delta = to.clone().sub(from);
    const matrix = new Matrix4().compose(
      from.add(to).multiplyScalar(0.5),
      new Quaternion().setFromUnitVectors(up, delta.clone().normalize()),
      new Vector3(0.022, delta.length() + 0.012, 0.025),
    );
    parts.push(bar.clone().applyMatrix4(matrix));
  }
  bar.dispose();
  const result = mergeGeometries(parts, false);
  parts.forEach((part) => part.dispose());
  return result;
}

function makeStoneRoughness() {
  const width = 128;
  const pixels = new Uint8Array(width * width * 4);
  for (let y = 0; y < width; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const grain = (Math.sin(x * 127.1 + y * 311.7) * 43758.5453) % 1;
      const vein = Math.sin(x * 0.05 + Math.sin(y * 0.04) * 2.1);
      const value = Math.round(185 + grain * 5 + vein * 9);
      const offset = (y * width + x) * 4;
      pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = value;
      pixels[offset + 3] = 255;
    }
  }
  const texture = new DataTexture(pixels, width, width, RGBAFormat, UnsignedByteType);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.set(7, 7);
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  texture.name = 'Theater_Stone_Fine_Roughness';
  return texture;
}

/** Reusable, fourfold-symmetric real geometry; lifecycle is owned by the scene. */
export function createTheaterArchitecture(options = {}) {
  const params = { ...THEATER_ARCHITECTURE, ...options };
  const { floorY, stageTop, stageRadius, roomScale, columnOffset, screenWidth, screenHeight, screenCenterY, screenDistance } = params;
  const root = new Group();
  root.name = 'Theater_RedGold_Architecture';
  const building = new Group();
  building.name = 'Theater_Column_Beam_Screen_Envelope';
  building.scale.setScalar(roomScale);
  root.add(building);
  let owner = root;
  const componentCounts = {};
  const countComponent = (name) => { componentCounts[name] = (componentCounts[name] ?? 0) + 1; };
  const roughnessMap = makeStoneRoughness();
  const materials = {
    lacquer: new MeshPhysicalMaterial({ color: '#590d0d', roughness: 0.44, metalness: 0.05, specularIntensity: 0.22, clearcoat: 0.12, clearcoatRoughness: 0.38, envMapIntensity: 0.12 }),
    redShadow: new MeshStandardMaterial({ color: '#2c0f0b', roughness: 0.54, metalness: 0.12, envMapIntensity: 0.45 }),
    gold: new MeshStandardMaterial({ color: '#bd8641', roughness: 0.3, metalness: 0.82, envMapIntensity: 0.85 }),
    goldLight: new MeshStandardMaterial({ color: '#e4ba76', roughness: 0.25, metalness: 0.86, envMapIntensity: 0.95 }),
    bronzeShadow: new MeshStandardMaterial({ color: '#64502f', roughness: 0.48, metalness: 0.72, envMapIntensity: 0.5 }),
    blackFrame: new MeshStandardMaterial({ color: '#110b09', roughness: 0.38, metalness: 0.62, envMapIntensity: 0.55 }),
    stone: new MeshPhysicalMaterial({ color: '#1b100d', metalness: 0.22, roughness: 0.54, roughnessMap, clearcoat: 0.42, clearcoatRoughness: 0.24, envMapIntensity: 0.75 }),
    stageStone: new MeshPhysicalMaterial({ color: '#241610', metalness: 0.08, roughness: 0.5, roughnessMap, specularIntensity: 0.12, specularColor: '#bfa78c', clearcoat: 0, envMapIntensity: 0.25 }),
    warmEdge: new MeshStandardMaterial({ color: '#9d6526', emissive: '#e3a450', emissiveIntensity: 0.65, roughness: 0.35, metalness: 0.62 }),
  };
  Object.entries(materials).forEach(([name, material]) => { material.name = `Theater_Architecture_${name}`; });

  const box = new BoxGeometry(1, 1, 1);
  const cylinder = new CylinderGeometry(1, 1, 1, 48);
  const scroll = makeScrollGeometry();
  const flatScroll = scroll.clone().rotateX(-Math.PI / 2);
  const lotusPetal = makePetalGeometry().rotateZ(Math.PI / 2);
  const meander = makeMeanderGeometry();
  const batches = new Map();
  const matrix = new Matrix4();
  const quaternion = new Quaternion();
  const position = new Vector3();
  const scale = new Vector3();
  const axis = new Vector3(0, 1, 0);
  const add = (name, geometry, material, xyz, dimensions = [1, 1, 1], angle = 0, shadow = false) => {
    countComponent(name);
    const key = `${owner.uuid}:${geometry.uuid}:${material.uuid}:${shadow}`;
    if (!batches.has(key)) batches.set(key, { name, geometry, material, shadow, owner, transforms: [] });
    position.fromArray(xyz);
    scale.fromArray(dimensions);
    quaternion.setFromAxisAngle(axis, angle);
    matrix.compose(position, quaternion, scale);
    batches.get(key).transforms.push(matrix.clone());
  };
  const block = (name, material, xyz, dimensions, angle = 0, shadow = false) => add(name, box, material, xyz, dimensions, angle, shadow);
  const horizontalRing = (name, radius, tubeRadius, y, material, segments = 160) => {
    const mesh = new Mesh(new TorusGeometry(radius, tubeRadius, 6, segments), material);
    mesh.name = name;
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = y;
    mesh.receiveShadow = true;
    root.add(mesh);
    countComponent(name);
    return mesh;
  };
  const columnRingGeometry = new TorusGeometry(1, 0.043, 6, 40);
  columnRingGeometry.rotateX(-Math.PI / 2);

  // A nearly black brown slab replaces the old orthogonal test-grid floor.
  const floor = new Mesh(new BoxGeometry(20 * roomScale, 0.028, 20 * roomScale), materials.stone);
  floor.name = 'Theater_Polished_Stone_Floor';
  floor.position.y = floorY - 0.014;
  floor.receiveShadow = true;
  root.add(floor);
  countComponent(floor.name);
  horizontalRing('Theater_Floor_Inlay_Outer', stageRadius + 0.91, 0.012, floorY + 0.005, materials.bronzeShadow);
  horizontalRing('Theater_Floor_Inlay_Inner', stageRadius + 0.67, 0.008, floorY + 0.005, materials.bronzeShadow);
  for (let i = 0; i < 64; i += 1) {
    const angle = i * Math.PI * 2 / 64;
    const radius = stageRadius + 0.79;
    add('Theater_Floor_Inlaid_Clouds', flatScroll, materials.bronzeShadow,
      [Math.sin(angle) * radius, floorY + 0.009, Math.cos(angle) * radius], [0.46, 0.06, 0.28], angle);
  }
  // Perimeter stepping-key inlay is quiet, irregular stone remains dominant.
  owner = building;
  for (let side = 0; side < 4; side += 1) {
    const a = side * Math.PI / 2;
    for (let index = 0; index < 18; index += 1) {
      const x = -8.5 + index;
      const z = -8.75;
      const px = Math.cos(a) * x + Math.sin(a) * z;
      const pz = -Math.sin(a) * x + Math.cos(a) * z;
      block('Theater_Floor_Perimeter_Inlay', materials.bronzeShadow, [px, floorY + 0.006, pz], [0.68, 0.008, 0.025], a);
    }
  }

  // The full dais is only 40 cm tall, with three distinct bevelled layers.
  owner = root;
  add('Theater_Stage_Low_Base', cylinder, materials.blackFrame, [0, 0.045, 0], [stageRadius, 0.09, stageRadius]);
  // Sample the actual rendered shared cylinder and its instance transform.
  // This adds no draw call and includes the outer base below the inset top.
  const stageBaseMatrix = matrix.clone();
  const stageBoundsPoints = [];
  const baseVertices = cylinder.getAttribute('position');
  for (let index = 0; index < baseVertices.count; index += 1) {
    stageBoundsPoints.push(new Vector3().fromBufferAttribute(baseVertices, index).applyMatrix4(stageBaseMatrix));
  }
  add('Theater_Stage_Bronze_Plinth', cylinder, materials.gold, [0, 0.105, 0], [stageRadius - 0.055, 0.05, stageRadius - 0.055]);
  add('Theater_Stage_Carved_Fascia', cylinder, materials.blackFrame, [0, 0.225, 0], [stageRadius - 0.115, 0.19, stageRadius - 0.115]);
  const stageTopMesh = new Mesh(new CylinderGeometry(stageRadius - 0.17, stageRadius - 0.17, 0.065, 160), materials.stageStone);
  stageTopMesh.name = 'Theater_Stage_Polished_Stone_Top';
  stageTopMesh.position.y = stageTop - 0.0325;
  stageTopMesh.receiveShadow = true;
  root.add(stageTopMesh);
  countComponent(stageTopMesh.name);
  horizontalRing('Theater_Stage_Lower_Gold_Bevel', stageRadius - 0.045, 0.035, 0.122, materials.goldLight);
  horizontalRing('Theater_Stage_Upper_Gold_Bevel', stageRadius - 0.145, 0.033, stageTop - 0.052, materials.goldLight);
  horizontalRing('Theater_Stage_Warm_Recess', stageRadius - 0.09, 0.011, 0.143, materials.warmEdge);
  for (const inset of [0.27, 0.4, 0.69]) {
    horizontalRing('Theater_Stage_Concentric_Brass_Inlay', stageRadius - inset, 0.008, stageTop + 0.003, materials.gold);
  }
  for (let i = 0; i < 72; i += 1) {
    const a = i * Math.PI * 2 / 72;
    const radius = stageRadius - 0.105;
    add('Theater_Stage_Continuous_Raised_Clouds', scroll, materials.gold,
      [Math.sin(a) * radius, 0.235, Math.cos(a) * radius], [0.35, 0.31, 0.55], a);
  }

  // Four corner supports preserve all screen apertures and four-way orbit.
  owner = building;
  for (const xSign of [-1, 1]) {
    for (const zSign of [-1, 1]) {
      const x = xSign * columnOffset;
      const z = zSign * columnOffset;
      block('Theater_Column_Stone_Foot', materials.blackFrame, [x, 0.18, z], [0.92, 0.36, 0.92], 0, true);
      add('Theater_Column_Lotus_Foot', cylinder, materials.gold, [x, 0.42, z], [0.46, 0.12, 0.46]);
      add('Theater_Column_Red_Lacquer', cylinder, materials.lacquer, [x, 4.9, z], [0.34, 8.9, 0.34], 0, true);
      for (const y of [0.54, 0.65, 0.84, 8.55, 8.7, 8.91, 9.19]) {
        add('Theater_Column_Brass_Collars', columnRingGeometry, materials.goldLight, [x, y, z], [0.37, 0.75, 0.37]);
      }
      for (const y of [0.53, 8.5]) {
        for (let layer = 0; layer < 2; layer += 1) {
          for (let index = 0; index < 16; index += 1) {
            const a = (index + layer * 0.5) * Math.PI / 8;
            const radius = 0.405 - layer * 0.027;
            add('Theater_Column_Layered_Lotus_Petals', lotusPetal, materials.gold,
              [x + Math.sin(a) * radius, y + layer * 0.11, z + Math.cos(a) * radius], [0.16, 0.27, 0.18], a);
          }
        }
      }
      for (const y of [0.74, 8.82]) {
        add('Theater_Column_Embossed_Cuff', cylinder, materials.gold, [x, y, z], [0.366, 0.19, 0.366]);
        for (let k = 0; k < 8; k += 1) {
          const a = k * Math.PI / 4;
          add('Theater_Column_Cuff_Carving', scroll, materials.goldLight,
            [x + Math.sin(a) * 0.374, y, z + Math.cos(a) * 0.374], [0.22, 0.22, 0.6], a);
        }
      }
      block('Theater_Column_Carved_Capital', materials.redShadow, [x, 9.31, z], [0.82, 0.35, 0.82], 0, true);
      for (let direction = 0; direction < 4; direction += 1) {
        const a = direction * Math.PI / 2;
        for (let level = 0; level < 3; level += 1) {
          const length = 0.77 + level * 0.31;
          block('Theater_Dougong_Stepped_Arms', materials.lacquer, [x, 8.99 + level * 0.19, z], [length, 0.13, 0.21], a, true);
          block('Theater_Dougong_Brass_Edge', materials.gold, [x, 9.052 + level * 0.19, z], [length, 0.018, 0.23], a);
        }
        add('Theater_Capital_Raised_Scroll', scroll, materials.goldLight,
          [x + Math.sin(a) * 0.426, 9.31, z + Math.cos(a) * 0.426], [0.73, 0.55, 0.7], a);
      }
    }
  }

  // Continuous upper purlins, carved lintels, and shallow ceiling coffers.
  for (let side = 0; side < 4; side += 1) {
    const a = side * Math.PI / 2;
    const world = (x, y, z) => [Math.cos(a) * x + Math.sin(a) * z, y, -Math.sin(a) * x + Math.cos(a) * z];
    for (const [y, height, depth, width] of [[9.15, 0.35, 0.48, 18.1], [9.64, 0.46, 0.57, 18.3], [10.14, 0.25, 0.7, 18.5]]) {
      block('Theater_Continuous_RedGold_Beam', materials.lacquer, world(0, y, -8.77), [width, height, depth], a, true);
      block('Theater_Beam_Raised_Brass_Fillet', materials.gold, world(0, y - height / 2 + 0.025, -8.45), [width, 0.025, 0.035], a);
      block('Theater_Beam_Raised_Brass_Fillet', materials.gold, world(0, y + height / 2 - 0.025, -8.45), [width, 0.025, 0.035], a);
      for (let index = 0; index < 18; index += 1) {
        add('Theater_Continuous_Carved_Lintel', scroll, materials.gold, world(-8.5 + index, y, -8.438), [0.89, height * 1.5, 1], a);
      }
    }
    for (let index = 0; index < 11; index += 1) {
      const x = -7.5 + index * 1.5;
      block('Theater_Ceiling_Rafter', materials.redShadow, world(x, 10.21, -4.45), [0.09, 0.16, 8.45], a);
    }
    block('Theater_Ceiling_Inner_Purlin', materials.lacquer, world(0, 10.04, -6.45), [13.15, 0.22, 0.22], a);
    block('Theater_Ceiling_Inner_Purlin_Inlay', materials.gold, world(0, 9.93, -6.45), [13.15, 0.018, 0.13], a);

    // A thick black shell, stepped bronze borders and raised key pattern
    // integrate each original video plane into the surrounding architecture.
    const frameZ = -screenDistance + 0.06;
    const edgeX = screenWidth / 2;
    const top = screenCenterY + screenHeight / 2;
    const bottom = screenCenterY - screenHeight / 2;
    for (const x of [-edgeX - 0.16, edgeX + 0.16]) {
      block('Theater_Screen_Thick_Black_Upright', materials.blackFrame, world(x, screenCenterY, frameZ), [0.32, screenHeight + 0.67, 0.34], a, true);
      block('Theater_Screen_Brass_Upright_Fillet', materials.goldLight, world(x - Math.sign(x) * 0.125, screenCenterY, frameZ + 0.19), [0.022, screenHeight + 0.34, 0.025], a);
      for (let index = 0; index < 16; index += 1) {
        add('Theater_Screen_Raised_Vertical_Keys', meander, materials.gold,
          world(x, bottom + 0.2 + index * (screenHeight - 0.4) / 15, frameZ + 0.19), [0.24, 0.69, 1], a);
      }
    }
    for (const y of [top + 0.17, bottom - 0.17]) {
      block('Theater_Screen_Thick_Black_Crossbar', materials.blackFrame, world(0, y, frameZ), [screenWidth + 0.65, 0.34, 0.34], a, true);
      block('Theater_Screen_Brass_Crossbar_Fillet', materials.goldLight, world(0, y + (y > screenCenterY ? -0.145 : 0.145), frameZ + 0.19), [screenWidth + 0.34, 0.022, 0.025], a);
      const count = Math.round(screenWidth / 0.7);
      for (let index = 0; index < count; index += 1) {
        add('Theater_Screen_Continuous_Raised_Keys', meander, materials.gold,
          world(-screenWidth / 2 + 0.34 + index * (screenWidth - 0.68) / (count - 1), y, frameZ + 0.19), [0.62, 0.7, 1], a);
      }
    }
    // Low wall skirt reads as traditional wall joinery, never as furniture.
    for (let index = 0; index < 26; index += 1) {
      block('Theater_Low_Wall_Red_Pilasters', materials.lacquer, world(-8.05 + index * 0.644, 0.34, -9.34), [0.065, 0.6, 0.075], a);
    }
    block('Theater_Low_Wall_Bronze_Rail', materials.gold, world(0, 0.64, -9.3), [16.7, 0.027, 0.055], a);
  }

  for (const { name, geometry, material, shadow, owner: batchOwner, transforms } of batches.values()) {
    const instances = new InstancedMesh(geometry, material, transforms.length);
    instances.name = name;
    transforms.forEach((transform, index) => instances.setMatrixAt(index, transform));
    instances.instanceMatrix.needsUpdate = true;
    instances.castShadow = shadow;
    instances.receiveShadow = true;
    instances.computeBoundingSphere();
    batchOwner.add(instances);
  }
  root.updateMatrixWorld(true);
  root.userData.parameters = params;
  root.userData.componentCounts = componentCounts;
  return { root, building, floor, floorY, stageTop, stageRadius, stageTopMesh, stageBoundsPoints, materials, parameters: params };
}
