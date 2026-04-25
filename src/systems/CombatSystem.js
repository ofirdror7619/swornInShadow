import Phaser from "phaser";
import { GameState } from "../core/GameState";
import { EventBus } from "../core/EventBus";

const FIRE_STORM_DURATION_MS = 1800;
const FIRE_STORM_COOLDOWN_MS = 3500;
const FIRE_STORM_STRIKE_INTERVAL_MS = 120;
const FIRE_STORM_STRIKES_PER_VOLLEY_MIN = 2;
const FIRE_STORM_STRIKES_PER_VOLLEY_MAX = 3;
const FIRE_STORM_SPAWN_OFFSET_X = 118;
const FIRE_STORM_TARGET_OFFSET_Y = 12;
const FIRE_STORM_TARGET_BASE_FOOT_OFFSET_Y = 40;
const FIRE_STORM_SPAWN_FROM_LEFT_MIN = 56;
const FIRE_STORM_SPAWN_FROM_LEFT_MAX = 128;
const FIRE_STORM_SPAWN_Y_MIN = 150;
const FIRE_STORM_SPAWN_Y_MAX = 245;
const FIRE_STORM_IMPACT_RADIUS = 42;
const FIRE_STORM_FALL_TIME_MS_MIN = 240;
const FIRE_STORM_FALL_TIME_MS_MAX = 340;
const FIRE_STORM_DAMAGE = 11;
const FIRE_STORM_DAMAGE_ANGEL = 18;
const FIRE_STORM_SMOKE_TRAIL_FREQUENCY = 18;
const FIRE_STORM_SMOKE_IMPACT_COUNT = 10;
const PLAYER_IFRAME_MS = 680;
const AURA_SFX_VOLUME = 0.72;
const AURA_SFX_FADE_OUT_MS = 220;
const EMPOWERED_FIRE_STORM_DURATION_MS = 9000;
const EMPOWERED_FIRE_STORM_DAMAGE_MULTIPLIER = 1.55;
const EMPOWERED_KILL_METER_MAX = 100;

export class CombatSystem {
  constructor(scene, player, roomManager) {
    this.scene = scene;
    this.player = player;
    this.roomManager = roomManager;
    this.playerIFrameLeft = 0;
    this.auraActiveLeft = 0;
    this.auraCooldownLeft = 0;
    this.strikeTickLeft = 0;
    this.auraDamageMultiplier = 1;
    this.permanentFireStormBonus = 1;
    this.empoweredMeter = 0;
    this.empoweredActiveLeft = 0;
    this.activeStormFx = new Set();
    this.auraSfx = scene.sound.add("sfx-fire-storm", { volume: AURA_SFX_VOLUME, loop: false });
    this.auraSfxFadeTween = null;

    this.keys = scene.input.keyboard.addKeys({
      fireStorm: "SPACE"
    });

    scene.physics.add.overlap(this.player, this.roomManager.enemies, (_player, enemy) => {
      this.handlePlayerHit(enemy);
    });

    this.emitAuraUpdated();
  }

  update(deltaMs) {
    const stormPressed = Phaser.Input.Keyboard.JustDown(this.keys.fireStorm);

    this.auraCooldownLeft = Math.max(0, this.auraCooldownLeft - deltaMs);
    this.playerIFrameLeft = Math.max(0, this.playerIFrameLeft - deltaMs);

    if (stormPressed && this.auraCooldownLeft <= 0 && this.auraActiveLeft <= 0) {
      this.activateFireStorm();
    }

    if (this.auraActiveLeft > 0) {
      this.auraActiveLeft -= deltaMs;
      this.strikeTickLeft -= deltaMs;
      while (this.strikeTickLeft <= 0 && this.auraActiveLeft > 0) {
        this.spawnFireStormVolley();
        this.strikeTickLeft += FIRE_STORM_STRIKE_INTERVAL_MS;
      }
      if (this.auraActiveLeft <= 0) {
        this.deactivateFireStorm();
      }
    }

    if (this.empoweredActiveLeft > 0) {
      this.empoweredActiveLeft = Math.max(0, this.empoweredActiveLeft - deltaMs);
      if (this.empoweredActiveLeft <= 0) {
        EventBus.emit("world-hint", "The inner flame recedes.");
      }
    }

    this.handleEnemyAuraPressure();
    this.emitAuraUpdated();

    if (this.playerIFrameLeft > 0) {
      const blink = Math.floor(this.playerIFrameLeft / 70) % 2 === 0;
      this.player.visual.setAlpha(blink ? 0.66 : 1);
    } else {
      this.player.visual.setAlpha(1);
    }
  }

