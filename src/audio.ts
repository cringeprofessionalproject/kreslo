import type { PackCategory } from './types';

export type SoundProfile = 'groove' | 'asmr' | 'classic' | 'off';

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let recordDest: MediaStreamAudioDestinationNode | null = null;

let classicAudioEl: HTMLAudioElement | null = null;
let voiceEl: HTMLAudioElement | null = null;

let profile: SoundProfile = 'groove';
let unlocked = false;
let grooveTimer: number | null = null;
let stepCounter = 0;

let activeCategory: PackCategory = 'tech_b2b';
let activeBlock: 1 | 2 | 3 = 1;
let dangerActive = false;
let micDuckActive = false;

function applyIosAudioSession(type: 'ambient' | 'playback' | 'play-and-record') {
  try {
    const nav = navigator as unknown as { audioSession?: { type: string } };
    if (nav.audioSession) {
      nav.audioSession.type = type;
    }
  } catch {
    // ignore on browsers without navigator.audioSession
  }
}

function ensureCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AC) {
      ctx = new AC();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.85;
      masterGain.connect(ctx.destination);
      try {
        recordDest = ctx.createMediaStreamDestination();
        masterGain.connect(recordDest);
        // Неслышимый тактовый сигнал, чтобы MediaRecorder на iOS Safari не «замораживал» таймкоды .mp4 в тишине!
        const keepAliveOsc = ctx.createOscillator();
        const keepAliveGain = ctx.createGain();
        keepAliveOsc.frequency.value = 220;
        keepAliveGain.gain.value = 0.00001;
        keepAliveOsc.connect(keepAliveGain).connect(recordDest);
        keepAliveOsc.start();
      } catch {
        recordDest = null;
      }
      applyIosAudioSession('ambient');
    }
  }
  if (ctx && ctx.state === 'suspended') {
    void ctx.resume().catch(() => {});
  }
  return ctx;
}

function outNode(ac: AudioContext): AudioNode {
  return masterGain ?? ac.destination;
}

export function vibrate(ms: number | number[]) {
  try {
    if (profile !== 'off' && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(ms);
    }
  } catch {
    // ignore
  }
}

export function setGameMusicContext(category: PackCategory | undefined, blockNum: 1 | 2 | 3, inDanger: boolean) {
  activeCategory = category ?? 'tech_b2b';
  activeBlock = blockNum;
  dangerActive = inDanger;
}

export function setMicRecordingDuck(active: boolean) {
  micDuckActive = active;
  applyIosAudioSession(active ? 'play-and-record' : 'ambient');
  syncBackgroundMusic();
}

/**
 * Возвращает цифровой аудиопоток игры (или микс микрофона + ASMR-штампов игры)
 * для записи в вертикальный .mp4 ролик — видео никогда не будет немым!
 */
export function buildMixedRecordingStream(micStream?: MediaStream | null): MediaStream | null {
  const ac = ensureCtx();
  if (!ac || !recordDest) return micStream ?? null;

  if (micStream && micStream.getAudioTracks().length > 0) {
    try {
      const micSource = ac.createMediaStreamSource(micStream);
      const hp = ac.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 85;
      const micGain = ac.createGain();
      micGain.gain.value = 1.15;
      micSource.connect(hp).connect(micGain).connect(recordDest);
    } catch {
      return micStream;
    }
  }

  return recordDest.stream;
}

// ───────── АДАПТИВНЫЙ ПРОЦЕДУРНЫЙ ГРУВ (В ДУХЕ SEVERANCE × REIGNS × BALATRO) ─────────

const CHORD_PROGRESSIONS: Record<string, number[][]> = {
  // Прохладный нео-нуар Rhodes (Severance vibe для Продакта, ИБ, НИИ, Финдира)
  tech_b2b: [
    [146.83, 220.0, 261.63, 329.63], // Dm9
    [130.81, 196.0, 246.94, 293.66], // Cmaj9
    [116.54, 174.61, 220.0, 261.63], // Bbmaj7
    [110.0, 164.81, 207.65, 246.94], // A7alt
  ],
  // Тёплый синкопированный Wurlitzer (для SMM, WB, ПВЗ, HR)
  market_media: [
    [174.61, 220.0, 261.63, 329.63], // Fmaj7
    [164.81, 196.0, 246.94, 293.66], // Em7
    [146.83, 174.61, 220.0, 261.63], // Dm7
    [196.0, 246.94, 293.66, 349.23], // G7
  ],
  // Камерное приглушённое пианино (для Хирурга, Ремонта, Бариста)
  real_sector: [
    [164.81, 246.94, 293.66, 369.99], // Em9
    [130.81, 196.0, 246.94, 329.63], // Cmaj7
    [110.0, 164.81, 220.0, 261.63], // Am7
    [123.47, 185.0, 233.08, 293.66], // B7sus
  ],
};

