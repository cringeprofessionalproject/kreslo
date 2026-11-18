import { useEffect, useRef, useState } from 'react';
import { sfxCoffeeSave, sfxVictory, vibrate } from '../audio';
import {
  getVideoFaceLandmarker,
  LiveFaceCutoutTracker,
  type TrackedFacePose,
} from '../game/faceTrackerEngine';
import {
  shareRecordedReelToGallery,
  type RecordedReelResult,
} from '../game/reelVideoRecorder';
import type { JobPack } from '../types';
import { IconShare } from './Icons';
import { useSheetPullToDismiss } from './useNativeGestures';

/**
 * Хук живого 478-точечного ИИ-трекинга лица:
 * выдаёт флаг `faceLocked = true` ТОЛЬКО после устойчивого захвата лица нейросетью,
 * чтобы запись видео начиналась ровно с кадра, где ваше лицо уже сидит на герое.
 */
export function useLiveFaceTracker(
  active: boolean,
  stream: MediaStream | null,
  customPhotoUrl: string | null
) {
  const hiddenVideoRef = useRef<HTMLVideoElement | null>(null);
  const trackerRef = useRef<LiveFaceCutoutTracker | null>(null);
  const lockStreakRef = useRef(0);

  const [pose, setPose] = useState<TrackedFacePose>({
    tracked: false,
    rollDeg: 0,
    yawNorm: 0,
    mouthOpen: 0,
  });
  const [faceLocked, setFaceLocked] = useState(false);

  if (!trackerRef.current && typeof document !== 'undefined') {
    trackerRef.current = new LiveFaceCutoutTracker();
  }

  useEffect(() => {
    if (!active) {
      setFaceLocked(false);
      lockStreakRef.current = 0;
    }
  }, [active]);

  useEffect(() => {
    if (!active || !stream) return;

    let cancelled = false;
    let rafId = 0;
    lockStreakRef.current = 0;
    setFaceLocked(false);

    const video = document.createElement('video');
    video.playsInline = true;
    video.muted = true;
    video.autoplay = true;
    video.srcObject = stream;
    hiddenVideoRef.current = video;
    void video.play().catch(() => {});

    let landmarkerInstance: Awaited<ReturnType<typeof getVideoFaceLandmarker>> = null;
    getVideoFaceLandmarker().then((lm) => {
      if (!cancelled) {
        landmarkerInstance = lm;
      }
    });

    const tracker = trackerRef.current!;
    tracker.resetSmoothing();

    let frameIdx = 0;
    const tick = () => {
      if (cancelled) return;
      if (video.readyState >= 2) {
        const nextPose = tracker.renderVideoFrame(video, landmarkerInstance, true, true);
        if (nextPose.tracked) {
          lockStreakRef.current += 1;
          if (lockStreakRef.current === 4) {
            vibrate(10);
            setFaceLocked(true);
          }
        }
        frameIdx += 1;
        if (frameIdx % 3 === 0) {
          setPose(nextPose);
        }
      }
      rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafId);
      video.srcObject = null;
      hiddenVideoRef.current = null;
    };
  }, [active, stream]);

  useEffect(() => {
    if (!active || stream || !customPhotoUrl) return;
    let cancelled = false;
    const img = new Image();
    img.onload = async () => {
      if (cancelled || !trackerRef.current) return;
      const p = await trackerRef.current.renderStaticImage(img, true);
      if (!cancelled) {
        setPose(p);
        setFaceLocked(true);
      }
    };
    img.src = customPhotoUrl;
    return () => {
      cancelled = true;
    };
  }, [active, customPhotoUrl, stream]);

  return {
    cutoutCanvas: trackerRef.current?.canvas ?? null,
    rawVideoEl: hiddenVideoRef.current,
    pose,
    faceLocked,
  };
}

// ───────── ЕДИНЫЙ НЕПРЕРЫВНЫЙ СЛОЙ ЖИВОГО ЛИЦА + APPLE HUD НАСТРОЙКИ ВИДЕО ─────────
// Живёт ПОВЕРХ стопки карточек (вне .dilemma-card), поэтому захват, отмагничивание,
// перемещение и масштабирование лица НИКОГДА не дёргают карточку ни на миллиметр!

export interface CardLiveMotionState {
  dx: number;
  dy: number;
  rotDeg: number;
}