  activateFireStorm() {
    this.auraCooldownLeft = FIRE_STORM_COOLDOWN_MS;
    this.auraActiveLeft = FIRE_STORM_DURATION_MS;
    this.strikeTickLeft = 0;
    this.setAuraEyesActive(true);
    this.auraSfxFadeTween?.stop();
    this.auraSfxFadeTween = null;
    if (this.auraSfx?.isPlaying) {
      this.auraSfx.stop();
    }
    this.auraSfx?.setVolume(AURA_SFX_VOLUME);
    this.auraSfx?.play();
    EventBus.emit("world-hint", this.empoweredActiveLeft > 0 ? "Empowered fire storm unleashed" : "Fire storm unleashed");
    this.emitAuraUpdated();
  }

  deactivateFireStorm() {
    this.setAuraEyesActive(false);
    this.fadeOutAuraSfx();
    this.emitAuraUpdated();
  }

  setAuraEyesActive(active) {
    if (!this.player?.eyes) return;
    this.player?.setAuraActive?.(active);
    if (active) {
      this.player.eyes.setTint(0xff2424);
      return;
    }
    this.player.eyes.clearTint();
  }

  spawnFireStormVolley() {
    const strikeCount = Phaser.Math.Between(
      FIRE_STORM_STRIKES_PER_VOLLEY_MIN,
      FIRE_STORM_STRIKES_PER_VOLLEY_MAX
    );

    const facing = this.player?.facing ?? 1;
    const spawnSideDir = facing >= 0 ? -1 : 1;
    for (let i = 0; i < strikeCount; i += 1) {
      const targetX = this.player.x + Phaser.Math.Between(-FIRE_STORM_SPAWN_OFFSET_X, FIRE_STORM_SPAWN_OFFSET_X);
      const targetY =
        this.player.y +
        FIRE_STORM_TARGET_BASE_FOOT_OFFSET_Y +
        Phaser.Math.Between(-FIRE_STORM_TARGET_OFFSET_Y, FIRE_STORM_TARGET_OFFSET_Y);
      this.spawnFireStrike(targetX, targetY, spawnSideDir);
    }
  }

