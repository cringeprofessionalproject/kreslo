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

// ───────── ГЛУБОКИЙ ТАКТИЛЬНЫЙ САУНД-ДИЗАЙН (ВЕЛЮР, МАССИВ ДЕРЕВА, САБ-ИМПАКТ, СТЕРЕО-ВОЗДУХ) ─────────

let warmSaturatorCurve: Float32Array<ArrayBuffer> | null = null;

function getWarmSaturator(ac: AudioContext): WaveShaperNode {
  if (!warmSaturatorCurve) {
    const n = 1024;
    warmSaturatorCurve = new Float32Array(new ArrayBuffer(n * 4));
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / (n - 1) - 1;
      // Мягкая ламповая сатурация tanh даёт чёткие 2-ю и 3-ю гармоники баса (слышимый саб даже на динамике телефона!)
      warmSaturatorCurve[i] = Math.tanh(x * 2.35) / Math.tanh(2.35);
    }
  }
  const shaper = ac.createWaveShaper();
  shaper.curve = warmSaturatorCurve;
  shaper.oversample = '2x';
  return shaper;
}

function connectWithPan(ac: AudioContext, source: AudioNode, pan = 0): void {
  if (typeof ac.createStereoPanner === 'function' && Math.abs(pan) > 0.01) {
    const panner = ac.createStereoPanner();
    panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), ac.currentTime);
    source.connect(panner).connect(outNode(ac));
  } else {
    source.connect(outNode(ac));
  }
}

function makeShapedNoiseBuffer(
  ac: AudioContext,
  durationSec: number,
  attackRatio = 0.14,
  decayPower = 1.65
): AudioBuffer {
  const len = Math.max(32, Math.floor(ac.sampleRate * durationSec));
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  // Лёгкая фильтрация белого шума в тёплый «бархатный» розовый спектр
  let prev = 0;
  for (let i = 0; i < len; i++) {
    const u = i / len;
    const env =
      u < attackRatio
        ? u / Math.max(0.001, attackRatio)
        : Math.pow(Math.max(0, 1 - (u - attackRatio) / (1 - attackRatio)), decayPower);
    const white = Math.random() * 2 - 1;
    prev = prev * 0.62 + white * 0.38;
    d[i] = prev * env * 1.45;
  }
  return buf;
}

/**
 * Мягкое физическое касание карточки пальцем: глубокий велюровый импульс + микро-шорох плотного картона.
 */
export function sfxCardGrab() {
  vibrate(4);
  if (profile === 'off') return;
  const ac = ensureCtx();
  if (!ac) return;
  const t = ac.currentTime;
  const jitter = 0.96 + Math.random() * 0.08;

  // 1. Тёплый низкий импульс подушечки пальца
  const sub = ac.createOscillator();
  const sg = ac.createGain();
  const sat = getWarmSaturator(ac);
  sub.type = 'sine';
  sub.frequency.setValueAtTime(98 * jitter, t);
  sub.frequency.exponentialRampToValueAtTime(44, t + 0.045);
  sg.gain.setValueAtTime(0.16, t);
  sg.gain.exponentialRampToValueAtTime(0.0008, t + 0.052);
  sub.connect(sat).connect(sg).connect(outNode(ac));
  sub.start(t);
  sub.stop(t + 0.058);

  // 2. Короткое трение матового картона 400 г/м²
  const ns = ac.createBufferSource();
  ns.buffer = makeShapedNoiseBuffer(ac, 0.032, 0.1, 2.0);
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(640 * jitter, t);
  bp.Q.value = 1.1;
  const ng = ac.createGain();
  ng.gain.setValueAtTime(0.065, t);
  ns.connect(bp).connect(ng).connect(outNode(ac));
  ns.start(t);
}

/**
 * Породистый тактильный «thock» для нажатия кнопок, пилюль и шкал (в духе смазанного PBT-свитча / колёсика часов).
 */
