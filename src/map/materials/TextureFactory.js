import * as THREE from "three";

export class TextureFactory {
  static createWindowTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#e8eaed";
    ctx.fillRect(0, 0, 128, 128);

    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 8; j++) {
        ctx.fillStyle = Math.random() > 0.5 ? "#7090a8" : "#4a6070";
        ctx.fillRect(i * 32 + 6, j * 16 + 4, 16, 10);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  static createPencilTexture(baseColor, strokeColor) {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3;

    for (let i = 0; i < 400; i++) {
      const x = Math.random() * 128;
      const y = Math.random() * 128;
      const len = Math.random() * 10 + 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + len, y + len);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  static createRoadTexture(color) {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 256, 256);

    for (let i = 0; i < 2000; i++) {
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 1, 1);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }
}
