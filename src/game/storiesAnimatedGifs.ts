/**
 * КАТАЛОГ И ПОИСК АНИМИРОВАННЫХ СТИКЕРОВ / ГИФОК ДЛЯ STORIES-РЕДАКТОРА (v45):
 * 1) 34 мгновенно ищущихся по-русски и по-английски 60fps анимированных стикера и мема
 *    (8 фирменных реакций КРЕСЛА + 26 проверенных 512px 60fps Animated WebP с CORS=*);
 * 2) Живой онлайн-поиск гифок через GIPHY / KLIPY API (если указан ключ) + загрузка любой своей .gif / .webp / .mp4;
 * 3) Покадровая распаковка .gif и .webp через ImageDecoder API для идеального экспорта в MP4.
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

export interface CatalogStickerItem {
  id: string;
  title: string;
  category: 'top' | 'office' | 'emotion' | 'money';
  keywords: string[];
  kind: 'builtin_vector' | 'animated_webp';
  builtinId?: BuiltinGifId;
  webpUrl?: string;
}

const NOTO_BASE = 'https://fonts.gstatic.com/s/e/notoemoji/latest';

export const SEARCHABLE_STICKER_CATALOG: CatalogStickerItem[] = [
  // Фирменные рабочие гифки КРЕСЛА
  {
    id: 'vec_chair_fire',
    title: 'Кресло горит',
    category: 'top',
    keywords: ['кресло', 'огонь', 'горит', 'пожар', 'аврал', 'уволен', 'fire'],
    kind: 'builtin_vector',
    builtinId: 'chair_fire',
  },
  {
    id: 'vec_panic_cat',
    title: 'Кот в дедлайне',
    category: 'top',
    keywords: ['кот', 'котик', 'ноут', 'дедлайн', 'паника', 'работа', 'офис', 'cat'],
    kind: 'builtin_vector',
    builtinId: 'panic_cat',
  },
  {
    id: 'vec_chart_crash',
    title: 'KPI в пол',
    category: 'money',
    keywords: ['график', 'обвал', 'дно', 'минус', 'kpi', 'акции', 'падение', 'crash'],
    kind: 'builtin_vector',
    builtinId: 'chart_crash',
  },
  {
    id: 'vec_stamp_slam',
    title: 'Штамп УВОЛЕН',
    category: 'office',
    keywords: ['штамп', 'печать', 'уволен', 'снят', 'приказ', 'трудовая'],
    kind: 'builtin_vector',
    builtinId: 'stamp_slam',
  },
  {
    id: 'vec_cash_wings',
    title: 'Бюджет улетел',
    category: 'money',
    keywords: ['деньги', 'бабки', 'бюджет', 'касса', 'зарплата', 'улетели', 'money'],
    kind: 'builtin_vector',
    builtinId: 'cash_wings',
  },
  {
    id: 'vec_coffee_shake',
    title: '5-й эспрессо',
    category: 'office',
    keywords: ['кофе', 'эспрессо', 'чашка', 'нервы', 'утро', 'трясет', 'coffee'],
    kind: 'builtin_vector',
    builtinId: 'coffee_shake',
  },
  {
    id: 'vec_shades_deal',
    title: 'Очки босса',
    category: 'top',
    keywords: ['очки', 'босс', 'круто', 'сделка', 'переговоры', 'гений', 'deal'],
    kind: 'builtin_vector',
    builtinId: 'shades_deal',
  },
  {
    id: 'vec_pulse_180',
    title: 'Пульс 184',
    category: 'office',
    keywords: ['пульс', 'сердце', 'стресс', 'давление', 'инфаркт', 'клиника'],
    kind: 'builtin_vector',
    builtinId: 'pulse_180',
  },

  // Проверенные 512px 60fps Animated WebP (Telegram-стиль)
  {
    id: 'noto_1f525',
    title: 'Пожар',
    category: 'top',
    keywords: ['огонь', 'горит', 'пожар', 'жара', 'топ', 'пушка', 'fire'],
    kind: 'animated_webp',
    webpUrl: `${NOTO_BASE}/1f525/512.webp`,
  },
  {
    id: 'noto_1f921',
    title: 'Клоун',
    category: 'top',
    keywords: ['клоун', 'цирк', 'кринж', 'тупняк', 'менеджмент', 'clown'],
    kind: 'animated_webp',
    webpUrl: `${NOTO_BASE}/1f921/512.webp`,
  },
  {
    id: 'noto_1f480',
    title: 'Помянем',
    category: 'top',
    keywords: ['череп', 'смерть', 'рип', 'помянем', 'убит', 'конец', 'rip', 'skull'],
    kind: 'animated_webp',
    webpUrl: `${NOTO_BASE}/1f480/512.webp`,
  },
  {
    id: 'noto_1f92f',
    title: 'Взрыв мозга',
    category: 'top',
    keywords: ['взрыв', 'мозг', 'шок', 'инсайт', 'гениально', 'как', 'mind'],
    kind: 'animated_webp',
    webpUrl: `${NOTO_BASE}/1f92f/512.webp`,
  },
  {
    id: 'noto_1f602',
    title: 'В голос',
    category: 'emotion',
    keywords: ['смех', 'хаха', 'ору', 'ржу', 'слезы', 'смешно', 'lol'],
    kind: 'animated_webp',
    webpUrl: `${NOTO_BASE}/1f602/512.webp`,
  },
  {
    id: 'noto_1f62d',
    title: 'Рыдания',
    category: 'emotion',
    keywords: ['плач', 'слезы', 'рыдаю', 'боль', 'грусть', 'обидно', 'cry'],
    kind: 'animated_webp',
    webpUrl: `${NOTO_BASE}/1f62d/512.webp`,
  },
  {
    id: 'noto_1fae0',
    title: 'Плыву',
    category: 'emotion',
    keywords: ['таю', 'душно', 'плыву', 'жарко', 'устал', 'выгорание', 'melt'],
    kind: 'animated_webp',
    webpUrl: `${NOTO_BASE}/1fae0/512.webp`,
  },
  {
    id: 'noto_1fae1',
    title: 'Есть, шеф',
    category: 'office',
    keywords: ['честь', 'салют', 'принято', 'шеф', 'босс', 'слушаюсь', 'salute'],
    kind: 'animated_webp',
    webpUrl: `${NOTO_BASE}/1fae1/512.webp`,
  },
  {
    id: 'noto_1f440',
    title: 'Наблюдаю',
    category: 'office',
    keywords: ['глаза', 'смотрю', 'проверка', 'аудит', 'палево', 'eyes'],
    kind: 'animated_webp',
    webpUrl: `${NOTO_BASE}/1f440/512.webp`,
  },
  {
    id: 'noto_1f4b8',
    title: 'Деньги на ветер',
    category: 'money',
    keywords: ['деньги', 'бабки', 'кэш', 'штраф', 'убыток', 'минус', 'cash'],
    kind: 'animated_webp',
    webpUrl: `${NOTO_BASE}/1f4b8/512.webp`,
  },
  {
    id: 'noto_1f680',
    title: 'В космос',
    category: 'money',
    keywords: ['ракета', 'рост', 'взлет', 'иксы', 'выручка', 'стартап', 'rocket'],
    kind: 'animated_webp',
    webpUrl: `${NOTO_BASE}/1f680/512.webp`,
  },
  {
    id: 'noto_1f451',
    title: 'Корона',
    category: 'money',
    keywords: ['корона', 'царь', 'босс', 'лидер', 'победа', 'лучший', 'crown'],
    kind: 'animated_webp',
    webpUrl: `${NOTO_BASE}/1f451/512.webp`,
  },
  {
    id: 'noto_1f631',
    title: 'Паника',
    category: 'emotion',
    keywords: ['крик', 'ужас', 'паника', 'страшно', 'проверка', 'налоговая', 'scream'],
    kind: 'animated_webp',
    webpUrl: `${NOTO_BASE}/1f631/512.webp`,
  },
  {
    id: 'noto_1f4a3',
    title: 'Сейчас рванёт',
    category: 'office',
    keywords: ['бомба', 'взрыв', 'конфликт', 'скандал', 'рванет', 'bomb'],
    kind: 'animated_webp',
    webpUrl: `${NOTO_BASE}/1f4a3/512.webp`,
  },
  {
    id: 'noto_1f4a5',
    title: 'Бабах',
    category: 'top',
    keywords: ['взрыв', 'бум', 'удар', 'краш', 'разнос', 'boom'],
    kind: 'animated_webp',
    webpUrl: `${NOTO_BASE}/1f4a5/512.webp`,
  },
  {
    id: 'noto_1f60e',
    title: 'На опыте',
    category: 'emotion',
    keywords: ['крутой', 'очки', 'спокойно', 'опыт', 'профи', 'cool'],
    kind: 'animated_webp',
    webpUrl: `${NOTO_BASE}/1f60e/512.webp`,
  },
  {
    id: 'noto_1f621',
    title: 'Бесит',
    category: 'emotion',
    keywords: ['злость', 'бесит', 'ярость', 'клиент', 'шеф', 'angry'],
    kind: 'animated_webp',
    webpUrl: `${NOTO_BASE}/1f621/512.webp`,
  },
  {
    id: 'noto_1f92e',
    title: 'Тошнота',
    category: 'emotion',
    keywords: ['тошнит', 'кринж', 'отчеты', 'созвон', 'жесть'],
    kind: 'animated_webp',
    webpUrl: `${NOTO_BASE}/1f92e/512.webp`,
  },
  {
    id: 'noto_1f624',
    title: 'Пар из ушей',
    category: 'office',
    keywords: ['пар', 'нервы', 'кипит', 'дедлайн', 'терпение'],
    kind: 'animated_webp',
    webpUrl: `${NOTO_BASE}/1f624/512.webp`,
  },
  {
    id: 'noto_1f975',
    title: 'Перегрев',
    category: 'emotion',
    keywords: ['жарко', 'перегрев', 'пот', 'стресс', 'аврал', 'hot'],
    kind: 'animated_webp',
    webpUrl: `${NOTO_BASE}/1f975/512.webp`,
  },
  {
    id: 'noto_1f976',
    title: 'Отморозил',
    category: 'emotion',
    keywords: ['холод', 'заморозка', 'лед', 'кассовый', 'cold'],
    kind: 'animated_webp',
    webpUrl: `${NOTO_BASE}/1f976/512.webp`,
  },
  {
    id: 'noto_1f91d',
    title: 'По рукам',
    category: 'office',
    keywords: ['рукопожатие', 'сделка', 'договор', 'контракт', 'согласие', 'deal'],
    kind: 'animated_webp',
    webpUrl: `${NOTO_BASE}/1f91d/512.webp`,
  },
  {
    id: 'noto_1f4af',
    title: '100%',
    category: 'money',
    keywords: ['сто', '100', 'база', 'факт', 'точно', 'план'],
    kind: 'animated_webp',
    webpUrl: `${NOTO_BASE}/1f4af/512.webp`,
  },
  {
    id: 'noto_2615',
    title: 'Кофе-брейк',
    category: 'office',
    keywords: ['кофе', 'чай', 'перерыв', 'чашка', 'утро', 'бариста'],
    kind: 'animated_webp',
    webpUrl: `${NOTO_BASE}/2615/512.webp`,
  },
  {
    id: 'noto_1f431',
    title: 'Котик',
    category: 'emotion',
    keywords: ['кот', 'кошка', 'котик', 'мяу', 'мило', 'лапки'],
    kind: 'animated_webp',
    webpUrl: `${NOTO_BASE}/1f431/512.webp`,
  },
  {
    id: 'noto_1f389',
    title: 'Праздник',
    category: 'money',
    keywords: ['праздник', 'ура', 'победа', 'премия', 'релиз', 'party'],
    kind: 'animated_webp',
    webpUrl: `${NOTO_BASE}/1f389/512.webp`,
  },
];

export function searchStickerCatalog(
  query: string,
  category: 'all' | 'top' | 'office' | 'emotion' | 'money' = 'all'
): CatalogStickerItem[] {
  const q = query.trim().toLowerCase();
  return SEARCHABLE_STICKER_CATALOG.filter((item) => {
    if (category !== 'all' && item.category !== category && !q) return false;
    if (!q) return true;
    if (item.title.toLowerCase().includes(q)) return true;
    return item.keywords.some((kw) => kw.includes(q) || q.includes(kw));
  });
}

export interface ExternalGifResult {
  id: string;
  title: string;
  previewUrl: string;
  gifUrl: string;
}

/**
 * Онлайн-поиск гифок через GIPHY или KLIPY API (если задан бесплатный ключ в env или localStorage).
 */