export function sfxUiTap(firm = false) {
  vibrate(firm ? 7 : 4);
  if (profile === 'off') return;
  const ac = ensureCtx();
  if (!ac) return;
  const t = ac.currentTime;
  const jitter = 0.96 + Math.random() * 0.08;

  const body = ac.createOscillator();
  const bg = ac.createGain();
  const sat = getWarmSaturator(ac);
  body.type = 'sine';
  body.frequency.setValueAtTime((firm ? 215 : 178) * jitter, t);
  body.frequency.exponentialRampToValueAtTime(firm ? 58 : 52, t + 0.036);
  bg.gain.setValueAtTime(firm ? 0.2 : 0.14, t);
  bg.gain.exponentialRampToValueAtTime(0.0008, t + 0.042);
  body.connect(sat).connect(bg).connect(outNode(ac));
  body.start(t);
  body.stop(t + 0.046);

  const click = ac.createBufferSource();
  click.buffer = makeShapedNoiseBuffer(ac, 0.016, 0.05, 2.4);
  const lpf = ac.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.frequency.setValueAtTime(firm ? 1550 : 1200, t);
  const cg = ac.createGain();
  cg.gain.setValueAtTime(firm ? 0.07 : 0.045, t);
  click.connect(lpf).connect(cg).connect(outNode(ac));
  click.start(t);
}

/**
 * Упругий деревянный щелчок входа карточки в зону наклона (влево / вправо).
 */
export function sfxTiltTick(dir: 'left' | 'right' = 'right') {
  vibrate(5);
  if (profile === 'off') return;
  const ac = ensureCtx();
  if (!ac) return;
  const t = ac.currentTime;
  const jitter = 0.95 + Math.random() * 0.1;
  const pan = dir === 'left' ? -0.28 : 0.28;

  // Глубокая резонансная дека (орех слева / тёплая латунь справа)
  const osc = ac.createOscillator();
  const g = ac.createGain();
  const sat = getWarmSaturator(ac);
  osc.type = 'sine';
  osc.frequency.setValueAtTime((dir === 'right' ? 235 : 198) * jitter, t);
  osc.frequency.exponentialRampToValueAtTime(64, t + 0.032);
  g.gain.setValueAtTime(0.15, t);
  g.gain.exponentialRampToValueAtTime(0.0008, t + 0.038);
  osc.connect(sat).connect(g);
  connectWithPan(ac, g, pan);
  osc.start(t);
  osc.stop(t + 0.042);

  // Микро-щелчок храповика
  const tick = ac.createOscillator();
  const tg = ac.createGain();
  tick.type = 'triangle';
  tick.frequency.setValueAtTime((dir === 'right' ? 1180 : 960) * jitter, t);
  tick.frequency.exponentialRampToValueAtTime(320, t + 0.014);
  tg.gain.setValueAtTime(0.032, t);
  tg.gain.exponentialRampToValueAtTime(0.0008, t + 0.016);
  tick.connect(tg);
  connectWithPan(ac, tg, pan);
  tick.start(t);
  tick.stop(t + 0.02);
}

/**
 * Чёткий механический «замок» (detent lock), когда палец дотянул карточку до порога принятия решения!
 */
export function sfxThresholdLock(dir: 'left' | 'right', armed = true) {
  vibrate(armed ? 10 : 4);
  if (profile === 'off') return;
  const ac = ensureCtx();
  if (!ac) return;
  const t = ac.currentTime;
  const pan = dir === 'left' ? -0.4 : 0.4;

  if (!armed) {
    // Мягкое снятие с фиксатора при возврате карточки ближе к центру
    const rel = ac.createOscillator();
    const rg = ac.createGain();
    rel.type = 'sine';
    rel.frequency.setValueAtTime(125, t);
    rel.frequency.exponentialRampToValueAtTime(58, t + 0.028);
    rg.gain.setValueAtTime(0.08, t);
    rg.gain.exponentialRampToValueAtTime(0.0008, t + 0.032);
    rel.connect(rg);
    connectWithPan(ac, rg, pan * 0.5);
    rel.start(t);
    rel.stop(t + 0.036);
    return;
  }

  // Двухфазный магнитный затвор (как фиксатор объектива Leica)
  const sat = getWarmSaturator(ac);
  const thock = ac.createOscillator();
  const tg = ac.createGain();
  thock.type = 'sine';
  thock.frequency.setValueAtTime(dir === 'right' ? 168 : 148, t);
  thock.frequency.exponentialRampToValueAtTime(48, t + 0.052);
  tg.gain.setValueAtTime(0.22, t);
  tg.gain.exponentialRampToValueAtTime(0.0008, t + 0.058);
  thock.connect(sat).connect(tg);
  connectWithPan(ac, tg, pan);
  thock.start(t);
  thock.stop(t + 0.062);

  const latch = ac.createOscillator();
  const lg = ac.createGain();
  latch.type = 'triangle';
  latch.frequency.setValueAtTime(dir === 'right' ? 520 : 430, t + 0.012);
  latch.frequency.exponentialRampToValueAtTime(165, t + 0.034);
  lg.gain.setValueAtTime(0.075, t + 0.012);
  lg.gain.exponentialRampToValueAtTime(0.0008, t + 0.038);
  latch.connect(lg);
  connectWithPan(ac, lg, pan);
  latch.start(t + 0.012);
  latch.stop(t + 0.042);
}

