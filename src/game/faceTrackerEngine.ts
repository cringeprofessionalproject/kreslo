/**
 * Живой 478-точечный ИИ-трекер лица (MediaPipe FaceLandmarker, локальный WASM + float16 модель).
 * Находит точный контур лица (36 точек FACE_OVAL: лоб, скулы, щёки, челюсть, подбородок),
 * вырезает ТОЛЬКО само лицо без фона комнаты, стабилизирует масштаб/центр (даже если игрок
 * отклонился от камеры) и передаёт живой наклон головы (roll/yaw) и мимику рта прямо на карточку!
 */

const FACE_OVAL_RING = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152,
  148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
];

// Индексы верхней части лба/причёски, которые чуть приподнимаем (+15%), чтобы не «срезать» макушку
const FOREHEAD_INDICES = new Set([10, 338, 297, 332, 284, 109, 67, 103, 54]);

interface NormalizedLandmark {
  x: number;
  y: number;
  z: number;
}

interface MediaPipeVisionModule {
  FilesetResolver: {
    forVisionTasks: (wasmRoot: string) => Promise<unknown>;
  };
  FaceLandmarker: {
    createFromOptions: (
      wasmFileset: unknown,
      options: Record<string, unknown>
    ) => Promise<FaceLandmarkerInstance>;
  };
}

interface FaceLandmarkerInstance {
  detectForVideo: (
    video: HTMLVideoElement,
    timestampMs: number
  ) => { faceLandmarks?: NormalizedLandmark[][] };
  detect: (image: HTMLImageElement | HTMLCanvasElement) => {
    faceLandmarks?: NormalizedLandmark[][];
  };
  setOptions: (opts: { runningMode: 'VIDEO' | 'IMAGE' }) => Promise<void>;
  close?: () => void;
}

export interface TrackedFacePose {
  tracked: boolean;
  rollDeg: number; // Живой наклон головы влево/вправо
  yawNorm: number; // Поворот головы (-1..1)
  mouthOpen: number; // Открытие рта / удивление (0..1)
}

let cachedVisionMod: MediaPipeVisionModule | null = null;
let videoLandmarkerPromise: Promise<FaceLandmarkerInstance | null> | null = null;
let imageLandmarkerPromise: Promise<FaceLandmarkerInstance | null> | null = null;

async function loadVisionModule(): Promise<MediaPipeVisionModule | null> {
  if (cachedVisionMod) return cachedVisionMod;
  try {
    const bundleUrl = new URL('./assets/mediapipe/vision_bundle.mjs', window.location.href).href;
    const mod = (await import(/* @vite-ignore */ bundleUrl)) as MediaPipeVisionModule;
    cachedVisionMod = mod;
    return mod;
  } catch {
    return null;
  }
}

export async function getVideoFaceLandmarker(): Promise<FaceLandmarkerInstance | null> {
  if (videoLandmarkerPromise) return videoLandmarkerPromise;
  videoLandmarkerPromise = (async () => {
    const mod = await loadVisionModule();
    if (!mod) return null;
    try {
      const wasmUrl = new URL('./assets/mediapipe/wasm', window.location.href).href;
      const modelUrl = new URL('./assets/mediapipe/face_landmarker.task', window.location.href).href;
      const vision = await mod.FilesetResolver.forVisionTasks(wasmUrl);
      return await mod.FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: modelUrl,
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: false,
      });
    } catch {
      try {
        const wasmUrl = new URL('./assets/mediapipe/wasm', window.location.href).href;
        const modelUrl = new URL('./assets/mediapipe/face_landmarker.task', window.location.href).href;
        const vision = await mod.FilesetResolver.forVisionTasks(wasmUrl);
        return await mod.FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: modelUrl,
            delegate: 'CPU',
          },
          runningMode: 'VIDEO',
          numFaces: 1,
        });
      } catch {
        return null;
      }
    }
  })();
  return videoLandmarkerPromise;
}

