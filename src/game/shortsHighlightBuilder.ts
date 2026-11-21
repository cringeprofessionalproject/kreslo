import type { DilemmaCard, EndingDef, JobPack, PackId, RealHistoricalCase } from '../types';

/**
 * «ШОРТС-КОМБАЙН» (v39):
 * Собирает сочный 13.5-секундный вертикальный клип (720×1280, 9:16) прямо на клиенте:
 * 1) 0.0–2.4 с: Хук с авторским титром игрока + фирменный цвет колоды + стикер-гифка.
 * 2) 2.4–8.1 с: 3 самых острых свайпа забега в ритм со штампами ВЛЕВО/ВПРАВО.
 * 3) 8.1–12.4 с: Разворот «РЕАЛЬНЫЙ ПРОТОТИП / ЗНАМЕНИТЫЙ ТУПНЯК С ПРУФОМ» (байт на паузу и споры).
 * 4) 12.4–13.05 с: Финальный штамп концовки.
 * 5) 13.05–13.50 с: «25-й кадр» (0.45 сек) с проверенным QR на https://t.me/vkreslegame («кто захочет — поймает на паузе»).
 */

export type HighlightStickerId = 'fire_chair' | 'stamp_fired' | 'clown_boss' | 'cash_burn' | 'crown_win' | 'none';

export interface HighlightStickerDef {
  id: HighlightStickerId;
  label: string;
  emoji: string;
}

export const HIGHLIGHT_STICKERS: HighlightStickerDef[] = [
  { id: 'fire_chair', label: 'Кресло горит', emoji: '🔥' },
  { id: 'stamp_fired', label: 'Штамп УВОЛЕН', emoji: '💀' },
  { id: 'clown_boss', label: 'Гений управления', emoji: '🤡' },
  { id: 'cash_burn', label: 'Деньги на ветер', emoji: '💸' },
  { id: 'crown_win', label: 'Босс выстоял', emoji: '👑' },
  { id: 'none', label: 'Без стикера', emoji: '✕' },
];

export interface RunSwipeHighlight {
  week: number;
  speaker: string;
  text: string;
  chosenLabel: string;
  side: 'left' | 'right';
  /** Совпал ли выбор игрока с исходным left/right реального прототипа */
  matchedRealCase?: boolean;
  realCase?: RealHistoricalCase;
}

export interface ShortsCombainOptions {
  pack: JobPack;
  ending: EndingDef;
  weeksSurvived: number;
  swipes: RunSwipeHighlight[];
  hookText: string;
  sticker: HighlightStickerId;
  faceSnapshotUrl?: string | null;
}

// Проверенная через Apple CIDetectorTypeQRCode 25×25 ISO-18004 матрица для "https://t.me/vkreslegame"
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

export interface PackPopPalette {
  bgTop: string;
  bgBottom: string;
  accent: string;
  accentSoft: string;
  cardHeader: string;
}

