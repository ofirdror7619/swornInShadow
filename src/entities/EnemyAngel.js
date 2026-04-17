import Phaser from "phaser";

const ENEMY_SCALE = 0.5;
const PATROL_SPEED = 84;
const CHASE_SPEED = 132;
const CHASE_RADIUS = 300;
const ATTACK_RANGE = 106;
const ATTACK_COOLDOWN_MS = 950;
const WINDUP_MS = 240;
const LUNGE_MS = 260;
const RECOVER_MS = 240;
const LUNGE_SPEED = 360;
const MAX_HEALTH = 120;
const RENDER_DEPTH = 520;
const FLAP_DURATION_MS = 900;
const BOB_AMPLITUDE = 5;
const WING_OFFSET_Y = -36;
const VITAL_BAR_WIDTH = 34;
const VITAL_BAR_HEIGHT = 5;
const VITAL_BAR_OFFSET_Y = -96;
const MAX_BODY_TILT = 10;
const PHYSICS_BODY_WIDTH = 110;
const PHYSICS_BODY_HEIGHT = 140;
const PHYSICS_OFFSET_X = 91;
const PHYSICS_OFFSET_Y = 65;

export class EnemyAngel extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, patrol) {
    super(scene, x, y, "angel-body");
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setScale(ENEMY_SCALE);
    this.setOrigin(0.5);
    this.setDepth(RENDER_DEPTH);
    this.setVisible(false);
    this.setCollideWorldBounds(true);
    this.body.setAllowGravity(false);
    this.body.setDrag(1600, 1600);
    this.body.setMaxVelocity(320, 320);
    this.body.setSize(PHYSICS_BODY_WIDTH, PHYSICS_BODY_HEIGHT);
    this.body.setOffset(PHYSICS_OFFSET_X, PHYSICS_OFFSET_Y);

    this.leftBound = patrol.left;
    this.rightBound = patrol.right;
    this.patrolY = patrol.y;
    this.patrolDir = 1;
    this.state = "patrol";
    this.attackCooldownLeft = Phaser.Math.Between(180, 520);
    this.stateTimeLeft = 0;
    this.attackVector = new Phaser.Math.Vector2(1, 0);
    this.health = MAX_HEALTH;
    this.isDead = false;
    this.contactDamage = 18;
    this.enemyType = "angel";
    this.bobOffset = Phaser.Math.FloatBetween(0, Math.PI * 2);
    this.trailEmitterTickMs = 0;
    this.ghostTrailTickMs = 0;

    this.visual = scene.add.container(this.x, this.y);
    this.visual.setDepth(RENDER_DEPTH + 1);
    this.leftWing = scene.add.image(-26, WING_OFFSET_Y, "angel-left-wing").setOrigin(0.92, 0.2);
    this.rightWing = scene.add.image(26, WING_OFFSET_Y, "angel-right-wing").setOrigin(0.08, 0.2);
    this.bodySprite = scene.add.image(0, 0, "angel-body").setOrigin(0.5, 0.5);
    this.leftWing.setScale(ENEMY_SCALE);
    this.rightWing.setScale(ENEMY_SCALE);
    this.bodySprite.setScale(ENEMY_SCALE);
    this.visual.add([this.leftWing, this.rightWing, this.bodySprite]);

    this.vitalBar = scene.add.graphics();
    this.vitalBar.setDepth(RENDER_DEPTH + 3);
    this.blueTrailEmitter = scene.add.particles(0, 0, "fx-gold", {
      lifespan: { min: 210, max: 410 },
      frequency: -1,
      quantity: 1,
      speedX: { min: -140, max: 140 },
      speedY: { min: -40, max: 40 },
      scale: { start: 1.7, end: 0 },
      alpha: { start: 0.88, end: 0 },
      rotate: { min: -60, max: 60 },
      blendMode: "ADD",
      tint: [0x64b8ff, 0x96d6ff, 0xdaf4ff],
      emitting: false
    });
    this.blueTrailEmitter.setDepth(RENDER_DEPTH - 2);

    this.startWingFlapTween();

