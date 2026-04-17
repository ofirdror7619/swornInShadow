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
    this.gates = this.scene.physics.add.staticGroup();
    this.treasureChests = this.scene.physics.add.staticGroup();
    this.enemies = this.scene.physics.add.group({
      classType: EnemyDemon,
      runChildUpdate: false
    });
    this.background = null;
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
    this.background = this.scene.add
      .image(ROOM_DIMENSIONS.width * 0.5, ROOM_DIMENSIONS.height * 0.5, "room-background")
      .setDisplaySize(ROOM_DIMENSIONS.width, ROOM_DIMENSIONS.height)
      .setDepth(-1000);

    for (const p of room.platforms) {
      const platformKeys = p.width >= 320 ? BIG_PLATFORM_KEYS : MEDIUM_PLATFORM_KEYS;
      const textureKey = Phaser.Utils.Array.GetRandom(platformKeys);
      const block = this.platforms.create(p.x, p.y, textureKey);
      block.refreshBody();
    }

    const platformBlocks = this.platforms.getChildren();
    if (platformBlocks.length > 0) {
      const chosen = Phaser.Utils.Array.GetRandom(platformBlocks);
      const spreadX = Math.max(16, chosen.displayWidth * 0.28);
      const chestX = chosen.x + Phaser.Math.Between(Math.round(-spreadX), Math.round(spreadX));
      const platformTop = chosen.y - chosen.displayHeight * 0.5;
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

    for (const enemyDef of room.enemies ?? []) {
      const EnemyType = ENEMY_FACTORIES[enemyDef.type] ?? EnemyDemon;
      const enemy = new EnemyType(this.scene, enemyDef.x, enemyDef.y, enemyDef.patrol);
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
    this.background?.destroy();
    this.background = null;
    this.platforms?.clear(true, true);
    this.gates?.clear(true, true);
    this.treasureChests?.clear(true, true);
    this.enemies?.clear(true, true);
  }

  breakChest(chest) {
    if (!chest?.active) return false;
    chest.disableBody(true, true);
    GameState.coins += CHEST_COIN_REWARD;
    EventBus.emit("coins-updated", GameState.coins);
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
}
