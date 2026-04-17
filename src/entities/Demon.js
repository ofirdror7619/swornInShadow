import Phaser from "phaser";

const FLAP_DURATION_MS = 900;

export class Demon extends Phaser.GameObjects.Container {
  constructor(scene, x, y) {
    super(scene, x, y);
    scene.add.existing(this);

    this.baseY = y;
    this.bobAmplitude = 5;
    this.bobOffset = Phaser.Math.FloatBetween(0, Math.PI * 2);

    this.leftWing = scene.add.image(-26, -14, "demon-left-wing").setOrigin(0.92, 0.2);
    this.rightWing = scene.add.image(26, -14, "demon-right-wing").setOrigin(0.08, 0.2);
    this.body = scene.add.image(0, 0, "demon-body").setOrigin(0.5, 0.5);

    this.add([this.leftWing, this.rightWing, this.body]);

    this.setScale(0.28);
    this.startWingFlapTween();
  }

  startWingFlapTween() {
    this.scene.tweens.add({
      targets: this.leftWing,
      angle: { from: -40, to: 18 },
      duration: FLAP_DURATION_MS,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });

    this.scene.tweens.add({
      targets: this.rightWing,
      angle: { from: 40, to: -18 },
      duration: FLAP_DURATION_MS,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });
  }

  update(time) {
    const phase = (time / FLAP_DURATION_MS) * Math.PI + this.bobOffset;
    const bob = Math.sin(phase - Math.PI * 0.5) * this.bobAmplitude;
    this.y = this.baseY + bob;
  }
}
