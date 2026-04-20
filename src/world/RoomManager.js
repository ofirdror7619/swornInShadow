import Phaser from "phaser";
import { ROOMS, ROOM_DIMENSIONS } from "../data/rooms";
import { GameState } from "../core/GameState";
import { EventBus } from "../core/EventBus";
import { EnemyAngel } from "../entities/EnemyAngel";

const BIG_PLATFORM_KEYS = ["platform-big-1", "platform-big-2"];
const MEDIUM_PLATFORM_KEYS = ["platform-medium-1", "platform-medium-2", "platform-medium-3"];
const FLOOR_ELEMENT_KEYS = [
  "floor-element-1",
  "floor-element-2",
  "floor-element-3",
  "floor-element-4",
  "floor-element-5",
  "floor-element-6",
  "floor-element-7",
  "floor-element-8"
];
const LEVEL2_FLOOR_HEIGHT = 80;
const LEVEL2_FLOOR_Y = ROOM_DIMENSIONS.height - LEVEL2_FLOOR_HEIGHT * 0.5;
const LEVEL2_FLOOR_ELEMENT_MIN = 5;
const LEVEL2_FLOOR_ELEMENT_MAX = 13;
const LEVEL2_FLOOR_ELEMENT_MARGIN_X = 56;
const LEVEL2_FLOOR_ELEMENT_MIN_SCALE = 0.78;
const LEVEL2_FLOOR_ELEMENT_MAX_SCALE = 1.28;
const CHEST_COIN_REWARD = 25;
const CHEST_SCALE = 0.21;
const CHEST_VISIBLE_BOTTOM_ORIGIN_Y = 370 / 409;
const CHEST_MIN_PLATFORM_MARGIN = 42;
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
const ROOM_TRANSITION_FADE_OUT_MS = 180;
const ROOM_TRANSITION_FADE_IN_MS = 220;
const BG_LAYER_1_DEPTH = -1200;
const BG_LAYER_2_DEPTH = -1100;
const BG_CEILING_DEPTH = -1000;
const BG_LAYER_1_SCROLL_FACTOR = 1;
const BG_LAYER_2_SCROLL_FACTOR = 0.55;
const BG_CEILING_SCROLL_FACTOR = 0.62;
const BG_CEILING_SCALE_MULTIPLIER = 0.6;
const WORLD_DEPTH_BASE = 300;
const PLATFORM_DEPTH = 460;
const ROOM_GATE_DEPTH = 620;
const ROOM_GATE_MARGIN_X = 28;
const ROOM_GATE_MARGIN_Y = 12;
const ROOM_GATE_WIDTH = 112;
const ROOM_GATE_HEIGHT = 224;
const ROOM_EXIT_TRIGGER_DEPTH_RATIO = 0.42;
const RELIC_DEPTH_OFFSET = 18;
const ENEMY_FACTORIES = {
  angel: EnemyAngel
};
const AMBUSH_BASE_COUNT = 1;
const AMBUSH_MAX_COUNT = 4;
const AMBUSH_MIN_SPAWN_DISTANCE = 180;
const AMBUSH_MAX_ATTEMPTS = 9;
const AMBUSH_PROFILE_BY_ROOM = {
  start: {
    angelChance: 1,
    shadowstepChance: 0
  },
  shaft: {
    angelChance: 1,
    shadowstepChance: 0
  },
  crypt: {
    angelChance: 1,
    shadowstepChance: 0
  },
  sanctum: {
    angelChance: 1,
    shadowstepChance: 0
  }
};
const CORRUPTION_TINT_TARGET = 0x7a1f24;
const CORRUPTION_THRESHOLD_T1 = 25;
const CORRUPTION_THRESHOLD_T2 = 50;
const CORRUPTION_THRESHOLD_T3 = 75;
const CORRUPTION_MUTATIONS = {
  start: [
    { tier: 1, x: 520, y: 760, width: 160, height: 26 },
    { tier: 2, x: 930, y: 690, width: 170, height: 26 },
    { tier: 3, x: 1260, y: 640, width: 180, height: 26 }
  ],
  shaft: [
    { tier: 1, x: 730, y: 720, width: 170, height: 26 },
    { tier: 2, x: 1040, y: 610, width: 170, height: 26 },
    { tier: 3, x: 1330, y: 560, width: 160, height: 26 }
  ],
  crypt: [
    { tier: 1, x: 420, y: 650, width: 170, height: 26 },
    { tier: 2, x: 840, y: 560, width: 180, height: 26 },
    { tier: 3, x: 1330, y: 520, width: 170, height: 26 }
  ]
};