  spawnFireStrike(targetX, targetY, spawnSideDir = -1) {
    const spawnX =
      targetX +
      spawnSideDir * Phaser.Math.Between(FIRE_STORM_SPAWN_FROM_LEFT_MIN, FIRE_STORM_SPAWN_FROM_LEFT_MAX);
    const spawnY =
      targetY - Phaser.Math.Between(FIRE_STORM_SPAWN_Y_MIN, FIRE_STORM_SPAWN_Y_MAX);
    const fallMs = Phaser.Math.Between(FIRE_STORM_FALL_TIME_MS_MIN, FIRE_STORM_FALL_TIME_MS_MAX);
    const fallDirectionDeg = Phaser.Math.RadToDeg(Phaser.Math.Angle.Between(spawnX, spawnY, targetX, targetY));
    // fx-flame points upward at angle 0, so offset by +90deg to aim tip along travel.
    const flameTravelAngleDeg = fallDirectionDeg + 90;

    const telegraph = this.scene.add.circle(
      targetX,
      targetY,
      FIRE_STORM_IMPACT_RADIUS * 0.78,
      0xff9d4d,
      0.24
    );
    telegraph.setDepth(1287);
    this.trackStormFx(telegraph);

    this.scene.tweens.add({
      targets: telegraph,
      alpha: { from: 0.26, to: 0.04 },
      scale: { from: 0.72, to: 1.08 },
      duration: fallMs,
      ease: "Sine.easeIn"
    });

    const flame = this.scene.add.image(spawnX, spawnY, "fx-flame");
    flame.setBlendMode("ADD");
    flame.setDepth(1290);
    flame.setOrigin(0.5, 0.8);
    flame.setFlipX(false);
    flame.setFlipY(true);
    flame.setScale(0.95, 1.35);
    flame.setAlpha(0.95);
    flame.setTint(0xff8d45);
    flame.setAngle(flameTravelAngleDeg);
    this.trackStormFx(flame);

    const smokeTrail = this.scene.add.particles(0, 0, "fx-smoke", {
      follow: flame,
      lifespan: { min: 190, max: 420 },
      frequency: FIRE_STORM_SMOKE_TRAIL_FREQUENCY,
      quantity: 1,
      speedX: { min: -10, max: 22 },
      speedY: { min: -18, max: 16 },
      scale: { start: 0.52, end: 1.18 },
      alpha: { start: 0.2, end: 0 },
      tint: [0x2a1a16, 0x3a231c, 0x4a2a1f],
      emitting: true
    });
    smokeTrail.setDepth(1288);
    this.trackStormFx(smokeTrail);

    this.scene.tweens.add({
      targets: flame,
      x: targetX,
      y: targetY,
      angle: {
        from: flameTravelAngleDeg - 3,
        to: flameTravelAngleDeg + 3
      },
      alpha: { from: 0.9, to: 1 },
      scaleX: { from: 0.82, to: 1.32 },
      scaleY: { from: 1.25, to: 0.9 },
      duration: fallMs,
      ease: "Quad.easeIn",
      onUpdate: () => {
        const hotPulse = 0.5 + Math.sin(this.scene.time.now * 0.03 + targetX * 0.01) * 0.5;
        const tint = Phaser.Display.Color.Interpolate.ColorWithColor(
          Phaser.Display.Color.ValueToColor(0xff6a2d),
          Phaser.Display.Color.ValueToColor(0xffcf87),
          100,
          Math.round(hotPulse * 100)
        ).color;
        flame.setTint(tint);
      },
      onComplete: () => {
        this.applyFireStormImpact(targetX, targetY);
        this.spawnFireImpactFx(targetX, targetY);
        this.untrackStormFx(flame);
        this.untrackStormFx(smokeTrail);
        this.untrackStormFx(telegraph);
        smokeTrail.stop();
        smokeTrail.destroy();
        flame.destroy();
        telegraph.destroy();
      }
    });
  }

  spawnFireImpactFx(x, y) {
    const smokeBurst = this.scene.add.particles(x, y - 4, "fx-smoke", {
      lifespan: { min: 300, max: 560 },
      quantity: FIRE_STORM_SMOKE_IMPACT_COUNT,
      speed: { min: 25, max: 90 },
      angle: { min: 220, max: 320 },
      scale: { start: 0.48, end: 1.45 },
      alpha: { start: 0.24, end: 0 },
      tint: [0x2a1a16, 0x3c261d, 0x4b3024]
    });
    smokeBurst.setDepth(1289);
    this.trackStormFx(smokeBurst);

    const burst = this.scene.add.particles(x, y - 2, "fx-ember", {
      lifespan: { min: 160, max: 300 },
      quantity: 13,
      speed: { min: 80, max: 210 },
      angle: { min: 235, max: 305 },
      scale: { start: 1.35, end: 0 },
      alpha: { start: 0.9, end: 0 },
      blendMode: "ADD",
      tint: [0xff5e2d, 0xff9344, 0xffd890, 0xfff0b0]
    });
    burst.setDepth(1291);
    this.trackStormFx(burst);
    this.scene.time.delayedCall(220, () => {
      this.untrackStormFx(burst);
      burst.destroy();
    });
    this.scene.time.delayedCall(360, () => {
      this.untrackStormFx(smokeBurst);
      smokeBurst.destroy();
    });
  }

