import * as THREE from "three";
import { TextureFactory } from "./TextureFactory";

export function createWaterMaterial() {
  return new THREE.ShaderMaterial({
    // Water needs to read as water from high tactical camera angles.
    // Keep it mostly opaque and write depth so the green terrain underneath
    // cannot bleed through when the camera pitch/height changes.
    transparent: false,
    depthWrite: true,
    depthTest: true,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -10,
    polygonOffsetUnits: -10,
    uniforms: {
      uTime: { value: 0 },
      uColorDeep: { value: new THREE.Color("#176b95") },
      uColorShallow: { value: new THREE.Color("#45b9d4") }
    },
    vertexShader: `
      uniform float uTime;
      varying vec2 vLocalXZ;
      varying float vWave;
      void main() {
        vec3 p = position;
        vLocalXZ = p.xy;
        float wave = sin((p.x * 0.055) + uTime * 0.9) * 0.045;
        wave += sin((p.y * 0.075) - uTime * 1.25) * 0.028;
        p.z += wave;
        vWave = wave;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColorDeep;
      uniform vec3 uColorShallow;
      uniform float uTime;
      varying vec2 vLocalXZ;
      varying float vWave;
      void main() {
        // D27: use local map coordinates instead of ShapeGeometry UVs. Concave
        // pond fills can generate large triangulation-dependent UV wedges, which
        // read as giant diagonal light-blue artifacts from tactical altitude.
        float ripple = sin(vLocalXZ.x * 0.34 + uTime * 2.0) * 0.018 + sin(vLocalXZ.y * 0.28 - uTime * 1.4) * 0.014;
        float mixAmount = clamp(0.40 + vWave * 0.85 + ripple, 0.24, 0.62);
        vec3 color = mix(uColorDeep, uColorShallow, mixAmount);
        gl_FragColor = vec4(color, 1.0);
      }
    `
  });
}