export class RoomManager {
  constructor(scene, player, abilitySystem) {
    this.scene = scene;
    this.player = player;
    this.abilitySystem = abilitySystem;
    this.platforms = this.scene.physics.add.staticGroup();
    this.platformVisuals = this.scene.add.group();
    this.gateVisuals = this.scene.add.group();
    this.gates = this.scene.physics.add.staticGroup();
    this.corruptionBlocks = this.scene.physics.add.staticGroup();
    this.corruptionVisuals = this.scene.add.group();
    this.sliceTriggers = this.scene.physics.add.staticGroup();
    this.treasureChests = this.scene.physics.add.staticGroup();
    this.enemies = this.scene.physics.add.group({
      classType: EnemyAngel,
      runChildUpdate: false
    });
    this.backgroundLayer1 = null;
    this.backgroundLayer2 = null;
    this.ceilingLayer = null;
    this.isTransitioning = false;
    this.corruption = 0;
    this.corruptionTier = 0;
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

    const isLevel2 = (GameState.currentLevel ?? 1) >= 2;
    if (isLevel2) {
      this.buildLevel2FloorSet();
    } else {
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
    }

    const platformBodies = this.platforms?.getChildren?.() ?? [];
    if (platformBodies.length > 0) {
      const chosenPlatform = Phaser.Utils.Array.GetRandom(platformBodies);
      const bounds = chosenPlatform?.body;
      if (bounds) {
        const minX = Math.round(bounds.left + CHEST_MIN_PLATFORM_MARGIN);
        const maxX = Math.round(bounds.right - CHEST_MIN_PLATFORM_MARGIN);
        const chestX = maxX > minX ? Phaser.Math.Between(minX, maxX) : Math.round((bounds.left + bounds.right) * 0.5);
        const platformTop = bounds.top;
        const chest = this.treasureChests.create(chestX, platformTop, "treasure-chest");
        chest.setOrigin(0.5, CHEST_VISIBLE_BOTTOM_ORIGIN_Y);
        chest.setDepth(650);
        chest.setScale(CHEST_SCALE);
        const bottomOffset = chest.displayHeight * (1 - CHEST_VISIBLE_BOTTOM_ORIGIN_Y);
        chest.setY(platformTop - bottomOffset);
        chest.refreshBody();
      }
    }

    for (const gate of room.abilityGates) {
      if (this.abilitySystem.has(gate.requiredAbility)) continue;
      const obj = this.gates.create(gate.x, gate.y, "gate");
      obj.displayWidth = gate.width;
      obj.displayHeight = gate.height;
      obj.requiredAbility = gate.requiredAbility;
      obj.directionHint = gate.directionHint;
      obj.gateStyle = gate.style ?? "solid";
      if (obj.gateStyle === "flame-wall") {
        obj.setVisible(false);
        obj.setAlpha(0.001);
        const flameWall = this.scene.add
          .rectangle(gate.x, gate.y, gate.width, gate.height, 0xff6528, 0.22)
          .setDepth(642);
        flameWall.setStrokeStyle(2, 0xffb16d, 0.55);
        this.gateVisuals.add(flameWall);
        const flameEmitter = this.scene.add.particles(gate.x, gate.y - gate.height * 0.5, "fx-ember", {
          lifespan: { min: 260, max: 500 },
          frequency: 22,
          quantity: 2,
          speedX: { min: -36, max: 36 },
          speedY: { min: -130, max: -40 },
          scale: { start: 1.5, end: 0 },
          alpha: { start: 0.85, end: 0 },
          blendMode: "ADD",
          tint: [0xff5d2a, 0xff7f38, 0xffc576],
          emitZone: {
            source: new Phaser.Geom.Rectangle(
              -Math.max(8, gate.width * 0.45),
              0,
              Math.max(12, gate.width * 0.9),
              Math.max(24, gate.height)
            ),
            type: "random"
          }
        });
        flameEmitter.setDepth(643);
        this.gateVisuals.add(flameEmitter);
      }
      obj.refreshBody();
    }
    this.spawnRoomExitGates(room);

    this.applyCorruptionAtmosphere(room);
    this.rebuildCorruptionMutations(roomId);

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

    for (const [enemyIndex, enemyDef] of (room.enemies ?? []).entries()) {
      if (enemyDef.carriesRelic && (GameState.slice.relicDropped || GameState.slice.hasRelic)) {
        continue;
      }
      const enemyId = enemyDef.id ?? `${roomId}-enemy-${enemyIndex + 1}`;
      if (GameState.isRoomEnemyDefeated(roomId, enemyId)) {
        continue;
      }
      this.spawnEnemy(enemyDef, room, {
        isRoomEnemy: true,
        roomId,
        enemyId
      });
    }

    const spawn = room.spawns[spawnKey] ?? room.spawns.spawn_left;
    this.player.setPosition(spawn.x, spawn.y);
    this.player.setVelocity(0, 0);

    GameState.currentRoomId = roomId;
    GameState.playerSpawnKey = spawnKey;
    EventBus.emit("room-changed", roomId);
  }