export function getSignaturePopPalette(packId: PackId): PackPopPalette {
  switch (packId) {
    case 'wb_seller':
    case 'pvz_december':
      return {
        bgTop: '#260b34',
        bgBottom: '#11061c',
        accent: '#ff3ca6',
        accentSoft: 'rgba(255, 60, 166, 0.24)',
        cardHeader: '#4b1468',
      };
    case 'it_product':
    case 'ai_agent':
    case 'ux_designer':
      return {
        bgTop: '#0b1c3d',
        bgBottom: '#060d1f',
        accent: '#38bdf8',
        accentSoft: 'rgba(56, 189, 248, 0.24)',
        cardHeader: '#163570',
      };
    case 'sales_rop':
    case 'sales_manager':
    case 'it_cfo':
      return {
        bgTop: '#082c24',
        bgBottom: '#041512',
        accent: '#34d399',
        accentSoft: 'rgba(52, 211, 153, 0.24)',
        cardHeader: '#0f4c3d',
      };
    case 'renovation_pro':
    case 'cctv_installer':
    case 'scs_designer':
      return {
        bgTop: '#331a0a',
        bgBottom: '#170b04',
        accent: '#fbbf24',
        accentSoft: 'rgba(251, 191, 36, 0.24)',
        cardHeader: '#5c2d10',
      };
    case 'car_flipper':
      return {
        bgTop: '#2f0b12',
        bgBottom: '#140508',
        accent: '#fb7185',
        accentSoft: 'rgba(251, 113, 133, 0.24)',
        cardHeader: '#5c1422',
      };
    case 'plastic_surgeon':
      return {
        bgTop: '#082c36',
        bgBottom: '#04141a',
        accent: '#2dd4bf',
        accentSoft: 'rgba(45, 212, 191, 0.24)',
        cardHeader: '#0f4d5c',
      };
    case 'barista_pro':
      return {
        bgTop: '#2c1910',
        bgBottom: '#140b07',
        accent: '#f59e0b',
        accentSoft: 'rgba(245, 158, 11, 0.24)',
        cardHeader: '#522e1c',
      };
    default:
      // Офис на грани и остальные — тёплый графит + электрический коралл
      return {
        bgTop: '#1f1630',
        bgBottom: '#0d0917',
        accent: '#ff6b57',
        accentSoft: 'rgba(255, 107, 87, 0.24)',
        cardHeader: '#392659',
      };
  }
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

export function getDefaultHookPresets(pack: JobPack, ending: EndingDef, weeks: number): string[] {
  if (ending.isVictory) {
    return [
      `Прошёл все ${weeks} смен в «${pack.shortTitle}» и не вылетел!`,
      '92% срезаются до финала, а я удержал кресло',
      'А как бы ты вырулил на этом раскладе?',
    ];
  }
  return [
    `Меня вынесли на ${weeks}-й смене в «${pack.shortTitle}» 💀`,
    'Один неверный свайп — и контора в труху',
    '90% делают тут ту же ошибку, что и я',
    'А какой вариант выбрал бы ты?',
  ];
}

function drawRoundedRect(
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

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawQrMatrix(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  boxSize: number
) {
  const quiet = 3;
  const n = VKRESLEGAME_QR_MATRIX.length;
  const totalMods = n + quiet * 2;
  const cell = boxSize / totalMods;

  ctx.fillStyle = '#ffffff';
  drawRoundedRect(ctx, x, y, boxSize, boxSize, 12);
  ctx.fill();

  ctx.fillStyle = '#0b0b12';
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

function drawAnimatedSticker(
  ctx: CanvasRenderingContext2D,
  sticker: HighlightStickerId,
  tSec: number,
  x: number,
  y: number
) {
  if (sticker === 'none') return;
  const def = HIGHLIGHT_STICKERS.find((s) => s.id === sticker);
  if (!def) return;

  ctx.save();
  const pulse = 1 + Math.sin(tSec * 9.5) * 0.08;
  const tilt = Math.sin(tSec * 6.2) * 0.09;
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.scale(pulse, pulse);

  ctx.fillStyle = 'rgba(15, 14, 24, 0.9)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 3;
  drawRoundedRect(ctx, -118, -38, 236, 76, 38);
  ctx.fill();
  ctx.stroke();

  ctx.font = '700 34px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(def.emoji, -98, 2);

  ctx.fillStyle = '#ffffff';
  ctx.font = '800 20px system-ui, -apple-system, sans-serif';
  ctx.fillText(def.label.toUpperCase(), -50, 1);
  ctx.restore();
}

export function renderShortsFrameAtTime(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  tSec: number,
  opts: ShortsCombainOptions,
  faceImg: HTMLImageElement | null
): void {
  const pal = getSignaturePopPalette(opts.pack.id);
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, pal.bgTop);
  bg.addColorStop(1, pal.bgBottom);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Свечение в стиле Signature Pop
  const rad = ctx.createRadialGradient(W * 0.5, H * 0.28, 30, W * 0.5, H * 0.28, W * 0.72);
  rad.addColorStop(0, pal.accentSoft);
  rad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rad;
  ctx.fillRect(0, 0, W, H);

  const selectedSwipes = opts.swipes.slice(-3);
  const caseBundle = pickBestRealCaseForHighlight(opts.pack, opts.swipes);

  // СЦЕНА 5 (13.05–13.50 с): 25-Й КАДР С МИКРО-QR (0.45 сек)
  if (tSec >= 13.05) {
    ctx.fillStyle = '#090910';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = pal.accent;
    ctx.font = '800 22px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('КРЕСЛО · БЫСТРАЯ ВСТАВКА 0.4 СЕК', W / 2, H * 0.34);

    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.font = '600 25px system-ui, -apple-system, sans-serif';
    ctx.fillText('Не тратим ваше время рекламой.', W / 2, H * 0.39);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '500 21px system-ui, -apple-system, sans-serif';
    ctx.fillText('Кому надо — поймал на паузе:', W / 2, H * 0.43);

    const qrSize = 210;
    drawQrMatrix(ctx, (W - qrSize) / 2, H * 0.47, qrSize);

    ctx.fillStyle = '#ffffff';
    ctx.font = '800 26px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText('@vkreslegame', W / 2, H * 0.47 + qrSize + 48);
    return;
  }

  // ВЕРХНЯЯ ПЛАШКА-ХУК ИГРОКА (держится на всех основных сценах)
  ctx.save();
  ctx.fillStyle = '#ffffff';
  drawRoundedRect(ctx, 44, 68, W - 88, 126, 26);
  ctx.fill();

  ctx.fillStyle = '#111118';
  ctx.font = '800 29px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  const hookLines = wrapLines(ctx, opts.hookText || 'Один свайп решил всё', W - 136).slice(0, 2);
  hookLines.forEach((ln, idx) => {
    ctx.fillText(ln, W / 2, hookLines.length === 1 ? 140 : 118 + idx * 36);
  });
  ctx.restore();

  // СЦЕНА 1 (0.0–2.2 с): ВХОД В ПРОФЕССИЮ
  if (tSec < 2.2) {
    const pop = Math.min(1, tSec / 0.28);
    ctx.save();
    ctx.translate(W / 2, H * 0.52);
    ctx.scale(0.9 + 0.1 * pop, 0.9 + 0.1 * pop);

    ctx.fillStyle = '#faf6ee';
    drawRoundedRect(ctx, -296, -270, 592, 540, 36);
    ctx.fill();

    ctx.fillStyle = pal.cardHeader;
    drawRoundedRect(ctx, -296, -270, 592, 180, 36);
    ctx.fill();

    ctx.font = '92px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(opts.pack.emoji || '🪑', 0, -148);

    ctx.fillStyle = '#15151c';
    ctx.font = '900 40px system-ui, -apple-system, sans-serif';
    const titleLines = wrapLines(ctx, opts.pack.title, 510).slice(0, 2);
    titleLines.forEach((l, i) => ctx.fillText(l, 0, -24 + i * 46));

    ctx.fillStyle = '#57534e';
    ctx.font = '600 25px system-ui, -apple-system, sans-serif';
    const firstQ = selectedSwipes[0]?.text || opts.pack.subtitle;
    wrapLines(ctx, firstQ, 500)
      .slice(0, 3)
      .forEach((l, i) => ctx.fillText(l, 0, 88 + i * 36));

    ctx.restore();
    drawAnimatedSticker(ctx, opts.sticker, tSec, W - 170, H - 150);
    return;
  }

  // СЦЕНА 2 (2.2–7.9 с): 3 УДАРНЫХ СВАЙПА В БИТ (по 1.9 с каждый)
  if (tSec < 7.9 && selectedSwipes.length > 0) {
    const local = tSec - 2.2;
    const slotLen = 5.7 / selectedSwipes.length;
    const idx = Math.min(selectedSwipes.length - 1, Math.floor(local / slotLen));
    const phase = (local - idx * slotLen) / slotLen; // 0..1
    const sw = selectedSwipes[idx];

    const fly = phase > 0.68 ? (phase - 0.68) / 0.32 : 0;
    const dir = sw.side === 'right' ? 1 : -1;
    const shiftX = dir * Math.pow(fly, 2) * 440;
    const rot = dir * Math.pow(fly, 1.6) * 0.22;

    ctx.save();
    ctx.translate(W / 2 + shiftX, H * 0.53);
    ctx.rotate(rot);

    ctx.fillStyle = '#faf6ee';
    drawRoundedRect(ctx, -304, -295, 608, 590, 36);
    ctx.fill();

    ctx.fillStyle = pal.cardHeader;
    drawRoundedRect(ctx, -304, -295, 608, 132, 36);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '700 21px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`СМЕНА ${sw.week} / 36`, -264, -238);

    ctx.fillStyle = '#ffffff';
    ctx.font = '800 26px system-ui, -apple-system, sans-serif';
    ctx.fillText(sw.speaker.slice(0, 32), -264, -196);

    ctx.fillStyle = '#14141b';
    ctx.font = '700 31px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    wrapLines(ctx, sw.text, 524)
      .slice(0, 4)
      .forEach((l, i) => ctx.fillText(l, -264, -104 + i * 42));

    // Выбранный вариант игрока
    ctx.fillStyle = sw.side === 'right' ? '#065f46' : '#7f1d1d';
    drawRoundedRect(ctx, -268, 120, 536, 134, 24);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.78)';
    ctx.font = '800 19px system-ui, -apple-system, sans-serif';
    ctx.fillText(sw.side === 'right' ? 'ВЫБОР ВПРАВО →' : '← ВЫБОР ВЛЕВО', -236, 158);

    ctx.fillStyle = '#ffffff';
    ctx.font = '800 26px system-ui, -apple-system, sans-serif';
    wrapLines(ctx, sw.chosenLabel, 476)
      .slice(0, 2)
      .forEach((l, i) => ctx.fillText(l, -236, 196 + i * 32));

    ctx.restore();

    if (faceImg) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(118, H - 156, 68, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(faceImg, 50, H - 224, 136, 136);
      ctx.restore();
    }
    drawAnimatedSticker(ctx, opts.sticker, tSec, W - 168, H - 152);
    return;
  }

  // СЦЕНА 3 (7.9–12.1 с): РЕАЛЬНЫЙ КЕЙС ИЛИ ЗНАМЕНИТЫЙ ТУПНЯК С ПРУФОМ!
  if (tSec < 12.1 && caseBundle) {
    const rc = caseBundle.realCase;
    const isBlunder = rc.kind === 'blunder';

    ctx.save();
    ctx.fillStyle = '#12101c';
    ctx.strokeStyle = isBlunder ? '#f43f5e' : '#10b981';
    ctx.lineWidth = 5;
    drawRoundedRect(ctx, 44, 232, W - 88, 790, 34);
    ctx.fill();
    ctx.stroke();

    // Бейдж
    ctx.fillStyle = isBlunder ? '#f43f5e' : '#10b981';
    drawRoundedRect(ctx, 80, 272, W - 160, 62, 18);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 23px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      isBlunder ? '💀 РЕАЛЬНЫЙ ИСТОРИЧЕСКИЙ ТУПНЯК' : '🏛 РЕАЛЬНЫЙ ИСТОРИЧЕСКИЙ ХОД',
      W / 2,
      311
    );

    ctx.fillStyle = '#fbbf24';
    ctx.font = '800 30px system-ui, -apple-system, sans-serif';
    ctx.fillText(`${rc.person} · ${rc.year}`, W / 2, 392);

    if (caseBundle.playerMatched !== undefined) {
      ctx.fillStyle = 'rgba(255,255,255,0.72)';
      ctx.font = '700 22px system-ui, -apple-system, sans-serif';
      const matchNote = caseBundle.playerMatched
        ? isBlunder
          ? 'Ты наступил ровно на те же грабли в этой смене!'
          : 'Ты принял точно такое же решение в этой смене!'
        : isBlunder
          ? 'Ты обошёл эту ловушку, а в реальности было так:'
          : 'Ты пошёл другим путём, а в истории было так:';
      ctx.fillText(matchNote, W / 2, 434);
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = '800 31px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    const headLines = wrapLines(ctx, rc.headline, W - 168).slice(0, 2);
    headLines.forEach((l, i) => ctx.fillText(l, 84, 502 + i * 40));

    ctx.fillStyle = 'rgba(244, 244, 248, 0.9)';
    ctx.font = '600 26px system-ui, -apple-system, sans-serif';
    const storyLines = wrapLines(ctx, rc.story, W - 168).slice(0, 7);
    storyLines.forEach((l, i) => ctx.fillText(l, 84, 600 + i * 38));

    ctx.fillStyle = 'rgba(255,255,255,0.52)';
    ctx.font = '600 20px system-ui, -apple-system, sans-serif';
    ctx.fillText(`Пруф: ${rc.source.slice(0, 48)}`, 84, 976);
    ctx.restore();

    drawAnimatedSticker(ctx, opts.sticker, tSec, W - 168, H - 132);
    return;
  }

  // СЦЕНА 4 (до 13.05 с): ФИНАЛЬНЫЙ ШТАМП КОНЦОВКИ
  ctx.save();
  ctx.fillStyle = '#faf6ee';
  drawRoundedRect(ctx, 56, 270, W - 112, 680, 38);
  ctx.fill();

  ctx.fillStyle = opts.ending.isVictory ? '#059669' : '#dc2626';
  drawRoundedRect(ctx, 96, 316, W - 192, 68, 20);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 26px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    opts.ending.isVictory
      ? `ПОБЕДА · ${opts.weeksSurvived} СМЕН`
      : `УВОЛЕН НА ${opts.weeksSurvived}-й СМЕНЕ`,
    W / 2,
    359
  );

  ctx.fillStyle = '#111118';
  ctx.font = '900 38px system-ui, -apple-system, sans-serif';
  wrapLines(ctx, opts.ending.title, W - 180)
    .slice(0, 2)
    .forEach((l, i) => ctx.fillText(l, W / 2, 456 + i * 46));

  ctx.fillStyle = '#44403c';
  ctx.font = '600 26px system-ui, -apple-system, sans-serif';
  wrapLines(ctx, opts.ending.description, W - 180)
    .slice(0, 5)
    .forEach((l, i) => ctx.fillText(l, W / 2, 574 + i * 38));

  ctx.restore();
  drawAnimatedSticker(ctx, opts.sticker, tSec, W / 2, H - 156);
}