  applyFireStormImpact(x, y) {
    let hitEnemy = false;

    this.roomManager.enemies?.children.iterate((enemy) => {
      if (!enemy?.active || enemy.isDead) return;
      const enemyFootY = enemy.body?.bottom ?? enemy.y + (enemy.displayHeight ?? 0) * 0.5;
      const distance = Phaser.Math.Distance.Between(x, y, enemy.x, enemyFootY);
      if (distance > FIRE_STORM_IMPACT_RADIUS) return;

      hitEnemy = true;
      const hitDir = new Phaser.Math.Vector2(enemy.x - x, enemy.y - (y - 36));
      if (hitDir.lengthSq() < 0.0001) {
        hitDir.set(0, 1);
      } else {
        hitDir.normalize();
      }

      const stormDamage = enemy.enemyType === "angel" ? FIRE_STORM_DAMAGE_ANGEL : FIRE_STORM_DAMAGE;
      const empoweredMultiplier = this.empoweredActiveLeft > 0 ? EMPOWERED_FIRE_STORM_DAMAGE_MULTIPLIER : 1;
      const dead = enemy.takeDamage(
        Math.round(stormDamage * this.auraDamageMultiplier * this.permanentFireStormBonus * empoweredMultiplier),
        hitDir
      );
      if (dead) {
        if (enemy.enemyType === "angel") {
          this.scene.sound.play("sfx-angel-dead", { volume: 0.9 });
        }
        EventBus.emit("enemy-killed", {
          roomId: GameState.currentRoomId,
          enemyType: enemy.enemyType,
          x: enemy.x,
          y: enemy.y,
          carriesRelic: Boolean(enemy.carriesRelic),
          isRoomEnemy: Boolean(enemy.isRoomEnemy),
          spawnRoomId: enemy.spawnRoomId ?? GameState.currentRoomId,
          spawnEnemyId: enemy.spawnEnemyId ?? null
        });
      }
    });

    if (hitEnemy) {
      this.scene.cameras.main.shake(70, 0.002);
    }

    this.roomManager.treasureChests?.children.iterate((chest) => {
      if (!chest?.active) return;
      const bounds = chest.getBounds?.();
      if (!bounds) return;

      const closestX = Phaser.Math.Clamp(x, bounds.left, bounds.right);
      const closestY = Phaser.Math.Clamp(y, bounds.top, bounds.bottom);
      const distance = Phaser.Math.Distance.Between(x, y, closestX, closestY);
      if (distance <= FIRE_STORM_IMPACT_RADIUS * 1.05) {
        this.roomManager.breakChest(chest);
      }
    });
  }

  handleEnemyAuraPressure() {
    this.roomManager.enemies?.children.iterate((enemy) => {
      if (!enemy?.active || enemy.isDead) return;
      if (!enemy.canAuraDamagePlayer?.(this.player)) return;
      this.handlePlayerHit(enemy, {
        ignoreDamageGate: true,
        damage: enemy.auraDamage ?? enemy.contactDamage ?? 12,
        source: "aura",
        hitVector: enemy.getAuraHitVector?.(this.player)
      });
    });
  }

  handlePlayerHit(enemy, options = {}) {
    if (!enemy?.active || enemy.isDead) return;
    if (!options.ignoreDamageGate && !enemy.canDamagePlayer()) return;
    if (this.playerIFrameLeft > 0) return;

    this.playerIFrameLeft = PLAYER_IFRAME_MS;
    const damage = options.damage ?? enemy.contactDamage ?? 12;
    GameState.health = Math.max(0, GameState.health - damage);
    EventBus.emit("health-updated", GameState.health);
    EventBus.emit("player-damaged", { amount: damage, health: GameState.health });
    if (options.source === "aura" && enemy.enemyType === "angel") {
      EventBus.emit("world-hint", `Angel aura burns! Vital -${damage}`);
    } else if (enemy.enemyType === "angel") {
      EventBus.emit("world-hint", `Angel strike! Vital -${damage}`);
    } else {
      EventBus.emit("world-hint", `You were hit (-${damage})`);
    }

    const away =
      options.hitVector?.clone?.() ??
      new Phaser.Math.Vector2(this.player.x - enemy.x, this.player.y - enemy.y);
    if (away.lengthSq() < 0.0001) {
      away.set(this.player.facing < 0 ? -1 : 1, 0);
    } else {
      away.normalize();
    }
    this.player.body.setVelocity(away.x * 230, away.y * 220);
    this.scene.cameras.main.shake(100, 0.0035);

    if (GameState.health <= 0) {
      const respawnTarget =
        this.roomManager.getRespawnTarget?.() ?? {
          roomId: GameState.currentRoomId,
          spawnKey: GameState.playerSpawnKey ?? "spawn_center"
        };
      EventBus.emit("player-died", respawnTarget);
      EventBus.emit("world-hint", "Death takes you. The hunt continues.");
      GameState.health = GameState.maxHealth;
      EventBus.emit("health-updated", GameState.health);
      this.roomManager.buildRoom(respawnTarget.roomId, respawnTarget.spawnKey);
      this.playerIFrameLeft = PLAYER_IFRAME_MS;
      this.deactivateFireStorm();
      this.auraActiveLeft = 0;
    }
  }

