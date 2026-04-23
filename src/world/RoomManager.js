import Phaser from "phaser";
import { ROOMS, ROOM_DIMENSIONS } from "../data/rooms";
import { GameState } from "../core/GameState";
import { EventBus } from "../core/EventBus";
import { EnemyAngel } from "../entities/EnemyAngel";
import { FallenSeraph } from "../entities/FallenSeraph";

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
const CHEST_PLATFORM_ORIGIN_Y = 1;
const CHEST_PLATFORM_SINK_Y = 42;
const CHEST_MIN_PLATFORM_MARGIN = 42;
const CHEST_VISUAL_SINK_Y = 44;
const ROOM_CHEST_ID = "main-chest";
const MISSION_CHEST_ROOM_ID = "crypt";
const MISSION_CHEST_ID = "mission-1-huge-chest";
const MISSION_CHEST_TEXTURE_KEY = "huge-chest";
const MISSION_CHEST_SCALE = 0.3;
const MISSION_CHEST_ORIGIN_Y = 1;
const MISSION_CHEST_SINK_Y = 62;
const SLICE_TRIGGER_ALPHA = 0.001;
const RELIC_TEXTURE_KEY = "relic-object";
const RELIC_FLOAT_PIXELS = 9;
const RELIC_FLOAT_MS = 1450;
const RELIC_TRIGGER_W = 64;
const RELIC_TRIGGER_H = 92;
const RELIC_PICKUP_LOCK_MS = 700;
const EXIT_TEXTURE_KEY = "exit-portal";
const EXIT_APPEAR_SFX_KEY = "sfx-exit-appear";
const CHEST_OPEN_SFX_KEY = "sfx-treasure-chest";
const EXIT_TRIGGER_W = 42;
const EXIT_TRIGGER_H = 52;
const EXIT_VISIBLE_BOTTOM_ORIGIN_Y = 0.78;
const EXIT_PLATFORM_Y_OFFSET = 20;
const EXIT_APPEAR_SFX_VOLUME = 0.9;
const CHEST_OPEN_SFX_VOLUME = 0.82;
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
const BG_CEILING_TILT_DEGREES = 0.9;
const BG_CEILING_TILT_MS = 3400;
const ATMOSPHERE_BACK_DEPTH = 250;
const ATMOSPHERE_GLOW_DEPTH = 252;
const COLOR_GRADE_DEPTH = 1800;
const WORLD_DEPTH_BASE = 300;
const PLATFORM_DEPTH = 460;
const ROOM_GATE_DEPTH = 620;
const ROOM_GATE_MARGIN_X = 0;
const ROOM_GATE_MARGIN_Y = 12;
const ROOM_GATE_WIDTH = 112;
const ROOM_GATE_HEIGHT = 224;
const ROOM_GATE_ALPHA = 0.92;
const ROOM_GATE_PORTAL_CENTER_X_RATIO = 0.48;
const ROOM_GATE_PORTAL_CENTER_Y_RATIO = 0.62;
const ROOM_GATE_PORTAL_MASK_WIDTH_RATIO = 0.52;
const ROOM_GATE_PORTAL_MASK_HEIGHT_RATIO = 0.6;
const ROOM_GATE_VORTEX_ALPHA = 0.5;
const ROOM_GATE_VORTEX_ROTATE_MS_FAST = 5200;
const ROOM_EXIT_TRIGGER_DEPTH_RATIO = 0.42;
const RELIC_DEPTH_OFFSET = 18;
const CHEST_DEPTH_OFFSET = -12;
const ENEMY_FACTORIES = {
  angel: EnemyAngel,
  fallen_seraph: FallenSeraph
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
    this.roomExitTriggers = this.scene.physics.add.staticGroup();
    this.treasureChests = this.scene.physics.add.staticGroup();
    this.enemies = this.scene.physics.add.group({
      classType: EnemyAngel,
      runChildUpdate: false
    });
    this.backgroundLayer1 = null;
    this.backgroundLayer2 = null;
    this.ceilingLayer = null;
    this.ceilingTiltTween = null;
    this.atmosphereFx = [];
    this.colorGradeOverlay = null;
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
    this.startCeilingAmbientMotion();
    this.createAtmosphereFx(room);

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
    if (this.shouldSpawnMissionChest(roomId)) {
      this.spawnMissionChest(room);
    } else if (platformBodies.length > 0 && !GameState.isRoomChestOpened(roomId, ROOM_CHEST_ID)) {
      let chestX = null;
      let chestY = null;

      const platformVisuals = this.platformVisuals?.getChildren?.() ?? [];
      if (platformVisuals.length > 0) {
        const chosenVisual = Phaser.Utils.Array.GetRandom(platformVisuals);
        const visualBounds = chosenVisual?.getBounds?.();
        if (visualBounds) {
          const margin = Math.min(
            CHEST_MIN_PLATFORM_MARGIN,
            Math.max(12, Math.floor(visualBounds.width * 0.18))
          );
          const minX = Math.round(visualBounds.left + margin);
          const maxX = Math.round(visualBounds.right - margin);
          chestX =
            maxX > minX
              ? Phaser.Math.Between(minX, maxX)
              : Math.round((visualBounds.left + visualBounds.right) * 0.5);
          chestY = Math.round(visualBounds.top + CHEST_VISUAL_SINK_Y);
        }
      }

      if (chestX === null || chestY === null) {
        const chosenPlatform = Phaser.Utils.Array.GetRandom(platformBodies);
        const bounds = chosenPlatform?.body;
        if (bounds) {
          const minX = Math.round(bounds.left + CHEST_MIN_PLATFORM_MARGIN);
          const maxX = Math.round(bounds.right - CHEST_MIN_PLATFORM_MARGIN);
          chestX = maxX > minX ? Phaser.Math.Between(minX, maxX) : Math.round((bounds.left + bounds.right) * 0.5);
          chestY = Math.round(bounds.top + CHEST_PLATFORM_SINK_Y);
        }
      }

      if (chestX !== null && chestY !== null) {
        const chest = this.treasureChests.create(chestX, chestY, "treasure-chest");
        chest.setOrigin(0.5, CHEST_PLATFORM_ORIGIN_Y);
        chest.setDepth(650);
        chest.setScale(CHEST_SCALE);
        chest.spawnRoomId = roomId;
        chest.spawnChestId = ROOM_CHEST_ID;
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
    if (enemy.isRoomEnemy && enemy.spawnRoomId && enemy.spawnEnemyId) {
      const persistedHealth = GameState.getRoomEnemyHealth(enemy.spawnRoomId, enemy.spawnEnemyId);
      if (persistedHealth !== null && Number.isFinite(persistedHealth)) {
        enemy.health = Phaser.Math.Clamp(persistedHealth, 0, enemy.health);
      }
    }
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
    this.ceilingTiltTween?.stop();
    this.ceilingTiltTween = null;
    this.clearAtmosphereFx();
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
    this.roomExitTriggers?.clear(true, true);
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
      chest.setDepth(this.depthForY(chest.y, CHEST_DEPTH_OFFSET));
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
      enemy.syncAuraDepth?.(enemyDepth);
    });

    this.updateAtmosphereRuntime();
  }

  shouldSpawnSliceTrigger(kind) {
    if (kind === "relic") return !GameState.slice.hasRelic;
    if (kind === "checkpoint") return !GameState.slice.checkpointActivated;
    if (kind === "ritual") return !GameState.slice.completed;
    if (kind === "exit") return GameState.slice.exitSpawned && !GameState.slice.completed;
    return true;
  }

  startCeilingAmbientMotion() {
    if (!this.ceilingLayer) return;
    const baseX = ROOM_DIMENSIONS.width * 0.5;
    const baseY = 0;
    this.ceilingLayer.setPosition(baseX, baseY);
    this.ceilingLayer.setAngle(-BG_CEILING_TILT_DEGREES);

    this.ceilingTiltTween?.stop();

    this.ceilingTiltTween = this.scene.tweens.add({
      targets: this.ceilingLayer,
      angle: BG_CEILING_TILT_DEGREES,
      duration: BG_CEILING_TILT_MS,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1
    });
  }

  createAtmosphereFx(room) {
    const emberField = this.scene.add.particles(0, 0, "fx-ember", {
      lifespan: { min: 1500, max: 2800 },
      frequency: 24,
      quantity: 1,
      speedX: { min: -10, max: 10 },
      speedY: { min: -42, max: -14 },
      scale: { start: 0.52, end: 0 },
      alpha: { start: 0.3, end: 0 },
      tint: [0xff6c34, 0xff9d57, 0xffd49b],
      blendMode: "ADD",
      emitZone: {
        source: new Phaser.Geom.Rectangle(16, 160, ROOM_DIMENSIONS.width - 32, ROOM_DIMENSIONS.height - 220),
        type: "random"
      }
    });
    emberField.setDepth(ATMOSPHERE_BACK_DEPTH);
    this.trackAtmosphereFx(emberField);

    const smokeField = this.scene.add.particles(0, 0, "fx-smoke", {
      lifespan: { min: 2600, max: 4400 },
      frequency: 110,
      quantity: 1,
      speedX: { min: -10, max: 10 },
      speedY: { min: -22, max: -6 },
      scale: { start: 0.9, end: 2.15 },
      alpha: { start: 0.12, end: 0 },
      tint: [0x1d1416, 0x271b1d, 0x312123],
      emitZone: {
        source: new Phaser.Geom.Rectangle(0, 220, ROOM_DIMENSIONS.width, ROOM_DIMENSIONS.height - 220),
        type: "random"
      }
    });
    smokeField.setDepth(ATMOSPHERE_BACK_DEPTH - 2);
    this.trackAtmosphereFx(smokeField);

    this.createLampGlowField();
    this.createHeatFromPlatforms(room);
    this.createColorGradingOverlay();
  }

  createLampGlowField() {
    const lampCount = 5;
    for (let i = 0; i < lampCount; i += 1) {
      const x = ((i + 1) * ROOM_DIMENSIONS.width) / (lampCount + 1);
      const y = 162 + Math.sin(i * 1.6) * 14;

      const glow = this.scene.add.image(x, y, "fx-gold");
      glow.setDepth(ATMOSPHERE_GLOW_DEPTH);
      glow.setScale(5.8);
      glow.setTint(0xffa25d);
      glow.setBlendMode("ADD");
      glow.setAlpha(0.18);
      this.trackAtmosphereFx(glow);

      const halo = this.scene.add.circle(x, y + 8, 92, 0xff8e48, 0.12);
      halo.setDepth(ATMOSPHERE_GLOW_DEPTH - 1);
      halo.setBlendMode("ADD");
      this.trackAtmosphereFx(halo);

      this.scene.tweens.add({
        targets: [glow, halo],
        alpha: { from: 0.1, to: 0.24 },
        scale: { from: 0.96, to: 1.1 },
        duration: Phaser.Math.Between(760, 1280),
        ease: "Sine.easeInOut",
        yoyo: true,
        repeat: -1,
        delay: Phaser.Math.Between(0, 240)
      });
    }
  }

  createHeatFromPlatforms(room) {
    for (const platform of room.platforms ?? []) {
      if (!platform || platform.y < 520) continue;

      const width = Math.min(320, platform.width * 0.84);
      const glow = this.scene.add.ellipse(platform.x, platform.y - platform.height * 0.62, width, 84, 0xff7a40, 0.06);
      glow.setDepth(PLATFORM_DEPTH - 3);
      glow.setBlendMode("ADD");
      this.trackAtmosphereFx(glow);

      this.scene.tweens.add({
        targets: glow,
        alpha: { from: 0.04, to: 0.1 },
        scaleX: { from: 0.96, to: 1.05 },
        scaleY: { from: 0.92, to: 1.06 },
        duration: Phaser.Math.Between(800, 1300),
        ease: "Sine.easeInOut",
        yoyo: true,
        repeat: -1
      });

      const smoke = this.scene.add.particles(0, 0, "fx-smoke", {
        lifespan: { min: 1100, max: 1900 },
        frequency: 48,
        quantity: 1,
        speedX: { min: -10, max: 10 },
        speedY: { min: -48, max: -20 },
        scale: { start: 0.38, end: 1.08 },
        alpha: { start: 0.16, end: 0 },
        tint: [0x281717, 0x342122],
        emitZone: {
          source: new Phaser.Geom.Rectangle(
            platform.x - platform.width * 0.38,
            platform.y - platform.height * 0.5,
            platform.width * 0.76,
            6
          ),
          type: "random"
        }
      });
      smoke.setDepth(PLATFORM_DEPTH + 2);
      this.trackAtmosphereFx(smoke);
    }
  }

  createColorGradingOverlay() {
    const w = this.scene.scale.width;
    const h = this.scene.scale.height;

    const vignette = this.scene.add.rectangle(w * 0.5, h * 0.5, w, h, 0x120709, 0.22);
    vignette.setScrollFactor(0);
    vignette.setDepth(COLOR_GRADE_DEPTH);
    this.trackAtmosphereFx(vignette);

    const warmCore = this.scene.add.circle(
      this.player?.x ?? ROOM_DIMENSIONS.width * 0.5,
      (this.player?.y ?? ROOM_DIMENSIONS.height * 0.5) + 8,
      Math.max(235, Math.min(w, h) * 0.33),
      0xff8f52,
      0.1
    );
    warmCore.setDepth(ATMOSPHERE_GLOW_DEPTH + 1);
    warmCore.setBlendMode("ADD");
    this.trackAtmosphereFx(warmCore);

    this.colorGradeOverlay = { vignette, warmCore };
  }

  updateAtmosphereRuntime() {
    if (!this.colorGradeOverlay?.warmCore?.active || !this.player?.active) return;

    this.colorGradeOverlay.warmCore.setPosition(this.player.x, this.player.y + 8);
    this.colorGradeOverlay.warmCore.setDepth(Math.max(ATMOSPHERE_GLOW_DEPTH + 1, this.depthForY(this.player.y, -18)));
  }

  trackAtmosphereFx(displayObject) {
    if (!displayObject) return;
    this.atmosphereFx.push(displayObject);
  }

  clearAtmosphereFx() {
    for (const fx of this.atmosphereFx) {
      fx?.destroy?.();
    }
    this.atmosphereFx = [];
    this.colorGradeOverlay = null;
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

  shouldSpawnMissionChest(roomId) {
    return (
      roomId === MISSION_CHEST_ROOM_ID &&
      GameState.slice.hasRelic &&
      !GameState.slice.completed &&
      !GameState.isRoomChestOpened(MISSION_CHEST_ROOM_ID, MISSION_CHEST_ID)
    );
  }

  spawnMissionChest(room) {
    const groundPlatform = room?.platforms?.[0];
    const chestX = Math.round(groundPlatform?.x ?? ROOM_DIMENSIONS.width * 0.5);
    const groundTopY = groundPlatform
      ? groundPlatform.y - groundPlatform.height * 0.5
      : ROOM_DIMENSIONS.height * 0.5;
    const chestY = Math.round(groundTopY + MISSION_CHEST_SINK_Y);
    const chest = this.treasureChests.create(chestX, chestY, MISSION_CHEST_TEXTURE_KEY);
    chest.setOrigin(0.5, MISSION_CHEST_ORIGIN_Y);
    chest.setDepth(650);
    chest.setScale(MISSION_CHEST_SCALE);
    chest.spawnRoomId = MISSION_CHEST_ROOM_ID;
    chest.spawnChestId = MISSION_CHEST_ID;
    chest.requiresRelic = true;
    chest.isMissionChest = true;
    chest.refreshBody();
    return chest;
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
    if (chest.requiresRelic && !GameState.slice.hasRelic) {
      EventBus.emit("world-hint", "An ancient lock rejects you. Bring the relic.");
      return false;
    }
    chest.disableBody(true, true);
    GameState.markRoomChestOpened(chest.spawnRoomId ?? GameState.currentRoomId, chest.spawnChestId ?? ROOM_CHEST_ID);
    this.scene.sound.play(CHEST_OPEN_SFX_KEY, { volume: CHEST_OPEN_SFX_VOLUME });
    if (chest.isMissionChest) {
      GameState.slice.completed = true;
      EventBus.emit("chest-opened");
      EventBus.emit("slice-finished", {
        roomId: GameState.currentRoomId,
        triggerId: "mission-1-chest"
      });
      EventBus.emit("world-hint", "The relic unlocks the huge chest. Mission 1 complete.");
      this.scene.cameras.main.shake(120, 0.0032);
      return true;
    }
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
    const playerBounds = this.player?.getBounds?.();
    if (!playerBounds) return;

    let triggeredExit = null;
    this.roomExitTriggers?.children?.iterate((trigger) => {
      if (triggeredExit || !trigger?.active || !trigger.exitDef) return;
      const overlaps = Phaser.Geom.Intersects.RectangleToRectangle(playerBounds, trigger.getBounds());
      if (!overlaps) return;
      triggeredExit = trigger.exitDef;
    });

    if (triggeredExit) {
      this.tryTransition(triggeredExit);
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
      this.spawnAnimatedRoomGate(ROOM_GATE_MARGIN_X, ROOM_DIMENSIONS.height - ROOM_GATE_MARGIN_Y, {
        originX: 0,
        flipX: true
      }, room.exits.left);
    }

    if (room.exits.right) {
      this.spawnAnimatedRoomGate(
        ROOM_DIMENSIONS.width - ROOM_GATE_MARGIN_X,
        ROOM_DIMENSIONS.height - ROOM_GATE_MARGIN_Y,
        {
          originX: 1,
          flipX: false
        },
        room.exits.right
      );
    }
  }

  spawnAnimatedRoomGate(x, y, options = {}, exitDef = null) {
    const originX = options.originX ?? 0.5;
    const flipX = Boolean(options.flipX);
    const gateCenterX = x + (0.5 - originX) * ROOM_GATE_WIDTH;
    const gateCenterY = y - ROOM_GATE_HEIGHT * 0.5;
    const base = this.scene.add.image(x, y, "room-gate");
    base.setOrigin(originX, 1);
    base.setDisplaySize(ROOM_GATE_WIDTH, ROOM_GATE_HEIGHT);
    base.setFlipX(flipX);
    base.setDepth(ROOM_GATE_DEPTH);
    base.setAlpha(ROOM_GATE_ALPHA);
    this.gateVisuals.add(base);

    const portalCenterX = x + (ROOM_GATE_PORTAL_CENTER_X_RATIO - originX) * ROOM_GATE_WIDTH;
    const portalCenterY = y - (1 - ROOM_GATE_PORTAL_CENTER_Y_RATIO) * ROOM_GATE_HEIGHT;
    const portalMaskW = ROOM_GATE_WIDTH * ROOM_GATE_PORTAL_MASK_WIDTH_RATIO;
    const portalMaskH = ROOM_GATE_HEIGHT * ROOM_GATE_PORTAL_MASK_HEIGHT_RATIO;

    const portalMaskShape = this.scene.add.graphics();
    portalMaskShape.fillStyle(0xffffff, 1);
    portalMaskShape.fillEllipse(portalCenterX, portalCenterY, portalMaskW, portalMaskH);
    portalMaskShape.setVisible(false);
    this.gateVisuals.add(portalMaskShape);
    const portalMask = portalMaskShape.createGeometryMask();

    const vortexFast = this.scene.add.image(gateCenterX, gateCenterY, "room-gate");
    vortexFast.setOrigin(0.5, 0.5);
    vortexFast.setDisplaySize(ROOM_GATE_WIDTH, ROOM_GATE_HEIGHT);
    vortexFast.setFlipX(false);
    vortexFast.setDepth(ROOM_GATE_DEPTH + 1);
    vortexFast.setBlendMode("ADD");
    vortexFast.setAlpha(ROOM_GATE_VORTEX_ALPHA);
    vortexFast.setMask(portalMask);
    this.gateVisuals.add(vortexFast);

    this.scene.tweens.add({
      targets: vortexFast,
      angle: 360,
      duration: ROOM_GATE_VORTEX_ROTATE_MS_FAST,
      ease: "Linear",
      repeat: -1
    });

    if (!exitDef) return;
    const trigger = this.roomExitTriggers.create(portalCenterX, portalCenterY, "gate");
    trigger.displayWidth = portalMaskW * 0.82;
    trigger.displayHeight = portalMaskH * 0.86;
    trigger.setAlpha(0.001);
    trigger.setVisible(false);
    trigger.exitDef = exitDef;
    trigger.refreshBody();
  }
}
