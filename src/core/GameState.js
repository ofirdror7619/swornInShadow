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
  }

  unlockAbility(id) {
    this.unlockedAbilities.add(id);
  }

  hasAbility(id) {
    return this.unlockedAbilities.has(id);
  }
}

export const GameState = new GameStateStore();