async function getImageFaceLandmarker(): Promise<FaceLandmarkerInstance | null> {
  if (imageLandmarkerPromise) return imageLandmarkerPromise;
  imageLandmarkerPromise = (async () => {
    const mod = await loadVisionModule();
    if (!mod) return null;
    try {
      const wasmUrl = new URL('./assets/mediapipe/wasm', window.location.href).href;
      const modelUrl = new URL('./assets/mediapipe/face_landmarker.task', window.location.href).href;
      const vision = await mod.FilesetResolver.forVisionTasks(wasmUrl);
      return await mod.FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: modelUrl },
        runningMode: 'IMAGE',
        numFaces: 1,
      });
    } catch {
      return null;
    }
  })();
  return imageLandmarkerPromise;
}

/**
 * Рисует сглаженную замкнутую кривую Безье по точкам контура лица.
 */
function traceSmoothClosedPolygon(ctx: CanvasRenderingContext2D, pts: Array<{ x: number; y: number }>) {
  const n = pts.length;
  if (n < 3) return;
  ctx.beginPath();
  const firstMid = {
    x: (pts[n - 1].x + pts[0].x) / 2,
    y: (pts[n - 1].y + pts[0].y) / 2,
  };
  ctx.moveTo(firstMid.x, firstMid.y);
  for (let i = 0; i < n; i++) {
    const next = pts[(i + 1) % n];
    const mid = {
      x: (pts[i].x + next.x) / 2,
      y: (pts[i].y + next.y) / 2,
    };
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, mid.x, mid.y);
  }
  ctx.closePath();
}

/**
 * Класс реального времени: следит за лицом на <video> или статичном фото,
 * вырезает его по 36-точечному анатомическому контуру в прозрачный <canvas> (240×280)
 * с бумажной кромкой-вырезкой и отдаёт живую позу головы.
 */
