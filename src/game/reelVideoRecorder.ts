import type { EndingDef, JobPack, Stats } from '../types';

export type FacePlacement = 'circle_bottom' | 'card_head';

export interface OutgoingReelCardAnim {
  speaker: string;
  role: string;
  cardText: string;
  leftLabel: string;
  rightLabel: string;
  side: 'left' | 'right';
  fromX: number;
  startedAtMs: number;
  durationMs: number;
}

export interface LiveReelFrameState {
  pack: JobPack;
  week: number;
  blockRoman: string;
  stats: Stats;
  speaker: string;
  role: string;
  cardText: string;
  leftLabel: string;
  rightLabel: string;
  dragX: number;
  flyDir: 'left' | 'right' | null;
  outgoingCard?: OutgoingReelCardAnim | null;
  masteryPct: number;
  reactionStatus: { text: string; tone: 'good' | 'warn' | 'idle' };
  placement: FacePlacement;
  magnetized?: boolean;
  freeXNorm?: number;
  freeYNorm?: number;
  faceScale?: number;
  ending: EndingDef | null;
  faceSource: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | null;
  trackedCutoutCanvas?: HTMLCanvasElement | null;
  isMirroredVideo: boolean;
}

export interface RecordedReelResult {
  blob: Blob;
  file: File;
  url: string;
  mimeType: 'video/mp4' | 'video/webm';
  extension: 'mp4' | 'webm';
  durationSec: number;
}

export type ShareReelOutcome = 'shared' | 'aborted' | 'unsupported';

function stripEmojis(input: string): string {
  return input
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function createOptimalMediaRecorder(
  stream: MediaStream,
  hasAudio: boolean
): { recorder: MediaRecorder; fallbackExt: 'mp4' | 'webm' } {
  const candidates = hasAudio
    ? [
        'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
        'video/mp4;codecs=avc1.4D401F,mp4a.40.2',
        'video/mp4;codecs=avc1,mp4a.40.2',
        'video/mp4',
        'video/mp4;codecs=avc1.42E01E,opus',
        'video/mp4;codecs=avc1,opus',
        'video/webm;codecs=h264,opus',
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
      ]
    : [
        'video/mp4;codecs=avc1.42E01E',
        'video/mp4;codecs=avc1.4D401F',
        'video/mp4;codecs=avc1',
        'video/mp4',
        'video/webm;codecs=h264',
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
      ];

  for (const mime of candidates) {
    if (typeof MediaRecorder.isTypeSupported === 'function' && !MediaRecorder.isTypeSupported(mime)) {
      continue;
    }
    try {
      const recorder = new MediaRecorder(stream, {
        mimeType: mime,
        videoBitsPerSecond: 3_500_000,
      });
      return {
        recorder,
        fallbackExt: mime.includes('mp4') ? 'mp4' : 'webm',
      };
    } catch {
      // Переходим к следующему кандидату
    }
  }

  const recorder = new MediaRecorder(stream);
  const actual = (recorder.mimeType || '').toLowerCase();
  return {
    recorder,
    fallbackExt: actual.includes('webm') ? 'webm' : 'mp4',
  };
}

/**
 * Перепаковывает фрагментированный fMP4 (который выдаёт WebKit MediaRecorder на iPhone)
 * или WebM в плоский стандартный MP4 с fastStart (ftyp -> moov -> mdat, H.264 + AAC).
 * Без этого Apple PHPhotoLibrary скрывает пункт «Сохранить видео» (в Галерею / Фото)!
 */
async function remuxToFastStartMp4(rawBlob: Blob): Promise<Blob | null> {
  if (!rawBlob || rawBlob.size < 256) return null;
  let mb: typeof import('mediabunny');
  try {
    mb = await import('mediabunny');
  } catch {
    return null;
  }
  const { BlobSource, BufferTarget, Conversion, Input, MATROSKA, MP4, Mp4OutputFormat, Output, QTFF, WEBM } = mb;
  const input = new Input({
    source: new BlobSource(rawBlob),
    formats: [MP4, QTFF, WEBM, MATROSKA],
  });
  try {
    const target = new BufferTarget();
    const output = new Output({
      format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
      target,
    });
    const conv = await Conversion.init({
      input,
      output,
      video: { codec: 'avc' },
      audio: { codec: 'aac' },
      showWarnings: false,
    });
    if (conv.isValid && conv.utilizedTracks.length > 0) {
      await conv.execute();
      if (target.buffer && target.buffer.byteLength >= 256) {
        return new Blob([target.buffer], { type: 'video/mp4' });
      }
    }

    // Резервный проход без принудительного перекодирования дорожек
    const targetFallback = new BufferTarget();
    const outputFallback = new Output({
      format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
      target: targetFallback,
    });
    const convFallback = await Conversion.init({
      input,
      output: outputFallback,
      showWarnings: false,
    });
    if (!convFallback.isValid || convFallback.utilizedTracks.length === 0) {
      return null;
    }
    await convFallback.execute();
    if (!targetFallback.buffer || targetFallback.buffer.byteLength < 256) {
      return null;
    }
    return new Blob([targetFallback.buffer], { type: 'video/mp4' });
  } catch {
    return null;
  } finally {
    input.dispose();
  }
}

/**
 * Открывает системное меню iOS / Android ТОЛЬКО с видеофайлом (без text/url/title),
 * чтобы iOS гарантированно показала «Сохранить видео» прямо в Галерею (Фото).
 * Вызывается первой строкой обработчика клика для сохранения Transient User Activation.
 */
export async function shareRecordedReelToGallery(
  reel: RecordedReelResult
): Promise<ShareReelOutcome> {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    return 'unsupported';
  }
  const sharePayload: ShareData = { files: [reel.file] };
  if (typeof navigator.canShare === 'function') {
    try {
      if (!navigator.canShare(sharePayload)) {
        return 'unsupported';
      }
    } catch {
      return 'unsupported';
    }
  }

  try {
    await navigator.share(sharePayload);
    return 'shared';
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return 'aborted';
    }
    const msg = err instanceof Error ? err.message.toLowerCase() : '';
    if (msg.includes('abort') || msg.includes('cancel')) {
      return 'aborted';
    }
    return 'unsupported';
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines = 6
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && cur) {
      lines.push(cur);
      cur = w;
      if (lines.length >= maxLines - 1) break;
    } else {
      cur = test;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  return lines;
}