  emitAuraUpdated() {
    let state = "ready";
    let charge = 1;

    if (this.auraActiveLeft > 0) {
      state = "active";
      charge = Phaser.Math.Clamp(this.auraActiveLeft / FIRE_STORM_DURATION_MS, 0, 1);
    } else if (this.auraCooldownLeft > 0) {
      state = "cooldown";
      charge = Phaser.Math.Clamp(
        1 - this.auraCooldownLeft / FIRE_STORM_COOLDOWN_MS,
        0,
        1
      );
    }

    EventBus.emit("aura-updated", {
      state,
      charge,
      cooldownLeftMs: this.auraCooldownLeft,
      activeLeftMs: this.auraActiveLeft,
      empoweredCharge: Phaser.Math.Clamp(this.empoweredMeter / EMPOWERED_KILL_METER_MAX, 0, 1),
      empoweredActive: this.empoweredActiveLeft > 0,
      empoweredLeftMs: this.empoweredActiveLeft
    });
  }

  setAuraDamageMultiplier(multiplier = 1) {
    this.auraDamageMultiplier = Phaser.Math.Clamp(multiplier, 1, 3);
  }

  grantPermanentFireStormBonus(multiplierDelta = 0.15) {
    this.permanentFireStormBonus = Phaser.Math.Clamp(
      this.permanentFireStormBonus + multiplierDelta,
      1,
      2.2
    );
  }

  grantAuraCharge(chargeDelta = 0) {
    if (this.auraActiveLeft > 0) return;
    const deltaMs = Math.round(FIRE_STORM_COOLDOWN_MS * Phaser.Math.Clamp(chargeDelta, 0, 1));
    this.auraCooldownLeft = Math.max(0, this.auraCooldownLeft - deltaMs);
    this.emitAuraUpdated();
  }

  grantEmpoweredMeter(amount = 0) {
    if (this.empoweredActiveLeft > 0) return;
    const clamped = Phaser.Math.Clamp(amount, 0, EMPOWERED_KILL_METER_MAX);
    if (clamped <= 0) return;
    this.empoweredMeter = Phaser.Math.Clamp(this.empoweredMeter + clamped, 0, EMPOWERED_KILL_METER_MAX);
    if (this.empoweredMeter >= EMPOWERED_KILL_METER_MAX) {
      this.empoweredMeter = 0;
      this.empoweredActiveLeft = EMPOWERED_FIRE_STORM_DURATION_MS;
      this.scene.cameras.main.flash(180, 255, 180, 90, false);
      this.scene.cameras.main.shake(120, 0.0035);
      EventBus.emit("world-hint", "The inner flame awakens.");
    }
    this.emitAuraUpdated();
  }

  destroy() {
    this.setAuraEyesActive(false);
    this.auraSfxFadeTween?.stop();
    this.auraSfxFadeTween = null;
    if (this.auraSfx?.isPlaying) {
      this.auraSfx.stop();
    }
    this.auraSfx?.destroy();
    this.activeStormFx?.forEach((fx) => {
      fx?.destroy?.();
    });
    this.activeStormFx?.clear();
  }

  fadeOutAuraSfx() {
    if (!this.auraSfx?.isPlaying) return;
    this.auraSfxFadeTween?.stop();
    this.auraSfxFadeTween = this.scene.tweens.add({
      targets: this.auraSfx,
      volume: 0,
      duration: AURA_SFX_FADE_OUT_MS,
      ease: "Sine.easeOut",
      onComplete: () => {
        if (this.auraSfx?.isPlaying) {
          this.auraSfx.stop();
        }
        this.auraSfx?.setVolume(AURA_SFX_VOLUME);
        this.auraSfxFadeTween = null;
      }
    });
  }

  trackStormFx(displayObject) {
    if (!displayObject) return;
    this.activeStormFx.add(displayObject);
  }

  untrackStormFx(displayObject) {
    if (!displayObject) return;
    this.activeStormFx.delete(displayObject);
  }
}
