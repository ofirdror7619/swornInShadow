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

    const startText = this.add
      .text(width * 0.5, height * 0.65, "Press Enter to Start", {
        fontFamily: "monospace",
        fontSize: 26,
        color: "#80ed99"
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const start = () => {
      GameState.reset();
      this.scene.start("game");
      this.scene.launch("ui");
    };

    startText.on("pointerdown", start);
    this.input.keyboard.once("keydown-ENTER", start);
  }
}
