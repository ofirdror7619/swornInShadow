import Phaser from "phaser";
import { BootScene } from "../scenes/BootScene";
import { MenuScene } from "../scenes/MenuScene";
import { GameScene } from "../scenes/GameScene";
import { UIScene } from "../scenes/UIScene";

export function createGameConfig() {
  return {
    type: Phaser.AUTO,
    parent: "app",
    backgroundColor: "#c8d7f2",
    pixelArt: false,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 960,
      height: 540
    },
    physics: {
      default: "arcade",
      arcade: {
        gravity: { x: 0, y: 1200 },
        debug: false
      }
    },
    scene: [BootScene, MenuScene, GameScene, UIScene]
  };
}