export async function searchOnlineGifsIfConfigured(query: string): Promise<ExternalGifResult[]> {
  const giphyKey =
    (import.meta.env.VITE_GIPHY_API_KEY as string | undefined) ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('kreslo_giphy_key') : null);

  if (!query.trim()) return [];
  // 1. Общий прокси на Cloudflare Worker — работает у всех игроков без ключей
  try {
    const proxy = await fetch(
      `https://kreslo-stars.koshernoe-detya.workers.dev/gif?q=${encodeURIComponent(query.trim())}`
    );
    if (proxy.ok) {
      const list = (await proxy.json()) as ExternalGifResult[];
      if (Array.isArray(list) && list.length > 0) return list;
    }
  } catch {
    // пробуем локальный ключ
  }
  if (!giphyKey) return [];
  try {
    const url = `https://api.giphy.com/v1/stickers/search?api_key=${encodeURIComponent(
      giphyKey.trim()
    )}&q=${encodeURIComponent(query.trim())}&limit=16&rating=pg-13&lang=ru`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = (await res.json()) as {
      data?: Array<{
        id: string;
        title?: string;
        images?: {
          fixed_height_small?: { url?: string };
          fixed_height?: { url?: string };
        };
      }>;
    };
    return (json.data ?? [])
      .map((item) => ({
        id: `giphy_${item.id}`,
        title: item.title || query,
        previewUrl: item.images?.fixed_height_small?.url || item.images?.fixed_height?.url || '',
        gifUrl: item.images?.fixed_height?.url || '',
      }))
      .filter((x) => Boolean(x.gifUrl));
  } catch {
    return [];
  }
}

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

