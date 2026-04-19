import Phaser from "phaser";
import { ROOMS, ROOM_DIMENSIONS } from "../data/rooms";
import { GameState } from "../core/GameState";
import { EventBus } from "../core/EventBus";
import { EnemyDemon } from "../entities/EnemyDemon";
import { EnemyAngel } from "../entities/EnemyAngel";

const BIG_PLATFORM_KEYS = ["platform-big-1", "platform-big-2"];
const MEDIUM_PLATFORM_KEYS = ["platform-medium-1", "platform-medium-2", "platform-medium-3"];
const CHEST_COIN_REWARD = 25;
const CHEST_SCALE = 0.21;
const CHEST_VISIBLE_BOTTOM_ORIGIN_Y = 370 / 409;
const SLICE_TRIGGER_ALPHA = 0.001;
const RELIC_TEXTURE_KEY = "relic-object";
const RELIC_FLOAT_PIXELS = 9;
const RELIC_FLOAT_MS = 1450;
const RELIC_TRIGGER_W = 64;
const RELIC_TRIGGER_H = 92;
const RELIC_PICKUP_LOCK_MS = 700;
const EXIT_TEXTURE_KEY = "exit-portal";
const EXIT_APPEAR_SFX_KEY = "sfx-exit-appear";
const EXIT_TRIGGER_W = 42;
const EXIT_TRIGGER_H = 52;
const EXIT_VISIBLE_BOTTOM_ORIGIN_Y = CHEST_VISIBLE_BOTTOM_ORIGIN_Y;
const EXIT_PLATFORM_Y_OFFSET = 20;
const EXIT_APPEAR_SFX_VOLUME = 0.9;
const EXIT_SPAWN_FLASH_MS = 170;
const EXIT_SPAWN_SHAKE_MS = 120;
const EXIT_SPAWN_SHAKE_INTENSITY = 0.0018;
const BG_LAYER_1_DEPTH = -1200;
const BG_LAYER_2_DEPTH = -1100;
const BG_CEILING_DEPTH = -1000;
const BG_LAYER_1_SCROLL_FACTOR = 1;
const BG_LAYER_2_SCROLL_FACTOR = 0.55;
const BG_CEILING_SCROLL_FACTOR = 0.62;
const BG_CEILING_SCALE_MULTIPLIER = 0.6;
const WORLD_DEPTH_BASE = 300;
const PLATFORM_DEPTH = 460;
const RELIC_DEPTH_OFFSET = 18;
const ENEMY_FACTORIES = {
  angel: EnemyAngel,
  demon: EnemyDemon
};

export class RoomManager {
  constructor(scene, player, abilitySystem) {
    this.scene = scene;
    this.player = player;
    this.abilitySystem = abilitySystem;
    this.platforms = this.scene.physics.add.staticGroup();
    this.platformVisuals = this.scene.add.group();
    this.gates = this.scene.physics.add.staticGroup();
    this.sliceTriggers = this.scene.physics.add.staticGroup();
    this.treasureChests = this.scene.physics.add.staticGroup();
    this.enemies = this.scene.physics.add.group({
      classType: EnemyDemon,
      runChildUpdate: false
    });
    this.backgroundLayer1 = null;
    this.backgroundLayer2 = null;
    this.ceilingLayer = null;
  }

