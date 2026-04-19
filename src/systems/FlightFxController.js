import Phaser from "phaser";
import { EventBus } from "../core/EventBus";

const TRAIL_DEPTH_OFFSET = 12;
const TRAIL_GHOST_OFFSET = 11;
const TRAIL_COMET_OFFSET = 10;

export class FlightFxController {
  constructor(scene, player) {
    this.scene = scene;
    this.player = player;
    this.fxDepthBase = this.player.visual?.depth ?? this.player.depth ?? 0;
    this.trailTickMs = 0;
    this.infernoTickMs = 0;
    this.goldTickMs = 0;
    this.eyeFlickerTime = 0;
    this.eyeJitterMs = 0;
    this.isDestroyed = false;
    this.buildPersistentFx();
    this.spawnIgniteBurst();
    EventBus.on("player-dashed", this.onDash, this);
  }

  buildPersistentFx() {
    // Idle/Hover: shadow smoke סביב הגוף - איטי ועדין.
    this.smokeEmitter = this.scene.add.particles(0, 0, "fx-smoke", {
      follow: this.player,
      followOffset: { x: 0, y: -2 },
      lifespan: { min: 900, max: 1400 },
      frequency: 120,
      quantity: 1,
      speedX: { min: -10, max: 10 },
      speedY: { min: -30, max: -12 },
      rotate: { min: -25, max: 25 },
      scale: { start: 0.65, end: 1.25 },
      alpha: { start: 0.2, end: 0 },
      tint: 0x1a1222
    });
    this.smokeEmitter.setDepth(this.fxDepthBase - TRAIL_DEPTH_OFFSET);

    // Idle/Hover: ember particles עדינים (אדומים) שעולים למעלה.
    this.emberEmitter = this.scene.add.particles(0, 0, "fx-ember", {
      follow: this.player,
      followOffset: { x: 0, y: 2 },
      lifespan: { min: 500, max: 900 },
      frequency: 90,
      quantity: 1,
      speedX: { min: -10, max: 10 },
      speedY: { min: -45, max: -20 },
      scale: { start: 1, end: 0 },
      alpha: { start: 0.5, end: 0 },
      blendMode: "ADD",
      tint: 0xff432f
    });
    this.emberEmitter.setDepth(this.fxDepthBase - (TRAIL_DEPTH_OFFSET - 1));

    // Persistent infernal envelope: subtle flame dust hugging the demon.
    this.infernoEmitter = this.scene.add.particles(0, 0, "fx-ember", {
      lifespan: { min: 260, max: 520 },
      frequency: -1,
      quantity: 1,
      speedX: { min: -38, max: 38 },
      speedY: { min: -120, max: -28 },
      scale: { start: 2.1, end: 0 },
      alpha: { start: 0.78, end: 0 },
      blendMode: "ADD",
      tint: [0xff3f25, 0xff6f31, 0xff9f4a, 0xffd48b],
      emitZone: {
        source: new Phaser.Geom.Circle(0, 0, 26),
        type: "random"
      },
      emitting: false
    });
    this.infernoEmitter.setDepth(this.fxDepthBase - (TRAIL_DEPTH_OFFSET - 2));

    // Motion trail: golden sparks when moving, tuned by speed.
    this.goldTrailEmitter = this.scene.add.particles(0, 0, "fx-gold", {
      lifespan: { min: 220, max: 420 },
      frequency: -1,
      quantity: 1,
      speedX: { min: -140, max: 140 },
      speedY: { min: -40, max: 40 },
      scale: { start: 1.8, end: 0 },
      alpha: { start: 0.92, end: 0 },
      rotate: { min: -60, max: 60 },
      blendMode: "ADD",
      tint: [0xffb84d, 0xffd88a, 0xfff0be],
      emitting: false
    });
    this.goldTrailEmitter.setDepth(this.fxDepthBase - (TRAIL_DEPTH_OFFSET - 2));

    // Idle/Hover: eye flicker עדין - אם יש שכבת eyes בדמות, נשתמש בה.
    this.usesPlayerEyes = Boolean(this.player.eyes);
    if (!this.usesPlayerEyes) {
      this.leftEye = this.scene.add.circle(this.player.x, this.player.y, 1.7, 0xff2f1c, 0.85);
      this.rightEye = this.scene.add.circle(this.player.x, this.player.y, 1.7, 0xff2f1c, 0.85);
      this.leftEye.setBlendMode("ADD");
      this.rightEye.setBlendMode("ADD");
      this.leftEye.setDepth(this.player.depth + 2);
      this.rightEye.setDepth(this.player.depth + 2);
    }

    this.redEmitter = this.scene.add.particles(0, 0, "fx-red", {
      lifespan: 260,
      speed: { min: 120, max: 250 },
      scale: { start: 1, end: 0 },
      alpha: { start: 0.75, end: 0 },
      blendMode: "ADD",
      emitting: false
    });
    this.redEmitter.setDepth(this.fxDepthBase - (TRAIL_DEPTH_OFFSET - 1));
  }

