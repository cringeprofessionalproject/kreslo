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

// ───────── НАТИВНАЯ ВИБРАЦИЯ TAPTIC ENGINE НА IPHONE (TRUSTED <label><input switch>) + TELEGRAM + ANDROID ─────────

function isIosTouchDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/**
 * В новых версиях iOS Safari программный `label.click()` из JS заблокирован от вызова Taptic Engine:
 * вибрация срабатывает ТОЛЬКО при прямом физическом касании пальцем (`e.isTrusted === true`) прозрачного `<label>`,
 * связанного с `<input type="checkbox" switch>` (механизм ios-haptics v3.3).
 */
export function wireIosHapticLabelToButton(btn: HTMLElement) {
  if (!btn || typeof document === 'undefined' || !isIosTouchDevice()) return;
  if (btn.hasAttribute('data-no-haptic')) return;
  if (btn.querySelector(':scope > label[data-haptic-trigger]')) return;

  const isInlineCardChoice = btn.hasAttribute('data-inline-choice');
  const computedPos = window.getComputedStyle(btn).position;
  if (computedPos === 'static') {
    btn.style.position = 'relative';
  }

  const label = document.createElement('label');
  label.setAttribute('data-haptic-trigger', '');
  label.setAttribute('aria-hidden', 'true');
  Object.assign(label.style, {
    position: 'absolute',
    inset: '0',
    zIndex: '4',
    cursor: 'inherit',
    touchAction: isInlineCardChoice ? 'none' : 'manipulation',
  });
  label.style.setProperty('-webkit-tap-highlight-color', 'transparent');

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.tabIndex = -1;
  input.setAttribute('switch', '');
  Object.assign(input.style, {
    position: 'absolute',
    width: '1px',
    height: '1px',
    margin: '0',
    padding: '0',
    opacity: '0',
    visibility: 'hidden',
    pointerEvents: 'none',
  });
  // Останавливаем второй синтетический click от <input>, чтобы родительский <button> сработал ровно 1 раз!
  input.addEventListener('click', (e) => e.stopPropagation());

  label.appendChild(input);
  btn.insertAdjacentElement('beforeend', label);
}

function scanAndWireIosHaptics() {
  if (typeof document === 'undefined' || !isIosTouchDevice()) return;
  const buttons = document.querySelectorAll<HTMLElement>('button:not([data-no-haptic])');
  buttons.forEach(wireIosHapticLabelToButton);
}

let pendingGestureSwitchPulse = false;
let fallbackSwitchLabel: HTMLLabelElement | null = null;

function pulseFallbackSwitchInViewport() {
  if (typeof document === 'undefined' || !document.body || !isIosTouchDevice()) return;
  if (!fallbackSwitchLabel || !document.body.contains(fallbackSwitchLabel)) {
    const lbl = document.createElement('label');
    lbl.setAttribute('aria-hidden', 'true');
    Object.assign(lbl.style, {
      position: 'fixed',
      bottom: '2px',
      left: '2px',
      width: '1px',
      height: '1px',
      opacity: '0',
      pointerEvents: 'none',
      zIndex: '-1',
    });
    const inp = document.createElement('input');
    inp.type = 'checkbox';
    inp.tabIndex = -1;
    inp.setAttribute('switch', '');
    Object.assign(inp.style, {
      width: '1px',
      height: '1px',
      margin: '0',
      visibility: 'hidden',
    });
    inp.addEventListener('click', (ev) => ev.stopPropagation());
    lbl.appendChild(inp);
    document.body.appendChild(lbl);
    fallbackSwitchLabel = lbl;
  }
  fallbackSwitchLabel.click();
}

export function triggerHaptic(
  style: 'selection' | 'light' | 'medium' | 'success' | 'error' = 'light',
  allowIosSwitchClick = false
) {
  try {
    // 1. Нативный Taptic Engine внутри Telegram WebApp (iPhone + Android)
    const tgHaptic = (
      window as unknown as {
        Telegram?: {
          WebApp?: {
            HapticFeedback?: {
              selectionChanged?: () => void;
              impactOccurred?: (s: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
              notificationOccurred?: (t: 'error' | 'success' | 'warning') => void;
            };
          };
        };
      }
    ).Telegram?.WebApp?.HapticFeedback;

    if (tgHaptic) {
      if (style === 'selection') tgHaptic.selectionChanged?.();
      else if (style === 'success' || style === 'error') tgHaptic.notificationOccurred?.(style);
      else tgHaptic.impactOccurred?.(style === 'medium' ? 'medium' : 'light');
    }

    // 2. Вибромотор Android (Web Vibration API)
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      const pattern =
        style === 'selection'
          ? 6
          : style === 'light'
            ? 10
            : style === 'medium'
              ? 16
              : style === 'success'
                ? [10, 26, 14]
                : [18, 30, 22];
      navigator.vibrate(pattern);
    }

    // 3. Очередь импульса для touchend/click на iOS 18.0–18.1 при свайпе
    if (allowIosSwitchClick && isIosTouchDevice()) {
      pendingGestureSwitchPulse = true;
      pulseFallbackSwitchInViewport();
    }
  } catch {
    // ignore
  }
}