  getCurrentRoomEnemyCount() {
    let alive = 0;
    this.enemies?.children.iterate((enemy) => {
      if (!enemy?.active || enemy?.isDead) return;
      alive += 1;
    });
    return alive;
  }

  spawnEnemy(enemyDef, room = ROOMS[GameState.currentRoomId], options = {}) {
    const EnemyType = ENEMY_FACTORIES[enemyDef.type] ?? EnemyAngel;
    const enemy = new EnemyType(this.scene, enemyDef.x, enemyDef.y, enemyDef.patrol, enemyDef);
    enemy.carriesRelic = Boolean(enemyDef.carriesRelic);
    enemy.isRoomEnemy = Boolean(options.isRoomEnemy);
    enemy.spawnRoomId = options.roomId ?? room?.id ?? GameState.currentRoomId;
    enemy.spawnEnemyId = options.enemyId ?? null;
    this.enemies.add(enemy);
    return enemy;
  }

  spawnAmbushPack(threatTier = 1, source = "surge") {
    const room = ROOMS[GameState.currentRoomId];
    if (!room) return 0;
    if (room.allowRespawn !== true) return 0;
    const platformDefs = (GameState.currentLevel ?? 1) >= 2 ? [this.getLevel2FloorDef()] : room.platforms ?? [];
    if (platformDefs.length === 0) return 0;
    const ambushProfile = this.getAmbushProfile(GameState.currentRoomId, threatTier);

    const base = AMBUSH_BASE_COUNT + Math.floor((threatTier - 1) / 2);
    const spawnCount = Phaser.Math.Clamp(base, AMBUSH_BASE_COUNT, AMBUSH_MAX_COUNT);
    let spawned = 0;

    for (let i = 0; i < spawnCount; i += 1) {
      const point = this.findAmbushSpawnPoint(platformDefs);
      if (!point) continue;
      const patrolHalfWidth = Phaser.Math.Between(100, 180);
      const enemyDef = {
        type: "angel",
        behavior: undefined,
        x: point.x,
        y: point.y,
        patrol: {
          left: Phaser.Math.Clamp(point.x - patrolHalfWidth, 40, ROOM_DIMENSIONS.width - 120),
          right: Phaser.Math.Clamp(point.x + patrolHalfWidth, 120, ROOM_DIMENSIONS.width - 40),
          y: point.y
        }
      };
      this.spawnEnemy(enemyDef, room);
      spawned += 1;
    }

    if (spawned > 0) {
      EventBus.emit("ambush-spawned", {
        count: spawned,
        threatTier,
        source,
        roomId: GameState.currentRoomId
      });
    }
    return spawned;
  }

  getAmbushProfile(roomId, threatTier) {
    const base = AMBUSH_PROFILE_BY_ROOM[roomId] ?? {
      angelChance: 0.35,
      shadowstepChance: 0.45
    };
    const levelBonus = ((GameState.currentLevel ?? 1) - 1) * 0.06;
    const tierBonus = Math.max(0, threatTier - 1) * 0.04;
    return {
      angelChance: Phaser.Math.Clamp(base.angelChance + tierBonus + levelBonus, 0.08, 0.82),
      shadowstepChance: Phaser.Math.Clamp(base.shadowstepChance + tierBonus * 0.7 + levelBonus, 0.12, 0.9)
    };
  }

