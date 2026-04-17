import Phaser from "phaser";
import { GameState } from "../core/GameState";

export class MenuScene extends Phaser.Scene {
  constructor() {
    super("menu");
  }

  create() {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor("#070b14");

    const logo = this.add.image(width * 0.5, height * 0.35, "opening-logo").setOrigin(0.5);
    const maxLogoWidth = width * 0.52;
    const logoScale = maxLogoWidth / logo.width;
    logo.setScale(logoScale);

    const start = () => {
      GameState.reset();
      this.scene.start("game");
      this.scene.launch("ui");
    };


    this.input.keyboard.once("keydown-ENTER", start);
  }
}