  buildRoom(roomId, spawnKey) {
    const room = ROOMS[roomId];
    if (!room) {
      throw new Error(`Unknown room: ${roomId}`);
    }

    this.clearRoom();

    this.scene.cameras.main.setBackgroundColor(0x000000);
    this.scene.physics.world.setBounds(0, 0, ROOM_DIMENSIONS.width, ROOM_DIMENSIONS.height);
    this.scene.cameras.main.setBounds(0, 0, ROOM_DIMENSIONS.width, ROOM_DIMENSIONS.height);
    this.backgroundLayer1 = this.scene.add
      .image(ROOM_DIMENSIONS.width * 0.5, ROOM_DIMENSIONS.height * 0.5, "bg-layer-1")
      .setDisplaySize(ROOM_DIMENSIONS.width, ROOM_DIMENSIONS.height)
      .setDepth(BG_LAYER_1_DEPTH)
      .setScrollFactor(BG_LAYER_1_SCROLL_FACTOR);
    this.backgroundLayer2 = this.scene.add
      .image(ROOM_DIMENSIONS.width * 0.5, ROOM_DIMENSIONS.height * 0.5, "bg-layer-2")
      .setDisplaySize(ROOM_DIMENSIONS.width, ROOM_DIMENSIONS.height)
      .setDepth(BG_LAYER_2_DEPTH)
      .setScrollFactor(BG_LAYER_2_SCROLL_FACTOR);
    this.backgroundLayer2.setTint(room.bgColor ?? 0xffffff);
    this.ceilingLayer = this.scene.add
      .image(ROOM_DIMENSIONS.width * 0.5, 0, "bg-ceiling-v2")
      .setOrigin(0.5, 0)
      .setDepth(BG_CEILING_DEPTH)
      .setScrollFactor(BG_CEILING_SCROLL_FACTOR);
    this.ceilingLayer.setScale(
      (ROOM_DIMENSIONS.width / Math.max(1, this.ceilingLayer.width)) * BG_CEILING_SCALE_MULTIPLIER
    );

    for (const p of room.platforms) {
      const platformKeys = p.width >= 320 ? BIG_PLATFORM_KEYS : MEDIUM_PLATFORM_KEYS;
      const textureKey = Phaser.Utils.Array.GetRandom(platformKeys);
      const visual = this.scene.add.image(p.x, p.y, textureKey);
      visual.setDepth(PLATFORM_DEPTH);
      this.platformVisuals.add(visual);

      const block = this.platforms.create(p.x, p.y, "gate");
      block.displayWidth = p.width;
      block.displayHeight = p.height;
      block.setVisible(false);
      block.setAlpha(0.001);
      block.refreshBody();
    }

    const platformDefs = room.platforms ?? [];
    if (platformDefs.length > 0) {
      const chosen = Phaser.Utils.Array.GetRandom(platformDefs);
      const spreadX = Math.max(16, chosen.width * 0.28);
      const chestX = chosen.x + Phaser.Math.Between(Math.round(-spreadX), Math.round(spreadX));
      const platformTop = chosen.y - chosen.height * 0.5;
      const chest = this.treasureChests.create(chestX, platformTop + 20, "treasure-chest");
      chest.setOrigin(0.5, CHEST_VISIBLE_BOTTOM_ORIGIN_Y);
      chest.setDepth(650);
      chest.setScale(CHEST_SCALE);
      chest.refreshBody();
    }

    for (const gate of room.abilityGates) {
      const obj = this.gates.create(gate.x, gate.y, "gate");
      obj.displayWidth = gate.width;
      obj.displayHeight = gate.height;
      obj.requiredAbility = gate.requiredAbility;
      obj.directionHint = gate.directionHint;
      obj.refreshBody();
    }

    for (const triggerDef of room.sliceTriggers ?? []) {
      if (!this.shouldSpawnSliceTrigger(triggerDef.kind)) continue;
      const triggerTexture = triggerDef.kind === "relic" ? RELIC_TEXTURE_KEY : "gate";
      const trigger = this.sliceTriggers.create(triggerDef.x, triggerDef.y, triggerTexture);
      trigger.displayWidth = triggerDef.width;
      trigger.displayHeight = triggerDef.height;
      trigger.sliceTriggerId = triggerDef.id;
      trigger.sliceTriggerKind = triggerDef.kind;
      trigger.checkpointSpawn = triggerDef.checkpointSpawn;
      if (triggerDef.kind === "relic") {
        trigger.setDepth(760);
        trigger.setAlpha(1);
        trigger.setDisplaySize(RELIC_TRIGGER_W, RELIC_TRIGGER_H);
        this.scene.tweens.add({
          targets: trigger,
          y: trigger.y - RELIC_FLOAT_PIXELS,
          duration: RELIC_FLOAT_MS,
          ease: "Sine.easeInOut",
          yoyo: true,
          repeat: -1
        });
      } else {
        trigger.setAlpha(SLICE_TRIGGER_ALPHA);
      }
      trigger.refreshBody();
    }

    if (
      roomId === "start" &&
      GameState.slice.relicDropped &&
      !GameState.slice.hasRelic &&
      GameState.slice.relicDropRoomId === "start"
    ) {
      this.spawnRelicDrop(GameState.slice.relicDropX, GameState.slice.relicDropY);
    }

    if (
      GameState.slice.exitSpawned &&
      !GameState.slice.completed &&
      GameState.slice.exitRoomId === roomId
    ) {
      this.spawnExitPortalAt(GameState.slice.exitX, GameState.slice.exitY);
    }

    for (const enemyDef of room.enemies ?? []) {
      if (enemyDef.carriesRelic && (GameState.slice.relicDropped || GameState.slice.hasRelic)) {
        continue;
      }
      const EnemyType = ENEMY_FACTORIES[enemyDef.type] ?? EnemyDemon;
      const enemy = new EnemyType(this.scene, enemyDef.x, enemyDef.y, enemyDef.patrol);
      enemy.carriesRelic = Boolean(enemyDef.carriesRelic);
      this.enemies.add(enemy);
    }

    const spawn = room.spawns[spawnKey] ?? room.spawns.spawn_left;
    this.player.setPosition(spawn.x, spawn.y);
    this.player.setVelocity(0, 0);

    GameState.currentRoomId = roomId;
    GameState.playerSpawnKey = spawnKey;
    EventBus.emit("room-changed", roomId);
  }