function drawClippedFace(
  ctx: CanvasRenderingContext2D,
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  mirror: boolean
) {
  const sw =
    source instanceof HTMLVideoElement
      ? source.videoWidth || 320
      : source instanceof HTMLCanvasElement
        ? source.width
        : source.naturalWidth || 320;
  const sh =
    source instanceof HTMLVideoElement
      ? source.videoHeight || 320
      : source instanceof HTMLCanvasElement
        ? source.height
        : source.naturalHeight || 320;
  if (sw <= 0 || sh <= 0) return;

  const boxW = rx * 2;
  const boxH = ry * 2;
  const scale = Math.max(boxW / sw, boxH / sh);
  const dw = sw * scale;
  const dh = sh * scale;

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.clip();

  if (mirror) {
    ctx.translate(cx, cy);
    ctx.scale(-1, 1);
    ctx.drawImage(source, -dw / 2, -dh / 2, dw, dh);
  } else {
    ctx.drawImage(source, cx - dw / 2, cy - dh / 2, dw, dh);
  }
  ctx.restore();
}

export function captureFaceSnapshotDataUrl(
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | null,
  mirror: boolean
): string | null {
  if (!source) return null;
  try {
    const cv = document.createElement('canvas');
    cv.width = 320;
    cv.height = 360;
    const c = cv.getContext('2d');
    if (!c) return null;
    if (source instanceof HTMLCanvasElement) {
      c.drawImage(source, 0, 0, 320, 360);
    } else {
      drawClippedFace(c, source, 160, 180, 145, 165, mirror);
    }
    return cv.toDataURL('image/png');
  } catch {
    return null;
  }
}

/**
 * Отрисовывает кадр живого игрового экрана (1:1 как мобильный интерфейс игры!)
 * в заданном масштабе — используется и для видео 720×1280, и для мгновенного скрина экрана 1080×1920!
 */