/**
 * Упругая посадка карточки обратно в центр колоды, если пользователь передумал отпускать.
 */
export function sfxCardSnapBack() {
  vibrate(5);
  if (profile === 'off') return;
  const ac = ensureCtx();
  if (!ac) return;
  const t = ac.currentTime;

  const sat = getWarmSaturator(ac);
  const cushion = ac.createOscillator();
  const cg = ac.createGain();
  cushion.type = 'sine';
  cushion.frequency.setValueAtTime(106, t);
  cushion.frequency.exponentialRampToValueAtTime(43, t + 0.068);
  cg.gain.setValueAtTime(0.17, t);
  cg.gain.exponentialRampToValueAtTime(0.0008, t + 0.076);
  cushion.connect(sat).connect(cg).connect(outNode(ac));
  cushion.start(t);
  cushion.stop(t + 0.082);
}

/**
 * Главный звук выбора: массивный саб-удар дубового стола + направленный стерео-свист улетающей карточки
 * + бархатный подъём следующей карточки из колоды!
 */
export function sfxSwipeCommit(dir: 'left' | 'right') {
  vibrate([14, 18, 8]);
  if (profile === 'off') return;
  const ac = ensureCtx();
  if (!ac) return;
  const t = ac.currentTime;
  const jitter = 0.96 + Math.random() * 0.08;
  const targetPan = dir === 'left' ? -0.68 : 0.68;

  // 1. Глубокий плотный саб-удар (ощущается грудной клеткой и в наушниках, и на динамике iPhone)
  const sat = getWarmSaturator(ac);
  const sub = ac.createOscillator();
  const sg = ac.createGain();
  sub.type = 'sine';
  sub.frequency.setValueAtTime((dir === 'right' ? 142 : 126) * jitter, t);
  sub.frequency.exponentialRampToValueAtTime(38, t + 0.125);
  sg.gain.setValueAtTime(0.32, t);
  sg.gain.exponentialRampToValueAtTime(0.0008, t + 0.14);
  sub.connect(sat).connect(sg);
  connectWithPan(ac, sg, targetPan * 0.32);
  sub.start(t);
  sub.stop(t + 0.15);

  // 2. Тёплый деревянный резонанс стола (180–260 Hz)
  const wood = ac.createOscillator();
  const wg = ac.createGain();
  wood.type = 'triangle';
  wood.frequency.setValueAtTime((dir === 'right' ? 275 : 230) * jitter, t);
  wood.frequency.exponentialRampToValueAtTime(78, t + 0.055);
  wg.gain.setValueAtTime(0.13, t);
  wg.gain.exponentialRampToValueAtTime(0.0008, t + 0.062);
  wood.connect(wg);
  connectWithPan(ac, wg, targetPan * 0.4);
  wood.start(t);
  wood.stop(t + 0.068);

  // 3. Широкий аэродинамический росчерк улетающей за край экрана карточки (панорамируется вслед за ней!)
  const whoosh = ac.createBufferSource();
  whoosh.buffer = makeShapedNoiseBuffer(ac, 0.19, 0.24, 1.55);
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 0.95;
  bp.frequency.setValueAtTime(290 * jitter, t);
  bp.frequency.exponentialRampToValueAtTime((dir === 'right' ? 1180 : 940) * jitter, t + 0.065);
  bp.frequency.exponentialRampToValueAtTime(260, t + 0.185);

  const wgAir = ac.createGain();
  wgAir.gain.setValueAtTime(0.22, t);
  wgAir.gain.exponentialRampToValueAtTime(0.001, t + 0.19);

  if (typeof ac.createStereoPanner === 'function') {
    const panNode = ac.createStereoPanner();
    panNode.pan.setValueAtTime(0, t);
    panNode.pan.linearRampToValueAtTime(targetPan, t + 0.17);
    whoosh.connect(bp).connect(wgAir).connect(panNode).connect(outNode(ac));
  } else {
    whoosh.connect(bp).connect(wgAir).connect(outNode(ac));
  }
  whoosh.start(t);

  // 4. Через 95 мс — мягкий бархатный выход новой карточки снизу колоды
  const dealTime = t + 0.095;
  const dealSlide = ac.createBufferSource();
  dealSlide.buffer = makeShapedNoiseBuffer(ac, 0.085, 0.22, 1.8);
  const dealLpf = ac.createBiquadFilter();
  dealLpf.type = 'bandpass';
  dealLpf.frequency.setValueAtTime(520, dealTime);
  dealLpf.frequency.exponentialRampToValueAtTime(880, dealTime + 0.07);
  dealLpf.Q.value = 1.15;
  const dg = ac.createGain();
  dg.gain.setValueAtTime(0.085, dealTime);
  dealSlide.connect(dealLpf).connect(dg).connect(outNode(ac));
  dealSlide.start(dealTime);

  const settle = ac.createOscillator();
  const setG = ac.createGain();
  settle.type = 'sine';
  settle.frequency.setValueAtTime(84, dealTime + 0.03);
  settle.frequency.exponentialRampToValueAtTime(44, dealTime + 0.095);
  setG.gain.setValueAtTime(0.11, dealTime + 0.03);
  setG.gain.exponentialRampToValueAtTime(0.0008, dealTime + 0.1);
  settle.connect(setG).connect(outNode(ac));
  settle.start(dealTime + 0.03);
  settle.stop(dealTime + 0.11);
}

