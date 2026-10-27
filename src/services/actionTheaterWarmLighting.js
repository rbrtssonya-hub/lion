import {
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  PointLight,
  RectAreaLight,
  SpotLight,
  SRGBColorSpace,
  Vector3,
} from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }

// Approximate Blender's blackbody temperature with an sRGB blackbody tint.
function temperatureColor(kelvin) {
  const temperature = clamp(Number(kelvin) || 4200, 1000, 40000) / 100;
  const red = temperature <= 66 ? 255 : 329.698727446 * ((temperature - 60) ** -0.1332047592);
  const green = temperature <= 66
    ? 99.4708025861 * Math.log(temperature) - 161.1195681661
    : 288.1221695283 * ((temperature - 60) ** -0.0755148492);
  const blue = temperature >= 66 ? 255 : temperature <= 19 ? 0 : 138.5177312231 * Math.log(temperature - 10) - 305.0447927307;
  return new Color().setRGB(clamp(red, 0, 255) / 255, clamp(green, 0, 255) / 255, clamp(blue, 0, 255) / 255, SRGBColorSpace);
}

function readRecords(roomRoot) {
  const node = roomRoot.getObjectByName('Theater_Warm_Light_Data');
  if (!node) throw new Error('暖金场景缺少原始灯光参数');
  const records = JSON.parse(node.userData.webLightsJson ?? 'null');
  if (!Array.isArray(records) || records.length !== 21) throw new Error('暖金场景灯光参数不完整');
  return records;
}

function sourceIntensity(record) {
  // Blender watts and Three.js light intensity use different units. These
  // scale factors keep the authored balance while avoiding clipped highlights.
  return record.energy * (record.type === 'AREA' ? 0.012 : 0.16);
}

function aimLight(light, record) {
  const position = new Vector3(...record.position);
  const direction = new Vector3(...record.direction).normalize();
  light.position.copy(position);
  if (light.isSpotLight || light.isDirectionalLight) {
    light.target.position.copy(position).add(direction);
    light.target.updateMatrixWorld();
  } else {
    light.lookAt(position.clone().add(direction));
  }
}

/** Rebuilds the Blender scene's 21 authored lights with browser realtime lights. */
export function createActionTheaterWarmLighting({ scene, roomRoot }) {
  const records = readRecords(roomRoot);
  RectAreaLightUniformsLib.init();
  const rig = new Group();
  rig.name = 'Theater_Warm_Gold_Lighting';
  let areaCount = 0;
  let spotCount = 0;
  let pointCount = 0;

  for (const record of records) {
    const color = temperatureColor(record.temperatureK);
    const intensity = sourceIntensity(record);
    let light;
    if (record.type === 'AREA') {
      const square = record.shape === 'DISK';
      const width = Math.max(0.1, record.size || 1);
      const height = square ? width : Math.max(0.1, record.sizeY || width);
      light = new RectAreaLight(color, intensity, width, height);
      areaCount += 1;
    } else if (record.type === 'SPOT') {
      light = new SpotLight(color, intensity, record.cutoffDistance || 0, clamp(record.spotSize / 2, 0.05, Math.PI / 2), clamp(record.spotBlend, 0, 1), 1);
      spotCount += 1;
    } else if (record.type === 'POINT') {
      light = new PointLight(color, intensity, record.cutoffDistance || 0, 1);
      pointCount += 1;
    } else {
      throw new Error(`暖金场景的灯光类型暂不支持：${record.type}`);
    }
    light.name = record.name;
    aimLight(light, record);
    rig.add(light);
    if (light.isSpotLight) rig.add(light.target);
  }

  // Blender area lights do not cast shadows in Three.js. This restrained key
  // preserves the original front key's direction and soft shadow cue.
  const keyRecord = records.find(record => record.name === 'Theater_Warm_Front_Key');
  if (keyRecord) {
    const key = new DirectionalLight(temperatureColor(keyRecord.temperatureK), 0.65);
    key.name = 'Theater_Web_Soft_Key_Shadow';
    aimLight(key, keyRecord);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -4;
    key.shadow.camera.right = 4;
    key.shadow.camera.top = 4;
    key.shadow.camera.bottom = -4;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 20;
    key.shadow.bias = -0.00035;
    key.shadow.normalBias = 0.025;
    key.shadow.radius = 2;
    rig.add(key, key.target);
  }
  const ambient = new HemisphereLight(0x8f694b, 0x24140d, 0.12);
  ambient.name = 'Theater_Web_Indirect_Fill';
  rig.add(ambient);
  scene.add(rig);

  return {
    rig,
    diagnostics: { sourceLights: records.length, areaLights: areaCount, spotLights: spotCount, pointLights: pointCount, webShadowKey: Boolean(keyRecord) },
    dispose() {
      rig.traverse(object => {
        if (!object.isLight || !object.shadow) return;
        object.shadow.map?.dispose();
        object.shadow.dispose?.();
      });
      rig.removeFromParent();
    },
  };
}
