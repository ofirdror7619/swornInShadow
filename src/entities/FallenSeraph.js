import Phaser from "phaser";
import { GameState } from "../core/GameState";
import { EventBus } from "../core/EventBus";

const SCALE = 0.74;
const PATROL_SPEED = 78;
const CHASE_SPEED = 118;
const CHASE_SPEED_RAGE = 142;
const CHASE_RADIUS = 420;
const ATTACK_RANGE = 124;
const ATTACK_COOLDOWN_MS = 1120;
const WINDUP_MS = 260;
const LUNGE_MS = 280;
const RECOVER_MS = 260;
const LUNGE_SPEED = 340;
const DIVE_MIN_RANGE = 150;
const DIVE_MAX_RANGE = 390;
const DIVE_WINDUP_MS = 450;
const DIVE_LUNGE_MS = 320;
const DIVE_RECOVER_MS = 420;
const DIVE_SPEED = 490;
const DIVE_COOLDOWN_MS = 3200;
const MAX_HEALTH = 240;
const RAGE_THRESHOLD_PCT = 0.42;
const PHASE1_DAMAGE_REDUCTION = 0.22;
const RENDER_DEPTH = 520;
const FLAP_DURATION_MS = 860;
const BOB_AMPLITUDE = 5;
const WING_OFFSET_Y = -36;
const VITAL_BAR_WIDTH = 54;
const VITAL_BAR_HEIGHT = 6;
const VITAL_BAR_OFFSET_Y = -136;
const MAX_BODY_TILT = 10;
const PHYSICS_BODY_WIDTH = 138;
const PHYSICS_BODY_HEIGHT = 180;
const PHYSICS_OFFSET_X = 80;
const PHYSICS_OFFSET_Y = 40;
const AURA_DURATION_MS = 2800;
const AURA_COOLDOWN_MS = 2800;
const AURA_TRIGGER_RANGE = 260;
const AURA_RADIUS = 104;
const AURA_DAMAGE = 10;
const AURA_DAMAGE_RAGE = 14;
const AURA_ORBIT_COUNT = 7;
const AURA_ORBIT_Y_SCALE = 0.72;
const AURA_ORBIT_SPEED = 0.0048;

export class FallenSeraph extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, patrol) {
    super(scene, x, y, "angel-body");
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.maxHealth = MAX_HEALTH;
    this.phase = 1;

    this.setScale(SCALE);
    this.setOrigin(0.5);
    this.setDepth(RENDER_DEPTH);
    this.setVisible(false);
    this.setCollideWorldBounds(true);
    this.body.setAllowGravity(false);
    this.body.setDrag(1600, 1600);
    this.body.setMaxVelocity(420, 420);
    this.body.setSize(PHYSICS_BODY_WIDTH, PHYSICS_BODY_HEIGHT);
    this.body.setOffset(PHYSICS_OFFSET_X, PHYSICS_OFFSET_Y);

    this.leftBound = patrol.left;
    this.rightBound = patrol.right;
    this.patrolY = patrol.y;
    this.patrolDir = 1;
    this.state = "patrol";
    this.attackCooldownLeft = Phaser.Math.Between(140, 280);
    this.stateTimeLeft = 0;
    this.attackVector = new Phaser.Math.Vector2(1, 0);
    this.health = this.maxHealth;
    this.isDead = false;
    this.contactDamage = 12;
    this.enemyType = "fallen_seraph";
    this.bobOffset = Phaser.Math.FloatBetween(0, Math.PI * 2);
    this.trailEmitterTickMs = 0;
    this.diveCooldownLeft = Phaser.Math.Between(700, 1400);
    this.auraActiveLeft = 0;
    this.auraCooldownLeft = Phaser.Math.Between(400, 1000);
    this.auraOrbitTime = 0;
    this.auraDamage = AURA_DAMAGE;
    this.telegraphGraphics = scene.add.graphics();
    this.telegraphGraphics.setDepth(RENDER_DEPTH + 2);

    this.visual = scene.add.container(this.x, this.y);
    this.visual.setDepth(RENDER_DEPTH + 1);
    this.leftWing = scene.add.image(-30, WING_OFFSET_Y, "angel-left-wing").setOrigin(0.92, 0.2);
    this.rightWing = scene.add.image(30, WING_OFFSET_Y, "angel-right-wing").setOrigin(0.08, 0.2);
    this.bodySprite = scene.add.image(0, 0, "angel-body").setOrigin(0.5, 0.5);
    this.leftWing.setScale(SCALE);
    this.rightWing.setScale(SCALE);
    this.bodySprite.setScale(SCALE);
    this.visual.add([this.leftWing, this.rightWing, this.bodySprite]);

