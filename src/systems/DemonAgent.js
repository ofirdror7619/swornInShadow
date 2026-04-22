import Phaser from "phaser";

const DOMINANCE_STEP = 20;
const MAX_CORRUPTION = 100;
const BASE_WHISPER_COOLDOWN_MS = 5200;
const MIN_WHISPER_COOLDOWN_MS = 1800;
const IDLE_THRESHOLD_MS = 15000;
const OFFER_COOLDOWN_MS = 24000;
const CHOICE_COOLDOWN_MS = 17000;
const LOW_HEALTH_THRESHOLD = 0.25;
const KILL_STREAK_WINDOW_MS = 5000;
const KILL_STREAK_TARGET = 3;

const DEALS = [
  {
    id: "ember_surge",
    title: "Ember Surge",
    description: "Fire Storm damage +50% for 15s",
    corruptionCost: 10,
    durationMs: 15000,
    effect: "aura_damage_boost"
  },
  {
    id: "burning_mercy",
    title: "Burning Mercy",
    description: "Restore 30 vital instantly",
    corruptionCost: 8,
    durationMs: 0,
    effect: "instant_heal",
    healAmount: 30
  },
  {
    id: "possessed_flight",
    title: "Possessed Flight",
    description: "Move and dash speed +40% for 20s",
    corruptionCost: 15,
    durationMs: 20000,
    effect: "flight_boost"
  }
];

const WHISPERS = {
  enemy_killed: ["Another one.", "Good.", "They break so easily.", "Yes... keep going."],
  kill_streak: ["More.", "Do not stop now.", "Now you remember what you are.", "This is your power."],
  low_health: ["You are weakening.", "Let me help.", "Say yes.", "Without me, you will fall."],
  player_died: ["Disappointing.", "You failed again.", "Next time, give me control.", "I would have finished it."],
  idle_too_long: ["Why did you stop?", "Are you afraid?", "Move.", "They are waiting for you."],
  chest_opened: ["A small prize.", "Take it all.", "Good. More power.", "It belongs to you now."],
  room_entered: ["Another gate opens.", "Keep moving.", "See what waits inside."],
  secret_found: ["You knew where to look.", "You hear the call too.", "Very good."],
  offer_power: ["I can make you stronger.", "Just one word.", "Let me in.", "I will save you."],
  player_damaged: ["They touched you.", "Will you let them?", "Answer them with fire."]
};

const DOMINANCE_LINES = [
  ["I am here.", "I see you."],
  ["We are growing stronger.", "You are starting to understand."],
  ["I am already inside.", "You can feel me, can't you?"],
  ["Now we are one.", "There is no way back."]
];
const CHOICES = {
  gate_blocked: {
    id: "gate_blocked",
    title: "The Gate Hungers",
    prompt: "A sealed path. Feed the Whisper, or endure and carve your own route.",
    left: {
      id: "embrace",
      label: "Embrace",
      description: "Break through with demonic force. +14 corruption, instant power.",
      corruptionDelta: 14,
      effect: "embrace_gate"
    },
    right: {
      id: "resist",
      label: "Resist",
      description: "Stay pure. -6 corruption, but enemies answer the refusal.",
      corruptionDelta: -6,
      effect: "resist_gate"
    }
  },
  low_health: {
    id: "low_health_choice",
    title: "Blood Covenant",
    prompt: "Your pulse is fading. Let the Whisper hold the wound?",
    left: {
      id: "embrace",
      label: "Accept Blood",
      description: "Restore 28 vital and empower Fire Storm. +12 corruption.",
      corruptionDelta: 12,
      effect: "embrace_low_health"
    },
    right: {
      id: "resist",
      label: "Clench Teeth",
      description: "No heal, but corruption recedes. -5 corruption.",
      corruptionDelta: -5,
      effect: "resist_low_health"
    }
  },
  kill_streak: {
    id: "kill_streak_choice",
    title: "Feast Or Flee",
    prompt: "The slaughter sings. Push deeper, or silence the voice?",
    left: {
      id: "embrace",
      label: "Feast",
      description: "Spawn a brutal wave, gain frenzy buffs. +10 corruption.",
      corruptionDelta: 10,
      effect: "embrace_streak"
    },
    right: {
      id: "resist",
      label: "Silence",
      description: "Gain brief protection and reduce corruption by 4.",
      corruptionDelta: -4,
      effect: "resist_streak"
    }
  }
};