  clearRoom() {
    this.backgroundLayer1?.destroy();
    this.backgroundLayer2?.destroy();
    this.ceilingLayer?.destroy();
    this.backgroundLayer1 = null;
    this.backgroundLayer2 = null;
    this.ceilingLayer = null;
    this.platformVisuals?.clear(true, true);
    this.gateVisuals?.clear(true, true);
    this.corruptionBlocks?.clear(true, true);
    this.corruptionVisuals?.clear(true, true);
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
    const platformDefs = (GameState.currentLevel ?? 1) >= 2 ? [this.getLevel2FloorDef()] : room.platforms;
    const chosen = Phaser.Utils.Array.GetRandom(platformDefs);
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

  findAmbushSpawnPoint(platformDefs) {
    for (let i = 0; i < AMBUSH_MAX_ATTEMPTS; i += 1) {
      const platform = Phaser.Utils.Array.GetRandom(platformDefs);
      if (!platform) continue;
      const xRange = Math.max(30, platform.width * 0.42);
      const x = Phaser.Math.Clamp(
        platform.x + Phaser.Math.Between(Math.round(-xRange), Math.round(xRange)),
        48,
        ROOM_DIMENSIONS.width - 48
      );
      const y = platform.y - platform.height * 0.5 - 52;
      const distance = Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y);
      if (distance < AMBUSH_MIN_SPAWN_DISTANCE) continue;
      return { x, y };
    }
    return null;
  }

  getCorruptionTier(corruption = this.corruption) {
    if (corruption >= CORRUPTION_THRESHOLD_T3) return 3;
    if (corruption >= CORRUPTION_THRESHOLD_T2) return 2;
    if (corruption >= CORRUPTION_THRESHOLD_T1) return 1;
    return 0;
  }

  setCorruptionState(corruption = 0) {
    this.corruption = Phaser.Math.Clamp(corruption, 0, 100);
    this.corruptionTier = this.getCorruptionTier(this.corruption);
    const currentRoom = ROOMS[GameState.currentRoomId];
    if (!currentRoom) return;
    this.applyCorruptionAtmosphere(currentRoom);
    this.rebuildCorruptionMutations(GameState.currentRoomId);
  }

