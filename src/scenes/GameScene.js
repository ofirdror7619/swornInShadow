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
  start: "Start Chamber",
  shaft: "Combat Hall",
  crypt: "Sealed Reliquary",
  sanctum: "Fallen Sanctum"
};

const WHISPER_INTRO_LINES = [
  "You split an angel, and something split open in you.",
  "I am the Whisper that wears your shadow when you refuse to look.",
  "Give me your victories and your ruin, and I will make both useful.",
  "What I grant does not leave. What I take does not return.",
  "Walk on, vessel. We will learn each other slowly."
];
const WHISPER_INTRO_START_DELAY_MS = 900;
// UI whisper queue enforces voice-end sequencing; keep emitter cadence tight.
const WHISPER_INTRO_LINE_GAP_MS = 120;
const LEVEL_TRANSITION_DELAY_MS = 950;
const COMBO_WINDOW_MS = 3200;
const THREAT_KILL_STEP = 5;
const MAX_THREAT_TIER = 5;
const AMBUSH_INTERVAL_BASE_MS = 28000;
const AMBUSH_INTERVAL_STEP_MS = 3600;
const AMBUSH_INTERVAL_MIN_MS = 10000;
const CORRUPTION_TIER1 = 25;
const CORRUPTION_TIER2 = 50;
const CORRUPTION_TIER3 = 75;
const ASK_WHISPER_COOLDOWN_MS = 9000;

const WHISPER_DIRECTIVES = [
  {
    id: "clean_kill",
    stage: 1,
    title: "Spill Their Fire",
    whisper: "Spill their fire before they touch you.",
    prompt: "Kill 1 enemy without taking damage.",
    objective: "Kill 1 enemy, take no damage",
    type: "kill_without_damage",
    target: 1,
    timeLimitMs: 18000,
    corruptionGain: 2,
    reward: { type: "heal", amount: 14, label: "Restore 14 Vital" }
  },
  {
    id: "airborne_cut",
    stage: 1,
    title: "Drift Above Them",
    whisper: "Do not land. Drift above them.",
    prompt: "Kill 1 enemy while airborne.",
    objective: "Kill 1 enemy while airborne",
    type: "airborne_kill",
    target: 1,
    timeLimitMs: 18000,
    corruptionGain: 2,
    reward: { type: "aura_charge", amount: 0.4, label: "Recharge Fire Storm" }
  },
  {
    id: "never_pause",
    stage: 1,
    title: "Do Not Hesitate",
    whisper: "Do not hesitate. Move.",
    prompt: "Keep moving for 5 seconds.",
    objective: "Move continuously for 5s",
    type: "keep_moving",
    target: 5000,
    timeLimitMs: 12000,
    corruptionGain: 1,
    reward: { type: "speed_boost", amount: 7000, label: "Speed boost for 7s" }
  },
  {
    id: "burn_three",
    stage: 2,
    title: "Burn Three",
    whisper: "Burn three. Let none remain.",
    prompt: "Kill 3 enemies without taking damage.",
    objective: "Kill 3 enemies, take no damage",
    type: "kill_without_damage",
    target: 3,
    timeLimitMs: 26000,
    corruptionGain: 4,
    reward: { type: "aura_boost", amount: 10000, label: "Fire Storm empowered for 10s" }
  },
  {
    id: "ash_hunt",
    stage: 2,
    title: "Climb Through Ash",
    whisper: "Climb through ash, not stone.",
    prompt: "Kill 2 enemies without dashing.",
    objective: "Kill 2 enemies, no dash",
    type: "kill_without_dash",
    target: 2,
    timeLimitMs: 20000,
    corruptionGain: 3,
    reward: { type: "dual_boost", amount: 8000, label: "Speed + Fire Storm boost for 8s" }
  },
  {
    id: "air_chain",
    stage: 2,
    title: "Above The Weak",
    whisper: "Take them from above. Keep your wings open.",
    prompt: "Kill 2 enemies while airborne.",
    objective: "Kill 2 enemies while airborne",
    type: "airborne_kill",
    target: 2,
    timeLimitMs: 22000,
    corruptionGain: 4,
    reward: { type: "heal_and_charge", amount: 10, label: "Restore 10 Vital + recharge Fire Storm" }
  }
];