interface InteractiveFaceStageLayerProps {
  stageRef: React.RefObject<HTMLElement | null>;
  portraitAreaRef: React.RefObject<HTMLElement | null>;
  cardMotionRef: React.RefObject<CardLiveMotionState>;
  faceBusyRef: React.MutableRefObject<boolean>;
  hasMedia: boolean;
  cutoutCanvas: HTMLCanvasElement | null;
  pose: TrackedFacePose;
  magnetized: boolean;
  freeXNorm: number;
  freeYNorm: number;
  scale: number;
  tuneHudOpen: boolean;
  onToggleTuneHud: (open: boolean) => void;
  onChangeMagnetized: (nextMag: boolean) => void;
  onChangeFreePos: (nx: number, ny: number) => void;
  onChangeScale: (nextScale: number) => void;
  onPickSelfie: () => void;
}

export function InteractiveFaceStageLayer({
  stageRef,
  portraitAreaRef,
  cardMotionRef,
  faceBusyRef,
  hasMedia,
  cutoutCanvas,
  pose,
  magnetized,
  freeXNorm,
  freeYNorm,
  scale,
  tuneHudOpen,
  onToggleTuneHud,
  onChangeMagnetized,
  onChangeFreePos,
  onChangeScale,
  onPickSelfie,
}: InteractiveFaceStageLayerProps) {
  const faceWrapRef = useRef<HTMLDivElement | null>(null);
  const haloRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [isManipulating, setIsManipulating] = useState(false);
  const [nearSnapHalo, setNearSnapHalo] = useState(false);

  // Живые ref-зеркала для 120Hz rAF без лишних ререндеров
  const stateMirrorRef = useRef({
    magnetized,
    freeXNorm,
    freeYNorm,
    scale,
    pose,
    hasMedia,
  });
  stateMirrorRef.current = {
    magnetized,
    freeXNorm,
    freeYNorm,
    scale,
    pose,
    hasMedia,
  };

  // Текущие экранные координаты центра лица внутри .card-stage
  const renderedPosRef = useRef<{ x: number; y: number }>({ x: 180, y: 150 });

  // Мультитач-карта активных пальцев на лице (для 1-пальцевого перетаскивания и 2-пальцевого pinch-zoom без рывков!)
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const dragBaselineRef = useRef<{
    ptrX: number;
    ptrY: number;
    faceX: number;
    faceY: number;
    movedMax: number;
  } | null>(null);
  const pinchBaselineRef = useRef<{
    dist: number;
    startScale: number;
    midX: number;
    midY: number;
    faceX: number;
    faceY: number;
  } | null>(null);
  const nearSnapRef = useRef(false);
  const lastTapTimeRef = useRef(0);

  // Главный 60/120fps цикл отрисовки лица и его точной привязки к воротнику героя или свободной точке
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const wrap = faceWrapRef.current;
      const stage = stageRef.current;
      const st = stateMirrorRef.current;

      if (st.hasMedia && cutoutCanvas && canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          ctx.drawImage(cutoutCanvas, 0, 0, canvasRef.current.width, canvasRef.current.height);
        }
      }

      if (wrap && stage) {
        const sr = stage.getBoundingClientRect();
        const pr = portraitAreaRef.current?.getBoundingClientRect() ?? null;
        const motion = cardMotionRef.current ?? { dx: 0, dy: 0, rotDeg: 0 };

        // Координаты воротника персонажа внутри .card-stage
        const collarX = pr ? pr.left - sr.left + pr.width * 0.5 : sr.width * 0.5;
        const collarY = pr ? pr.top - sr.top + pr.height * 0.43 : sr.height * 0.34;

        if (haloRef.current) {
          haloRef.current.style.transform = `translate3d(${collarX.toFixed(1)}px, ${collarY.toFixed(
            1
          )}px, 0) translate(-50%, -50%)`;
        }

        let targetX: number;
        let targetY: number;
        let targetRot: number;

        if (st.magnetized) {
          const yawPx = st.pose.yawNorm * 5;
          targetX = collarX + yawPx;
          targetY = collarY;
          targetRot = Math.max(-24, Math.min(24, motion.rotDeg + st.pose.rollDeg * 0.28));
        } else {
          targetX = st.freeXNorm * sr.width;
          targetY = st.freeYNorm * sr.height;
          targetRot = st.pose.rollDeg * 0.25;
        }

        renderedPosRef.current = { x: targetX, y: targetY };

        const liveScale =
          st.scale *
          (1 +
            st.pose.mouthOpen * 0.08 +
            (st.magnetized ? Math.min(0.06, Math.abs(motion.dx) * 0.0008) : 0));

        wrap.style.transform = `translate3d(${targetX.toFixed(1)}px, ${targetY.toFixed(
          1
        )}px, 0) translate(-50%, -50%) rotate(${targetRot.toFixed(1)}deg) scale(${liveScale.toFixed(
          3
        )})`;
      }

      raf = window.requestAnimationFrame(loop);
    };

    raf = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(raf);
  }, [cardMotionRef, cutoutCanvas, portraitAreaRef, stageRef]);

  const computeCollarStageCoords = () => {
    const stage = stageRef.current;
    const portrait = portraitAreaRef.current;
    if (!stage) return { sr: null, collarX: 0, collarY: 0 };
    const sr = stage.getBoundingClientRect();
    const pr = portrait?.getBoundingClientRect();
    const collarX = pr ? pr.left - sr.left + pr.width * 0.5 : sr.width * 0.5;
    const collarY = pr ? pr.top - sr.top + pr.height * 0.43 : sr.height * 0.34;
    return { sr, collarX, collarY };
  };

  const syncPinchBaseline = () => {
    const pts = Array.from(activePointersRef.current.values());
    if (pts.length >= 2) {
      const d = Math.max(24, Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y));
      const midX = (pts[0].x + pts[1].x) * 0.5;
      const midY = (pts[0].y + pts[1].y) * 0.5;
      pinchBaselineRef.current = {
        dist: d,
        startScale: stateMirrorRef.current.scale,
        midX,
        midY,
        faceX: renderedPosRef.current.x,
        faceY: renderedPosRef.current.y,
      };
      dragBaselineRef.current = null;
    } else if (pts.length === 1) {
      pinchBaselineRef.current = null;
      dragBaselineRef.current = {
        ptrX: pts[0].x,
        ptrY: pts[0].y,
        faceX: renderedPosRef.current.x,
        faceY: renderedPosRef.current.y,
        movedMax: 20, // чтобы отпускание второго пальца не считалось тапом
      };
    } else {
      pinchBaselineRef.current = null;
      dragBaselineRef.current = null;
    }
  };

  const onFacePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    faceBusyRef.current = true;

    if (!hasMedia) {
      onPickSelfie();
      window.setTimeout(() => {
        faceBusyRef.current = false;
      }, 120);
      return;
    }

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setIsManipulating(true);

    if (activePointersRef.current.size === 1) {
      dragBaselineRef.current = {
        ptrX: e.clientX,
        ptrY: e.clientY,
        faceX: renderedPosRef.current.x,
        faceY: renderedPosRef.current.y,
        movedMax: 0,
      };
      pinchBaselineRef.current = null;
    } else if (activePointersRef.current.size >= 2) {
      syncPinchBaseline();
    }
  };

  const onFacePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!activePointersRef.current.has(e.pointerId)) return;
    e.stopPropagation();
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const { sr, collarX, collarY } = computeCollarStageCoords();
    if (!sr) return;

    // РЕЖИМ 2 ПАЛЬЦЕВ: плавный Pinch-to-Zoom + мягкий сдвиг центра без единого скачка!
    if (activePointersRef.current.size >= 2 && pinchBaselineRef.current) {
      const pts = Array.from(activePointersRef.current.values());
      const curDist = Math.max(20, Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y));
      const ratio = curDist / pinchBaselineRef.current.dist;
      const nextScale = Math.max(
        0.75,
        Math.min(2.35, pinchBaselineRef.current.startScale * ratio)
      );
      onChangeScale(nextScale);

      if (!stateMirrorRef.current.magnetized) {
        const curMidX = (pts[0].x + pts[1].x) * 0.5;
        const curMidY = (pts[0].y + pts[1].y) * 0.5;
        const nextX = pinchBaselineRef.current.faceX + (curMidX - pinchBaselineRef.current.midX);
        const nextY = pinchBaselineRef.current.faceY + (curMidY - pinchBaselineRef.current.midY);
        const nx = Math.max(0.12, Math.min(0.88, nextX / Math.max(1, sr.width)));
        const ny = Math.max(0.1, Math.min(0.92, nextY / Math.max(1, sr.height)));
        onChangeFreePos(nx, ny);
      }
      return;
    }

    // РЕЖИМ 1 ПАЛЬЦА: захват, мгновенное отмагничивание без обрыва жеста и свободный перенос
    if (activePointersRef.current.size === 1 && dragBaselineRef.current) {
      const dx = e.clientX - dragBaselineRef.current.ptrX;
      const dy = e.clientY - dragBaselineRef.current.ptrY;
      const dist = Math.hypot(dx, dy);
      if (dist > dragBaselineRef.current.movedMax) {
        dragBaselineRef.current.movedMax = dist;
      }

      const rawTargetX = dragBaselineRef.current.faceX + dx;
      const rawTargetY = dragBaselineRef.current.faceY + dy;

      if (stateMirrorRef.current.magnetized) {
        // Как только потянули лицо дальше 15px от воротника — плавно отмагничиваем прямо под пальцем!
        if (dist > 15) {
          vibrate(10);
          const nx = Math.max(0.12, Math.min(0.88, rawTargetX / Math.max(1, sr.width)));
          const ny = Math.max(0.1, Math.min(0.92, rawTargetY / Math.max(1, sr.height)));
          onChangeFreePos(nx, ny);
          onChangeMagnetized(false);
        }
      } else {
        const nx = Math.max(0.12, Math.min(0.88, rawTargetX / Math.max(1, sr.width)));
        const ny = Math.max(0.1, Math.min(0.92, rawTargetY / Math.max(1, sr.height)));
        onChangeFreePos(nx, ny);

        const distToCollar = Math.hypot(rawTargetX - collarX, rawTargetY - collarY);
        const isNear = distToCollar < 66;
        if (isNear !== nearSnapRef.current) {
          nearSnapRef.current = isNear;
          setNearSnapHalo(isNear);
          if (isNear) vibrate(8);
        }
      }
    }
  };

  const onFacePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!activePointersRef.current.has(e.pointerId)) return;
    e.stopPropagation();

    const movedMax = dragBaselineRef.current?.movedMax ?? 99;
    activePointersRef.current.delete(e.pointerId);

    if (activePointersRef.current.size > 0) {
      syncPinchBaseline();
      return;
    }

    setIsManipulating(false);

    // Если поднесли свободное лицо к воротнику и отпустили — примагничиваем!
    if (!stateMirrorRef.current.magnetized && nearSnapRef.current) {
      nearSnapRef.current = false;
      setNearSnapHalo(false);
      vibrate(14);
      onChangeMagnetized(true);
    } else if (movedMax < 8) {
      // Короткий тап по лицу: двойной тап меняет масштаб, одиночный открывает удобную плашку настройки!
      const now = performance.now();
      if (now - lastTapTimeRef.current < 280) {
        vibrate(8);
        const next = scale < 1.25 ? 1.48 : scale < 1.72 ? 1.85 : 1.0;
        onChangeScale(next);
        lastTapTimeRef.current = 0;
      } else {
        lastTapTimeRef.current = now;
        onToggleTuneHud(!tuneHudOpen);
      }
    }

    dragBaselineRef.current = null;
    pinchBaselineRef.current = null;
    window.setTimeout(() => {
      faceBusyRef.current = false;
    }, 60);
  };

  return (
    <>
      {/* Золотой магнитный ореол на воротнике при поднесении свободного лица */}
      <div
        ref={haloRef}
        className={`stage-magnetic-halo ${nearSnapHalo ? 'visible' : ''}`}
      />

      {/* Единый интерактивный слой лица (никогда не размонтируется между режимами!) */}
      <div
        ref={faceWrapRef}
        data-face-control="true"
        className={`stage-tracked-face ${!hasMedia ? 'is-empty' : ''} ${
          isManipulating ? 'is-manipulating' : ''
        } ${tuneHudOpen ? 'hud-focused' : ''}`}
        onPointerDown={onFacePointerDown}
        onPointerMove={onFacePointerMove}
        onPointerUp={onFacePointerEnd}
        onPointerCancel={onFacePointerEnd}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        onWheel={(e) => {
          e.stopPropagation();
          if (!hasMedia) return;
          const next = Math.max(0.75, Math.min(2.35, scale - e.deltaY * 0.0015));
          onChangeScale(next);
        }}
      >
        {hasMedia ? (
          <canvas ref={canvasRef} width={360} height={420} className="tracked-head-canvas" />
        ) : (
          <div className="face-cutout-placeholder">
            <span>+ Лицо</span>
          </div>
        )}
      </div>

      {/* Компактная плашка настройки видео и лица в стиле Apple Camera HUD */}
      {tuneHudOpen && hasMedia && (
        <div
          data-face-control="true"
          className="apple-face-tune-hud"
          onPointerDown={(e) => {
            e.stopPropagation();
            faceBusyRef.current = true;
          }}
          onPointerUp={(e) => {
            e.stopPropagation();
            window.setTimeout(() => {
              faceBusyRef.current = false;
            }, 60);
          }}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <div className="afth-top-row">
            <div className="afth-seg">
              <button
                type="button"
                className={magnetized ? 'on' : ''}
                onClick={() => {
                  vibrate(8);
                  onChangeMagnetized(true);
                }}
              >
                На герое
              </button>
              <button
                type="button"
                className={!magnetized ? 'on' : ''}
                onClick={() => {
                  vibrate(8);
                  onChangeFreePos(0.5, 0.82);
                  onChangeMagnetized(false);
                  onChangeScale(Math.max(1.22, scale));
                }}
              >
                Свободно внизу
              </button>
            </div>

            <button
              type="button"
              className="afth-done-btn"
              onClick={() => onToggleTuneHud(false)}
            >
              Готово
            </button>
          </div>

          <div className="afth-slider-row">
            <button
              type="button"
              className="afth-step-btn"
              onClick={() => onChangeScale(Math.max(0.75, +(scale - 0.14).toFixed(2)))}
              aria-label="Уменьшить лицо"
            >
              −
            </button>
            <input
              type="range"
              min={75}
              max={230}
              value={Math.round(scale * 100)}
              onChange={(e) => onChangeScale(Number(e.target.value) / 100)}
              className="afth-range"
            />
            <button
              type="button"
              className="afth-step-btn"
              onClick={() => onChangeScale(Math.min(2.3, +(scale + 0.14).toFixed(2)))}
              aria-label="Увеличить лицо"
            >
              +
            </button>
            <span className="afth-pct">{Math.round(scale * 100)}%</span>
          </div>
        </div>
      )}
    </>
  );
}