function triggerProceduralGrooveStep() {
  if (profile !== 'groove' || !unlocked || micDuckActive) return;
  const ac = ensureCtx();
  if (!ac) return;

  const t = ac.currentTime;
  const prog = CHORD_PROGRESSIONS[activeCategory] ?? CHORD_PROGRESSIONS.tech_b2b;
  const chordIdx = Math.floor(stepCounter / 8) % prog.length;
  const beatInBar = stepCounter % 8;
  const chord = prog[chordIdx];

  // 1. Мягкий Rhodes/Wurlitzer аккорд с воздухом (на 0-й и редкой синкопе 5-й доли)
  if (beatInBar === 0 || (activeBlock >= 2 && beatInBar === 5)) {
    const detuneWobble = dangerActive ? (Math.random() - 0.5) * 18 : 0;
    chord.slice(1).forEach((freq, idx) => {
      const osc = ac.createOscillator();
      const lpf = ac.createBiquadFilter();
      const g = ac.createGain();

      osc.type = activeCategory === 'market_media' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, t + idx * 0.018);
      osc.detune.setValueAtTime(detuneWobble, t);

      lpf.type = 'lowpass';
      lpf.frequency.setValueAtTime(dangerActive ? 1450 : 920, t);

      const peak = beatInBar === 0 ? 0.032 : 0.018;
      g.gain.setValueAtTime(0.0001, t + idx * 0.018);
      g.gain.linearRampToValueAtTime(peak, t + idx * 0.018 + 0.035);
      g.gain.exponentialRampToValueAtTime(0.0008, t + 1.35);

      osc.connect(lpf).connect(g).connect(outNode(ac));
      osc.start(t + idx * 0.018);
      osc.stop(t + 1.4);
    });
  }

  // 2. Упругий суб-бас (не спорит с речью, <160 Гц)
  if (beatInBar === 0 || (activeBlock >= 2 && beatInBar === 4)) {
    const root = chord[0] * 0.5;
    const sub = ac.createOscillator();
    const sg = ac.createGain();
    sub.type = 'triangle';
    sub.frequency.setValueAtTime(root, t);
    sg.gain.setValueAtTime(0.055, t);
    sg.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
    sub.connect(sg).connect(outNode(ac));
    sub.start(t);
    sub.stop(t + 0.45);
  }

  // 3. Деликатная щётка / часовой тик со второго Блока (или при опасности)
  if ((activeBlock >= 2 || dangerActive) && beatInBar % 2 === 1) {
    const len = Math.floor(ac.sampleRate * 0.025);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const ns = ac.createBufferSource();
    ns.buffer = buf;
    const hp = ac.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 4200;
    const ng = ac.createGain();
    ng.gain.value = 0.018;
    ns.connect(hp).connect(ng).connect(outNode(ac));
    ns.start(t);
  }

  // 4. Напряжённый пульс на Блоке III или в красной зоне
  if ((activeBlock === 3 || dangerActive) && (beatInBar === 2 || beatInBar === 6)) {
    const arp = ac.createOscillator();
    const ag = ac.createGain();
    arp.type = 'sine';
    arp.frequency.setValueAtTime(chord[2] * 2, t);
    ag.gain.setValueAtTime(0.014, t);
    ag.gain.exponentialRampToValueAtTime(0.0008, t + 0.16);
    arp.connect(ag).connect(outNode(ac));
    arp.start(t);
    arp.stop(t + 0.18);
  }

  stepCounter += 1;
}