export function drawGameScreenToCanvas(
  c: CanvasRenderingContext2D,
  W: number,
  H: number,
  s: LiveReelFrameState
) {
  const k = W / 720; // 1.0 для 720×1280 видео, 1.5 для 1080×1920 Retina-скрина!
  c.save();
  c.scale(k, k);

  const VW = 720;
  const VH = 1280;

  // 1. Фон как в живом мобильном экране
  const bg = c.createRadialGradient(VW / 2, VH * 0.3, 40, VW / 2, VH * 0.5, VH * 0.85);
  bg.addColorStop(0, '#1A2B24');
  bg.addColorStop(1, '#0D1512');
  c.fillStyle = bg;
  c.fillRect(0, 0, VW, VH);

  // 2. Компактная верхняя шапка + 4 лаконичные капсулы показателей (освобождаем ~76% кадра под карточку!)
  c.fillStyle = 'rgba(14, 21, 18, 0.92)';
  c.fillRect(0, 0, VW, 80);

  roundRect(c, 26, 16, 368, 48, 24);
  c.fillStyle = 'rgba(255,255,255,0.055)';
  c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.12)';
  c.lineWidth = 1.5;
  c.stroke();

  c.fillStyle = '#F2EEE6';
  c.font = '700 21px Manrope, -apple-system, BlinkMacSystemFont, sans-serif';
  c.fillText(stripEmojis(s.pack.shortTitle).slice(0, 18), 46, 47);
  c.fillStyle = '#C89B4F';
  c.font = '700 16px ui-monospace, SFMono-Regular, monospace';
  c.textAlign = 'right';
  c.fillText(`${String(s.week).padStart(2, '0')}/36`, 374, 46);
  c.textAlign = 'left';

  roundRect(c, VW - 196, 16, 170, 48, 24);
  c.fillStyle = 'rgba(30, 107, 82, 0.28)';
  c.fill();
  c.strokeStyle = 'rgba(108, 196, 161, 0.45)';
  c.stroke();
  c.fillStyle = '#7AD3B0';
  c.font = '700 18px ui-monospace, monospace';
  c.textAlign = 'center';
  c.fillText(`Опыт ${s.masteryPct}%`, VW - 111, 46);
  c.textAlign = 'left';

  // 3. Четыре компактных горизонтальных индикатора баланса
  const colW = 158;
  s.pack.pillars.forEach((pil, idx) => {
    const bx = 26 + idx * (colW + 12);
    const by = 88;
    const bh = 68;
    const val = s.stats[pil.key];
    const danger = val <= 20 || val >= 84;

    roundRect(c, bx, by, colW, bh, 16);
    c.fillStyle = 'rgba(255,255,255,0.04)';
    c.fill();
    c.strokeStyle = danger ? 'rgba(240, 140, 130, 0.65)' : 'rgba(255,255,255,0.09)';
    c.lineWidth = 1.5;
    c.stroke();

    const vx = bx + 12;
    const vy = by + 13;
    roundRect(c, vx, vy, 42, 42, 10);
    c.fillStyle = '#0A100E';
    c.fill();
    c.save();
    c.clip();
    const fh = (42 * val) / 100;
    c.fillStyle = danger ? '#C83E31' : '#1E6B52';
    c.fillRect(vx, vy + 42 - fh, 42, fh);
    c.restore();
    roundRect(c, vx, vy, 42, 42, 10);
    c.strokeStyle = danger ? '#F08C82' : 'rgba(200, 155, 79, 0.5)';
    c.lineWidth = 1.6;
    c.stroke();

    c.fillStyle = danger ? '#F08C82' : '#F2EEE6';
    c.font = '700 20px ui-monospace, monospace';
    c.fillText(`${val}%`, bx + 64, by + 33);

    c.fillStyle = '#9EA8A3';
    c.font = '600 14px Manrope, -apple-system, sans-serif';
    c.fillText(stripEmojis(pil.label).slice(0, 9), bx + 64, by + 53);
  });

  const isPinnedToCard = s.magnetized !== false;
  const fScale = s.faceScale ?? 1;
  const cw = 668;
  const ch = isPinnedToCard ? 964 : 900;
  const cardCenterY = isPinnedToCard ? 668 : 636;
  const artH = Math.round(ch * 0.51);

  const drawSingleCardLayer = (opts: {
    speaker: string;
    role: string;
    cardText: string;
    leftLabel: string;
    rightLabel: string;
    offsetX: number;
    offsetY: number;
    rotRad: number;
    scaleVal: number;
    alpha: number;
    curtainSide: 'left' | 'right' | null;
    drawLiveFace: boolean;
  }) => {
    if (opts.alpha <= 0.01) return;
    c.save();
    c.globalAlpha = Math.max(0, Math.min(1, opts.alpha));
    c.translate(VW / 2 + opts.offsetX, cardCenterY + opts.offsetY);
    c.rotate(opts.rotRad);
    c.scale(opts.scaleVal, opts.scaleVal);

    c.shadowColor = 'rgba(0, 0, 0, 0.68)';
    c.shadowBlur = 44;
    c.shadowOffsetY = 22;
    roundRect(c, -cw / 2, -ch / 2, cw, ch, 34);
    c.fillStyle = '#FAF6EE';
    c.fill();
    c.shadowColor = 'transparent';

    roundRect(c, -cw / 2, -ch / 2, cw, ch, 34);
    c.save();
    c.clip();

    c.fillStyle = '#16241E';
    c.fillRect(-cw / 2, -ch / 2, cw, artH);

    const glowGrad = c.createRadialGradient(0, -ch / 2 + artH * 0.52, 24, 0, -ch / 2 + artH * 0.52, 220);
    glowGrad.addColorStop(0, 'rgba(200, 155, 79, 0.24)');
    glowGrad.addColorStop(1, 'rgba(22, 36, 30, 0)');
    c.fillStyle = glowGrad;
    c.fillRect(-cw / 2, -ch / 2, cw, artH);

    c.fillStyle = '#223B31';
    c.beginPath();
    c.arc(0, -ch / 2 + artH - 118, 144, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = 'rgba(200, 155, 79, 0.52)';
    c.lineWidth = 2;
    c.stroke();

    // Костюм и плечи персонажа
    c.fillStyle = '#121815';
    c.beginPath();
    c.moveTo(-176, -ch / 2 + artH + 4);
    c.quadraticCurveTo(-142, -ch / 2 + artH - 122, 0, -ch / 2 + artH - 122);
    c.quadraticCurveTo(142, -ch / 2 + artH - 122, 176, -ch / 2 + artH + 4);
    c.closePath();
    c.fill();
    c.strokeStyle = '#C89B4F';
    c.lineWidth = 2.5;
    c.stroke();

    c.strokeStyle = '#F4EFE4';
    c.lineWidth = 3.5;
    c.beginPath();
    c.moveTo(-42, -ch / 2 + artH - 118);
    c.lineTo(0, -ch / 2 + artH - 42);
    c.lineTo(42, -ch / 2 + artH - 118);
    c.stroke();

    roundRect(c, -22, -ch / 2 + artH - 150, 44, 40, 10);
    c.fillStyle = '#EFE8D8';
    c.fill();

    if (opts.drawLiveFace && isPinnedToCard && (s.trackedCutoutCanvas || s.faceSource)) {
      const headWobble = opts.rotRad * 1.4;
      c.save();
      c.translate(0, -ch / 2 + artH * 0.43);
      c.rotate(headWobble);
      c.scale(fScale, fScale);
      if (s.trackedCutoutCanvas) {
        c.drawImage(s.trackedCutoutCanvas, -124, -144, 248, 288);
      } else if (s.faceSource) {
        drawClippedFace(c, s.faceSource, 0, 0, 88, 104, s.isMirroredVideo);
      }
      c.restore();
    } else {
      roundRect(c, -60, -ch / 2 + artH * 0.25, 120, 134, 54);
      c.fillStyle = '#F2E9D8';
      c.fill();
    }

    if (opts.curtainSide === 'left') {
      roundRect(c, -cw / 2 + 20, -ch / 2 + artH - 102, cw - 40, 84, 18);
      c.fillStyle = 'rgba(20, 18, 16, 0.92)';
      c.fill();
      c.strokeStyle = 'rgba(234, 185, 101, 0.75)';
      c.lineWidth = 2;
      c.stroke();
      c.fillStyle = '#F5CC7E';
      c.font = '700 23px Manrope, -apple-system, sans-serif';
      const lLines = wrapLines(c, `← ${stripEmojis(opts.leftLabel)}`, cw - 80, 2);
      lLines.forEach((ll, i) => c.fillText(ll, -cw / 2 + 40, -ch / 2 + artH - 60 + i * 28));
    } else if (opts.curtainSide === 'right') {
      roundRect(c, -cw / 2 + 20, -ch / 2 + artH - 102, cw - 40, 84, 18);
      c.fillStyle = 'rgba(20, 18, 16, 0.92)';
      c.fill();
      c.strokeStyle = 'rgba(117, 219, 178, 0.75)';
      c.lineWidth = 2;
      c.stroke();
      c.fillStyle = '#7CE0B6';
      c.font = '700 23px Manrope, -apple-system, sans-serif';
      const rLines = wrapLines(c, `${stripEmojis(opts.rightLabel)} →`, cw - 80, 2);
      rLines.forEach((rl, i) => c.fillText(rl, -cw / 2 + 40, -ch / 2 + artH - 60 + i * 28));
    }

    c.fillStyle = '#181614';
    c.font = '800 30px Manrope, -apple-system, sans-serif';
    c.fillText(stripEmojis(opts.speaker).slice(0, 30), -cw / 2 + 40, -ch / 2 + artH + 58);

    c.fillStyle = '#756C5E';
    c.font = '600 16px JetBrains Mono, ui-monospace, monospace';
    c.fillText(stripEmojis(opts.role).toUpperCase().slice(0, 42), -cw / 2 + 40, -ch / 2 + artH + 88);

    c.fillStyle = '#181614';
    c.font = '600 30px Manrope, -apple-system, sans-serif';
    const bodyLines = wrapLines(c, stripEmojis(opts.cardText), cw - 80, 6);
    bodyLines.forEach((ln, idx) => {
      c.fillText(ln, -cw / 2 + 40, -ch / 2 + artH + 154 + idx * 45);
    });

    c.restore();
    roundRect(c, -cw / 2, -ch / 2, cw, ch, 34);
    c.strokeStyle = 'rgba(24, 22, 20, 0.88)';
    c.lineWidth = 3;
    c.stroke();
    c.restore();
  };

  // 4. Анимация полного улёта предыдущей карточки за экран + плавный подъём новой снизу!
  const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const outAnim =
    s.outgoingCard && nowMs - s.outgoingCard.startedAtMs < s.outgoingCard.durationMs
      ? s.outgoingCard
      : null;

  const incomingProgress = outAnim
    ? Math.min(1, Math.max(0, (nowMs - outAnim.startedAtMs) / (outAnim.durationMs * 0.88)))
    : 1;
  const incomingEase = 1 - Math.pow(1 - incomingProgress, 3);

  const liveShiftX = s.dragX * 1.35;
  const liveAngle = (s.dragX * 0.046 * Math.PI) / 180;
  const liveCurtain: 'left' | 'right' | null =
    s.dragX < -16 ? 'left' : s.dragX > 16 ? 'right' : null;

  drawSingleCardLayer({
    speaker: s.speaker,
    role: s.role,
    cardText: s.cardText,
    leftLabel: s.leftLabel,
    rightLabel: s.rightLabel,
    offsetX: liveShiftX,
    offsetY: (1 - incomingEase) * 24,
    rotRad: liveAngle,
    scaleVal: 0.945 + 0.055 * incomingEase,
    alpha: 0.72 + 0.28 * incomingEase,
    curtainSide: liveCurtain,
    drawLiveFace: true,
  });

  if (outAnim) {
    const p = Math.min(1, Math.max(0, (nowMs - outAnim.startedAtMs) / outAnim.durationMs));
    // Плавный баллистический разгон до полного вылета за границу 720px кадра (840px)
    const dirSign = outAnim.side === 'left' ? -1 : 1;
    const startX = outAnim.fromX * 1.35;
    const easeBallistic = p < 0.2 ? p * 0.9 : 0.18 + Math.pow((p - 0.2) / 0.8, 1.35) * 0.82;
    const flyX = startX + (dirSign * 860 - startX) * easeBallistic;
    const flyY = Math.pow(p, 1.6) * 110;
    const flyRot = ((dirSign * 25 * easeBallistic) * Math.PI) / 180;
    const flyAlpha = p < 0.72 ? 1 : 1 - (p - 0.72) / 0.28;

    drawSingleCardLayer({
      speaker: outAnim.speaker,
      role: outAnim.role,
      cardText: outAnim.cardText,
      leftLabel: outAnim.leftLabel,
      rightLabel: outAnim.rightLabel,
      offsetX: flyX,
      offsetY: flyY,
      rotRad: flyRot,
      scaleVal: 1 - p * 0.06,
      alpha: flyAlpha,
      curtainSide: outAnim.side,
      drawLiveFace: false,
    });
  }

  // 5. Если лицо «отмагничено» пользователем со своего места и перенесено/увеличено вниз — рисуем его там!
  if (!isPinnedToCard && (s.trackedCutoutCanvas || s.faceSource)) {
    const fx = (s.freeXNorm ?? 0.5) * VW;
    const fy = 230 + (s.freeYNorm ?? 0.84) * 900;
    const fw = 224 * fScale;
    const fh = 260 * fScale;

    c.save();
    c.shadowColor = 'rgba(0, 0, 0, 0.65)';
    c.shadowBlur = 26;
    c.shadowOffsetY = 10;
    if (s.trackedCutoutCanvas) {
      c.drawImage(s.trackedCutoutCanvas, fx - fw / 2, fy - fh / 2, fw, fh);
    } else if (s.faceSource) {
      drawClippedFace(c, s.faceSource, fx, fy, fw * 0.38, fh * 0.4, s.isMirroredVideo);
    }
    c.restore();
  }

  // Тонкая подпись в самом низу
  c.fillStyle = '#7E8D86';
  c.font = '600 17px ui-monospace, monospace';
  c.textAlign = 'center';
  c.fillText('КРЕСЛО · Тренажёр решений', VW / 2, 1236);
  c.textAlign = 'left';

  // 7. Финал во время записи видео
  if (s.ending) {
    c.fillStyle = 'rgba(10, 16, 14, 0.9)';
    roundRect(c, 36, 260, VW - 72, 520, 24);
    c.fill();
    c.strokeStyle = s.ending.isVictory ? '#6CC4A1' : '#C83E31';
    c.lineWidth = 4;
    c.stroke();

    c.fillStyle = s.ending.isVictory ? '#6CC4A1' : '#F08C82';
    c.font = '700 22px ui-monospace, monospace';
    c.fillText(s.ending.isVictory ? 'АТТЕСТОВАН' : 'СРЫВ СМЕНЫ', 72, 326);

    c.fillStyle = '#F4EFE4';
    c.font = '700 42px Georgia, serif';
    wrapLines(c, stripEmojis(s.ending.title), VW - 144, 3).forEach((tl, i) =>
      c.fillText(tl, 72, 394 + i * 52)
    );

    c.fillStyle = '#C89B4F';
    c.font = '600 28px -apple-system, BlinkMacSystemFont, sans-serif';
    c.fillText(`Опыт: ${s.masteryPct}%  ·  Смена ${s.week}/36`, 72, 608);
  }

  c.restore();
}

