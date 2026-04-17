import { ABILITY_IDS } from "../data/abilities";
import { GameState } from "../core/GameState";

export class AbilitySystem {
  constructor(player) {
    this.player = player;
  }

  has(id) {
    return GameState.hasAbility(id);
  }

  canDoubleJump() {
    return this.has(ABILITY_IDS.DOUBLE_JUMP);
  }

  canDash() {
    return this.has(ABILITY_IDS.DASH);
  }

  unlock(id) {
    GameState.unlockAbility(id);
  }
}
