import { ABILITY_IDS } from "../data/abilities";

class GameStateStore {
  constructor() {
    this.reset();
  }

  createSliceState() {
    return {
      hasRelic: false,
      relicAngelSlain: false,
      relicDropped: false,
      relicDropRoomId: null,
      relicDropX: 0,
      relicDropY: 0,
      exitSpawned: false,
      exitRoomId: null,
      exitX: 0,
      exitY: 0,
      checkpointActivated: false,
      checkpointRoomId: null,
      checkpointSpawnKey: null,
      completed: false
    };
  }

  reset() {
    this.currentLevel = 1;
    this.currentRoomId = "start";
    this.playerSpawnKey = "spawn_center";
    this.maxHealth = 100;
    this.health = 100;
    this.coins = 0;
    this.whisperAwakened = false;
    this.whisperIntroComplete = false;
    this.demon = {
      corruption: 0,
      dominance: 0,
      recentKills: 0,
      deaths: 0,
      acceptedDeals: 0,
      refusedDeals: 0,
      killsInLastMinute: 0,
      timeSinceLastKill: 0,
      damageTakenRecently: 0,
      deathsInCurrentRoom: 0,
      roomsVisited: 0
    };
    this.collected = new Set();
    this.roomEnemyDefeated = new Set();
    this.roomChestOpened = new Set();
    this.roomEnemyHealth = new Map();
    this.unlockedAbilities = new Set([ABILITY_IDS.DASH]);
    this.slice = this.createSliceState();
  }

  resetSliceProgress() {
    this.slice = this.createSliceState();
    this.currentRoomId = "start";
    this.playerSpawnKey = "spawn_center";
    this.roomEnemyDefeated = new Set();
    this.roomChestOpened = new Set();
    this.roomEnemyHealth = new Map();
  }

  unlockAbility(id) {
    this.unlockedAbilities.add(id);
  }

  hasAbility(id) {
    return this.unlockedAbilities.has(id);
  }

  getRoomEnemyKey(roomId, enemyId) {
    return `${roomId}::${enemyId}`;
  }

  markRoomEnemyDefeated(roomId, enemyId) {
    if (!roomId || !enemyId) return;
    this.roomEnemyDefeated.add(this.getRoomEnemyKey(roomId, enemyId));
  }

  isRoomEnemyDefeated(roomId, enemyId) {
    if (!roomId || !enemyId) return false;
    return this.roomEnemyDefeated.has(this.getRoomEnemyKey(roomId, enemyId));
  }

  markRoomChestOpened(roomId, chestId) {
    if (!roomId || !chestId) return;
    this.roomChestOpened.add(`${roomId}::${chestId}`);
  }

  isRoomChestOpened(roomId, chestId) {
    if (!roomId || !chestId) return false;
    return this.roomChestOpened.has(`${roomId}::${chestId}`);
  }

  setRoomEnemyHealth(roomId, enemyId, health) {
    if (!roomId || !enemyId) return;
    const key = this.getRoomEnemyKey(roomId, enemyId);
    this.roomEnemyHealth.set(key, Math.max(0, Math.round(health ?? 0)));
  }

  getRoomEnemyHealth(roomId, enemyId) {
    if (!roomId || !enemyId) return null;
    const key = this.getRoomEnemyKey(roomId, enemyId);
    return this.roomEnemyHealth.has(key) ? this.roomEnemyHealth.get(key) : null;
  }
}

export const GameState = new GameStateStore();
