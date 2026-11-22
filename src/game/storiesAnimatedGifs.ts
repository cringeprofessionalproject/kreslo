/**
 * ДВИЖОК АНИМИРОВАННЫХ GIF-СТИКЕРОВ И ПОЛЬЗОВАТЕЛЬСКИХ МЕМОВ ДЛЯ STORIES-РЕДАКТОРА (v42):
 * 1) 8 встроенных векторных 60fps реакций (рисуются в векторном разрешении без пикселизации).
 * 2) Декодер настоящих многокадровых .gif и .webp файлов через WebCodecs ImageDecoder API
 *    (сохраняет все кадры и тайминги анимации и в живом превью, и при рендере в MP4!),
 *    плюс поддержка статичных PNG/JPG и коротких видео-мемов (.mp4/.webm).
 */

export type BuiltinGifId =
  | 'chair_fire'
  | 'panic_cat'
  | 'chart_crash'
  | 'stamp_slam'
  | 'coffee_shake'
  | 'shades_deal'
  | 'cash_wings'
  | 'pulse_180';

export interface BuiltinGifDef {
  id: BuiltinGifId;
  label: string;
  tag: string;
}

export const BUILTIN_ANIMATED_GIFS: BuiltinGifDef[] = [
  { id: 'chair_fire', label: 'Кресло в огне', tag: 'ГОРИТ' },
  { id: 'panic_cat', label: 'Аврал за ноутом', tag: 'ДЕДЛАЙН' },
  { id: 'chart_crash', label: 'Метрики в пол', tag: 'ОБВАЛ' },
  { id: 'stamp_slam', label: 'Штамп: СНЯТ', tag: 'ПРИКАЗ' },
  { id: 'coffee_shake', label: '5-й эспрессо', tag: 'НЕРВЫ' },
  { id: 'shades_deal', label: 'Холодный расчёт', tag: 'БОСС' },
  { id: 'cash_wings', label: 'Бюджет улетел', tag: 'КАССА' },
  { id: 'pulse_180', label: 'Пульс 180', tag: 'ПУЛЬС' },
];

export interface DecodedGifFrame {
  bitmap: ImageBitmap;
  durationSec: number;
}

export interface CustomStickerMedia {
  id: string;
  name: string;
  kind: 'animated_frames' | 'static_image' | 'video_loop';
  width: number;
  height: number;
  frames?: DecodedGifFrame[];
  totalLoopSec?: number;
  staticImg?: ImageBitmap | HTMLImageElement;
  videoEl?: HTMLVideoElement;
  blob?: Blob;
  objectUrl?: string;
}

interface ImageDecoderLike {
  tracks: {
    ready: Promise<void>;
    selectedTrack?: { frameCount: number; animated?: boolean } | null;
  };
  decode: (opts: { frameIndex: number }) => Promise<{
    image: VideoFrame;
  }>;
  close: () => void;
}

/**
 * Декодирует загруженный пользователем .gif / .webp / .png / .mp4 в покадровый или видео-стикер.
 */