export function vibrate(ms: number | number[]) {
  const isStrong = Array.isArray(ms) || ms >= 12;
  triggerHaptic(isStrong ? 'medium' : 'light', true);
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

  const onTouchEndFlush = () => {
    if (pendingGestureSwitchPulse) {
      pendingGestureSwitchPulse = false;
      pulseFallbackSwitchInViewport();
    }
  };

  let rafWire = 0;
  const scheduleWire = () => {
    if (rafWire) return;
    rafWire = window.requestAnimationFrame(() => {
      rafWire = 0;
      scanAndWireIosHaptics();
    });
  };

  scanAndWireIosHaptics();
  const observer =
    typeof MutationObserver !== 'undefined' && isIosTouchDevice()
      ? new MutationObserver(scheduleWire)
      : null;
  if (observer && document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }

  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('touchend', onTouchEndFlush, { passive: true });
  window.addEventListener('keydown', unlock, { passive: true });
  return () => {
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('touchend', onTouchEndFlush);
    window.removeEventListener('keydown', unlock);
    observer?.disconnect();
    if (rafWire) window.cancelAnimationFrame(rafWire);
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

// ───────── ДЕЛИКАТНЫЕ МИКРО-ТАКТИЛЬНЫЕ ЗВУКИ (APPLE TAPTIC MICRO-IMPULSES: 7–22 мс, НЕЖНЫЕ И НЕЗАМЕТНЫЕ) ─────────

function connectWithPan(ac: AudioContext, source: AudioNode, pan = 0): void {
  if (typeof ac.createStereoPanner === 'function' && Math.abs(pan) > 0.01) {
    const panner = ac.createStereoPanner();
    panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), ac.currentTime);
    source.connect(panner).connect(outNode(ac));
  } else {
    source.connect(outNode(ac));
  }
}

/**
 * Сверхкороткий (7–22 мс) чистый синусоидальный микро-импульс короче порога восприятия ноты ухом (~20 мс).
 * На динамике телефона диффузор делает один деликатный мягкий ход — звук не отвлекает и ощущается пальцами как живая тактильная отдача.
 */
function playMicroTapticPulse(
  ac: AudioContext,
  startHz: number,
  endHz: number,
  durationSec: number,
  peakGain: number,
  pan = 0,
  delaySec = 0
) {
  const t = ac.currentTime + delaySec;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(startHz, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(32, endHz), t + durationSec);

  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peakGain, t + Math.min(0.0025, durationSec * 0.2));
  g.gain.exponentialRampToValueAtTime(0.0001, t + durationSec);

  osc.connect(g);
  connectWithPan(ac, g, pan);
  osc.start(t);
  osc.stop(t + durationSec + 0.004);
}

function playSoftSilkWhisper(
  ac: AudioContext,
  durationSec: number,
  peakGain: number,
  pan = 0,
  delaySec = 0
) {
  const t = ac.currentTime + delaySec;
  const len = Math.max(32, Math.floor(ac.sampleRate * durationSec));
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  let prev = 0;
  for (let i = 0; i < len; i++) {
    const u = i / len;
    const env = Math.sin(u * Math.PI) * (1 - u * 0.45);
    const w = Math.random() * 2 - 1;
    prev = prev * 0.74 + w * 0.26;
    d[i] = prev * env;
  }
  const src = ac.createBufferSource();
  src.buffer = buf;
  const lpf = ac.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.frequency.setValueAtTime(680, t);
  const g = ac.createGain();
  g.gain.setValueAtTime(peakGain, t);
  src.connect(lpf).connect(g);
  connectWithPan(ac, g, pan);
  src.start(t);
}

export function sfxCardGrab() {
  triggerHaptic('selection', false);
  if (profile === 'off') return;
  const ac = ensureCtx();
  if (!ac) return;
  // Резонансная полоса микро-динамика телефона (230 -> 115 Гц, 11 мс): мягкий физический толчок мембраны под пальцем
  playMicroTapticPulse(ac, 230, 115, 0.011, 0.11);
}

export function sfxUiTap(firm = false) {
  triggerHaptic(firm ? 'light' : 'selection', true);
  if (profile === 'off') return;
  const ac = ensureCtx();
  if (!ac) return;
  playMicroTapticPulse(ac, firm ? 275 : 245, 122, 0.01, firm ? 0.14 : 0.105);
}