export function sfxCardFlip() {
  if (profile === 'off') return;
  const ac = ensureCtx();
  if (!ac) return;
  const t = ac.currentTime;
  const jitter = 0.94 + Math.random() * 0.12;

  // Глубокий бархатный выезд колоды + тёплая басовая опора
  const sat = getWarmSaturator(ac);
  const body = ac.createOscillator();
  const bg = ac.createGain();
  body.type = 'sine';
  body.frequency.setValueAtTime(112 * jitter, t);
  body.frequency.exponentialRampToValueAtTime(46, t + 0.075);
  bg.gain.setValueAtTime(0.18, t);
  bg.gain.exponentialRampToValueAtTime(0.0008, t + 0.085);
  body.connect(sat).connect(bg).connect(outNode(ac));
  body.start(t);
  body.stop(t + 0.09);

  const ns = ac.createBufferSource();
  ns.buffer = makeShapedNoiseBuffer(ac, 0.095, 0.18, 1.7);
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(460 * jitter, t);
  bp.frequency.exponentialRampToValueAtTime(980 * jitter, t + 0.08);
  bp.Q.value = 1.05;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.12, t);
  ns.connect(bp).connect(g).connect(outNode(ac));
  ns.start(t);
}

export function sfxPopCombo(combo: number) {
  vibrate(10);
  if (profile === 'off') return;
  const ac = ensureCtx();
  if (!ac) return;
  const t = ac.currentTime;
  const scale = [196.0, 220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25];
  const freq = scale[Math.min(scale.length - 1, combo % scale.length)] * (combo >= 8 ? 1.25 : 1);

  const sat = getWarmSaturator(ac);
  const sub = ac.createOscillator();
  const sg = ac.createGain();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(120, t);
  sub.frequency.exponentialRampToValueAtTime(48, t + 0.055);
  sg.gain.setValueAtTime(0.16, t);
  sg.gain.exponentialRampToValueAtTime(0.0008, t + 0.06);
  sub.connect(sat).connect(sg).connect(outNode(ac));
  sub.start(t);
  sub.stop(t + 0.065);

  const osc = ac.createOscillator();
  const lpf = ac.createBiquadFilter();
  const g = ac.createGain();
  osc.type = 'triangle';
  lpf.type = 'lowpass';
  lpf.frequency.setValueAtTime(1400, t);
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(freq * 1.04, t + 0.09);
  g.gain.setValueAtTime(0.13, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  osc.connect(lpf).connect(g).connect(outNode(ac));
  osc.start(t);
  osc.stop(t + 0.13);
}

export function sfxCoffeeSave() {
  vibrate([14, 24, 28]);
  if (profile === 'off') return;
  const ac = ensureCtx();
  if (!ac) return;
  const t = ac.currentTime;

  // 1. Плотная постановка тяжёлой керамической кружки на стол
  const sat = getWarmSaturator(ac);
  const thud = ac.createOscillator();
  const tg = ac.createGain();
  thud.type = 'sine';
  thud.frequency.setValueAtTime(132, t);
  thud.frequency.exponentialRampToValueAtTime(45, t + 0.09);
  tg.gain.setValueAtTime(0.24, t);
  tg.gain.exponentialRampToValueAtTime(0.0008, t + 0.105);
  thud.connect(sat).connect(tg).connect(outNode(ac));
  thud.start(t);
  thud.stop(t + 0.11);

  // 2. Тёплый бархатный Rhodes-аккорд облегчения (Gmaj9 в среднем регистре, без писка)
  [196.0, 246.94, 293.66, 369.99].forEach((f, i) => {
    const osc = ac.createOscillator();
    const lpf = ac.createBiquadFilter();
    const g = ac.createGain();
    osc.type = i === 0 ? 'sine' : 'triangle';
    lpf.type = 'lowpass';
    lpf.frequency.setValueAtTime(980, t + i * 0.035);
    osc.frequency.setValueAtTime(f, t + i * 0.035);
    g.gain.setValueAtTime(0.0001, t + i * 0.035);
    g.gain.linearRampToValueAtTime(i === 0 ? 0.11 : 0.065, t + i * 0.035 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0008, t + i * 0.035 + 0.34);
    osc.connect(lpf).connect(g).connect(outNode(ac));
    osc.start(t + i * 0.035);
    osc.stop(t + i * 0.035 + 0.36);
  });
}

export function sfxGameOver() {
  vibrate([45, 35, 75]);
  if (profile === 'off') return;
  const ac = ensureCtx();
  if (!ac) return;
  const t = ac.currentTime;

  // Глубокий кинематографичный саб-дроп + мрачный минорный аккорд Severance
  const sat = getWarmSaturator(ac);
  const drop = ac.createOscillator();
  const dg = ac.createGain();
  drop.type = 'sine';
  drop.frequency.setValueAtTime(108, t);
  drop.frequency.exponentialRampToValueAtTime(33, t + 0.42);
  dg.gain.setValueAtTime(0.34, t);
  dg.gain.exponentialRampToValueAtTime(0.001, t + 0.48);
  drop.connect(sat).connect(dg).connect(outNode(ac));
  drop.start(t);
  drop.stop(t + 0.5);

  [146.83, 174.61, 220.0, 261.63].forEach((f, i) => {
    const osc = ac.createOscillator();
    const lpf = ac.createBiquadFilter();
    const g = ac.createGain();
    osc.type = 'sawtooth';
    lpf.type = 'lowpass';
    lpf.frequency.setValueAtTime(580, t + 0.02);
    lpf.frequency.exponentialRampToValueAtTime(210, t + 0.58);
    osc.frequency.setValueAtTime(f, t + i * 0.04);
    osc.frequency.linearRampToValueAtTime(f * 0.985, t + 0.56);
    g.gain.setValueAtTime(0.065, t + i * 0.04);
    g.gain.exponentialRampToValueAtTime(0.0008, t + 0.62);
    osc.connect(lpf).connect(g).connect(outNode(ac));
    osc.start(t + i * 0.04);
    osc.stop(t + 0.65);
  });
}

export function sfxVictory() {
  vibrate([18, 26, 18, 30, 55]);
  if (profile === 'off') return;
  const ac = ensureCtx();
  if (!ac) return;
  const t = ac.currentTime;

  // Мягкий глубокий литавровый саб-удар + благородный тёплый аккорд Cmaj9
  const sat = getWarmSaturator(ac);
  const timp = ac.createOscillator();
  const tg = ac.createGain();
  timp.type = 'sine';
  timp.frequency.setValueAtTime(118, t);
  timp.frequency.exponentialRampToValueAtTime(48, t + 0.22);
  tg.gain.setValueAtTime(0.26, t);
  tg.gain.exponentialRampToValueAtTime(0.0008, t + 0.26);
  timp.connect(sat).connect(tg).connect(outNode(ac));
  timp.start(t);
  timp.stop(t + 0.28);

  [130.81, 196.0, 246.94, 293.66, 329.63].forEach((f, i) => {
    const osc = ac.createOscillator();
    const lpf = ac.createBiquadFilter();
    const g = ac.createGain();
    osc.type = i === 0 ? 'sine' : 'triangle';
    lpf.type = 'lowpass';
    lpf.frequency.setValueAtTime(1150, t + i * 0.045);
    osc.frequency.setValueAtTime(f, t + i * 0.045);
    g.gain.setValueAtTime(0.0001, t + i * 0.045);
    g.gain.linearRampToValueAtTime(i === 0 ? 0.12 : 0.075, t + i * 0.045 + 0.022);
    g.gain.exponentialRampToValueAtTime(0.0008, t + i * 0.045 + 0.46);
    osc.connect(lpf).connect(g).connect(outNode(ac));
    osc.start(t + i * 0.045);
    osc.stop(t + i * 0.045 + 0.5);
  });
}