function triggerProceduralAmbientPad() {
  if (profile !== 'classic' || !unlocked || micDuckActive) return;
  const ac = ensureCtx();
  if (!ac) return;
  const t = ac.currentTime;
  const prog = CHORD_PROGRESSIONS[activeCategory] ?? CHORD_PROGRESSIONS.tech_b2b;
  const chord = prog[Math.floor(stepCounter / 4) % prog.length];
  stepCounter += 1;

  chord.forEach((freq, idx) => {
    const osc = ac.createOscillator();
    const lpf = ac.createBiquadFilter();
    const g = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(idx === 0 ? freq * 0.5 : freq, t);
    lpf.type = 'lowpass';
    lpf.frequency.setValueAtTime(640, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(idx === 0 ? 0.026 : 0.015, t + 0.6);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 2.7);
    osc.connect(lpf).connect(g).connect(outNode(ac));
    osc.start(t);
    osc.stop(t + 2.8);
  });
}

function syncBackgroundMusic(_duckVoice = false) {
  if (typeof window === 'undefined') return;

  if (grooveTimer !== null) {
    window.clearInterval(grooveTimer);
    grooveTimer = null;
  }

  if (!unlocked || micDuckActive) return;

  if (profile === 'groove') {
    grooveTimer = window.setInterval(triggerProceduralGrooveStep, 340);
  } else if (profile === 'classic') {
    triggerProceduralAmbientPad();
    grooveTimer = window.setInterval(triggerProceduralAmbientPad, 2400);
  }
}

export function initSound(initialMutedOrProfile: boolean | SoundProfile = false) {
  if (typeof initialMutedOrProfile === 'boolean') {
    profile = initialMutedOrProfile ? 'off' : 'groove';
  } else {
    profile = initialMutedOrProfile;
  }
  if (typeof window === 'undefined') return () => {};

  const unlock = () => {
    unlocked = true;
    ensureCtx();
    syncBackgroundMusic();
  };
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock, { passive: true });
  return () => {
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
    classicAudioEl?.pause();
    if (grooveTimer !== null) {
      window.clearInterval(grooveTimer);
      grooveTimer = null;
    }
  };
}

export function setAudioMuted(nextMuted: boolean) {
  profile = nextMuted ? 'off' : profile === 'off' ? 'groove' : profile;
  syncBackgroundMusic();
}

export function setSoundProfile(next: SoundProfile) {
  profile = next;
  if (next !== 'off') {
    applyIosAudioSession('playback');
  }
  syncBackgroundMusic();
}

export function getSoundProfile(): SoundProfile {
  return profile;
}

export function playVoice(url: string) {
  if (profile === 'off' || typeof window === 'undefined') return;
  ensureCtx();
  if (voiceEl) {
    voiceEl.pause();
    voiceEl = null;
  }
  const el = new Audio(url);
  el.volume = 0.88;
  voiceEl = el;
  syncBackgroundMusic(true);
  const done = () => {
    if (voiceEl === el) {
      voiceEl = null;
      syncBackgroundMusic(false);
    }
  };
  el.onended = done;
  el.onerror = done;
  void el.play().catch(done);
}

// ───────── ТАКТИЛЬНЫЕ КАНЦЕЛЯРСКИЕ ASMR-ФОЛИ (ШОРОХ ПАПКИ, ШТАМП, ПОДСТАКАННИК) ─────────

export function sfxTiltTick() {
  vibrate(5);
  if (profile === 'off') return;
  const ac = ensureCtx();
  if (!ac) return;
  const t = ac.currentTime;
  const jitter = 0.94 + Math.random() * 0.12;

  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(620 * jitter, t);
  osc.frequency.exponentialRampToValueAtTime(820 * jitter, t + 0.022);
  g.gain.setValueAtTime(0.038, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.026);
  osc.connect(g).connect(outNode(ac));
  osc.start(t);
  osc.stop(t + 0.03);
}

export function sfxSwipeCommit(dir: 'left' | 'right') {
  vibrate(14);
  if (profile === 'off') return;
  const ac = ensureCtx();
  if (!ac) return;
  const t = ac.currentTime;
  const jitter = 0.95 + Math.random() * 0.1;

  // 1. Хруст плотной бумаги карточки
  const len = Math.floor(ac.sampleRate * 0.075);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    d[i] = (Math.random() * 2 - 1) * Math.sin((i / len) * Math.PI);
  }
  const noise = ac.createBufferSource();
  noise.buffer = buf;
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 1.4;
  bp.frequency.setValueAtTime((dir === 'right' ? 1650 : 1180) * jitter, t);
  const ng = ac.createGain();
  ng.gain.setValueAtTime(0.15, t);
  noise.connect(bp).connect(ng).connect(outNode(ac));
  noise.start(t);

  // 2. Упругий удар канцелярского штампа (Papers, Please thump)
  const stamp = ac.createOscillator();
  const sg = ac.createGain();
  stamp.type = 'sine';
  stamp.frequency.setValueAtTime((dir === 'right' ? 155 : 130) * jitter, t);
  stamp.frequency.exponentialRampToValueAtTime(46, t + 0.085);
  sg.gain.setValueAtTime(0.18, t);
  sg.gain.exponentialRampToValueAtTime(0.001, t + 0.095);
  stamp.connect(sg).connect(outNode(ac));
  stamp.start(t);
  stamp.stop(t + 0.1);
}

