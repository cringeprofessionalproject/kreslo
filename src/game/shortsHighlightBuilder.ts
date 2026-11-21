import type { DilemmaCard, EndingDef, JobPack, PackId, RealHistoricalCase } from '../types';

/**
 * ВИДЕО-ХАЙЛАЙТ СМЕНЫ (v40 · Стиль «КРЕСЛО / Эвристика»):
 * Собирает вертикальный клип 13.5 сек (720×1280, 9:16) прямо на устройстве:
 * 1) 0.0–2.2 с: Титульный лист смены на архивной бумаге + верхний авторский тезис.
 * 2) 2.2–7.9 с: 3 ключевых свайпа партии со штампами выбора.
 * 3) 7.9–12.1 с: Исторический прецедент или известный просчёт с источником.
 * 4) 12.1–13.05 с: Итоговый вердикт смены.
 * 5) 13.05–13.50 с: Короткий финальный кадр (0.45 сек) с верифицированным QR на https://t.me/vkreslegame.
 */

export type HighlightStickerId =
  | 'fire_chair'
  | 'stamp_fired'
  | 'clown_boss'
  | 'cash_burn'
  | 'crown_win'
  | 'none';

export interface HighlightStickerDef {
  id: HighlightStickerId;
  label: string;
  stamp: string;
}

export const HIGHLIGHT_STICKERS: HighlightStickerDef[] = [
  { id: 'fire_chair', label: 'Кресло горит', stamp: 'КРЕСЛО В ОГНЕ' },
  { id: 'stamp_fired', label: 'Штамп: Уволен', stamp: 'СНЯТ С ДОЛЖНОСТИ' },
  { id: 'clown_boss', label: 'Управленческий ход', stamp: 'СИЛЬНЫЙ МАНЁВР' },
  { id: 'cash_burn', label: 'Кассовый разрыв', stamp: 'МИНУС БЮДЖЕТ' },
  { id: 'crown_win', label: 'Удержал кресло', stamp: 'БАЛАНС УДЕРЖАН' },
  { id: 'none', label: 'Без штампа', stamp: '' },
];

