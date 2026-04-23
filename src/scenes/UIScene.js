import Phaser from "phaser";
import { EventBus } from "../core/EventBus";
import { GameState } from "../core/GameState";
import { WhisperVoice } from "../systems/WhisperVoice";
import { ABILITY_IDS } from "../data/abilities";

const HUD_Z = 2000;
const HEALTH_ORB_X = 48;
const HEALTH_ORB_Y = 58;
const HEALTH_ORB_R = 24;
const HEALTH_BAR_X = 84;
const HEALTH_BAR_Y = 48;
const HEALTH_BAR_W = 220;
const HEALTH_BAR_H = 20;

const COIN_ORB_X = 668;
const COIN_ORB_Y = 58;
const COIN_ORB_R = 23;
const COIN_BAR_X = 703;
const COIN_BAR_Y = 48;
const COIN_BAR_W = 220;
const COIN_BAR_H = 20;

const AURA_ORB_X = 358;
const AURA_ORB_Y = 58;
const AURA_ORB_R = 22;
const AURA_BAR_X = 392;
const AURA_BAR_Y = 48;
const AURA_BAR_W = 220;
const AURA_BAR_H = 20;
const FIRE_STORM_LABEL = "FIRE STORM";
const RESOURCE_LABEL_Y = 24;
const RESOURCE_LABEL_FONT_SIZE = "18px";
const CORRUPTION_BAR_X = 286;
const CORRUPTION_BAR_Y = 14;
const CORRUPTION_BAR_W = 388;
const CORRUPTION_BAR_H = 12;

const HUD_FONT = "'PICKYSIDE', serif";
const HUD_ACCENT_FONT = "'PICKYSIDE', serif";
const WHISPER_SENTENCE_BREAK_MS = 1000;
const WHISPER_FADE_OUT_MS = 220;
const MAP_X = 12;
const MAP_Y = 116;
const MAP_ROOM_W = 18;
const MAP_ROOM_H = 14;
const MAP_ROOM_GAP = 13;

const ROOM_LABELS = {
  start: "A",
  shaft: "B",
  crypt: "C",
  sanctum: "D"
};

export class UIScene extends Phaser.Scene {
  constructor() {
    super("ui");
    this.hintTimer = null;
    this.auraState = "ready";
    this.auraCharge = 1;
    this.healthTargetPct = 1;
    this.displayHealthPct = 1;
    this.delayedHealthPct = 1;
    this.corruption = 0;
    this.dominance = 0;
    this.activeOffer = null;
    this.activeChoice = null;
    this.whisperTimer = null;
    this.whisperActive = false;
    this.whisperQueue = [];
    this.overlayTargetAlpha = 0;
    this.overlayPulse = 0;
    this.whisperVoice = null;
    this.askWhisperAvailable = false;
    this.askWhisperCooldownMs = 0;
    this.askWhisperLabel = "ASK THE WHISPER";
    this.activeDirectiveOffer = null;
    this.activeDirectiveState = null;
    this.handleGateBlocked = (payload) => {
      const ability = this.formatAbilityLabel(payload?.requiredAbility);
      this.showHint(`Path sealed. Need ${ability}.`);
    };
    this.handleDemonStateUpdated = (state) => this.onDemonStateUpdated(state);
    this.handleDemonWhisper = (payload) => this.showWhisper(payload);
    this.handleDemonOffer = (deal) => this.showDeal(deal);
    this.handleSliceObjectiveUpdated = (payload) => this.onSliceObjectiveUpdated(payload);
    this.handleSliceObjectivesUpdated = (payload) => this.onSliceObjectivesUpdated(payload);
    this.handleWhisperAwakened = () => this.onWhisperAwakened();
    this.handleRoomChangedLabel = (roomId) => this.onRoomChangedLabel(roomId);
    this.handleGameplayLoopUpdated = (payload) => this.onGameplayLoopUpdated(payload);
    this.handleAbilityUnlocked = (ability) => this.onAbilityUnlocked(ability);
    this.handleWhisperChoice = (choice) => this.showWhisperChoice(choice);
    this.handleWhisperAskAvailability = (payload) => this.onWhisperAskAvailability(payload);
    this.handleWhisperDirectiveOffered = (payload) => this.showWhisperDirectiveOffer(payload);
    this.handleWhisperDirectiveActive = (payload) => this.onWhisperDirectiveActive(payload);
    this.handleWhisperDirectiveCleared = () => this.clearWhisperDirectiveUi();
    this.handlePlayerDiedHud = (payload) => this.showDeathWindow(payload);
    this.handleMissionCompletedHud = (payload) => this.showMissionCompleteWindow(payload);
    this.deathAwaitingConfirm = false;
    this.missionCompleteAwaitingConfirm = false;
    this.modalPausedGame = false;
    this.killCombo = 0;
    this.threatTier = 1;
    this.nextAmbushMs = 0;
    this.enemiesDefeated = 0;
  }

  create() {
    this.createOrnateFrameLayer();
    this.createHealthLayer();
    this.createCoinLayer();
    this.createAuraLayer();
    this.createHintLayer();
    this.createSliceLayer();
    this.createDemonLayer();
    this.whisperVoice = new WhisperVoice();

    EventBus.on("room-changed", this.refresh, this);
    EventBus.on("room-changed", this.handleRoomChangedLabel, this);
    EventBus.on("coins-updated", this.refresh, this);
    EventBus.on("health-updated", this.onHealthUpdated, this);
    EventBus.on("aura-updated", this.onAuraUpdated, this);
    EventBus.on("world-hint", this.showHint, this);
    EventBus.on("gate-blocked", this.handleGateBlocked, this);
    EventBus.on("demon-state-updated", this.handleDemonStateUpdated, this);
    EventBus.on("demon-whisper", this.handleDemonWhisper, this);
    EventBus.on("demon-offer", this.handleDemonOffer, this);
    EventBus.on("whisper-awakened", this.handleWhisperAwakened, this);
    EventBus.on("slice-objective-updated", this.handleSliceObjectiveUpdated, this);
    EventBus.on("slice-objectives-updated", this.handleSliceObjectivesUpdated, this);
    EventBus.on("gameplay-loop-updated", this.handleGameplayLoopUpdated, this);
    EventBus.on("ability-unlocked", this.handleAbilityUnlocked, this);
    EventBus.on("demon-choice-offered", this.handleWhisperChoice, this);
    EventBus.on("whisper-ask-availability", this.handleWhisperAskAvailability, this);
    EventBus.on("whisper-directive-offered", this.handleWhisperDirectiveOffered, this);
    EventBus.on("whisper-directive-active", this.handleWhisperDirectiveActive, this);
    EventBus.on("whisper-directive-cleared", this.handleWhisperDirectiveCleared, this);
    EventBus.on("player-died", this.handlePlayerDiedHud, this);
    EventBus.on("mission-complete", this.handleMissionCompletedHud, this);
    this.events.on("shutdown", this.cleanup, this);

    this.refresh();
    this.onAuraUpdated({ state: "ready", charge: 1, cooldownLeftMs: 0, activeLeftMs: 0 });
  }

  createOrnateFrameLayer() {
    const g = this.add.graphics().setScrollFactor(0).setDepth(HUD_Z);

    this.drawOrnateOrbFrame(g, HEALTH_ORB_X, HEALTH_ORB_Y, HEALTH_ORB_R, 0xff5a3a);
    this.drawPointedBarFrame(g, HEALTH_BAR_X, HEALTH_BAR_Y, HEALTH_BAR_W, HEALTH_BAR_H, 0x7a3b25);
    this.drawOrnateOrbFrame(g, AURA_ORB_X, AURA_ORB_Y, AURA_ORB_R, 0xff7043);
    this.drawPointedBarFrame(g, AURA_BAR_X, AURA_BAR_Y, AURA_BAR_W, AURA_BAR_H, 0x8a4d2d);

    this.drawOrnateOrbFrame(g, COIN_ORB_X, COIN_ORB_Y, COIN_ORB_R, 0xffa041);
    this.drawPointedBarFrame(g, COIN_BAR_X, COIN_BAR_Y, COIN_BAR_W, COIN_BAR_H, 0xa7652f);
  }

  drawOrnateOrbFrame(g, x, y, r, glow) {
    g.fillStyle(0x130b0a, 0.95);
    g.fillCircle(x, y, r + 8);
    g.lineStyle(3, 0x2b1713, 1);
    g.strokeCircle(x, y, r + 7);
    g.lineStyle(2, 0x6a3525, 0.9);
    g.strokeCircle(x, y, r + 4);
    g.fillStyle(glow, 0.18);
    g.fillCircle(x, y, r + 4);
  }

  drawHornAccent(g, x, y, color) {
    // Intentionally empty: horn/triangle accents removed per HUD style update.
  }

