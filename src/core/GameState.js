import { ABILITY_IDS } from "../data/abilities";

class GameStateStore {
  constructor() {
    this.reset();
  }

  reset() {
    this.currentRoomId = "start";
    this.playerSpawnKey = "spawn_center";
    this.maxHealth = 100;
    this.health = 100;
    this.coins = 0;
    this.collected = new Set();
    this.unlockedAbilities = new Set([ABILITY_IDS.DASH]);
    this.slice = {
      hasRelic: false,
      relicDropped: false,
      relicDropRoomId: null,
      relicDropX: 0,
      relicDropY: 0,
      exitSpawned: false,
      exitRoomId: null,
      exitX: 0,
      exitY: 0,
      checkpointActivated: false,
      completed: false
    };
  }

  unlockAbility(id) {
    this.unlockedAbilities.add(id);
  }

  hasAbility(id) {
    return this.unlockedAbilities.has(id);
  }
}

export const GameState = new GameStateStore();
