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

const ROOM_LABELS = {
  start: "Start",
  shaft: "Shaft",
  sanctum: "Sanctum"
};

export class GameScene extends Phaser.Scene {
  constructor() {
    super("game");
    this.lastMoveAt = 0;
    this.moveBoostUntil = 0;
    this.auraBoostUntil = 0;
    this.runCompletedAt = 0;
    this.levelEnding = false;
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
    this.physics.add.overlap(this.player, this.roomManager.sliceTriggers, (_, trigger) => {
      this.roomManager.activateSliceTrigger(trigger);
    });

    this.cameras.main.startFollow(this.player, true, 0.09, 0.09);

    this.input.keyboard.on("keydown-U", () => {
      this.abilitySystem.unlock(ABILITY_IDS.DOUBLE_JUMP);
      this.showHint("Unlocked: double jump (debug)");
      EventBus.emit("abilities-updated");
    });

    this.registerDemonHooks();
    this.registerSliceHooks();
    this.lastMoveAt = this.time.now;
    this.demonAgent.onEvent("room_entered", this.time.now, { roomId: GameState.currentRoomId });
    this.emitSliceHudState();

    this.events.once("shutdown", () => {
      this.unregisterDemonHooks();
      this.unregisterSliceHooks();
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
    this.handleEnemyKilled = (payload) => {
      this.demonAgent.onEvent("enemy_killed", this.time.now);
      if (payload?.carriesRelic && !GameState.slice.hasRelic) {
        this.roomManager.spawnRelicDrop(payload.x, payload.y - 96);
        this.showHint("The Relic Angel has fallen. Claim the relic.");
        this.emitSliceHudState(payload.roomId ?? GameState.currentRoomId);
      }
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
      this.emitSliceHudState(roomId);
      const label = ROOM_LABELS[roomId] ?? roomId;
      this.showHint(`Entered: ${label}`);
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

  registerSliceHooks() {
    this.handleSliceRelicCollected = () => {
      const exit = this.roomManager.spawnExitPortalRandom();
      if (exit) {
        const label = ROOM_LABELS[exit.roomId] ?? exit.roomId;
        this.showHint(`A breach opens in ${label}. Find it and escape.`);
      } else {
        this.showHint("A breach opens. Find the exit and escape.");
      }
      this.emitSliceHudState();
    };
    this.handleSliceCheckpoint = () => {
      this.showHint("Checkpoint active. Press on to the sanctum.");
      this.emitSliceHudState();
    };
    this.handleSliceExitSpawned = (payload) => {
      this.emitSliceHudState(payload?.roomId ?? GameState.currentRoomId);
    };
    this.handleSliceFinished = (payload) => {
      this.runCompletedAt = this.time.now;
      const escaped = payload?.triggerId === "level-exit";
      this.showHint(escaped ? "Run complete. You escaped." : "Run complete. The ritual held.");
      this.demonAgent.onEvent("secret_found", this.time.now);
      this.emitSliceHudState();
      if (escaped) {
        this.endLevel1();
      }
    };

    EventBus.on("slice-relic-collected", this.handleSliceRelicCollected, this);
    EventBus.on("slice-checkpoint-activated", this.handleSliceCheckpoint, this);
    EventBus.on("slice-exit-spawned", this.handleSliceExitSpawned, this);
    EventBus.on("slice-finished", this.handleSliceFinished, this);
  }

  unregisterDemonHooks() {
    EventBus.off("enemy-killed", this.handleEnemyKilled, this);
    EventBus.off("player-damaged", this.handlePlayerDamaged, this);
    EventBus.off("player-died", this.handlePlayerDied, this);
    EventBus.off("chest-opened", this.handleChestOpened, this);
    EventBus.off("room-changed", this.handleRoomChanged, this);
    EventBus.off("demon-deal-response", this.handleDealResponse, this);
  }

  unregisterSliceHooks() {
    EventBus.off("slice-relic-collected", this.handleSliceRelicCollected, this);
    EventBus.off("slice-checkpoint-activated", this.handleSliceCheckpoint, this);
    EventBus.off("slice-exit-spawned", this.handleSliceExitSpawned, this);
    EventBus.off("slice-finished", this.handleSliceFinished, this);
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

  emitSliceHudState(roomId = GameState.currentRoomId) {
    const slice = GameState.slice ?? {};
    let phase = "SEEK THE RELIC";
    let objective = "Hunt the Relic Angel in Start.";

    if (slice.completed) {
      phase = "RITUAL COMPLETE";
      objective = "Level complete. Survive and reflect.";
    } else if (!slice.hasRelic) {
      phase = "SEEK THE RELIC";
      objective = slice.relicDropped
        ? "Claim the relic dropped in Start."
        : "Slay the Relic Angel in Start, then claim the relic.";
    } else {
      phase = "FIND THE EXIT";
      objective = slice.exitSpawned
        ? "Find exit and escape."
        : "A breach is forming. Hold your ground.";
    }

    EventBus.emit("slice-phase-updated", {
      phase,
      roomId
    });
    EventBus.emit("slice-objective-updated", {
      objective,
      roomId
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

  endLevel1() {
    if (this.levelEnding) return;
    this.levelEnding = true;
    this.controller?.setSpeedMultiplier(0);
    this.player?.setVelocity(0, 0);
    this.time.delayedCall(900, () => {
      if (!this.scene.isActive("game")) return;
      this.scene.stop("ui");
      this.scene.start("menu");
    });
  }
}
