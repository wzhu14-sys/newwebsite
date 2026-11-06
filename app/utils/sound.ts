// Web Audio API synthesized sounds - zero external audio assets needed

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * 1. 倒数计时滴答声 (Countdown Tick-Tock)
 * Authentic mechanical clock / woodblock tick-tock
 */
export function playCountdownTick(isTock: boolean = false) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    const freq = isTock ? 720 : 1080;
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.5, ctx.currentTime + 0.06);

    filter.type = "bandpass";
    filter.frequency.setValueAtTime(freq, ctx.currentTime);
    filter.Q.setValueAtTime(3.0, ctx.currentTime);

    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.07);
  } catch {
    // Ignore audio autoplay restrictions
  }
}

/**
 * 2. 机械快门厚重咔嚓声 (Mechanical Shutter Thud)
 * Heavy mechanical camera mirror reflex thud + click
 */
export function playMechanicalShutterThud() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // A. Low-frequency punch (Mirror slap / reflex thud)
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = "sine";
    subOsc.frequency.setValueAtTime(140, now);
    subOsc.frequency.exponentialRampToValueAtTime(30, now + 0.08);

    subGain.gain.setValueAtTime(0.5, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    subOsc.connect(subGain);
    subGain.connect(ctx.destination);
    subOsc.start(now);
    subOsc.stop(now + 0.09);

    // B. Mechanical shutter curtain noise
    const bufferSize = Math.floor(ctx.sampleRate * 0.12);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.35));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.setValueAtTime(1800, now);
    noiseFilter.Q.setValueAtTime(1.8, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.35, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.11);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    noise.start(now);

    // C. Spring release secondary click
    setTimeout(() => {
      try {
        if (!ctx) return;
        const t2 = ctx.currentTime;
        const springOsc = ctx.createOscillator();
        const springGain = ctx.createGain();
        springOsc.type = "triangle";
        springOsc.frequency.setValueAtTime(1400, t2);
        springOsc.frequency.exponentialRampToValueAtTime(600, t2 + 0.05);

        springGain.gain.setValueAtTime(0.2, t2);
        springGain.gain.exponentialRampToValueAtTime(0.001, t2 + 0.05);

        springOsc.connect(springGain);
        springGain.connect(ctx.destination);
        springOsc.start(t2);
        springOsc.stop(t2 + 0.05);
      } catch {}
    }, 45);
  } catch {
    // Ignore audio autoplay restrictions
  }
}

/**
 * 3. 热敏打印机“滋滋滋”吐纸音效 (Thermal Printer Whirring)
 * Stepper motor pulse burst + whirring paper feed sound
 */
export function playThermalPrinterWhir(durationSeconds: number = 1.4) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const dur = Math.max(0.6, durationSeconds);

    // Stepper motor tone modulation
    const motorOsc = ctx.createOscillator();
    const motorGain = ctx.createGain();
    motorOsc.type = "sawtooth";
    motorOsc.frequency.setValueAtTime(190, now);
    // Slight jitter in frequency like real paper feeding steps
    for (let t = 0; t < dur; t += 0.05) {
      motorOsc.frequency.setValueAtTime(180 + Math.sin(t * 40) * 20, now + t);
    }

    motorGain.gain.setValueAtTime(0.08, now);
    motorGain.gain.setValueAtTime(0.12, now + 0.1);
    motorGain.gain.setValueAtTime(0.09, now + dur - 0.2);
    motorGain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    // High frequency buzz / paper friction filter
    const motorFilter = ctx.createBiquadFilter();
    motorFilter.type = "bandpass";
    motorFilter.frequency.setValueAtTime(800, now);
    motorFilter.Q.setValueAtTime(2.0, now);

    motorOsc.connect(motorFilter);
    motorFilter.connect(motorGain);
    motorGain.connect(ctx.destination);

    motorOsc.start(now);
    motorOsc.stop(now + dur);

    // Paper friction noise (zipper-like feeding sound)
    const bufferSize = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      // Modulate noise with periodic gear pulse
      const pulse = (i % 240) < 60 ? 1 : 0.2;
      data[i] = (Math.random() * 2 - 1) * pulse;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "highpass";
    noiseFilter.frequency.setValueAtTime(2200, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.05, now);
    noiseGain.gain.setValueAtTime(0.08, now + 0.1);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    noise.start(now);
  } catch {
    // Ignore audio restrictions
  }
}