export function sfxCardFlip() {
  if (profile === 'off') return;
  const ac = ensureCtx();
  if (!ac) return;
  const t = ac.currentTime;
  const jitter = 0.92 + Math.random() * 0.16;

  // Тактильный шорох выезжающего бумажного досье вместо «электронного пузырька»
  const len = Math.floor(ac.sampleRate * 0.06);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const env = Math.pow(1 - i / len, 1.4);
    d[i] = (Math.random() * 2 - 1) * env;
  }
  const ns = ac.createBufferSource();
  ns.buffer = buf;
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(1480 * jitter, t);
  bp.Q.value = 1.2;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.09, t);
  ns.connect(bp).connect(g).connect(outNode(ac));
  ns.start(t);
}

export function sfxPopCombo(combo: number) {
  vibrate(10);
  if (profile === 'off') return;
  const ac = ensureCtx();
  if (!ac) return;
  const t = ac.currentTime;
  const scale = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5];
  const freq = scale[Math.min(scale.length - 1, combo % scale.length)] * (combo >= 8 ? 1.25 : 1);

  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq * 0.78, t);
  osc.frequency.exponentialRampToValueAtTime(freq * 1.25, t + 0.07);
  g.gain.setValueAtTime(0.14, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.085);
  osc.connect(g).connect(outNode(ac));
  osc.start(t);
  osc.stop(t + 0.09);
}

export function sfxCoffeeSave() {
  vibrate([15, 25, 30]);
  if (profile === 'off') return;
  const ac = ensureCtx();
  if (!ac) return;
  const t = ac.currentTime;

  // Лёгкий звон ложечки о подстаканник + тёплый аккорд
  const clink = ac.createOscillator();
  const cg = ac.createGain();
  clink.type = 'sine';
  clink.frequency.setValueAtTime(2349.3, t);
  cg.gain.setValueAtTime(0.06, t);
  cg.gain.exponentialRampToValueAtTime(0.0008, t + 0.18);
  clink.connect(cg).connect(outNode(ac));
  clink.start(t);
  clink.stop(t + 0.19);

  [440, 554.37, 659.25, 880].forEach((f, i) => {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(f, t + i * 0.05);
    g.gain.setValueAtTime(0.09, t + i * 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.05 + 0.2);
    osc.connect(g).connect(outNode(ac));
    osc.start(t + i * 0.05);
    osc.stop(t + i * 0.05 + 0.22);
  });
}

export function sfxGameOver() {
  vibrate([50, 40, 80]);
  if (profile === 'off') return;
  const ac = ensureCtx();
  if (!ac) return;
  const t = ac.currentTime;
  [246.94, 196, 146.83].forEach((f, i) => {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = 'sawtooth';
    const lpf = ac.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.value = 900;
    osc.frequency.setValueAtTime(f, t + i * 0.12);
    g.gain.setValueAtTime(0.11, t + i * 0.12);
    g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.12 + 0.28);
    osc.connect(lpf).connect(g).connect(outNode(ac));
    osc.start(t + i * 0.12);
    osc.stop(t + i * 0.12 + 0.3);
  });
}

export function sfxVictory() {
  vibrate([20, 30, 20, 30, 60]);
  if (profile === 'off') return;
  const ac = ensureCtx();
  if (!ac) return;
  const t = ac.currentTime;
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(f, t + i * 0.08);
    g.gain.setValueAtTime(0.11, t + i * 0.08);
    g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.32);
    osc.connect(g).connect(outNode(ac));
    osc.start(t + i * 0.08);
    osc.stop(t + i * 0.08 + 0.35);
  });
}