export class GameScene extends Phaser.Scene {
  constructor() {
    super("game");
    this.lastMoveAt = 0;
    this.moveBoostUntil = 0;
    this.auraBoostUntil = 0;
    this.runCompletedAt = 0;
    this.levelEnding = false;
    this.killCombo = 0;
    this.comboExpiresAt = 0;
    this.enemiesDefeated = 0;
    this.threatTier = 1;
    this.nextAmbushAt = 0;
    this.corruptionTier = 0;
    this.lastDirectiveAskAt = -Infinity;
    this.pendingDirective = null;
    this.activeDirective = null;
    this.lastAskAvailabilityKey = "";
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
      onWhisper: (payload) => EventBus.emit("demon-whisper", payload),
      onOffer: (deal) => EventBus.emit("demon-offer", deal),
      onChoice: (choice) => EventBus.emit("demon-choice-offered", choice),
      onStateChanged: (state) => EventBus.emit("demon-state-updated", state),
      initialState: GameState.demon
    });
    this.demonAgent.setNarrationLocked(!GameState.whisperIntroComplete);
    if (GameState.whisperAwakened) {
      this.demonAgent.awakenWhisper();
    }
    EventBus.emit("demon-state-updated", this.demonAgent.getState());

    this.roomManager.buildRoom(GameState.currentRoomId, GameState.playerSpawnKey);
    this.roomManager.setCorruptionState(this.demonAgent.getState().corruption);
    this.physics.add.collider(this.player, this.roomManager.platforms);
    this.physics.add.collider(this.player, this.roomManager.corruptionBlocks);
    this.physics.add.collider(this.roomManager.enemies, this.roomManager.platforms);
    this.physics.add.collider(this.roomManager.enemies, this.roomManager.corruptionBlocks);
    this.physics.add.collider(
      this.player,
      this.roomManager.gates,
      undefined,
      (_player, gate) => !this.abilitySystem.has(gate.requiredAbility),
      this
    );

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
    if (GameState.whisperIntroComplete) {
      this.demonAgent.onEvent("room_entered", this.time.now, { roomId: GameState.currentRoomId });
    }
    this.emitSliceHudState();
    this.nextAmbushAt = this.time.now + this.getAmbushIntervalMs();
    this.emitGameplayLoopHud();
    this.emitAskWhisperAvailability(true);

    this.events.once("shutdown", () => {
      this.unregisterDemonHooks();
      this.unregisterSliceHooks();
      this.flightFx?.destroy();
      this.combat?.destroy();
    });
  }

  update(time, delta) {
    this.controller.update(delta);
    this.physics.world.collide(this.player, this.roomManager.platforms);
    this.physics.world.collide(this.roomManager.enemies, this.roomManager.platforms);
    this.updateDealBuffs(time);
    this.combat?.update(delta);
    this.roomManager.enemies?.children.iterate((enemy) => {
      enemy?.updateBehavior?.(this.player, delta);
    });
    this.roomManager.updateDynamicDepths();
    this.flightFx?.update(delta);
    const moving =
      Math.abs(this.player.body.velocity.x) > 20 || Math.abs(this.player.body.velocity.y) > 20;
    if (moving) {
      this.lastMoveAt = time;
      this.flightFx?.playMovementTrail(this.player.x, this.player.y, delta);
    }
    this.updateActiveDirective(time, delta, moving);
    this.roomManager.updateRoomTransitions();
    this.updateDynamicChallenge(time);
    this.demonAgent.tick(time, {
      healthPct: GameState.health / Math.max(1, GameState.maxHealth),
      isIdle: time - this.lastMoveAt >= 5000
    });
    this.emitAskWhisperAvailability();
  }

  showHint(text) {
    EventBus.emit("world-hint", text);
  }

  registerDemonHooks() {
    this.handleEnemyKilled = (payload) => {
      const killRoomId = payload?.roomId ?? GameState.currentRoomId;
      this.handleEnemyDefeated(payload);
      this.onDirectiveEnemyKilled(this.time.now);
      if (payload?.enemyType === "fallen_seraph") {
        this.combat?.grantPermanentFireStormBonus(0.2);
        EventBus.emit("world-hint", "Seraph slain. Fire Storm permanently empowered.");
      }
      if (payload?.isRoomEnemy && payload?.spawnRoomId && payload?.spawnEnemyId) {
        GameState.markRoomEnemyDefeated(payload.spawnRoomId, payload.spawnEnemyId);
        if (payload.spawnRoomId === "crypt" && !GameState.slice.hasRelic && !GameState.slice.relicDropped) {
          this.emitSliceHudState(killRoomId);
        }
      }
      if (payload?.enemyType === "angel" && !GameState.whisperAwakened) {
        this.startWhisperAwakeningSequence();
      }
      if (this.isWhisperInteractive()) {
        this.demonAgent.onEvent("enemy_killed", this.time.now);
      }
      const seraphDroppedRelic =
        payload?.enemyType === "fallen_seraph" && !GameState.slice.hasRelic && !GameState.slice.relicDropped;
      if ((payload?.carriesRelic || seraphDroppedRelic) && !GameState.slice.hasRelic) {
        GameState.slice.relicAngelSlain = true;
        this.roomManager.spawnRelicDrop(payload.x, payload.y - 96);
        this.showHint("Fallen Seraph dropped the relic. Claim it.");
        this.emitSliceHudState(killRoomId);
      }
    };
    this.handlePlayerDamaged = (payload) => {
      if (!this.isWhisperInteractive()) return;
      this.onDirectivePlayerDamaged(this.time.now);
      this.demonAgent.onEvent("player_damaged", this.time.now, payload);
      const healthPct = GameState.health / Math.max(1, GameState.maxHealth);
      if (healthPct <= 0.3) {
        this.demonAgent.onEvent("low_health", this.time.now);
      }
    };
    this.handlePlayerDied = () => {
      if (!this.isWhisperInteractive()) return;
      this.clearActiveDirective();
      this.demonAgent.onEvent("player_died", this.time.now);
    };
    this.handleChestOpened = () => {
      if (!this.isWhisperInteractive()) return;
      this.demonAgent.onEvent("chest_opened", this.time.now);
    };
    this.handleRoomChanged = (roomId) => {
      if (this.isWhisperInteractive()) {
        this.demonAgent.onEvent("room_entered", this.time.now, { roomId });
      }
      this.emitSliceHudState(roomId);
      this.emitGameplayLoopHud();
      this.emitAskWhisperAvailability();
      const label = ROOM_LABELS[roomId] ?? roomId;
      this.showHint(`Entered: ${label}`);
    };
    this.handleDealResponse = (payload) => {
      if (!this.isWhisperInteractive()) return;
      if (payload?.decision === "accept") {
        const deal = this.demonAgent.acceptDeal(this.time.now);
        if (deal) {
          this.applyDealEffect(deal);
        }
      } else {
        this.demonAgent.refuseDeal();
      }
      this.emitAskWhisperAvailability();
    };
    this.handleChoiceResponse = (payload) => {
      if (!this.isWhisperInteractive()) return;
      const result = this.demonAgent.resolveChoice(payload?.decision, this.time.now);
      if (result) {
        this.applyWhisperChoiceEffect(result);
      }
      this.emitAskWhisperAvailability();
    };
    this.handleGateBlockedForDemon = () => {
      if (!this.isWhisperInteractive()) return;
      this.demonAgent.onEvent("gate_blocked", this.time.now, { roomId: GameState.currentRoomId });
    };
    this.handleDemonState = (state) => {
      this.onCorruptionStateUpdated(state);
    };
    this.handleWhisperAskRequested = () => {
      this.handleAskWhisperRequested();
    };
    this.handleWhisperDirectiveResponse = (payload) => {
      this.handleDirectiveResponse(payload);
    };
    this.handlePlayerDashed = () => {
      this.onDirectiveDashed(this.time.now);
    };

    EventBus.on("enemy-killed", this.handleEnemyKilled, this);
    EventBus.on("player-damaged", this.handlePlayerDamaged, this);
    EventBus.on("player-died", this.handlePlayerDied, this);
    EventBus.on("chest-opened", this.handleChestOpened, this);
    EventBus.on("room-changed", this.handleRoomChanged, this);
    EventBus.on("demon-deal-response", this.handleDealResponse, this);
    EventBus.on("demon-choice-response", this.handleChoiceResponse, this);
    EventBus.on("gate-blocked", this.handleGateBlockedForDemon, this);
    EventBus.on("demon-state-updated", this.handleDemonState, this);
    EventBus.on("whisper-ask-requested", this.handleWhisperAskRequested, this);
    EventBus.on("whisper-directive-response", this.handleWhisperDirectiveResponse, this);
    EventBus.on("player-dashed", this.handlePlayerDashed, this);
  }

  registerSliceHooks() {
    this.handleSliceRelicCollected = () => {
      if (!this.abilitySystem.has(ABILITY_IDS.FLAME_RING)) {
        this.abilitySystem.unlock(ABILITY_IDS.FLAME_RING);
        EventBus.emit("abilities-updated");
      }
      this.showHint("Relic claimed. Return to Room C and open the huge chest.");
      this.emitSliceHudState();
    };
    this.handleSliceCheckpoint = () => {
      this.showHint("Checkpoint bound.");
      this.emitSliceHudState();
    };
    this.handleSliceExitSpawned = (payload) => {
      this.emitSliceHudState(payload?.roomId ?? GameState.currentRoomId);
    };
    this.handleMissionCompleteConfirmed = () => {
      if ((GameState.currentLevel ?? 1) === 1) {
        this.startLevel2();
      } else {
        this.endLevel1();
      }
    };
    this.handleSliceFinished = (payload) => {
      this.runCompletedAt = this.time.now;
      this.killCombo = 0;
      this.comboExpiresAt = 0;
      const triggerId = payload?.triggerId;
      const missionCleared = triggerId === "level-exit" || triggerId === "mission-1-chest";
      if (missionCleared && (GameState.currentLevel ?? 1) === 1) {
        this.showHint("Level 1 complete. Descending to Level 2...");
      } else {
        this.showHint(missionCleared ? "Run complete. You escaped." : "Run complete. Mission complete.");
      }
      if (this.isWhisperInteractive()) {
        this.demonAgent.onEvent("secret_found", this.time.now);
      }
      this.emitSliceHudState();
      if (triggerId === "mission-1-chest") {
        EventBus.emit("mission-complete", {
          title: "MISSION COMPLETED",
          body: "The reliquary yielded. A hidden fire stirs beneath your ribs.",
          confirmText: "Press Enter to feel the inner flame."
        });
        return;
      }
      if (missionCleared) {
        if ((GameState.currentLevel ?? 1) === 1) {
          this.startLevel2();
        } else {
          this.endLevel1();
        }
      }
    };

    EventBus.on("slice-relic-collected", this.handleSliceRelicCollected, this);
    EventBus.on("slice-checkpoint-activated", this.handleSliceCheckpoint, this);
    EventBus.on("slice-exit-spawned", this.handleSliceExitSpawned, this);
    EventBus.on("slice-finished", this.handleSliceFinished, this);
    EventBus.on("mission-complete-confirmed", this.handleMissionCompleteConfirmed, this);
  }

  unregisterDemonHooks() {
    EventBus.off("enemy-killed", this.handleEnemyKilled, this);
    EventBus.off("player-damaged", this.handlePlayerDamaged, this);
    EventBus.off("player-died", this.handlePlayerDied, this);
    EventBus.off("chest-opened", this.handleChestOpened, this);
    EventBus.off("room-changed", this.handleRoomChanged, this);
    EventBus.off("demon-deal-response", this.handleDealResponse, this);
    EventBus.off("demon-choice-response", this.handleChoiceResponse, this);
    EventBus.off("gate-blocked", this.handleGateBlockedForDemon, this);
    EventBus.off("demon-state-updated", this.handleDemonState, this);
    EventBus.off("whisper-ask-requested", this.handleWhisperAskRequested, this);
    EventBus.off("whisper-directive-response", this.handleWhisperDirectiveResponse, this);
    EventBus.off("player-dashed", this.handlePlayerDashed, this);
  }

  unregisterSliceHooks() {
    EventBus.off("slice-relic-collected", this.handleSliceRelicCollected, this);
    EventBus.off("slice-checkpoint-activated", this.handleSliceCheckpoint, this);
    EventBus.off("slice-exit-spawned", this.handleSliceExitSpawned, this);
    EventBus.off("slice-finished", this.handleSliceFinished, this);
    EventBus.off("mission-complete-confirmed", this.handleMissionCompleteConfirmed, this);
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
      EventBus.emit("world-hint", `${deal.title}: fire storm empowered`);
      return;
    }

    if (deal.effect === "flight_boost") {
      this.moveBoostUntil = this.time.now + deal.durationMs;
      EventBus.emit("world-hint", `${deal.title}: speed surges`);
    }
  }

  applyWhisperChoiceEffect(result) {
    const effect = result?.option?.effect;
    if (!effect) return;
    if (effect === "embrace_gate") {
      this.auraBoostUntil = this.time.now + 12000;
      this.moveBoostUntil = this.time.now + 8000;
      this.triggerAmbushWave("whisper-embrace");
      EventBus.emit("world-hint", "Whisper pact sealed. Power floods your veins.");
      return;
    }
    if (effect === "resist_gate") {
      this.roomManager.spawnAmbushPack(Math.max(1, this.threatTier), "whisper-resist");
      EventBus.emit("world-hint", "You resisted. The world lashes back.");
      return;
    }
    if (effect === "embrace_low_health") {
      GameState.health = Math.min(GameState.maxHealth, GameState.health + 28);
      EventBus.emit("health-updated", GameState.health);
      this.auraBoostUntil = this.time.now + 10000;
      EventBus.emit("world-hint", "Blood covenant accepted. Vital restored.");
      return;
    }
    if (effect === "resist_low_health") {
      EventBus.emit("world-hint", "You clenched through the pain.");
      return;
    }
    if (effect === "embrace_streak") {
      this.moveBoostUntil = this.time.now + 9000;
      this.auraBoostUntil = this.time.now + 9000;
      this.triggerAmbushWave("whisper-feast");
      EventBus.emit("world-hint", "You fed the Whisper. The hunt escalates.");
      return;
    }
    if (effect === "resist_streak") {
      const healed = Math.min(GameState.maxHealth, GameState.health + 10);
      if (healed !== GameState.health) {
        GameState.health = healed;
        EventBus.emit("health-updated", GameState.health);
      }
      EventBus.emit("world-hint", "Voice denied. Your will hardens.");
    }
  }

  handleAskWhisperRequested() {
    const now = this.time.now;
    if (!this.isWhisperInteractive()) return;
    if (!this.canAskWhisper(now)) {
      const cooldownLeftMs = Math.max(0, this.lastDirectiveAskAt + ASK_WHISPER_COOLDOWN_MS - now);
      if (cooldownLeftMs > 0) {
        this.showHint(`Whisper watches... ${Math.ceil(cooldownLeftMs / 1000)}s`);
      }
      return;
    }
    this.offerWhisperDirective(now);
  }

  handleDirectiveResponse(payload) {
    if (!this.pendingDirective || !this.isWhisperInteractive()) return;
    const decision = payload?.decision === "obey" ? "obey" : "ignore";
    const now = this.time.now;
    const directive = this.pendingDirective;
    this.pendingDirective = null;
    this.lastDirectiveAskAt = now;

    if (decision === "ignore") {
      this.demonAgent.shiftCorruption(-1, now);
      this.showHint("You resist the Whisper. Power slips away.");
      EventBus.emit("whisper-directive-cleared");
      this.emitAskWhisperAvailability(true);
      return;
    }

    this.activeDirective = {
      ...directive,
      progress: 0,
      tookDamage: false,
      dashed: false,
      movingMs: 0,
      expiresAt: now + directive.timeLimitMs
    };
    EventBus.emit("whisper-directive-active", {
      title: directive.title,
      objective: directive.objective,
      progressText: this.getDirectiveProgressText(this.activeDirective),
      secondsLeft: Math.ceil(directive.timeLimitMs / 1000)
    });
    EventBus.emit("demon-whisper", { text: directive.whisper, event: "offer_power" });
    this.showHint(`Directive accepted: ${directive.objective}`);
    this.emitAskWhisperAvailability(true);
  }

  canAskWhisper(now) {
    if (!this.isWhisperInteractive()) return false;
    if (this.pendingDirective || this.activeDirective) return false;
    if (this.demonAgent?.hasPendingInteraction?.()) return false;
    return now - this.lastDirectiveAskAt >= ASK_WHISPER_COOLDOWN_MS;
  }

  offerWhisperDirective(now) {
    const corruption = this.demonAgent?.getState?.().corruption ?? 0;
    const stage = corruption >= 30 ? 2 : 1;
    const pool = WHISPER_DIRECTIVES.filter((directive) => directive.stage <= stage);
    if (!pool.length) return;
    const template = Phaser.Utils.Array.GetRandom(pool);
    this.pendingDirective = {
      ...template,
      instanceId: `${template.id}-${now}`
    };
    EventBus.emit("whisper-directive-offered", {
      id: this.pendingDirective.instanceId,
      title: this.pendingDirective.title,
      prompt: this.pendingDirective.prompt,
      objective: this.pendingDirective.objective,
      corruptionGain: this.pendingDirective.corruptionGain,
      rewardLabel: this.pendingDirective.reward?.label ?? "Unknown reward"
    });
    this.emitAskWhisperAvailability(true);
  }

  updateActiveDirective(now, delta, moving) {
    if (!this.activeDirective) return;
    if (now >= this.activeDirective.expiresAt) {
      this.failDirective("Time shattered. The Whisper is displeased.");
      return;
    }

    if (this.activeDirective.type === "keep_moving") {
      this.activeDirective.movingMs = moving ? this.activeDirective.movingMs + delta : 0;
      this.activeDirective.progress = this.activeDirective.movingMs;
      if (this.activeDirective.movingMs >= this.activeDirective.target) {
        this.completeDirective();
        return;
      }
      this.emitDirectiveProgressUpdate(now);
    }
  }

  onDirectiveEnemyKilled(now) {
    if (!this.activeDirective) return;
    const directive = this.activeDirective;

    if (directive.type === "kill_without_damage") {
      if (directive.tookDamage) return;
      directive.progress += 1;
      if (directive.progress >= directive.target) {
        this.completeDirective();
        return;
      }
      this.emitDirectiveProgressUpdate(now);
      return;
    }

    if (directive.type === "airborne_kill") {
      if (this.player?.isGrounded?.()) return;
      directive.progress += 1;
      if (directive.progress >= directive.target) {
        this.completeDirective();
        return;
      }
      this.emitDirectiveProgressUpdate(now);
      return;
    }

    if (directive.type === "kill_without_dash") {
      if (directive.dashed) return;
      directive.progress += 1;
      if (directive.progress >= directive.target) {
        this.completeDirective();
        return;
      }
      this.emitDirectiveProgressUpdate(now);
    }
  }

  onDirectivePlayerDamaged() {
    if (!this.activeDirective) return;
    this.activeDirective.tookDamage = true;
    if (this.activeDirective.type === "kill_without_damage") {
      this.failDirective("You bled. The directive is broken.");
    }
  }

  onDirectiveDashed() {
    if (!this.activeDirective) return;
    this.activeDirective.dashed = true;
    if (this.activeDirective.type === "kill_without_dash") {
      this.failDirective("You dashed. The Whisper wanted restraint.");
    }
  }

  completeDirective() {
    if (!this.activeDirective) return;
    const now = this.time.now;
    const directive = this.activeDirective;
    this.applyDirectiveReward(directive.reward, now);
    this.demonAgent.shiftCorruption(directive.corruptionGain, now, { forceWhisper: true });
    this.showHint(`Directive fulfilled: ${directive.reward?.label ?? "Power gained"}`);
    EventBus.emit("whisper-directive-cleared");
    this.clearActiveDirective();
    this.emitAskWhisperAvailability(true);
  }

  failDirective(message) {
    if (!this.activeDirective) return;
    this.demonAgent.shiftCorruption(1, this.time.now);
    this.showHint(message);
    EventBus.emit("whisper-directive-cleared");
    this.clearActiveDirective();
    this.emitAskWhisperAvailability(true);
  }

  clearActiveDirective() {
    this.activeDirective = null;
  }

  applyDirectiveReward(reward, now) {
    if (!reward) return;
    switch (reward.type) {
      case "heal":
        GameState.health = Math.min(GameState.maxHealth, GameState.health + (reward.amount ?? 0));
        EventBus.emit("health-updated", GameState.health);
        break;
      case "aura_charge":
        this.combat?.grantAuraCharge(reward.amount ?? 0.35);
        break;
      case "speed_boost":
        this.moveBoostUntil = Math.max(this.moveBoostUntil, now + (reward.amount ?? 0));
        break;
      case "aura_boost":
        this.auraBoostUntil = Math.max(this.auraBoostUntil, now + (reward.amount ?? 0));
        break;
      case "dual_boost":
        this.moveBoostUntil = Math.max(this.moveBoostUntil, now + (reward.amount ?? 0));
        this.auraBoostUntil = Math.max(this.auraBoostUntil, now + (reward.amount ?? 0));
        break;
      case "heal_and_charge":
        GameState.health = Math.min(GameState.maxHealth, GameState.health + (reward.amount ?? 0));
        EventBus.emit("health-updated", GameState.health);
        this.combat?.grantAuraCharge(0.35);
        break;
      default:
        break;
    }
  }

  emitDirectiveProgressUpdate(now) {
    if (!this.activeDirective) return;
    EventBus.emit("whisper-directive-active", {
      title: this.activeDirective.title,
      objective: this.activeDirective.objective,
      progressText: this.getDirectiveProgressText(this.activeDirective),
      secondsLeft: Math.max(0, Math.ceil((this.activeDirective.expiresAt - now) / 1000))
    });
  }

  getDirectiveProgressText(directive) {
    const cap = directive?.target ?? 0;
    if (directive?.type === "keep_moving") {
      const progressSec = ((directive.movingMs ?? 0) / 1000).toFixed(1);
      const goalSec = (cap / 1000).toFixed(1);
      return `${progressSec}s / ${goalSec}s`;
    }
    return `${directive?.progress ?? 0} / ${cap}`;
  }

  getWhisperCommandLabel(corruption = 0) {
    if (corruption >= 70) return "OBEY";
    if (corruption >= 30) return "LISTEN";
    return "ASK THE WHISPER";
  }

  emitAskWhisperAvailability(force = false) {
    const now = this.time?.now ?? 0;
    const corruption = this.demonAgent?.getState?.().corruption ?? 0;
    const available = this.canAskWhisper(now);
    const cooldownLeftMs = available ? 0 : Math.max(0, this.lastDirectiveAskAt + ASK_WHISPER_COOLDOWN_MS - now);
    const label = this.getWhisperCommandLabel(corruption);
    const key = `${available}|${label}|${Math.ceil(cooldownLeftMs / 1000)}|${this.activeDirective?.instanceId ?? ""}|${this.pendingDirective?.instanceId ?? ""}`;
    if (!force && key === this.lastAskAvailabilityKey) return;
    this.lastAskAvailabilityKey = key;
    EventBus.emit("whisper-ask-availability", {
      available,
      cooldownLeftMs,
      label,
      activeDirective: this.activeDirective
        ? {
            title: this.activeDirective.title,
            objective: this.activeDirective.objective,
            progressText: this.getDirectiveProgressText(this.activeDirective),
            secondsLeft: Math.max(0, Math.ceil((this.activeDirective.expiresAt - now) / 1000))
          }
        : null
    });
  }

  onCorruptionStateUpdated(state) {
    const corruption = state?.corruption ?? 0;
    GameState.demon = { ...state };
    this.roomManager.setCorruptionState(corruption);
    const tier = this.getCorruptionTier(corruption);
    if (tier !== this.corruptionTier) {
      this.corruptionTier = tier;
      if (tier > 0) {
        this.showHint(`Corruption Tier ${tier}: the rooms are mutating.`);
      } else {
        this.showHint("Corruption subsides. The world steadies.");
      }
    }
    this.emitAskWhisperAvailability();
  }

  getCorruptionTier(corruption = 0) {
    if (corruption >= CORRUPTION_TIER3) return 3;
    if (corruption >= CORRUPTION_TIER2) return 2;
    if (corruption >= CORRUPTION_TIER1) return 1;
    return 0;
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
    const currentRoomId = roomId ?? GameState.currentRoomId;
    const inReliquary = currentRoomId === "crypt";
    const inSanctum = currentRoomId === "sanctum";
    const seraphSlain = Boolean(
      GameState.isRoomEnemyDefeated("sanctum", "sanctum-seraph-1") || slice.relicDropped || slice.hasRelic
    );
    const cryptAngelKillCount = [
      "crypt-angel-1",
      "crypt-angel-2",
      "crypt-angel-3"
    ].filter((enemyId) => GameState.isRoomEnemyDefeated("crypt", enemyId)).length;
    const killAngelDone = seraphSlain;
    const findRelicDone = Boolean(slice.hasRelic);
    const extractionReady = Boolean(this.abilitySystem.has(ABILITY_IDS.FLAME_RING));
    let phase = "FIND THE POWER";
    let objective = "Find the gate to the next room.";
    let checklistText = "[ ] Reach Next Room";

    if (slice.completed) {
      phase = "SEAL BROKEN";
      objective = "Mission 1 complete. Push deeper into the world.";
    } else if (inSanctum && !seraphSlain) {
      phase = "FALLEN SERAPH";
      objective = "Defeat the Fallen Seraph in the sanctum.";
      checklistText = `${GameState.isRoomEnemyDefeated("sanctum", "sanctum-seraph-1") ? "[V]" : "[ ]"} Slay Fallen Seraph`;
    } else if (!slice.hasRelic) {
      phase = "FIND THE POWER";
      if (inReliquary && !slice.relicDropped) {
        objective = "Defeat all 3 angels in Sealed Reliquary.";
        checklistText = `${cryptAngelKillCount >= 3 ? "[V]" : "[ ]"} Defeat 3 Angels (${cryptAngelKillCount}/3)`;
      } else if (slice.relicDropped) {
        objective = "Claim the relic dropped by the Fallen Seraph.";
        checklistText = "[V] Slay Fallen Seraph   [ ] Claim Relic";
      } else {
        objective = "Find the gate to the next room.";
        checklistText = "[ ] Reach Next Room";
      }
    } else {
      phase = "RETURN TO C";
      objective = "Return to Room C and open the huge chest with the relic.";
      checklistText = "[V] Claim Relic   [ ] Open Huge Chest (Room C)";
    }

    EventBus.emit("slice-objective-updated", {
      objective,
      phase,
      roomId
    });
    EventBus.emit("slice-objectives-updated", {
      killAngelDone,
      findRelicDone,
      extractionReady,
      checklistText,
      roomId
    });
  }

  handleEnemyDefeated(payload) {
    const now = this.time.now;
    this.enemiesDefeated += 1;
    this.killCombo = now <= this.comboExpiresAt ? this.killCombo + 1 : 1;
    this.comboExpiresAt = now + COMBO_WINDOW_MS;

    const auraCharge = Phaser.Math.Clamp(0.05 + this.killCombo * 0.02, 0.05, 0.2);
    this.combat?.grantAuraCharge(auraCharge);
    if (this.killCombo >= 3) {
      const healAmount = Math.min(8, 1 + Math.floor(this.killCombo / 2));
      const healed = Math.min(GameState.maxHealth, GameState.health + healAmount);
      if (healed !== GameState.health) {
        GameState.health = healed;
        EventBus.emit("health-updated", GameState.health);
      }
      if (this.killCombo === 3 || this.killCombo % 4 === 0) {
        this.showHint(`Combo x${this.killCombo}! Vital siphon +${healAmount}`);
      }
    }

    const expectedTier = Phaser.Math.Clamp(
      1 + Math.floor(this.enemiesDefeated / THREAT_KILL_STEP),
      1,
      MAX_THREAT_TIER
    );
    if (expectedTier > this.threatTier) {
      this.threatTier = expectedTier;
      this.showHint(`Threat rising: Tier ${this.threatTier}`);
    }
    this.emitGameplayLoopHud();

    if (this.killCombo >= 5 && this.isWhisperInteractive()) {
      this.demonAgent.onEvent("kill_streak", now);
    }
    if (this.killCombo >= 6 && now + 500 > this.nextAmbushAt) {
      this.triggerAmbushWave("combo");
    }

    if (payload?.enemyType === "angel" && this.threatTier >= 2 && Math.random() < 0.45) {
      this.triggerAmbushWave("angel-fall");
    }
  }

  updateDynamicChallenge(now) {
    if (GameState.slice?.completed || this.levelEnding) return;

    if (this.killCombo > 0 && now > this.comboExpiresAt) {
      this.killCombo = 0;
      this.emitGameplayLoopHud();
    }

    if (now < this.nextAmbushAt) return;
    const aliveEnemies = this.roomManager.getCurrentRoomEnemyCount();
    const aliveCap = 3 + this.threatTier;
    if (aliveEnemies < aliveCap) {
      this.triggerAmbushWave("timer");
      return;
    }
    this.nextAmbushAt = now + Math.round(this.getAmbushIntervalMs() * 0.6);
    this.emitGameplayLoopHud();
  }

  triggerAmbushWave(source = "timer") {
    if (GameState.slice?.completed || this.levelEnding) return;
    const spawned = this.roomManager.spawnAmbushPack(this.threatTier, source);
    this.nextAmbushAt = this.time.now + this.getAmbushIntervalMs();
    if (spawned > 0) {
      const sourceText = source === "timer" ? "Shadows gather." : "Hostiles surge!";
      this.showHint(`${sourceText} Ambush x${spawned}`);
    }
    this.emitGameplayLoopHud();
  }

  getAmbushIntervalMs() {
    const tierReduction = (this.threatTier - 1) * AMBUSH_INTERVAL_STEP_MS;
    const levelReduction = ((GameState.currentLevel ?? 1) - 1) * 2200;
    return Math.max(AMBUSH_INTERVAL_MIN_MS, AMBUSH_INTERVAL_BASE_MS - tierReduction - levelReduction);
  }

  emitGameplayLoopHud() {
    EventBus.emit("gameplay-loop-updated", {
      killCombo: this.killCombo,
      comboLeftMs: Math.max(0, this.comboExpiresAt - this.time.now),
      enemiesDefeated: this.enemiesDefeated,
      threatTier: this.threatTier,
      nextAmbushMs: Math.max(0, this.nextAmbushAt - this.time.now)
    });
  }

  startWhisperAwakeningSequence() {
    if (GameState.whisperAwakened) return;
    GameState.whisperAwakened = true;
    EventBus.emit("whisper-awakened");
    this.demonAgent.awakenWhisper(12);
    this.demonAgent.setNarrationLocked(true);
    let lineIndex = 0;
    const speakNextLine = () => {
      if (!this.scene.isActive("game")) return;
      if (lineIndex >= WHISPER_INTRO_LINES.length) {
        GameState.whisperIntroComplete = true;
        this.demonAgent.setNarrationLocked(false);
        this.demonAgent.onEvent("room_entered", this.time.now, { roomId: GameState.currentRoomId });
        this.emitAskWhisperAvailability(true);
        return;
      }

      EventBus.emit("demon-whisper", WHISPER_INTRO_LINES[lineIndex]);
      lineIndex += 1;
      this.time.delayedCall(WHISPER_INTRO_LINE_GAP_MS, speakNextLine);
    };

    this.time.delayedCall(WHISPER_INTRO_START_DELAY_MS, speakNextLine);
  }

  isWhisperInteractive() {
    return Boolean(GameState.whisperAwakened && GameState.whisperIntroComplete);
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
    this.pendingDirective = null;
    this.clearActiveDirective();
    this.controller?.setSpeedMultiplier(0);
    this.player?.setVelocity(0, 0);
    this.time.delayedCall(900, () => {
      if (!this.scene.isActive("game")) return;
      this.scene.stop("ui");
      this.scene.start("menu");
    });
  }

  startLevel2() {
    if (this.levelEnding) return;
    this.levelEnding = true;
    this.pendingDirective = null;
    this.clearActiveDirective();

    this.controller?.setSpeedMultiplier(0);
    this.player?.setVelocity(0, 0);

    this.time.delayedCall(LEVEL_TRANSITION_DELAY_MS, () => {
      if (!this.scene.isActive("game")) return;

      GameState.currentLevel = 2;
      GameState.resetSliceProgress();
      GameState.health = GameState.maxHealth;

      this.moveBoostUntil = 0;
      this.auraBoostUntil = 0;
      this.runCompletedAt = 0;
      this.levelEnding = false;
      this.killCombo = 0;
      this.comboExpiresAt = 0;
      this.enemiesDefeated = 0;
      this.threatTier = 2;
      this.nextAmbushAt = this.time.now + this.getAmbushIntervalMs();

      EventBus.emit("health-updated", GameState.health);
      this.roomManager.buildRoom(GameState.currentRoomId, GameState.playerSpawnKey);
      this.emitSliceHudState(GameState.currentRoomId);
      this.emitGameplayLoopHud();
      this.showHint("Level 2 begins. The Whisper deepens.");
      this.demonAgent.onEvent("room_entered", this.time.now, { roomId: GameState.currentRoomId });
    });
  }
}
