import Phaser from "phaser";
import { EventBus } from "../core/EventBus";
import { GameState } from "../core/GameState";
import { HungerVoice } from "../systems/HungerVoice";

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
const COIN_BAR_Y = 44;
const COIN_BAR_W = 220;
const COIN_BAR_H = 28;

const AURA_ORB_X = 358;
const AURA_ORB_Y = 58;
const AURA_ORB_R = 22;
const AURA_BAR_X = 392;
const AURA_BAR_Y = 49;
const AURA_BAR_W = 220;
const AURA_BAR_H = 18;
const CORRUPTION_BAR_X = 286;
const CORRUPTION_BAR_Y = 14;
const CORRUPTION_BAR_W = 388;
const CORRUPTION_BAR_H = 12;

const HUD_FONT = "'Cinzel', 'Palatino Linotype', 'Book Antiqua', serif";
const HUD_ACCENT_FONT = "'Cinzel', 'Palatino Linotype', 'Book Antiqua', serif";

const ROOM_LABELS = {
  start: "START",
  shaft: "SHAFT",
  sanctum: "SANCTUM"
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
    this.whisperTimer = null;
    this.whisperActive = false;
    this.overlayTargetAlpha = 0;
    this.overlayPulse = 0;
    this.hungerVoice = null;
    this.handleGateBlocked = () => this.showHint("Path sealed by a missing ability");
    this.handleDemonStateUpdated = (state) => this.onDemonStateUpdated(state);
    this.handleDemonWhisper = (text) => this.showWhisper(text);
    this.handleDemonOffer = (deal) => this.showDeal(deal);
    this.handleSliceObjectiveUpdated = (payload) => this.onSliceObjectiveUpdated(payload);
    this.handleSlicePhaseUpdated = (payload) => this.onSlicePhaseUpdated(payload);
    this.handleRoomChangedLabel = (roomId) => this.onRoomChangedLabel(roomId);
  }

  create() {
    this.createOrnateFrameLayer();
    this.createHealthLayer();
    this.createCoinLayer();
    this.createAuraLayer();
    this.createHintLayer();
    this.createSliceLayer();
    this.createDemonLayer();
    this.hungerVoice = new HungerVoice({
      onToggle: (enabled, supported, detail) => {
        if (!supported) {
          this.showHint("TTS unavailable in this browser");
          return;
        }
        if (detail) {
          this.showHint(detail);
          return;
        }
        this.showHint(enabled ? "The Hunger voice: ON" : "The Hunger voice: OFF");
      }
    });

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
    EventBus.on("slice-objective-updated", this.handleSliceObjectiveUpdated, this);
    EventBus.on("slice-phase-updated", this.handleSlicePhaseUpdated, this);
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
      .text(HEALTH_BAR_X + 10, HEALTH_BAR_Y - 16, "VITAL", {
        fontFamily: HUD_FONT,
        fontSize: "11px",
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
        fontSize: "22px",
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
      .text(COIN_BAR_X + 12, COIN_BAR_Y - 16, "TREASURE", {
        fontFamily: HUD_FONT,
        fontSize: "11px",
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
        fontSize: "22px",
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
      .image(AURA_ORB_X, AURA_ORB_Y + 1, "fx-sword")
      .setScale(0.92)
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
      .text(AURA_BAR_X + 8, AURA_BAR_Y - 14, "AURA", {
        fontFamily: HUD_FONT,
        fontSize: "11px",
        color: "#f1b875",
        letterSpacing: 1.1
      })
      .setScrollFactor(0)
      .setDepth(HUD_Z + 5)
      .setResolution(2);
    this.auraSubText.setLetterSpacing(1.8);
  }

  createHintLayer() {
    this.hintText = this.add
      .text(this.scale.width * 0.5, this.scale.height - 32, "", {
        fontFamily: HUD_FONT,
        fontSize: "14px",
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
  }

  createSliceLayer() {
    this.roomNameText = this.add
      .text(12, 12, "ROOM: START", {
        fontFamily: HUD_FONT,
        fontSize: "11px",
        color: "#e8c8a0",
        backgroundColor: "#160d0bdd",
        padding: { x: 8, y: 4 }
      })
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(HUD_Z + 14)
      .setResolution(2);
    this.roomNameText.setLetterSpacing(1.2);

    this.slicePhaseText = this.add
      .text(this.scale.width * 0.5, 82, "PHASE: SEEK THE RELIC", {
        fontFamily: HUD_FONT,
        fontSize: "11px",
        color: "#f3c89a",
        backgroundColor: "#1a0f0ddd",
        padding: { x: 9, y: 4 }
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(HUD_Z + 14)
      .setResolution(2);
    this.slicePhaseText.setLetterSpacing(1.4);

    this.sliceObjectiveText = this.add
      .text(this.scale.width * 0.5, 104, "Slay the Relic Angel in Start, then claim the relic.", {
        fontFamily: HUD_ACCENT_FONT,
        fontSize: "14px",
        color: "#ffe2bf",
        stroke: "#2a1712",
        strokeThickness: 1
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(HUD_Z + 14)
      .setResolution(2);

    this.sliceDangerText = this.add
      .text(this.scale.width - 12, 16, "DANGER: LOW", {
        fontFamily: HUD_FONT,
        fontSize: "11px",
        color: "#d8b5b0"
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(HUD_Z + 8)
      .setResolution(2);
    this.sliceDangerText.setLetterSpacing(1.2);
  }

  createDemonLayer() {
    this.corruptionTrack = this.add.graphics().setScrollFactor(0).setDepth(HUD_Z + 6);
    this.corruptionFill = this.add.graphics().setScrollFactor(0).setDepth(HUD_Z + 7);
    this.corruptionLabel = this.add
      .text(CORRUPTION_BAR_X, CORRUPTION_BAR_Y - 14, "THE WHISPER", {
        fontFamily: HUD_FONT,
        fontSize: "10px",
        color: "#d8a0a0"
      })
      .setScrollFactor(0)
      .setDepth(HUD_Z + 7)
      .setResolution(2);

    this.whisperText = this.add
      .text(this.scale.width * 0.5, this.scale.height - 74, "", {
        fontFamily: "'Georgia', serif",
        fontSize: "22px",
        color: "#e5c9c9",
        stroke: "#170b0b",
        strokeThickness: 3,
        align: "center"
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
      .setAlpha(0.42)
      .setVisible(false)
      .setScrollFactor(0)
      .setDepth(HUD_Z + 30);
    this.dealPanel = this.add
      .rectangle(this.scale.width * 0.5, this.scale.height * 0.5, 560, 210, 0x140b0a)
      .setStrokeStyle(2, 0x874a42, 0.95)
      .setVisible(false)
      .setScrollFactor(0)
      .setDepth(HUD_Z + 31);
    this.dealTitle = this.add
      .text(this.scale.width * 0.5, this.scale.height * 0.5 - 68, "", {
        fontFamily: HUD_FONT,
        fontSize: "22px",
        color: "#f5c8c8"
      })
      .setOrigin(0.5)
      .setVisible(false)
      .setScrollFactor(0)
      .setDepth(HUD_Z + 32)
      .setResolution(2);
    this.dealDesc = this.add
      .text(this.scale.width * 0.5, this.scale.height * 0.5 - 26, "", {
        fontFamily: HUD_ACCENT_FONT,
        fontSize: "17px",
        color: "#f2d8d8",
        align: "center"
      })
      .setOrigin(0.5)
      .setVisible(false)
      .setScrollFactor(0)
      .setDepth(HUD_Z + 32)
      .setResolution(2);
    this.dealActions = this.add
      .text(this.scale.width * 0.5, this.scale.height * 0.5 + 52, "[E] Accept   [R] Refuse", {
        fontFamily: HUD_ACCENT_FONT,
        fontSize: "16px",
        color: "#f0a5a5"
      })
      .setOrigin(0.5)
      .setVisible(false)
      .setScrollFactor(0)
      .setDepth(HUD_Z + 32)
      .setResolution(2);

    this.offerKeys = this.input.keyboard.addKeys({
      accept: "E",
      refuse: "R"
    });
    this.ttsToggleKey = this.input.keyboard.addKey("V");
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
    if (slice.completed) {
      this.onSlicePhaseUpdated({ phase: "RITUAL COMPLETE" });
      this.onSliceObjectiveUpdated({ objective: "Level complete. Survive and reflect." });
    } else if (!slice.hasRelic) {
      this.onSlicePhaseUpdated({ phase: "SEEK THE RELIC" });
      this.onSliceObjectiveUpdated({
        objective: slice.relicDropped
          ? "Claim the relic dropped in Start."
          : "Slay the Relic Angel in Start, then claim the relic."
      });
    } else {
      this.onSlicePhaseUpdated({ phase: "FIND THE EXIT" });
      this.onSliceObjectiveUpdated({
        objective: slice.exitSpawned
          ? "Find exit and escape."
          : "A breach is forming. Hold your ground."
      });
    }
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
      this.auraStateText.setColor("#f6c17a");
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

  onDemonStateUpdated(state) {
    this.corruption = Phaser.Math.Clamp(state?.corruption ?? 0, 0, 100);
    this.dominance = Phaser.Math.Clamp(state?.dominance ?? 0, 0, 4);
    this.hungerVoice?.setDominance(this.dominance);

    let danger = "LOW";
    let color = "#d8b5b0";
    if (this.dominance >= 3 || this.corruption >= 75) {
      danger = "EXTREME";
      color = "#ff8f7d";
    } else if (this.dominance >= 2 || this.corruption >= 50) {
      danger = "HIGH";
      color = "#ffb084";
    } else if (this.dominance >= 1 || this.corruption >= 25) {
      danger = "ELEVATED";
      color = "#f0bf86";
    }
    this.sliceDangerText?.setText(`DANGER: ${danger}`);
    this.sliceDangerText?.setColor(color);
  }

  onSliceObjectiveUpdated(payload) {
    const objective = payload?.objective ?? "";
    if (!objective || !this.sliceObjectiveText) return;
    this.sliceObjectiveText.setText(objective);
  }

  onSlicePhaseUpdated(payload) {
    const phase = payload?.phase ?? "";
    if (!phase || !this.slicePhaseText) return;
    this.slicePhaseText.setText(`PHASE: ${phase}`);
  }

  onRoomChangedLabel(roomId) {
    const label = ROOM_LABELS[roomId] ?? String(roomId ?? "UNKNOWN").toUpperCase();
    this.roomNameText?.setText(`ROOM: ${label}`);
  }

  showWhisper(message) {
    this.whisperText.setText(message);
    this.hungerVoice?.speakWhisper(message);
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
    this.whisperTimer = this.time.delayedCall(1900, () => {
      this.tweens.add({
        targets: this.whisperText,
        alpha: 0,
        duration: 620,
        ease: "Sine.easeOut",
        onComplete: () => {
          this.whisperActive = false;
        }
      });
    });
  }

  showDeal(deal) {
    if (!deal) return;
    this.activeOffer = deal;
    this.dealBackdrop.setVisible(true);
    this.dealPanel.setVisible(true);
    this.dealTitle.setVisible(true).setText(`The Whisper offers: ${deal.title}`);
    this.dealDesc
      .setVisible(true)
      .setText(`${deal.description}\nCost: +${deal.corruptionCost} corruption`);
    this.dealActions.setVisible(true);
    this.hungerVoice?.speakOffer(deal);
  }

  resolveDeal(decision) {
    if (!this.activeOffer) return;
    EventBus.emit("demon-deal-response", {
      decision,
      dealId: this.activeOffer.id
    });
    this.activeOffer = null;
    this.dealBackdrop.setVisible(false);
    this.dealPanel.setVisible(false);
    this.dealTitle.setVisible(false);
    this.dealDesc.setVisible(false);
    this.dealActions.setVisible(false);
  }

  drawCorruptionBar() {
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
    this.drawCorruptionBar();
    this.drawDemonOverlay();

    if (this.activeOffer) {
      if (Phaser.Input.Keyboard.JustDown(this.offerKeys.accept)) {
        this.resolveDeal("accept");
      } else if (Phaser.Input.Keyboard.JustDown(this.offerKeys.refuse)) {
        this.resolveDeal("refuse");
      }
    }

    if (Phaser.Input.Keyboard.JustDown(this.ttsToggleKey)) {
      this.hungerVoice?.toggle();
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
    EventBus.off("slice-objective-updated", this.handleSliceObjectiveUpdated, this);
    EventBus.off("slice-phase-updated", this.handleSlicePhaseUpdated, this);
    this.hungerVoice?.destroy();
    this.hungerVoice = null;
    this.healthFlame?.destroy();
    this.healthFlameMaskGraphics?.destroy();
  }
}
