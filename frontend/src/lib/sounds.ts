const STORAGE_KEY = "whatif-sound-muted";

class SoundManager {
  private ctx: AudioContext | null = null;
  private _muted: boolean;
  private ambientGain: GainNode | null = null;
  private ambientOscillators: OscillatorNode[] = [];
  private ambientRunning = false;

  constructor() {
    this._muted =
      typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) !== "false" : true;
  }

  private getContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    return this.ctx;
  }

  get muted(): boolean {
    return this._muted;
  }

  setMuted(muted: boolean): void {
    this._muted = muted;
    try {
      localStorage.setItem(STORAGE_KEY, String(!muted));
    } catch {
      // localStorage unavailable
    }
    if (muted) {
      this.stopAmbient();
    }
  }

  /** Ambient cosmic drone — very quiet layered sine oscillators */
  startAmbient(): void {
    if (this._muted || this.ambientRunning) return;
    const ctx = this.getContext();
    this.ambientGain = ctx.createGain();
    this.ambientGain.gain.value = 0;
    this.ambientGain.gain.linearRampToValueAtTime(0.025, ctx.currentTime + 3);
    this.ambientGain.connect(ctx.destination);

    const freqs = [55, 82.5, 110, 165];
    for (const freq of freqs) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;

      const lfo = ctx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = 0.08 + Math.random() * 0.15;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = freq * 0.004;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start();

      const nodeGain = ctx.createGain();
      nodeGain.gain.value = freq === 55 ? 0.4 : 0.12;
      osc.connect(nodeGain);
      nodeGain.connect(this.ambientGain);
      osc.start();

      this.ambientOscillators.push(osc, lfo);
    }
    this.ambientRunning = true;
  }

  stopAmbient(): void {
    if (!this.ambientRunning) return;
    if (this.ambientGain && this.ctx) {
      this.ambientGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1);
    }
    const oscs = this.ambientOscillators;
    this.ambientOscillators = [];
    setTimeout(() => {
      for (const osc of oscs) {
        try {
          osc.stop();
        } catch {
          // already stopped
        }
      }
      this.ambientGain = null;
      this.ambientRunning = false;
    }, 1200);
  }

  /** Short subtle click */
  playClick(): void {
    if (this._muted) return;
    const ctx = this.getContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.08;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.06);
  }

  /** Whoosh — filtered noise sweep for new branches */
  playWhoosh(): void {
    if (this._muted) return;
    const ctx = this.getContext();

    const bufferSize = Math.floor(ctx.sampleRate * 0.7);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 200;
    filter.frequency.exponentialRampToValueAtTime(2500, ctx.currentTime + 0.5);
    filter.Q.value = 1.2;

    const gain = ctx.createGain();
    gain.gain.value = 0.12;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start();
  }

  /** Rising portal sound for generation start */
  playPortalOpen(): void {
    if (this._muted) return;
    const ctx = this.getContext();
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 80;
    osc.frequency.exponentialRampToValueAtTime(500, ctx.currentTime + 1);
    const gain = ctx.createGain();
    gain.gain.value = 0.08;
    gain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 0.5);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 1.2);
  }

  /** Pleasant major chord for generation complete */
  playSuccess(): void {
    if (this._muted) return;
    const ctx = this.getContext();
    const master = ctx.createGain();
    master.gain.value = 0.06;
    master.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.4);
    master.connect(ctx.destination);

    const freqs = [261.63, 329.63, 392.0]; // C-E-G
    for (let i = 0; i < freqs.length; i++) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freqs[i];
      osc.connect(master);
      osc.start(ctx.currentTime + i * 0.08);
      osc.stop(ctx.currentTime + 1.4);
    }
  }

  /** Dissonant warning for errors */
  playError(): void {
    if (this._muted) return;
    const ctx = this.getContext();
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = 200;
    osc.frequency.linearRampToValueAtTime(140, ctx.currentTime + 0.3);
    const gain = ctx.createGain();
    gain.gain.value = 0.05;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  }

  /** Paradox detection sound — eerie descending tone */
  playParadox(): void {
    if (this._muted) return;
    const ctx = this.getContext();
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = 600;
    osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.6);
    const gain = ctx.createGain();
    gain.gain.value = 0.07;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.7);
  }

  /** Text-to-speech using browser Speech Synthesis */
  speak(text: string): void {
    if (this._muted || typeof speechSynthesis === "undefined") return;
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 0.85;
    speechSynthesis.speak(utterance);
  }

  stopSpeaking(): void {
    if (typeof speechSynthesis !== "undefined") {
      speechSynthesis.cancel();
    }
  }
}

export const soundManager: SoundManager | null =
  typeof window !== "undefined" ? new SoundManager() : null;