  drawPointedBarFrame(g, x, y, w, h, accent) {
    g.fillStyle(0x100807, 0.94);
    g.fillRoundedRect(x, y, w, h, 8);

    g.lineStyle(2, 0x2f1a14, 1);
    g.strokeRoundedRect(x, y, w, h, 8);
    g.lineStyle(2, accent, 0.9);
    g.strokeRoundedRect(x, y, w, h, 8);
  }

  createHealthLayer() {
    this.healthOrbBack = this.add.graphics().setScrollFactor(0).setDepth(HUD_Z + 1);
    this.healthTrack = this.add.graphics().setScrollFactor(0).setDepth(HUD_Z + 1);
    this.healthDelayed = this.add.graphics().setScrollFactor(0).setDepth(HUD_Z + 2);
    this.healthFill = this.add.graphics().setScrollFactor(0).setDepth(HUD_Z + 3);
    this.healthGloss = this.add.graphics().setScrollFactor(0).setDepth(HUD_Z + 4);
    this.healthLabel = this.add
      .text(HEALTH_BAR_X + 10, RESOURCE_LABEL_Y, "VITAL", {
        fontFamily: HUD_FONT,
        fontSize: RESOURCE_LABEL_FONT_SIZE,
        color: "#f3b26f",
        letterSpacing: 1.2
      })
      .setScrollFactor(0)
      .setDepth(HUD_Z + 4)
      .setResolution(2);
    this.healthLabel.setLetterSpacing(1.8);

    this.healthValue = this.add
      .text(HEALTH_BAR_X + 10, HEALTH_BAR_Y + HEALTH_BAR_H * 0.5, "100 / 100", {
        fontFamily: HUD_ACCENT_FONT,
        fontSize: "24px",
        color: "#ffd88e",
        stroke: "#3e1f12",
        strokeThickness: 1
      })
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(HUD_Z + 5)
      .setResolution(2);
    this.healthValue.setLetterSpacing(0.5);
    this.healthValue.setShadow(0, 1, "#1f120c", 2, true, true);

    this.healthFlameGlyph = this.add
      .image(HEALTH_ORB_X, HEALTH_ORB_Y + 2, "fx-flame")
      .setScrollFactor(0)
      .setDepth(HUD_Z + 5)
      .setScale(1.0)
      .setTint(0xff9147);

    this.healthFlameMaskGraphics = this.add.graphics().setScrollFactor(0).setDepth(HUD_Z + 2);
    this.healthFlameMaskGraphics.visible = false;
    this.healthFlameMask = this.healthFlameMaskGraphics.createGeometryMask();

    this.healthFlame = this.add.particles(0, 0, "fx-ember", {
      lifespan: { min: 180, max: 500 },
      frequency: 18,
      quantity: 2,
      speedX: { min: -18, max: 22 },
      speedY: { min: -130, max: -35 },
      scale: { start: 1.9, end: 0 },
      alpha: { start: 0.8, end: 0 },
      tint: [0xff3a2a, 0xff6a37, 0xffab52, 0xffe5ab],
      blendMode: "ADD",
      emitZone: {
        source: new Phaser.Geom.Rectangle(HEALTH_BAR_X + 2, HEALTH_BAR_Y + 9, HEALTH_BAR_W - 4, 7),
        type: "random"
      }
    });
    this.healthFlame.setScrollFactor(0);
    this.healthFlame.setDepth(HUD_Z + 3);
    this.healthFlame.setMask(this.healthFlameMask);
  }

  createCoinLayer() {
    this.coinOrbBack = this.add.graphics().setScrollFactor(0).setDepth(HUD_Z + 1);
    this.coinLabel = this.add
      .text(COIN_BAR_X + 12, RESOURCE_LABEL_Y, "TREASURE", {
        fontFamily: HUD_FONT,
        fontSize: RESOURCE_LABEL_FONT_SIZE,
        color: "#f2bf72",
        letterSpacing: 1.1
      })
      .setScrollFactor(0)
      .setDepth(HUD_Z + 4)
      .setResolution(2);
    this.coinLabel.setLetterSpacing(1.8);

    this.coinIcon = this.add
      .image(COIN_ORB_X, COIN_ORB_Y, "fx-gold")
      .setScale(1.45)
      .setTint(0xffc15d)
      .setScrollFactor(0)
      .setDepth(HUD_Z + 5);

    this.coinsText = this.add
      .text(COIN_BAR_X + 12, COIN_BAR_Y + COIN_BAR_H * 0.5, "0", {
        fontFamily: HUD_ACCENT_FONT,
        fontSize: "24px",
        color: "#ffcf73",
        stroke: "#4e2f13",
        strokeThickness: 1
      })
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(HUD_Z + 5)
      .setResolution(2);
    this.coinsText.setLetterSpacing(0.5);
    this.coinsText.setShadow(0, 1, "#24170d", 2, true, true);
  }

