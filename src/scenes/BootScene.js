import Phaser from "phaser";
import demonBodyUrl from "../assets/images/demon/demon-body.png";
import demonLeftWingUrl from "../assets/images/demon/demon-left-wing.png";
import demonRightWingUrl from "../assets/images/demon/demon-right-wing.png";
import demonTwoUrl from "../assets/images/demon-2/demon-2.png";
import angelBodyUrl from "../assets/images/angel/angel-body.png";
import angelLeftWingUrl from "../assets/images/angel/angel-left-wing.png";
import angelRightWingUrl from "../assets/images/angel/angel-right-wing.png";
import openingLogoUrl from "../assets/images/opening/logo.png";
import roomBackgroundUrl from "../assets/images/background/background.png";
import treasureChestUrl from "../assets/images/objects/treasure-chest.png";
import bigPlatform1Url from "../assets/images/platforms/big-platform-1.png";
import bigPlatform2Url from "../assets/images/platforms/big-platform-2.png";
import mediumPlatform1Url from "../assets/images/platforms/medium-platform-1.png";
import mediumPlatform2Url from "../assets/images/platforms/medium-platform-2.png";
import mediumPlatform3Url from "../assets/images/platforms/medium-platform-3.png";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  preload() {
    this.load.image("demon-body", demonBodyUrl);
    this.load.image("demon-left-wing", demonLeftWingUrl);
    this.load.image("demon-right-wing", demonRightWingUrl);
    this.load.image("demon-2-source", demonTwoUrl);
    this.load.image("angel-body", angelBodyUrl);
    this.load.image("angel-left-wing", angelLeftWingUrl);
    this.load.image("angel-right-wing", angelRightWingUrl);
    this.load.image("opening-logo", openingLogoUrl);
    this.load.image("room-background", roomBackgroundUrl);
    this.load.image("treasure-chest", treasureChestUrl);
    this.load.image("platform-big-1", bigPlatform1Url);
    this.load.image("platform-big-2", bigPlatform2Url);
    this.load.image("platform-medium-1", mediumPlatform1Url);
    this.load.image("platform-medium-2", mediumPlatform2Url);
    this.load.image("platform-medium-3", mediumPlatform3Url);
  }

  create() {
    this.makeTextures();
    this.scene.start("menu");
  }

  makeTextures() {
    const g = this.add.graphics();

    g.fillStyle(0x80ed99, 1);
    g.fillRect(0, 0, 32, 32);
    g.generateTexture("player", 32, 32);
    g.clear();

    g.fillStyle(0xfe4a49, 1);
    g.fillRect(0, 0, 32, 64);
    g.generateTexture("gate", 32, 64);
    g.clear();

    g.fillStyle(0xff4d3d, 1);
    g.fillCircle(6, 6, 6);
    g.generateTexture("fx-red", 12, 12);
    g.clear();

    g.fillStyle(0xffd166, 1);
    g.fillCircle(5, 5, 5);
    g.generateTexture("fx-gold", 10, 10);
    g.clear();

    // Minimal sword icon for HUD ability meter.
    g.fillStyle(0xffcc78, 1);
    g.fillRect(11, 2, 2, 14);
    g.fillTriangle(12, 0, 9, 4, 15, 4);
    g.fillRect(8, 11, 8, 2);
    g.fillStyle(0xb06b2f, 1);
    g.fillRect(11, 13, 2, 6);
    g.generateTexture("fx-sword", 24, 24);
    g.clear();

    g.fillStyle(0xff4a36, 1);
    g.fillCircle(2, 2, 2);
    g.generateTexture("fx-ember", 4, 4);
    g.clear();

    // Stylized flame sprite (outer orange/red shell + bright core).
    g.fillStyle(0xff5a22, 1);
    g.fillTriangle(10, 0, 2, 16, 18, 16);
    g.fillCircle(10, 18, 8);
    g.fillStyle(0xffb347, 0.92);
    g.fillTriangle(10, 3, 5, 15, 15, 15);
    g.fillCircle(10, 17, 5);
    g.fillStyle(0xfff3a1, 0.82);
    g.fillTriangle(10, 6, 7, 14, 13, 14);
    g.fillCircle(10, 16, 2);
    g.generateTexture("fx-flame", 20, 26);
    g.clear();

    g.fillStyle(0x1a1222, 1);
    g.fillCircle(7, 7, 7);
    g.generateTexture("fx-smoke", 14, 14);
    g.clear();

    g.fillStyle(0xff351f, 1);
    g.fillCircle(3, 3, 2);
    g.fillCircle(9, 3, 2);
    g.generateTexture("demon-eyes", 12, 6);
    g.clear();

    this.makeDemonTwoTextures();

    g.destroy();
  }

  makeDemonTwoTextures() {
    const source = this.textures.get("demon-2-source")?.getSourceImage();
    if (!source) return;

    this.makeMaskedCropTexture("demon-2-left-wing", source, 0, 22, 560, 560);
    this.makeMaskedCropTexture("demon-2-right-wing", source, 808, 20, 600, 560);
    this.makeMaskedCropTexture("demon-2-body", source, 420, 172, 560, 596);
  }

  makeMaskedCropTexture(key, source, sx, sy, sw, sh) {
    if (this.textures.exists(key)) {
      this.textures.remove(key);
    }

    const canvasTexture = this.textures.createCanvas(key, sw, sh);
    const ctx = canvasTexture.getContext();
    ctx.clearRect(0, 0, sw, sh);
    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh);

    const imageData = ctx.getImageData(0, 0, sw, sh);
    const data = imageData.data;
    const tileSize = 32;
    const dark = [92, 92, 92];
    const light = [176, 176, 176];
    const bgCandidate = new Uint8Array(sw * sh);
    const bgConnected = new Uint8Array(sw * sh);

    for (let y = 0; y < sh; y += 1) {
      for (let x = 0; x < sw; x += 1) {
        const i = (y * sw + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const checkerIndex = (Math.floor((x + sx) / tileSize) + Math.floor((y + sy) / tileSize)) % 2;
        const target = checkerIndex === 0 ? dark : light;
        const dr = Math.abs(r - target[0]);
        const dg = Math.abs(g - target[1]);
        const db = Math.abs(b - target[2]);
        const grayish = Math.abs(r - g) <= 18 && Math.abs(g - b) <= 18 && Math.abs(r - b) <= 18;
        const closeToChecker = dr <= 34 && dg <= 34 && db <= 34;
        if (grayish && closeToChecker) {
          bgCandidate[y * sw + x] = 1;
        }
      }
    }

    const queueX = [];
    const queueY = [];
    const enqueue = (x, y) => {
      const idx = y * sw + x;
      if (!bgCandidate[idx] || bgConnected[idx]) return;
      bgConnected[idx] = 1;
      queueX.push(x);
      queueY.push(y);
    };

    for (let x = 0; x < sw; x += 1) {
      enqueue(x, 0);
      enqueue(x, sh - 1);
    }
    for (let y = 1; y < sh - 1; y += 1) {
      enqueue(0, y);
      enqueue(sw - 1, y);
    }

    while (queueX.length > 0) {
      const x = queueX.pop();
      const y = queueY.pop();
      if (x > 0) enqueue(x - 1, y);
      if (x < sw - 1) enqueue(x + 1, y);
      if (y > 0) enqueue(x, y - 1);
      if (y < sh - 1) enqueue(x, y + 1);
    }

    for (let y = 0; y < sh; y += 1) {
      for (let x = 0; x < sw; x += 1) {
        const idx = y * sw + x;
        const i = idx * 4;
        if (bgConnected[idx]) {
          data[i + 3] = 0;
        } else {
          data[i + 3] = 255;
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
    canvasTexture.refresh();
  }
}