  applyCorruptionAtmosphere(room) {
    const pct = Phaser.Math.Clamp(this.corruption / 100, 0, 1);
    const blendedTint = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.ValueToColor(room.bgColor ?? 0xffffff),
      Phaser.Display.Color.ValueToColor(CORRUPTION_TINT_TARGET),
      100,
      Math.round(pct * 100)
    ).color;
    this.backgroundLayer2?.setTint(blendedTint);
    if (this.ceilingLayer) {
      this.ceilingLayer.setAlpha(Phaser.Math.Linear(1, 0.68, pct));
      this.ceilingLayer.setTint(
        Phaser.Display.Color.Interpolate.ColorWithColor(
          Phaser.Display.Color.ValueToColor(0xffffff),
          Phaser.Display.Color.ValueToColor(0xc45950),
          100,
          Math.round(pct * 100)
        ).color
      );
    }
  }

  rebuildCorruptionMutations(roomId) {
    this.corruptionBlocks?.clear(true, true);
    this.corruptionVisuals?.clear(true, true);
    if (this.corruptionTier <= 0) return;
    const defs = CORRUPTION_MUTATIONS[roomId] ?? [];
    for (const mutation of defs) {
      if (mutation.tier > this.corruptionTier) continue;
      const block = this.corruptionBlocks.create(mutation.x, mutation.y, "gate");
      block.displayWidth = mutation.width;
      block.displayHeight = mutation.height;
      block.setVisible(false);
      block.setAlpha(0.001);
      block.refreshBody();
    }
  }

  updateRoomTransitions() {
    if (this.isTransitioning) return;
    const room = ROOMS[GameState.currentRoomId];
    const playerBody = this.player?.body;
    const playerRight = playerBody?.right ?? this.player.x;
    const playerLeft = playerBody?.left ?? this.player.x;
    const rightGateTriggerX =
      ROOM_DIMENSIONS.width - ROOM_GATE_MARGIN_X - ROOM_GATE_WIDTH * ROOM_EXIT_TRIGGER_DEPTH_RATIO;
    const leftGateTriggerX = ROOM_GATE_MARGIN_X + ROOM_GATE_WIDTH * ROOM_EXIT_TRIGGER_DEPTH_RATIO;

    if (room.exits.right && playerRight >= rightGateTriggerX) {
      this.tryTransition(room.exits.right);
    } else if (room.exits.left && playerLeft <= leftGateTriggerX) {
      this.tryTransition(room.exits.left);
    }
  }

  tryTransition(exitDef) {
    if (this.isTransitioning) return;
    if (this.isBlockedByGate(exitDef.toRoomId)) {
      return;
    }
    this.isTransitioning = true;
    this.scene.cameras.main.fadeOut(ROOM_TRANSITION_FADE_OUT_MS, 0, 0, 0);
    this.scene.time.delayedCall(ROOM_TRANSITION_FADE_OUT_MS, () => {
      this.buildRoom(exitDef.toRoomId, exitDef.spawn);
      this.scene.cameras.main.fadeIn(ROOM_TRANSITION_FADE_IN_MS, 0, 0, 0);
      this.scene.time.delayedCall(ROOM_TRANSITION_FADE_IN_MS, () => {
        this.isTransitioning = false;
      });
    });
  }

  isBlockedByGate(directionRoomId) {
    let blocked = false;
    let requiredAbility = null;
    this.gates?.children.iterate((gate) => {
      if (!gate || !gate.active) return;
      const overlaps = Phaser.Geom.Intersects.RectangleToRectangle(
        this.player.getBounds(),
        gate.getBounds()
      );
      if (overlaps && !this.abilitySystem.has(gate.requiredAbility)) {
        blocked = true;
        requiredAbility = gate.requiredAbility;
      }
    });
    if (blocked) {
      EventBus.emit("gate-blocked", {
        toRoomId: directionRoomId,
        requiredAbility
      });
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
      EventBus.emit("world-hint", "Ring of Flames claimed.");
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

  getLevel2FloorDef() {
    return {
      x: ROOM_DIMENSIONS.width * 0.5,
      y: LEVEL2_FLOOR_Y,
      width: ROOM_DIMENSIONS.width,
      height: LEVEL2_FLOOR_HEIGHT
    };
  }

  buildLevel2FloorSet() {
    const floor = this.getLevel2FloorDef();
    const block = this.platforms.create(floor.x, floor.y, "gate");
    block.displayWidth = floor.width;
    block.displayHeight = floor.height;
    block.setVisible(false);
    block.setAlpha(0.001);
    block.refreshBody();

    const floorBottom = floor.y + floor.height * 0.5;
    const elementCount = Phaser.Math.Between(LEVEL2_FLOOR_ELEMENT_MIN, LEVEL2_FLOOR_ELEMENT_MAX);
    for (let i = 0; i < elementCount; i += 1) {
      const key = Phaser.Utils.Array.GetRandom(FLOOR_ELEMENT_KEYS);
      const x = Phaser.Math.Between(
        LEVEL2_FLOOR_ELEMENT_MARGIN_X,
        ROOM_DIMENSIONS.width - LEVEL2_FLOOR_ELEMENT_MARGIN_X
      );
      const y = floorBottom;
      const scale = Phaser.Math.FloatBetween(LEVEL2_FLOOR_ELEMENT_MIN_SCALE, LEVEL2_FLOOR_ELEMENT_MAX_SCALE);
      const sprite = this.scene.add.image(x, y, key);
      sprite.setOrigin(0.5, 1);
      sprite.setScale(scale);
      sprite.setDepth(PLATFORM_DEPTH + Phaser.Math.Between(-4, 6));
      sprite.setAlpha(Phaser.Math.FloatBetween(0.82, 1));
      this.platformVisuals.add(sprite);
    }
  }

  spawnRoomExitGates(room) {
    if (!room?.exits) return;

    if (room.exits.left) {
      const leftGate = this.scene.add.image(ROOM_GATE_MARGIN_X, ROOM_DIMENSIONS.height - ROOM_GATE_MARGIN_Y, "room-gate");
      leftGate.setOrigin(0, 1);
      leftGate.setDisplaySize(ROOM_GATE_WIDTH, ROOM_GATE_HEIGHT);
      leftGate.setFlipX(true);
      leftGate.setDepth(ROOM_GATE_DEPTH);
      leftGate.setAlpha(0.92);
      this.gateVisuals.add(leftGate);
    }

    if (room.exits.right) {
      const rightGate = this.scene.add.image(
        ROOM_DIMENSIONS.width - ROOM_GATE_MARGIN_X,
        ROOM_DIMENSIONS.height - ROOM_GATE_MARGIN_Y,
        "room-gate"
      );
      rightGate.setOrigin(1, 1);
      rightGate.setDisplaySize(ROOM_GATE_WIDTH, ROOM_GATE_HEIGHT);
      rightGate.setDepth(ROOM_GATE_DEPTH);
      rightGate.setAlpha(0.92);
      this.gateVisuals.add(rightGate);
    }
  }
}