  clearRoom() {
    this.backgroundLayer1?.destroy();
    this.backgroundLayer2?.destroy();
    this.ceilingLayer?.destroy();
    this.backgroundLayer1 = null;
    this.backgroundLayer2 = null;
    this.ceilingLayer = null;
    this.platformVisuals?.clear(true, true);
    this.platforms?.clear(true, true);
    this.gates?.clear(true, true);
    this.sliceTriggers?.clear(true, true);
    this.treasureChests?.clear(true, true);
    this.enemies?.clear(true, true);
  }

  depthForY(y, offset = 0) {
    return WORLD_DEPTH_BASE + y + offset;
  }

  updateDynamicDepths() {
    const playerDepth = this.player?.active ? this.depthForY(this.player.y) : WORLD_DEPTH_BASE;
    let frontEntityDepth = playerDepth;

    this.enemies?.children.iterate((enemy) => {
      if (!enemy?.active) return;
      const enemyDepth = this.depthForY(enemy.y);
      frontEntityDepth = Math.max(frontEntityDepth, enemyDepth);
    });

    this.sliceTriggers?.children.iterate((trigger) => {
      if (!trigger?.active) return;
      if (trigger.sliceTriggerKind === "relic") {
        trigger.setDepth(this.depthForY(trigger.y, RELIC_DEPTH_OFFSET));
        return;
      }
      if (trigger.sliceTriggerKind === "exit") {
        trigger.setDepth(frontEntityDepth - 6);
      }
    });

    this.treasureChests?.children.iterate((chest) => {
      if (!chest?.active) return;
      chest.setDepth(this.depthForY(chest.y));
    });

    if (this.player?.active) {
      this.player.setDepth(playerDepth - 1);
      this.player.visual?.setDepth(playerDepth);
    }

    this.enemies?.children.iterate((enemy) => {
      if (!enemy?.active) return;
      const enemyDepth = this.depthForY(enemy.y);
      enemy.setDepth(enemyDepth - 1);
      if (enemy.visual?.active) {
        enemy.visual.setDepth(enemyDepth);
      }
      if (enemy.vitalBar?.active) {
        enemy.vitalBar.setDepth(enemyDepth + 2);
      }
      if (enemy.blueTrailEmitter?.active) {
        enemy.blueTrailEmitter.setDepth(enemyDepth - 3);
      }
    });
  }

  shouldSpawnSliceTrigger(kind) {
    if (kind === "relic") return !GameState.slice.hasRelic;
    if (kind === "checkpoint") return !GameState.slice.checkpointActivated;
    if (kind === "ritual") return !GameState.slice.completed;
    if (kind === "exit") return GameState.slice.exitSpawned && !GameState.slice.completed;
    return true;
  }

  spawnRelicDrop(x, y) {
    if (GameState.slice.hasRelic) return null;

    const existingRelic = this.sliceTriggers
      .getChildren()
      .find((trigger) => trigger?.active && trigger.sliceTriggerKind === "relic");
    if (existingRelic) return existingRelic;

    const trigger = this.sliceTriggers.create(x, y, RELIC_TEXTURE_KEY);
    trigger.displayWidth = RELIC_TRIGGER_W;
    trigger.displayHeight = RELIC_TRIGGER_H;
    trigger.sliceTriggerId = "start-relic-drop";
    trigger.sliceTriggerKind = "relic";
    trigger.relicPickupReadyAt = this.scene.time.now + RELIC_PICKUP_LOCK_MS;
    trigger.setDepth(760);
    trigger.setAlpha(1);
    trigger.setDisplaySize(RELIC_TRIGGER_W, RELIC_TRIGGER_H);
    this.scene.tweens.add({
      targets: trigger,
      y: trigger.y - RELIC_FLOAT_PIXELS,
      duration: RELIC_FLOAT_MS,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1
    });
    trigger.refreshBody();
    GameState.slice.relicDropped = true;
    GameState.slice.relicAngelSlain = true;
    GameState.slice.relicDropRoomId = GameState.currentRoomId;
    GameState.slice.relicDropX = x;
    GameState.slice.relicDropY = y;
    return trigger;
  }