  update(deltaMs) {
    if (this.isDestroyed) return;
    this.syncFxDepthToPlayer();
    this.updateInfernalEnvelope(deltaMs);
    this.updateGoldTrail(deltaMs);
    this.updateEyeFlicker(deltaMs);
  }

  playMovementTrail(x, y, deltaMs = 16) {
    if (this.isDestroyed) return;
    this.trailTickMs += deltaMs;
    if (this.trailTickMs < 22) return;
    this.trailTickMs = 0;
    this.spawnTrailGhost(x, y);
  }

  updateEyeFlicker(deltaMs) {
    this.eyeFlickerTime += deltaMs;
    this.eyeJitterMs -= deltaMs;
    if (this.eyeJitterMs <= 0) {
      this.eyeJitterMs = 70;
      this.eyeNoise = (Math.random() - 0.5) * 0.16;
    }

    const base = 0.48 + Math.sin(this.eyeFlickerTime * 0.014) * 0.22 + this.eyeNoise;
    const alpha = Math.max(0.25, Math.min(0.95, base));
    const scale = 0.95 + Math.sin(this.eyeFlickerTime * 0.02) * 0.08;

    if (this.usesPlayerEyes) {
      const auraScaleBoost = this.player.eyesAuraScaleBoost ?? 1;
      const auraAlphaBoost = this.player.eyesAuraAlphaBoost ?? 1;
      this.player.eyes.setAlpha(Phaser.Math.Clamp(alpha * auraAlphaBoost, 0.25, 1));
      const eyesBaseScale = this.player.eyesBaseScale ?? 1;
      this.player.eyes.setScale(eyesBaseScale * scale * auraScaleBoost);
      return;
    }

    const dir = this.player.flipX ? -1 : 1;
    const eyeY = this.player.y - 17;
    const leftX = this.player.x + dir * -4.2;
    const rightX = this.player.x + dir * 2.2;
    this.leftEye.setPosition(leftX, eyeY);
    this.rightEye.setPosition(rightX, eyeY);
    this.leftEye.setAlpha(alpha);
    this.rightEye.setAlpha(alpha * 0.9);
    this.leftEye.setScale(scale);
    this.rightEye.setScale(scale * 0.92);
  }

  updateInfernalEnvelope(deltaMs) {
    this.infernoTickMs += deltaMs;
    if (this.infernoTickMs < 16) return;
    this.infernoTickMs = 0;

    const driftX = Math.sin(this.scene.time.now * 0.01) * 3.2;
    const driftY = Math.cos(this.scene.time.now * 0.014) * 1.8;
    this.infernoEmitter.emitParticleAt(this.player.x + driftX, this.player.y - 8 + driftY, 4);
  }

  updateGoldTrail(deltaMs) {
    const speed = Math.hypot(this.player.body.velocity.x, this.player.body.velocity.y);
    const moving = speed > 55;
    if (!moving) {
      return;
    }

    this.goldTickMs += deltaMs;
    if (this.goldTickMs < 10) return;
    this.goldTickMs = 0;

    const vx = this.player.body.velocity.x;
    const vy = this.player.body.velocity.y;
    const tailX = this.player.x + Phaser.Math.Clamp(-vx * 0.03, -14, 14);
    const tailY = this.player.y + 6 + Phaser.Math.Clamp(-vy * 0.02, -8, 8);
    const count = speed > 320 ? 5 : speed > 220 ? 4 : 3;
    this.goldTrailEmitter.emitParticleAt(tailX, tailY, count);
    this.spawnGoldComet(tailX, tailY, vx, vy);
  }