export async function decodeUploadedStickerMedia(file: File): Promise<CustomStickerMedia> {
  const id = `cust_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const mime = (file.type || '').toLowerCase();
  const isGifOrWebp =
    mime === 'image/gif' ||
    mime === 'image/webp' ||
    /\.gif$/i.test(file.name) ||
    /\.webp$/i.test(file.name);

  // 1. Попытка покадровой распаковки настоящего анимированного GIF / WebP через ImageDecoder
  const ImgDecCtor = (
    globalThis as unknown as {
      ImageDecoder?: new (init: { data: BufferSource; type: string }) => ImageDecoderLike;
    }
  ).ImageDecoder;

  if (isGifOrWebp && typeof ImgDecCtor === 'function') {
    try {
      const buf = await file.arrayBuffer();
      const decType = mime || (file.name.toLowerCase().endsWith('.webp') ? 'image/webp' : 'image/gif');
      const decoder = new ImgDecCtor({ data: buf, type: decType });
      await decoder.tracks.ready;
      const frameCount = Math.min(90, decoder.tracks.selectedTrack?.frameCount ?? 1);
      if (frameCount > 1) {
        const frames: DecodedGifFrame[] = [];
        let totalLoopSec = 0;
        let w = 240;
        let h = 240;
        for (let i = 0; i < frameCount; i++) {
          const { image } = await decoder.decode({ frameIndex: i });
          w = image.displayWidth || w;
          h = image.displayHeight || h;
          const durUs = image.duration || 80_000;
          const durSec = Math.max(0.03, Math.min(1.0, durUs / 1_000_000));
          const bmp = await createImageBitmap(image);
          image.close();
          frames.push({ bitmap: bmp, durationSec: durSec });
          totalLoopSec += durSec;
        }
        decoder.close();
        return {
          id,
          name: file.name,
          kind: 'animated_frames',
          width: w,
          height: h,
          frames,
          totalLoopSec: Math.max(0.1, totalLoopSec),
          blob: file,
        };
      }
      decoder.close();
    } catch {
      // Переходим к запасному способу ниже
    }
  }

  // 2. Короткий видео-мем (.mp4 / .webm / .mov)
  if (mime.startsWith('video/') || /\.(mp4|webm|mov)$/i.test(file.name)) {
    const objectUrl = URL.createObjectURL(file);
    const videoEl = document.createElement('video');
    videoEl.src = objectUrl;
    videoEl.muted = true;
    videoEl.loop = true;
    videoEl.playsInline = true;
    videoEl.preload = 'auto';
    await new Promise<void>((resolve) => {
      const done = () => resolve();
      videoEl.onloadeddata = done;
      videoEl.onerror = done;
      setTimeout(done, 1800);
    });
    void videoEl.play().catch(() => {});
    return {
      id,
      name: file.name,
      kind: 'video_loop',
      width: videoEl.videoWidth || 320,
      height: videoEl.videoHeight || 320,
      videoEl,
      blob: file,
      objectUrl,
    };
  }

  // 3. Статичное изображение (PNG / JPG / запасной вариант GIF)
  if (typeof createImageBitmap === 'function') {
    const bmp = await createImageBitmap(file);
    return {
      id,
      name: file.name,
      kind: 'static_image',
      width: bmp.width || 240,
      height: bmp.height || 240,
      staticImg: bmp,
      blob: file,
    };
  }

  const objectUrl = URL.createObjectURL(file);
  const img = new Image();
  await new Promise<void>((resolve) => {
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = objectUrl;
  });
  return {
    id,
    name: file.name,
    kind: 'static_image',
    width: img.naturalWidth || 240,
    height: img.naturalHeight || 240,
    staticImg: img,
    blob: file,
    objectUrl,
  };
}

export function drawCustomStickerAtTime(
  ctx: CanvasRenderingContext2D,
  media: CustomStickerMedia,
  tSec: number,
  cx: number,
  cy: number,
  baseSize: number,
  scale: number,
  rotDeg: number,
  entrancePop = 1
): void {
  const aspect = media.width > 0 && media.height > 0 ? media.width / media.height : 1;
  const drawW = (aspect >= 1 ? baseSize : baseSize * aspect) * scale * entrancePop;
  const drawH = (aspect >= 1 ? baseSize / aspect : baseSize) * scale * entrancePop;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((rotDeg * Math.PI) / 180);

  if (media.kind === 'animated_frames' && media.frames && media.frames.length > 0) {
    const loop = media.totalLoopSec || 1;
    let rem = ((tSec % loop) + loop) % loop;
    let chosen = media.frames[0].bitmap;
    for (const fr of media.frames) {
      if (rem <= fr.durationSec) {
        chosen = fr.bitmap;
        break;
      }
      rem -= fr.durationSec;
    }
    ctx.drawImage(chosen, -drawW / 2, -drawH / 2, drawW, drawH);
  } else if (media.kind === 'video_loop' && media.videoEl) {
    try {
      ctx.drawImage(media.videoEl, -drawW / 2, -drawH / 2, drawW, drawH);
    } catch {
      // ignore if frame not ready
    }
  } else if (media.staticImg) {
    ctx.drawImage(media.staticImg, -drawW / 2, -drawH / 2, drawW, drawH);
  }

  ctx.restore();
}

function rRect(
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

/**
 * Рисует встроенный 60fps векторный GIF-стикер в заданной точке холста.
 */
export function drawBuiltinAnimatedGif(
  ctx: CanvasRenderingContext2D,
  gifId: BuiltinGifId,
  tSec: number,
  cx: number,
  cy: number,
  scale: number,
  rotDeg: number,
  entrancePop = 1
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((rotDeg * Math.PI) / 180);
  const s = scale * entrancePop;
  ctx.scale(s, s);

  switch (gifId) {
    case 'chair_fire': {
      // Качающееся офисное кресло в языках живого пламени и искрах
      const wobble = Math.sin(tSec * 14) * 0.06;
      ctx.save();
      ctx.rotate(wobble);

      // Задние языки пламени
      for (let i = -2; i <= 2; i++) {
        const h = 58 + Math.sin(tSec * 18 + i * 1.7) * 18;
        const fx = i * 24;
        ctx.fillStyle = i % 2 === 0 ? '#e04f2e' : '#f29d38';
        ctx.beginPath();
        ctx.moveTo(fx - 22, 42);
        ctx.quadraticCurveTo(fx - 12, 42 - h * 0.6, fx + Math.sin(tSec * 12 + i) * 8, 42 - h);
        ctx.quadraticCurveTo(fx + 14, 42 - h * 0.55, fx + 22, 42);
        ctx.closePath();
        ctx.fill();
      }

      // Спинка и сиденье кресла руководителя
      ctx.fillStyle = '#1d1b1a';
      ctx.strokeStyle = '#c89b4f';
      ctx.lineWidth = 3;
      rRect(ctx, -36, -46, 72, 68, 14);
      ctx.fill();
      ctx.stroke();

      rRect(ctx, -44, 14, 88, 20, 8);
      ctx.fill();
      ctx.stroke();

      // Ножка и крестовина
      ctx.strokeStyle = '#a6aba6';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(0, 34);
      ctx.lineTo(0, 56);
      ctx.moveTo(-34, 58);
      ctx.lineTo(34, 58);
      ctx.stroke();

      // Передние яркие языки огня + искры
      for (let i = -1; i <= 1; i++) {
        const h = 38 + Math.cos(tSec * 22 + i * 2.1) * 14;
        const fx = i * 22;
        ctx.fillStyle = '#ffd166';
        ctx.beginPath();
        ctx.moveTo(fx - 14, 44);
        ctx.quadraticCurveTo(fx, 44 - h, fx + 14, 44);
        ctx.closePath();
        ctx.fill();
      }

      for (let sp = 0; sp < 5; sp++) {
        const prog = (tSec * 1.8 + sp * 0.21) % 1;
        const sx = Math.sin(sp * 4.2 + tSec * 5) * 44;
        const sy = 20 - prog * 95;
        ctx.fillStyle = `rgba(255, 214, 102, ${(1 - prog).toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(sx, sy, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      break;
    }

    case 'panic_cat': {
      // Офисный кот в панике колотит лапами по ноутбуку
      ctx.fillStyle = 'rgba(18, 22, 28, 0.92)';
      ctx.strokeStyle = 'rgba(214, 160, 92, 0.65)';
      ctx.lineWidth = 2.5;
      rRect(ctx, -74, -68, 148, 136, 24);
      ctx.fill();
      ctx.stroke();

      // Голова и уши кота
      const headBob = Math.sin(tSec * 26) * 3;
      ctx.save();
      ctx.translate(0, headBob);
      ctx.fillStyle = '#f4efe4';
      ctx.beginPath();
      ctx.moveTo(-34, -8);
      ctx.lineTo(-42, -46);
      ctx.lineTo(-14, -30);
      ctx.lineTo(14, -30);
      ctx.lineTo(42, -46);
      ctx.lineTo(34, -8);
      ctx.arc(0, -4, 36, 0, Math.PI, false);
      ctx.closePath();
      ctx.fill();

      // Бешеные глаза в дедлайне
      ctx.fillStyle = '#181614';
      ctx.beginPath();
      ctx.arc(-14, -10, 6.5, 0, Math.PI * 2);
      ctx.arc(14, -10, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-12, -12, 2.2, 0, Math.PI * 2);
      ctx.arc(16, -12, 2.2, 0, Math.PI * 2);
      ctx.fill();

      // Красный галстук
      ctx.fillStyle = '#c83e31';
      ctx.beginPath();
      ctx.moveTo(-6, 18);
      ctx.lineTo(6, 18);
      ctx.lineTo(9, 40);
      ctx.lineTo(0, 48);
      ctx.lineTo(-9, 40);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Лапы молотят по очереди (30 ударов в секунду!)
      const leftDown = Math.sin(tSec * 34) > 0;
      ctx.fillStyle = '#f4efe4';
      ctx.beginPath();
      ctx.ellipse(-28, leftDown ? 42 : 26, 11, 16, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(28, !leftDown ? 42 : 26, 11, 16, 0.3, 0, Math.PI * 2);
      ctx.fill();

      // Крышка ноутбука со свечением
      ctx.fillStyle = '#72b6d4';
      rRect(ctx, -48, 38, 96, 18, 5);
      ctx.fill();
      break;
    }

    case 'chart_crash': {
      // График KPI пробивает дно с искрами
      ctx.fillStyle = 'rgba(15, 20, 24, 0.94)';
      ctx.strokeStyle = 'rgba(200, 62, 49, 0.72)';
      ctx.lineWidth = 2.5;
      rRect(ctx, -78, -58, 156, 116, 20);
      ctx.fill();
      ctx.stroke();

      const cyc = (tSec * 0.85) % 1;
      const tipX = -56 + cyc * 112;
      const tipY = cyc < 0.35 ? 10 - cyc * 90 : -22 + Math.pow((cyc - 0.35) / 0.65, 1.8) * 74;

      ctx.strokeStyle = cyc < 0.35 ? '#6cc4a1' : '#e04f3e';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(-56, 10);
      if (cyc < 0.35) {
        ctx.lineTo(tipX, tipY);
      } else {
        ctx.lineTo(-17, -22);
        ctx.lineTo(tipX, tipY);
      }
      ctx.stroke();

      ctx.fillStyle = cyc < 0.35 ? '#6cc4a1' : '#ff6b57';
      ctx.beginPath();
      ctx.arc(tipX, tipY, 7, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#f08c82';
      ctx.font = '800 15px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('KPI -99%', 0, -34);
      break;
    }

    case 'stamp_slam': {
      // Тяжёлая печать с периодическим ударом о бумагу
      const cyc = (tSec * 0.9) % 1;
      const slamScale = cyc < 0.14 ? 1.45 - (cyc / 0.14) * 0.45 : 1;
      ctx.scale(slamScale, slamScale);

      ctx.fillStyle = 'rgba(244, 239, 228, 0.96)';
      ctx.strokeStyle = '#c83e31';
      ctx.lineWidth = 5;
      rRect(ctx, -96, -34, 192, 68, 10);
      ctx.fill();
      ctx.stroke();

      ctx.lineWidth = 1.5;
      rRect(ctx, -88, -26, 176, 52, 6);
      ctx.stroke();

      ctx.fillStyle = '#c83e31';
      ctx.font = '800 22px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('УВОЛЕН ПО СТ.', 0, 1);
      break;
    }

    case 'coffee_shake': {
      // Дрожащая чашка пятого эспрессо с колечками пара
      const jx = Math.sin(tSec * 42) * 2.6;
      const jy = Math.cos(tSec * 37) * 1.8;
      ctx.translate(jx, jy);

      // Ручка
      ctx.strokeStyle = '#f4efe4';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(34, 8, 16, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();

      // Чашка
      ctx.fillStyle = '#f4efe4';
      ctx.strokeStyle = '#181614';
      ctx.lineWidth = 3;
      rRect(ctx, -36, -16, 72, 56, 14);
      ctx.fill();
      ctx.stroke();

      // Крема эспрессо
      ctx.fillStyle = '#6f3b1e';
      ctx.beginPath();
      ctx.ellipse(0, -12, 30, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Пар вверх
      ctx.strokeStyle = 'rgba(244, 239, 228, 0.78)';
      ctx.lineWidth = 3;
      for (let i = -1; i <= 1; i++) {
        const up = (tSec * 1.4 + (i + 1) * 0.3) % 1;
        const sx = i * 16 + Math.sin(tSec * 8 + i) * 5;
        const sy = -24 - up * 38;
        ctx.globalAlpha = 1 - up;
        ctx.beginPath();
        ctx.arc(sx, sy, 6 + up * 5, 0, Math.PI * 1.4);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      break;
    }

    case 'shades_deal': {
      // Чёрные очки переговорщика с бегущим золотым бликом
      const bob = Math.sin(tSec * 4) * 3;
      ctx.translate(0, bob);

      ctx.fillStyle = '#111317';
      ctx.strokeStyle = '#d6a05c';
      ctx.lineWidth = 3;

      rRect(ctx, -82, -20, 70, 40, 8);
      ctx.fill();
      ctx.stroke();
      rRect(ctx, 12, -20, 70, 40, 8);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(-12, -10);
      ctx.lineTo(12, -10);
      ctx.stroke();

      // Световой блик по линзам
      const sweep = ((tSec * 1.1) % 1.6) - 0.3;
      if (sweep >= 0 && sweep <= 1) {
        ctx.strokeStyle = 'rgba(255,255,255,0.75)';
        ctx.lineWidth = 5;
        const lx = -72 + sweep * 46;
        ctx.beginPath();
        ctx.moveTo(lx, -14);
        ctx.lineTo(lx - 12, 14);
        ctx.moveTo(lx + 94, -14);
        ctx.lineTo(lx + 82, 14);
        ctx.stroke();
      }
      break;
    }

    case 'cash_wings': {
      // Пачка бюджета машет крыльями и улетает
      const flap = Math.sin(tSec * 16) * 22;
      const hover = Math.sin(tSec * 5) * 7;
      ctx.translate(0, hover);

      // Левое и правое крыло
      ctx.fillStyle = '#f4efe4';
      ctx.strokeStyle = '#181614';
      ctx.lineWidth = 2.5;

      ctx.beginPath();
      ctx.moveTo(-34, 0);
      ctx.quadraticCurveTo(-78, -32 + flap, -86, -4 + flap);
      ctx.quadraticCurveTo(-64, 18, -34, 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(34, 0);
      ctx.quadraticCurveTo(78, -32 + flap, 86, -4 + flap);
      ctx.quadraticCurveTo(64, 18, 34, 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Пачка купюр с лентой
      ctx.fillStyle = '#2d7a5e';
      ctx.strokeStyle = '#181614';
      rRect(ctx, -40, -20, 80, 42, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#d6a05c';
      ctx.fillRect(-10, -20, 20, 42);
      break;
    }

    case 'pulse_180': {
      // Живой кардиомонитор на пульсе 180
      ctx.fillStyle = 'rgba(14, 18, 22, 0.92)';
      ctx.strokeStyle = 'rgba(240, 140, 130, 0.65)';
      ctx.lineWidth = 2.5;
      rRect(ctx, -84, -42, 168, 84, 18);
      ctx.fill();
      ctx.stroke();

      const phase = (tSec * 1.6) % 1;
      ctx.strokeStyle = '#ff5a52';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(-68, 8);
      ctx.lineTo(-26, 8);
      ctx.lineTo(-14, -4);
      ctx.lineTo(-4, 24);
      ctx.lineTo(8, -26);
      ctx.lineTo(20, 18);
      ctx.lineTo(30, 8);
      ctx.lineTo(68, 8);
      ctx.stroke();

      const dotX = -68 + phase * 136;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(dotX, 0, 4.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#f08c82';
      ctx.font = '800 13px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText('184 BPM', 70, -20);
      break;
    }
  }

  ctx.restore();
}
