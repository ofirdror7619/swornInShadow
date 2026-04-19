export class HungerVoice {
  constructor({ onToggle } = {}) {
    this.onToggle = onToggle;
    this.enabled = true;
    this.dominance = 0;
    this.voice = null;
    this.unlockedByUserGesture = false;
    this.isSupported =
      typeof window !== "undefined" &&
      "speechSynthesis" in window &&
      typeof window.SpeechSynthesisUtterance !== "undefined";

    this.handleVoicesChanged = () => {
      this.voice = this.pickVoice();
    };

    this.handleFirstGesture = () => {
      this.unlockedByUserGesture = true;
      window.removeEventListener("pointerdown", this.handleFirstGesture);
      window.removeEventListener("keydown", this.handleFirstGesture);
    };

    if (!this.isSupported) return;

    this.voice = this.pickVoice();
    window.speechSynthesis.onvoiceschanged = this.handleVoicesChanged;
    window.addEventListener("pointerdown", this.handleFirstGesture, { once: true });
    window.addEventListener("keydown", this.handleFirstGesture, { once: true });
  }

  setDominance(dominance = 0) {
    this.dominance = Math.max(0, Math.min(4, dominance));
  }

  toggle() {
    this.enabled = !this.enabled;
    if (!this.enabled && this.isSupported) {
      window.speechSynthesis.cancel();
    }
    this.onToggle?.(this.enabled, this.isSupported);
    return this.enabled;
  }

  speakWhisper(text) {
    return this.speak(text);
  }

  speakOffer(deal) {
    if (!deal?.title) return;
    return this.speak(`I offer you ${deal.title}. Accept, and become stronger.`);
  }

  speak(text, options = {}) {
    if (!text || typeof text !== "string") return { spoken: false, estimatedMs: 0 };

    const line = text.trim();
    if (!line) return { spoken: false, estimatedMs: 0 };
    const stylized = this.stylizeLine(line);
    const estimatedMs = this.estimateSpeechDurationMs(stylized);

    if (!this.isSupported || !this.enabled || !this.unlockedByUserGesture) {
      return { spoken: false, estimatedMs };
    }

    const voice = this.voice ?? this.pickVoice();
    const utterance = this.createUtterance(stylized, voice);
    const onEnd = options?.onEnd;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      onEnd?.();
    };
    utterance.onend = finish;
    utterance.onerror = finish;

    // Queue naturally; do not cancel active utterances.
    window.speechSynthesis.speak(utterance);

    return { spoken: true, estimatedMs };
  }

  pickVoice() {
    if (!this.isSupported) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;

    const english = voices.filter((v) => v.lang?.toLowerCase().startsWith("en"));
    if (!english.length) return voices[0];

    const darkPreferred = english.find((v) =>
      /(zira|hazel|aria|jenny|samantha|ava|alloy|natural|neural|premium|siri)/i.test(v.name)
    );
    if (darkPreferred) return darkPreferred;

    const avoid = /(espeak|sam|robot|synth|compact)/i;
    const nonRobotic = english.filter((v) => !avoid.test(v.name));
    if (nonRobotic.length) {
      return nonRobotic[0];
    }

    const preferred = english.find((v) =>
      /(david|mark|george|daniel|alex|fred|male|man|google us english|en-us)/i.test(v.name)
    );
    return preferred ?? english[0];
  }

  createUtterance(text, voice) {
    const utterance = new window.SpeechSynthesisUtterance(text);
    utterance.voice = voice ?? null;
    utterance.lang = voice?.lang || "en-US";
    const drift = (Math.random() - 0.5) * 0.02;
    utterance.rate = Math.max(0.5, Math.min(0.7, 0.62 - this.dominance * 0.025 + drift));
    utterance.pitch = Math.max(0.14, Math.min(0.36, 0.28 - this.dominance * 0.03 + drift * 0.4));
    utterance.volume = 1;
    return utterance;
  }

  stylizeLine(text) {
    let stylized = text.replace(/\s+/g, " ").trim();
    stylized = stylized.replace(/,\s*/g, ", ");
    stylized = stylized.replace(/\.\s*/g, ". ");
    stylized = stylized.replace(/\?\s*/g, "? ");
    stylized = stylized.replace(/!\s*/g, "! ");
    return stylized;
  }

  estimateSpeechDurationMs(text) {
    const words = text.split(/\s+/).filter(Boolean).length;
    const baseRate = Math.max(0.5, Math.min(0.7, 0.62 - this.dominance * 0.025));
    const wordsPerMinute = 150 * baseRate;
    const wordDurationMs = words > 0 ? (words / Math.max(1, wordsPerMinute)) * 60000 : 0;
    const punctuationPausesMs = (text.match(/[.?!]/g)?.length ?? 0) * 90;
    return Math.round(wordDurationMs + punctuationPausesMs + 140);
  }

  destroy() {
    if (!this.isSupported) return;
    window.speechSynthesis.cancel();
    window.removeEventListener("pointerdown", this.handleFirstGesture);
    window.removeEventListener("keydown", this.handleFirstGesture);
    if (window.speechSynthesis.onvoiceschanged === this.handleVoicesChanged) {
      window.speechSynthesis.onvoiceschanged = null;
    }
  }
}
