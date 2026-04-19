export class HungerVoice {
  constructor({ onToggle } = {}) {
    this.onToggle = onToggle;
    this.enabled = true;
    this.dominance = 0;
    this.voice = null;
    this.hasAnnouncedVoice = false;
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
    this.speak(text);
  }

  speakOffer(deal) {
    if (!deal?.title) return;
    this.speak(`I offer you ${deal.title}. Accept, and become stronger.`);
  }

  speak(text) {
    if (!this.isSupported || !this.enabled || !this.unlockedByUserGesture) return;
    if (!text || typeof text !== "string") return;

    const line = text.trim();
    if (!line) return;

    const voice = this.voice ?? this.pickVoice();
    const utterance = this.createUtterance(line, voice);

    // Clean and understandable, only pitch/rate tuning.
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);

    if (!this.hasAnnouncedVoice && voice?.name) {
      this.hasAnnouncedVoice = true;
      this.onToggle?.(this.enabled, this.isSupported, `The Hunger voice: ${voice.name}`);
    }
  }

  pickVoice() {
    if (!this.isSupported) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;

    const english = voices.filter((v) => v.lang?.toLowerCase().startsWith("en"));
    if (!english.length) return voices[0];

    const preferred = english.find((v) =>
      /(david|mark|george|daniel|alex|fred|male|man|google us english|en-us)/i.test(v.name)
    );
    return preferred ?? english[0];
  }

  createUtterance(text, voice) {
    const utterance = new window.SpeechSynthesisUtterance(text);
    utterance.voice = voice ?? null;
    utterance.lang = voice?.lang || "en-US";
    utterance.rate = Math.max(0.62, 0.78 - this.dominance * 0.025);
    // Approximate one-octave drop from prior profile by halving pitch range.
    utterance.pitch = Math.max(0.04, 0.12 - this.dominance * 0.02);
    utterance.volume = 1;
    return utterance;
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
