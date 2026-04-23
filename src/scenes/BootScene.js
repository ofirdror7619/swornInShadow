import Phaser from "phaser";
import demonBodyUrl from "../assets/images/demon/demon-body.png";
import demonLeftWingUrl from "../assets/images/demon/demon-left-wing.png";
import demonRightWingUrl from "../assets/images/demon/demon-right-wing.png";
import angelBodyUrl from "../assets/images/angel/angel-body.png";
import angelLeftWingUrl from "../assets/images/angel/angel-left-wing.png";
import angelRightWingUrl from "../assets/images/angel/angel-right-wing.png";
import openingLogoUrl from "../assets/images/opening/logo-new.png";
import bgLayer1Url from "../assets/images/background/layer-1.png";
import bgLayer2Url from "../assets/images/background/layer-2.png";
import bgCeilingUrl from "../assets/images/background/ceiling.png";
import treasureChestUrl from "../assets/images/objects/treasure-chest.png";
import hugeChestUrl from "../assets/images/objects/huge-chest.png";
import relicUrl from "../assets/images/objects/relic.png";
import exitPortalUrl from "../assets/images/objects/exit.png";
import roomGateUrl from "../assets/images/objects/gate.png";
import bigPlatform1Url from "../assets/images/platforms/big-platform-1.png";
import bigPlatform2Url from "../assets/images/platforms/big-platform-2.png";
import mediumPlatform1Url from "../assets/images/platforms/medium-platform-1.png";
import mediumPlatform2Url from "../assets/images/platforms/medium-platform-2.png";
import mediumPlatform3Url from "../assets/images/platforms/medium-platform-3.png";
import floorElement1Url from "../assets/images/floor/floor-element-1.png";
import floorElement2Url from "../assets/images/floor/floor-element-2.png";
import floorElement3Url from "../assets/images/floor/floor-element-3.png";
import floorElement4Url from "../assets/images/floor/floor-element-4.png";
import floorElement5Url from "../assets/images/floor/floor-element-5.png";
import floorElement6Url from "../assets/images/floor/floor-element-6.png";
import floorElement7Url from "../assets/images/floor/floor-element-7.png";
import floorElement8Url from "../assets/images/floor/floor-element-8.png";
import level1MusicUrl from "../assets/audio/music/music-level-1.mp3";
import auraSfxUrl from "../assets/audio/sounds/aura.mp3";
import angelDeadSfxUrl from "../assets/audio/sounds/angel-dead.mp3";
import exitAppearSfxUrl from "../assets/audio/sounds/exit.mp3";
import fireStormSfxUrl from "../assets/audio/sounds/fire-storm.mp3";
import treasureChestSfxUrl from "../assets/audio/sounds/treasure-chest.mp3";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  preload() {
    this.load.image("demon-body", demonBodyUrl);
    this.load.image("demon-left-wing", demonLeftWingUrl);
    this.load.image("demon-right-wing", demonRightWingUrl);
    this.load.image("angel-body", angelBodyUrl);
    this.load.image("angel-left-wing", angelLeftWingUrl);
    this.load.image("angel-right-wing", angelRightWingUrl);
    this.load.image("opening-logo", openingLogoUrl);
    this.load.image("bg-layer-1", bgLayer1Url);
    this.load.image("bg-layer-2", bgLayer2Url);
    this.load.image("bg-ceiling-v2", bgCeilingUrl);
    this.load.image("room-background", bgLayer1Url);
    this.load.image("treasure-chest", treasureChestUrl);
    this.load.image("huge-chest", hugeChestUrl);
    this.load.image("relic-object", relicUrl);
    this.load.image("exit-portal", exitPortalUrl);
    this.load.image("room-gate", roomGateUrl);
    this.load.image("platform-big-1", bigPlatform1Url);
    this.load.image("platform-big-2", bigPlatform2Url);
    this.load.image("platform-medium-1", mediumPlatform1Url);
    this.load.image("platform-medium-2", mediumPlatform2Url);
    this.load.image("platform-medium-3", mediumPlatform3Url);
    this.load.image("floor-element-1", floorElement1Url);
    this.load.image("floor-element-2", floorElement2Url);
    this.load.image("floor-element-3", floorElement3Url);
    this.load.image("floor-element-4", floorElement4Url);
    this.load.image("floor-element-5", floorElement5Url);
    this.load.image("floor-element-6", floorElement6Url);
    this.load.image("floor-element-7", floorElement7Url);
    this.load.image("floor-element-8", floorElement8Url);
    this.load.audio("music-level-1", level1MusicUrl);
    this.load.audio("sfx-aura", auraSfxUrl);
    this.load.audio("sfx-angel-dead", angelDeadSfxUrl);
    this.load.audio("sfx-exit-appear", exitAppearSfxUrl);
    this.load.audio("sfx-fire-storm", fireStormSfxUrl);
    this.load.audio("sfx-treasure-chest", treasureChestSfxUrl);
  }

  create() {
    this.makeTextures();
    this.prepareFonts().finally(() => {
      this.scene.start("menu");
    });
  }

  async prepareFonts() {
    if (typeof document === "undefined" || !document.fonts?.load) return;
    const timeoutMs = 1800;
    const timeout = new Promise((resolve) => {
      this.time.delayedCall(timeoutMs, resolve);
    });
    const loading = Promise.allSettled([
      document.fonts.load("400 24px PICKYSIDE"),
      document.fonts.load("400 18px PICKYSIDE"),
      document.fonts.load("400 40px Simbiot"),
      document.fonts.load("400 28px Simbiot")
    ]);
    await Promise.race([loading, timeout]);
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

    g.destroy();
  }
}