export class LiveFaceCutoutTracker {
  public readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private smoothedPts: Array<{ x: number; y: number }> | null = null;
  private smoothedCenter: { x: number; y: number } | null = null;
  private smoothedScale = 1;
  private smoothedRoll = 0;
  private smoothedYaw = 0;
  private smoothedMouth = 0;
  private lastVideoTime = -1;
  private lastDetectMs = 0;
  private latestLandmarks: NormalizedLandmark[] | null = null;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 360;
    this.canvas.height = 420;
    this.ctx = this.canvas.getContext('2d')!;
  }

  public resetSmoothing() {
    this.smoothedPts = null;
    this.smoothedCenter = null;
    this.latestLandmarks = null;
    this.lastVideoTime = -1;
  }

  /**
   * Обновляет кадр с веб-камеры: находит 478 точек лица, вырезает ровно голову без фона комнаты
   * и центрирует её на прозрачном холсте 240×280.
   */
  public renderVideoFrame(
    video: HTMLVideoElement,
    landmarker: FaceLandmarkerInstance | null,
    mirror = true,
    drawStickerBorder = true
  ): TrackedFacePose {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const c = this.ctx;

    c.clearRect(0, 0, W, H);
    if (vw <= 2 || vh <= 2) {
      return { tracked: false, rollDeg: 0, yawNorm: 0, mouthOpen: 0 };
    }

    const now = performance.now();
    if (
      landmarker &&
      video.currentTime !== this.lastVideoTime &&
      now - this.lastDetectMs >= 30
    ) {
      this.lastVideoTime = video.currentTime;
      this.lastDetectMs = now;
      try {
        const res = landmarker.detectForVideo(video, now);
        if (res.faceLandmarks && res.faceLandmarks.length > 0) {
          this.latestLandmarks = res.faceLandmarks[0];
        } else {
          this.latestLandmarks = null;
        }
      } catch {
        // ignore transient frame error
      }
    }

    if (!this.latestLandmarks) {
      // Мягкий фолбэк, пока модель греется (первые ~200 мс) или лицо вышло из кадра
      this.drawFallbackOval(video, vw, vh, mirror, drawStickerBorder);
      return { tracked: false, rollDeg: 0, yawNorm: 0, mouthOpen: 0 };
    }

    return this.renderCutoutFromLandmarks(
      video,
      vw,
      vh,
      this.latestLandmarks,
      mirror,
      drawStickerBorder,
      0.42
    );
  }

  /**
   * Однократно вырезает точный контур лица со статичного селфи / фото коллеги!
   */
  public async renderStaticImage(
    img: HTMLImageElement,
    drawStickerBorder = true
  ): Promise<TrackedFacePose> {
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    const c = this.ctx;
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (iw <= 2 || ih <= 2) {
      return { tracked: false, rollDeg: 0, yawNorm: 0, mouthOpen: 0 };
    }

    const lm = await getImageFaceLandmarker();
    if (lm) {
      try {
        const res = lm.detect(img);
        if (res.faceLandmarks && res.faceLandmarks.length > 0) {
          this.resetSmoothing();
          return this.renderCutoutFromLandmarks(
            img,
            iw,
            ih,
            res.faceLandmarks[0],
            false,
            drawStickerBorder,
            1.0
          );
        }
      } catch {
        // fallback below
      }
    }

    this.drawFallbackOval(img, iw, ih, false, drawStickerBorder);
    return { tracked: false, rollDeg: 0, yawNorm: 0, mouthOpen: 0 };
  }

  private renderCutoutFromLandmarks(
    source: HTMLVideoElement | HTMLImageElement,
    sw: number,
    sh: number,
    lm: NormalizedLandmark[],
    mirror: boolean,
    drawStickerBorder: boolean,
    alpha: number
  ): TrackedFacePose {
    const W = this.canvas.width;
    const H = this.canvas.height;
    const c = this.ctx;

    // 1. Вычисляем габариты лица в пикселях исходного кадра
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const idx of FACE_OVAL_RING) {
      const p = lm[idx];
      const px = (mirror ? 1 - p.x : p.x) * sw;
      const py = p.y * sh;
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    }

    const faceW = Math.max(24, maxX - minX);
    const faceH = Math.max(28, maxY - minY);
    const rawCx = (minX + maxX) / 2;
    const rawCy = (minY + maxY) / 2 - faceH * 0.04; // чуть выше центра из-за прибавки лба/волос

    // Масштабируем так, чтобы вырезанное лицо идеально заполняло 80% высоты холста 240×280!
    const targetScale = Math.min((W * 0.78) / faceW, (H * 0.78) / faceH);

    if (!this.smoothedCenter) {
      this.smoothedCenter = { x: rawCx, y: rawCy };
      this.smoothedScale = targetScale;
    } else {
      this.smoothedCenter.x += (rawCx - this.smoothedCenter.x) * alpha;
      this.smoothedCenter.y += (rawCy - this.smoothedCenter.y) * alpha;
      this.smoothedScale += (targetScale - this.smoothedScale) * alpha;
    }

    const cx = this.smoothedCenter.x;
    const cy = this.smoothedCenter.y;
    const sc = this.smoothedScale;

    // 2. Переводим 36 точек анатомического контура лица в координаты выходного холста
    const canvasPts = FACE_OVAL_RING.map((idx) => {
      const p = lm[idx];
      const srcX = (mirror ? 1 - p.x : p.x) * sw;
      let srcY = p.y * sh;
      // Слегка расширяем верхнюю дугу лба, чтобы захватить причёску/брови естественно
      if (FOREHEAD_INDICES.has(idx)) {
        srcY -= faceH * 0.13;
      }
      // Лёгкий припуск наружу (+4%), чтобы линия реза шла ровно по краю скул и подбородка
      const dx = (srcX - cx) * 1.045;
      const dy = (srcY - cy) * 1.035;
      return {
        x: W / 2 + dx * sc,
        y: H / 2 + dy * sc,
      };
    });

    if (!this.smoothedPts || this.smoothedPts.length !== canvasPts.length) {
      this.smoothedPts = canvasPts;
    } else {
      for (let i = 0; i < canvasPts.length; i++) {
        this.smoothedPts[i].x += (canvasPts[i].x - this.smoothedPts[i].x) * alpha;
        this.smoothedPts[i].y += (canvasPts[i].y - this.smoothedPts[i].y) * alpha;
      }
    }

    // 3. Считаем живой наклон головы (roll по уголкам глаз 33 и 263), поворот носа и открытие рта!
    const eyeA = lm[33];
    const eyeB = lm[263];
    const ax = (mirror ? 1 - eyeA.x : eyeA.x) * sw;
    const ay = eyeA.y * sh;
    const bx = (mirror ? 1 - eyeB.x : eyeB.x) * sw;
    const by = eyeB.y * sh;
    const leftEye = ax < bx ? { x: ax, y: ay } : { x: bx, y: by };
    const rightEye = ax < bx ? { x: bx, y: by } : { x: ax, y: ay };

    const rawRollDeg = Math.max(
      -26,
      Math.min(26, (Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) * 180) / Math.PI)
    );
    const noseX = (mirror ? 1 - lm[1].x : lm[1].x) * sw;
    const rawYaw = Math.max(-1, Math.min(1, (noseX - rawCx) / (faceW * 0.35)));
    const lipDist = Math.hypot((lm[13].x - lm[14].x) * sw, (lm[13].y - lm[14].y) * sh);
    const rawMouth = Math.max(0, Math.min(1, (lipDist / faceH - 0.02) * 5.5));

    this.smoothedRoll += (rawRollDeg - this.smoothedRoll) * alpha;
    this.smoothedYaw += (rawYaw - this.smoothedYaw) * alpha;
    this.smoothedMouth += (rawMouth - this.smoothedMouth) * alpha;

    // 4. Вырезаем ТОЛЬКО лицо по сглаженному 36-точечному контуру!
    c.save();
    traceSmoothClosedPolygon(c, this.smoothedPts);
    c.clip();

    if (mirror) {
      c.translate(W / 2, H / 2);
      c.scale(-sc, sc);
      c.drawImage(source, -(sw - cx), -cy, sw, sh);
    } else {
      c.translate(W / 2, H / 2);
      c.scale(sc, sc);
      c.drawImage(source, -cx, -cy, sw, sh);
    }
    c.restore();

    // 5. Рисуем живую бумажную обводку-аппликацию точно по вашему подбородку и щекам!
    if (drawStickerBorder) {
      c.save();
      traceSmoothClosedPolygon(c, this.smoothedPts);
      c.strokeStyle = '#F4EFE4';
      c.lineWidth = 10;
      c.lineJoin = 'round';
      c.stroke();

      c.strokeStyle = '#181614';
      c.lineWidth = 3.5;
      c.stroke();
      c.restore();
    }

    return {
      tracked: true,
      rollDeg: this.smoothedRoll,
      yawNorm: this.smoothedYaw,
      mouthOpen: this.smoothedMouth,
    };
  }

  private drawFallbackOval(
    source: HTMLVideoElement | HTMLImageElement,
    sw: number,
    sh: number,
    mirror: boolean,
    drawStickerBorder: boolean
  ) {
    const W = this.canvas.width;
    const H = this.canvas.height;
    const c = this.ctx;
    const rx = W * 0.36;
    const ry = H * 0.37;
    const scale = Math.max((rx * 2.3) / sw, (ry * 2.3) / sh);

    c.save();
    c.beginPath();
    c.ellipse(W / 2, H / 2, rx, ry, 0, 0, Math.PI * 2);
    c.clip();
    if (mirror) {
      c.translate(W / 2, H / 2);
      c.scale(-scale, scale);
      c.drawImage(source, -sw / 2, -sh / 2);
    } else {
      c.translate(W / 2, H / 2);
      c.scale(scale, scale);
      c.drawImage(source, -sw / 2, -sh / 2);
    }
    c.restore();

    if (drawStickerBorder) {
      c.save();
      c.beginPath();
      c.ellipse(W / 2, H / 2, rx, ry, 0, 0, Math.PI * 2);
      c.strokeStyle = '#F4EFE4';
      c.lineWidth = 6;
      c.stroke();
      c.strokeStyle = '#181614';
      c.lineWidth = 2.2;
      c.stroke();
      c.restore();
    }
  }
}