  spawnTrailGhost(x = this.player.x, y = this.player.y) {
    this.syncFxDepthToPlayer();
    const ghost = this.scene.add.image(x, y, "demon-body");
    ghost.setDepth(this.fxDepthBase - TRAIL_GHOST_OFFSET);
    ghost.setScale(this.player.scale * 0.98);
    ghost.setFlipX(this.player.flipX);
    ghost.setAngle(this.player.angle);
    ghost.setTint(0xff5a2a);
    ghost.setAlpha(0.28);
    ghost.setBlendMode("ADD");

    const emberCore = this.scene.add.image(x, y, "demon-body");
    emberCore.setDepth(this.fxDepthBase - (TRAIL_GHOST_OFFSET - 1));
    emberCore.setScale(this.player.scale * 0.82);
    emberCore.setFlipX(this.player.flipX);
    emberCore.setAngle(this.player.angle);
    emberCore.setTint(0xffc26b);
    emberCore.setAlpha(0.16);
    emberCore.setBlendMode("ADD");

    this.scene.tweens.add({
      targets: ghost,
      alpha: 0,
      scale: this.player.scale * 1.14,
      duration: 180,
      ease: "Sine.easeOut",
      onComplete: () => ghost.destroy()
    });

    this.scene.tweens.add({
      targets: emberCore,
      alpha: 0,
      scale: this.player.scale * 1.02,
      duration: 140,
      ease: "Sine.easeOut",
      onComplete: () => emberCore.destroy()
    });

    const goldPulse = this.scene.add.image(x, y, "fx-gold");
    goldPulse.setDepth(this.fxDepthBase - TRAIL_COMET_OFFSET);
    goldPulse.setScale(0.95);
    goldPulse.setAlpha(0.32);
    goldPulse.setBlendMode("ADD");
    this.scene.tweens.add({
      targets: goldPulse,
      alpha: 0,
      scale: 2.7,
      duration: 190,
      ease: "Sine.easeOut",
      onComplete: () => goldPulse.destroy()
    });
  }

  onDash() {
    if (this.isDestroyed) return;
    this.syncFxDepthToPlayer();
    this.redEmitter.emitParticleAt(this.player.x, this.player.y, 18);
    this.scene.cameras.main.shake(90, 0.0025, true);
    this.scene.cameras.main.flash(70, 110, 18, 18, false);
  }

  spawnGoldComet(x, y, vx, vy) {
    this.syncFxDepthToPlayer();
    const comet = this.scene.add.image(x, y, "fx-gold");
    comet.setDepth(this.fxDepthBase - TRAIL_COMET_OFFSET);
    comet.setScale(2.2);
    comet.setAlpha(0.55);
    comet.setBlendMode("ADD");

    const speed = Math.hypot(vx, vy);
    const travel = Phaser.Math.Clamp(speed * 0.04, 10, 26);
    const dirX = speed > 1 ? vx / speed : 0;
    const dirY = speed > 1 ? vy / speed : 0;

    this.scene.tweens.add({
      targets: comet,
      x: x - dirX * travel,
      y: y - dirY * travel,
      alpha: 0,
      scale: 0.6,
      duration: 120,
      ease: "Sine.easeOut",
      onComplete: () => comet.destroy()
    });
  }

  spawnIgniteBurst() {
    this.syncFxDepthToPlayer();
    this.redEmitter.emitParticleAt(this.player.x, this.player.y, 14);
    const burst = this.scene.add.particles(this.player.x, this.player.y, "fx-gold", {
      lifespan: { min: 200, max: 360 },
      speed: { min: 80, max: 220 },
      angle: { min: 0, max: 360 },
      quantity: 20,
      scale: { start: 0.9, end: 0 },
      alpha: { start: 0.7, end: 0 },
      blendMode: "ADD",
      tint: [0xffc26f, 0xffefb7]
    });
    burst.setDepth(this.fxDepthBase - TRAIL_COMET_OFFSET);
    this.scene.time.delayedCall(380, () => {
      burst.destroy();
    });
  }

  destroy() {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    EventBus.off("player-dashed", this.onDash, this);
    this.smokeEmitter?.stop();
    this.emberEmitter?.stop();
    this.redEmitter?.stop();
    this.leftEye?.destroy();
    this.rightEye?.destroy();
    this.smokeEmitter?.destroy();
    this.emberEmitter?.destroy();
    this.infernoEmitter?.destroy();
    this.goldTrailEmitter?.destroy();
    this.redEmitter?.destroy();
  }

  syncFxDepthToPlayer() {
    const currentBase = this.player.visual?.depth ?? this.player.depth ?? this.fxDepthBase;
    if (!Number.isFinite(currentBase)) return;
    this.fxDepthBase = currentBase;
    this.smokeEmitter?.setDepth(this.fxDepthBase - TRAIL_DEPTH_OFFSET);
    this.emberEmitter?.setDepth(this.fxDepthBase - (TRAIL_DEPTH_OFFSET - 1));
    this.infernoEmitter?.setDepth(this.fxDepthBase - (TRAIL_DEPTH_OFFSET - 2));
    this.goldTrailEmitter?.setDepth(this.fxDepthBase - (TRAIL_DEPTH_OFFSET - 2));
    this.redEmitter?.setDepth(this.fxDepthBase - (TRAIL_DEPTH_OFFSET - 1));
    if (!this.usesPlayerEyes) {
      this.leftEye?.setDepth(this.fxDepthBase + 1);
      this.rightEye?.setDepth(this.fxDepthBase + 1);
    }
  }
}
