import type {
  DilemmaCard,
  EndingDef,
  JobPack,
  PackId,
  RealHistoricalCase,
  StatKey,
  Stats,
} from '../types';
import { getChoiceShortGist } from './choiceErgonomics';
import { getPackAtmosphere } from './sceneAtmospheres';
import {
  drawBuiltinAnimatedGif,
  drawCustomStickerAtTime,
  type BuiltinGifId,
  type CustomStickerMedia,
} from './storiesAnimatedGifs';

/**
 * СТУДИЯ МОНТАЖА STORIES / SHORTS (v42):
 * Нелинейный видеоредактор (NLE) прямо в браузере:
 * - Склейка и обрезка живого видео (запись забега с лицом/голосом или любой загруженный ролик с телефона/ПК);
 * - Реконструкция реальных игровых смен 1-в-1 (с портретами EditorialCardPortrait, живыми шкалами и физикой свайпа);
 * - Разговорные документальные вставки «А КАК В ТАКОЙ ЖЕ СИТУАЦИИ ОТВЕТИЛ ...?» с караоке-подсветкой слов;
 * - Свободное размещение и масштабирование анимированных GIF-стикеров (встроенных и своих .gif/.webp/.png/.mp4) и титров;
 * - Процедурный саундтрек + склейка звука из обрезанных видеоклипов + быстрый экспорт H.264/AAC MP4 через Mediabunny.
 */

export interface RunSwipeHighlight {
  cardId?: string;
  week: number;
  blockNum?: number;
  speaker: string;
  role?: string;
  text: string;
  leftLabel?: string;
  rightLabel?: string;
  chosenLabel: string;
  side: 'left' | 'right';
  statsBefore?: Stats;
  statsAfter?: Stats;
  faceSnapUrl?: string | null;
  matchedRealCase?: boolean;
  realCase?: RealHistoricalCase;
}

export type MontageSoundtrackMode = 'groove' | 'thriller' | 'sfx_only' | 'mute';

export type CaptionVisualStyle = 'paper' | 'stories_dark' | 'kinetic_bold' | 'accent_tag';

export interface MontageVideoClip {
  id: string;
  kind: 'video';
  label: string;
  videoUrl: string;
  blob?: Blob;
  naturalDuration: number;
  trimStart: number;
  trimEnd: number;
  volume: number;
  fit: 'cover' | 'contain';
}

export interface MontageSwipeClip {
  id: string;
  kind: 'swipe';
  swipe: RunSwipeHighlight;
  duration: number;
}

export interface MontageRealCaseClip {
  id: string;
  kind: 'real_case';
  realCase: RealHistoricalCase;
  playerMatched?: boolean;
  leadText: string;
  bodyText: string;
  duration: number;
}

export interface MontageEndingClip {
  id: string;
  kind: 'ending';
  duration: number;
}

export interface MontageQrClip {
  id: string;
  kind: 'qr';
  duration: number;
}

export type MontageClip =
  | MontageVideoClip
  | MontageSwipeClip
  | MontageRealCaseClip
  | MontageEndingClip
  | MontageQrClip;

export interface MontageGifOverlay {
  id: string;
  kind: 'gif';
  sourceType: 'builtin' | 'custom';
  builtinId?: BuiltinGifId;
  customMediaId?: string;
  label: string;
  x: number; // 0..1
  y: number; // 0..1
  scale: number;
  rotDeg: number;
  startSec: number;
  endSec: number | null; // null = до конца ролика
}

export interface MontageTextOverlay {
  id: string;
  kind: 'text';
  text: string;
  style: CaptionVisualStyle;
  color?: string;
  x: number; // 0..1
  y: number; // 0..1
  scale: number;
  rotDeg: number;
  startSec: number;
  endSec: number | null;
}

export type MontageOverlay = MontageGifOverlay | MontageTextOverlay;

export type FaceFx = 'auto' | 'none' | 'pop' | 'pulse' | 'shake' | 'big';

/** Авто-выбор эффекта лица по тому, что произошло с показателями после ответа игрока */
function pickAutoFaceFx(sw: RunSwipeHighlight, a: Stats, b: Stats): Exclude<FaceFx, 'auto'> {
  const keys: StatKey[] = ['s1', 's2', 's3', 's4'];
  const deltas = keys.map((k) => b[k] - a[k]);
  const minD = Math.min(...deltas);
  const maxD = Math.max(...deltas);
  const danger = keys.some((k) => b[k] <= 20 || b[k] >= 84);
  if (danger || minD <= -14) return 'shake';
  if (sw.realCase?.kind === 'blunder' && sw.matchedRealCase) return 'shake';
  if (maxD >= 14 && minD > -7) return 'pop';
  if (Math.abs(minD) >= 8 || maxD >= 8) return 'pulse';
  return 'pop';
}

export interface MontageProject {
  pack: JobPack;
  ending: EndingDef;
  finalStats?: Stats;
  weeksSurvived: number;
  clips: MontageClip[];
  overlays: MontageOverlay[];
  soundtrack: MontageSoundtrackMode;
  /** Клиентская умная режиссура: авто-зум на лицо/шкалы, слоу-мо перед роковым свайпом и тряска удара */
  dramaticMode?: boolean;
  /** Отдельный слой лица: хайп-эффекты (увеличение, пульс, тряска) только на лице, без зума всей сцены */
  faceFx?: FaceFx;
  faceSnapshotUrl?: string | null;
}

export interface MontageTimelineSpan {
  clip: MontageClip;
  index: number;
  startSec: number;
  endSec: number;
  duration: number;
}

export interface MontageRenderAssets {
  /** Карта предрендеренных SVG портретов по ключу (cardId / person / endingId) */
  portraits: Map<string, HTMLImageElement>;
  /** Живое фото лица игрока (если было) */
  faceImg: HTMLImageElement | null;
  /** Снимки лица игрока в момент конкретного свайпа (по номеру смены) */
  swipeFaces?: Map<number, HTMLImageElement>;
  /** Живой поток вырезанного лица с камеры прямо сейчас (если камера активна) */
  liveFaceSource?: HTMLCanvasElement | HTMLVideoElement | HTMLImageElement | null;
  /** Загруженные пользователем GIF / стикеры */
  customStickers: Map<string, CustomStickerMedia>;
  /** Источники кадров для видеоклипов (HTMLVideoElement в превью или Canvas в экспорте) */
  videoFrames: Map<string, CanvasImageSource | null>;
}

// Верифицированная через Apple CIDetectorTypeQRCode 25×25 ISO-18004 матрица для "https://t.me/vkreslegame"
export const VKRESLEGAME_QR_MATRIX: readonly string[] = [
  '1111111000100001001111111',
  '1000001001000001101000001',
  '1011101010010000001011101',
  '1011101001001011001011101',
  '1011101001001111001011101',
  '1000001000111111001000001',
  '1111111010101010101111111',
  '0000000010010100000000000',
  '1110111110001100011000100',
  '1110000101011100111100001',
  '1010111000111000010010111',
  '1011000101101110011000010',
  '1010101110110101111101011',
  '0011110110110100111001001',
  '1000001111100100110100111',
  '0101000101010110100010010',
  '1001101010001100111111000',
  '0000000011111100100011011',
  '1111111011011011101011011',
  '1000001010001110100011010',
  '1011101010111100111111000',
  '1011101001010000100111100',
  '1011101011000001000010001',
  '1000001011011111100011010',
  '1111111010101100111100011',
];

export function getClipDuration(clip: MontageClip): number {
  if (clip.kind === 'video') {
    return Math.max(0.4, clip.trimEnd - clip.trimStart);
  }
  return Math.max(0.35, clip.duration);
}

export function computeTimelineSpans(clips: MontageClip[]): {
  spans: MontageTimelineSpan[];
  totalDuration: number;
} {
  const spans: MontageTimelineSpan[] = [];
  let cursor = 0;
  clips.forEach((clip, index) => {
    const duration = getClipDuration(clip);
    spans.push({
      clip,
      index,
      startSec: cursor,
      endSec: cursor + duration,
      duration,
    });
    cursor += duration;
  });
  return { spans, totalDuration: Math.max(0.5, cursor) };
}

export function pickBestRealCaseForHighlight(
  pack: JobPack,
  swipes: RunSwipeHighlight[]
): { realCase: RealHistoricalCase; playerMatched?: boolean; week?: number } | null {
  const fromRun = [...swipes].reverse().find((s) => s.realCase);
  if (fromRun?.realCase) {
    return {
      realCase: fromRun.realCase,
      playerMatched: fromRun.matchedRealCase,
      week: fromRun.week,
    };
  }
  const fallbackCard: DilemmaCard | undefined = pack.deckCards.find((c) => c.realCase);
  if (fallbackCard?.realCase) {
    return { realCase: fallbackCard.realCase };
  }
  return null;
}

