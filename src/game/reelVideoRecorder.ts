import type { EndingDef, JobPack, Stats } from '../types';

export type FacePlacement = 'circle_bottom' | 'card_head';

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
  masteryPct: number;
  reactionStatus: { text: string; tone: 'idle' | 'good' | 'warn' };
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
  url: string;
  mimeType: 'video/mp4' | 'video/webm';
  extension: 'mp4' | 'webm';
  durationSec: number;
}

function stripEmojis(input: string): string {
  return input
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function pickRecorderMime(): {
  recorderMime: string;
  cleanMime: 'video/mp4' | 'video/webm';
  extension: 'mp4' | 'webm';
} {
  if (typeof MediaRecorder === 'undefined') {
    return { recorderMime: 'video/mp4', cleanMime: 'video/mp4', extension: 'mp4' };
  }
  const mp4Candidates = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1',
    'video/mp4',
  ];
  for (const m of mp4Candidates) {
    if (MediaRecorder.isTypeSupported(m)) {
      return { recorderMime: m, cleanMime: 'video/mp4', extension: 'mp4' };
    }
  }
  const webmCandidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  for (const m of webmCandidates) {
    if (MediaRecorder.isTypeSupported(m)) {
      return { recorderMime: m, cleanMime: 'video/webm', extension: 'webm' };
    }
  }
  return { recorderMime: '', cleanMime: 'video/mp4', extension: 'mp4' };
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

  // 2. Верхняя шапка экрана
  c.fillStyle = 'rgba(14, 21, 18, 0.95)';
  c.fillRect(0, 0, VW, 92);
  c.strokeStyle = 'rgba(200, 155, 79, 0.25)';
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(0, 92);
  c.lineTo(VW, 92);
  c.stroke();

  roundRect(c, 28, 18, 360, 56, 12);
  c.fillStyle = 'rgba(255,255,255,0.04)';
  c.fill();
  c.strokeStyle = 'rgba(200, 155, 79, 0.35)';
  c.stroke();

  c.fillStyle = '#F2EEE6';
  c.font = '700 23px -apple-system, BlinkMacSystemFont, sans-serif';
  c.fillText(stripEmojis(s.pack.shortTitle), 48, 46);
  c.fillStyle = '#C89B4F';
  c.font = '600 16px ui-monospace, SFMono-Regular, monospace';
  c.fillText(`Блок ${s.blockRoman} · Смена ${String(s.week).padStart(2, '0')}/36`, 48, 66);

  // Плашка Опыта справа в шапке
  roundRect(c, VW - 208, 22, 180, 48, 12);
  c.fillStyle = 'rgba(30, 107, 82, 0.28)';
  c.fill();
  c.strokeStyle = 'rgba(108, 196, 161, 0.5)';
  c.stroke();
  c.fillStyle = '#7AD3B0';
  c.font = '700 20px ui-monospace, monospace';
  c.textAlign = 'center';
  c.fillText(`Опыт ${s.masteryPct}%`, VW - 118, 53);
  c.textAlign = 'left';

  // 3. Четыре шкалы показателей (как на экране iPhone)
  const colW = 154;
  s.pack.pillars.forEach((pil, idx) => {
    const bx = 28 + idx * (colW + 16);
    const by = 112;
    const val = s.stats[pil.key];
    const danger = val <= 20 || val >= 84;

    roundRect(c, bx, by, colW, 110, 14);
    c.fillStyle = 'rgba(255,255,255,0.03)';
    c.fill();
    c.strokeStyle = danger ? 'rgba(240, 140, 130, 0.6)' : 'rgba(255,255,255,0.09)';
    c.lineWidth = 1.5;
    c.stroke();

    c.fillStyle = danger ? '#F08C82' : '#E5E0D5';
    c.font = '700 20px ui-monospace, monospace';
    c.textAlign = 'center';
    c.fillText(`${val}%`, bx + colW / 2, by + 27);

    // Колба показателя по центру колонки
    const vx = bx + (colW - 52) / 2;
    const vy = by + 35;
    roundRect(c, vx, vy, 52, 46, 10);
    c.fillStyle = '#0A100E';
    c.fill();
    c.save();
    c.clip();
    const fh = (46 * val) / 100;
    c.fillStyle = danger ? '#C83E31' : '#1E6B52';
    c.fillRect(vx, vy + 46 - fh, 52, fh);
    c.restore();
    roundRect(c, vx, vy, 52, 46, 10);
    c.strokeStyle = danger ? '#F08C82' : 'rgba(200, 155, 79, 0.55)';
    c.lineWidth = 2;
    c.stroke();

    c.fillStyle = '#B4BCB8';
    c.font = '600 16px -apple-system, BlinkMacSystemFont, sans-serif';
    c.fillText(stripEmojis(pil.label), bx + colW / 2, by + 101);
    c.textAlign = 'left';
  });

  const isPinnedToCard = s.magnetized !== false;
  const fScale = s.faceScale ?? 1;

  // 4. Центральная карточка с живым наклоном
  c.save();
  const shiftX = s.flyDir === 'left' ? -260 : s.flyDir === 'right' ? 260 : s.dragX * 0.95;
  const angle =
    ((s.flyDir === 'left' ? -15 : s.flyDir === 'right' ? 15 : s.dragX * 0.045) * Math.PI) / 180;
  const cardCenterY = isPinnedToCard ? 660 : 615;
  const cw = 636;
  const ch = isPinnedToCard ? 790 : 720;

  c.translate(VW / 2 + shiftX, cardCenterY);
  c.rotate(angle);

  c.shadowColor = 'rgba(0, 0, 0, 0.65)';
  c.shadowBlur = 40;
  c.shadowOffsetY = 20;
  roundRect(c, -cw / 2, -ch / 2, cw, ch, 28);
  c.fillStyle = '#FAF6EE';
  c.fill();
  c.shadowColor = 'transparent';

  roundRect(c, -cw / 2, -ch / 2, cw, ch, 28);
  c.save();
  c.clip();

  const artH = 324;
  c.fillStyle = '#16241E';
  c.fillRect(-cw / 2, -ch / 2, cw, artH);

  c.fillStyle = '#223B31';
  c.beginPath();
  c.arc(0, -ch / 2 + artH - 96, 120, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = 'rgba(200, 155, 79, 0.55)';
  c.lineWidth = 2;
  c.stroke();

  // Костюм и плечи персонажа
  c.fillStyle = '#121815';
  c.beginPath();
  c.moveTo(-142, -ch / 2 + artH + 4);
  c.quadraticCurveTo(-116, -ch / 2 + artH - 96, 0, -ch / 2 + artH - 96);
  c.quadraticCurveTo(116, -ch / 2 + artH - 96, 142, -ch / 2 + artH + 4);
  c.closePath();
  c.fill();
  c.strokeStyle = '#C89B4F';
  c.lineWidth = 2.5;
  c.stroke();

  c.strokeStyle = '#F4EFE4';
  c.lineWidth = 3.5;
  c.beginPath();
  c.moveTo(-36, -ch / 2 + artH - 94);
  c.lineTo(0, -ch / 2 + artH - 32);
  c.lineTo(36, -ch / 2 + artH - 94);
  c.stroke();

  roundRect(c, -20, -ch / 2 + artH - 122, 40, 36, 8);
  c.fillStyle = '#EFE8D8';
  c.fill();

  if (isPinnedToCard && (s.trackedCutoutCanvas || s.faceSource)) {
    const headWobble = (s.dragX * 0.08 * Math.PI) / 180;
    c.save();
    c.translate(0, -ch / 2 + 138);
    c.rotate(headWobble);
    c.scale(fScale, fScale);
    if (s.trackedCutoutCanvas) {
      c.drawImage(s.trackedCutoutCanvas, -110, -128, 220, 256);
    } else if (s.faceSource) {
      drawClippedFace(c, s.faceSource, 0, 0, 78, 92, s.isMirroredVideo);
    }
    c.restore();
  } else {
    roundRect(c, -54, -ch / 2 + 80, 108, 118, 46);
    c.fillStyle = '#F2E9D8';
    c.fill();
  }

  // Плавная шторка выбора поверх картинки при свайпе (как в Reigns)
  if (s.dragX < -14 || s.flyDir === 'left') {
    roundRect(c, -cw / 2 + 18, -ch / 2 + artH - 92, cw - 36, 78, 16);
    c.fillStyle = 'rgba(24, 22, 20, 0.92)';
    c.fill();
    c.fillStyle = '#F5CC7E';
    c.font = '700 22px -apple-system, BlinkMacSystemFont, sans-serif';
    const lLines = wrapLines(c, `← ${stripEmojis(s.leftLabel)}`, cw - 72, 2);
    lLines.forEach((ll, i) => c.fillText(ll, -cw / 2 + 38, -ch / 2 + artH - 54 + i * 26));
  } else if (s.dragX > 14 || s.flyDir === 'right') {
    roundRect(c, -cw / 2 + 18, -ch / 2 + artH - 92, cw - 36, 78, 16);
    c.fillStyle = 'rgba(24, 22, 20, 0.92)';
    c.fill();
    c.fillStyle = '#7CE0B6';
    c.font = '700 22px -apple-system, BlinkMacSystemFont, sans-serif';
    const rLines = wrapLines(c, `${stripEmojis(s.rightLabel)} →`, cw - 72, 2);
    rLines.forEach((rl, i) => c.fillText(rl, -cw / 2 + 38, -ch / 2 + artH - 54 + i * 26));
  }

  c.fillStyle = '#181614';
  c.font = '800 28px Manrope, -apple-system, sans-serif';
  c.fillText(stripEmojis(s.speaker).slice(0, 32), -cw / 2 + 36, -ch / 2 + artH + 54);

  c.fillStyle = '#756C5E';
  c.font = '600 15px JetBrains Mono, ui-monospace, monospace';
  c.fillText(stripEmojis(s.role).toUpperCase().slice(0, 44), -cw / 2 + 36, -ch / 2 + artH + 82);

  c.fillStyle = '#181614';
  c.font = '600 28px Manrope, -apple-system, sans-serif';
  const bodyLines = wrapLines(c, stripEmojis(s.cardText), cw - 72, 6);
  bodyLines.forEach((ln, idx) => {
    c.fillText(ln, -cw / 2 + 36, -ch / 2 + artH + 144 + idx * 42);
  });

  c.restore();
  roundRect(c, -cw / 2, -ch / 2, cw, ch, 28);
  c.strokeStyle = 'rgba(24, 22, 20, 0.85)';
  c.lineWidth = 3;
  c.stroke();
  c.restore();

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
 * Запись вертикального 9:16 видео (720×1280 @ 30 FPS) с исправленной совместимостью iOS Safari:
 * - БЕЗ фрагментирующего timeslice в recorder.start() (чтобы iOS писал единый валидный .mp4 с точным временем!);
 * - Чистый MIME 'video/mp4' на выходном файле, чтобы на iPhone открывалось штатное «Сохранить видео» / Telegram / Instagram!
 */
export class ReelVideoRecorder {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private recorder: MediaRecorder | null = null;
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

    this.chunks = [];
    this.startedAt = performance.now();
    this.lastDrawMs = 0;
    this.renderFrame();

    const canvasStream = this.canvas.captureStream(30);
    if (optionalAudioStream) {
      optionalAudioStream.getAudioTracks().forEach((track) => {
        if (track.readyState === 'live') {
          canvasStream.addTrack(track);
        }
      });
    }

    const { recorderMime } = pickRecorderMime();
    try {
      this.recorder = recorderMime
        ? new MediaRecorder(canvasStream, {
            mimeType: recorderMime,
            videoBitsPerSecond: 3_500_000,
          })
        : new MediaRecorder(canvasStream);
    } catch {
      this.recorder = new MediaRecorder(canvasStream);
    }

    this.recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) {
        this.chunks.push(ev.data);
      }
    };

    // КРИТИЧНО ДЛЯ iOS SAFARI: запускаем start() БЕЗ timeslice, чтобы получить цельный валидный .mp4 контейнер!
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
      const fallback = pickRecorderMime();
      const durationSec = Math.max(1, Math.round((performance.now() - this.startedAt) / 1000));

      rec.onstop = () => {
        const rawMime = (rec.mimeType || fallback.recorderMime || '').toLowerCase();
        const isMp4 = rawMime.includes('mp4') || fallback.extension === 'mp4';
        // Чистый MIME без ';codecs=...' — иначе iOS Share Sheet сохраняет «странный» нераспознанный файл!
        const cleanMime: 'video/mp4' | 'video/webm' = isMp4 ? 'video/mp4' : 'video/webm';
        const cleanExt: 'mp4' | 'webm' = isMp4 ? 'mp4' : 'webm';

        const blob = new Blob(this.chunks, { type: cleanMime });
        const url = URL.createObjectURL(blob);
        this.recorder = null;
        resolve({
          blob,
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
