export class WhisperVoice {
  constructor({ onToggle } = {}) {
    this.onToggle = onToggle;
    this.enabled = true;
    this.dominance = 0;
    this.voice = null;
    this.unlockedByUserGesture = false;
    this.speakQueue = Promise.resolve();

    this.isBrowserTtsSupported =
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

    if (typeof window !== "undefined") {
      window.addEventListener("pointerdown", this.handleFirstGesture, { once: true });
      window.addEventListener("keydown", this.handleFirstGesture, { once: true });
    }

    if (!this.isBrowserTtsSupported) return;
    this.voice = this.pickVoice();
    window.speechSynthesis.onvoiceschanged = this.handleVoicesChanged;
  }

  setDominance(dominance = 0) {
    this.dominance = Math.max(0, Math.min(4, dominance));
  }

  toggle() {
    this.enabled = !this.enabled;
    if (!this.enabled) {
      this.cancelActiveSpeech();
    }
    this.onToggle?.(this.enabled, this.isBrowserTtsSupported);
    return this.enabled;
  }

  speakWhisper(text, options = {}) {
    return this.speak(text, { ...options, channel: "whisper" });
  }

  speakOffer(deal) {
    if (!deal?.title) return { spoken: false, estimatedMs: 0 };
    return this.speak(`I offer you ${deal.title}. Accept, and become stronger.`, {
      channel: "offer",
      event: "offer_power"
    });
  }

  speak(text, options = {}) {
    if (!text || typeof text !== "string") return { spoken: false, estimatedMs: 0 };

    const line = text.trim();
    if (!line) return { spoken: false, estimatedMs: 0 };

    const stylized = this.stylizeLine(line);
    const estimatedMs = this.estimateSpeechDurationMs(stylized);

    if (!this.enabled) {
      return { spoken: false, estimatedMs };
    }

    if (this.isBrowserTtsSupported && this.unlockedByUserGesture) {
      this.enqueueSpeech(async () => {
        await this.playBrowserSpeech(stylized);
      }, options?.onEnd);
      return { spoken: true, estimatedMs };
    }

    return { spoken: false, estimatedMs };
  }

  enqueueSpeech(task, onEnd) {
    this.speakQueue = this.speakQueue
      .catch(() => undefined)
      .then(async () => {
        if (!this.enabled) return;
        try {
          await task();
        } finally {
          onEnd?.();
        }
      })
      .catch(() => {
        onEnd?.();
      });
  }

  playBrowserSpeech(text) {
    return new Promise((resolve) => {
      if (!this.isBrowserTtsSupported) {
        resolve();
        return;
      }

      const voice = this.voice ?? this.pickVoice();
      const utterance = this.createUtterance(text, voice);

      let finished = false;
      const done = () => {
        if (finished) return;
        finished = true;
        resolve();
      };

      utterance.onend = done;
      utterance.onerror = done;
      window.speechSynthesis.speak(utterance);
    });
  }

  cancelActiveSpeech() {
    if (this.isBrowserTtsSupported) {
      window.speechSynthesis.cancel();
    }
  }

  pickVoice() {
    if (!this.isBrowserTtsSupported) return null;
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
    if (nonRobotic.length) return nonRobotic[0];

    return english[0];
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
    this.cancelActiveSpeech();
    if (typeof window === "undefined") return;
    window.removeEventListener("pointerdown", this.handleFirstGesture);
    window.removeEventListener("keydown", this.handleFirstGesture);
    if (this.isBrowserTtsSupported && window.speechSynthesis.onvoiceschanged === this.handleVoicesChanged) {
      window.speechSynthesis.onvoiceschanged = null;
    }
  }
}