    this.vitalBar = scene.add.graphics();
    this.vitalBar.setDepth(RENDER_DEPTH + 3);
    this.blueTrailEmitter = scene.add.particles(0, 0, "fx-gold", {
      lifespan: { min: 210, max: 410 },
      frequency: -1,
      quantity: 1,
      speedX: { min: -140, max: 140 },
      speedY: { min: -40, max: 40 },
      scale: { start: 1.8, end: 0 },
      alpha: { start: 0.88, end: 0 },
      rotate: { min: -60, max: 60 },
      blendMode: "ADD",
      tint: [0x5ab4ff, 0x91d6ff, 0xdbf5ff],
      emitting: false
    });
    this.blueTrailEmitter.setDepth(RENDER_DEPTH - 2);
    this.auraFlames = this.createAuraFlames();
    this.auraFlameTrails = this.createAuraFlameTrails();
    this.auraRing = scene.add.circle(this.x, this.y, AURA_RADIUS, 0x66bfff, 0.08);
    this.auraRing.setStrokeStyle(2, 0x9ad9ff, 0.5);
    this.auraRing.setDepth(RENDER_DEPTH + 2);
    this.auraRing.setVisible(false);
    this.shieldRing = scene.add.circle(this.x, this.y - 12, AURA_RADIUS + 16, 0x84cdff, 0.09);
    this.shieldRing.setStrokeStyle(3, 0xb8e8ff, 0.62);
    this.shieldRing.setDepth(RENDER_DEPTH + 4);
    this.setAuraFlamesVisible(false);

    this.startWingFlapTween();
    this.applyPhaseTint();

