import Phaser from "phaser";
import { GameState } from "../core/GameState";

const ENEMY_SCALE = 0.5;
const PATROL_SPEED = 84;
const CHASE_SPEED = 118;
const CHASE_RADIUS = 300;
const ATTACK_RANGE = 106;
const ATTACK_COOLDOWN_MS = 1080;
const WINDUP_MS = 280;
const LUNGE_MS = 260;
const RECOVER_MS = 280;
const LUNGE_SPEED = 318;
const DIVE_MIN_RANGE = 140;
const DIVE_MAX_RANGE = 340;
const DIVE_WINDUP_MS = 470;
const DIVE_LUNGE_MS = 300;
const DIVE_RECOVER_MS = 460;
const DIVE_SPEED = 450;
const DIVE_COOLDOWN_MS = 3400;
const MAX_HEALTH = 96;
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
const AURA_DURATION_MS = 2200;
const AURA_COOLDOWN_MS = 2600;
const AURA_TRIGGER_RANGE = 230;
const AURA_RADIUS = 90;
const AURA_DAMAGE = 10;
const AURA_ORBIT_COUNT = 5;
const AURA_ORBIT_Y_SCALE = 0.72;
const AURA_ORBIT_SPEED = 0.0043;
const WOUNDED_THRESHOLD_PCT = 0.4;
const WOUNDED_CHASE_MULTIPLIER = 1.2;
const WOUNDED_DIVE_COOLDOWN_MS = 2200;
const WOUNDED_AURA_COOLDOWN_MS = 1700;
const WOUNDED_AURA_DAMAGE = 12;

export class EnemyAngel extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, patrol, _options = {}) {
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
    this.contactDamage = 13;
    this.enemyType = "angel";
    this.bobOffset = Phaser.Math.FloatBetween(0, Math.PI * 2);
    this.trailEmitterTickMs = 0;
    this.ghostTrailTickMs = 0;
    this.diveCooldownLeft = Phaser.Math.Between(900, 1800);
    this.auraActiveLeft = 0;
    this.auraCooldownLeft = Phaser.Math.Between(700, 1800);
    this.auraOrbitTime = 0;
    this.auraDamage = AURA_DAMAGE;
    this.wounded = false;
    this.telegraphGraphics = scene.add.graphics();
    this.telegraphGraphics.setDepth(RENDER_DEPTH + 2);

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
    this.auraFlames = this.createAuraFlames();
    this.auraFlameTrails = this.createAuraFlameTrails();
    this.auraRing = scene.add.circle(this.x, this.y, AURA_RADIUS, 0x66bfff, 0.08);
    this.auraRing.setStrokeStyle(2, 0x9ad9ff, 0.5);
    this.auraRing.setDepth(RENDER_DEPTH + 2);
    this.auraRing.setVisible(false);
    this.setAuraFlamesVisible(false);

    this.startWingFlapTween();

