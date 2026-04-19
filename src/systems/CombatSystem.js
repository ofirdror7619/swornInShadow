import Phaser from "phaser";
import { GameState } from "../core/GameState";
import { EventBus } from "../core/EventBus";

const FLAME_AURA_DURATION_MS = 1800;
const FLAME_AURA_COOLDOWN_MS = 3500;
const FLAME_AURA_RADIUS = 64;
const FLAME_ORBIT_COUNT = 5;
const FLAME_ORBIT_RADIUS = FLAME_AURA_RADIUS - 8;
const FLAME_ORBIT_Y_SCALE = 0.72;
const FLAME_ORBIT_SPEED = 0.0042;
const PLAYER_IFRAME_MS = 680;
const AURA_HIT_DAMAGE = 10;
const AURA_HIT_DAMAGE_ANGEL = 1;
const AURA_HIT_INTERVAL_MS = 160;
const AURA_SFX_VOLUME = 0.72;
const AURA_SFX_FADE_OUT_MS = 220;

export class CombatSystem {
  constructor(scene, player, roomManager) {
    this.scene = scene;
    this.player = player;
    this.roomManager = roomManager;
    this.playerIFrameLeft = 0;
    this.auraActiveLeft = 0;
    this.auraCooldownLeft = 0;
    this.flameOrbitTime = 0;
    this.lastAuraHitAtByEnemyId = new Map();
    this.auraDamageMultiplier = 1;
    this.auraSfx = scene.sound.add("sfx-aura", { volume: AURA_SFX_VOLUME, loop: false });
    this.auraSfxFadeTween = null;

    this.keys = scene.input.keyboard.addKeys({
      flameSpace: "SPACE",
      flameEnter: "ENTER"
    });

    this.auraZone = scene.add.zone(player.x, player.y, FLAME_AURA_RADIUS * 2, FLAME_AURA_RADIUS * 2);
    scene.physics.add.existing(this.auraZone);
    this.auraZone.body.setAllowGravity(false);
    this.auraZone.body.enable = false;

    this.flameSprites = this.createFlameOrbitSprites();
    this.flameTrailEmitters = this.createFlameTrailEmitters();
    this.setFlameVisible(false);

    scene.physics.add.overlap(
      this.auraZone,
      this.roomManager.enemies,
      (_zone, enemy) => {
        this.handleAuraTouch(enemy);
      },
      undefined,
      this
    );
    scene.physics.add.overlap(
      this.auraZone,
      this.roomManager.treasureChests,
      (_zone, chest) => {
        this.handleAuraChestTouch(chest);
      },
      undefined,
      this
    );

    scene.physics.add.overlap(this.player, this.roomManager.enemies, (_player, enemy) => {
      this.handlePlayerHit(enemy);
    });

    this.emitAuraUpdated();
  }

  update(deltaMs) {
    const auraPressed =
      Phaser.Input.Keyboard.JustDown(this.keys.flameSpace) ||
      Phaser.Input.Keyboard.JustDown(this.keys.flameEnter);

    this.auraCooldownLeft = Math.max(0, this.auraCooldownLeft - deltaMs);
    this.playerIFrameLeft = Math.max(0, this.playerIFrameLeft - deltaMs);

    if (auraPressed && this.auraCooldownLeft <= 0 && this.auraActiveLeft <= 0) {
      this.activateFlameAura();
    }

    if (this.auraActiveLeft > 0) {
      this.auraActiveLeft -= deltaMs;
      this.flameOrbitTime += deltaMs;
      this.syncAuraToPlayer();
      if (this.auraActiveLeft <= 0) {
        this.deactivateFlameAura();
      }
    }

    this.emitAuraUpdated();

    if (this.playerIFrameLeft > 0) {
      const blink = Math.floor(this.playerIFrameLeft / 70) % 2 === 0;
      this.player.visual.setAlpha(blink ? 0.66 : 1);
    } else {
      this.player.visual.setAlpha(1);
    }
  }

  activateFlameAura() {
    this.auraCooldownLeft = FLAME_AURA_COOLDOWN_MS;
    this.auraActiveLeft = FLAME_AURA_DURATION_MS;
    this.auraZone.body.enable = true;
    this.flameOrbitTime = 0;
    this.setFlameVisible(true);
    this.setAuraEyesActive(true);
    this.syncAuraToPlayer();
    this.auraSfxFadeTween?.stop();
    this.auraSfxFadeTween = null;
    if (this.auraSfx?.isPlaying) {
      this.auraSfx.stop();
    }
    this.auraSfx?.setVolume(AURA_SFX_VOLUME);
    this.auraSfx?.play();
    EventBus.emit("world-hint", "Flame aura unleashed");
    this.emitAuraUpdated();
  }