  spawnExitPortalAt(x, y) {
    if (GameState.slice.completed) return null;

    const existingExit = this.sliceTriggers
      .getChildren()
      .find((trigger) => trigger?.active && trigger.sliceTriggerKind === "exit");
    if (existingExit) return existingExit;

    const trigger = this.sliceTriggers.create(x, y, EXIT_TEXTURE_KEY);
    trigger.displayWidth = EXIT_TRIGGER_W;
    trigger.displayHeight = EXIT_TRIGGER_H;
    trigger.sliceTriggerId = "level-exit";
    trigger.sliceTriggerKind = "exit";
    trigger.setDepth(760);
    trigger.setAlpha(0.98);
    trigger.setOrigin(0.5, EXIT_VISIBLE_BOTTOM_ORIGIN_Y);
    trigger.setDisplaySize(EXIT_TRIGGER_W, EXIT_TRIGGER_H);
    trigger.refreshBody();
    return trigger;
  }

  spawnExitPortalRandom() {
    if (GameState.slice.exitSpawned || GameState.slice.completed) return null;

    const roomId = GameState.currentRoomId;
    const room = ROOMS[roomId];
    const chosen = Phaser.Utils.Array.GetRandom(room.platforms);
    const xJitter = Math.min(120, Math.max(24, Math.round(chosen.width * 0.28)));
    const x = Phaser.Math.Clamp(
      chosen.x + Phaser.Math.Between(-xJitter, xJitter),
      70,
      ROOM_DIMENSIONS.width - 70
    );
    const platformTop = chosen.y - chosen.height * 0.5;
    const y = Math.max(110, platformTop + EXIT_PLATFORM_Y_OFFSET);

    GameState.slice.exitSpawned = true;
    GameState.slice.exitRoomId = roomId;
    GameState.slice.exitX = x;
    GameState.slice.exitY = y;
    this.scene.sound.play(EXIT_APPEAR_SFX_KEY, { volume: EXIT_APPEAR_SFX_VOLUME });

    if (GameState.currentRoomId === roomId) {
      const exitTrigger = this.spawnExitPortalAt(x, y);
      this.scene.cameras.main.flash(EXIT_SPAWN_FLASH_MS, 255, 170, 110, false);
      this.scene.cameras.main.shake(EXIT_SPAWN_SHAKE_MS, EXIT_SPAWN_SHAKE_INTENSITY);
      if (exitTrigger) {
        exitTrigger.setScale(0.88);
        this.scene.tweens.add({
          targets: exitTrigger,
          scaleX: 1,
          scaleY: 1,
          duration: 240,
          ease: "Back.easeOut"
        });
      }
    }

    EventBus.emit("slice-exit-spawned", {
      roomId,
      x,
      y
    });
    return { roomId, x, y };
  }

  breakChest(chest) {
    if (!chest?.active) return false;
    chest.disableBody(true, true);
    GameState.coins += CHEST_COIN_REWARD;
    EventBus.emit("coins-updated", GameState.coins);
    EventBus.emit("chest-opened");
    EventBus.emit("world-hint", `Treasure burst! +${CHEST_COIN_REWARD} coins`);
    this.scene.cameras.main.shake(90, 0.0026);
    return true;
  }

  updateRoomTransitions() {
    const room = ROOMS[GameState.currentRoomId];
    const x = this.player.x;
    const pad = 16;

    if (x >= ROOM_DIMENSIONS.width - pad && room.exits.right) {
      this.tryTransition(room.exits.right);
    } else if (x <= pad && room.exits.left) {
      this.tryTransition(room.exits.left);
    }
  }

  tryTransition(exitDef) {
    if (this.isBlockedByGate(exitDef.toRoomId)) {
      return;
    }
    this.buildRoom(exitDef.toRoomId, exitDef.spawn);
  }