  createAuraLayer() {
    this.auraTrack = this.add.graphics().setScrollFactor(0).setDepth(HUD_Z + 1);
    this.auraFill = this.add.graphics().setScrollFactor(0).setDepth(HUD_Z + 3);
    this.auraGloss = this.add.graphics().setScrollFactor(0).setDepth(HUD_Z + 4);
    this.auraOrbBack = this.add.graphics().setScrollFactor(0).setDepth(HUD_Z + 1);
    this.auraGlyph = this.add
      .image(AURA_ORB_X, AURA_ORB_Y + 2, "fx-flame")
      .setScale(1.02)
      .setTint(0xffbf73)
      .setScrollFactor(0)
      .setDepth(HUD_Z + 5);

    this.auraStateText = this.add
      .text(AURA_BAR_X + AURA_BAR_W - 8, AURA_BAR_Y + 1, "READY", {
        fontFamily: HUD_ACCENT_FONT,
        fontSize: "16px",
        color: "#f6c17a"
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(HUD_Z + 5)
      .setResolution(2);
    this.auraStateText.setLetterSpacing(0.6);
    this.auraStateText.setShadow(0, 1, "#1e120c", 2, true, true);

    this.auraSubText = this.add
      .text(AURA_BAR_X + 8, RESOURCE_LABEL_Y, FIRE_STORM_LABEL, {
        fontFamily: HUD_FONT,
        fontSize: RESOURCE_LABEL_FONT_SIZE,
        color: "#f1b875",
        letterSpacing: 1.1
      })
      .setScrollFactor(0)
      .setDepth(HUD_Z + 5)
      .setResolution(2);
    this.auraSubText.setLetterSpacing(1.2);
  }

  createHintLayer() {
    this.hintText = this.add
      .text(this.scale.width * 0.5, this.scale.height - 32, "", {
        fontFamily: HUD_FONT,
        fontSize: "28px",
        color: "#ffe4b7",
        backgroundColor: "#190f0ccc",
        stroke: "#6f4124",
        strokeThickness: 1,
        padding: { x: 12, y: 7 }
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(HUD_Z + 20)
      .setResolution(2)
      .setVisible(false);

    this.abilityUnlockText = this.add
      .text(this.scale.width * 0.5, this.scale.height * 0.34, "", {
        fontFamily: HUD_FONT,
        fontSize: "46px",
        color: "#ffd7a1",
        stroke: "#2d160f",
        strokeThickness: 4,
        backgroundColor: "#120b09cc",
        padding: { x: 16, y: 8 }
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(HUD_Z + 25)
      .setResolution(2)
      .setAlpha(0)
      .setVisible(false);

    this.deathBackdrop = this.add
      .rectangle(this.scale.width * 0.5, this.scale.height * 0.5, this.scale.width, this.scale.height, 0x040000)
      .setAlpha(0)
      .setVisible(false)
      .setScrollFactor(0)
      .setDepth(HUD_Z + 40);
    this.deathPanel = this.add
      .rectangle(this.scale.width * 0.5, this.scale.height * 0.5, 640, 220, 0x0a0000)
      .setStrokeStyle(2, 0x8f1414, 0.95)
      .setAlpha(0)
      .setScale(0.94)
      .setVisible(false)
      .setScrollFactor(0)
      .setDepth(HUD_Z + 41);
    this.deathTitle = this.add
      .text(this.scale.width * 0.5, this.scale.height * 0.5 - 46, "THE ABYSS\nHAS CLAIMED YOU", {
        fontFamily: "'Simbiot', serif",
        fontSize: "26px",
        color: "#de3d3d",
        stroke: "#1a0000",
        strokeThickness: 3,
        align: "center",
        lineSpacing: 4,
        wordWrap: { width: 560 }
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setVisible(false)
      .setScrollFactor(0)
      .setDepth(HUD_Z + 42)
      .setResolution(2);
    this.deathTitle.setShadow(0, 3, "#220000", 12, true, true);
    this.deathSubtext = this.add
      .text(this.scale.width * 0.5, this.scale.height * 0.5 + 24, "Rise again where blood was spilled.", {
        fontFamily: HUD_FONT,
        fontSize: "24px",
        color: "#e6b8b8",
        stroke: "#160000",
        strokeThickness: 2,
        align: "center"
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setVisible(false)
      .setScrollFactor(0)
      .setDepth(HUD_Z + 42)
      .setResolution(2);
    this.deathConfirmText = this.add
      .text(this.scale.width * 0.5, this.scale.height * 0.5 + 76, "Press Enter to rise.", {
        fontFamily: HUD_FONT,
        fontSize: "22px",
        color: "#f2d0d0",
        stroke: "#140000",
        strokeThickness: 2,
        align: "center"
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setVisible(false)
      .setScrollFactor(0)
      .setDepth(HUD_Z + 42)
      .setResolution(2);
    this.missionCompleteBackdrop = this.add
      .rectangle(this.scale.width * 0.5, this.scale.height * 0.5, this.scale.width, this.scale.height, 0x040000)
      .setAlpha(0)
      .setVisible(false)
      .setScrollFactor(0)
      .setDepth(HUD_Z + 40);
    this.missionCompletePanel = this.add
      .rectangle(this.scale.width * 0.5, this.scale.height * 0.5, 700, 240, 0x090201)
      .setStrokeStyle(2, 0xc46d2b, 0.96)
      .setAlpha(0)
      .setScale(0.94)
      .setVisible(false)
      .setScrollFactor(0)
      .setDepth(HUD_Z + 41);
    this.missionCompleteTitle = this.add
      .text(this.scale.width * 0.5, this.scale.height * 0.5 - 54, "MISSION COMPLETED", {
        fontFamily: "'Simbiot', serif",
        fontSize: "28px",
        color: "#f4b56a",
        stroke: "#241008",
        strokeThickness: 3,
        align: "center",
        wordWrap: { width: 600 }
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setVisible(false)
      .setScrollFactor(0)
      .setDepth(HUD_Z + 42)
      .setResolution(2);
    this.missionCompleteTitle.setShadow(0, 3, "#120704", 10, true, true);
    this.missionCompleteSubtext = this.add
      .text(
        this.scale.width * 0.5,
        this.scale.height * 0.5 + 12,
        "The reliquary yielded. A hidden fire stirs beneath your ribs.",
        {
          fontFamily: HUD_FONT,
          fontSize: "24px",
          color: "#f0d2b1",
          stroke: "#1a0804",
          strokeThickness: 2,
          align: "center",
          wordWrap: { width: 600 }
        }
      )
      .setOrigin(0.5)
      .setAlpha(0)
      .setVisible(false)
      .setScrollFactor(0)
      .setDepth(HUD_Z + 42)
      .setResolution(2);
    this.missionCompleteConfirmText = this.add
      .text(this.scale.width * 0.5, this.scale.height * 0.5 + 84, "Press Enter to feel the inner flame.", {
        fontFamily: HUD_FONT,
        fontSize: "22px",
        color: "#ffdcb8",
        stroke: "#180804",
        strokeThickness: 2,
        align: "center"
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setVisible(false)
      .setScrollFactor(0)
      .setDepth(HUD_Z + 42)
      .setResolution(2);
    this.deathConfirmKey = this.input.keyboard.addKey("ENTER");
  }

  createSliceLayer() {
    this.minimapGraphics = this.add.graphics().setScrollFactor(0).setDepth(HUD_Z + 13);
    this.minimapLabel = this.add
      .text(12, 92, "ROOM: A B C D", {
        fontFamily: HUD_FONT,
        fontSize: "14px",
        color: "#d7b891"
      })
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(HUD_Z + 14)
      .setResolution(2);
    this.minimapLabel.setLetterSpacing(1);

    this.sliceObjectiveText = this.add
      .text(this.scale.width * 0.5, 104, "Find the gate to the next room.", {
        fontFamily: HUD_ACCENT_FONT,
        fontSize: "30px",
        color: "#ffe2bf",
        stroke: "#2a1712",
        strokeThickness: 1,
        wordWrap: { width: this.scale.width * 0.72 }
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(HUD_Z + 14)
      .setResolution(2);

    this.sliceChecklistText = this.add
      .text(this.scale.width * 0.5, 132, "[ ] Reach Next Room", {
        fontFamily: HUD_FONT,
        fontSize: "24px",
        color: "#f0cfab",
        stroke: "#2a1712",
        strokeThickness: 1,
        wordWrap: { width: this.scale.width * 0.68 }
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(HUD_Z + 14)
      .setResolution(2);

    this.extractPromptText = this.add
      .text(this.scale.width * 0.5, 156, "Objectives complete. Extract.", {
        fontFamily: HUD_ACCENT_FONT,
        fontSize: "22px",
        color: "#ffd992",
        stroke: "#2a1712",
        strokeThickness: 1
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(HUD_Z + 15)
      .setResolution(2)
      .setVisible(false);

  }

  createDemonLayer() {
    this.corruptionTrack = this.add.graphics().setScrollFactor(0).setDepth(HUD_Z + 6);
    this.corruptionFill = this.add.graphics().setScrollFactor(0).setDepth(HUD_Z + 7);
    this.corruptionLabel = this.add
      .text(CORRUPTION_BAR_X, CORRUPTION_BAR_Y - 14, "THE WHISPER", {
        fontFamily: HUD_FONT,
        fontSize: "20px",
        color: "#d8a0a0"
      })
      .setScrollFactor(0)
      .setDepth(HUD_Z + 7)
      .setResolution(2);

    this.whisperText = this.add
      .text(this.scale.width * 0.5, this.scale.height - 74, "", {
        fontFamily: "'Simbiot', serif",
        fontSize: "20px",
        color: "#e5c9c9",
        stroke: "#170b0b",
        strokeThickness: 2,
        align: "center",
        lineSpacing: 8,
        wordWrap: { width: this.scale.width * 0.78 }
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setScrollFactor(0)
      .setDepth(HUD_Z + 21)
      .setResolution(2);

    this.demonOverlay = this.add
      .rectangle(this.scale.width * 0.5, this.scale.height * 0.5, this.scale.width, this.scale.height, 0x2a0505)
      .setAlpha(0)
      .setScrollFactor(0)
      .setDepth(HUD_Z - 1);

    this.dealBackdrop = this.add
      .rectangle(this.scale.width * 0.5, this.scale.height * 0.5, this.scale.width, this.scale.height, 0x000000)
      .setAlpha(0.18)
      .setVisible(false)
      .setScrollFactor(0)
      .setDepth(HUD_Z + 30);
    this.dealPanelGlow = this.add
      .rectangle(this.scale.width * 0.5, this.scale.height * 0.5, 600, 240, 0x2d0911)
      .setAlpha(0.2)
      .setVisible(false)
      .setScrollFactor(0)
      .setDepth(HUD_Z + 31)
      .setBlendMode("ADD");
    this.dealPanel = this.add
      .rectangle(this.scale.width * 0.5, this.scale.height * 0.5, 580, 230, 0x080407)
      .setAlpha(0.72)
      .setStrokeStyle(2, 0x6f2d39, 0.95)
      .setVisible(false)
      .setScrollFactor(0)
      .setDepth(HUD_Z + 32);
    this.dealPanelInner = this.add
      .rectangle(this.scale.width * 0.5, this.scale.height * 0.5, 556, 202, 0x11060d)
      .setAlpha(0.55)
      .setStrokeStyle(1, 0x2b1118, 0.95)
      .setVisible(false)
      .setScrollFactor(0)
      .setDepth(HUD_Z + 33);
    this.dealTitle = this.add
      .text(this.scale.width * 0.5, this.scale.height * 0.5 - 62, "", {
        fontFamily: "'Simbiot', serif",
        fontSize: "22px",
        color: "#f8c7d3",
        align: "center",
        wordWrap: { width: 520 }
      })
      .setOrigin(0.5)
      .setVisible(false)
      .setScrollFactor(0)
      .setDepth(HUD_Z + 34)
      .setResolution(2);
    this.dealTitle.setShadow(0, 2, "#1b090d", 8, true, true);
    this.dealTitle.setLetterSpacing(0.5);
    this.dealDesc = this.add
      .text(this.scale.width * 0.5, this.scale.height * 0.5 - 4, "", {
        fontFamily: "'Simbiot', serif",
        fontSize: "17px",
        color: "#eed5db",
        align: "center",
        wordWrap: { width: 510 },
        lineSpacing: 4
      })
      .setOrigin(0.5)
      .setVisible(false)
      .setScrollFactor(0)
      .setDepth(HUD_Z + 34)
      .setResolution(2);
    this.dealDesc.setShadow(0, 1, "#14070b", 5, true, true);
    this.dealActions = this.add
      .text(this.scale.width * 0.5, this.scale.height * 0.5 + 70, "[E] EMBRACE    [R] REFUSE", {
        fontFamily: "'Simbiot', serif",
        fontSize: "18px",
        color: "#ff9fae"
      })
      .setOrigin(0.5)
      .setVisible(false)
      .setScrollFactor(0)
      .setDepth(HUD_Z + 35)
      .setResolution(2);
    this.dealActions.setShadow(0, 1, "#1c090f", 4, true, true);
    this.dealActions.setLetterSpacing(1.1);

    this.offerKeys = this.input.keyboard.addKeys({
      accept: "E",
      refuse: "R"
    });
    this.choiceKeys = this.input.keyboard.addKeys({
      one: "ONE",
      two: "TWO",
      numOne: "NUMPAD_ONE",
      numTwo: "NUMPAD_TWO"
    });
    this.ttsToggleKey = this.input.keyboard.addKey("V");
    this.askWhisperKey = this.input.keyboard.addKey("Q");

    this.whisperHudVisible = Boolean(GameState.whisperAwakened || GameState.whisperIntroComplete);
    this.setWhisperHudVisible(this.whisperHudVisible, false);

    this.choiceBackdrop = this.add
      .rectangle(this.scale.width * 0.5, this.scale.height * 0.5, this.scale.width, this.scale.height, 0x030202)
      .setAlpha(0.22)
      .setVisible(false)
      .setScrollFactor(0)
      .setDepth(HUD_Z + 34);
    this.choicePanel = this.add
      .rectangle(this.scale.width * 0.5, this.scale.height * 0.5, 640, 420, 0x130708)
      .setStrokeStyle(2, 0xba6d57, 0.96)
      .setAlpha(0.82)
      .setVisible(false)
      .setScrollFactor(0)
      .setDepth(HUD_Z + 35);
    this.choiceTitle = this.add
      .text(this.scale.width * 0.5, this.scale.height * 0.5 - 186, "", {
        fontFamily: "'Simbiot', serif",
        fontSize: "20px",
        color: "#ffd6a8"
      })
      .setOrigin(0.5, 0)
      .setVisible(false)
      .setScrollFactor(0)
      .setDepth(HUD_Z + 36)
      .setResolution(2);
    this.choicePrompt = this.add
      .text(this.scale.width * 0.5, this.scale.height * 0.5 - 142, "", {
        fontFamily: "'Simbiot', serif",
        fontSize: "15px",
        color: "#f5dfca",
        align: "center",
        wordWrap: { width: 580 },
        lineSpacing: 6
      })
      .setOrigin(0.5, 0)
      .setVisible(false)
      .setScrollFactor(0)
      .setDepth(HUD_Z + 36)
      .setResolution(2);
    this.choiceDetails = this.add
      .text(this.scale.width * 0.5, this.scale.height * 0.5 - 46, "", {
        fontFamily: "'Simbiot', serif",
        fontSize: "15px",
        color: "#efd9c3",
        align: "center",
        wordWrap: { width: 580 },
        lineSpacing: 4
      })
      .setOrigin(0.5, 0)
      .setVisible(false)
      .setScrollFactor(0)
      .setDepth(HUD_Z + 36)
      .setResolution(2);
    this.choiceLeftText = this.add
      .text(this.scale.width * 0.5, this.scale.height * 0.5 + 72, "", {
        fontFamily: "'Simbiot', serif",
        fontSize: "16px",
        color: "#ffbe9d",
        align: "center",
        wordWrap: { width: 580 },
        lineSpacing: 3
      })
      .setOrigin(0.5, 0)
      .setVisible(false)
      .setScrollFactor(0)
      .setDepth(HUD_Z + 36)
      .setResolution(2);
    this.choiceRightText = this.add
      .text(this.scale.width * 0.5, this.scale.height * 0.5 + 146, "", {
        fontFamily: "'Simbiot', serif",
        fontSize: "16px",
        color: "#cfdcb0",
        align: "center",
        wordWrap: { width: 580 },
        lineSpacing: 3
      })
      .setOrigin(0.5, 0)
      .setVisible(false)
      .setScrollFactor(0)
      .setDepth(HUD_Z + 36)
      .setResolution(2);

    this.askWhisperText = this.add
      .text(this.scale.width - 16, this.scale.height - 8, "[Q] ASK THE WHISPER", {
        fontFamily: HUD_FONT,
        fontSize: "26px",
        color: "#f4c0b6",
        backgroundColor: "#1a0b0bcc",
        padding: { x: 10, y: 5 }
      })
      .setOrigin(1, 1)
      .setVisible(false)
      .setScrollFactor(0)
      .setDepth(HUD_Z + 24)
      .setResolution(2)
      .setInteractive({ useHandCursor: true });
    this.askWhisperText.on("pointerdown", () => this.requestWhisperDirective());

    this.directiveStatusText = this.add
      .text(12, this.scale.height - 4, "", {
        fontFamily: HUD_ACCENT_FONT,
        fontSize: "24px",
        color: "#ffd0c6",
        stroke: "#180909",
        strokeThickness: 2,
        backgroundColor: "#120808d9",
        padding: { x: 10, y: 5 },
        align: "left"
      })
      .setOrigin(0, 1)
      .setWordWrapWidth(520, true)
      .setVisible(false)
      .setScrollFactor(0)
      .setDepth(HUD_Z + 22)
      .setResolution(2);
    this.directiveStatusText.setLetterSpacing(0.8);
  }

  refresh() {
    this.onHealthUpdated(GameState.health);
    const formatted = new Intl.NumberFormat("en-US").format(GameState.coins);
    this.coinsText.setText(formatted);
    if (this.lastCoinValue !== undefined && this.lastCoinValue !== GameState.coins) {
      this.coinIcon.setScale(1.72);
      this.tweens.add({
        targets: this.coinIcon,
        scale: 1.45,
        duration: 180,
        ease: "Back.easeOut"
      });
      this.tweens.add({
        targets: this.coinsText,
        scaleX: 1.08,
        scaleY: 1.08,
        yoyo: true,
        duration: 120
      });
    }
    this.lastCoinValue = GameState.coins;

    const slice = GameState.slice ?? {};
    const currentRoomId = GameState.currentRoomId ?? "start";
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
    if (slice.completed) {
      this.onSliceObjectiveUpdated({ objective: "Mission 1 complete. Push deeper into the world." });
    } else if (inSanctum && !seraphSlain) {
      this.onSliceObjectiveUpdated({ objective: "Defeat the Fallen Seraph in the sanctum." });
    } else if (!slice.hasRelic) {
      this.onSliceObjectiveUpdated({
        objective: inReliquary && !slice.relicDropped
          ? "Defeat all 3 angels in Sealed Reliquary."
          : slice.relicDropped
            ? "Claim the relic dropped by the Fallen Seraph."
            : "Find the gate to the next room."
      });
    } else {
      this.onSliceObjectiveUpdated({
        objective: "Return to Room C and open the huge chest with the relic."
      });
    }
    const killAngelDone = seraphSlain;
    const findRelicDone = Boolean(slice.hasRelic);
    this.onSliceObjectivesUpdated({
      killAngelDone,
      findRelicDone,
      extractionReady: Boolean(GameState.hasAbility(ABILITY_IDS.FLAME_RING)),
      checklistText: slice.hasRelic
        ? "[V] Claim Relic   [ ] Open Huge Chest (Room C)"
        : inReliquary && !slice.relicDropped
          ? `${cryptAngelKillCount >= 3 ? "[V]" : "[ ]"} Defeat 3 Angels (${cryptAngelKillCount}/3)`
          : slice.relicDropped
            ? "[V] Slay Fallen Seraph   [ ] Claim Relic"
            : "[ ] Reach Next Room"
    });
    this.updateMiniMap(GameState.currentRoomId);
  }

  onHealthUpdated(healthValue = GameState.health) {
    this.healthTargetPct = Phaser.Math.Clamp(healthValue / Math.max(1, GameState.maxHealth), 0, 1);
  }

  onAuraUpdated(payload) {
    this.auraState = payload?.state ?? "ready";
    this.auraCharge = Phaser.Math.Clamp(payload?.charge ?? 0, 0, 1);
    if (this.auraState === "active") {
      this.auraStateText.setText("ACTIVE");
      this.auraStateText.setColor("#ffb56e");
      this.auraGlyph.setTint(0xffa65a);
    } else if (this.auraState === "cooldown") {
      const sec = ((payload?.cooldownLeftMs ?? 0) / 1000).toFixed(1);
      this.auraStateText.setText(`${sec}s`);
      this.auraStateText.setColor("#d4af82");
      this.auraGlyph.setTint(0xb98556);
    } else {
      this.auraStateText.setText("READY");
      this.auraStateText.setColor("#1a120c");
      this.auraGlyph.setTint(0xffc27a);
    }
  }

  drawHealthBar() {
    const hp = this.displayHealthPct;
    const delayed = this.delayedHealthPct;
    const liveW = Math.max(0, (HEALTH_BAR_W - 4) * hp);
    const delayedW = Math.max(0, (HEALTH_BAR_W - 4) * delayed);

    this.healthTrack.clear();
    this.healthTrack.fillStyle(0x0b0605, 0.95);
    this.healthTrack.fillRoundedRect(HEALTH_BAR_X + 1, HEALTH_BAR_Y + 1, HEALTH_BAR_W - 2, HEALTH_BAR_H - 2, 6);

    this.healthDelayed.clear();
    this.healthDelayed.fillStyle(0x66271d, 0.95);
    this.healthDelayed.fillRoundedRect(HEALTH_BAR_X + 2, HEALTH_BAR_Y + 2, delayedW, HEALTH_BAR_H - 4, 5);

    this.healthFill.clear();
    const fillColor = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.ValueToColor(0xff332b),
      Phaser.Display.Color.ValueToColor(0xffc55d),
      100,
      Math.round(hp * 100)
    ).color;
    this.healthFill.fillStyle(fillColor, 1);
    this.healthFill.fillRoundedRect(HEALTH_BAR_X + 2, HEALTH_BAR_Y + 2, liveW, HEALTH_BAR_H - 4, 5);

    this.healthGloss.clear();
    this.healthGloss.fillStyle(0xffffff, 0.17);
    this.healthGloss.fillRoundedRect(HEALTH_BAR_X + 2, HEALTH_BAR_Y + 3, liveW, 4, 2);

    this.healthFlameMaskGraphics.clear();
    if (liveW > 2) {
      this.healthFlameMaskGraphics.fillStyle(0xffffff, 1);
      this.healthFlameMaskGraphics.fillRoundedRect(
        HEALTH_BAR_X + 2,
        HEALTH_BAR_Y + 2,
        liveW,
        HEALTH_BAR_H - 4,
        5
      );
    }

    this.updateHealthFlameEmitter(liveW);
    this.healthValue.setText(`${Math.round(hp * GameState.maxHealth)} / ${GameState.maxHealth}`);
  }

  updateHealthFlameEmitter(liveWidth) {
    if (!this.healthFlame) return;
    if (liveWidth <= 6) {
      this.healthFlame.stop();
      return;
    }

    this.healthFlame.start();
    const flameH = 7;
    const zoneW = Math.max(8, liveWidth - 2);
    this.healthFlame.setEmitZone({
      source: new Phaser.Geom.Rectangle(
        HEALTH_BAR_X + 2,
        HEALTH_BAR_Y + HEALTH_BAR_H - flameH - 1,
        zoneW,
        flameH
      ),
      type: "random"
    });
  }

  drawHealthOrb(timeNow) {
    const pulse = 0.72 + Math.sin(timeNow * 0.008) * 0.15;
    const lowHp = this.displayHealthPct < 0.3;
    const tint = lowHp ? 0xff4a2a : 0xff863f;

    this.healthOrbBack.clear();
    this.healthOrbBack.fillStyle(0x1a0b09, 0.98);
    this.healthOrbBack.fillCircle(HEALTH_ORB_X, HEALTH_ORB_Y, HEALTH_ORB_R - 3);
    this.healthOrbBack.fillStyle(tint, 0.24 + pulse * 0.2);
    this.healthOrbBack.fillCircle(HEALTH_ORB_X, HEALTH_ORB_Y, HEALTH_ORB_R - 7);
    this.healthFlameGlyph.setTint(lowHp ? 0xff6b3a : 0xffaa57);
    this.healthFlameGlyph.setScale(0.98 + Math.sin(timeNow * 0.016) * 0.06);
  }

  drawCoinOrb(timeNow) {
    const pulse = 0.7 + Math.sin(timeNow * 0.01) * 0.2;
    this.coinOrbBack.clear();
    this.coinOrbBack.fillStyle(0x1a1209, 0.98);
    this.coinOrbBack.fillCircle(COIN_ORB_X, COIN_ORB_Y, COIN_ORB_R - 2);
    this.coinOrbBack.fillStyle(0xffb04d, 0.16 + pulse * 0.16);
    this.coinOrbBack.fillCircle(COIN_ORB_X, COIN_ORB_Y, COIN_ORB_R - 5);
  }

  drawAuraBar(timeNow) {
    const auraW = Math.max(0, (AURA_BAR_W - 4) * this.auraCharge);
    const auraColor =
      this.auraState === "active" ? 0xff8b3d : this.auraState === "cooldown" ? 0xd09a62 : 0xffc16d;

    this.auraTrack.clear();
    this.auraTrack.fillStyle(0x0b0605, 0.95);
    this.auraTrack.fillRoundedRect(AURA_BAR_X + 1, AURA_BAR_Y + 1, AURA_BAR_W - 2, AURA_BAR_H - 2, 5);

    this.auraFill.clear();
    this.auraFill.fillStyle(auraColor, 1);
    this.auraFill.fillRoundedRect(AURA_BAR_X + 2, AURA_BAR_Y + 2, auraW, AURA_BAR_H - 4, 4);

    this.auraGloss.clear();
    this.auraGloss.fillStyle(0xffffff, 0.16);
    this.auraGloss.fillRoundedRect(AURA_BAR_X + 2, AURA_BAR_Y + 3, auraW, 3, 2);

    this.auraOrbBack.clear();
    const pulse = this.auraState === "active" ? 0.2 + Math.sin(timeNow * 0.02) * 0.12 : 0.14;
    this.auraOrbBack.fillStyle(0x1a0b09, 0.98);
    this.auraOrbBack.fillCircle(AURA_ORB_X, AURA_ORB_Y, AURA_ORB_R - 2);
    this.auraOrbBack.fillStyle(auraColor, pulse + 0.1);
    this.auraOrbBack.fillCircle(AURA_ORB_X, AURA_ORB_Y, AURA_ORB_R - 6);
    this.auraGlyph.setScale(0.9 + Math.sin(timeNow * 0.015) * 0.04);
  }

  showHint(message) {
    this.hintText.setText(message);
    this.hintText.setVisible(true);
    if (this.hintTimer) this.hintTimer.remove();
    this.hintTimer = this.time.delayedCall(1500, () => {
      this.hintText.setVisible(false);
    });
  }

  showDeathWindow() {
    if (!this.deathBackdrop || !this.deathPanel || !this.deathTitle || !this.deathSubtext) return;
    this.tweens.killTweensOf([this.deathBackdrop, this.deathPanel, this.deathTitle, this.deathSubtext, this.deathConfirmText]);
    this.deathAwaitingConfirm = true;

    this.deathBackdrop.setVisible(true).setAlpha(0);
    this.deathPanel.setVisible(true).setAlpha(0).setScale(0.94);
    this.deathTitle.setVisible(true).setAlpha(0).setScale(0.95);
    this.deathSubtext.setVisible(true).setAlpha(0);
    this.deathConfirmText?.setVisible(true).setAlpha(0);

    this.tweens.add({
      targets: this.deathBackdrop,
      alpha: 0.6,
      duration: 170,
      ease: "Quad.easeOut"
    });
    this.tweens.add({
      targets: [this.deathPanel, this.deathTitle, this.deathSubtext, this.deathConfirmText],
      alpha: 1,
      duration: 220,
      ease: "Sine.easeOut"
    });
    this.tweens.add({
      targets: [this.deathPanel, this.deathTitle],
      scale: 1,
      duration: 260,
      ease: "Back.easeOut"
    });
    this.updateGamePauseState();
  }

  showMissionCompleteWindow(payload = {}) {
    if (
      !this.missionCompleteBackdrop ||
      !this.missionCompletePanel ||
      !this.missionCompleteTitle ||
      !this.missionCompleteSubtext
    ) {
      return;
    }
    this.tweens.killTweensOf([
      this.missionCompleteBackdrop,
      this.missionCompletePanel,
      this.missionCompleteTitle,
      this.missionCompleteSubtext,
      this.missionCompleteConfirmText
    ]);
    this.missionCompleteTitle.setText(payload?.title ?? "MISSION COMPLETED");
    this.missionCompleteSubtext.setText(
      payload?.body ?? "The reliquary yielded. A hidden fire stirs beneath your ribs."
    );
    this.missionCompleteConfirmText.setText(
      payload?.confirmText ?? "Press Enter to feel the inner flame."
    );
    this.missionCompleteAwaitingConfirm = true;

    this.missionCompleteBackdrop.setVisible(true).setAlpha(0);
    this.missionCompletePanel.setVisible(true).setAlpha(0).setScale(0.94);
    this.missionCompleteTitle.setVisible(true).setAlpha(0).setScale(0.95);
    this.missionCompleteSubtext.setVisible(true).setAlpha(0);
    this.missionCompleteConfirmText.setVisible(true).setAlpha(0);

    this.tweens.add({
      targets: this.missionCompleteBackdrop,
      alpha: 0.58,
      duration: 170,
      ease: "Quad.easeOut"
    });
    this.tweens.add({
      targets: [
        this.missionCompletePanel,
        this.missionCompleteTitle,
        this.missionCompleteSubtext,
        this.missionCompleteConfirmText
      ],
      alpha: 1,
      duration: 220,
      ease: "Sine.easeOut"
    });
    this.tweens.add({
      targets: [this.missionCompletePanel, this.missionCompleteTitle],
      scale: 1,
      duration: 260,
      ease: "Back.easeOut"
    });
    this.updateGamePauseState();
  }

  hideDeathWindow() {
    if (!this.deathAwaitingConfirm) return;
    this.deathAwaitingConfirm = false;
    this.tweens.add({
      targets: [this.deathBackdrop, this.deathPanel, this.deathTitle, this.deathSubtext, this.deathConfirmText],
      alpha: 0,
      duration: 220,
      ease: "Sine.easeIn",
      onComplete: () => {
        this.deathBackdrop?.setVisible(false);
        this.deathPanel?.setVisible(false);
        this.deathTitle?.setVisible(false);
        this.deathSubtext?.setVisible(false);
        this.deathConfirmText?.setVisible(false);
      }
    });
    this.updateGamePauseState();
  }

  hideMissionCompleteWindow() {
    if (!this.missionCompleteAwaitingConfirm) return;
    this.missionCompleteAwaitingConfirm = false;
    this.tweens.add({
      targets: [
        this.missionCompleteBackdrop,
        this.missionCompletePanel,
        this.missionCompleteTitle,
        this.missionCompleteSubtext,
        this.missionCompleteConfirmText
      ],
      alpha: 0,
      duration: 220,
      ease: "Sine.easeIn",
      onComplete: () => {
        this.missionCompleteBackdrop?.setVisible(false);
        this.missionCompletePanel?.setVisible(false);
        this.missionCompleteTitle?.setVisible(false);
        this.missionCompleteSubtext?.setVisible(false);
        this.missionCompleteConfirmText?.setVisible(false);
        EventBus.emit("mission-complete-confirmed");
      }
    });
    this.updateGamePauseState();
  }

  onDemonStateUpdated(state) {
    this.corruption = Phaser.Math.Clamp(state?.corruption ?? 0, 0, 100);
    this.dominance = Phaser.Math.Clamp(state?.dominance ?? 0, 0, 4);
    this.whisperVoice?.setDominance(this.dominance);

  }

  onSliceObjectiveUpdated(payload) {
    const objective = payload?.objective ?? "";
    if (!objective || !this.sliceObjectiveText) return;
    this.sliceObjectiveText.setText(objective);
  }

  onSliceObjectivesUpdated(payload) {
    if (!this.sliceChecklistText || !this.extractPromptText) return;
    const killAngelDone = Boolean(payload?.killAngelDone);
    const findRelicDone = Boolean(payload?.findRelicDone);
    const extractionReady = Boolean(payload?.extractionReady);
    const checklist =
      payload?.checklistText ??
      `${GameState.currentRoomId !== "start" ? "[V]" : "[ ]"} Reach Next Room`;
    this.sliceChecklistText.setText(checklist);
    this.extractPromptText.setText("Relic active. Open the huge chest in Room C.");
    this.extractPromptText.setVisible(extractionReady && !GameState.slice?.completed);
  }

  onRoomChangedLabel(roomId) {
    this.updateMiniMap(roomId);
  }

  onWhisperAwakened() {
    this.whisperHudVisible = true;
    this.setWhisperHudVisible(true, true);
  }

  onWhisperAskAvailability(payload) {
    this.askWhisperAvailable = Boolean(payload?.available);
    this.askWhisperCooldownMs = Math.max(0, payload?.cooldownLeftMs ?? 0);
    this.askWhisperLabel = String(payload?.label ?? "ASK THE WHISPER");
    if (payload?.activeDirective) {
      this.onWhisperDirectiveActive(payload.activeDirective);
    }
  }

  onWhisperDirectiveActive(payload) {
    this.activeDirectiveState = payload
      ? {
          title: payload.title ?? "Directive",
          objective: payload.objective ?? "",
          progressText: payload.progressText ?? "",
          secondsLeft: Math.max(0, payload.secondsLeft ?? 0)
        }
      : null;
    if (!this.directiveStatusText) return;
    if (!this.activeDirectiveState) {
      this.directiveStatusText.setVisible(false);
      return;
    }
    const state = this.activeDirectiveState;
    const compactProgress = String(state.progressText ?? "").slice(0, 22);
    this.directiveStatusText
      .setVisible(true)
      .setText(
        `DIRECTIVE  ${compactProgress}  ${state.secondsLeft}s`
      );
  }

  clearWhisperDirectiveUi() {
    this.activeDirectiveOffer = null;
    this.activeDirectiveState = null;
    this.directiveStatusText?.setVisible(false);
    if (!this.activeChoice) {
      this.choiceBackdrop?.setVisible(false);
      this.choicePanel?.setVisible(false);
      this.choiceTitle?.setVisible(false);
      this.choicePrompt?.setVisible(false);
      this.choiceDetails?.setVisible(false);
      this.choiceLeftText?.setVisible(false);
      this.choiceRightText?.setVisible(false);
    }
    this.updateGamePauseState();
  }

  onGameplayLoopUpdated(payload) {
    this.killCombo = Math.max(0, payload?.killCombo ?? 0);
    this.threatTier = Math.max(1, payload?.threatTier ?? 1);
    this.nextAmbushMs = Math.max(0, payload?.nextAmbushMs ?? 0);
    this.enemiesDefeated = Math.max(0, payload?.enemiesDefeated ?? 0);
  }

  onAbilityUnlocked(ability) {
    const label = ability?.label ?? "Unknown Ability";
    if (!this.abilityUnlockText) return;
    this.abilityUnlockText.setText(`NEW ABILITY UNLOCKED\n${label.toUpperCase()}`);
    this.abilityUnlockText.setVisible(true).setAlpha(0).setScale(0.92);
    this.tweens.killTweensOf(this.abilityUnlockText);
    this.tweens.add({
      targets: this.abilityUnlockText,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 220,
      ease: "Back.easeOut"
    });
    this.time.delayedCall(1700, () => {
      if (!this.abilityUnlockText?.active) return;
      this.tweens.add({
        targets: this.abilityUnlockText,
        alpha: 0,
        duration: 280,
        ease: "Sine.easeOut",
        onComplete: () => this.abilityUnlockText?.setVisible(false)
      });
    });
    this.updateMiniMap(GameState.currentRoomId);
  }

  updateMiniMap(roomId = GameState.currentRoomId, timeNow = this.time.now) {
    if (!this.minimapGraphics) return;
    const rooms = ["start", "shaft", "crypt", "sanctum"];
    const activeIndex = Math.max(0, rooms.indexOf(roomId));
    const hasFlameRing = GameState.hasAbility(ABILITY_IDS.FLAME_RING);
    const blink = 0.58 + (Math.sin(timeNow * 0.012) * 0.5 + 0.5) * 0.37;

    this.minimapGraphics.clear();
    this.minimapGraphics.lineStyle(2, 0xb98761, 0.8);
    for (let i = 0; i < rooms.length - 1; i += 1) {
      const x1 = MAP_X + i * (MAP_ROOM_W + MAP_ROOM_GAP) + MAP_ROOM_W;
      const x2 = MAP_X + (i + 1) * (MAP_ROOM_W + MAP_ROOM_GAP);
      const y = MAP_Y + Math.floor(MAP_ROOM_H * 0.5);
      this.minimapGraphics.beginPath();
      this.minimapGraphics.moveTo(x1, y);
      this.minimapGraphics.lineTo(x2, y);
      this.minimapGraphics.strokePath();
    }

    rooms.forEach((roomKey, index) => {
      const x = MAP_X + index * (MAP_ROOM_W + MAP_ROOM_GAP);
      const y = MAP_Y;
      const isCurrent = index === activeIndex;
      const lockedC = roomKey === "crypt" && !hasFlameRing;
      const fillColor = isCurrent ? 0xffca84 : lockedC ? 0x56362a : 0x91715b;
      const fillAlpha = isCurrent ? blink : lockedC ? 0.55 : 0.78;
      this.minimapGraphics.fillStyle(fillColor, fillAlpha);
      this.minimapGraphics.fillRoundedRect(x, y, MAP_ROOM_W, MAP_ROOM_H, 3);
      this.minimapGraphics.lineStyle(1, isCurrent ? 0xffebbe : 0xdec2a0, isCurrent ? blink : 0.75);
      this.minimapGraphics.strokeRoundedRect(x, y, MAP_ROOM_W, MAP_ROOM_H, 3);
      if (lockedC) {
        this.minimapGraphics.lineStyle(1, 0xff7a4a, 0.9);
        this.minimapGraphics.beginPath();
        this.minimapGraphics.moveTo(x + 4, y + 3);
        this.minimapGraphics.lineTo(x + MAP_ROOM_W - 4, y + MAP_ROOM_H - 3);
        this.minimapGraphics.strokePath();
      }
      if (roomKey === "sanctum") {
        const markerColor = isCurrent ? 0xff4f4f : 0xd63f3f;
        this.minimapGraphics.fillStyle(markerColor, 0.95);
        this.minimapGraphics.fillCircle(x + MAP_ROOM_W * 0.5, y + MAP_ROOM_H * 0.5, 2.2);
      }
    });
  }

  formatAbilityLabel(abilityId) {
    if (!abilityId) return "a missing power";
    return String(abilityId)
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  showWhisper(payload) {
    const message = typeof payload === "string" ? payload : payload?.text;
    const event = typeof payload === "string" ? "ambient" : payload?.event;
    if (!message) return;
    if (this.whisperActive) {
      this.whisperQueue.push({ text: message, event });
      return;
    }

    this.whisperText.setText(message);
    const speech = this.whisperVoice?.speakWhisper(message, {
      event,
      onEnd: () => this.fadeWhisperOut()
    });
    this.tweens.killTweensOf(this.whisperText);
    this.whisperText.setAlpha(0);
    this.tweens.add({
      targets: this.whisperText,
      alpha: 1,
      duration: 220,
      ease: "Sine.easeOut"
    });
    this.whisperActive = true;
    this.whisperTimer?.remove();
    const fallbackMs = speech?.spoken ? 260 : 900;
    this.whisperTimer = this.time.delayedCall(fallbackMs, () => this.tryFadeWhisperOut());
  }

  showDeal(deal) {
    if (!deal) return;
    if (this.activeChoice) {
      this.activeChoice = null;
      this.choiceBackdrop?.setVisible(false);
      this.choicePanel?.setVisible(false);
      this.choiceTitle?.setVisible(false);
      this.choicePrompt?.setVisible(false);
      this.choiceDetails?.setVisible(false);
      this.choiceLeftText?.setVisible(false);
      this.choiceRightText?.setVisible(false);
    }
    this.activeOffer = deal;
    this.dealBackdrop.setVisible(true);
    this.dealPanelGlow.setVisible(true);
    this.dealPanel.setVisible(true);
    this.dealPanelInner.setVisible(true);
    this.dealTitle.setVisible(true).setText(`THE WHISPER OFFERS\n${String(deal.title ?? "").toUpperCase()}`);
    const corruptionDelta = Number(deal.corruptionCost ?? 0);
    const corruptionShift = `${corruptionDelta >= 0 ? "+" : ""}${corruptionDelta}`;
    this.dealDesc
      .setVisible(true)
      .setText(`${deal.description}\nCorruption Shift: ${corruptionShift}`);
    this.dealActions.setVisible(true);
    this.whisperVoice?.speakOffer(deal);
    this.updateGamePauseState();
  }

  showWhisperChoice(choice) {
    if (!choice) return;
    this.activeDirectiveOffer = null;
    if (this.activeOffer) {
      this.resolveDeal("refuse");
    }
    this.activeChoice = choice;
    this.choiceBackdrop?.setVisible(true);
    this.choicePanel?.setVisible(true);
    this.choiceTitle?.setVisible(true).setText(`Whisper Choice: ${choice.title}`);
    this.choicePrompt?.setVisible(true).setText(choice.prompt ?? "");
    this.choiceDetails?.setVisible(false).setText("");
    this.choiceLeftText
      ?.setVisible(true)
      .setText(`[1] ${choice.left?.label ?? "Option One"}\n${choice.left?.description ?? ""}`);
    this.choiceRightText
      ?.setVisible(true)
      .setText(`[2] ${choice.right?.label ?? "Option Two"}\n${choice.right?.description ?? ""}`);
    this.whisperVoice?.speakWhisper(choice.prompt ?? choice.title, { event: "offer_power" });
    this.updateGamePauseState();
  }

  showWhisperDirectiveOffer(payload) {
    if (!payload) return;
    if (this.activeOffer) {
      this.resolveDeal("refuse");
    }
    this.activeChoice = null;
    this.activeDirectiveOffer = payload;
    this.choiceBackdrop?.setVisible(true);
    this.choicePanel?.setVisible(true);
    this.choiceTitle?.setVisible(true).setText(`The Whisper: ${payload.title ?? "Directive"}`);
    this.choicePrompt
      ?.setVisible(true)
      .setText(payload.prompt ?? "");
    this.choiceDetails
      ?.setVisible(true)
      .setText(
        `Objective: ${payload.objective ?? ""}\nReward: ${payload.rewardLabel ?? ""}\nCorruption: +${payload.corruptionGain ?? 0}`
      );
    this.choiceLeftText?.setVisible(true).setText("[1] OBEY\nAccept directive");
    this.choiceRightText?.setVisible(true).setText("[2] IGNORE\nRefuse and stay weaker");
    this.whisperVoice?.speakWhisper(payload.prompt ?? payload.title ?? "Obey.", { event: "offer_power" });
    this.updateGamePauseState();
  }

  resolveDirectiveOffer(decision) {
    if (!this.activeDirectiveOffer) return;
    EventBus.emit("whisper-directive-response", {
      decision,
      directiveId: this.activeDirectiveOffer.id
    });
    this.activeDirectiveOffer = null;
    this.choiceBackdrop?.setVisible(false);
    this.choicePanel?.setVisible(false);
    this.choiceTitle?.setVisible(false);
    this.choicePrompt?.setVisible(false);
    this.choiceDetails?.setVisible(false);
    this.choiceLeftText?.setVisible(false);
    this.choiceRightText?.setVisible(false);
    this.updateGamePauseState();
  }

  resolveDeal(decision) {
    if (!this.activeOffer) return;
    EventBus.emit("demon-deal-response", {
      decision,
      dealId: this.activeOffer.id
    });
    this.activeOffer = null;
    this.dealBackdrop.setVisible(false);
    this.dealPanelGlow.setVisible(false);
    this.dealPanel.setVisible(false);
    this.dealPanelInner.setVisible(false);
    this.dealTitle.setVisible(false);
    this.dealDesc.setVisible(false);
    this.dealActions.setVisible(false);
    this.updateGamePauseState();
  }

  updateGamePauseState() {
    const shouldPauseGame = Boolean(
      this.deathAwaitingConfirm ||
        this.missionCompleteAwaitingConfirm ||
        this.activeOffer ||
        this.activeDirectiveOffer ||
        this.activeChoice
    );
    if (shouldPauseGame === this.modalPausedGame) return;
    this.modalPausedGame = shouldPauseGame;
    if (shouldPauseGame) {
      if (this.scene.isActive("game")) {
        this.scene.pause("game");
      }
      return;
    }
    if (this.scene.isPaused("game")) {
      this.scene.resume("game");
    }
  }

  resolveWhisperChoice(decision) {
    if (!this.activeChoice) return;
    EventBus.emit("demon-choice-response", {
      decision,
      choiceId: this.activeChoice.id
    });
    this.activeChoice = null;
    this.choiceBackdrop?.setVisible(false);
    this.choicePanel?.setVisible(false);
    this.choiceTitle?.setVisible(false);
    this.choicePrompt?.setVisible(false);
    this.choiceDetails?.setVisible(false);
    this.choiceLeftText?.setVisible(false);
    this.choiceRightText?.setVisible(false);
    this.updateGamePauseState();
  }

  drawCorruptionBar() {
    if (!this.whisperHudVisible) {
      this.corruptionTrack?.clear();
      this.corruptionFill?.clear();
      return;
    }
    const pct = this.corruption / 100;
    const fillW = Math.max(0, (CORRUPTION_BAR_W - 4) * pct);
    this.corruptionTrack.clear();
    this.corruptionTrack.fillStyle(0x090304, 0.92);
    this.corruptionTrack.fillRoundedRect(
      CORRUPTION_BAR_X,
      CORRUPTION_BAR_Y,
      CORRUPTION_BAR_W,
      CORRUPTION_BAR_H,
      5
    );
    this.corruptionFill.clear();
    const color = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.ValueToColor(0x8b2d2d),
      Phaser.Display.Color.ValueToColor(0xe95a3f),
      100,
      Math.round(pct * 100)
    ).color;
    this.corruptionFill.fillStyle(color, 0.96);
    this.corruptionFill.fillRoundedRect(
      CORRUPTION_BAR_X + 2,
      CORRUPTION_BAR_Y + 2,
      fillW,
      CORRUPTION_BAR_H - 4,
      4
    );

  }

  drawDemonOverlay() {
    if (!this.whisperHudVisible) {
      this.demonOverlay?.setAlpha(0);
      return;
    }
    this.overlayTargetAlpha = Phaser.Math.Linear(0.02, 0.2, this.corruption / 100);
    this.overlayPulse += 0.035 + this.dominance * 0.008;
    const flicker = this.dominance >= 3 ? Math.sin(this.overlayPulse) * 0.016 : 0;
    const alpha = Phaser.Math.Clamp(this.overlayTargetAlpha + flicker, 0, 0.28);
    this.demonOverlay.setAlpha(alpha);
  }

  getDominanceStageName(dominance) {
    if (dominance >= 4) return "DOMINION";
    if (dominance >= 3) return "POSSESSION";
    if (dominance >= 2) return "HUNGER";
    return "WHISPER";
  }

  requestWhisperDirective() {
    if (!this.whisperHudVisible) return;
    if (this.activeOffer || this.activeChoice || this.activeDirectiveOffer) return;
    EventBus.emit("whisper-ask-requested");
  }

  drawAskWhisperButton(timeNow) {
    if (!this.askWhisperText) return;
    const blocked = Boolean(this.activeOffer || this.activeChoice || this.activeDirectiveOffer);
    const shouldShow = this.whisperHudVisible && !blocked;
    this.askWhisperText.setVisible(shouldShow);
    if (!shouldShow) return;

    const cooldownSec = Math.max(0, Math.ceil(this.askWhisperCooldownMs / 1000));
    const label = this.askWhisperAvailable
      ? `[Q] ${this.askWhisperLabel}`
      : `[Q] ${this.askWhisperLabel} (${cooldownSec}s)`;
    this.askWhisperText.setText(label);

    if (this.askWhisperAvailable) {
      const pulse = 0.64 + Math.sin(timeNow * 0.01) * 0.28;
      this.askWhisperText.setAlpha(pulse);
      this.askWhisperText.setColor("#ffd0c6");
    } else {
      this.askWhisperText.setAlpha(0.42);
      this.askWhisperText.setColor("#c89d95");
    }
  }

  update(_, delta) {
    this.displayHealthPct = Phaser.Math.Linear(this.displayHealthPct, this.healthTargetPct, 0.18);
    if (this.delayedHealthPct < this.displayHealthPct) {
      this.delayedHealthPct = this.displayHealthPct;
    } else {
      const decay = Math.min(1, delta / 280);
      this.delayedHealthPct = Phaser.Math.Linear(this.delayedHealthPct, this.displayHealthPct, decay);
    }

    this.drawHealthBar();
    this.drawHealthOrb(this.time.now);
    this.drawCoinOrb(this.time.now);
    this.drawAuraBar(this.time.now);
    this.updateMiniMap(GameState.currentRoomId, this.time.now);
    this.drawCorruptionBar();
    this.drawDemonOverlay();
    this.drawAskWhisperButton(this.time.now);

    if (this.activeOffer) {
      if (Phaser.Input.Keyboard.JustDown(this.offerKeys.accept)) {
        this.resolveDeal("accept");
      } else if (Phaser.Input.Keyboard.JustDown(this.offerKeys.refuse)) {
        this.resolveDeal("refuse");
      }
    }
    if (this.activeDirectiveOffer) {
      if (
        Phaser.Input.Keyboard.JustDown(this.choiceKeys.one) ||
        Phaser.Input.Keyboard.JustDown(this.choiceKeys.numOne)
      ) {
        this.resolveDirectiveOffer("obey");
      } else if (
        Phaser.Input.Keyboard.JustDown(this.choiceKeys.two) ||
        Phaser.Input.Keyboard.JustDown(this.choiceKeys.numTwo)
      ) {
        this.resolveDirectiveOffer("ignore");
      }
    } else if (this.activeChoice) {
      if (
        Phaser.Input.Keyboard.JustDown(this.choiceKeys.one) ||
        Phaser.Input.Keyboard.JustDown(this.choiceKeys.numOne)
      ) {
        this.resolveWhisperChoice("left");
      } else if (
        Phaser.Input.Keyboard.JustDown(this.choiceKeys.two) ||
        Phaser.Input.Keyboard.JustDown(this.choiceKeys.numTwo)
      ) {
        this.resolveWhisperChoice("right");
      }
    }

    if (Phaser.Input.Keyboard.JustDown(this.ttsToggleKey)) {
      this.whisperVoice?.toggle();
    }
    if (Phaser.Input.Keyboard.JustDown(this.askWhisperKey) && this.askWhisperAvailable) {
      this.requestWhisperDirective();
    }
    if (this.deathAwaitingConfirm && Phaser.Input.Keyboard.JustDown(this.deathConfirmKey)) {
      this.hideDeathWindow();
    } else if (this.missionCompleteAwaitingConfirm && Phaser.Input.Keyboard.JustDown(this.deathConfirmKey)) {
      this.hideMissionCompleteWindow();
    }
  }

  cleanup() {
    EventBus.off("room-changed", this.refresh, this);
    EventBus.off("room-changed", this.handleRoomChangedLabel, this);
    EventBus.off("coins-updated", this.refresh, this);
    EventBus.off("health-updated", this.onHealthUpdated, this);
    EventBus.off("aura-updated", this.onAuraUpdated, this);
    EventBus.off("world-hint", this.showHint, this);
    EventBus.off("gate-blocked", this.handleGateBlocked, this);
    EventBus.off("demon-state-updated", this.handleDemonStateUpdated, this);
    EventBus.off("demon-whisper", this.handleDemonWhisper, this);
    EventBus.off("demon-offer", this.handleDemonOffer, this);
    EventBus.off("whisper-awakened", this.handleWhisperAwakened, this);
    EventBus.off("slice-objective-updated", this.handleSliceObjectiveUpdated, this);
    EventBus.off("slice-objectives-updated", this.handleSliceObjectivesUpdated, this);
    EventBus.off("gameplay-loop-updated", this.handleGameplayLoopUpdated, this);
    EventBus.off("ability-unlocked", this.handleAbilityUnlocked, this);
    EventBus.off("demon-choice-offered", this.handleWhisperChoice, this);
    EventBus.off("whisper-ask-availability", this.handleWhisperAskAvailability, this);
    EventBus.off("whisper-directive-offered", this.handleWhisperDirectiveOffered, this);
    EventBus.off("whisper-directive-active", this.handleWhisperDirectiveActive, this);
    EventBus.off("whisper-directive-cleared", this.handleWhisperDirectiveCleared, this);
    EventBus.off("player-died", this.handlePlayerDiedHud, this);
    EventBus.off("mission-complete", this.handleMissionCompletedHud, this);
    this.whisperVoice?.destroy();
    this.whisperVoice = null;
    this.healthFlame?.destroy();
    this.healthFlameMaskGraphics?.destroy();
    if (this.modalPausedGame && this.scene.isPaused("game")) {
      this.scene.resume("game");
    }
    this.modalPausedGame = false;
  }

  setWhisperHudVisible(visible, animate = false) {
    const alpha = visible ? 1 : 0;
    const targets = [this.corruptionLabel].filter(Boolean);
    this.corruptionTrack?.setAlpha(alpha);
    this.corruptionFill?.setAlpha(alpha);
    targets.forEach((target) => {
      target.setAlpha(alpha);
    });
    if (!animate || !visible) return;
    this.corruptionTrack?.setAlpha(0);
    this.corruptionFill?.setAlpha(0);
    targets.forEach((target) => {
      target.setAlpha(0);
    });
    this.tweens.add({
      targets: [this.corruptionTrack, this.corruptionFill, ...targets],
      alpha: 1,
      duration: 460,
      ease: "Sine.easeOut"
    });
  }

  fadeWhisperOut() {
    if (!this.whisperActive || !this.whisperText) return;
    this.whisperTimer?.remove();
    this.tweens.killTweensOf(this.whisperText);
    this.tweens.add({
      targets: this.whisperText,
      alpha: 0,
      duration: WHISPER_FADE_OUT_MS,
      ease: "Sine.easeOut",
      onComplete: () => {
        this.whisperActive = false;
        if (this.whisperQueue.length > 0) {
          const next = this.whisperQueue.shift();
          const afterFadeDelay = Math.max(0, WHISPER_SENTENCE_BREAK_MS - WHISPER_FADE_OUT_MS);
          this.time.delayedCall(afterFadeDelay, () => this.showWhisper(next));
        }
      }
    });
  }

  tryFadeWhisperOut() {
    if (!this.whisperActive) return;
    const synthBusy =
      typeof window !== "undefined" &&
      "speechSynthesis" in window &&
      (window.speechSynthesis.speaking || window.speechSynthesis.pending);
    if (synthBusy) {
      this.whisperTimer = this.time.delayedCall(90, () => this.tryFadeWhisperOut());
      return;
    }
    this.fadeWhisperOut();
  }
}