export async function decodeRemoteStickerUrl(
  url: string,
  name: string
): Promise<CustomStickerMedia> {
  const res = await fetch(url, { mode: 'cors' });
  const blob = await res.blob();
  const ext = url.endsWith('.webp') ? 'webp' : 'gif';
  const file = new File([blob], `${name}.${ext}`, {
    type: blob.type || (ext === 'webp' ? 'image/webp' : 'image/gif'),
  });
  return decodeUploadedStickerMedia(file);
}

export async function decodeUploadedStickerMedia(file: File): Promise<CustomStickerMedia> {
  const id = `cust_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const mime = (file.type || '').toLowerCase();
  const isGifOrWebp =
    mime === 'image/gif' ||
    mime === 'image/webp' ||
    /\.gif$/i.test(file.name) ||
    /\.webp$/i.test(file.name);

  const ImgDecCtor = (
    globalThis as unknown as {
      ImageDecoder?: new (init: { data: BufferSource; type: string }) => ImageDecoderLike;
    }
  ).ImageDecoder;

  if (isGifOrWebp && typeof ImgDecCtor === 'function') {
    try {
      const buf = await file.arrayBuffer();
      const decType =
        mime || (file.name.toLowerCase().endsWith('.webp') ? 'image/webp' : 'image/gif');
      const decoder = new ImgDecCtor({ data: buf, type: decType });
      await decoder.tracks.ready;
      const frameCount = Math.min(90, decoder.tracks.selectedTrack?.frameCount ?? 1);
      if (frameCount > 1) {
        const frames: DecodedGifFrame[] = [];
        let totalLoopSec = 0;
        let w = 256;
        let h = 256;
        for (let i = 0; i < frameCount; i++) {
          const { image } = await decoder.decode({ frameIndex: i });
          w = image.displayWidth || w;
          h = image.displayHeight || h;
          const durUs = image.duration || 40_000;
          const durSec = Math.max(0.02, Math.min(1.0, durUs / 1_000_000));
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
      // fallback below
    }
  }

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
      setTimeout(done, 1600);
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
      // ignore
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
      const wobble = Math.sin(tSec * 14) * 0.06;
      ctx.save();
      ctx.rotate(wobble);
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
      ctx.fillStyle = '#1d1b1a';
      ctx.strokeStyle = '#c89b4f';
      ctx.lineWidth = 3;
      rRect(ctx, -36, -46, 72, 68, 14);
      ctx.fill();
      ctx.stroke();
      rRect(ctx, -44, 14, 88, 20, 8);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#a6aba6';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(0, 34);
      ctx.lineTo(0, 56);
      ctx.moveTo(-34, 58);
      ctx.lineTo(34, 58);
      ctx.stroke();
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
      ctx.restore();
      break;
    }

    case 'panic_cat': {
      ctx.fillStyle = 'rgba(18, 22, 28, 0.92)';
      ctx.strokeStyle = 'rgba(214, 160, 92, 0.65)';
      ctx.lineWidth = 2.5;
      rRect(ctx, -74, -68, 148, 136, 24);
      ctx.fill();
      ctx.stroke();
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
      ctx.fillStyle = '#181614';
      ctx.beginPath();
      ctx.arc(-14, -10, 6.5, 0, Math.PI * 2);
      ctx.arc(14, -10, 6.5, 0, Math.PI * 2);
      ctx.fill();
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
      const leftDown = Math.sin(tSec * 34) > 0;
      ctx.fillStyle = '#f4efe4';
      ctx.beginPath();
      ctx.ellipse(-28, leftDown ? 42 : 26, 11, 16, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(28, !leftDown ? 42 : 26, 11, 16, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#72b6d4';
      rRect(ctx, -48, 38, 96, 18, 5);
      ctx.fill();
      break;
    }

    case 'chart_crash': {
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
      if (cyc < 0.35) ctx.lineTo(tipX, tipY);
      else {
        ctx.lineTo(-17, -22);
        ctx.lineTo(tipX, tipY);
      }
      ctx.stroke();
      ctx.fillStyle = '#f08c82';
      ctx.font = '800 15px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('KPI -99%', 0, -34);
      break;
    }

    case 'stamp_slam': {
      const cyc = (tSec * 0.9) % 1;
      const slamScale = cyc < 0.14 ? 1.45 - (cyc / 0.14) * 0.45 : 1;
      ctx.scale(slamScale, slamScale);
      ctx.fillStyle = 'rgba(244, 239, 228, 0.96)';
      ctx.strokeStyle = '#c83e31';
      ctx.lineWidth = 5;
      rRect(ctx, -96, -34, 192, 68, 10);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#c83e31';
      ctx.font = '800 22px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('УВОЛЕН ПО СТ.', 0, 1);
      break;
    }

    case 'coffee_shake': {
      const jx = Math.sin(tSec * 42) * 2.6;
      const jy = Math.cos(tSec * 37) * 1.8;
      ctx.translate(jx, jy);
      ctx.strokeStyle = '#f4efe4';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(34, 8, 16, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
      ctx.fillStyle = '#f4efe4';
      ctx.strokeStyle = '#181614';
      ctx.lineWidth = 3;
      rRect(ctx, -36, -16, 72, 56, 14);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#6f3b1e';
      ctx.beginPath();
      ctx.ellipse(0, -12, 30, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'shades_deal': {
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
      break;
    }

    case 'cash_wings': {
      const flap = Math.sin(tSec * 16) * 22;
      const hover = Math.sin(tSec * 5) * 7;
      ctx.translate(0, hover);
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
      ctx.fillStyle = '#2d7a5e';
      rRect(ctx, -40, -20, 80, 42, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#d6a05c';
      ctx.fillRect(-10, -20, 20, 42);
      break;
    }

    case 'pulse_180': {
      ctx.fillStyle = 'rgba(14, 18, 22, 0.92)';
      ctx.strokeStyle = 'rgba(240, 140, 130, 0.65)';
      ctx.lineWidth = 2.5;
      rRect(ctx, -84, -42, 168, 84, 18);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#ff5a52';
      ctx.lineWidth = 4;
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
      ctx.fillStyle = '#f08c82';
      ctx.font = '800 13px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText('184 BPM', 70, -20);
      break;
    }
  }

  ctx.restore();
}
