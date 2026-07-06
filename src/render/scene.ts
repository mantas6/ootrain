/**
 * Scene + renderer setup for the 2.5D world view.
 *
 * Builds the WebGL renderer, the scene with a smoky gradient sky and fog, and
 * the key lights (a hemisphere fill plus a shadow-casting sun). The horizon is
 * tinted orange-brown to sell the fire story without a full skybox. Shadow maps
 * are kept modest for performance.
 *
 * Everything that needs a GL context is created lazily inside
 * {@link createRenderer}, which is only called by {@link WorldView} at runtime.
 * Importing this module does NOT touch WebGL, so it stays safe in tests/build.
 */

import {
  ACESFilmicToneMapping,
  BackSide,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  Mesh,
  PCFSoftShadowMap,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  WebGLRenderer,
} from "three";
import { PALETTE } from "./palette";

/** Handles returned by {@link createScene}. */
export interface SceneBundle {
  scene: Scene;
  /** The shadow-casting key light; move its target to follow the train. */
  sun: DirectionalLight;
  /** The gradient sky dome (recentre on the camera each frame). */
  sky: Mesh;
  /** Disposes scene-owned GPU resources. */
  dispose(): void;
}

/**
 * Creates a configured {@link WebGLRenderer} attached to `canvas` (or an
 * offscreen canvas if none supplied — only meaningful with a real GL context).
 */
export function createRenderer(canvas?: HTMLCanvasElement): WebGLRenderer {
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  return renderer;
}

/**
 * A cheap two-colour vertical gradient sky dome. Rendered on the inside of a
 * large sphere so it always sits behind the world. The lower band is a smoky
 * orange-brown (fire haze), the upper band a cold overcast blue-grey.
 */
function createSky(): Mesh {
  const top = new Color(PALETTE.skyHigh);
  const bottom = new Color(PALETTE.skyLow);
  const material = new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: top },
      bottomColor: { value: bottom },
      // Horizon offset / softness of the gradient.
      offset: { value: 0.15 },
      exponent: { value: 0.7 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform float offset;
      uniform float exponent;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition).y;
        float t = pow(clamp((h + offset) / (1.0 + offset), 0.0, 1.0), exponent);
        gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);
      }
    `,
  });
  const geometry = new SphereGeometry(4000, 24, 12);
  const mesh = new Mesh(geometry, material);
  mesh.renderOrder = -1;
  mesh.frustumCulled = false;
  mesh.name = "sky";
  return mesh;
}

/**
 * Builds the scene, sky, fog, and lighting. `shadowMapSize` controls the
 * (square) shadow texture resolution; keep it modest (1024) for perf.
 */
export function createScene(shadowMapSize = 1024): SceneBundle {
  const scene = new Scene();
  scene.background = new Color(PALETTE.skyHigh);
  // Ash-brown fog fades distant terrain and hides chunk pop-in. Range is tuned
  // for the side view where the camera sits ~40–120 m out.
  scene.fog = new Fog(PALETTE.fog, 120, 620);

  const sky = createSky();
  scene.add(sky);

  // Hemisphere fill: cool sky above, warm scorched ground bounce below.
  const hemi = new HemisphereLight(PALETTE.skyHigh, PALETTE.soil, 0.65);
  hemi.name = "hemi";
  scene.add(hemi);

  // Directional "sun" low in the sky, warm, casting the train's shadow.
  const sun = new DirectionalLight(0xffdcb0, 1.15);
  sun.position.set(-60, 90, 70);
  sun.castShadow = true;
  sun.shadow.mapSize.set(shadowMapSize, shadowMapSize);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 400;
  sun.shadow.camera.left = -80;
  sun.shadow.camera.right = 80;
  sun.shadow.camera.top = 60;
  sun.shadow.camera.bottom = -40;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);
  scene.add(sun.target);

  function dispose(): void {
    scene.remove(sky);
    sky.geometry.dispose();
    (sky.material as ShaderMaterial).dispose();
  }

  return { scene, sun, sky, dispose };
}

/**
 * Resizes a renderer + updates a camera aspect for a new drawing-buffer size.
 * Kept here so both the WorldView and the temporary demo wiring share one
 * resize implementation. `camera` is loosely typed to avoid importing the
 * camera rig into the scene module.
 */
export function resizeRendererToDisplaySize(
  renderer: WebGLRenderer,
  width: number,
  height: number,
): void {
  renderer.setSize(width, height, false);
}