export function sfxTiltTick(dir: 'left' | 'right' = 'right') {
  triggerHaptic('selection', false);
  if (profile === 'off') return;
  const ac = ensureCtx();
  if (!ac) return;
  playMicroTapticPulse(
    ac,
    dir === 'right' ? 285 : 255,
    128,
    0.009,
    0.115,
    dir === 'left' ? -0.2 : 0.2
  );
}

export function sfxThresholdLock(dir: 'left' | 'right', armed = true) {
  triggerHaptic(armed ? 'light' : 'selection', false);
  if (profile === 'off') return;
  const ac = ensureCtx();
  if (!ac) return;
  const pan = dir === 'left' ? -0.26 : 0.26;
  if (!armed) {
    playMicroTapticPulse(ac, 210, 110, 0.01, 0.085, pan * 0.5);
    return;
  }
  // Двойной тактильный микро-щелчок фиксации порога (как системный пикер iOS)
  playMicroTapticPulse(ac, dir === 'right' ? 295 : 265, 118, 0.013, 0.16, pan);
  playMicroTapticPulse(ac, 185, 96, 0.01, 0.09, pan, 0.016);
}

export function sfxCardSnapBack() {
  triggerHaptic('light', true);
  if (profile === 'off') return;
  const ac = ensureCtx();
  if (!ac) return;
  playMicroTapticPulse(ac, 215, 104, 0.015, 0.125);
}

export function sfxSwipeCommit(dir: 'left' | 'right') {
  triggerHaptic('medium', true);
  if (profile === 'off') return;
  const ac = ensureCtx();
  if (!ac) return;
  const pan = dir === 'left' ? -0.32 : 0.32;

  playMicroTapticPulse(ac, dir === 'right' ? 260 : 235, 98, 0.019, 0.175, pan * 0.5);
  playSoftSilkWhisper(ac, 0.036, 0.042, pan);
  playMicroTapticPulse(ac, 210, 108, 0.013, 0.095, 0, 0.095);
}

export function sfxCardFlip() {
  if (profile === 'off') return;
  const ac = ensureCtx();
  if (!ac) return;
  playMicroTapticPulse(ac, 225, 108, 0.015, 0.12);
  playSoftSilkWhisper(ac, 0.028, 0.032);
}

export function sfxPopCombo(combo: number) {
  triggerHaptic('light', true);
  if (profile === 'off') return;
  const ac = ensureCtx();
  if (!ac) return;
  const t = ac.currentTime;
  const scale = [220.0, 246.94, 277.18, 329.63, 369.99, 440.0];
  const freq = scale[Math.min(scale.length - 1, combo % scale.length)];

  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.042, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.085);
  osc.connect(g).connect(outNode(ac));
  osc.start(t);
  osc.stop(t + 0.095);
}

export function sfxCoffeeSave() {
  triggerHaptic('success', true);
  if (profile === 'off') return;
  const ac = ensureCtx();
  if (!ac) return;
  const t = ac.currentTime;

  playMicroTapticPulse(ac, 126, 56, 0.018, 0.048);
  [220.0, 277.18, 329.63].forEach((f, i) => {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f, t + i * 0.035);
    g.gain.setValueAtTime(0.0001, t + i * 0.035);
    g.gain.linearRampToValueAtTime(0.034, t + i * 0.035 + 0.018);
    g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.035 + 0.24);
    osc.connect(g).connect(outNode(ac));
    osc.start(t + i * 0.035);
    osc.stop(t + i * 0.035 + 0.26);
  });
}

export function sfxGameOver() {
  triggerHaptic('error', true);
  if (profile === 'off') return;
  const ac = ensureCtx();
  if (!ac) return;
  const t = ac.currentTime;

  playMicroTapticPulse(ac, 106, 42, 0.028, 0.065);
  [146.83, 174.61, 220.0].forEach((f, i) => {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f, t + i * 0.045);
    g.gain.setValueAtTime(0.0001, t + i * 0.045);
    g.gain.linearRampToValueAtTime(0.04, t + i * 0.045 + 0.024);
    g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.045 + 0.42);
    osc.connect(g).connect(outNode(ac));
    osc.start(t + i * 0.045);
    osc.stop(t + i * 0.045 + 0.45);
  });
}

export function sfxVictory() {
  triggerHaptic('success', true);
  if (profile === 'off') return;
  const ac = ensureCtx();
  if (!ac) return;
  const t = ac.currentTime;

  playMicroTapticPulse(ac, 122, 54, 0.02, 0.055);
  [196.0, 246.94, 293.66, 369.99].forEach((f, i) => {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f, t + i * 0.04);
    g.gain.setValueAtTime(0.0001, t + i * 0.04);
    g.gain.linearRampToValueAtTime(0.038, t + i * 0.04 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.04 + 0.34);
    osc.connect(g).connect(outNode(ac));
    osc.start(t + i * 0.04);
    osc.stop(t + i * 0.04 + 0.38);
  });
}
