import Phaser from "phaser";

const DEMON_SCALE = 0.55;
const WING_SPREAD = 6.4;
const WING_OFFSET_Y = -21.6;
const EYES_OFFSET_Y = -8;
const PHYSICS_BODY_WIDTH = 92;
const PHYSICS_BODY_HEIGHT = 118;
const PHYSICS_OFFSET_X = 19;
const PHYSICS_OFFSET_Y = 110;
const PLAYER_RENDER_DEPTH = 700;

export class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, "demon-body");

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setScale(DEMON_SCALE);
    this.setVisible(false);
    this.setSize(PHYSICS_BODY_WIDTH, PHYSICS_BODY_HEIGHT);
    this.setOffset(PHYSICS_OFFSET_X, PHYSICS_OFFSET_Y);
    this.body.setAllowGravity(false);
    this.setCollideWorldBounds(true);
    this.setDrag(1800, 1800);
    this.setMaxVelocity(450, 450);
    this.wingOffsetY = WING_OFFSET_Y;
    this.facing = 1;
    this.breathScaleX = 1;
    this.breathScaleY = 1;

    // Visual character is a container (body + wings + eyes) over the physics anchor.
    this.visual = scene.add.container(this.x, this.y);
    this.visual.setDepth(PLAYER_RENDER_DEPTH);
    this.leftWing = scene.add.image(-WING_SPREAD, this.wingOffsetY, "demon-left-wing").setOrigin(0.92, 0.2);
    this.rightWing = scene.add.image(WING_SPREAD, this.wingOffsetY, "demon-right-wing").setOrigin(0.08, 0.2);
    this.bodySprite = scene.add.image(0, 0, "demon-body").setOrigin(0.5, 0.5);
    this.eyes = scene.add.image(0, EYES_OFFSET_Y, "demon-eyes").setOrigin(0.5, 0.5);
    this.leftWing.setScale(DEMON_SCALE);
    this.rightWing.setScale(DEMON_SCALE);
    this.bodySprite.setScale(DEMON_SCALE);
    this.eyes.setScale(DEMON_SCALE);
    this.eyesBaseScale = DEMON_SCALE;
    this.eyes.setBlendMode("ADD");
    this.visual.add([this.leftWing, this.rightWing, this.bodySprite, this.eyes]);

    this.startWingIdleTween(scene);
    this.startBodyBreathTween(scene);

    this.on("destroy", () => {
      this.leftWingTween?.stop();
      this.rightWingTween?.stop();
      this.visual?.destroy();
    });
  }

  startWingIdleTween(scene) {
    this.leftWing.angle = -26;
    this.rightWing.angle = 26;
    this.leftWingTween = scene.tweens.add({
      targets: this.leftWing,
      angle: -2,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });
    this.rightWingTween = scene.tweens.add({
      targets: this.rightWing,
      angle: 2,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });
  }

  startBodyBreathTween(scene) {
    this.breathTween = scene.tweens.add({
      targets: this,
      breathScaleX: 1.02,
      breathScaleY: 0.98,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });
  }

  preUpdate(time, delta) {
    super.preUpdate(time, delta);
    const dir = this.facing < 0 ? -1 : 1;
    const moving = Math.abs(this.body.velocity.x) > 1 || Math.abs(this.body.velocity.y) > 1;
    const bodyBob = Math.sin(time * 0.004 - Math.PI * 0.5) * 2.2;

    this.setFlipX(dir < 0);
    this.setAngle(moving ? 10 * dir : 0);
    this.visual.setScale((dir < 0 ? -1 : 1) * this.breathScaleX, this.breathScaleY);
    this.visual.setAngle(this.angle);
    this.visual.setPosition(this.x, this.y + bodyBob);
  }
}
