import Phaser from "phaser";
import { GameState } from "../core/GameState";
import { Player } from "../entities/Player";
import { AbilitySystem } from "../systems/AbilitySystem";
import { PlayerController } from "../systems/PlayerController";
import { FlightFxController } from "../systems/FlightFxController";
import { RoomManager } from "../world/RoomManager";
import { ABILITY_IDS } from "../data/abilities";
import { EventBus } from "../core/EventBus";
import { CombatSystem } from "../systems/CombatSystem";

export class GameScene extends Phaser.Scene {
  constructor() {
    super("game");
  }

  create() {
    this.player = new Player(this, 120, 700);
    this.abilitySystem = new AbilitySystem(this.player);
    this.controller = new PlayerController(this, this.player, this.abilitySystem);
    this.flightFx = new FlightFxController(this, this.player);
    this.roomManager = new RoomManager(this, this.player, this.abilitySystem);
    this.combat = new CombatSystem(this, this.player, this.roomManager);

    this.roomManager.buildRoom(GameState.currentRoomId, GameState.playerSpawnKey);
    this.physics.add.collider(this.player, this.roomManager.platforms);
    this.physics.add.collider(this.roomManager.enemies, this.roomManager.platforms);

    this.physics.add.overlap(this.player, this.roomManager.gates, (_, gate) => {
      if (!this.abilitySystem.has(gate.requiredAbility)) {
        this.showHint(`Need ${gate.requiredAbility.replace("_", " ")} ability`);
      }
    });

    this.cameras.main.startFollow(this.player, true, 0.09, 0.09);

    this.input.keyboard.on("keydown-U", () => {
      this.abilitySystem.unlock(ABILITY_IDS.DOUBLE_JUMP);
      this.showHint("Unlocked: double jump (debug)");
      EventBus.emit("abilities-updated");
    });

    this.events.once("shutdown", () => {
      this.flightFx?.destroy();
      this.combat?.destroy();
    });
  }

  update(time, delta) {
    this.controller.update(delta);
    this.combat?.update(delta);
    this.flightFx?.update(delta);
    const moving =
      Math.abs(this.player.body.velocity.x) > 20 || Math.abs(this.player.body.velocity.y) > 20;
    if (moving) {
      this.flightFx?.playMovementTrail(this.player.x, this.player.y, delta);
    }
    this.roomManager.enemies?.children.iterate((enemy) => {
      enemy?.updateBehavior?.(this.player, delta);
    });
    this.roomManager.updateRoomTransitions();
  }

  showHint(text) {
    EventBus.emit("world-hint", text);
  }
}