    this.on("destroy", () => {
      this.leftWingTween?.stop();
      this.rightWingTween?.stop();
      this.visual?.destroy();
      this.vitalBar?.destroy();
      this.blueTrailEmitter?.destroy();
    });
  }

  startWingFlapTween() {
    this.leftWingTween = this.scene.tweens.add({
      targets: this.leftWing,
      angle: { from: -40, to: 18 },
      duration: FLAP_DURATION_MS,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });

    this.rightWingTween = this.scene.tweens.add({
      targets: this.rightWing,
      angle: { from: 40, to: -18 },
      duration: FLAP_DURATION_MS,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });
  }

  preUpdate(time, delta) {
    super.preUpdate(time, delta);
    if (this.isDead) return;

    this.attackCooldownLeft = Math.max(0, this.attackCooldownLeft - delta);
    this.syncVisual(time);
    this.drawVitalBar();
    this.spawnMovementTrail(delta);
  }

  syncVisual(time) {
    const facing = this.body.velocity.x < -4 ? -1 : this.body.velocity.x > 4 ? 1 : this.patrolDir;
    const phase = (time / FLAP_DURATION_MS) * Math.PI + this.bobOffset;
    const bob = Math.sin(phase - Math.PI * 0.5) * BOB_AMPLITUDE;
    const tilt = Phaser.Math.Clamp(this.body.velocity.x * 0.06, -MAX_BODY_TILT, MAX_BODY_TILT);
    this.setFlipX(facing < 0);
    this.visual.setPosition(this.x, this.y + bob);
    this.visual.setScale(facing < 0 ? -1 : 1, 1);
    this.visual.setAngle(tilt);
  }

  spawnMovementTrail(deltaMs) {
    const speed = Math.hypot(this.body.velocity.x, this.body.velocity.y);
    if (speed < 48 || !this.active) return;
    this.trailEmitterTickMs += deltaMs;
    this.ghostTrailTickMs += deltaMs;

    const vx = this.body.velocity.x;
    const vy = this.body.velocity.y;
    const tailX = this.x + Phaser.Math.Clamp(-vx * 0.03, -14, 14);
    const tailY = this.y + 4 + Phaser.Math.Clamp(-vy * 0.02, -8, 8);

    if (this.trailEmitterTickMs >= 10) {
      this.trailEmitterTickMs = 0;
      const count = speed > 320 ? 5 : speed > 220 ? 4 : 3;
      this.blueTrailEmitter.emitParticleAt(tailX, tailY, count);
      this.spawnBlueComet(tailX, tailY, vx, vy);
    }

    if (this.ghostTrailTickMs < 34) return;
    this.ghostTrailTickMs = 0;

    const ghost = this.scene.add.image(this.x, this.y, "angel-body");
    ghost.setDepth(RENDER_DEPTH - 3);
    ghost.setScale(ENEMY_SCALE * 0.92);
    ghost.setTint(0x7ec9ff);
    ghost.setAlpha(0.22);
    ghost.setBlendMode("ADD");

    const core = this.scene.add.image(this.x, this.y, "angel-body");
    core.setDepth(RENDER_DEPTH - 2);
    core.setScale(ENEMY_SCALE * 0.78);
    core.setTint(0xb8e6ff);
    core.setAlpha(0.15);
    core.setBlendMode("ADD");

    this.scene.tweens.add({
      targets: ghost,
      alpha: 0,
      scale: ENEMY_SCALE * 1.08,
      duration: 170,
      ease: "Sine.easeOut",
      onComplete: () => ghost.destroy()
    });
    this.scene.tweens.add({
      targets: core,
      alpha: 0,
      scale: ENEMY_SCALE * 0.94,
      duration: 140,
      ease: "Sine.easeOut",
      onComplete: () => core.destroy()
    });
  }

  spawnBlueComet(x, y, vx, vy) {
    const comet = this.scene.add.image(x, y, "fx-gold");
    comet.setDepth(RENDER_DEPTH - 1);
    comet.setScale(2.1);
    comet.setAlpha(0.52);
    comet.setTint(0xa9e2ff);
    comet.setBlendMode("ADD");

    const speed = Math.hypot(vx, vy);
    const travel = Phaser.Math.Clamp(speed * 0.04, 10, 24);
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

  drawVitalBar() {
    if (!this.vitalBar?.active) return;
    const ratio = Phaser.Math.Clamp(this.health / MAX_HEALTH, 0, 1);
    const x = this.x - VITAL_BAR_WIDTH * 0.5;
    const y = this.y + VITAL_BAR_OFFSET_Y;
    const fillWidth = Math.max(0, (VITAL_BAR_WIDTH - 2) * ratio);
    const fillColor =
      ratio > 0.55 ? 0x95f7b2 : ratio > 0.25 ? 0xffdb8a : 0xff8e8e;

    this.vitalBar.clear();
    this.vitalBar.fillStyle(0x0f1014, 0.72);
    this.vitalBar.fillRoundedRect(x, y, VITAL_BAR_WIDTH, VITAL_BAR_HEIGHT, 2);
    this.vitalBar.fillStyle(fillColor, 0.95);
    this.vitalBar.fillRoundedRect(x + 1, y + 1, fillWidth, VITAL_BAR_HEIGHT - 2, 1);
    this.vitalBar.lineStyle(1, 0xe6f4ff, 0.35);
    this.vitalBar.strokeRoundedRect(x, y, VITAL_BAR_WIDTH, VITAL_BAR_HEIGHT, 2);
  }

  updateBehavior(player, deltaMs) {
    if (this.isDead || !player?.active) return;

    const distance = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);

    if (this.state === "patrol") {
      this.runPatrolStep();
      if (distance <= CHASE_RADIUS) {
        this.state = "chase";
      }
      return;
    }

    if (this.state === "chase") {
      const toPlayer = new Phaser.Math.Vector2(player.x - this.x, player.y - this.y);
      const dir = toPlayer.clone().normalize();
      this.body.setVelocity(dir.x * CHASE_SPEED, dir.y * CHASE_SPEED);
      if (Math.abs(this.body.velocity.x) > 4) {
        this.patrolDir = this.body.velocity.x < 0 ? -1 : 1;
      }

      if (distance <= ATTACK_RANGE && this.attackCooldownLeft <= 0) {
        this.state = "windup";
        this.stateTimeLeft = WINDUP_MS;
        this.attackVector = dir.lengthSq() > 0.001 ? dir : new Phaser.Math.Vector2(1, 0);
        this.body.setVelocity(0, 0);
        this.setVisualTint(0xd6efff);
        return;
      }

      if (distance > CHASE_RADIUS * 1.25) {
        this.state = "patrol";
      }
      return;
    }

    if (this.state === "windup") {
      this.stateTimeLeft -= deltaMs;
      this.body.setVelocity(0, 0);
      if (this.stateTimeLeft <= 0) {
        this.clearVisualTint();
        this.state = "lunge";
        this.stateTimeLeft = LUNGE_MS;
        this.body.setVelocity(this.attackVector.x * LUNGE_SPEED, this.attackVector.y * LUNGE_SPEED);
      }
      return;
    }

    if (this.state === "lunge") {
      this.stateTimeLeft -= deltaMs;
      if (this.stateTimeLeft <= 0) {
        this.state = "recover";
        this.stateTimeLeft = RECOVER_MS;
        this.body.setVelocity(0, 0);
      }
      return;
    }

    if (this.state === "recover") {
      this.stateTimeLeft -= deltaMs;
      this.body.setVelocity(0, 0);
      if (this.stateTimeLeft <= 0) {
        this.state = "chase";
        this.attackCooldownLeft = ATTACK_COOLDOWN_MS;
      }
    }
  }

  runPatrolStep() {
    if (this.x >= this.rightBound) {
      this.patrolDir = -1;
    } else if (this.x <= this.leftBound) {
      this.patrolDir = 1;
    }
    this.body.setVelocity(this.patrolDir * PATROL_SPEED, (this.patrolY - this.y) * 2.8);
  }

  canDamagePlayer() {
    return !this.isDead && this.state === "lunge";
  }

  takeDamage(amount, hitDir) {
    if (this.isDead) return false;

    this.health -= amount;
    this.setVisualTint(0x99dcff);
    this.scene.time.delayedCall(90, () => {
      if (this.active) this.clearVisualTint();
    });

    if (hitDir && this.body) {
      this.body.velocity.x += hitDir.x * 110;
      this.body.velocity.y += hitDir.y * 110;
    }

    if (this.health <= 0) {
      this.isDead = true;
      this.body.setVelocity(0, 0);
      this.visual?.destroy();
      this.vitalBar?.destroy();
      this.disableBody(true, true);
      return true;
    }

    if (this.state === "windup" || this.state === "lunge") {
      this.state = "recover";
      this.stateTimeLeft = RECOVER_MS;
      this.attackCooldownLeft = ATTACK_COOLDOWN_MS;
    }

    return false;
  }

  setVisualTint(tint) {
    this.leftWing.setTint(tint);
    this.rightWing.setTint(tint);
    this.bodySprite.setTint(tint);
  }

  clearVisualTint() {
    this.leftWing.clearTint();
    this.rightWing.clearTint();
    this.bodySprite.clearTint();
  }
}