export function createMapMaterials() {
  return {
    ground: new THREE.MeshStandardMaterial({ color: "#6fa63e", roughness: 0.96 }),
    building: new THREE.MeshStandardMaterial({ color: "#c3b6a4", roughness: 0.9 }),
    buildingBrick: new THREE.MeshStandardMaterial({ color: "#b98368", roughness: 0.9 }),
    buildingConcrete: new THREE.MeshStandardMaterial({ color: "#a9aaa2", roughness: 0.92 }),
    buildingPlaster: new THREE.MeshStandardMaterial({ color: "#d8c6ad", roughness: 0.9 }),
    buildingIndustrial: new THREE.MeshStandardMaterial({ color: "#98a0a8", roughness: 0.78, metalness: 0.1 }),
    buildingGlass: new THREE.MeshStandardMaterial({ color: "#a8c4d0", roughness: 0.3, metalness: 0.08 }),
    buildingCivic: new THREE.MeshStandardMaterial({ color: "#b8b1a3", roughness: 0.86 }),
    buildingUtility: new THREE.MeshStandardMaterial({ color: "#8d918b", roughness: 0.78, metalness: 0.12 }),
    buildingGarage: new THREE.MeshStandardMaterial({ color: "#b2aaa0", roughness: 0.9 }),
    buildingAgricultural: new THREE.MeshStandardMaterial({ color: "#9d7a56", roughness: 0.92 }),
    roof: new THREE.MeshStandardMaterial({ color: "#5c3a31", roughness: 0.9 }),
    roofDark: new THREE.MeshStandardMaterial({ color: "#3f3431", roughness: 0.94 }),
    roofTile: new THREE.MeshStandardMaterial({ color: "#8f412e", roughness: 0.95 }),
    roofMetal: new THREE.MeshStandardMaterial({ color: "#8a9098", roughness: 0.55, metalness: 0.22 }),
    roofCivic: new THREE.MeshStandardMaterial({ color: "#6e6a5f", roughness: 0.88 }),
    roofUtility: new THREE.MeshStandardMaterial({ color: "#686f72", roughness: 0.65, metalness: 0.18 }),
    road: new THREE.MeshStandardMaterial({
      color: "#353934",
      roughness: 0.95,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4
    }),

    roadShoulder: new THREE.MeshStandardMaterial({
      color: "#62665d",
      roughness: 0.92,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3
    }),

    roadCenterline: new THREE.MeshBasicMaterial({
      color: "#e8d870",
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -6,
      polygonOffsetUnits: -6
    }),

    roadEdgeLine: new THREE.MeshBasicMaterial({
      color: "#f0f0e0",
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -7,
      polygonOffsetUnits: -7
    }),

    sidewalk: new THREE.MeshStandardMaterial({
      color: "#a8a496",
      roughness: 0.88,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2
    }),

    roadCrater: new THREE.MeshStandardMaterial({
      color: "#1a1614",
      roughness: 1,
      metalness: 0,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.82,
      polygonOffset: true,
      polygonOffsetFactor: -8,
      polygonOffsetUnits: -8
    }),
    railway: new THREE.MeshStandardMaterial({ color: "#2a2a2a", side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 }),

    driveway: new THREE.MeshStandardMaterial({
      color: "#8a8880",
      roughness: 0.92,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2.5,
      polygonOffsetUnits: -2.5
    }),
    parking: new THREE.MeshStandardMaterial({
      color: "#5f625c",
      roughness: 0.94,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2.5,
      polygonOffsetUnits: -2.5
    }),
    asphaltSurface: new THREE.MeshStandardMaterial({
      color: "#4f534d",
      roughness: 0.95,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2.4,
      polygonOffsetUnits: -2.4
    }),
    concreteSurface: new THREE.MeshStandardMaterial({
      color: "#aaa99f",
      roughness: 0.9,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2.35,
      polygonOffsetUnits: -2.35
    }),
    fence: new THREE.MeshStandardMaterial({ color: "#72583f", roughness: 0.92 }),
    propMetal: new THREE.MeshStandardMaterial({ color: "#8a8e92", roughness: 0.65, metalness: 0.18 }),
    propDark: new THREE.MeshStandardMaterial({ color: "#3a3a3a", roughness: 0.82 }),
    carBody: new THREE.MeshStandardMaterial({ color: "#5a7080", roughness: 0.5, metalness: 0.1 }),

    water: createWaterMaterial(),
    waterShoreline: new THREE.MeshStandardMaterial({
      color: "#5e7a50",
      roughness: 1,
      metalness: 0,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.45,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2
    }),
    wetBank: new THREE.MeshStandardMaterial({
      color: "#3e5a3e",
      roughness: 1,
      metalness: 0,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.4,
      polygonOffset: true,
      polygonOffsetFactor: -1.5,
      polygonOffsetUnits: -1.5
    }),

    reed: new THREE.MeshStandardMaterial({
      color: "#6f7f35",
      roughness: 1,
      metalness: 0
    }),
    shorelineRock: new THREE.MeshStandardMaterial({
      color: "#74736a",
      roughness: 0.96,
      metalness: 0
    }),
    mudFlat: new THREE.MeshStandardMaterial({
      color: "#5c503d",
      roughness: 1,
      metalness: 0,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.34,
      polygonOffset: true,
      polygonOffsetFactor: -1.2,
      polygonOffsetUnits: -1.2
    }),

    park: new THREE.MeshStandardMaterial({ map: TextureFactory.createPencilTexture("#6dbf47", "#4a9a32"), side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    forest: new THREE.MeshStandardMaterial({ map: TextureFactory.createPencilTexture("#3d8c3a", "#2a6828"), side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    forestCanopy: new THREE.MeshStandardMaterial({ color: "#245c28", roughness: 1, metalness: 0 }),
    forestCanopyDark: new THREE.MeshStandardMaterial({ color: "#183f20", roughness: 1, metalness: 0 }),
    parkCanopy: new THREE.MeshStandardMaterial({ color: "#3f8f35", roughness: 1, metalness: 0 }),
    wetlandCanopy: new THREE.MeshStandardMaterial({ color: "#2f6f4a", roughness: 1, metalness: 0 }),
    wetland: new THREE.MeshStandardMaterial({ map: TextureFactory.createPencilTexture("#4a9060", "#3a7a48"), side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1.5, polygonOffsetUnits: -1.5 }),
    scrub: new THREE.MeshStandardMaterial({ map: TextureFactory.createPencilTexture("#8ab542", "#6a9a32"), side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    tactical: new THREE.MeshStandardMaterial({ color: "#8a7a68", side: THREE.DoubleSide }),
    trunk: new THREE.MeshStandardMaterial({ color: "#5b3a24", roughness: 0.95 }),
    leaves: new THREE.MeshStandardMaterial({ color: "#3f8f35", roughness: 0.98 }),
    leavesDark: new THREE.MeshStandardMaterial({ color: "#2d6d2e", roughness: 1 }),
    buildingTrim: new THREE.MeshStandardMaterial({ color: "#e7dbc7", roughness: 0.9 }),
    foundation: new THREE.MeshStandardMaterial({ color: "#6f6d63", roughness: 0.96 })
  };
}