    this.on("destroy", () => {
      this.leftWingTween?.stop();
      this.rightWingTween?.stop();
      this.visual?.destroy();
      this.vitalBar?.destroy();
      this.blueTrailEmitter?.destroy();
      this.auraFlames?.forEach((flame) => flame.destroy());
      this.auraFlameTrails?.forEach((trail) => trail.destroy());
      this.auraRing?.destroy();
      this.shieldRing?.destroy();
      this.telegraphGraphics?.destroy();
    });
  }

  startWingFlapTween() {
    this.leftWingTween = this.scene.tweens.add({
      targets: this.leftWing,
      angle: { from: -42, to: 22 },
      duration: FLAP_DURATION_MS,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });

    this.rightWingTween = this.scene.tweens.add({
      targets: this.rightWing,
      angle: { from: 42, to: -22 },
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
    this.syncShieldVisual(time);
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

  syncShieldVisual(time) {
    if (!this.shieldRing?.active) return;
    if (this.phase === 1 && !this.isDead) {
      const pulse = 0.62 + Math.sin(time * 0.006) * 0.16;
      this.shieldRing.setVisible(true);
      this.shieldRing.setPosition(this.x, this.y - 12);
      this.shieldRing.setScale(0.98 + pulse * 0.14);
      this.shieldRing.setAlpha(0.25 + pulse * 0.22);
    } else {
      this.shieldRing.setVisible(false);
      this.shieldRing.setAlpha(0);
    }
  }

  spawnMovementTrail(deltaMs) {
    const speed = Math.hypot(this.body.velocity.x, this.body.velocity.y);
    if (speed < 48 || !this.active) return;
    this.trailEmitterTickMs += deltaMs;

    const vx = this.body.velocity.x;
    const vy = this.body.velocity.y;
    const tailX = this.x + Phaser.Math.Clamp(-vx * 0.03, -14, 14);
    const tailY = this.y + 4 + Phaser.Math.Clamp(-vy * 0.02, -8, 8);

    if (this.trailEmitterTickMs >= 12) {
      this.trailEmitterTickMs = 0;
      const count = speed > 340 ? 6 : speed > 240 ? 4 : 3;
      this.blueTrailEmitter.emitParticleAt(tailX, tailY, count);
    }
  }

  drawVitalBar() {
    if (!this.vitalBar?.active) return;
    const ratio = Phaser.Math.Clamp(this.health / this.maxHealth, 0, 1);
    const x = this.x - VITAL_BAR_WIDTH * 0.5;
    const y = this.y + VITAL_BAR_OFFSET_Y;
    const fillWidth = Math.max(0, (VITAL_BAR_WIDTH - 2) * ratio);
    const fillColor =
      ratio > 0.6 ? (this.phase === 1 ? 0x96e1ff : 0xffa070) : ratio > 0.28 ? 0xffd38a : 0xff7f7f;

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
    const chaseSpeed = this.phase === 2 ? CHASE_SPEED_RAGE : CHASE_SPEED;

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
      this.body.setVelocity(dir.x * chaseSpeed, dir.y * chaseSpeed);
      if (Math.abs(this.body.velocity.x) > 4) {
        this.patrolDir = this.body.velocity.x < 0 ? -1 : 1;
      }

      if (distance <= ATTACK_RANGE && this.attackCooldownLeft <= 0) {
        this.state = "windup";
        this.stateTimeLeft = WINDUP_MS;
        this.attackVector = dir.lengthSq() > 0.001 ? dir : new Phaser.Math.Vector2(1, 0);
        this.body.setVelocity(0, 0);
        this.setVisualTint(this.phase === 2 ? 0xffb08a : 0xd6efff);
        return;
      }

      if (this.shouldDive(distance)) {
        this.state = "dive_windup";
        this.stateTimeLeft = DIVE_WINDUP_MS;
        this.body.setVelocity(0, 0);
        this.attackVector = this.predictDiveVector(player);
        this.setVisualTint(this.phase === 2 ? 0xff9a72 : 0x9fd8ff);
        return;
      }

      if (distance <= AURA_TRIGGER_RANGE && this.auraCooldownLeft <= 0) {
        this.activateBlueAura();
      }

      if (distance > CHASE_RADIUS * 1.3) {
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
        const speed = this.phase === 2 ? LUNGE_SPEED * 1.12 : LUNGE_SPEED;
        this.body.setVelocity(this.attackVector.x * speed, this.attackVector.y * speed);
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
        const diveSpeed = this.phase === 2 ? DIVE_SPEED * 1.16 : DIVE_SPEED;
        this.body.setVelocity(this.attackVector.x * diveSpeed, this.attackVector.y * diveSpeed);
        this.attackCooldownLeft = ATTACK_COOLDOWN_MS;
        this.diveCooldownLeft = this.phase === 2 ? DIVE_COOLDOWN_MS * 0.72 : DIVE_COOLDOWN_MS;
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
        this.attackCooldownLeft = this.phase === 2 ? ATTACK_COOLDOWN_MS * 0.86 : ATTACK_COOLDOWN_MS;
      }
    }
  }

  runPatrolStep() {
    if (this.x >= this.rightBound) {
      this.patrolDir = -1;
    } else if (this.x <= this.leftBound) {
      this.patrolDir = 1;
    }
    this.body.setVelocity(this.patrolDir * PATROL_SPEED, (this.patrolY - this.y) * 2.4);
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

    const effectiveDamage = this.phase === 1 ? Math.max(1, Math.round(amount * (1 - PHASE1_DAMAGE_REDUCTION))) : amount;
    this.health -= effectiveDamage;
    if (this.isRoomEnemy && this.spawnRoomId && this.spawnEnemyId) {
      GameState.setRoomEnemyHealth(this.spawnRoomId, this.spawnEnemyId, this.health);
    }

    this.setVisualTint(this.phase === 1 ? 0xb8e6ff : 0xffab82);
    this.scene.time.delayedCall(90, () => {
      if (this.active) this.clearVisualTint();
    });

    if (hitDir && this.body) {
      this.body.velocity.x += hitDir.x * (this.phase === 1 ? 86 : 130);
      this.body.velocity.y += hitDir.y * (this.phase === 1 ? 86 : 130);
    }

    if (this.phase === 1 && this.health <= this.maxHealth * RAGE_THRESHOLD_PCT) {
      this.enterRagePhase();
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

  enterRagePhase() {
    this.phase = 2;
    this.contactDamage = 16;
    this.auraDamage = AURA_DAMAGE_RAGE;
    this.auraCooldownLeft = Math.min(this.auraCooldownLeft, 250);
    this.attackCooldownLeft = Math.min(this.attackCooldownLeft, 300);
    this.scene.cameras.main.shake(170, 0.0036);
    this.scene.tweens.add({
      targets: this.visual,
      scaleX: this.visual.scaleX * 1.08,
      scaleY: 1.08,
      duration: 200,
      yoyo: true,
      ease: "Sine.easeOut"
    });
    this.applyPhaseTint();
    EventBus.emit("world-hint", "Fallen Seraph enrages.");
  }

  setVisualTint(tint) {
    this.leftWing.setTint(tint);
    this.rightWing.setTint(tint);
    this.bodySprite.setTint(tint);
  }

  clearVisualTint() {
    this.applyPhaseTint();
  }

  applyPhaseTint() {
    if (this.phase === 1) {
      this.leftWing.setTint(0xd8efff);
      this.rightWing.setTint(0xd8efff);
      this.bodySprite.setTint(0xe7f6ff);
      return;
    }
    this.leftWing.setTint(0xff9168);
    this.rightWing.setTint(0xff9168);
    this.bodySprite.setTint(0xffb07e);
  }

  shouldDive(distance) {
    if (this.diveCooldownLeft > 0) return false;
    return distance >= DIVE_MIN_RANGE && distance <= DIVE_MAX_RANGE;
  }

  predictDiveVector(player) {
    const px = player.x + (player.body?.velocity.x ?? 0) * 0.24;
    const py = player.y + (player.body?.velocity.y ?? 0) * 0.24;
    const toPredicted = new Phaser.Math.Vector2(px - this.x, py - this.y);
    if (toPredicted.lengthSq() < 0.0001) {
      return new Phaser.Math.Vector2(this.patrolDir, 0);
    }
    return toPredicted.normalize();
  }

  drawAttackTelegraph(vector, pct) {
    if (!this.telegraphGraphics?.active) return;
    const dist = Phaser.Math.Linear(62, 290, pct);
    const toX = this.x + vector.x * dist;
    const toY = this.y + vector.y * dist;
    this.telegraphGraphics.clear();
    const color = this.phase === 2 ? 0xffb373 : 0xbce7ff;
    this.telegraphGraphics.lineStyle(2 + pct, color, 0.5 + pct * 0.4);
    this.telegraphGraphics.beginPath();
    this.telegraphGraphics.moveTo(this.x, this.y);
    this.telegraphGraphics.lineTo(toX, toY);
    this.telegraphGraphics.strokePath();
    this.telegraphGraphics.lineStyle(1.5, 0xfff3de, 0.45 + pct * 0.3);
    this.telegraphGraphics.strokeCircle(toX, toY, 8 + pct * 11);
  }

  activateBlueAura() {
    this.auraCooldownLeft = this.phase === 2 ? AURA_COOLDOWN_MS * 0.72 : AURA_COOLDOWN_MS;
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
      return flame;
    });
  }

  createAuraFlameTrails() {
    return this.auraFlames.map((flame) => {
      const trail = this.scene.add.particles(0, 0, "fx-ember", {
        follow: flame,
        lifespan: { min: 180, max: 320 },
        frequency: 26,
        quantity: 1,
        speedX: { min: -24, max: 24 },
        speedY: { min: -54, max: -18 },
        scale: { start: 1.05, end: 0 },
        alpha: { start: 0.42, end: 0 },
        blendMode: "ADD",
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
    const lowColor = this.phase === 2 ? 0xff7d4e : 0x61b6ff;
    const highColor = this.phase === 2 ? 0xffd39f : 0xcff1ff;

    for (let i = 0; i < this.auraFlames.length; i += 1) {
      const flame = this.auraFlames[i];
      const t = baseAngle + i * step;
      const x = centerX + Math.cos(t) * orbitRadius;
      const y = centerY + Math.sin(t) * orbitRadius * AURA_ORBIT_Y_SCALE;
      const pulse = 0.5 + Math.sin(this.auraOrbitTime * 0.012 + i * 0.9) * 0.5;
      flame.setPosition(x, y);
      flame.setScale(1 + pulse * 0.16, 1.06 - pulse * 0.12);
      flame.setAlpha(0.55 + pulse * 0.3);
      flame.setAngle(Phaser.Math.RadToDeg(t) + 90);
      flame.setTint(
        Phaser.Display.Color.Interpolate.ColorWithColor(
          Phaser.Display.Color.ValueToColor(lowColor),
          Phaser.Display.Color.ValueToColor(highColor),
          100,
          Math.round(pulse * 100)
        ).color
      );
    }
    if (this.auraRing?.active) {
      const ringPulse = 0.2 + Math.sin(this.auraOrbitTime * 0.012) * 0.08;
      this.auraRing.setPosition(centerX, centerY);
      this.auraRing.setAlpha(0.2 + ringPulse);
      this.auraRing.setScale(0.96 + ringPulse * 0.36);
      if (this.phase === 2) {
        this.auraRing.setFillStyle(0xff9f5f, 0.08);
        this.auraRing.setStrokeStyle(2, 0xffcca0, 0.52);
      } else {
        this.auraRing.setFillStyle(0x66bfff, 0.08);
        this.auraRing.setStrokeStyle(2, 0x9ad9ff, 0.5);
      }
    }
  }

  syncAuraDepth(enemyDepth) {
    this.auraFlames?.forEach((flame) => flame.setDepth(enemyDepth + 3));
    this.auraFlameTrails?.forEach((trail) => trail.setDepth(enemyDepth + 2));
    this.auraRing?.setDepth(enemyDepth + 1);
    this.shieldRing?.setDepth(enemyDepth + 4);
  }
}
