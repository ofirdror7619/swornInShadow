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
const IDLE_SPEED_THRESHOLD = 28;
const FLY_SPEED_THRESHOLD = 150;
const VERTICAL_FLY_THRESHOLD = 80;
const AURA_FADE_LERP = 0.14;
const GROUND_STICK_TIME_MS = 140;

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
    this.isDashing = false;
    this.motionState = "idle";
    this.motionTime = 0;
    this.auraLevel = 0.12;
    this.combatAuraActive = false;
    this.groundedUntil = 0;
    this.isGroundedCached = false;
    this.nextBlinkAt = scene.time.now + Phaser.Math.Between(1200, 2600);
    this.blinkTimeLeft = 0;

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
    this.auraOuter = scene.add.image(0, 10, "fx-flame").setOrigin(0.5, 0.8);
    this.auraInner = scene.add.image(0, 8, "fx-flame").setOrigin(0.5, 0.8);
    this.auraOuter.setBlendMode("ADD");
    this.auraInner.setBlendMode("ADD");
    this.auraOuter.setTint(0xff6d39);
    this.auraInner.setTint(0xffb86c);
    this.auraOuter.setAlpha(0.1);
    this.auraInner.setAlpha(0.08);
    this.auraOuter.setScale(0.5);
    this.auraInner.setScale(0.38);
    this.visual.add([this.auraOuter, this.leftWing, this.rightWing, this.bodySprite, this.eyes, this.auraInner]);

    this.auraEmitter = scene.add.particles(0, 0, "fx-ember", {
      follow: this.visual,
      followOffset: { x: 0, y: 16 },
      lifespan: { min: 240, max: 380 },
      frequency: 52,
      quantity: 1,
      speedX: { min: -10, max: 10 },
      speedY: { min: -56, max: -20 },
      scale: { start: 0.75, end: 0 },
      alpha: { start: 0.3, end: 0 },
      tint: [0xff5f2f, 0xff9149, 0xffc08d],
      blendMode: "ADD",
      emitting: false
    });
    this.auraEmitter.setDepth(PLAYER_RENDER_DEPTH - 2);
    this.groundEmitter = scene.add.particles(0, 0, "fx-ember", {
      follow: this.visual,
      followOffset: { x: 0, y: 32 },
      lifespan: { min: 170, max: 290 },
      frequency: 42,
      quantity: 1,
      speedX: { min: -28, max: 28 },
      speedY: { min: -18, max: -4 },
      scale: { start: 0.38, end: 0 },
      alpha: { start: 0.22, end: 0 },
      tint: [0xff5f2f, 0xff9149],
      blendMode: "ADD",
      emitting: false
    });
    this.groundEmitter.setDepth(PLAYER_RENDER_DEPTH - 1);

    this.updateMotionState(0);
    this.applyPose(scene.time.now, 16);

    this.on("destroy", () => {
      this.auraEmitter?.stop();
      this.auraEmitter?.destroy();
      this.groundEmitter?.stop();
      this.groundEmitter?.destroy();
      this.visual?.destroy();
    });
  }

  setAuraActive(active) {
    this.combatAuraActive = Boolean(active);
  }

  preUpdate(time, delta) {
    super.preUpdate(time, delta);
    this.motionTime += delta * 0.001;
    this.refreshGroundedState(time);
    this.updateMotionState();
    this.updateBlink(time, delta);
    this.applyPose(time, delta);
  }

  updateMotionState() {
    const vx = this.body?.velocity.x ?? 0;
    const vy = this.body?.velocity.y ?? 0;
    const speed = Math.hypot(vx, vy);
    const horizontalSpeed = Math.abs(vx);
    const nearGround = this.isGroundedCached;

    if (this.isDashing || speed >= FLY_SPEED_THRESHOLD || Math.abs(vy) >= VERTICAL_FLY_THRESHOLD) {
      this.motionState = "fly";
      return;
    }
    if (nearGround && horizontalSpeed >= IDLE_SPEED_THRESHOLD) {
      this.motionState = "walk";
      return;
    }
    if (!nearGround && speed >= IDLE_SPEED_THRESHOLD) {
      this.motionState = "fly";
      return;
    }
    this.motionState = "idle";
  }

  refreshGroundedState(now) {
    const body = this.body;
    if (!body) {
      this.isGroundedCached = false;
      return;
    }
    const touchingGround = Boolean(body.blocked.down || body.touching.down || body.wasTouching.down);
    if (touchingGround) {
      this.groundedUntil = now + GROUND_STICK_TIME_MS;
    }
    this.isGroundedCached = now <= this.groundedUntil;
  }

  isGrounded() {
    return this.isGroundedCached;
  }

  updateBlink(now, delta) {
    if (this.blinkTimeLeft > 0) {
      this.blinkTimeLeft = Math.max(0, this.blinkTimeLeft - delta);
      return;
    }
    if (now >= this.nextBlinkAt) {
      this.blinkTimeLeft = Phaser.Math.Between(90, 130);
      this.nextBlinkAt = now + Phaser.Math.Between(1300, 3100);
    }
  }

  applyPose(now, delta) {
    const dir = this.facing < 0 ? -1 : 1;
    const t = this.motionTime;
    const state = this.motionState;
    let bodyBob = 0;
    let bodyScaleX = 1;
    let bodyScaleY = 1;
    let wingLeft = -12;
    let wingRight = 12;
    let bodyTilt = 0;
    let eyesBase = 0.78;
    let auraTarget = 0.12;

    if (state === "idle") {
      bodyBob = Math.sin(t * 2.1) * 1.3;
      bodyScaleX = 1 + Math.sin(t * 1.5) * 0.01;
      bodyScaleY = 1 - Math.sin(t * 1.5) * 0.014;
      wingLeft = -14 + Math.sin(t * 2.6) * 4.4;
      wingRight = 14 - Math.sin(t * 2.6) * 4.4;
      eyesBase = 0.77 + (Math.sin(t * 2.8) + 1) * 0.03;
      auraTarget = 0.08;
    } else if (state === "walk") {
      bodyBob = Math.sin(t * 6.6) * 1.15;
      bodyScaleX = 1 + Math.sin(t * 6.2) * 0.008;
      bodyScaleY = 1 - Math.sin(t * 6.2) * 0.011;
      wingLeft = -15 + Math.sin(t * 4.2) * 3.3;
      wingRight = 15 - Math.sin(t * 4.2) * 3.3;
      bodyTilt = Phaser.Math.Clamp((this.body?.velocity.x ?? 0) * 0.02, -3.5, 3.5);
      eyesBase = 0.8 + (Math.sin(t * 3.7) + 1) * 0.024;
      auraTarget = 0.11;
    } else {
      bodyBob = Math.sin(t * 10.2) * 2.6;
      bodyScaleX = 1 + Math.sin(t * 6.6) * 0.016;
      bodyScaleY = 1 - Math.sin(t * 6.6) * 0.02;
      wingLeft = -26 + Math.sin(t * 14.8) * 8;
      wingRight = 26 - Math.sin(t * 14.8) * 8;
      bodyTilt = Phaser.Math.Clamp((this.body?.velocity.x ?? 0) * 0.04, -7, 7);
      eyesBase = 0.88 + (Math.sin(t * 8.5) + 1) * 0.04;
      auraTarget = 0.24;
    }

    if (this.combatAuraActive) {
      auraTarget = Math.max(auraTarget, 0.65);
      eyesBase = Math.max(eyesBase, 0.92);
    }

    this.auraLevel = Phaser.Math.Linear(this.auraLevel, auraTarget, AURA_FADE_LERP);
    const auraPulse = 0.9 + Math.sin(now * 0.016) * 0.12;
    const blinkClosedFactor =
      this.blinkTimeLeft > 0 ? Math.abs((this.blinkTimeLeft / Math.max(1, 120)) * 2 - 1) : 1;
    const eyesAlpha = Phaser.Math.Clamp(eyesBase * (0.12 + blinkClosedFactor * 0.88), 0.08, 1);

    this.bodySprite.setScale(DEMON_SCALE * bodyScaleX, DEMON_SCALE * bodyScaleY);
    this.leftWing.setAngle(wingLeft);
    this.rightWing.setAngle(wingRight);
    this.eyes.setAlpha(eyesAlpha);
    this.eyes.setScale(this.eyesBaseScale * (1 + this.auraLevel * 0.08));

    this.auraOuter.setAlpha(Phaser.Math.Clamp(this.auraLevel * 0.38, 0.03, 0.34));
    this.auraInner.setAlpha(Phaser.Math.Clamp(this.auraLevel * 0.34, 0.02, 0.3));
    this.auraOuter.setScale(0.46 + this.auraLevel * 0.26 + (auraPulse - 1) * 0.04);
    this.auraInner.setScale(0.34 + this.auraLevel * 0.2 + (auraPulse - 1) * 0.03);
    this.auraOuter.setAngle(Math.sin(now * 0.009) * 4);
    this.auraInner.setAngle(Math.sin(now * 0.012 + 1.3) * -5);

    if (this.combatAuraActive || (state === "fly" && this.auraLevel > 0.3)) {
      this.auraEmitter?.start();
    } else {
      this.auraEmitter?.stop();
    }

    if (state === "walk" && this.isGroundedCached) {
      this.groundEmitter?.start();
    } else {
      this.groundEmitter?.stop();
    }

    this.setFlipX(dir < 0);
    this.setAngle(bodyTilt);
    this.visual.setScale(dir < 0 ? -1 : 1, 1);
    this.visual.setAngle(bodyTilt);
    this.visual.setPosition(this.x, this.y + bodyBob);
  }
}