    this.on("destroy", () => {
      this.leftWingTween?.stop();
      this.rightWingTween?.stop();
      this.visual?.destroy();
      this.vitalBar?.destroy();
      this.blueTrailEmitter?.destroy();
      this.auraFlames?.forEach((flame) => flame.destroy());
      this.auraFlameTrails?.forEach((trail) => trail.destroy());
      this.auraRing?.destroy();
      this.telegraphGraphics?.destroy();
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
    this.diveCooldownLeft = Math.max(0, this.diveCooldownLeft - delta);
    this.auraCooldownLeft = Math.max(0, this.auraCooldownLeft - delta);
    if (this.auraActiveLeft > 0) {
      this.auraActiveLeft = Math.max(0, this.auraActiveLeft - delta);
      this.auraOrbitTime += delta;
      this.syncAuraFlames();
      if (this.auraActiveLeft <= 0) {
        this.setAuraFlamesVisible(false);
      }
    }
    this.syncVisual(time);
    this.drawVitalBar();
    this.spawnMovementTrail(delta);
    if (this.state !== "dive_windup") {
      this.telegraphGraphics.clear();
    }
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
      const chaseSpeed = this.wounded ? CHASE_SPEED * WOUNDED_CHASE_MULTIPLIER : CHASE_SPEED;
      this.body.setVelocity(dir.x * chaseSpeed, dir.y * chaseSpeed);
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

      if (this.shouldDive(distance)) {
        this.state = "dive_windup";
        this.stateTimeLeft = DIVE_WINDUP_MS;
        this.body.setVelocity(0, 0);
        this.attackVector = this.predictDiveVector(player);
        this.setVisualTint(0x9fd8ff);
        return;
      }

      if (distance <= AURA_TRIGGER_RANGE && this.auraCooldownLeft <= 0) {
        this.activateBlueAura();
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

    if (this.state === "dive_windup") {
      this.stateTimeLeft -= deltaMs;
      this.body.setVelocity(0, 0);
      this.attackVector = this.predictDiveVector(player);
      const windupPct = Phaser.Math.Clamp(1 - this.stateTimeLeft / DIVE_WINDUP_MS, 0, 1);
      this.drawAttackTelegraph(this.attackVector, windupPct);
      if (this.stateTimeLeft <= 0) {
        this.clearVisualTint();
        this.telegraphGraphics.clear();
        this.state = "dive_lunge";
        this.stateTimeLeft = DIVE_LUNGE_MS;
        this.body.setVelocity(this.attackVector.x * DIVE_SPEED, this.attackVector.y * DIVE_SPEED);
        this.attackCooldownLeft = ATTACK_COOLDOWN_MS;
        this.diveCooldownLeft = DIVE_COOLDOWN_MS;
      }
      return;
    }

    if (this.state === "dive_lunge") {
      this.stateTimeLeft -= deltaMs;
      if (this.stateTimeLeft <= 0) {
        this.state = "recover";
        this.stateTimeLeft = DIVE_RECOVER_MS;
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
    return !this.isDead && (this.state === "lunge" || this.state === "dive_lunge");
  }

  canAuraDamagePlayer(player) {
    if (this.isDead || this.auraActiveLeft <= 0 || !player?.active) return false;
    const playerY = player.body?.center?.y ?? player.y;
    const distance = Phaser.Math.Distance.Between(this.x, this.y, player.x, playerY);
    return distance <= AURA_RADIUS;
  }

  getAuraHitVector(player) {
    const playerY = player?.body?.center?.y ?? player?.y ?? this.y;
    const hitDir = new Phaser.Math.Vector2(player.x - this.x, playerY - this.y);
    if (hitDir.lengthSq() < 0.0001) {
      hitDir.set(this.patrolDir, 0);
    } else {
      hitDir.normalize();
    }
    return hitDir;
  }

  takeDamage(amount, hitDir) {
    if (this.isDead) return false;

    this.health -= amount;
    this.updateWoundedState();
    if (this.isRoomEnemy && this.spawnRoomId && this.spawnEnemyId) {
      GameState.setRoomEnemyHealth(this.spawnRoomId, this.spawnEnemyId, this.health);
    }
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
      this.auraActiveLeft = 0;
      this.setAuraFlamesVisible(false);
      if (this.isRoomEnemy && this.spawnRoomId && this.spawnEnemyId) {
        GameState.setRoomEnemyHealth(this.spawnRoomId, this.spawnEnemyId, 0);
        GameState.markRoomEnemyDefeated(this.spawnRoomId, this.spawnEnemyId);
      }
      this.body.setVelocity(0, 0);
      this.visual?.destroy();
      this.vitalBar?.destroy();
      this.disableBody(true, true);
      return true;
    }

    if (this.state === "windup" || this.state === "lunge" || this.state === "dive_windup" || this.state === "dive_lunge") {
      this.telegraphGraphics.clear();
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

  shouldDive(distance) {
    if (this.diveCooldownLeft > 0) return false;
    const minRange = this.wounded ? DIVE_MIN_RANGE - 25 : DIVE_MIN_RANGE;
    const maxRange = this.wounded ? DIVE_MAX_RANGE + 50 : DIVE_MAX_RANGE;
    return distance >= minRange && distance <= maxRange;
  }

  updateWoundedState() {
    if (this.wounded || this.health > MAX_HEALTH * WOUNDED_THRESHOLD_PCT) return;
    this.wounded = true;
    this.auraDamage = WOUNDED_AURA_DAMAGE;
    this.diveCooldownLeft = Math.min(this.diveCooldownLeft, WOUNDED_DIVE_COOLDOWN_MS);
    this.auraCooldownLeft = Math.min(this.auraCooldownLeft, WOUNDED_AURA_COOLDOWN_MS);
    this.auraRing?.setStrokeStyle(2, 0xffd39a, 0.68);
    this.scene.add
      .particles(this.x, this.y, "fx-ember", {
        lifespan: { min: 180, max: 320 },
        quantity: 10,
        speed: { min: 40, max: 120 },
        scale: { start: 1.1, end: 0 },
        alpha: { start: 0.7, end: 0 },
        tint: [0xffc978, 0xffefba, 0xff8c66],
        blendMode: "ADD"
      })
      .setDepth(RENDER_DEPTH + 3);
  }

  predictDiveVector(player) {
    const px = player.x + (player.body?.velocity.x ?? 0) * 0.2;
    const py = player.y + (player.body?.velocity.y ?? 0) * 0.2;
    const toPredicted = new Phaser.Math.Vector2(px - this.x, py - this.y);
    if (toPredicted.lengthSq() < 0.0001) {
      return new Phaser.Math.Vector2(this.patrolDir, 0);
    }
    return toPredicted.normalize();
  }

  drawAttackTelegraph(vector, pct) {
    if (!this.telegraphGraphics?.active) return;
    const dist = Phaser.Math.Linear(50, 240, pct);
    const toX = this.x + vector.x * dist;
    const toY = this.y + vector.y * dist;
    this.telegraphGraphics.clear();
    this.telegraphGraphics.lineStyle(2 + pct, 0xbce7ff, 0.5 + pct * 0.4);
    this.telegraphGraphics.beginPath();
    this.telegraphGraphics.moveTo(this.x, this.y);
    this.telegraphGraphics.lineTo(toX, toY);
    this.telegraphGraphics.strokePath();
    this.telegraphGraphics.lineStyle(1.5, 0xe8f7ff, 0.45 + pct * 0.3);
    this.telegraphGraphics.strokeCircle(toX, toY, 8 + pct * 9);
  }

  activateBlueAura() {
    this.auraCooldownLeft = AURA_COOLDOWN_MS;
    this.auraActiveLeft = AURA_DURATION_MS;
    this.auraOrbitTime = 0;
    this.setAuraFlamesVisible(true);
    this.syncAuraFlames();
  }

  createAuraFlames() {
    return Array.from({ length: AURA_ORBIT_COUNT }, () => {
      const flame = this.scene.add.image(this.x, this.y, "fx-flame");
      flame.setOrigin(0.5, 0.78);
      flame.setBlendMode("ADD");
      flame.setDepth(RENDER_DEPTH + 3);
      flame.setTint(0x86d1ff);
      return flame;
    });
  }

  createAuraFlameTrails() {
    return this.auraFlames.map((flame) => {
      const trail = this.scene.add.particles(0, 0, "fx-ember", {
        follow: flame,
        lifespan: { min: 180, max: 320 },
        frequency: 30,
        quantity: 1,
        speedX: { min: -24, max: 24 },
        speedY: { min: -54, max: -18 },
        scale: { start: 1.05, end: 0 },
        alpha: { start: 0.42, end: 0 },
        blendMode: "ADD",
        tint: [0x64b8ff, 0x93d3ff, 0xdaf4ff],
        emitting: false
      });
      trail.setDepth(RENDER_DEPTH + 2);
      return trail;
    });
  }

  setAuraFlamesVisible(visible) {
    this.auraFlames?.forEach((flame) => {
      flame.setVisible(visible);
      if (!visible) flame.setAlpha(0);
    });
    this.auraFlameTrails?.forEach((trail) => {
      if (visible) trail.start();
      else trail.stop();
    });
    if (this.auraRing?.active) {
      this.auraRing.setVisible(visible);
      this.auraRing.setAlpha(visible ? 0.24 : 0);
    }
  }

  syncAuraFlames() {
    const centerX = this.x;
    const centerY = this.y - 12;
    const orbitRadius = AURA_RADIUS - 10;
    const baseAngle = this.auraOrbitTime * AURA_ORBIT_SPEED;
    const step = (Math.PI * 2) / AURA_ORBIT_COUNT;
    for (let i = 0; i < this.auraFlames.length; i += 1) {
      const flame = this.auraFlames[i];
      const t = baseAngle + i * step;
      const x = centerX + Math.cos(t) * orbitRadius;
      const y = centerY + Math.sin(t) * orbitRadius * AURA_ORBIT_Y_SCALE;
      const pulse = 0.5 + Math.sin(this.auraOrbitTime * 0.012 + i * 0.9) * 0.5;
      flame.setPosition(x, y);
      flame.setScale(0.9 + pulse * 0.14, 1.04 - pulse * 0.12);
      flame.setAlpha(0.55 + pulse * 0.3);
      flame.setAngle(Phaser.Math.RadToDeg(t) + 90);
      flame.setTint(
        Phaser.Display.Color.Interpolate.ColorWithColor(
          Phaser.Display.Color.ValueToColor(0x61b6ff),
          Phaser.Display.Color.ValueToColor(0xcff1ff),
          100,
          Math.round(pulse * 100)
        ).color
      );
    }
    if (this.auraRing?.active) {
      const ringPulse = 0.2 + Math.sin(this.auraOrbitTime * 0.012) * 0.08;
      this.auraRing.setPosition(centerX, centerY);
      this.auraRing.setAlpha(0.2 + ringPulse);
      this.auraRing.setScale(0.95 + ringPulse * 0.35);
    }
  }

  syncAuraDepth(enemyDepth) {
    this.auraFlames?.forEach((flame) => flame.setDepth(enemyDepth + 3));
    this.auraFlameTrails?.forEach((trail) => trail.setDepth(enemyDepth + 2));
    this.auraRing?.setDepth(enemyDepth + 1);
  }
}