/**
 * Делает мгновенный чёткий Retina-скриншот (1080×1920 PNG) текущего живого экрана игры!
 */
export async function captureLiveGameScreenBlob(state: LiveReelFrameState): Promise<Blob | null> {
  const cv = document.createElement('canvas');
  cv.width = 1080;
  cv.height = 1920;
  const ctx = cv.getContext('2d');
  if (!ctx) return null;
  drawGameScreenToCanvas(ctx, 1080, 1920, state);
  return new Promise((resolve) => cv.toBlob((b) => resolve(b), 'image/png'));
}

/**
 * Запись вертикального 9:16 видео (720×1280 @ 30 FPS) с полной поддержкой Галереи iOS («Сохранить видео»):
 * 1) H.264 + AAC при захвате;
 * 2) Мгновенный локальный ремуксинг fMP4 -> плоский стандартный MP4 с fastStart (ftyp -> moov -> mdat) в ОЗУ;
 * 3) Предсозданный File с чистым MIME 'video/mp4' для мгновенного вызова navigator.share без потери User Activation.
 */
export class ReelVideoRecorder {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private recorder: MediaRecorder | null = null;
  private fallbackExt: 'mp4' | 'webm' = 'mp4';
  private chunks: BlobPart[] = [];
  private rafId: number | null = null;
  private lastDrawMs = 0;
  private startedAt = 0;
  private getState: () => LiveReelFrameState;