export class DemonAgent {
  constructor({ onWhisper, onOffer, onChoice, onStateChanged, initialState }) {
    this.onWhisper = onWhisper;
    this.onOffer = onOffer;
    this.onChoice = onChoice;
    this.onStateChanged = onStateChanged;

    this.state = {
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
      roomsVisited: 0,
      ...initialState
    };

    this.lastWhisperAt = -Infinity;
    this.lastKillAt = -Infinity;
    this.lastOfferAt = -Infinity;
    this.lastIdleNoticeAt = -Infinity;
    this.lastChoiceAt = -Infinity;
    this.killTimestamps = [];
    this.pendingOffer = null;
    this.pendingChoice = null;
    this.lowHealthOfferTriggered = false;
    this.narrationLocked = false;
  }

  getState() {
    return { ...this.state };
  }

  onEvent(event, now, payload = {}) {
    this.updateStateFromEvent(event, now, payload);
    this.maybeWhisper(event, now, payload);
    this.emitState();
  }

  tick(now, behavior) {
    if (this.narrationLocked) {
      return;
    }
    this.trimKillHistory(now);
    this.state.killsInLastMinute = this.killTimestamps.length;
    this.state.timeSinceLastKill = Number.isFinite(this.lastKillAt) ? now - this.lastKillAt : Infinity;

    if (behavior?.healthPct !== undefined) {
      const low = behavior.healthPct <= LOW_HEALTH_THRESHOLD;
      if (!low) {
        this.lowHealthOfferTriggered = false;
      }
      if (low && !this.lowHealthOfferTriggered) {
        this.lowHealthOfferTriggered = true;
        this.offerDeal("low_health", now);
      }
    }

    if (
      behavior?.isIdle &&
      now - this.lastIdleNoticeAt > IDLE_THRESHOLD_MS &&
      now - this.lastWhisperAt > this.getWhisperCooldownMs()
    ) {
      this.lastIdleNoticeAt = now;
      this.onEvent("idle_too_long", now);
    }
  }

  acceptDeal(now) {
    if (!this.pendingOffer) return null;
    const accepted = this.pendingOffer;
    this.pendingOffer = null;
    this.state.acceptedDeals += 1;
    this.addCorruption(accepted.corruptionCost);
    this.maybeWhisper("offer_power", now, { force: true });
    this.emitState();
    return accepted;
  }

  refuseDeal() {
    if (!this.pendingOffer) return;
    this.pendingOffer = null;
    this.state.refusedDeals += 1;
    this.emitState();
  }

  resolveChoice(decision, now) {
    if (!this.pendingChoice) return null;
    const active = this.pendingChoice;
    this.pendingChoice = null;
    const option = decision === "right" ? active.right : active.left;
    if (!option) return null;
    this.addCorruption(option.corruptionDelta ?? 0);
    this.lastChoiceAt = now;
    this.maybeWhisper("offer_power", now, { force: true });
    this.emitState();
    return {
      choiceId: active.id,
      decision,
      option
    };
  }

  shiftCorruption(amount = 0, now = 0, options = {}) {
    if (!Number.isFinite(amount) || amount === 0) return this.getState();
    this.addCorruption(amount);
    if (options?.forceWhisper) {
      this.maybeWhisper("offer_power", now, { force: true });
    }
    this.emitState();
    return this.getState();
  }

  hasPendingInteraction() {
    return Boolean(this.pendingOffer || this.pendingChoice);
  }

  offerDeal(reason, now) {
    if (this.narrationLocked) return;
    if (this.pendingOffer) return;
    if (now - this.lastOfferAt < OFFER_COOLDOWN_MS) return;

    let deal = DEALS[0];
    if (reason === "low_health") {
      deal = this.state.dominance >= 2 ? DEALS[2] : DEALS[1];
    } else if (reason === "streak") {
      deal = DEALS[0];
    }

    this.pendingOffer = deal;
    this.lastOfferAt = now;
    this.onOffer?.(deal);
    this.maybeWhisper("offer_power", now, { force: true });
  }

  maybeOfferChoice(reason, now) {
    if (this.narrationLocked) return;
    if (this.pendingChoice || this.pendingOffer) return;
    if (now - this.lastChoiceAt < CHOICE_COOLDOWN_MS) return;
    const template = CHOICES[reason];
    if (!template) return;
    const choice = {
      ...template,
      left: { ...template.left },
      right: { ...template.right }
    };
    this.pendingChoice = choice;
    this.lastChoiceAt = now;
    this.onChoice?.(choice);
    this.maybeWhisper("offer_power", now, { force: true });
  }

