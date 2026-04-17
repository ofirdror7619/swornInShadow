import Phaser from "phaser";

const FLAP_DURATION_MS = 900;
const FOLLOW_LERP = 0.08;
const BOB_AMPLITUDE = 5;
const SCALE = 0.24;

export class DemonTwo extends Phaser.GameObjects.Container {
  constructor(scene, x, y) {
    super(scene, x, y);
    scene.add.existing(this);

    this.anchorX = x;
    this.anchorY = y;
    this.bobOffset = Phaser.Math.FloatBetween(0, Math.PI * 2);

    this.leftWing = scene.add.image(-29, -13, "demon-2-left-wing").setOrigin(0.92, 0.28);
    this.rightWing = scene.add.image(29, -13, "demon-2-right-wing").setOrigin(0.08, 0.28);
    this.body = scene.add.image(0, 6, "demon-2-body").setOrigin(0.5, 0.52);
    this.add([this.leftWing, this.rightWing, this.body]);

    this.setScale(SCALE);
    this.setDepth(555);
    this.startWingFlapTween();
  }

  startWingFlapTween() {
    this.leftWingTween = this.scene.tweens.add({
      targets: this.leftWing,
      angle: { from: -38, to: 16 },
      duration: FLAP_DURATION_MS,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });

    this.rightWingTween = this.scene.tweens.add({
      targets: this.rightWing,
      angle: { from: 38, to: -16 },
      duration: FLAP_DURATION_MS,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });
  }

  update(time, targetX, targetY) {
    this.anchorX = Phaser.Math.Linear(this.anchorX, targetX, FOLLOW_LERP);
    this.anchorY = Phaser.Math.Linear(this.anchorY, targetY, FOLLOW_LERP);
    const phase = (time / FLAP_DURATION_MS) * Math.PI + this.bobOffset;
    const bob = Math.sin(phase - Math.PI * 0.5) * BOB_AMPLITUDE;
    this.setPosition(this.anchorX, this.anchorY + bob);
  }

  destroy(fromScene) {
    this.leftWingTween?.stop();
    this.rightWingTween?.stop();
    super.destroy(fromScene);
  }
}
