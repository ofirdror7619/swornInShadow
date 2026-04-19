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
import { DemonAgent } from "../systems/DemonAgent";

const LEVEL_MUSIC_KEY = "music-level-1";

export class GameScene extends Phaser.Scene {
  constructor() {
    super("game");
    this.lastMoveAt = 0;
    this.moveBoostUntil = 0;
    this.auraBoostUntil = 0;
  }

  create() {
    this.startLevelMusic();
    this.player = new Player(this, 120, 700);
    this.abilitySystem = new AbilitySystem(this.player);
    this.controller = new PlayerController(this, this.player, this.abilitySystem);
    this.flightFx = new FlightFxController(this, this.player);
    this.roomManager = new RoomManager(this, this.player, this.abilitySystem);
    this.combat = new CombatSystem(this, this.player, this.roomManager);
    this.demonAgent = new DemonAgent({
      onWhisper: (text) => EventBus.emit("demon-whisper", text),
      onOffer: (deal) => EventBus.emit("demon-offer", deal),
      onStateChanged: (state) => EventBus.emit("demon-state-updated", state)
    });
    EventBus.emit("demon-state-updated", this.demonAgent.getState());

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

    this.registerDemonHooks();
    this.lastMoveAt = this.time.now;
    this.demonAgent.onEvent("room_entered", this.time.now, { roomId: GameState.currentRoomId });

    this.events.once("shutdown", () => {
      this.unregisterDemonHooks();
      this.flightFx?.destroy();
      this.combat?.destroy();
    });
  }

  update(time, delta) {
    this.controller.update(delta);
    this.updateDealBuffs(time);
    this.combat?.update(delta);
    this.flightFx?.update(delta);
    const moving =
      Math.abs(this.player.body.velocity.x) > 20 || Math.abs(this.player.body.velocity.y) > 20;
    if (moving) {
      this.lastMoveAt = time;
      this.flightFx?.playMovementTrail(this.player.x, this.player.y, delta);
    }
    this.roomManager.enemies?.children.iterate((enemy) => {
      enemy?.updateBehavior?.(this.player, delta);
    });
    this.roomManager.updateRoomTransitions();
    this.demonAgent.tick(time, {
      healthPct: GameState.health / Math.max(1, GameState.maxHealth),
      isIdle: time - this.lastMoveAt >= 5000
    });
  }

  showHint(text) {
    EventBus.emit("world-hint", text);
  }

  registerDemonHooks() {
    this.handleEnemyKilled = () => {
      this.demonAgent.onEvent("enemy_killed", this.time.now);
    };
    this.handlePlayerDamaged = (payload) => {
      this.demonAgent.onEvent("player_damaged", this.time.now, payload);
      const healthPct = GameState.health / Math.max(1, GameState.maxHealth);
      if (healthPct <= 0.3) {
        this.demonAgent.onEvent("low_health", this.time.now);
      }
    };
    this.handlePlayerDied = () => {
      this.demonAgent.onEvent("player_died", this.time.now);
    };
    this.handleChestOpened = () => {
      this.demonAgent.onEvent("chest_opened", this.time.now);
    };
    this.handleRoomChanged = (roomId) => {
      this.demonAgent.onEvent("room_entered", this.time.now, { roomId });
    };
    this.handleDealResponse = (payload) => {
      if (payload?.decision === "accept") {
        const deal = this.demonAgent.acceptDeal(this.time.now);
        if (deal) {
          this.applyDealEffect(deal);
        }
      } else {
        this.demonAgent.refuseDeal();
      }
    };

    EventBus.on("enemy-killed", this.handleEnemyKilled, this);
    EventBus.on("player-damaged", this.handlePlayerDamaged, this);
    EventBus.on("player-died", this.handlePlayerDied, this);
    EventBus.on("chest-opened", this.handleChestOpened, this);
    EventBus.on("room-changed", this.handleRoomChanged, this);
    EventBus.on("demon-deal-response", this.handleDealResponse, this);
  }

  unregisterDemonHooks() {
    EventBus.off("enemy-killed", this.handleEnemyKilled, this);
    EventBus.off("player-damaged", this.handlePlayerDamaged, this);
    EventBus.off("player-died", this.handlePlayerDied, this);
    EventBus.off("chest-opened", this.handleChestOpened, this);
    EventBus.off("room-changed", this.handleRoomChanged, this);
    EventBus.off("demon-deal-response", this.handleDealResponse, this);
  }

  applyDealEffect(deal) {
    if (deal.effect === "instant_heal") {
      GameState.health = Math.min(GameState.maxHealth, GameState.health + (deal.healAmount ?? 0));
      EventBus.emit("health-updated", GameState.health);
      EventBus.emit("world-hint", `${deal.title}: restored vital`);
      return;
    }

    if (deal.effect === "aura_damage_boost") {
      this.auraBoostUntil = this.time.now + deal.durationMs;
      EventBus.emit("world-hint", `${deal.title}: aura empowered`);
      return;
    }

    if (deal.effect === "flight_boost") {
      this.moveBoostUntil = this.time.now + deal.durationMs;
      EventBus.emit("world-hint", `${deal.title}: speed surges`);
    }
  }

  updateDealBuffs(now) {
    const moveMultiplier = now < this.moveBoostUntil ? 1.4 : 1;
    const auraMultiplier = now < this.auraBoostUntil ? 1.5 : 1;
    this.controller.setSpeedMultiplier(moveMultiplier);
    this.combat.setAuraDamageMultiplier(auraMultiplier);
    EventBus.emit("demon-buffs-updated", {
      moveBoostLeftMs: Math.max(0, this.moveBoostUntil - now),
      auraBoostLeftMs: Math.max(0, this.auraBoostUntil - now)
    });
  }

  startLevelMusic() {
    let music = this.sound.get(LEVEL_MUSIC_KEY);
    if (!music) {
      music = this.sound.add(LEVEL_MUSIC_KEY, {
        loop: true,
        volume: 0.45
      });
    }
    if (!music.isPlaying) {
      music.play();
    }
  }
}