  deactivateFlameAura() {
    this.auraZone.body.enable = false;
    this.setFlameVisible(false);
    this.setAuraEyesActive(false);
    this.fadeOutAuraSfx();
    this.emitAuraUpdated();
  }

  setAuraEyesActive(active) {
    if (!this.player?.eyes) return;
    if (active) {
      this.player.eyes.setTint(0xff2424);
      return;
    }
    this.player.eyes.clearTint();
  }

  syncAuraToPlayer() {
    this.auraZone.setPosition(this.player.x, this.player.y - 10);
    const centerX = this.player.x;
    const centerY = this.player.y - 10;
    const time = this.flameOrbitTime;
    const baseAngle = time * FLAME_ORBIT_SPEED;
    const angularStep = (Math.PI * 2) / FLAME_ORBIT_COUNT;

    for (let i = 0; i < this.flameSprites.length; i += 1) {
      const flame = this.flameSprites[i];
      const t = baseAngle + angularStep * i;
      const x = centerX + Math.cos(t) * FLAME_ORBIT_RADIUS;
      const y = centerY + Math.sin(t) * FLAME_ORBIT_RADIUS * FLAME_ORBIT_Y_SCALE;
      const flicker = 0.8 + Math.sin(time * 0.02 + i * 1.7) * 0.2;
      const stretch = 1 + Math.sin(time * 0.014 + i * 0.9) * 0.22;
      const hotPulse = 0.5 + Math.sin(time * 0.01 + i * 1.3) * 0.5;

      flame.setPosition(x, y);
      flame.setScale(1.1 * (2 - stretch), 1.1 * stretch);
      flame.setAngle(Phaser.Math.RadToDeg(t) + 90);
      flame.setAlpha(Phaser.Math.Clamp(flicker, 0.55, 1));
      flame.setTint(
        Phaser.Display.Color.Interpolate.ColorWithColor(
          Phaser.Display.Color.ValueToColor(0xff7a2a),
          Phaser.Display.Color.ValueToColor(0xffd898),
          100,
          Math.round(hotPulse * 100)
        ).color
      );
    }
  }

  handleAuraTouch(enemy) {
    if (!enemy?.active || enemy.isDead || this.auraActiveLeft <= 0) return;
    const enemyId = enemy.name || String(enemy.body?.id ?? enemy.x + enemy.y);
    const now = this.scene.time.now;
    const lastHitAt = this.lastAuraHitAtByEnemyId.get(enemyId) ?? -Infinity;
    if (now - lastHitAt < AURA_HIT_INTERVAL_MS) return;
    this.lastAuraHitAtByEnemyId.set(enemyId, now);

    const hitDir = new Phaser.Math.Vector2(enemy.x - this.player.x, enemy.y - this.player.y);
    if (hitDir.lengthSq() < 0.0001) {
      hitDir.set(1, 0);
    } else {
      hitDir.normalize();
    }
    const auraDamage = enemy.enemyType === "angel" ? AURA_HIT_DAMAGE_ANGEL : AURA_HIT_DAMAGE;
    const dead = enemy.takeDamage(Math.round(auraDamage * this.auraDamageMultiplier), hitDir);
    if (dead) {
      if (enemy.enemyType === "angel") {
        this.scene.sound.play("sfx-angel-dead", { volume: 0.9 });
      }
      this.scene.cameras.main.shake(80, 0.0022);
      EventBus.emit("enemy-killed", {
        roomId: GameState.currentRoomId,
        enemyType: enemy.enemyType,
        x: enemy.x,
        y: enemy.y,
        carriesRelic: Boolean(enemy.carriesRelic)
      });
    }
  }

  handleAuraChestTouch(chest) {
    if (this.auraActiveLeft <= 0 || !chest?.active) return;
    this.roomManager.breakChest(chest);
  }

