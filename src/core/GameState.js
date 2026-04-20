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
    this.unlockedAbilities = new Set([ABILITY_IDS.DASH]);
    this.slice = this.createSliceState();
  }

  resetSliceProgress() {
    this.slice = this.createSliceState();
    this.currentRoomId = "start";
    this.playerSpawnKey = "spawn_center";
    this.roomEnemyDefeated = new Set();
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
}

export const GameState = new GameStateStore();