export function getAllRealCasesInPack(pack: JobPack): RealHistoricalCase[] {
  const seen = new Set<string>();
  const out: RealHistoricalCase[] = [];
  const all = [
    ...pack.onboardingCards,
    ...pack.deckCards,
    ...Object.values(pack.specialCards),
  ];
  for (const c of all) {
    if (c.realCase) {
      const key = `${c.realCase.person}|${c.realCase.year}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push(c.realCase);
      }
    }
  }
  return out;
}

/**
 * Формирует живую разговорную подводку в духе лучших бизнес- и исторических Stories/Shorts:
 * «А вот как в такой же точке ответил Джефф Безос (1999):»
 */
export function buildConversationalCaseLead(
  rc: RealHistoricalCase,
  playerMatched?: boolean
): string {
  const who = `${rc.person}, ${rc.year}`;
  if (rc.kind === 'blunder') {
    if (playerMatched === true) return `Тот же ход в реальности — ${who}. Вот чем это кончилось:`;
    if (playerMatched === false) return `Ты выбрал иначе. А вот что вышло в реальности — ${who}:`;
    return `А вот что вышло в такой же ситуации — ${who}:`;
  }
  if (playerMatched === true) return `Так же ответили в реальности — ${who}. И вот что получилось:`;
  if (playerMatched === false) return `Ты выбрал иначе. А вот что сработало в реальности — ${who}:`;
  return `А вот как это решили в реальности — ${who}:`;
}

/** Делит историю на «что сделали» и «чем закончилось», чтобы в ролике всегда был вывод */
export function splitRealCaseStory(rc: RealHistoricalCase): { decision: string; outcome: string } {
  const raw = rc.story.trim().replace(/\s+/g, ' ');
  const sentences = raw.split(/(?<=[.!?])\s+/).filter(Boolean);
  const clip = (t: string, max: number) => {
    if (t.length <= max) return t;
    const cut = t.slice(0, max);
    const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('; '));
    if (lastStop > max * 0.55) return cut.slice(0, lastStop + 1);
    return `${cut.replace(/[,\s—-]+$/, '')}…`;
  };
  if (sentences.length >= 2) {
    return {
      decision: clip(sentences[0], 170),
      outcome: clip(sentences.slice(1).join(' '), 230),
    };
  }
  const m = /\s(но|однако|в итоге|после чего|вместо этого)\s/i.exec(raw);
  if (m && m.index > 45) {
    const head = raw.slice(0, m.index).replace(/[,\s]+$/, '');
    const tail = raw.slice(m.index + 1);
    return { decision: clip(head, 170), outcome: clip(tail.charAt(0).toUpperCase() + tail.slice(1), 230) };
  }
  return { decision: clip(raw, 170), outcome: rc.headline };
}

export function buildConversationalCaseBody(rc: RealHistoricalCase): string {
  // Короткая, ёмкая выжимка для Stories/Reels без «простыни» мелкого текста (до 190 символов)
  const raw = rc.story.trim();
  if (raw.length <= 185) return raw;
  const sentences = raw.split(/(?<=[.!?])\s+/);
  let acc = '';
  for (const s of sentences) {
    const next = acc ? `${acc} ${s}` : s;
    if (next.length > 195 && acc.length >= 70) break;
    acc = next;
  }
  return acc.length <= 205 ? acc : `${acc.slice(0, 196).replace(/[,\s]+$/, '')}…`;
}

export function getDefaultHookPresets(pack: JobPack, ending: EndingDef, weeks: number): string[] {
  if (ending.isVictory) {
    return [
      `Прошёл все ${weeks} смен в «${pack.shortTitle}» и не слетел`,
      '92% горят до финала — а как бы ответил ты?',
      'Мой выбор против реального ответа из истории',
    ];
  }
  return [
    `Меня сняли на ${weeks}-й смене в «${pack.shortTitle}»`,
    'Один неверный ответ — и вся смена в разнос',
    'А как на этом же вопросе ответили в реальности?',
    '9 из 10 наступают здесь на те же грабли',
  ];
}

export function buildFallbackSwipesFromPack(pack: JobPack): RunSwipeHighlight[] {
  const withCase = pack.deckCards.find((c) => c.realCase);
  const first = pack.onboardingCards[0] ?? pack.deckCards[0];
  const picks = [first, withCase].filter((x): x is DilemmaCard => Boolean(x));
  return picks.map((c, idx) => ({
    cardId: c.id,
    week: idx === 0 ? 3 : 9,
    blockNum: 1,
    speaker: c.speaker,
    role: c.role,
    text: c.text,
    leftLabel: c.left.label,
    rightLabel: c.right.label,
    chosenLabel: c.right.label,
    side: 'right',
    statsBefore: { s1: 52, s2: 48, s3: 54, s4: 46 },
    statsAfter: { s1: 36, s2: 64, s3: 42, s4: 58 },
    realCase: c.realCase,
  }));
}

function drawRRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.closePath();
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines = 8
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
      if (lines.length >= maxLines) return lines;
    } else {
      line = test;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  return lines;
}

function drawQrMatrix(ctx: CanvasRenderingContext2D, x: number, y: number, boxSize: number) {
  const quiet = 3;
  const n = VKRESLEGAME_QR_MATRIX.length;
  const totalMods = n + quiet * 2;
  const cell = boxSize / totalMods;

  ctx.fillStyle = '#f4efe4';
  drawRRect(ctx, x, y, boxSize, boxSize, 12);
  ctx.fill();

  ctx.fillStyle = '#0d1512';
  for (let r = 0; r < n; r++) {
    const row = VKRESLEGAME_QR_MATRIX[r];
    for (let c = 0; c < n; c++) {
      if (row[c] === '1') {
        ctx.fillRect(
          Math.floor(x + (c + quiet) * cell),
          Math.floor(y + (r + quiet) * cell),
          Math.ceil(cell),
          Math.ceil(cell)
        );
      }
    }
  }
}

function drawSceneAtmosphereBg(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  packId: PackId,
  blockNum = 2,
  inDanger = false
) {
  const atm = getPackAtmosphere(packId, blockNum, inDanger);
  const bg = ctx.createRadialGradient(W * 0.5, H * 0.26, 28, W * 0.5, H * 0.52, H * 0.78);
  bg.addColorStop(0, atm.bgGlow);
  bg.addColorStop(1, atm.bgCanvas);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Тонкие архитектурные штрихи комнаты
  ctx.save();
  ctx.strokeStyle = atm.accent;
  ctx.globalAlpha = 0.08;
  ctx.lineWidth = 1.4;
  for (let i = 1; i <= 4; i++) {
    const y = (H * 0.08) + i * (H * 0.055);
    ctx.beginPath();
    ctx.moveTo(W * 0.08, y);
    ctx.lineTo(W * 0.92, y + 12);
    ctx.stroke();
  }
  ctx.restore();
  return atm;
}

function drawPortraitOrFallback(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | undefined,
  x: number,
  y: number,
  w: number,
  h: number,
  bgColor: string,
  accent: string
) {
  ctx.save();
  ctx.fillStyle = bgColor;
  ctx.fillRect(x, y, w, h);
  if (img && img.complete && img.naturalWidth > 0) {
    const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) * 0.25, dw, dh);
  } else {
    // Аккуратный векторный силуэт на случай мгновенного первого кадра до загрузки SVG
    const cx = x + w / 2;
    const cy = y + h * 0.55;
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.18;
    ctx.beginPath();
    ctx.arc(cx, cy - 16, Math.min(w, h) * 0.34, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#1b2420';
    ctx.beginPath();
    ctx.arc(cx, cy - 36, 36, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx, cy + 48, 86, 54, 0, Math.PI, 0, false);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Рендерит 1-в-1 реальную игровую сцену свайпа со шкалами, портретом героя и физикой полёта.
 */
function renderSwipeClipScene(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  localPhase: number, // 0..1
  project: MontageProject,
  clip: MontageSwipeClip,
  assets: MontageRenderAssets
) {
  const sw = clip.swipe;
  const statsA: Stats = sw.statsBefore ?? { s1: 50, s2: 50, s3: 50, s4: 50 };
  const statsB: Stats = sw.statsAfter ?? {
    s1: sw.side === 'right' ? 64 : 36,
    s2: sw.side === 'right' ? 38 : 62,
    s3: 48,
    s4: 54,
  };

  // Фазы: 0..0.34 (чтение карточки), 0.34..0.70 (наклон + шторка ответа), 0.70..1.0 (бросок + пересчёт шкал)
  const commitProgress = localPhase <= 0.7 ? 0 : Math.min(1, (localPhase - 0.7) / 0.24);
  const statEase = 1 - Math.pow(1 - commitProgress, 3);

  const curStats: Stats = {
    s1: Math.round(statsA.s1 + (statsB.s1 - statsA.s1) * statEase),
    s2: Math.round(statsA.s2 + (statsB.s2 - statsA.s2) * statEase),
    s3: Math.round(statsA.s3 + (statsB.s3 - statsA.s3) * statEase),
    s4: Math.round(statsA.s4 + (statsB.s4 - statsA.s4) * statEase),
  };

  const anyDanger =
    curStats.s1 <= 20 ||
    curStats.s1 >= 84 ||
    curStats.s2 <= 20 ||
    curStats.s2 >= 84 ||
    curStats.s3 <= 20 ||
    curStats.s3 >= 84 ||
    curStats.s4 <= 20 ||
    curStats.s4 >= 84;

  const atm = drawSceneAtmosphereBg(ctx, W, H, project.pack.id, sw.blockNum ?? 2, anyDanger);
  const hasTopText = project.overlays.some((o) => o.kind === 'text' && o.text.trim().length > 0);
  const humanFace: HTMLCanvasElement | HTMLVideoElement | HTMLImageElement | null =
    assets.swipeFaces?.get(sw.week) ?? assets.faceImg ?? assets.liveFaceSource ?? null;

  // Шапка игры + 4 живых индикатора показателей (поднимаем выше, если нет верхнего титра)
  const hudTop = hasTopText ? 174 : 72;
  ctx.save();
  drawRRect(ctx, 36, hudTop, W - 72, 84, 20);
  ctx.fillStyle = 'rgba(12, 16, 20, 0.76)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const cellW = (W - 108) / 4;
  project.pack.pillars.forEach((pil, idx) => {
    const k = pil.key as StatKey;
    const val = curStats[k];
    const delta = statsB[k] - statsA[k];
    const danger = val <= 20 || val >= 84;
    const cx = 50 + idx * (cellW + 4);

    ctx.fillStyle = '#a6aba6';
    ctx.font = '700 15px "Manrope", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(pil.label.slice(0, 8), cx, hudTop + 28);

    ctx.fillStyle = danger ? '#f08c82' : '#f4efe4';
    ctx.font = '800 19px "JetBrains Mono", monospace';
    ctx.fillText(`${val}%`, cx, hudTop + 52);

    // Всплывающая дельта в момент свайпа
    if (localPhase >= 0.42 && delta !== 0) {
      ctx.fillStyle = delta > 0 ? '#6cc4a1' : '#f08c82';
      ctx.font = '800 15px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(delta > 0 ? `+${delta}` : `${delta}`, cx + cellW - 8, hudTop + 52);
    }

    // Полоска прогресса шкалы
    drawRRect(ctx, cx, hudTop + 62, cellW - 10, 8, 4);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fill();

    drawRRect(ctx, cx, hudTop + 62, Math.max(4, ((cellW - 10) * val) / 100), 8, 4);
    ctx.fillStyle = danger ? '#c83e31' : atm.accent;
    ctx.fill();
  });
  ctx.restore();

  // Подложка следующей карты в колоде (эффект глубины стопки)
  const cardW = 636;
  const cardH = hasTopText ? 840 : 920;
  const centerX = W / 2;
  const centerY = hasTopText ? 718 : 668;

  ctx.save();
  const nextScale = 0.94 + 0.05 * commitProgress;
  ctx.translate(centerX, centerY + (1 - commitProgress) * 16);
  ctx.scale(nextScale, nextScale);
  drawRRect(ctx, -cardW / 2, -cardH / 2, cardW, cardH, 32);
  ctx.fillStyle = 'rgba(244, 239, 228, 0.24)';
  ctx.fill();
  ctx.restore();

  // Активная карточка с физикой захвата, наклона и вылета
  const dir = sw.side === 'right' ? 1 : -1;
  let dragRatio = 0;
  let flyProgress = 0;
  if (localPhase > 0.32 && localPhase <= 0.72) {
    dragRatio = (localPhase - 0.32) / 0.4;
  } else if (localPhase > 0.72) {
    dragRatio = 1;
    flyProgress = (localPhase - 0.72) / 0.28;
  }

  const easeDrag = 1 - Math.pow(1 - dragRatio, 2);
  const shiftX =
    flyProgress > 0
      ? dir * (112 + Math.pow(flyProgress, 1.55) * 690)
      : dir * easeDrag * 112;
  const shiftY = flyProgress > 0 ? Math.pow(flyProgress, 1.7) * 96 : -Math.abs(easeDrag) * 8;
  const rotRad =
    ((dir * (easeDrag * 6.5 + Math.pow(flyProgress, 1.4) * 18)) * Math.PI) / 180;
  const cardAlpha = flyProgress > 0.75 ? 1 - (flyProgress - 0.75) / 0.25 : 1;

  if (cardAlpha > 0.02) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, cardAlpha);
    ctx.translate(centerX + shiftX, centerY + shiftY);
    ctx.rotate(rotRad);

    ctx.shadowColor = 'rgba(0, 0, 0, 0.62)';
    ctx.shadowBlur = 42;
    ctx.shadowOffsetY = 20;
    drawRRect(ctx, -cardW / 2, -cardH / 2, cardW, cardH, 32);
    ctx.fillStyle = '#f4efe4';
    ctx.fill();
    ctx.shadowColor = 'transparent';

    // Клип под портрет и внутренности карточки
    drawRRect(ctx, -cardW / 2, -cardH / 2, cardW, cardH, 32);
    ctx.save();
    ctx.clip();

    const artH = Math.round(cardH * 0.47);
    const baseKey = `card_${sw.cardId ?? sw.speaker}`;
    const headlessKey = `card_headless_${sw.cardId ?? sw.speaker}`;
    drawPortraitOrFallback(
      ctx,
      humanFace ? (assets.portraits.get(headlessKey) ?? assets.portraits.get(baseKey)) : assets.portraits.get(baseKey),
      -cardW / 2,
      -cardH / 2,
      cardW,
      artH,
      atm.cardHeader,
      atm.accent
    );

    // Плашка номера смены поверх портрета
    drawRRect(ctx, -cardW / 2 + 22, -cardH / 2 + 20, 174, 38, 19);
    ctx.fillStyle = 'rgba(12, 16, 20, 0.78)';
    ctx.fill();
    ctx.fillStyle = atm.accent;
    ctx.font = '800 16px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`СМЕНА ${String(sw.week).padStart(2, '0')}/36`, -cardW / 2 + 109, -cardH / 2 + 45);

    // Имя и должность спикера
    ctx.fillStyle = '#ebe4d4';
    ctx.fillRect(-cardW / 2, -cardH / 2 + artH, cardW, 64);
    ctx.strokeStyle = '#d4cab6';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-cardW / 2, -cardH / 2 + artH);
    ctx.lineTo(cardW / 2, -cardH / 2 + artH);
    ctx.moveTo(-cardW / 2, -cardH / 2 + artH + 64);
    ctx.lineTo(cardW / 2, -cardH / 2 + artH + 64);
    ctx.stroke();

    ctx.fillStyle = '#181614';
    ctx.font = '800 24px "Manrope", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(sw.speaker.slice(0, 28), -cardW / 2 + 28, -cardH / 2 + artH + 40);

    if (sw.role) {
      ctx.fillStyle = '#6c6356';
      ctx.font = '700 15px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(sw.role.slice(0, 22), cardW / 2 - 28, -cardH / 2 + artH + 39);
    }

    // Текст дилеммы
    ctx.fillStyle = '#181614';
    ctx.font = '700 27px "Manrope", system-ui, sans-serif';
    ctx.textAlign = 'left';
    const qLines = wrapLines(ctx, sw.text, cardW - 64, 5);
    qLines.forEach((ln, idx) => {
      ctx.fillText(ln, -cardW / 2 + 32, -cardH / 2 + artH + 114 + idx * 38);
    });

    // Нижние кнопки Влево / Вправо
    const btnY = cardH / 2 - 108;
    const leftShort = getChoiceShortGist(sw.leftLabel ?? sw.chosenLabel);
    const rightShort = getChoiceShortGist(sw.rightLabel ?? sw.chosenLabel);

    ctx.fillStyle = '#ebe4d4';
    ctx.fillRect(-cardW / 2, btnY, cardW, 108);

    // Подсветка выбранной стороны
    ctx.fillStyle =
      sw.side === 'left' ? 'rgba(200, 62, 49, 0.16)' : 'rgba(30, 107, 82, 0.18)';
    ctx.fillRect(sw.side === 'left' ? -cardW / 2 : 0, btnY, cardW / 2, 108);

    ctx.fillStyle = '#6c6356';
    ctx.font = '700 14px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('← ВЛЕВО', -cardW / 2 + 26, btnY + 34);
    ctx.textAlign = 'right';
    ctx.fillText('ВПРАВО →', cardW / 2 - 26, btnY + 34);

    ctx.fillStyle = '#181614';
    ctx.font = '800 20px "Manrope", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(leftShort.slice(0, 20), -cardW / 2 + 26, btnY + 68);
    ctx.textAlign = 'right';
    ctx.fillText(rightShort.slice(0, 20), cardW / 2 - 26, btnY + 68);

    ctx.restore();

    // ОТДЕЛЬНЫЙ СЛОЙ ЛИЦА (поверх клипа карточки): хайп-эффекты применяются только к нему
    if (humanFace) {
      const fxSetting = project.faceFx ?? 'auto';
      const fx = fxSetting === 'auto' ? pickAutoFaceFx(sw, statsA, statsB) : fxSetting;
      let fs = 1;
      let jx = 0;
      let jy = 0;
      let jr = 0;
      const win = localPhase > 0.3 && localPhase < 0.86;
      if (fx === 'big') fs = 1.55;
      else if (fx === 'pop' && win) {
        const inP = Math.min(1, (localPhase - 0.3) / 0.12);
        const outP = Math.max(0, (localPhase - 0.76) / 0.1);
        const e = 1 - Math.pow(1 - inP, 3);
        fs = 1 + 0.62 * e * (1 - outP) + Math.sin(inP * Math.PI) * 0.1;
      } else if (fx === 'pulse' && win) {
        fs = 1 + 0.16 * Math.abs(Math.sin(localPhase * Math.PI * 7));
      } else if (fx === 'shake' && win) {
        fs = 1.22;
        jx = Math.sin(localPhase * 160) * 7;
        jy = Math.cos(localPhase * 140) * 5;
        jr = Math.sin(localPhase * 120) * 0.05;
      }
      ctx.save();
      ctx.translate(jx, -cardH / 2 + artH * 0.43 + jy);
      ctx.rotate(rotRad * 1.35 + jr);
      ctx.scale(fs, fs);
      if (fs > 1.02) {
        ctx.shadowColor = 'rgba(0,0,0,0.55)';
        ctx.shadowBlur = 26;
      }
      try {
        ctx.drawImage(humanFace, -124, -144, 248, 288);
      } catch {
        // ignore if frame not ready
      }
      ctx.restore();
    }

    // Рамка карточки
    drawRRect(ctx, -cardW / 2, -cardH / 2, cardW, cardH, 32);
    ctx.strokeStyle = '#181614';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.restore();
  }
  // ВСПЛЫВАЮЩАЯ ПЛАШКА РЕШЕНИЯ СВЕРХУ (для зрителей: что именно выбрал игрок)
  if (localPhase > 0.36) {
    const bp = Math.min(1, (localPhase - 0.36) / 0.1);
    const be = 1 - Math.pow(1 - bp, 3);
    const out = localPhase > 0.94 ? (localPhase - 0.94) / 0.06 : 0;
    const good = sw.side === 'right';
    const col = good ? '#5ed4a8' : '#ff8a7a';
    ctx.save();
    ctx.globalAlpha = Math.max(0, be * (1 - out));
    ctx.font = '800 29px "Manrope", system-ui, sans-serif';
    const lines = wrapLines(ctx, sw.chosenLabel, W - 156, 3);
    const bh = 58 + lines.length * 38;
    const by = hudTop + 100 + (1 - be) * -40;
    ctx.translate(W / 2, by + bh / 2);
    ctx.scale(0.94 + 0.06 * be, 0.94 + 0.06 * be);
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 28;
    drawRRect(ctx, -(W - 92) / 2, -bh / 2, W - 92, bh, 26);
    ctx.fillStyle = 'rgba(10, 14, 18, 0.94)';
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = col;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = col;
    ctx.font = '800 15px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('РЕШЕНИЕ', -(W - 92) / 2 + 28, -bh / 2 + 31);
    ctx.fillStyle = '#f4efe4';
    ctx.font = '800 29px "Manrope", system-ui, sans-serif';
    lines.forEach((ln, i) => ctx.fillText(ln, -(W - 92) / 2 + 28, -bh / 2 + 66 + i * 38));
    ctx.restore();
  }
}

/**
 * Кинематографичный 2-тактный блок «А КАК НА ЭТОТ ВОПРОС ОТВЕТИЛ ...?» в стиле топовых Reels/Stories
 * (крупная вёрстка без мелкой простыни текста и без пересечения с пользовательскими подписями).
 */
function renderRealCaseCutawayScene(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  localPhase: number, // 0..1
  project: MontageProject,
  clip: MontageRealCaseClip,
  assets: MontageRenderAssets
) {
  const rc = clip.realCase;
  const isBlunder = rc.kind === 'blunder';
  const atm = getPackAtmosphere(project.pack.id, 3, isBlunder);
  const accentCol = isBlunder ? '#ff6454' : '#5ed4a8';

  const zoomIn = localPhase < 0.14 ? 1.11 - (localPhase / 0.14) * 0.11 : 1 + localPhase * 0.025;

  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(zoomIn, zoomIn);
  ctx.translate(-W / 2, -H / 2);

  // Глубокий кинематографичный фон
  const bg = ctx.createRadialGradient(W * 0.5, H * 0.34, 24, W * 0.5, H * 0.52, H * 0.8);
  bg.addColorStop(0, isBlunder ? '#2e1416' : '#132a23');
  bg.addColorStop(1, '#080b0e');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Компактная плашка года (с безопасным отступом под верхний бар Stories)
  drawRRect(ctx, W / 2 - 196, 178, 392, 46, 23);
  ctx.fillStyle = isBlunder ? 'rgba(255, 100, 84, 0.16)' : 'rgba(94, 212, 168, 0.16)';
  ctx.fill();
  ctx.strokeStyle = accentCol;
  ctx.lineWidth = 1.6;
  ctx.stroke();

  ctx.fillStyle = accentCol;
  ctx.font = '800 16px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(
    isBlunder ? `ИЗВЕСТНЫЙ ПРОВАЛ · ${rc.year}` : `ОТВЕТ В РЕАЛЬНОСТИ · ${rc.year}`,
    W / 2,
    207
  );

  // Портрет-медальон героя истории
  const medR = 84;
  const medX = W / 2;
  const medY = 334;
  ctx.save();
  ctx.beginPath();
  ctx.arc(medX, medY, medR, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  drawPortraitOrFallback(
    ctx,
    assets.portraits.get(`rc_${rc.person}`),
    medX - medR,
    medY - medR,
    medR * 2,
    medR * 2,
    atm.cardHeader,
    accentCol
  );
  ctx.restore();

  ctx.strokeStyle = accentCol;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(medX, medY, medR, 0, Math.PI * 2);
  ctx.stroke();

  // Живая разговорная подводка («А вот как в этой же ситуации ответил Рид Хастингс...»)
  ctx.fillStyle = '#f4efe4';
  ctx.font = '800 29px "Manrope", system-ui, sans-serif';
  ctx.textAlign = 'center';
  const leadLines = wrapLines(ctx, clip.leadText || buildConversationalCaseLead(rc), W - 96, 3);
  leadLines.forEach((ln, idx) => {
    ctx.fillText(ln, W / 2, 468 + idx * 38);
  });

  // Стеклянная тёмная карточка: «Что сделали» → «Чем закончилось» (всегда с выводом)
  const parts = splitRealCaseStory(rc);
  const boxTop = 468 + leadLines.length * 38 + 16;
  const boxH = 500;
  drawRRect(ctx, 44, boxTop, W - 88, boxH, 28);
  ctx.fillStyle = 'rgba(15, 20, 26, 0.9)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.lineWidth = 2;
  ctx.stroke();

  const decWords = parts.decision.split(/\s+/).filter(Boolean);
  const outWords = parts.outcome.split(/\s+/).filter(Boolean);
  const totalWords = decWords.length + outWords.length;
  const readProg = Math.max(0, Math.min(1, (localPhase - 0.05) / 0.78));
  const litCount = Math.max(1, Math.ceil(totalWords * readProg));
  const maxLineW = W - 156;

  const drawWords = (
    words: string[],
    offset: number,
    startY: number,
    lineH: number,
    maxLines: number,
    fontCss: string
  ): number => {
    ctx.font = fontCss;
    ctx.textAlign = 'left';
    const spaceW = ctx.measureText(' ').width;
    let curX = 78;
    let curY = startY;
    let lines = 1;
    for (let wi = 0; wi < words.length; wi++) {
      const word = words[wi];
      const wordW = ctx.measureText(word).width;
      if (curX + wordW > 78 + maxLineW && curX > 78) {
        lines++;
        if (lines > maxLines) break;
        curX = 78;
        curY += lineH;
      }
      const gi = offset + wi;
      const isCurrent = gi === litCount - 1 && readProg < 0.98;
      const isRead = gi < litCount;
      if (isCurrent) {
        drawRRect(ctx, curX - 5, curY - lineH * 0.74, wordW + 10, lineH * 0.92, 8);
        ctx.fillStyle = accentCol;
        ctx.fill();
        ctx.fillStyle = '#090c0f';
      } else {
        ctx.fillStyle = isRead ? '#f4efe4' : 'rgba(244, 239, 228, 0.3)';
      }
      ctx.fillText(word, curX, curY);
      curX += wordW + spaceW;
    }
    return curY;
  };

  // 1. Что сделали
  ctx.fillStyle = 'rgba(244, 239, 228, 0.62)';
  ctx.font = '800 16px "JetBrains Mono", monospace';
  ctx.textAlign = 'left';
  ctx.fillText('ЧТО СДЕЛАЛИ', 78, boxTop + 46);
  const decEndY = drawWords(
    decWords,
    0,
    boxTop + 90,
    36,
    4,
    '700 25px "Manrope", system-ui, sans-serif'
  );

  // разделитель
  const divY = decEndY + 26;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(78, divY);
  ctx.lineTo(W - 78, divY);
  ctx.stroke();

  // 2. Чем закончилось (вывод)
  const outLabel = isBlunder ? 'ЧЕМ ЗАКОНЧИЛОСЬ · ПРОВАЛ' : 'ЧЕМ ЗАКОНЧИЛОСЬ · СРАБОТАЛО';
  ctx.fillStyle = accentCol;
  ctx.font = '800 16px "JetBrains Mono", monospace';
  ctx.textAlign = 'left';
  ctx.fillText(outLabel, 78, divY + 42);
  drawWords(
    outWords,
    decWords.length,
    divY + 90,
    38,
    5,
    '800 27px "Manrope", system-ui, sans-serif'
  );

  ctx.fillStyle = 'rgba(244, 239, 228, 0.46)';
  ctx.font = '600 15px "JetBrains Mono", monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`Источник: ${rc.source.slice(0, 46)}`, 78, boxTop + boxH - 24);

  // Плашка сравнения с твоим ходом
  if (clip.playerMatched !== undefined && localPhase > 0.42) {
    const pop = Math.min(1, (localPhase - 0.42) / 0.14);
    ctx.save();
    ctx.translate(W / 2, boxTop + boxH + 52);
    ctx.scale(0.9 + 0.1 * pop, 0.9 + 0.1 * pop);

    const compareText = clip.playerMatched
      ? isBlunder
        ? 'ТЫ ВЫБРАЛ ТОТ ЖЕ ХОД'
        : 'ТВОЙ ВЫБОР СОВПАЛ С РЕАЛЬНЫМ'
      : isBlunder
        ? 'ТЫ ВЫБРАЛ ИНАЧЕ — ГРАБЛИ ОБОЙДЕНЫ'
        : 'ТЫ ВЫБРАЛ ИНАЧЕ';

    drawRRect(ctx, -246, -26, 492, 52, 26);
    ctx.fillStyle = accentCol;
    ctx.fill();

    ctx.fillStyle = '#090c0f';
    ctx.font = '800 19px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(compareText, 0, 7);
    ctx.restore();
  }

  if (localPhase < 0.09) {
    ctx.fillStyle = `rgba(244, 239, 228, ${((1 - localPhase / 0.09) * 0.4).toFixed(2)})`;
    ctx.fillRect(0, 0, W, H);
  }

  ctx.restore();
}

function renderVideoClipScene(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  project: MontageProject,
  clip: MontageVideoClip,
  assets: MontageRenderAssets
) {
  const atm = drawSceneAtmosphereBg(ctx, W, H, project.pack.id, 2, false);
  const frameSource = assets.videoFrames.get(clip.id);

  if (frameSource) {
    let sw = W;
    let sh = H;
    if (frameSource instanceof HTMLVideoElement) {
      sw = frameSource.videoWidth || W;
      sh = frameSource.videoHeight || H;
    } else if (frameSource instanceof HTMLCanvasElement) {
      sw = frameSource.width || W;
      sh = frameSource.height || H;
    } else if (
      'width' in frameSource &&
      typeof frameSource.width === 'number' &&
      'height' in frameSource &&
      typeof frameSource.height === 'number'
    ) {
      sw = frameSource.width || W;
      sh = frameSource.height || H;
    }

    const scale =
      clip.fit === 'contain' ? Math.min(W / sw, H / sh) : Math.max(W / sw, H / sh);
    const dw = sw * scale;
    const dh = sh * scale;
    try {
      ctx.drawImage(frameSource, (W - dw) / 2, (H - dh) / 2, dw, dh);
    } catch {
      // ignore transient decode state
    }
  } else {
    ctx.fillStyle = atm.accent;
    ctx.font = '700 24px "Manrope", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(clip.label, W / 2, H / 2);
  }
}

function renderEndingClipScene(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  localPhase: number,
  project: MontageProject,
  assets: MontageRenderAssets
) {
  const isWin = Boolean(project.ending.isVictory);
  const atm = drawSceneAtmosphereBg(ctx, W, H, project.pack.id, 3, !isWin);
  const pop = Math.min(1, localPhase / 0.22);

  ctx.save();
  ctx.translate(W / 2, H * 0.54);
  ctx.scale(0.92 + 0.08 * pop, 0.92 + 0.08 * pop);

  drawRRect(ctx, -308, -340, 616, 680, 32);
  ctx.fillStyle = '#f4efe4';
  ctx.fill();
  ctx.strokeStyle = isWin ? '#1e6b52' : '#c83e31';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Портрет исхода (с живым лицом игрока в медальоне, если оно есть!)
  const endingHumanFace = assets.liveFaceSource ?? assets.faceImg ?? null;
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, -196, 86, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  drawPortraitOrFallback(
    ctx,
    endingHumanFace
      ? (assets.portraits.get(`ending_headless_${project.ending.id}`) ??
          assets.portraits.get(`ending_${project.ending.id}`))
      : assets.portraits.get(`ending_${project.ending.id}`),
    -86,
    -282,
    172,
    172,
    atm.cardHeader,
    atm.accent
  );
  if (endingHumanFace) {
    try {
      ctx.drawImage(endingHumanFace, -68, -274, 136, 158);
    } catch {
      // ignore
    }
  }
  ctx.restore();

  drawRRect(ctx, -220, -86, 440, 54, 14);
  ctx.fillStyle = isWin ? '#1e6b52' : '#c83e31';
  ctx.fill();

  ctx.fillStyle = '#f4efe4';
  ctx.font = '800 21px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(
    isWin
      ? `УДЕРЖАЛ КРЕСЛО · ${project.weeksSurvived}/36`
      : `СНЯТ НА ${project.weeksSurvived}-й СМЕНЕ`,
    0,
    -52
  );

  ctx.fillStyle = '#181614';
  ctx.font = '800 36px "Manrope", system-ui, sans-serif';
  wrapLines(ctx, project.ending.title, 530, 2).forEach((ln, idx) => {
    ctx.fillText(ln, 0, 26 + idx * 44);
  });

  ctx.fillStyle = '#5c5449';
  ctx.font = '600 24px "Manrope", system-ui, sans-serif';
  wrapLines(ctx, project.ending.description, 520, 4).forEach((ln, idx) => {
    ctx.fillText(ln, 0, 132 + idx * 35);
  });

  ctx.restore();
}

function renderQrClipScene(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  project: MontageProject
) {
  const atm = getPackAtmosphere(project.pack.id, 2, false);
  ctx.fillStyle = atm.bgCanvas;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = atm.accent;
  ctx.font = '800 20px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('КРЕСЛО · БЫСТРЫЙ ВХОД 0.4 СЕК', W / 2, H * 0.33);

  ctx.fillStyle = '#f4efe4';
  ctx.font = '700 26px "Manrope", system-ui, sans-serif';
  ctx.fillText('Не отнимаем время рекламой.', W / 2, H * 0.38);

  ctx.fillStyle = '#a6aba6';
  ctx.font = '600 21px "Manrope", system-ui, sans-serif';
  ctx.fillText('Поймал на паузе — попробуй пройти дальше:', W / 2, H * 0.42);

  const qrSize = 224;
  drawQrMatrix(ctx, (W - qrSize) / 2, H * 0.46, qrSize);

  ctx.fillStyle = '#f4efe4';
  ctx.font = '800 26px "JetBrains Mono", monospace';
  ctx.fillText('@vkreslegame', W / 2, H * 0.46 + qrSize + 48);
}

function renderOverlayItem(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  tSec: number,
  ov: MontageOverlay,
  project: MontageProject,
  assets: MontageRenderAssets,
  selectedOverlayId?: string | null
) {
  if (tSec < ov.startSec) return;
  if (ov.endSec !== null && tSec > ov.endSec) return;

  const localAge = Math.max(0, tSec - ov.startSec);
  const pop = localAge < 0.2 ? 0.72 + (localAge / 0.2) * 0.28 : 1;
  const cx = ov.x * W;
  const cy = ov.y * H;

  if (ov.kind === 'gif') {
    if (ov.sourceType === 'builtin' && ov.builtinId) {
      drawBuiltinAnimatedGif(ctx, ov.builtinId, tSec, cx, cy, ov.scale, ov.rotDeg, pop);
    } else if (ov.sourceType === 'custom' && ov.customMediaId) {
      const media = assets.customStickers.get(ov.customMediaId);
      if (media) {
        drawCustomStickerAtTime(ctx, media, tSec, cx, cy, 220, ov.scale, ov.rotDeg, pop);
      }
    }
  } else if (ov.kind === 'text' && ov.text.trim()) {
    const atm = getPackAtmosphere(project.pack.id, 2, false);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((ov.rotDeg * Math.PI) / 180);
    ctx.scale(ov.scale * pop, ov.scale * pop);

    ctx.font = '800 28px "Manrope", system-ui, sans-serif';
    const lines = wrapLines(ctx, ov.text, 540, 3);
    let maxW = 160;
    lines.forEach((l) => {
      maxW = Math.max(maxW, ctx.measureText(l).width);
    });
    const boxW = Math.min(636, maxW + 56);
    const boxH = lines.length * 36 + 34;

    if (ov.style === 'paper') {
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = 22;
      drawRRect(ctx, -boxW / 2, -boxH / 2, boxW, boxH, 18);
      ctx.fillStyle = '#f4efe4';
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = atm.accent;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = ov.color && ov.color !== '#ffffff' ? ov.color : '#181614';
    } else if (ov.style === 'stories_dark') {
      drawRRect(ctx, -boxW / 2, -boxH / 2, boxW, boxH, 20);
      ctx.fillStyle = 'rgba(10, 13, 18, 0.84)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = ov.color || '#ffffff';
    } else if (ov.style === 'accent_tag') {
      drawRRect(ctx, -boxW / 2, -boxH / 2, boxW, boxH, 18);
      ctx.fillStyle = ov.color && ov.color !== '#ffffff' ? ov.color : atm.accent;
      ctx.fill();
      ctx.fillStyle = '#141210';
    } else {
      ctx.shadowColor = 'rgba(0,0,0,0.92)';
      ctx.shadowBlur = 16;
      ctx.shadowOffsetY = 4;
      ctx.fillStyle = ov.color || '#ffffff';
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const startY = -((lines.length - 1) * 36) / 2;
    lines.forEach((ln, idx) => {
      ctx.fillText(ln, 0, startY + idx * 36);
    });
    ctx.restore();
  }

  // Пунктирная рамка выделения активного элемента только в режиме интерактивного превью
  if (selectedOverlayId && selectedOverlayId === ov.id) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((ov.rotDeg * Math.PI) / 180);
    ctx.strokeStyle = '#f4efe4';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    const selW = ov.kind === 'text' ? 520 * ov.scale : 176 * ov.scale;
    const selH = ov.kind === 'text' ? 100 * ov.scale : 156 * ov.scale;
    drawRRect(ctx, -selW / 2, -selH / 2, selW, selH, 16);
    ctx.stroke();
    ctx.restore();
  }
}

/**
 * Нелинейная кривая времени для живого видеоклипа в режиме «Умный хайлайт» (100% на клиенте без сервера):
 * - первые 60% сцены идут бодро (1.23x), убирая паузы;
 * - в фазе 0.60..0.92 включается настоящее слоу-мо (0.56x) синхронно с наездом камеры на лицо и ударом сердца;
 * - в финальные 0.92..1.00 — резкий удар с тряской камеры.
 * Интеграл скорости равен ровно 1.0, поэтому видео и звук сходятся кадр-в-кадр!
 */
export function mapDramaticVideoProgress(u: number): { progress: number; rate: number } {
  const c = Math.max(0, Math.min(1, u));
  if (c <= 0.6) {
    const r1 = 0.74 / 0.6;
    return { progress: c * r1, rate: r1 };
  }
  if (c <= 0.92) {
    const r2 = 0.18 / 0.32; // 0.5625x slow-mo
    return { progress: 0.74 + (c - 0.6) * r2, rate: r2 };
  }
  return { progress: 0.92 + (c - 0.92) * 1.0, rate: 1.0 };
}

/**
 * Нелинейная кривая времени для «Умного хайлайта» (100% на клиенте без сервера):
 * замедляет фазу раздумья и реакции лица (bullet-time slow-mo 0.45x) и резко ускоряет вылет карточки!
 */
function dramaticTimeWarp(rawPhase: number): number {
  if (rawPhase <= 0.26) {
    return (rawPhase / 0.26) * 0.34;
  }
  if (rawPhase <= 0.76) {
    // Замедление времени в момент выбора и реакции на лице
    const sub = (rawPhase - 0.26) / 0.5;
    return 0.34 + sub * 0.36;
  }
  // Резкий хлесткий выброс карточки
  const tail = (rawPhase - 0.76) / 0.24;
  return 0.7 + tail * 0.3;
}

/**
 * Вычисляет параметры виртуальной операторской камеры (зум на лицо, перевод фокуса на шкалы и ударную тряску).
 */
export function computeSmartDirectorCamera(
  rawPhase: number,
  W: number,
  H: number,
  isVideoClip: boolean
): { zoom: number; focusX: number; focusY: number; shakeX: number; shakeY: number; vignette: number } {
  if (isVideoClip) {
    // Синхронно с фазой слоу-мо (0.60..0.92) плавно наезжаем на лицо и карточку, а на 0.92..1.00 даём ударную отдачу
    if (rawPhase > 0.58 && rawPhase <= 0.92) {
      const p = (rawPhase - 0.58) / 0.34;
      const ease = 1 - Math.pow(1 - p, 2);
      return {
        zoom: 1 + 0.23 * ease,
        focusX: W / 2,
        focusY: H * 0.41,
        shakeX: 0,
        shakeY: 0,
        vignette: 0.34 * ease,
      };
    }
    if (rawPhase > 0.92) {
      const imp = (rawPhase - 0.92) / 0.08;
      const damp = Math.exp(-imp * 4.5);
      return {
        zoom: 1.23 - 0.15 * imp,
        focusX: W / 2,
        focusY: H * 0.32,
        shakeX: Math.sin(imp * 48) * 11 * damp,
        shakeY: Math.cos(imp * 40) * 8 * damp,
        vignette: 0.3 * (1 - imp),
      };
    }
    return { zoom: 1, focusX: W / 2, focusY: H / 2, shakeX: 0, shakeY: 0, vignette: 0 };
  }

  // Для сцены свайпа: наезд на лицо в слоу-мо -> удар и перевод камеры вверх на падающие шкалы!
  if (rawPhase > 0.24 && rawPhase <= 0.76) {
    const p = (rawPhase - 0.24) / 0.52;
    const ease = Math.sin(p * Math.PI * 0.5);
    return {
      zoom: 1 + 0.24 * ease,
      focusX: W / 2,
      focusY: H * 0.43,
      shakeX: 0,
      shakeY: 0,
      vignette: 0.38 * ease,
    };
  }
  if (rawPhase > 0.76) {
    const imp = (rawPhase - 0.76) / 0.24;
    const damp = Math.exp(-imp * 5.5);
    return {
      zoom: 1.24 - 0.14 * imp,
      focusX: W / 2,
      focusY: H * (0.43 - 0.18 * Math.min(1, imp * 1.6)),
      shakeX: Math.sin(imp * 58) * 12 * damp,
      shakeY: Math.cos(imp * 46) * 9 * damp,
      vignette: 0.35 * (1 - imp),
    };
  }
  return { zoom: 1, focusX: W / 2, focusY: H / 2, shakeX: 0, shakeY: 0, vignette: 0 };
}

/**
 * Главная функция рендера кадра монтажного проекта в момент времени tSec.
 */
export function renderMontageFrameAtTime(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  tSec: number,
  project: MontageProject,
  assets: MontageRenderAssets,
  selectedOverlayId?: string | null
): void {
  const k = W / 720;
  ctx.save();
  ctx.scale(k, k);
  const VW = 720;
  const VH = 1280;

  const { spans, totalDuration } = computeTimelineSpans(project.clips);
  const clampedT = Math.max(0, Math.min(totalDuration - 0.001, tSec));
  const activeSpan =
    spans.find((sp) => clampedT >= sp.startSec && clampedT < sp.endSec) ??
    spans[spans.length - 1];

  // Определяем кульминационный игровой фрагмент для умной режиссуры (зум + слоу-мо + тряска)
  const climaxSpan = [...spans]
    .reverse()
    .find((sp) => sp.clip.kind === 'swipe' || sp.clip.kind === 'video');

  if (activeSpan) {
    const rawPhase = Math.max(
      0,
      Math.min(1, (clampedT - activeSpan.startSec) / Math.max(0.05, activeSpan.duration))
    );
    const clip = activeSpan.clip;
    const isClimax =
      project.dramaticMode !== false &&
      climaxSpan?.clip.id === clip.id &&
      (clip.kind === 'swipe' || clip.kind === 'video');

    // Зум и тряска всей сцены отключены: хайп делается только слоем лица (faceFx)
    const cam = { zoom: 1, focusX: VW / 2, focusY: VH / 2, shakeX: 0, shakeY: 0, vignette: 0 };

    ctx.save();
    if (cam.zoom > 1.002 || cam.shakeX !== 0 || cam.shakeY !== 0) {
      ctx.translate(VW / 2 + cam.shakeX, VH / 2 + cam.shakeY);
      ctx.scale(cam.zoom, cam.zoom);
      ctx.translate(-cam.focusX, -cam.focusY);
    }

    if (clip.kind === 'video') {
      renderVideoClipScene(ctx, VW, VH, project, clip, assets);
    } else if (clip.kind === 'swipe') {
      const effectivePhase = isClimax ? dramaticTimeWarp(rawPhase) : rawPhase;
      renderSwipeClipScene(ctx, VW, VH, effectivePhase, project, clip, assets);
    } else if (clip.kind === 'real_case') {
      renderRealCaseCutawayScene(ctx, VW, VH, rawPhase, project, clip, assets);
    } else if (clip.kind === 'ending') {
      renderEndingClipScene(ctx, VW, VH, rawPhase, project, assets);
    } else if (clip.kind === 'qr') {
      renderQrClipScene(ctx, VW, VH, project);
    }
    ctx.restore();

    // Кинематографическая виньетка во время драматического слоу-мо / наезда на лицо
    if (cam.vignette > 0.02) {
      const vig = ctx.createRadialGradient(
        VW / 2,
        VH * 0.42,
        VW * 0.24,
        VW / 2,
        VH * 0.5,
        VH * 0.68
      );
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, `rgba(0,0,0,${cam.vignette.toFixed(2)})`);
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, VW, VH);
    }

    // Пользовательские титры и гифки рисуются поверх операторской камеры, чтобы оставаться чёткими
    if (clip.kind !== 'qr') {
      for (const ov of project.overlays) {
        renderOverlayItem(ctx, VW, VH, clampedT, ov, project, assets, selectedOverlayId);
      }
    }
  }

  ctx.restore();
}

/**
 * Собирает единый стерео AudioBuffer (44.1 kHz) для всего смонтированного ролика:
 * - процедуральный бит (Groove / Thriller) с автоматическим приглушением под голос видео;
 * - точные звуки захвата карты, свайпа, документального перехода на реальный кейс и финала;
 * - склейка реальных аудиодорожек из обрезанных видеоклипов [trimStart..trimEnd]!
 */
export async function buildMontageMasterAudioBuffer(
  project: MontageProject
): Promise<AudioBuffer | null> {
  if (typeof OfflineAudioContext === 'undefined') return null;
  const { spans, totalDuration } = computeTimelineSpans(project.clips);
  if (project.soundtrack === 'mute') {
    const hasVideoSound = project.clips.some((c) => c.kind === 'video' && c.volume > 0.01);
    if (!hasVideoSound) return null;
  }

  const sampleRate = 44100;
  const totalFrames = Math.max(2048, Math.ceil(totalDuration * sampleRate));
  const offline = new OfflineAudioContext(2, totalFrames, sampleRate);

  // Декодируем аудио из видеоклипов, если есть (с синхронным замедлением в слоу-мо, если включён Умный хайлайт)
  const climaxVideoSpan = [...spans]
    .reverse()
    .find((s) => s.clip.kind === 'swipe' || s.clip.kind === 'video');
  const videoAudioSpans: Array<{ startSec: number; endSec: number }> = [];
  for (const sp of spans) {
    if (sp.clip.kind === 'video' && sp.clip.blob && sp.clip.volume > 0.01) {
      try {
        const arrBuf = await sp.clip.blob.arrayBuffer();
        const decoded = await offline.decodeAudioData(arrBuf.slice(0));
        const src = offline.createBufferSource();
        src.buffer = decoded;
        const dur = sp.duration;
        const isDramaticVid =
          project.dramaticMode !== false && climaxVideoSpan?.clip.id === sp.clip.id && dur >= 2.2;
        if (isDramaticVid) {
          src.playbackRate.setValueAtTime(0.74 / 0.6, sp.startSec);
          src.playbackRate.setValueAtTime(0.18 / 0.32, sp.startSec + dur * 0.6);
          src.playbackRate.setValueAtTime(1.0, sp.startSec + dur * 0.92);
        }
        const g = offline.createGain();
        g.gain.setValueAtTime(0.001, sp.startSec);
        g.gain.linearRampToValueAtTime(sp.clip.volume, sp.startSec + Math.min(0.04, dur * 0.2));
        g.gain.setValueAtTime(sp.clip.volume, Math.max(sp.startSec, sp.endSec - 0.04));
        g.gain.linearRampToValueAtTime(0.001, sp.endSec);
        src.connect(g).connect(offline.destination);
        src.start(sp.startSec, sp.clip.trimStart, dur);
        src.stop(sp.endSec);
        videoAudioSpans.push({ startSec: sp.startSec, endSec: sp.endSec });
      } catch {
        // Видео без аудиодорожки — пропускаем
      }
    }
  }

  const isMusicActive = project.soundtrack === 'groove' || project.soundtrack === 'thriller';
  if (isMusicActive) {
    const musicBus = offline.createGain();
    musicBus.gain.setValueAtTime(0.24, 0);
    for (const vs of videoAudioSpans) {
      musicBus.gain.setValueAtTime(0.24, Math.max(0, vs.startSec - 0.05));
      musicBus.gain.linearRampToValueAtTime(0.08, vs.startSec + 0.05);
      musicBus.gain.setValueAtTime(0.08, Math.max(vs.startSec, vs.endSec - 0.05));
      musicBus.gain.linearRampToValueAtTime(0.24, Math.min(totalDuration, vs.endSec + 0.08));
    }
    musicBus.connect(offline.destination);

    const stepSec = project.soundtrack === 'groove' ? 0.25 : 0.3;
    const bassNotes =
      project.soundtrack === 'groove' ? [55, 55, 65.41, 49] : [46.25, 46.25, 43.65, 41.2];
    let stepIdx = 0;
    for (let t = 0; t < totalDuration - 0.05; t += stepSec) {
      // Мягкая бочка на чётных долях
      if (stepIdx % 2 === 0) {
        const kick = offline.createOscillator();
        const kg = offline.createGain();
        kick.type = 'sine';
        kick.frequency.setValueAtTime(118, t);
        kick.frequency.exponentialRampToValueAtTime(38, t + 0.13);
        kg.gain.setValueAtTime(0.48, t);
        kg.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        kick.connect(kg).connect(musicBus);
        kick.start(t);
        kick.stop(t + 0.16);
      }

      // Басовый грув
      if (stepIdx % 2 === 1 || project.soundtrack === 'thriller') {
        const bass = offline.createOscillator();
        const bg = offline.createGain();
        const lp = offline.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(320, t);
        bass.type = 'triangle';
        bass.frequency.setValueAtTime(bassNotes[Math.floor(stepIdx / 4) % bassNotes.length], t);
        bg.gain.setValueAtTime(0.28, t);
        bg.gain.exponentialRampToValueAtTime(0.001, t + stepSec * 0.9);
        bass.connect(lp).connect(bg).connect(musicBus);
        bass.start(t);
        bass.stop(t + stepSec);
      }
      stepIdx++;
    }
  }

  // Звуковые акценты сцен + пульс сердца в режиме «Умный хайлайт»
  if (project.soundtrack !== 'mute') {
    const climaxSpan = [...spans]
      .reverse()
      .find((s) => s.clip.kind === 'swipe' || s.clip.kind === 'video');

    for (const sp of spans) {
      const isClimax = project.dramaticMode !== false && climaxSpan?.clip.id === sp.clip.id;

      if (isClimax && sp.duration >= 2.0) {
        // Двойной глубокий удар сердца (lub-dub) во время слоу-мо и наезда на лицо
        const hbBase =
          sp.clip.kind === 'video'
            ? Math.max(sp.startSec, sp.endSec - 1.9)
            : sp.startSec + sp.duration * 0.3;
        [0, 0.22, 0.72, 0.94].forEach((offset, idx) => {
          const ht = hbBase + offset;
          if (ht < totalDuration - 0.14) {
            const hb = offline.createOscillator();
            const hg = offline.createGain();
            hb.type = 'sine';
            hb.frequency.setValueAtTime(idx % 2 === 0 ? 64 : 52, ht);
            hb.frequency.exponentialRampToValueAtTime(30, ht + 0.12);
            hg.gain.setValueAtTime(idx % 2 === 0 ? 0.34 : 0.26, ht);
            hg.gain.exponentialRampToValueAtTime(0.001, ht + 0.13);
            hb.connect(hg).connect(offline.destination);
            hb.start(ht);
            hb.stop(ht + 0.14);
          }
        });
      }

      if (sp.clip.kind === 'swipe') {
        const swipeMoment = sp.startSec + sp.duration * (isClimax ? 0.76 : 0.7);
        if (swipeMoment < totalDuration - 0.08) {
          const osc = offline.createOscillator();
          const g = offline.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(isClimax ? 230 : 190, swipeMoment);
          osc.frequency.exponentialRampToValueAtTime(48, swipeMoment + 0.16);
          g.gain.setValueAtTime(isClimax ? 0.38 : 0.22, swipeMoment);
          g.gain.exponentialRampToValueAtTime(0.001, swipeMoment + 0.17);
          osc.connect(g).connect(offline.destination);
          osc.start(swipeMoment);
          osc.stop(swipeMoment + 0.18);
        }
      } else if (sp.clip.kind === 'real_case') {
        // Глубокий документальный удар при переходе к «А как в реальности ответил...»
        const boom = offline.createOscillator();
        const bg = offline.createGain();
        boom.type = 'sine';
        boom.frequency.setValueAtTime(96, sp.startSec);
        boom.frequency.exponentialRampToValueAtTime(34, sp.startSec + 0.38);
        bg.gain.setValueAtTime(0.36, sp.startSec);
        bg.gain.exponentialRampToValueAtTime(0.001, sp.startSec + 0.42);
        boom.connect(bg).connect(offline.destination);
        boom.start(sp.startSec);
        boom.stop(Math.min(totalDuration, sp.startSec + 0.44));
      } else if (sp.clip.kind === 'ending') {
        const chordNotes = project.ending.isVictory ? [220, 277.18, 329.63] : [146.83, 138.59];
        chordNotes.forEach((freq) => {
          const o = offline.createOscillator();
          const g = offline.createGain();
          o.type = 'triangle';
          o.frequency.setValueAtTime(freq, sp.startSec);
          g.gain.setValueAtTime(0.12, sp.startSec);
          g.gain.exponentialRampToValueAtTime(0.001, Math.min(totalDuration, sp.startSec + 0.65));
          o.connect(g).connect(offline.destination);
          o.start(sp.startSec);
          o.stop(Math.min(totalDuration, sp.startSec + 0.68));
        });
      }
    }
  }

  try {
    return await offline.startRendering();
  } catch {
    return null;
  }
}

function seekHtmlVideo(video: HTMLVideoElement, targetSec: number): Promise<void> {
  return new Promise((resolve) => {
    const clamped = Math.max(0, Math.min((video.duration || targetSec + 1) - 0.02, targetSec));
    if (Math.abs(video.currentTime - clamped) < 0.025 && video.readyState >= 2) {
      resolve();
      return;
    }
    const done = () => {
      video.removeEventListener('seeked', done);
      resolve();
    };
    video.addEventListener('seeked', done, { once: true });
    try {
      video.currentTime = clamped;
    } catch {
      video.removeEventListener('seeked', done);
      resolve();
    }
    setTimeout(done, 260);
  });
}

function sliceAudioBufferRange(
  buf: AudioBuffer,
  startSec: number,
  endSec: number
): AudioBuffer {
  const sr = buf.sampleRate;
  const i0 = Math.max(0, Math.min(buf.length - 1, Math.floor(startSec * sr)));
  const i1 = Math.max(i0 + 1, Math.min(buf.length, Math.ceil(endSec * sr)));
  const len = i1 - i0;
  const out = new AudioBuffer({
    numberOfChannels: buf.numberOfChannels,
    length: len,
    sampleRate: sr,
  });
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    out.copyToChannel(buf.getChannelData(ch).subarray(i0, i1), ch);
  }
  return out;
}

/**
 * Экспортирует выбранное представление ролика (с учётом обрезки startSec..endSec) в готовый MP4.
 */
export async function exportMontageProjectToMp4(
  project: MontageProject,
  baseAssets: Omit<MontageRenderAssets, 'videoFrames'>,
  previewVideoEls: Map<string, HTMLVideoElement>,
  onProgress?: (pct: number, stageLabel: string) => void,
  trimRange?: { startSec: number; endSec: number }
): Promise<{ blob: Blob; file: File; url: string; mime: string }> {
  const W = 720;
  const H = 1280;
  const FPS = 30;
  const { spans, totalDuration } = computeTimelineSpans(project.clips);
  const rangeStart = Math.max(0, Math.min(totalDuration - 0.3, trimRange?.startSec ?? 0));
  const rangeEnd = Math.max(
    rangeStart + 0.4,
    Math.min(totalDuration, trimRange?.endSec ?? totalDuration)
  );
  const exportDuration = rangeEnd - rangeStart;
  const totalFrames = Math.max(12, Math.ceil(exportDuration * FPS));

  onProgress?.(4, 'Подготовка звука…');
  const fullMasterAudio = await buildMontageMasterAudioBuffer(project);
  const masterAudio = fullMasterAudio
    ? sliceAudioBufferRange(fullMasterAudio, rangeStart, rangeEnd)
    : null;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  try {
    const mb = await import('mediabunny');
    const canAvc = await mb.canEncodeVideo('avc', { width: W, height: H });

    if (canAvc) {
      const sinkIterators = new Map<
        string,
        {
          iter: AsyncGenerator<import('mediabunny').WrappedCanvas | null, void, unknown>;
          disposer: () => void;
        }
      >();

      const climaxExportSpan = [...spans]
        .reverse()
        .find((s) => s.clip.kind === 'swipe' || s.clip.kind === 'video');

      for (const sp of spans) {
        if (sp.clip.kind === 'video' && sp.clip.blob) {
          try {
            const inp = new mb.Input({
              source: new mb.BlobSource(sp.clip.blob),
              formats: mb.ALL_FORMATS,
            });
            const vTrack = await inp.getPrimaryVideoTrack();
            if (vTrack) {
              const sink = new mb.CanvasSink(vTrack, {
                width: W,
                height: H,
                fit: sp.clip.fit,
                poolSize: 2,
              });
              const isDramaticVid =
                project.dramaticMode !== false &&
                climaxExportSpan?.clip.id === sp.clip.id &&
                sp.duration >= 2.2;
              const clipFrameTimestamps: number[] = [];
              for (let fi = 0; fi < totalFrames; fi++) {
                const projT = rangeStart + fi / FPS;
                if (projT >= sp.startSec && projT < sp.endSec) {
                  const u = (projT - sp.startSec) / Math.max(0.05, sp.duration);
                  const mappedProgress = isDramaticVid ? mapDramaticVideoProgress(u).progress : u;
                  clipFrameTimestamps.push(sp.clip.trimStart + mappedProgress * sp.duration);
                }
              }
              if (clipFrameTimestamps.length > 0) {
                sinkIterators.set(sp.clip.id, {
                  iter: sink.canvasesAtTimestamps(clipFrameTimestamps),
                  disposer: () => inp.dispose(),
                });
              } else {
                inp.dispose();
              }
            } else {
              inp.dispose();
            }
          } catch {
            // fallback via seekHtmlVideo
          }
        }
      }

      const target = new mb.BufferTarget();
      const output = new mb.Output({
        format: new mb.Mp4OutputFormat({ fastStart: 'in-memory' }),
        target,
      });

      const canvasSource = new mb.CanvasSource(canvas, {
        codec: 'avc',
        quality: mb.QUALITY_HIGH,
        keyFrameInterval: 1,
      });
      output.addVideoTrack(canvasSource);

      let audioSource: InstanceType<typeof mb.AudioBufferSource> | null = null;
      const canAac = masterAudio ? await mb.canEncodeAudio('aac') : false;
      if (masterAudio && canAac) {
        audioSource = new mb.AudioBufferSource({
          codec: 'aac',
          bitrate: 128_000,
        });
        output.addAudioTrack(audioSource);
      }

      await output.start();
      if (audioSource && masterAudio) {
        await audioSource.add(masterAudio);
        audioSource.close();
      }

      const frameMap = new Map<string, CanvasImageSource | null>();
      try {
        for (let fi = 0; fi < totalFrames; fi++) {
          const outT = fi / FPS;
          const projT = rangeStart + outT;
          const activeSpan = spans.find((s) => projT >= s.startSec && projT < s.endSec);

          if (activeSpan && activeSpan.clip.kind === 'video') {
            const clipId = activeSpan.clip.id;
            const sinkEntry = sinkIterators.get(clipId);
            if (sinkEntry) {
              const nextFrame = await sinkEntry.iter.next();
              frameMap.set(clipId, nextFrame.value?.canvas ?? null);
            } else {
              const vidEl = previewVideoEls.get(clipId);
              if (vidEl) {
                await seekHtmlVideo(
                  vidEl,
                  activeSpan.clip.trimStart + (projT - activeSpan.startSec)
                );
                frameMap.set(clipId, vidEl);
              }
            }
          }

          for (const [, cust] of baseAssets.customStickers) {
            if (cust.kind === 'video_loop' && cust.videoEl && cust.videoEl.duration > 0) {
              await seekHtmlVideo(cust.videoEl, outT % cust.videoEl.duration);
            }
          }

          renderMontageFrameAtTime(ctx, W, H, projT, project, {
            ...baseAssets,
            videoFrames: frameMap,
          });

          await canvasSource.add(outT, 1 / FPS);

          if (fi % 5 === 0 || fi === totalFrames - 1) {
            const pct = 8 + Math.round(((fi + 1) / totalFrames) * 88);
            onProgress?.(pct, `Готовим видео… ${pct}%`);
            await new Promise((r) => setTimeout(r, 0));
          }
        }
      } finally {
        for (const [, entry] of sinkIterators) {
          entry.disposer();
        }
      }

      canvasSource.close();
      await output.finalize();

      if (target.buffer && target.buffer.byteLength > 512) {
        onProgress?.(100, 'Готово');
        const mp4Blob = new Blob([target.buffer], { type: 'video/mp4' });
        const file = new File([mp4Blob], `kreslo-${Date.now().toString().slice(-5)}.mp4`, {
          type: 'video/mp4',
          lastModified: Date.now(),
        });
        return {
          blob: mp4Blob,
          file,
          url: URL.createObjectURL(mp4Blob),
          mime: 'video/mp4',
        };
      }
    }
  } catch {
    // fallback below
  }

  // 2. Резервный путь через MediaRecorder (если браузер без WebCodecs)
  const stream = canvas.captureStream(FPS);
  let audioCtx: AudioContext | null = null;
  if (masterAudio && typeof AudioContext !== 'undefined') {
    try {
      audioCtx = new AudioContext();
      const dest = audioCtx.createMediaStreamDestination();
      const src = audioCtx.createBufferSource();
      src.buffer = masterAudio;
      src.connect(dest);
      src.start(0);
      dest.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr));
    } catch {
      // ignore
    }
  }

  const mimeCandidates = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm',
  ];
  const chosenMime =
    mimeCandidates.find(
      (m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)
    ) || '';
  const recorder = chosenMime
    ? new MediaRecorder(stream, { mimeType: chosenMime, videoBitsPerSecond: 3_500_000 })
    : new MediaRecorder(stream);

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (ev) => {
    if (ev.data && ev.data.size > 0) chunks.push(ev.data);
  };
  const donePromise = new Promise<Blob>((resolve) => {
    recorder.onstop = () =>
      resolve(new Blob(chunks, { type: recorder.mimeType || chosenMime || 'video/mp4' }));
  });

  recorder.start(250);
  const t0 = performance.now();
  const liveVideoFrames = new Map<string, CanvasImageSource | null>();
  previewVideoEls.forEach((v, id) => liveVideoFrames.set(id, v));

  await new Promise<void>((resolve) => {
    const tick = () => {
      const elapsed = (performance.now() - t0) / 1000;
      const clamped = Math.min(exportDuration, elapsed);
      renderMontageFrameAtTime(ctx, W, H, rangeStart + clamped, project, {
        ...baseAssets,
        videoFrames: liveVideoFrames,
      });
      const pct = Math.min(99, Math.round((clamped / exportDuration) * 100));
      onProgress?.(pct, `Запись ролика… ${pct}%`);
      if (elapsed >= exportDuration) {
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };
    tick();
  });

  recorder.stop();
  stream.getTracks().forEach((tr) => tr.stop());
  void audioCtx?.close();

  const rawBlob = await donePromise;
  onProgress?.(100, 'Готово!');
  const isMp4 = (rawBlob.type || chosenMime).includes('mp4');
  const finalMime = isMp4 ? 'video/mp4' : 'video/webm';
  const ext = isMp4 ? 'mp4' : 'webm';
  const file = new File([rawBlob], `kreslo-story-${Date.now().toString().slice(-5)}.${ext}`, {
    type: finalMime,
    lastModified: Date.now(),
  });
  return { blob: rawBlob, file, url: URL.createObjectURL(rawBlob), mime: finalMime };
}
