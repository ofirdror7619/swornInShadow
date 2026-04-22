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
    const promptY = Math.min(height * 0.78, this.cameras.main.centerY + 120);
    const text = this.add
      .text(this.cameras.main.centerX, promptY, "Press Enter...", {
        fontFamily: "'Simbiot', serif",
        fontSize: "42px",
        color: "#bf1111",
        stroke: "#140000",
        strokeThickness: 5
      })
      .setOrigin(0.5)
      .setAlpha(0);
    text.setShadow(0, 3, "#2a0000", 8, true, true);

    this.time.delayedCall(2000, () => {
      text.setText("Press Enter... let me in.");
    });

    // Blood haze beneath the title text.
    this.add
      .particles(0, 0, "fx-ember", {
        x: { min: text.x - 100, max: text.x + 100 },
        y: text.y + 20,
        speedY: { min: -10, max: -40 },
        lifespan: 1700,
        scale: { start: 0.18, end: 0 },
        quantity: 2,
        frequency: 140,
        tint: [0x3b0508, 0x5e0a0d, 0x8d1111, 0xba1a1a],
        blendMode: "NORMAL"
      })
      .setDepth(text.depth - 1);

    // Subtle blood drips dropping from the glyph bottoms.
    this.add
      .particles(0, 0, "fx-ember", {
        x: { min: text.x - 130, max: text.x + 130 },
        y: { min: text.y + 8, max: text.y + 16 },
        speedY: { min: 16, max: 48 },
        speedX: { min: -6, max: 6 },
        accelerationY: 18,
        lifespan: { min: 320, max: 700 },
        scale: { start: 0.13, end: 0.03 },
        quantity: 1,
        frequency: 110,
        tint: [0x5b070a, 0x8f1212, 0xbf1f1f],
        blendMode: "NORMAL"
      })
      .setDepth(text.depth - 1);

    // Fade in from darkness.
    this.tweens.add({
      targets: text,
      alpha: 1,
      duration: 2000,
      ease: "Power2"
    });

    // Gentle breathing pulse.
    this.tweens.add({
      targets: text,
      scale: { from: 1, to: 1.05 },
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });

    // Flicker bursts.
    this.time.addEvent({
      delay: Phaser.Math.Between(2000, 5000),
      loop: true,
      callback: () => {
        this.tweens.add({
          targets: text,
          alpha: { from: 1, to: 0.3 },
          duration: 50,
          yoyo: true,
          repeat: Phaser.Math.Between(1, 3)
        });
      }
    });

    // Tiny glitch jitter.
    this.time.addEvent({
      delay: Phaser.Math.Between(3000, 7000),
      loop: true,
      callback: () => {
        const originalX = text.x;
        this.tweens.add({
          targets: text,
          x: originalX + Phaser.Math.Between(-3, 3),
          duration: 30,
          yoyo: true,
          repeat: 2,
          onComplete: () => {
            text.x = originalX;
          }
        });
      }
    });

    // Blood-like color pulse.
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      onUpdate: (tween) => {
        const t = tween.getValue();
        const from = Phaser.Display.Color.ValueToColor(0x6f0909);
        const to = Phaser.Display.Color.ValueToColor(0xd81e1e);
        const mixed = Phaser.Display.Color.Interpolate.ColorWithColor(from, to, 100, Math.round(t * 100));
        const hex = Phaser.Display.Color.GetColor(mixed.r, mixed.g, mixed.b)
          .toString(16)
          .padStart(6, "0");
        text.setColor(`#${hex}`);
      }
    });

    const whisperLoop = this.sound.add("sfx-aura", {
      loop: true,
      volume: 0.45,
      rate: 0.55
    });
    let whisperStarted = false;
    const startWhisperLoop = () => {
      if (whisperStarted) return;
      if (this.sound.locked) {
        this.sound.unlock();
      }
      if (whisperLoop.isPlaying) return;
      whisperLoop.play();
      whisperStarted = true;
      if (typeof whisperLoop.setPan === "function") {
        whisperLoop.setPan(-0.35);
        this.tweens.add({
          targets: whisperLoop,
          pan: 0.35,
          duration: 3000,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut"
        });
      }
    };

    if (this.sound.locked) {
      this.sound.once("unlocked", startWhisperLoop);
      this.input.once("pointerdown", startWhisperLoop);
      this.input.keyboard.once("keydown", startWhisperLoop);
    } else {
      startWhisperLoop();
    }
    this.time.delayedCall(300, startWhisperLoop);
    this.events.once("shutdown", () => {
      if (whisperLoop?.isPlaying) {
        whisperLoop.stop();
      }
      whisperLoop?.destroy();
    });

    const start = () => {
      if (whisperLoop?.isPlaying) {
        whisperLoop.stop();
      }
      whisperLoop?.destroy();
      GameState.reset();
      this.scene.start("game");
      this.scene.launch("ui");
    };

    this.input.keyboard.once("keydown-ENTER", start);
  }
}