  constructor(getState: () => LiveReelFrameState) {
    this.getState = getState;
    this.canvas = document.createElement('canvas');
    this.canvas.width = 720;
    this.canvas.height = 1280;
    this.ctx = this.canvas.getContext('2d')!;
  }

  start(optionalAudioStream?: MediaStream | null): boolean {
    if (typeof MediaRecorder === 'undefined') return false;
    // Фоново прогреваем чанк MP4-ремуксера сразу при старте записи
    void import('mediabunny').catch(() => {});

    this.chunks = [];
    this.startedAt = performance.now();
    this.lastDrawMs = 0;
    this.renderFrame();

    const canvasStream = this.canvas.captureStream(30);
    let hasAudio = false;
    if (optionalAudioStream) {
      optionalAudioStream.getAudioTracks().forEach((track) => {
        if (track.readyState === 'live') {
          canvasStream.addTrack(track);
          hasAudio = true;
        }
      });
    }

    try {
      const picked = createOptimalMediaRecorder(canvasStream, hasAudio);
      this.recorder = picked.recorder;
      this.fallbackExt = picked.fallbackExt;
    } catch {
      return false;
    }

    this.recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) {
        this.chunks.push(ev.data);
      }
    };

    // Запускаем без фрагментирующего timeslice, чтобы получить единый поток пакетов
    this.recorder.start();

    const loop = (now: number) => {
      if (!this.recorder || this.recorder.state !== 'recording') return;
      if (now - this.lastDrawMs >= 32) {
        this.lastDrawMs = now;
        this.renderFrame();
      }
      this.rafId = window.requestAnimationFrame(loop);
    };
    this.rafId = window.requestAnimationFrame(loop);
    return true;
  }

  stop(): Promise<RecordedReelResult | null> {
    return new Promise((resolve) => {
      if (this.rafId !== null) {
        window.cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
      if (!this.recorder || this.recorder.state === 'inactive') {
        resolve(null);
        return;
      }

      const rec = this.recorder;
      const fallbackExt = this.fallbackExt;
      const durationSec = Math.max(1, Math.round((performance.now() - this.startedAt) / 1000));

      rec.onstop = async () => {
        const rawMime = (rec.mimeType || '').toLowerCase();
        const rawIsMp4 = rawMime.includes('mp4') || fallbackExt === 'mp4';
        const rawCleanMime: 'video/mp4' | 'video/webm' = rawIsMp4 ? 'video/mp4' : 'video/webm';
        const rawBlob = new Blob(this.chunks, { type: rawCleanMime });

        // Пересобираем fMP4 / WebM в плоский fastStart MP4, который iPhone Фото (PHPhotoLibrary)
        // на 100% распознаёт как родное видео и предлагает кнопку «Сохранить видео» в Галерею!
        const remuxedMp4 = await remuxToFastStartMp4(rawBlob);
        const finalBlob = remuxedMp4 ?? rawBlob;
        const cleanMime: 'video/mp4' | 'video/webm' = remuxedMp4 ? 'video/mp4' : rawCleanMime;
        const cleanExt: 'mp4' | 'webm' = remuxedMp4 ? 'mp4' : rawIsMp4 ? 'mp4' : 'webm';

        const stamp = Date.now().toString().slice(-5);
        const fileName = `kreslo-shift-${stamp}.${cleanExt}`;
        const file = new File([finalBlob], fileName, {
          type: cleanMime,
          lastModified: Date.now(),
        });

        const url = URL.createObjectURL(finalBlob);
        this.recorder = null;
        resolve({
          blob: finalBlob,
          file,
          url,
          mimeType: cleanMime,
          extension: cleanExt,
          durationSec,
        });
      };

      try {
        rec.stop();
      } catch {
        resolve(null);
      }
    });
  }

  private renderFrame() {
    drawGameScreenToCanvas(this.ctx, 720, 1280, this.getState());
  }
}