  isBlockedByGate(directionRoomId) {
    let blocked = false;
    this.gates?.children.iterate((gate) => {
      if (!gate || !gate.active) return;
      const overlaps = Phaser.Geom.Intersects.RectangleToRectangle(
        this.player.getBounds(),
        gate.getBounds()
      );
      if (overlaps && !this.abilitySystem.has(gate.requiredAbility)) {
        blocked = true;
      }
    });
    if (blocked) {
      EventBus.emit("gate-blocked", directionRoomId);
    }
    return blocked;
  }

  getRespawnTarget() {
    const checkpointRoomId = GameState.slice.checkpointRoomId;
    const checkpointSpawnKey = GameState.slice.checkpointSpawnKey;
    if (GameState.slice.checkpointActivated && checkpointRoomId && checkpointSpawnKey) {
      return {
        roomId: checkpointRoomId,
        spawnKey: checkpointSpawnKey
      };
    }
    return {
      roomId: "start",
      spawnKey: "spawn_center"
    };
  }

  activateSliceTrigger(trigger) {
    if (!trigger?.active) return null;
    const now = this.scene.time.now;

    if (trigger.sliceTriggerKind === "relic") {
      if (GameState.slice.hasRelic) return null;
      if (now < (trigger.relicPickupReadyAt ?? 0)) {
        return "relic-not-ready";
      }
      GameState.slice.hasRelic = true;
      trigger.disableBody(true, true);
      EventBus.emit("slice-relic-collected", {
        roomId: GameState.currentRoomId,
        triggerId: trigger.sliceTriggerId
      });
      EventBus.emit("world-hint", "Relic claimed.");
      return "relic";
    }

    if (trigger.sliceTriggerKind === "checkpoint") {
      if (GameState.slice.checkpointActivated) return null;
      GameState.slice.checkpointActivated = true;
      GameState.slice.checkpointRoomId = GameState.currentRoomId;
      if (trigger.checkpointSpawn) {
        GameState.playerSpawnKey = trigger.checkpointSpawn;
      }
      GameState.slice.checkpointSpawnKey = GameState.playerSpawnKey;
      trigger.disableBody(true, true);
      EventBus.emit("slice-checkpoint-activated", {
        roomId: GameState.currentRoomId,
        spawnKey: GameState.playerSpawnKey,
        triggerId: trigger.sliceTriggerId
      });
      EventBus.emit("world-hint", "Checkpoint bound. Death returns you here.");
      return "checkpoint";
    }

    if (trigger.sliceTriggerKind === "exit") {
      if (!GameState.slice.hasRelic) {
        if (now - (trigger.lastHintAt ?? -Infinity) > 1000) {
          trigger.lastHintAt = now;
          EventBus.emit("world-hint", "The exit rejects you. Claim the relic first.");
        }
        return "exit-blocked";
      }
      if (GameState.slice.completed) return null;
      GameState.slice.completed = true;
      trigger.body.enable = false;
      EventBus.emit("slice-finished", {
        roomId: GameState.currentRoomId,
        triggerId: trigger.sliceTriggerId
      });
      EventBus.emit("world-hint", "You escaped through the breach.");
      return "exit";
    }

    if (trigger.sliceTriggerKind === "ritual") {
      if (GameState.slice.completed) return null;
      if (!GameState.slice.hasRelic) {
        if (now - (trigger.lastHintAt ?? -Infinity) > 1000) {
          trigger.lastHintAt = now;
          EventBus.emit("world-hint", "The altar is empty. Find the relic first.");
        }
        return "ritual-blocked";
      }
      const aliveEnemies = this.enemies
        .getChildren()
        .some((enemy) => enemy?.active && !enemy?.isDead);
      if (aliveEnemies) {
        if (now - (trigger.lastHintAt ?? -Infinity) > 1000) {
          trigger.lastHintAt = now;
          EventBus.emit("world-hint", "The sanctum rejects you. Purge the guardians.");
        }
        return "ritual-blocked";
      }
      GameState.slice.completed = true;
      trigger.disableBody(true, true);
      EventBus.emit("slice-finished", {
        roomId: GameState.currentRoomId,
        triggerId: trigger.sliceTriggerId
      });
      EventBus.emit("world-hint", "Ritual complete. You survived the Whisper.");
      return "ritual";
    }

    return null;
  }
}