export interface RunSwipeHighlight {
  week: number;
  speaker: string;
  text: string;
  chosenLabel: string;
  side: 'left' | 'right';
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

export interface PackEditorialPalette {
  bgTop: string;
  bgBottom: string;
  accent: string;
  accentSoft: string;
  cardHeader: string;
}

export function getSignaturePopPalette(packId: PackId): PackEditorialPalette {
  switch (packId) {
    case 'renovation_pro':
    case 'barista_pro':
      return {
        bgTop: '#1c1712',
        bgBottom: '#0d0b09',
        accent: '#c89b4f',
        accentSoft: 'rgba(200, 155, 79, 0.18)',
        cardHeader: '#261f18',
      };
    case 'car_flipper':
    case 'wb_seller':
    case 'pvz_december':
      return {
        bgTop: '#1d1413',
        bgBottom: '#0d0a09',
        accent: '#c83e31',
        accentSoft: 'rgba(200, 62, 49, 0.16)',
        cardHeader: '#2a1a18',
      };
    case 'it_product':
    case 'plastic_surgeon':
      return {
        bgTop: '#101d20',
        bgBottom: '#091113',
        accent: '#6cc4a1',
        accentSoft: 'rgba(108, 196, 161, 0.16)',
        cardHeader: '#16292d',
      };
    default:
      // Фирменная хвойно-латунная палитра «КРЕСЛО / Эвристика»
      return {
        bgTop: '#15241e',
        bgBottom: '#0b100e',
        accent: '#c89b4f',
        accentSoft: 'rgba(200, 155, 79, 0.18)',
        cardHeader: '#172821',
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
      `Прошёл все ${weeks} смен в «${pack.shortTitle}» и удержал баланс`,
      '92% срезаются до финала, а здесь все 4 шкалы устояли',
      'Как бы вы решили этот рабочий конфликт?',
    ];
  }
  return [
    `Срыв на ${weeks}-й смене в «${pack.shortTitle}»`,
    'Одно решение — и вся система пошла вразнос',
    'Типичная управленческая ловушка, на которой горят 9 из 10',
    'А какой вариант выбрали бы вы?',
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

function drawQrMatrix(ctx: CanvasRenderingContext2D, x: number, y: number, boxSize: number) {
  const quiet = 3;
  const n = VKRESLEGAME_QR_MATRIX.length;
  const totalMods = n + quiet * 2;
  const cell = boxSize / totalMods;

  ctx.fillStyle = '#f4efe4';
  drawRoundedRect(ctx, x, y, boxSize, boxSize, 10);
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

function drawEditorialStamp(
  ctx: CanvasRenderingContext2D,
  sticker: HighlightStickerId,
  tSec: number,
  x: number,
  y: number
) {
  if (sticker === 'none') return;
  const def = HIGHLIGHT_STICKERS.find((s) => s.id === sticker);
  if (!def || !def.stamp) return;

  const isPositive = sticker === 'crown_win' || sticker === 'clown_boss';
  const color = isPositive ? '#1e6b52' : '#c83e31';

  ctx.save();
  const scale = 1 + Math.sin(tSec * 5.2) * 0.03;
  ctx.translate(x, y);
  ctx.rotate(-0.08);
  ctx.scale(scale, scale);

  ctx.fillStyle = 'rgba(244, 239, 228, 0.96)';
  ctx.strokeStyle = color;
  ctx.lineWidth = 3.5;
  drawRoundedRect(ctx, -138, -32, 276, 64, 8);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  drawRoundedRect(ctx, -131, -25, 262, 50, 5);
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.font = '800 19px "JetBrains Mono", ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(def.stamp, 0, 1);
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

  const rad = ctx.createRadialGradient(W * 0.5, H * 0.28, 30, W * 0.5, H * 0.28, W * 0.72);
  rad.addColorStop(0, pal.accentSoft);
  rad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rad;
  ctx.fillRect(0, 0, W, H);

  const selectedSwipes = opts.swipes.slice(-3);
  const caseBundle = pickBestRealCaseForHighlight(opts.pack, opts.swipes);

  // СЦЕНА 5 (13.05–13.50 с): КОРОТКИЙ КАДР С QR (0.45 сек)
  if (tSec >= 13.05) {
    ctx.fillStyle = '#0d1512';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#c89b4f';
    ctx.font = '700 20px "JetBrains Mono", ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('КРЕСЛО · СИМУЛЯТОР РЕШЕНИЙ', W / 2, H * 0.34);

    ctx.fillStyle = '#f4efe4';
    ctx.font = '700 25px "Manrope", system-ui, sans-serif';
    ctx.fillText('Не отнимаем время рекламой.', W / 2, H * 0.39);
    ctx.fillStyle = '#a6aba6';
    ctx.font = '500 21px "Manrope", system-ui, sans-serif';
    ctx.fillText('Поставьте на паузу, чтобы открыть расклад:', W / 2, H * 0.43);

    const qrSize = 216;
    drawQrMatrix(ctx, (W - qrSize) / 2, H * 0.47, qrSize);

    ctx.fillStyle = '#f4efe4';
    ctx.font = '700 25px "JetBrains Mono", ui-monospace, monospace';
    ctx.fillText('@vkreslegame', W / 2, H * 0.47 + qrSize + 48);
    return;
  }

  // ВЕРХНЯЯ КАРТОЧКА-ТЕЗИС НА АРХИВНОЙ БУМАГЕ
  ctx.save();
  ctx.fillStyle = '#f4efe4';
  ctx.strokeStyle = '#c89b4f';
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, 44, 68, W - 88, 124, 16);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#181614';
  ctx.font = '800 28px "Manrope", system-ui, sans-serif';
  ctx.textAlign = 'center';
  const hookLines = wrapLines(ctx, opts.hookText || 'Одно решение изменило всю смену', W - 136).slice(
    0,
    2
  );
  hookLines.forEach((ln, idx) => {
    ctx.fillText(ln, W / 2, hookLines.length === 1 ? 138 : 117 + idx * 35);
  });
  ctx.restore();

  // СЦЕНА 1 (0.0–2.2 с): ТИТУЛЬНЫЙ ЛИСТ ПРОФЕССИИ
  if (tSec < 2.2) {
    const pop = Math.min(1, tSec / 0.26);
    ctx.save();
    ctx.translate(W / 2, H * 0.53);
    ctx.scale(0.92 + 0.08 * pop, 0.92 + 0.08 * pop);

    ctx.fillStyle = '#f4efe4';
    ctx.strokeStyle = '#dcd3c0';
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, -296, -260, 592, 520, 24);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = pal.cardHeader;
    drawRoundedRect(ctx, -296, -260, 592, 138, 24);
    ctx.fill();

    ctx.fillStyle = '#c89b4f';
    ctx.font = '700 19px "JetBrains Mono", ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('КРЕСЛО · ДОСЬЕ СМЕНЫ', 0, -205);

    ctx.fillStyle = '#f4efe4';
    ctx.font = '700 22px "Manrope", system-ui, sans-serif';
    ctx.fillText(`Смена ${opts.weeksSurvived} из 36`, 0, -166);

    ctx.fillStyle = '#181614';
    ctx.font = '800 39px "Manrope", system-ui, sans-serif';
    const titleLines = wrapLines(ctx, opts.pack.title, 510).slice(0, 2);
    titleLines.forEach((l, i) => ctx.fillText(l, 0, -56 + i * 46));

    ctx.fillStyle = '#5c5449';
    ctx.font = '600 25px "Manrope", system-ui, sans-serif';
    const firstQ = selectedSwipes[0]?.text || opts.pack.subtitle;
    wrapLines(ctx, firstQ, 500)
      .slice(0, 3)
      .forEach((l, i) => ctx.fillText(l, 0, 68 + i * 36));

    ctx.restore();
    drawEditorialStamp(ctx, opts.sticker, tSec, W - 186, H - 148);
    return;
  }

  // СЦЕНА 2 (2.2–7.9 с): 3 КЛЮЧЕВЫХ СВАЙПА
  if (tSec < 7.9 && selectedSwipes.length > 0) {
    const local = tSec - 2.2;
    const slotLen = 5.7 / selectedSwipes.length;
    const idx = Math.min(selectedSwipes.length - 1, Math.floor(local / slotLen));
    const phase = (local - idx * slotLen) / slotLen;
    const sw = selectedSwipes[idx];

    const fly = phase > 0.68 ? (phase - 0.68) / 0.32 : 0;
    const dir = sw.side === 'right' ? 1 : -1;
    const shiftX = dir * Math.pow(fly, 2) * 440;
    const rot = dir * Math.pow(fly, 1.6) * 0.2;

    ctx.save();
    ctx.translate(W / 2 + shiftX, H * 0.53);
    ctx.rotate(rot);

    ctx.fillStyle = '#f4efe4';
    ctx.strokeStyle = '#dcd3c0';
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, -304, -290, 608, 580, 24);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = pal.cardHeader;
    drawRoundedRect(ctx, -304, -290, 608, 126, 24);
    ctx.fill();

    ctx.fillStyle = '#c89b4f';
    ctx.font = '700 18px "JetBrains Mono", ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`СМЕНА ${String(sw.week).padStart(2, '0')} / 36`, -264, -238);

    ctx.fillStyle = '#f4efe4';
    ctx.font = '800 26px "Manrope", system-ui, sans-serif';
    ctx.fillText(sw.speaker.slice(0, 32), -264, -196);

    ctx.fillStyle = '#181614';
    ctx.font = '700 30px "Manrope", system-ui, sans-serif';
    wrapLines(ctx, sw.text, 524)
      .slice(0, 4)
      .forEach((l, i) => ctx.fillText(l, -264, -104 + i * 41));

    ctx.fillStyle = sw.side === 'right' ? '#1e6b52' : '#9e2f25';
    drawRoundedRect(ctx, -268, 118, 536, 132, 16);
    ctx.fill();

    ctx.fillStyle = 'rgba(244, 239, 228, 0.78)';
    ctx.font = '700 17px "JetBrains Mono", ui-monospace, monospace';
    ctx.fillText(sw.side === 'right' ? 'РЕШЕНИЕ ВПРАВО →' : '← РЕШЕНИЕ ВЛЕВО', -236, 154);

    ctx.fillStyle = '#ffffff';
    ctx.font = '800 25px "Manrope", system-ui, sans-serif';
    wrapLines(ctx, sw.chosenLabel, 476)
      .slice(0, 2)
      .forEach((l, i) => ctx.fillText(l, -236, 192 + i * 32));

    ctx.restore();

    if (faceImg) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(118, H - 156, 66, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(faceImg, 52, H - 222, 132, 132);
      ctx.restore();
    }
    drawEditorialStamp(ctx, opts.sticker, tSec, W - 186, H - 148);
    return;
  }

  // СЦЕНА 3 (7.9–12.1 с): ИСТОРИЧЕСКИЙ ПРЕЦЕДЕНТ ИЛИ ИЗВЕСТНЫЙ ПРОСЧЁТ
  if (tSec < 12.1 && caseBundle) {
    const rc = caseBundle.realCase;
    const isBlunder = rc.kind === 'blunder';
    const accentCol = isBlunder ? '#c83e31' : '#1e6b52';

    ctx.save();
    ctx.fillStyle = '#f4efe4';
    ctx.strokeStyle = accentCol;
    ctx.lineWidth = 4;
    drawRoundedRect(ctx, 44, 232, W - 88, 780, 24);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = accentCol;
    drawRoundedRect(ctx, 80, 270, W - 160, 56, 10);
    ctx.fill();

    ctx.fillStyle = '#f4efe4';
    ctx.font = '700 20px "JetBrains Mono", ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(
      isBlunder ? 'ДОКУМЕНТИРОВАННЫЙ ПРОСЧЁТ' : 'ИСТОРИЧЕСКИЙ ПРЕЦЕДЕНТ',
      W / 2,
      305
    );

    ctx.fillStyle = '#181614';
    ctx.font = '800 30px "Manrope", system-ui, sans-serif';
    ctx.fillText(`${rc.person} · ${rc.year}`, W / 2, 384);

    if (caseBundle.playerMatched !== undefined) {
      ctx.fillStyle = '#5c5449';
      ctx.font = '700 21px "Manrope", system-ui, sans-serif';
      const matchNote = caseBundle.playerMatched
        ? isBlunder
          ? 'В этой смене вы повторили ровно этот шаг:'
          : 'В этой смене вы приняли такое же решение:'
        : isBlunder
          ? 'Вы обошли ловушку, а в реальности было так:'
          : 'Вы выбрали иной путь, а в истории было так:';
      ctx.fillText(matchNote, W / 2, 424);
    }

    ctx.fillStyle = '#181614';
    ctx.font = '800 30px "Manrope", system-ui, sans-serif';
    ctx.textAlign = 'left';
    const headLines = wrapLines(ctx, rc.headline, W - 168).slice(0, 2);
    headLines.forEach((l, i) => ctx.fillText(l, 84, 492 + i * 39));

    ctx.fillStyle = '#3d3730';
    ctx.font = '600 25px "Manrope", system-ui, sans-serif';
    const storyLines = wrapLines(ctx, rc.story, W - 168).slice(0, 7);
    storyLines.forEach((l, i) => ctx.fillText(l, 84, 588 + i * 37));

    ctx.fillStyle = '#7a7164';
    ctx.font = '600 19px "JetBrains Mono", ui-monospace, monospace';
    ctx.fillText(`Источник: ${rc.source.slice(0, 46)}`, 84, 968);
    ctx.restore();

    drawEditorialStamp(ctx, opts.sticker, tSec, W - 186, H - 134);
    return;
  }