function loadImageOptional(src?: string | null): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function exportShortsCombainVideo(
  opts: ShortsCombainOptions,
  onProgress?: (pct: number) => void
): Promise<{ blob: Blob; file: File; url: string; mime: string }> {
  const W = 720;
  const H = 1280;
  const DURATION_SEC = 13.5;
  const FPS = 30;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const faceImg = await loadImageOptional(opts.faceSnapshotUrl);

  const mimeCandidates = [
    'video/mp4;codecs=avc1.42E01E',
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  const chosenMime =
    mimeCandidates.find(
      (m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)
    ) || '';

  const stream = canvas.captureStream(FPS);
  const recorder = chosenMime
    ? new MediaRecorder(stream, { mimeType: chosenMime, videoBitsPerSecond: 3_200_000 })
    : new MediaRecorder(stream);

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (ev) => {
    if (ev.data && ev.data.size > 0) chunks.push(ev.data);
  };

  const donePromise = new Promise<Blob>((resolve) => {
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: recorder.mimeType || chosenMime || 'video/mp4' }));
    };
  });

  recorder.start(250);
  const t0 = performance.now();

  await new Promise<void>((resolve) => {
    const tick = () => {
      const elapsed = (performance.now() - t0) / 1000;
      const clamped = Math.min(DURATION_SEC, elapsed);
      renderShortsFrameAtTime(ctx, W, H, clamped, opts, faceImg);
      onProgress?.(Math.min(99, Math.round((clamped / DURATION_SEC) * 100)));
      if (elapsed >= DURATION_SEC) {
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };
    tick();
  });

  recorder.stop();
  stream.getTracks().forEach((tr) => tr.stop());
  const rawBlob = await donePromise;
  onProgress?.(100);

  const isMp4 = (rawBlob.type || chosenMime).includes('mp4');
  const ext = isMp4 ? 'mp4' : 'webm';
  const finalMime = isMp4 ? 'video/mp4' : 'video/webm';
  const file = new File([rawBlob], `kreslo-shorts-${Date.now()}.${ext}`, { type: finalMime });
  const url = URL.createObjectURL(rawBlob);
  return { blob: rawBlob, file, url, mime: finalMime };
}