  handlePlayerHit(enemy) {
    if (!enemy?.active || enemy.isDead || !enemy.canDamagePlayer()) return;
    if (this.playerIFrameLeft > 0 || this.auraActiveLeft > 0) return;

    this.playerIFrameLeft = PLAYER_IFRAME_MS;
    const damage = enemy.contactDamage ?? 12;
    GameState.health = Math.max(0, GameState.health - damage);
    EventBus.emit("health-updated", GameState.health);
    EventBus.emit("player-damaged", { amount: damage, health: GameState.health });
    if (enemy.enemyType === "angel") {
      EventBus.emit("world-hint", `Angel strike! Vital -${damage}`);
    } else {
      EventBus.emit("world-hint", `You were hit (-${damage})`);
    }

    const away = new Phaser.Math.Vector2(this.player.x - enemy.x, this.player.y - enemy.y);
    if (away.lengthSq() < 0.0001) {
      away.set(this.player.facing < 0 ? -1 : 1, 0);
    } else {
      away.normalize();
    }
    this.player.body.setVelocity(away.x * 230, away.y * 220);
    this.scene.cameras.main.shake(100, 0.0035);

    if (GameState.health <= 0) {
      const respawnTarget = this.roomManager.getRespawnTarget();
      EventBus.emit("player-died", { roomId: GameState.currentRoomId });
      EventBus.emit(
        "world-hint",
        GameState.slice.checkpointActivated
          ? "You were defeated. Returning to checkpoint..."
          : "You were defeated. Returning to Start..."
      );
      GameState.health = GameState.maxHealth;
      EventBus.emit("health-updated", GameState.health);
      this.roomManager.buildRoom(respawnTarget.roomId, respawnTarget.spawnKey);
      this.playerIFrameLeft = PLAYER_IFRAME_MS;
      this.deactivateFlameAura();
    }
  }

  createFlameOrbitSprites() {
    return Array.from({ length: FLAME_ORBIT_COUNT }, () => {
      const sprite = this.scene.add.image(this.player.x, this.player.y, "fx-flame");
      sprite.setBlendMode("ADD");
      sprite.setDepth(1300);
      sprite.setOrigin(0.5, 0.78);
      return sprite;
    });
  }

  createFlameTrailEmitters() {
    return this.flameSprites.map((sprite) => {
      const emitter = this.scene.add.particles(0, 0, "fx-ember", {
        follow: sprite,
        lifespan: { min: 180, max: 360 },
        frequency: 30,
        quantity: 1,
        speedX: { min: -20, max: 20 },
        speedY: { min: -66, max: -22 },
        scale: { start: 1.2, end: 0 },
        alpha: { start: 0.45, end: 0 },
        blendMode: "ADD",
        tint: [0xff6b2d, 0xff9b44, 0xffc06d],
        emitting: false
      });
      emitter.setDepth(1299);
      return emitter;
    });
  }

  setFlameVisible(visible) {
    this.flameSprites.forEach((sprite) => {
      sprite.setVisible(visible);
      if (!visible) {
        sprite.setAlpha(0);
      }
    });
    this.flameTrailEmitters.forEach((emitter) => {
      if (visible) emitter.start();
      else emitter.stop();
    });
  }

  emitAuraUpdated() {
    let state = "ready";
    let charge = 1;

    if (this.auraActiveLeft > 0) {
      state = "active";
      charge = Phaser.Math.Clamp(this.auraActiveLeft / FLAME_AURA_DURATION_MS, 0, 1);
    } else if (this.auraCooldownLeft > 0) {
      state = "cooldown";
      charge = Phaser.Math.Clamp(
        1 - this.auraCooldownLeft / FLAME_AURA_COOLDOWN_MS,
        0,
        1
      );
    }

    EventBus.emit("aura-updated", {
      state,
      charge,
      cooldownLeftMs: this.auraCooldownLeft,
      activeLeftMs: this.auraActiveLeft
    });
  }

  setAuraDamageMultiplier(multiplier = 1) {
    this.auraDamageMultiplier = Phaser.Math.Clamp(multiplier, 1, 3);
  }

  destroy() {
    this.setAuraEyesActive(false);
    this.lastAuraHitAtByEnemyId.clear();
    this.auraSfxFadeTween?.stop();
    this.auraSfxFadeTween = null;
    if (this.auraSfx?.isPlaying) {
      this.auraSfx.stop();
    }
    this.auraSfx?.destroy();
    this.auraZone?.destroy();
    this.flameSprites?.forEach((sprite) => {
      sprite.destroy();
    });
    this.flameTrailEmitters?.forEach((emitter) => {
      emitter.stop();
      emitter.destroy();
    });
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
}