  // СЦЕНА 4 (до 13.05 с): ФИНАЛЬНЫЙ ВЕРДИКТ СМЕНЫ
  ctx.save();
  ctx.fillStyle = '#f4efe4';
  ctx.strokeStyle = '#dcd3c0';
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, 56, 270, W - 112, 660, 24);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = opts.ending.isVictory ? '#1e6b52' : '#c83e31';
  drawRoundedRect(ctx, 96, 314, W - 192, 62, 12);
  ctx.fill();

  ctx.fillStyle = '#f4efe4';
  ctx.font = '700 23px "JetBrains Mono", ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(
    opts.ending.isVictory
      ? `АТТЕСТОВАН · ${opts.weeksSurvived} СМЕН`
      : `СРЫВ НА ${opts.weeksSurvived}-й СМЕНЕ`,
    W / 2,
    353
  );

  ctx.fillStyle = '#181614';
  ctx.font = '800 37px "Manrope", system-ui, sans-serif';
  wrapLines(ctx, opts.ending.title, W - 180)
    .slice(0, 2)
    .forEach((l, i) => ctx.fillText(l, W / 2, 448 + i * 45));

  ctx.fillStyle = '#5c5449';
  ctx.font = '600 25px "Manrope", system-ui, sans-serif';
  wrapLines(ctx, opts.ending.description, W - 180)
    .slice(0, 5)
    .forEach((l, i) => ctx.fillText(l, W / 2, 562 + i * 37));

  ctx.restore();
  drawEditorialStamp(ctx, opts.sticker, tSec, W / 2, H - 152);
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