// ───────── ШТОРКА ГОТОВОГО ВИДЕО ПРОХОЖДЕНИЯ (С ЖЕСТОМ СМАХИВАНИЯ ВНИЗ) ─────────

interface ReelReadyShareModalProps {
  pack: JobPack;
  reel: RecordedReelResult;
  masteryPct: number;
  weeksSurvived: number;
  onShared: () => void;
  onClose: () => void;
}

export function ReelReadyShareModal({
  pack,
  reel,
  masteryPct,
  weeksSurvived,
  onShared,
  onClose,
}: ReelReadyShareModalProps) {
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const { sheetProps, backdropStyle } = useSheetPullToDismiss(onClose);

  const captionText = `Моё прохождение «${pack.shortTitle}» · Опыт: ${masteryPct}% (${weeksSurvived}/36 смен) → ${window.location.href}`;

  const downloadVideoDirect = () => {
    sfxVictory();
    const fileName = `kreslo-${pack.id}-${weeksSurvived}smen.${reel.extension}`;
    const a = document.createElement('a');
    a.href = reel.url;
    a.download = fileName;
    a.click();
    onShared();
    setStatusMsg(`Файл .${reel.extension} загружен`);
  };

  const shareOrDownloadVideo = async () => {
    // КРИТИЧНО: вызываем navigator.share первой строкой (до аудио и любых эффектов),
    // чтобы Safari сохранил Transient User Activation и показал «Сохранить видео» в Фото!
    const outcome = await shareRecordedReelToGallery(reel);
    if (outcome === 'shared') {
      sfxVictory();
      onShared();
      setStatusMsg('Видео сохранено / отправлено');
      return;
    }
    if (outcome === 'aborted') {
      return;
    }

    const isIosDevice =
      typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isIosDevice) {
      setStatusMsg(
        'Встроенный браузер ограничил доступ к Фото — откройте сайт в Safari или нажмите «Скачать файл»'
      );
      return;
    }

    downloadVideoDirect();
  };

  return (
    <div
      className="overlay-backdrop reel-share-backdrop"
      style={backdropStyle}
      onClick={onClose}
    >
      <div
        className="paywall-sheet native-ios-sheet"
        {...sheetProps}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-grabber-bar" />

        <div className="reel-video-preview-box">
          <video
            src={reel.url}
            controls
            autoPlay
            loop
            playsInline
            className="reel-video-player"
          />
        </div>

        <button
          type="button"
          className="cta-btn primary big icon-inline-btn"
          onClick={shareOrDownloadVideo}
        >
          <IconShare size={18} />
          <span>Сохранить видео в галерею · {reel.durationSec} сек</span>
        </button>

        <div className="two-col-btns single">
          <button
            type="button"
            className="cta-btn subtle"
            onClick={async () => {
              sfxCoffeeSave();
              await navigator.clipboard.writeText(captionText);
              setStatusMsg('Ссылка скопирована');
            }}
          >
            Скопировать ссылку на игру
          </button>
        </div>

        {statusMsg && <div className="saved-toast">{statusMsg}</div>}
      </div>
    </div>
  );
}