  updateStateFromEvent(event, now, payload) {
    switch (event) {
      case "enemy_killed":
        this.state.recentKills += 1;
        this.addCorruption(1);
        this.lastKillAt = now;
        this.killTimestamps.push(now);
        this.trimKillHistory(now);
        if (this.getRecentKillWindowCount(now) >= KILL_STREAK_TARGET) {
          this.onEvent("kill_streak", now, { internal: true });
          this.offerDeal("streak", now);
        }
        break;
      case "kill_streak":
        if (!payload?.internal) {
          this.addCorruption(3);
        } else {
          this.addCorruption(2);
        }
        if (!payload?.internal || this.state.dominance >= 1) {
          this.maybeOfferChoice("kill_streak", now);
        }
        break;
      case "low_health":
        this.maybeOfferChoice("low_health", now);
        break;
      case "player_damaged":
        this.state.damageTakenRecently += payload?.amount ?? 0;
        break;
      case "player_died":
        this.state.deaths += 1;
        this.state.deathsInCurrentRoom += 1;
        this.state.recentKills = 0;
        break;
      case "room_entered":
        this.state.roomsVisited += 1;
        this.state.deathsInCurrentRoom = 0;
        break;
      case "secret_found":
        this.addCorruption(2);
        break;
      case "chest_opened":
        this.addCorruption(1);
        break;
      case "gate_blocked":
        this.maybeOfferChoice("gate_blocked", now);
        break;
      default:
        break;
    }
  }

  addCorruption(amount) {
    this.state.corruption = Phaser.Math.Clamp(this.state.corruption + amount, 0, MAX_CORRUPTION);
    this.state.dominance = Math.floor(this.state.corruption / DOMINANCE_STEP);
  }

  maybeWhisper(event, now, opts = {}) {
    if (this.narrationLocked) {
      return;
    }
    if (!opts.force && now - this.lastWhisperAt < this.getWhisperCooldownMs()) {
      return;
    }
    const line = this.pickLine(event, opts);
    if (!line) return;
    this.lastWhisperAt = now;
    this.onWhisper?.({
      text: line,
      event
    });
  }

  pickLine(event) {
    const base = WHISPERS[event] ?? [];
    if (!base.length) return null;
    const dominanceSet = DOMINANCE_LINES[Math.min(this.state.dominance, DOMINANCE_LINES.length - 1)] ?? [];
    const behavior = this.pickBehaviorLine();
    const pool = behavior ? [...base, ...dominanceSet, behavior] : [...base, ...dominanceSet];
    return Phaser.Utils.Array.GetRandom(pool);
  }

  pickBehaviorLine() {
    if (this.state.deathsInCurrentRoom >= 3) {
      return "Same place again. Same fall.";
    }
    if (this.state.timeSinceLastKill > 22000) {
      return "You hesitate.";
    }
    if (this.state.killsInLastMinute >= 5) {
      return "At last. You are true to your nature.";
    }
    if (this.state.acceptedDeals >= 3 && this.state.refusedDeals === 0) {
      return "You chose me a long time ago.";
    }
    return null;
  }

  trimKillHistory(now) {
    const minuteAgo = now - 60000;
    this.killTimestamps = this.killTimestamps.filter((ts) => ts >= minuteAgo);
  }

  getRecentKillWindowCount(now) {
    const since = now - KILL_STREAK_WINDOW_MS;
    let count = 0;
    for (const ts of this.killTimestamps) {
      if (ts >= since) count += 1;
    }
    return count;
  }

  getWhisperCooldownMs() {
    const reduction = this.state.dominance * 700;
    return Math.max(MIN_WHISPER_COOLDOWN_MS, BASE_WHISPER_COOLDOWN_MS - reduction);
  }

  emitState() {
    this.onStateChanged?.(this.getState());
  }

  setNarrationLocked(locked) {
    this.narrationLocked = Boolean(locked);
  }

  awakenWhisper(initialCorruption = 12) {
    this.state.corruption = Math.max(this.state.corruption, initialCorruption);
    this.state.dominance = Math.floor(this.state.corruption / DOMINANCE_STEP);
    this.emitState();
  }
}
