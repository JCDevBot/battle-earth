import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";

/**
 * BC2-inspired post-processing:
 * - Subtle bloom on bright surfaces (sky, water reflections)
 * - Warm desaturated color grading (that gritty military look)
 * - Vignette to draw eye to center
 * - Distance fog baked into the final composite
 */

const ColorGradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uSaturation: { value: 0.85 },
    uContrast: { value: 1.06 },
    uBrightness: { value: 0.04 },
    uWarmth: { value: 0.04 },
    uVignetteStrength: { value: 0.2 },
    uVignetteRadius: { value: 0.9 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uSaturation;
    uniform float uContrast;
    uniform float uBrightness;
    uniform float uWarmth;
    uniform float uVignetteStrength;
    uniform float uVignetteRadius;
    varying vec2 vUv;

    void main() {
      vec4 tex = texture2D(tDiffuse, vUv);
      vec3 color = tex.rgb;

      // Brightness
      color += uBrightness;

      // Contrast (pivot around mid gray)
      color = (color - 0.5) * uContrast + 0.5;

      // Desaturation
      float lum = dot(color, vec3(0.299, 0.587, 0.114));
      color = mix(vec3(lum), color, uSaturation);

      // Warm tint (push reds/yellows slightly)
      color.r += uWarmth * 0.6;
      color.g += uWarmth * 0.2;
      color.b -= uWarmth * 0.3;

      // Vignette
      vec2 center = vUv - 0.5;
      float dist = length(center);
      float vig = smoothstep(uVignetteRadius, uVignetteRadius - 0.45, dist);
      color *= mix(1.0 - uVignetteStrength, 1.0, vig);

      gl_FragColor = vec4(clamp(color, 0.0, 1.0), tex.a);
    }
  `
};

export class PostProcessingPipeline {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.enabled = true;

    const size = renderer.getSize(new THREE.Vector2());
    this.composer = new EffectComposer(renderer);

    // Base render
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);

    // Bloom — subtle, mostly catches sky and specular highlights
    this.bloomPass = new UnrealBloomPass(size, 0.3, 0.6, 0.85);
    this.composer.addPass(this.bloomPass);

    // Color grading
    this.colorGradePass = new ShaderPass(ColorGradeShader);
    this.composer.addPass(this.colorGradePass);
  }

  setPreset(preset) {
    const presets = {
      bc2: { saturation: 0.85, contrast: 1.06, brightness: 0.04, warmth: 0.04, bloom: 0.2 },
      cold: { saturation: 0.7, contrast: 1.12, brightness: 0.0, warmth: -0.04, bloom: 0.15 },
      vivid: { saturation: 1.05, contrast: 1.02, brightness: 0.02, warmth: 0.0, bloom: 0.1 },
      none: { saturation: 1.0, contrast: 1.0, brightness: 0.0, warmth: 0.0, bloom: 0.0 }
    };
    const p = presets[preset] || presets.bc2;
    this.colorGradePass.uniforms.uSaturation.value = p.saturation;
    this.colorGradePass.uniforms.uContrast.value = p.contrast;
    this.colorGradePass.uniforms.uBrightness.value = p.brightness;
    this.colorGradePass.uniforms.uWarmth.value = p.warmth;
    this.bloomPass.strength = p.bloom;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
  }

  resize(width, height) {
    this.composer.setSize(width, height);
  }

  render() {
    if (this.enabled) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  dispose() {
    this.composer.passes.forEach((pass) => pass.dispose?.());
  }
}
