import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getSoundProfile, setSoundProfile, sfxUiTap, sfxVictory, vibrate } from '../audio';
import { DIRECT_PLAY_SLUGS } from '../game/packs';
import {
  shareRecordedReelToGallery,
  type RecordedReelResult,
} from '../game/reelVideoRecorder';
import {
  buildConversationalCaseBody,
  buildConversationalCaseLead,
  buildFallbackSwipesFromPack,
  buildMontageMasterAudioBuffer,
  computeTimelineSpans,
  exportMontageProjectToMp4,
  getAllRealCasesInPack,
  mapDramaticVideoProgress,
  pickBestRealCaseForHighlight,
  renderMontageFrameAtTime,
  type CaptionVisualStyle,
  type FaceFx,
  type MontageClip,
  type MontageGifOverlay,
  type MontageOverlay,
  type MontageProject,
  type MontageTextOverlay,
  type RunSwipeHighlight,
} from '../game/shortsHighlightBuilder';
import {
  decodeRemoteStickerUrl,
  decodeUploadedStickerMedia,
  searchOnlineGifsIfConfigured,
  searchStickerCatalog,
  type CatalogStickerItem,
  type CustomStickerMedia,
  type ExternalGifResult,
} from '../game/storiesAnimatedGifs';
import { getTelegramBotAppUrl, shareLinkViaTelegramOrNative } from '../game/telegramStars';
import type { EndingDef, JobPack, RealHistoricalCase, Stats } from '../types';
import { EditorialCardPortrait } from './CharacterArt';

type StoriesFeedMode = 'smart_highlight' | 'raw_playthrough';

interface ShortsCombainModalProps {
  pack: JobPack;
  ending: EndingDef;
  finalStats?: Stats;
  weeksSurvived: number;
  swipes: RunSwipeHighlight[];
  recordedReel?: RecordedReelResult | null;
  faceSnapshotUrl?: string | null;
  liveFaceSource?: HTMLCanvasElement | HTMLVideoElement | HTMLImageElement | null;
  hasLiveFace?: boolean;
  onRequestEnableFace?: () => void;
  onClose: () => void;
}

const TEXT_COLORS = ['#ffffff', '#f4efe4', '#ffd166', '#5ed4a8', '#ff6b57'] as const;
const TEXT_STYLES: CaptionVisualStyle[] = ['stories_dark', 'kinetic_bold', 'paper', 'accent_tag'];

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function fmtSec(s: number): string {
  const sec = Math.max(0, Math.round(s));
  const m = Math.floor(sec / 60);
  const r = sec % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

export function ShortsCombainModal({
  pack,
  ending,
  finalStats,
  weeksSurvived,
  swipes,
  recordedReel,
  faceSnapshotUrl,
  liveFaceSource,
  hasLiveFace,
  onRequestEnableFace,
  onClose,
}: ShortsCombainModalProps) {
  // Пока открыт редактор, фоновая музыка игры выключена — иначе она накладывается на звук видео
  useEffect(() => {
    const prev = getSoundProfile();
    setSoundProfile('off');
    return () => setSoundProfile(prev);
  }, []);

  const allPackCases = useMemo(() => getAllRealCasesInPack(pack), [pack]);
  const usableSwipes = useMemo(
    () => (swipes.length > 0 ? swipes : buildFallbackSwipesFromPack(pack)),
    [pack, swipes]
  );

  // Режим: «Умный хайлайт» (зумы + слоу-мо + как ответили в истории) или чистая «Запись»
  const [feedMode, setFeedMode] = useState<StoriesFeedMode>('smart_highlight');
  const dramaticMode = true;
  const [faceFx, setFaceFx] = useState<FaceFx>('auto');
  const [faceSheetOpen, setFaceSheetOpen] = useState<boolean>(false);
  const [soundMuted, setSoundMuted] = useState<boolean>(false);

  // Кейсы — ТОЛЬКО те, что игрок реально отыграл в этой партии
  const runCaseSwipes = useMemo(
    () => swipes.filter((x) => x.realCase),
    [swipes]
  );
  const runCases = useMemo(() => {
    const seen = new Set<string>();
    const out: RealHistoricalCase[] = [];
    runCaseSwipes.forEach((x) => {
      const rc = x.realCase!;
      const key = `${rc.person}|${rc.year}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push(rc);
      }
    });
    return out;
  }, [runCaseSwipes]);
  const initialCaseBundle = useMemo(() => {
    const last = runCaseSwipes[runCaseSwipes.length - 1];
    return last?.realCase
      ? { realCase: last.realCase, playerMatched: last.matchedRealCase, week: last.week }
      : null;
  }, [runCaseSwipes]);
  const [includeCaseBlock, setIncludeCaseBlock] = useState<boolean>(() =>
    Boolean(initialCaseBundle)
  );
  const [selectedCase, setSelectedCase] = useState<RealHistoricalCase | null>(
    () => initialCaseBundle?.realCase ?? null
  );
  const [caseLeadText, setCaseLeadText] = useState<string>(() =>
    initialCaseBundle
      ? buildConversationalCaseLead(initialCaseBundle.realCase, initialCaseBundle.playerMatched)
      : ''
  );

  // Свободные оверлеи в стиле Instagram / Telegram Stories (по умолчанию экран чистый!)
  const [overlays, setOverlays] = useState<MontageOverlay[]>([]);
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);

  // Экранный ввод текста «Aa» прямо поверх видео (как в Instagram Stories)
  const [textEditorState, setTextEditorState] = useState<{
    open: boolean;
    editingId: string | null;
    text: string;
    style: CaptionVisualStyle;
    color: string;
  }>({
    open: false,
    editingId: null,
    text: '',
    style: 'stories_dark',
    color: '#ffffff',
  });

  // Шторка поиска GIF и анимированных стикеров
  const [gifSheetOpen, setGifSheetOpen] = useState<boolean>(false);
  const [gifQuery, setGifQuery] = useState<string>('');
  const [gifCat, setGifCat] = useState<'all' | 'top' | 'office' | 'emotion' | 'money'>('all');
  const [onlineGifs, setOnlineGifs] = useState<ExternalGifResult[]>([]);
  const [loadingStickerId, setLoadingStickerId] = useState<string | null>(null);

  // Шторка выбора реального кейса («А как на этот вопрос ответил...»)
  const [caseSheetOpen, setCaseSheetOpen] = useState<boolean>(false);

  // Зона корзины при перетаскивании стикера/текста вниз (1:1 Instagram Stories)
  const [isDraggingOverlay, setIsDraggingOverlay] = useState<boolean>(false);
  const [isOverTrash, setIsOverTrash] = useState<boolean>(false);

  // Автоматическая сборка сцен
  const clips = useMemo<MontageClip[]>(() => {
    const list: MontageClip[] = [];

    if (feedMode === 'raw_playthrough' && recordedReel && recordedReel.durationSec > 0.4) {
      list.push({
        id: 'raw_reel',
        kind: 'video',
        label: 'Запись',
        videoUrl: recordedReel.url,
        blob: recordedReel.blob,
        naturalDuration: recordedReel.durationSec,
        trimStart: 0,
        trimEnd: recordedReel.durationSec,
        volume: 1,
        fit: 'cover',
      });
      return list;
    }

    // Умный хайлайт: кульминация игры (живое видео ИЛИ 2 ярких свайпа с лицом) -> ответ из истории -> QR
    if (false as boolean) {
      const dur = recordedReel!.durationSec;
      const start = dur > 7.5 ? Math.max(0, dur - 6.8) : 0;
      list.push({
        id: 'smart_reel',
        kind: 'video',
        label: 'Игра',
        videoUrl: recordedReel!.url,
        blob: recordedReel!.blob,
        naturalDuration: dur,
        trimStart: Number(start.toFixed(1)),
        trimEnd: Number(dur.toFixed(1)),
        volume: 1,
        fit: 'cover',
      });
    } else {
      const hypeIdx = selectedCase
        ? usableSwipes.findIndex((x) => x.realCase?.person === selectedCase.person)
        : -1;
      const picks =
        hypeIdx >= 0
          ? usableSwipes.slice(Math.max(0, hypeIdx - 1), hypeIdx + 1)
          : usableSwipes.slice(-2);
      picks.forEach((sw, idx) => {
        const isLast = idx === picks.length - 1;
        list.push({
          id: `sw_${idx}_${sw.week}`,
          kind: 'swipe',
          swipe: sw,
          // На решающем ходе даём чуть больше воздуха под драматичное слоу-мо и наезд на лицо
          duration: isLast && dramaticMode ? 3.1 : 2.2,
        });
      });
    }

    if (includeCaseBlock && selectedCase) {
      list.push({
        id: 'rc_answer',
        kind: 'real_case',
        realCase: selectedCase,
        playerMatched: usableSwipes.find((x) => x.realCase?.person === selectedCase.person)?.matchedRealCase,
        leadText: caseLeadText || buildConversationalCaseLead(selectedCase),
        bodyText: buildConversationalCaseBody(selectedCase),
        duration: 6.4,
      });
    } else {
      list.push({ id: 'end_card', kind: 'ending', duration: 1.9 });
    }

    list.push({ id: 'qr_end', kind: 'qr', duration: 0.45 });
    return list;
  }, [
    caseLeadText,
    dramaticMode,
    feedMode,
    includeCaseBlock,
    recordedReel,
    selectedCase,
    usableSwipes,
  ]);

  const { spans, totalDuration } = useMemo(() => computeTimelineSpans(clips), [clips]);

  const [trimStartSec, setTrimStartSec] = useState<number>(0);
  const [trimEndSec, setTrimEndSec] = useState<number>(totalDuration);

  useEffect(() => {
    setTrimStartSec(0);
    setTrimEndSec(Number(totalDuration.toFixed(2)));
    playheadRef.current = 0;
    setPlayheadSec(0);
  }, [totalDuration, feedMode, includeCaseBlock]);

  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [playheadSec, setPlayheadSec] = useState<number>(0);
  const [exportState, setExportState] = useState<{ pct: number; label: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const stageWrapRef = useRef<HTMLDivElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const filmstripRef = useRef<HTMLDivElement | null>(null);
  const hiddenPortraitsRef = useRef<HTMLDivElement | null>(null);
  const textInputRef = useRef<HTMLTextAreaElement | null>(null);
  const gifFileInputRef = useRef<HTMLInputElement | null>(null);

  const portraitImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const swipeFaceImagesRef = useRef<Map<number, HTMLImageElement>>(new Map());
  const faceImgRef = useRef<HTMLImageElement | null>(null);
  const videoElsRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const customStickersRef = useRef<Map<string, CustomStickerMedia>>(new Map());

  const playheadRef = useRef<number>(0);
  playheadRef.current = playheadSec;

  const audioPreviewCtxRef = useRef<AudioContext | null>(null);
  const audioPreviewSrcRef = useRef<AudioBufferSourceNode | null>(null);

  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{
    dist: number;
    angle: number;
    scale: number;
    rot: number;
    id: string;
  } | null>(null);

  const dragOverlayRef = useRef<{
    overlayId: string;
    pointerId: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    moved: boolean;
    tapTime: number;
  } | null>(null);

  const timelineDragRef = useRef<{
    mode: 'scrub' | 'trim_start' | 'trim_end';
    pointerId: number;
  } | null>(null);

  const showQuickToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => {
      setToast((cur) => (cur === msg ? null : cur));
    }, 2200);
  }, []);

  const project = useMemo<MontageProject>(
    () => ({
      pack,
      ending,
      finalStats,
      weeksSurvived,
      clips,
      overlays,
      soundtrack: soundMuted ? 'mute' : feedMode === 'raw_playthrough' ? 'sfx_only' : 'groove',
      dramaticMode: feedMode === 'smart_highlight' && dramaticMode,
      faceFx: feedMode === 'smart_highlight' ? faceFx : 'none',
      faceSnapshotUrl,
    }),
    [
      clips,
      dramaticMode,
      faceFx,
      ending,
      faceSnapshotUrl,
      feedMode,
      finalStats,
      overlays,
      pack,
      recordedReel,
      soundMuted,
      weeksSurvived,
    ]
  );

  // Поиск стикеров в каталоге + опционально GIPHY онлайн
  const filteredCatalogStickers = useMemo(() => {
    const r = searchStickerCatalog(gifQuery, gifCat);
    return r.length > 0 || !gifQuery.trim() ? r : searchStickerCatalog('', 'all');
  }, [gifCat, gifQuery]);

  useEffect(() => {
    if (!gifSheetOpen || gifQuery.trim().length < 2) {
      setOnlineGifs([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void searchOnlineGifsIfConfigured(gifQuery).then((res) => {
        if (!cancelled) setOnlineGifs(res);
      });
    }, 260);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [gifQuery, gifSheetOpen]);

  // Предрендер SVG портретов
  const portraitTargets = useMemo(() => {
    const items: Array<{
      key: string;
      cardId: string;
      speaker: string;
      blockNum: number;
      hideFace: boolean;
    }> = [];
    const seen = new Set<string>();
    const add = (
      key: string,
      cardId: string,
      speaker: string,
      blockNum: number,
      hideFace: boolean
    ) => {
      if (seen.has(key)) return;
      seen.add(key);
      items.push({ key, cardId, speaker, blockNum, hideFace });
    };

    usableSwipes.forEach((sw) => {
      const cid = sw.cardId ?? sw.speaker;
      add(`card_${cid}`, cid, sw.speaker, sw.blockNum ?? 2, false);
      add(`card_headless_${cid}`, cid, sw.speaker, sw.blockNum ?? 2, true);
    });
    allPackCases.forEach((rc) => {
      add(`rc_${rc.person}`, `rc_${rc.person}`, rc.person, 3, false);
    });
    add(`ending_${ending.id}`, ending.id, ending.title, 3, false);
    add(`ending_headless_${ending.id}`, ending.id, ending.title, 3, true);
    return items;
  }, [allPackCases, ending.id, ending.title, usableSwipes]);

  useEffect(() => {
    const root = hiddenPortraitsRef.current;
    if (!root) return;
    root.querySelectorAll('[data-portrait-key]').forEach((node) => {
      const key = node.getAttribute('data-portrait-key');
      if (!key || portraitImagesRef.current.has(key)) return;
      const svgEl = node.querySelector('svg');
      if (!svgEl) return;
      try {
        const xml = new XMLSerializer().serializeToString(svgEl);
        const im = new Image();
        im.onload = () => {
          portraitImagesRef.current.set(key, im);
        };
        im.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
      } catch {
        // ignore
      }
    });
  }, [portraitTargets]);

  useEffect(() => {
    if (!faceSnapshotUrl) {
      faceImgRef.current = null;
    } else {
      const im = new Image();
      im.onload = () => {
        faceImgRef.current = im;
      };
      im.src = faceSnapshotUrl;
    }
    usableSwipes.forEach((sw) => {
      if (sw.faceSnapUrl && !swipeFaceImagesRef.current.has(sw.week)) {
        const sim = new Image();
        sim.onload = () => {
          swipeFaceImagesRef.current.set(sw.week, sim);
        };
        sim.src = sw.faceSnapUrl;
      }
    });
  }, [faceSnapshotUrl, usableSwipes]);

  useEffect(() => {
    const activeIds = new Set<string>();
    clips.forEach((cl) => {
      if (cl.kind !== 'video') return;
      activeIds.add(cl.id);
      if (!videoElsRef.current.has(cl.id)) {
        const v = document.createElement('video');
        v.src = cl.videoUrl;
        v.muted = true;
        v.playsInline = true;
        v.preload = 'auto';
        v.load();
        videoElsRef.current.set(cl.id, v);
      }
    });
    videoElsRef.current.forEach((v, id) => {
      if (!activeIds.has(id)) {
        v.pause();
        v.removeAttribute('src');
        videoElsRef.current.delete(id);
      }
    });
  }, [clips]);

  useEffect(() => {
    return () => {
      try {
        audioPreviewSrcRef.current?.stop();
      } catch {
        // ignore
      }
      void audioPreviewCtxRef.current?.close();
      videoElsRef.current.forEach((v) => v.pause());
      customStickersRef.current.forEach((m) => {
        m.videoEl?.pause();
        if (m.objectUrl) URL.revokeObjectURL(m.objectUrl);
      });
    };
  }, []);

  const stopAudioPreview = useCallback(() => {
    try {
      audioPreviewSrcRef.current?.stop();
    } catch {
      // ignore
    }
    audioPreviewSrcRef.current = null;
  }, []);

  useEffect(() => {
    stopAudioPreview();
    if (!isPlaying || exportState || soundMuted || textEditorState.open) return;
    let cancelled = false;
    void buildMontageMasterAudioBuffer(project).then(async (buf) => {
      if (cancelled || !buf) return;
      try {
        if (!audioPreviewCtxRef.current || audioPreviewCtxRef.current.state === 'closed') {
          audioPreviewCtxRef.current = new AudioContext();
        }
        const ctx = audioPreviewCtxRef.current;
        if (ctx.state === 'suspended') await ctx.resume();
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        src.loopStart = Math.max(0, Math.min(buf.duration - 0.2, trimStartSec));
        src.loopEnd = Math.max(src.loopStart + 0.2, Math.min(buf.duration, trimEndSec));
        src.connect(ctx.destination);
        src.start(0, Math.max(src.loopStart, Math.min(src.loopEnd - 0.05, playheadRef.current)));
        audioPreviewSrcRef.current = src;
      } catch {
        // ignore
      }
    });
    return () => {
      cancelled = true;
      stopAudioPreview();
    };
  }, [
    exportState,
    isPlaying,
    project,
    soundMuted,
    stopAudioPreview,
    textEditorState.open,
    trimEndSec,
    trimStartSec,
  ]);

  // Цикл рендера живого полноэкранного холста Stories
  useEffect(() => {
    let raf = 0;
    let lastTs = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - lastTs) / 1000);
      lastTs = now;

      const lo = Math.max(0, Math.min(totalDuration - 0.3, trimStartSec));
      const hi = Math.max(lo + 0.3, Math.min(totalDuration, trimEndSec));

      let curT = playheadRef.current;
      if (isPlaying && !exportState && !timelineDragRef.current) {
        curT += dt;
        if (curT >= hi || curT < lo) curT = lo;
        playheadRef.current = curT;
        setPlayheadSec(curT);
      }

      const curSpan = spans.find((s) => curT >= s.startSec && curT < s.endSec);
      const climaxVidSpan = [...spans]
        .reverse()
        .find((s) => s.clip.kind === 'swipe' || s.clip.kind === 'video');
      const videoFrameMap = new Map<string, CanvasImageSource | null>();
      videoElsRef.current.forEach((vid, id) => {
        if (curSpan && curSpan.clip.kind === 'video' && curSpan.clip.id === id) {
          const u = (curT - curSpan.startSec) / Math.max(0.05, curSpan.duration);
          const isDramaticVid =
            project.dramaticMode !== false &&
            climaxVidSpan?.clip.id === id &&
            curSpan.duration >= 2.2;
          const mapped = isDramaticVid
            ? mapDramaticVideoProgress(u)
            : { progress: u, rate: 1 };
          const targetVidTime = curSpan.clip.trimStart + mapped.progress * curSpan.duration;
          if (isPlaying && !exportState && !timelineDragRef.current) {
            if (Math.abs(vid.playbackRate - mapped.rate) > 0.02) {
              try {
                vid.playbackRate = mapped.rate;
              } catch {
                // ignore
              }
            }
            if (Math.abs(vid.currentTime - targetVidTime) > 0.28) {
              try {
                vid.currentTime = targetVidTime;
              } catch {
                // ignore
              }
            }
            if (vid.paused) void vid.play().catch(() => {});
          } else {
            if (!vid.paused) vid.pause();
            if (Math.abs(vid.currentTime - targetVidTime) > 0.03) {
              try {
                vid.currentTime = targetVidTime;
              } catch {
                // ignore
              }
            }
          }
          videoFrameMap.set(id, vid);
        } else if (!vid.paused) {
          vid.pause();
        }
      });

      const canvas = previewCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          renderMontageFrameAtTime(
            ctx,
            canvas.width,
            canvas.height,
            curT,
            project,
            {
              portraits: portraitImagesRef.current,
              faceImg: faceImgRef.current,
              swipeFaces: swipeFaceImagesRef.current,
              liveFaceSource: liveFaceSource ?? null,
              customStickers: customStickersRef.current,
              videoFrames: videoFrameMap,
            },
            isDraggingOverlay ? null : selectedOverlayId
          );
        }
      }

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [
    exportState,
    isDraggingOverlay,
    isPlaying,
    liveFaceSource,
    project,
    selectedOverlayId,
    spans,
    totalDuration,
    trimEndSec,
    trimStartSec,
  ]);

  // ── ИНТЕРАКТИВ НА ХОЛСТЕ: ТАП ПО ТЕКСТУ, ПЕРЕТАСКИВАНИЕ, УДАЛЕНИЕ В КОРЗИНУ ──
  const onStagePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = previewCanvasRef.current;
    if (!canvas || exportState || textEditorState.open) return;
    const rect = canvas.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;

    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 2 && selectedOverlayId) {
      // Два пальца: масштаб + поворот выбранного объекта (как в Instagram / Telegram)
      const [p1, p2] = [...pointersRef.current.values()];
      const ov = overlays.find((o) => o.id === selectedOverlayId);
      if (ov) {
        pinchRef.current = {
          dist: Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1,
          angle: Math.atan2(p2.y - p1.y, p2.x - p1.x),
          scale: ov.scale,
          rot: ov.rotDeg,
          id: ov.id,
        };
        dragOverlayRef.current = null;
        setIsDraggingOverlay(false);
        setIsOverTrash(false);
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // ignore
        }
        return;
      }
    }
    if (pointersRef.current.size > 1) return;

    const hit = [...overlays].reverse().find((ov) => {
      const rx = ov.kind === 'text' ? 0.34 * ov.scale : 0.15 * ov.scale;
      const ry = ov.kind === 'text' ? 0.065 * ov.scale : 0.1 * ov.scale;
      return Math.abs(nx - ov.x) <= rx && Math.abs(ny - ov.y) <= ry;
    });

    if (hit) {
      sfxUiTap();
      setSelectedOverlayId(hit.id);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      dragOverlayRef.current = {
        overlayId: hit.id,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        origX: hit.x,
        origY: hit.y,
        moved: false,
        tapTime: performance.now(),
      };
    } else {
      setSelectedOverlayId(null);
      setIsPlaying((p) => !p);
    }
  };

  const onStagePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    const pz = pinchRef.current;
    if (pz && pointersRef.current.size >= 2) {
      const [p1, p2] = [...pointersRef.current.values()];
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1;
      const ang = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      const nextScale = Math.max(0.3, Math.min(3.2, (pz.scale * dist) / pz.dist));
      const nextRot = pz.rot + ((ang - pz.angle) * 180) / Math.PI;
      setOverlays((prev) =>
        prev.map((o) =>
          o.id === pz.id
            ? { ...o, scale: Number(nextScale.toFixed(3)), rotDeg: Number(nextRot.toFixed(1)) }
            : o
        )
      );
      return;
    }
    const d = dragOverlayRef.current;
    const canvas = previewCanvasRef.current;
    if (!d || !canvas || d.pointerId !== e.pointerId) return;
    const rect = canvas.getBoundingClientRect();
    const dx = (e.clientX - d.startX) / rect.width;
    const dy = (e.clientY - d.startY) / rect.height;

    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 6) {
      d.moved = true;
      setIsDraggingOverlay(true);
    }
    if (!d.moved) return;

    const nx = Math.max(0.08, Math.min(0.92, d.origX + dx));
    const ny = Math.max(0.08, Math.min(0.93, d.origY + dy));
    const trashHit = ny > 0.83 && Math.abs(nx - 0.5) < 0.16;
    if (trashHit !== isOverTrash) {
      if (trashHit) vibrate(10);
      setIsOverTrash(trashHit);
    }

    setOverlays((prev) => prev.map((o) => (o.id === d.overlayId ? { ...o, x: nx, y: ny } : o)));
  };

  const onStagePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointersRef.current.delete(e.pointerId);
    if (pinchRef.current) {
      if (pointersRef.current.size < 2) {
        pinchRef.current = null;
        dragOverlayRef.current = null;
      }
      return;
    }
    const d = dragOverlayRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    if (d.moved && isOverTrash) {
      sfxUiTap();
      vibrate(14);
      setOverlays((prev) => prev.filter((o) => o.id !== d.overlayId));
      setSelectedOverlayId(null);
    } else if (!d.moved && performance.now() - d.tapTime < 300) {
      // Короткий тап по тексту на экране открывает его прямое редактирование (как в Instagram!)
      const tapped = overlays.find((o) => o.id === d.overlayId);
      if (tapped && tapped.kind === 'text') {
        setTextEditorState({
          open: true,
          editingId: tapped.id,
          text: tapped.text,
          style: tapped.style,
          color: tapped.color || '#ffffff',
        });
        window.setTimeout(() => textInputRef.current?.focus(), 40);
      }
    }

    dragOverlayRef.current = null;
    setIsDraggingOverlay(false);
    setIsOverTrash(false);
  };

  const onStageWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (!selectedOverlayId) return;
    e.preventDefault();
    if (e.shiftKey) {
      const dd = e.deltaY < 0 ? 6 : -6;
      setOverlays((prev) =>
        prev.map((o) => (o.id === selectedOverlayId ? { ...o, rotDeg: o.rotDeg + dd } : o))
      );
      return;
    }
    const factor = e.deltaY < 0 ? 1.06 : 0.94;
    setOverlays((prev) =>
      prev.map((o) =>
        o.id === selectedOverlayId
          ? { ...o, scale: Math.max(0.3, Math.min(3.2, Number((o.scale * factor).toFixed(2)))) }
          : o
      )
    );
  };

  // ── ИНСТРУМЕНТ «Aa» (ПРЯМОЙ ВВОД ТЕКСТА ПОВЕРХ ВИДЕО) ──
  const openTextCreator = () => {
    sfxUiTap();
    setGifSheetOpen(false);
    setCaseSheetOpen(false);
    setTextEditorState({
      open: true,
      editingId: null,
      text: '',
      style: 'stories_dark',
      color: '#ffffff',
    });
    window.setTimeout(() => textInputRef.current?.focus(), 50);
  };

  const commitTextEditor = () => {
    sfxUiTap();
    const trimmed = textEditorState.text.trim();
    if (!trimmed) {
      if (textEditorState.editingId) {
        setOverlays((prev) => prev.filter((o) => o.id !== textEditorState.editingId));
      }
      setTextEditorState((s) => ({ ...s, open: false }));
      return;
    }

    if (textEditorState.editingId) {
      setOverlays((prev) =>
        prev.map((o) =>
          o.id === textEditorState.editingId && o.kind === 'text'
            ? {
                ...o,
                text: trimmed,
                style: textEditorState.style,
                color: textEditorState.color,
              }
            : o
        )
      );
      setSelectedOverlayId(textEditorState.editingId);
    } else {
      const newTxt: MontageTextOverlay = {
        id: makeId('txt'),
        kind: 'text',
        text: trimmed,
        style: textEditorState.style,
        color: textEditorState.color,
        x: 0.5,
        y: 0.16,
        scale: 0.95,
        rotDeg: 0,
        startSec: 0,
        endSec: null,
      };
      setOverlays((prev) => [...prev, newTxt]);
      setSelectedOverlayId(newTxt.id);
    }
    setTextEditorState((s) => ({ ...s, open: false }));
  };

  // ── ДОБАВЛЕНИЕ СТИКЕРОВ И ГИФОК ИЗ ПОИСКА ──
  const handleSelectCatalogSticker = async (item: CatalogStickerItem) => {
    sfxUiTap();
    if (item.kind === 'builtin_vector' && item.builtinId) {
      const ov: MontageGifOverlay = {
        id: makeId('gif'),
        kind: 'gif',
        sourceType: 'builtin',
        builtinId: item.builtinId,
        label: item.title,
        x: 0.72,
        y: 0.74,
        scale: 1,
        rotDeg: -3,
        startSec: 0,
        endSec: null,
      };
      setOverlays((prev) => [...prev, ov]);
      setSelectedOverlayId(ov.id);
      setGifSheetOpen(false);
      return;
    }

    if (item.webpUrl) {
      setLoadingStickerId(item.id);
      try {
        const decoded = await decodeRemoteStickerUrl(item.webpUrl, item.id);
        customStickersRef.current.set(decoded.id, decoded);
        const ov: MontageGifOverlay = {
          id: makeId('gif'),
          kind: 'gif',
          sourceType: 'custom',
          customMediaId: decoded.id,
          label: item.title,
          x: 0.72,
          y: 0.74,
          scale: 0.92,
          rotDeg: 0,
          startSec: 0,
          endSec: null,
        };
        setOverlays((prev) => [...prev, ov]);
        setSelectedOverlayId(ov.id);
        setGifSheetOpen(false);
      } catch {
        showQuickToast('Проверьте интернет для загрузки стикера');
      } finally {
        setLoadingStickerId(null);
      }
    }
  };

  const handleSelectOnlineGif = async (gif: ExternalGifResult) => {
    sfxUiTap();
    setLoadingStickerId(gif.id);
    try {
      const decoded = await decodeRemoteStickerUrl(gif.gifUrl, gif.id);
      customStickersRef.current.set(decoded.id, decoded);
      const ov: MontageGifOverlay = {
        id: makeId('gif'),
        kind: 'gif',
        sourceType: 'custom',
        customMediaId: decoded.id,
        label: gif.title,
        x: 0.5,
        y: 0.72,
        scale: 1.05,
        rotDeg: 0,
        startSec: 0,
        endSec: null,
      };
      setOverlays((prev) => [...prev, ov]);
      setSelectedOverlayId(ov.id);
      setGifSheetOpen(false);
    } catch {
      showQuickToast('Не удалось загрузить эту GIF');
    } finally {
      setLoadingStickerId(null);
    }
  };

  const handleLocalGifPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    sfxUiTap();
    try {
      const decoded = await decodeUploadedStickerMedia(file);
      customStickersRef.current.set(decoded.id, decoded);
      const ov: MontageGifOverlay = {
        id: makeId('gif'),
        kind: 'gif',
        sourceType: 'custom',
        customMediaId: decoded.id,
        label: file.name.slice(0, 14),
        x: 0.5,
        y: 0.72,
        scale: 1,
        rotDeg: 0,
        startSec: 0,
        endSec: null,
      };
      setOverlays((prev) => [...prev, ov]);
      setSelectedOverlayId(ov.id);
      setGifSheetOpen(false);
    } catch {
      showQuickToast('Не удалось открыть файл');
    }
  };

  // ── ЕДИНАЯ ЛЕНТА ТАЙМЛАЙНА И ОБРЕЗКИ ВНИЗУ (В СТИЛЕ TELEGRAM STORIES) ──
  const onTimelinePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const bar = filmstripRef.current;
    if (!bar || exportState) return;
    const handleAttr = (e.target as HTMLElement | null)
      ?.closest('[data-trim-handle]')
      ?.getAttribute('data-trim-handle');

    const mode: 'scrub' | 'trim_start' | 'trim_end' =
      handleAttr === 'start' ? 'trim_start' : handleAttr === 'end' ? 'trim_end' : 'scrub';

    timelineDragRef.current = { mode, pointerId: e.pointerId };
    try {
      bar.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const sec = ratio * totalDuration;

    if (mode === 'scrub') {
      const clamped = Math.max(trimStartSec, Math.min(trimEndSec, sec));
      playheadRef.current = clamped;
      setPlayheadSec(clamped);
    }
  };

  const onTimelinePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = timelineDragRef.current;
    const bar = filmstripRef.current;
    if (!drag || !bar || drag.pointerId !== e.pointerId) return;

    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const sec = Number((ratio * totalDuration).toFixed(2));

    if (drag.mode === 'trim_start') {
      const nextStart = Math.max(0, Math.min(trimEndSec - 0.8, sec));
      setTrimStartSec(nextStart);
      playheadRef.current = nextStart;
      setPlayheadSec(nextStart);
    } else if (drag.mode === 'trim_end') {
      const nextEnd = Math.min(totalDuration, Math.max(trimStartSec + 0.8, sec));
      setTrimEndSec(nextEnd);
      playheadRef.current = Math.max(trimStartSec, nextEnd - 0.15);
      setPlayheadSec(Math.max(trimStartSec, nextEnd - 0.15));
    } else {
      const clamped = Math.max(trimStartSec, Math.min(trimEndSec, sec));
      playheadRef.current = clamped;
      setPlayheadSec(clamped);
    }
  };

  const onTimelinePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = timelineDragRef.current;
    const bar = filmstripRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    if (bar) {
      try {
        bar.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
    timelineDragRef.current = null;
  };

  // ── ЭКСПОРТ И ОТПРАВКА ──
  const handleSharePrimary = async () => {
    if (exportState) return;

    const isUntouchedRawReel =
      feedMode === 'raw_playthrough' &&
      Boolean(recordedReel) &&
      overlays.length === 0 &&
      trimStartSec <= 0.15 &&
      Math.abs(trimEndSec - totalDuration) <= 0.2;

    if (isUntouchedRawReel && recordedReel) {
      stopAudioPreview();
      const outcome = await shareRecordedReelToGallery(recordedReel);
      if (outcome === 'shared') {
        sfxVictory();
        showQuickToast('Видео отправлено');
        return;
      }
      if (outcome === 'aborted') return;
      const a = document.createElement('a');
      a.href = recordedReel.url;
      a.download = recordedReel.file.name;
      a.click();
      showQuickToast('Видео сохранено');
      return;
    }

    sfxUiTap();
    stopAudioPreview();
    setIsPlaying(false);
    setExportState({ pct: 4, label: 'Собираем HD…' });

    try {
      const res = await exportMontageProjectToMp4(
        project,
        {
          portraits: portraitImagesRef.current,
          faceImg: faceImgRef.current,
          swipeFaces: swipeFaceImagesRef.current,
          liveFaceSource: liveFaceSource ?? null,
          customStickers: customStickersRef.current,
        },
        videoElsRef.current,
        (pct, label) => setExportState({ pct, label }),
        { startSec: trimStartSec, endSec: trimEndSec }
      );
      sfxVictory();

      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (typeof nav.share === 'function' && nav.canShare?.({ files: [res.file] })) {
        await nav.share({ files: [res.file] });
        showQuickToast('Готово!');
      } else {
        const a = document.createElement('a');
        a.href = res.url;
        a.download = res.file.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.setTimeout(() => URL.revokeObjectURL(res.url), 45_000);
        showQuickToast('MP4 сохранён на устройство');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message.toLowerCase() : '';
      if (!msg.includes('abort') && !msg.includes('cancel')) {
        showQuickToast('Отправка отменена');
      }
    } finally {
      setExportState(null);
    }
  };

  const handleCopyGameLink = () => {
    sfxUiTap();
    const slug = DIRECT_PLAY_SLUGS[pack.id] || pack.id;
    const url = getTelegramBotAppUrl(`play_${slug}`);
    const shareText = `Попробуй пройти «${pack.title}»:`;
    if (!shareLinkViaTelegramOrNative(url, shareText)) {
      void navigator.clipboard?.writeText(`${shareText} ${url}`);
      showQuickToast('Ссылка на игру скопирована');
    }
  };

  const facePresent =
    Boolean(recordedReel) ||
    Boolean(hasLiveFace) ||
    Boolean(liveFaceSource) ||
    Boolean(faceSnapshotUrl);
  const startPct = (trimStartSec / Math.max(0.1, totalDuration)) * 100;
  const endPct = (trimEndSec / Math.max(0.1, totalDuration)) * 100;
  const playheadPct = (playheadSec / Math.max(0.1, totalDuration)) * 100;
  const caseSpan = spans.find((s) => s.clip.kind === 'real_case');
  const selectedOvObj = overlays.find((o) => o.id === selectedOverlayId) ?? null;

  const glassCircleStyle: React.CSSProperties = {
    width: 38,
    height: 38,
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'rgba(10, 14, 18, 0.56)',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
    color: '#ffffff',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13.5,
    fontWeight: 800,
    cursor: 'pointer',
    padding: 0,
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 3500,
        background: 'rgba(5, 7, 10, 0.94)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !exportState) {
          stopAudioPreview();
          onClose();
        }
      }}
    >
      {/* Скрытая растеризация портретов */}
      <div
        ref={hiddenPortraitsRef}
        aria-hidden="true"
        style={{
          position: 'fixed',
          left: -9999,
          top: -9999,
          width: 360,
          height: 360,
          overflow: 'hidden',
          pointerEvents: 'none',
          opacity: 0,
        }}
      >
        {portraitTargets.map((pt) => (
          <div key={pt.key} data-portrait-key={pt.key}>
            <EditorialCardPortrait
              packId={pack.id}
              cardId={pt.cardId}
              speaker={pt.speaker}
              blockNum={pt.blockNum}
              hideFaceForCutout={pt.hideFace}
            />
          </div>
        ))}
      </div>

      <input
        ref={gifFileInputRef}
        type="file"
        accept="image/gif,image/webp,image/png,image/jpeg,video/mp4,video/webm"
        style={{ display: 'none' }}
        onChange={(e) => void handleLocalGifPicked(e)}
      />

      {/* ПОЛНОЭКРАННЫЙ КАДР STORIES 9:16 (БЕЗ ФОРМ И РАМОК СНИЗУ!) */}
      <div
        ref={stageWrapRef}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 440,
          height: '100dvh',
          maxHeight: 880,
          background: '#080b0e',
          overflow: 'hidden',
          boxShadow: '0 24px 80px rgba(0,0,0,0.85)',
        }}
      >
        <canvas
          ref={previewCanvasRef}
          width={720}
          height={1280}
          onPointerDown={onStagePointerDown}
          onPointerMove={onStagePointerMove}
          onPointerUp={onStagePointerUp}
          onPointerCancel={onStagePointerUp}
          onWheel={onStageWheel}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
            touchAction: 'none',
          }}
        />

        {/* Верхняя мягкая тень под кнопки в стиле Instagram / Telegram Stories */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 110,
            background: 'linear-gradient(180deg, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0) 100%)',
            pointerEvents: 'none',
          }}
        />

        {/* ВЕРХНЯЯ ПАНЕЛЬ ИНСТРУМЕНТОВ STORIES */}
        {!textEditorState.open && !isDraggingOverlay && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
              left: 12,
              right: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              zIndex: 10,
            }}
          >
            <button
              type="button"
              style={glassCircleStyle}
              disabled={Boolean(exportState)}
              onClick={() => {
                sfxUiTap();
                stopAudioPreview();
                onClose();
              }}
              aria-label="Закрыть"
            >
              ✕
            </button>

            {/* Переключатель: Умный хайлайт vs Чистая запись */}
            {recordedReel ? (
              <div
                style={{
                  display: 'inline-flex',
                  padding: 3,
                  borderRadius: 999,
                  background: 'rgba(10, 14, 18, 0.58)',
                  backdropFilter: 'blur(14px)',
                  border: '1px solid rgba(255,255,255,0.14)',
                }}
              >
                {(
                  [
                    ['smart_highlight', 'Хайлайт'],
                    ['raw_playthrough', 'Запись'],
                  ] as [StoriesFeedMode, string][]
                ).map(([m, label]) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      sfxUiTap();
                      setFeedMode(m);
                    }}
                    style={{
                      padding: '5px 11px',
                      borderRadius: 999,
                      border: 'none',
                      background: feedMode === m ? '#ffffff' : 'transparent',
                      color: feedMode === m ? '#0d1117' : 'rgba(255,255,255,0.78)',
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ flex: 1 }} />
            )}

            {/* Иконки Stories справа: Aa · GIF · Драма · Кейс */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <button
                type="button"
                style={glassCircleStyle}
                onClick={openTextCreator}
                title="Добавить текст"
              >
                Aa
              </button>

              <button
                type="button"
                style={{
                  ...glassCircleStyle,
                  width: 'auto',
                  padding: '0 11px',
                  fontSize: 12,
                  letterSpacing: '0.03em',
                }}
                onClick={() => {
                  sfxUiTap();
                  setCaseSheetOpen(false);
                  setGifSheetOpen((v) => !v);
                }}
                title="Найти гифку или стикер"
              >
                GIF
              </button>

              {feedMode === 'smart_highlight' && (
                <button
                  type="button"
                  style={{
                    ...glassCircleStyle,
                    width: 'auto',
                    padding: '0 10px',
                    fontSize: 11.5,
                    borderColor:
                      faceFx !== 'none' ? 'rgba(255, 209, 102, 0.65)' : 'rgba(255,255,255,0.18)',
                    color: faceFx !== 'none' ? '#ffd166' : '#ffffff',
                  }}
                  onClick={() => {
                    sfxUiTap();
                    setGifSheetOpen(false);
                    setCaseSheetOpen(false);
                    setFaceSheetOpen((v) => !v);
                  }}
                  title="Эффекты лица"
                >
                  Лицо
                </button>
              )}

              {feedMode === 'smart_highlight' && selectedCase && runCases.length > 0 && (
                <button
                  type="button"
                  style={{
                    ...glassCircleStyle,
                    width: 'auto',
                    padding: '0 10px',
                    fontSize: 11.5,
                    borderColor: includeCaseBlock
                      ? 'rgba(94, 212, 168, 0.6)'
                      : 'rgba(255,255,255,0.18)',
                    color: includeCaseBlock ? '#5ed4a8' : 'rgba(255,255,255,0.65)',
                  }}
                  onClick={() => {
                    sfxUiTap();
                    setGifSheetOpen(false);
                    setCaseSheetOpen((v) => !v);
                  }}
                  title="Настроить блок реального ответа из истории"
                >
                  Кейс
                </button>
              )}
            </div>
          </div>
        )}

        {/* Боковые мини-кнопки масштаба для выбранного стикера/текста */}
        {selectedOvObj && !isDraggingOverlay && !textEditorState.open && (
          <div
            style={{
              position: 'absolute',
              right: 12,
              top: '36%',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              zIndex: 11,
            }}
          >
            <button
              type="button"
              aria-label="Удалить"
              style={{
                ...glassCircleStyle,
                width: 34,
                height: 34,
                background: 'rgba(224, 79, 62, 0.88)',
                border: '1px solid rgba(255,255,255,0.3)',
              }}
              onClick={() => {
                sfxUiTap();
                setOverlays((p) => p.filter((o) => o.id !== selectedOvObj.id));
                setSelectedOverlayId(null);
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              style={{ ...glassCircleStyle, width: 34, height: 34 }}
              onClick={() =>
                setOverlays((p) =>
                  p.map((o) =>
                    o.id === selectedOvObj.id
                      ? { ...o, scale: Math.min(2.2, Number((o.scale + 0.14).toFixed(2))) }
                      : o
                  )
                )
              }
            >
              +
            </button>
            <button
              type="button"
              style={{ ...glassCircleStyle, width: 34, height: 34 }}
              onClick={() =>
                setOverlays((p) =>
                  p.map((o) =>
                    o.id === selectedOvObj.id
                      ? { ...o, scale: Math.max(0.45, Number((o.scale - 0.14).toFixed(2))) }
                      : o
                  )
                )
              }
            >
              −
            </button>
            {[
              ['↺', -9],
              ['↻', 9],
            ].map(([lbl, d]) => (
              <button
                key={String(lbl)}
                type="button"
                style={{ ...glassCircleStyle, width: 34, height: 34 }}
                onClick={() =>
                  setOverlays((p) =>
                    p.map((o) =>
                      o.id === selectedOvObj.id ? { ...o, rotDeg: o.rotDeg + Number(d) } : o
                    )
                  )
                }
              >
                {lbl}
              </button>
            ))}
            {selectedOvObj.kind === 'text' && (
              <button
                type="button"
                style={{ ...glassCircleStyle, width: 34, height: 34 }}
                onClick={() => {
                  setTextEditorState({
                    open: true,
                    editingId: selectedOvObj.id,
                    text: selectedOvObj.text,
                    style: selectedOvObj.style,
                    color: selectedOvObj.color || '#ffffff',
                  });
                  window.setTimeout(() => textInputRef.current?.focus(), 40);
                }}
              >
                ✎
              </button>
            )}
          </div>
        )}

        {/* КОРЗИНА ВНИЗУ ПРИ ПЕРЕТАСКИВАНИИ СТИКЕРА ИЛИ ТЕКСТА (1:1 INSTAGRAM STORIES) */}
        {isDraggingOverlay && (
          <div
            style={{
              position: 'absolute',
              bottom: 42,
              left: '50%',
              transform: `translateX(-50%) scale(${isOverTrash ? 1.24 : 1})`,
              transition: 'transform 0.15s ease, background 0.15s ease',
              width: 56,
              height: 56,
              borderRadius: 999,
              background: isOverTrash ? '#e04f3e' : 'rgba(12, 16, 22, 0.78)',
              border: '1.5px solid rgba(255,255,255,0.35)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 25,
              pointerEvents: 'none',
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}

        {/* ЭКРАННЫЙ РЕДАКТОР ТЕКСТА «Aa» ПРЯМО НА ВИДЕО */}
        {textEditorState.open && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(6, 9, 14, 0.68)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              zIndex: 30,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: 'calc(env(safe-area-inset-top, 0px) + 14px) 16px 28px',
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) commitTextEditor();
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button
                type="button"
                onClick={() => {
                  const idx = TEXT_STYLES.indexOf(textEditorState.style);
                  const nextStyle = TEXT_STYLES[(idx + 1) % TEXT_STYLES.length];
                  setTextEditorState((s) => ({ ...s, style: nextStyle }));
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: 999,
                  border: '1px solid rgba(255,255,255,0.28)',
                  background: 'rgba(255,255,255,0.14)',
                  color: '#ffffff',
                  fontSize: 12.5,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                {textEditorState.style === 'stories_dark'
                  ? 'Плашка'
                  : textEditorState.style === 'kinetic_bold'
                    ? 'Без фона'
                    : textEditorState.style === 'paper'
                      ? 'Бумага'
                      : 'Акцент'}
              </button>

              <div style={{ display: 'flex', gap: 8 }}>
                {TEXT_COLORS.map((col) => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => setTextEditorState((s) => ({ ...s, color: col }))}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 999,
                      background: col,
                      border:
                        textEditorState.color === col
                          ? '2.5px solid #ffffff'
                          : '1px solid rgba(255,255,255,0.35)',
                      transform: textEditorState.color === col ? 'scale(1.15)' : 'scale(1)',
                      cursor: 'pointer',
                    }}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={commitTextEditor}
                style={{
                  padding: '6px 14px',
                  borderRadius: 999,
                  border: 'none',
                  background: '#ffffff',
                  color: '#0b0e14',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Готово
              </button>
            </div>

            <textarea
              ref={textInputRef}
              rows={3}
              maxLength={80}
              placeholder="Введите текст…"
              value={textEditorState.text}
              onChange={(e) => setTextEditorState((s) => ({ ...s, text: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  commitTextEditor();
                }
              }}
              style={{
                width: '100%',
                background:
                  textEditorState.style === 'stories_dark'
                    ? 'rgba(12,15,20,0.86)'
                    : textEditorState.style === 'paper'
                      ? '#f4efe4'
                      : 'transparent',
                color:
                  textEditorState.style === 'paper' && textEditorState.color === '#ffffff'
                    ? '#181614'
                    : textEditorState.color,
                border: 'none',
                borderRadius: 18,
                padding: '16px 18px',
                textAlign: 'center',
                fontFamily: 'var(--font-sans)',
                fontSize: 24,
                fontWeight: 800,
                outline: 'none',
                resize: 'none',
              }}
            />

            <div style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
              После ввода текст можно свободно двигать пальцем по видео
            </div>
          </div>
        )}

        {/* ШТОРКА ПОИСКА GIF И АНИМИРОВАННЫХ СТИКЕРОВ */}
        {gifSheetOpen && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: '62%',
              background: 'rgba(12, 16, 22, 0.92)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
              borderTop: '1px solid rgba(255,255,255,0.14)',
              zIndex: 28,
              display: 'flex',
              flexDirection: 'column',
              padding: '10px 14px 18px',
              gap: 9,
            }}
          >
            <div
              style={{
                width: 36,
                height: 4,
                borderRadius: 99,
                background: 'rgba(255,255,255,0.25)',
                margin: '0 auto 2px',
              }}
            />

            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="search"
                placeholder="Поиск: огонь, кринж, кот, бабки, уволен, кофе…"
                value={gifQuery}
                onChange={(e) => setGifQuery(e.target.value)}
                style={{
                  flex: 1,
                  padding: '9px 13px',
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.16)',
                  background: 'rgba(255,255,255,0.08)',
                  color: '#ffffff',
                  fontSize: 13.5,
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={() => setGifSheetOpen(false)}
                style={{
                  padding: '0 12px',
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.14)',
                  background: 'rgba(255,255,255,0.06)',
                  color: '#ffffff',
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Готово
              </button>
            </div>

            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', flexShrink: 0 }}>
              {(
                [
                  ['all', 'Все'],
                  ['top', 'В тренде'],
                  ['office', 'Офис и дедлайн'],
                  ['emotion', 'Эмоции'],
                  ['money', 'Деньги'],
                ] as const
              ).map(([ck, clabel]) => (
                <button
                  key={ck}
                  type="button"
                  onClick={() => setGifCat(ck)}
                  style={{
                    whiteSpace: 'nowrap',
                    padding: '5px 11px',
                    borderRadius: 999,
                    border: 'none',
                    background: gifCat === ck ? '#ffffff' : 'rgba(255,255,255,0.09)',
                    color: gifCat === ck ? '#0b0e14' : 'rgba(255,255,255,0.82)',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {clabel}
                </button>
              ))}
              <button
                type="button"
                onClick={() => gifFileInputRef.current?.click()}
                style={{
                  whiteSpace: 'nowrap',
                  padding: '5px 11px',
                  borderRadius: 999,
                  border: '1px dashed rgba(255,255,255,0.35)',
                  background: 'transparent',
                  color: '#ffd166',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                + Своя GIF
              </button>
            </div>

            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 8,
                alignContent: 'start',
              }}
            >
              {onlineGifs.map((og) => (
                <button
                  key={og.id}
                  type="button"
                  onClick={() => void handleSelectOnlineGif(og)}
                  style={{
                    aspectRatio: '1 / 1',
                    borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.1)',
                    background:
                      'repeating-conic-gradient(rgba(255,255,255,0.07) 0% 25%, rgba(255,255,255,0.02) 0% 50%) 50% / 16px 16px',
                    padding: 6,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    opacity: loadingStickerId === og.id ? 0.5 : 1,
                  }}
                >
                  <img
                    src={og.previewUrl}
                    alt={og.title}
                    loading="lazy"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                </button>
              ))}

              {filteredCatalogStickers.map((st) => (
                <button
                  key={st.id}
                  type="button"
                  disabled={loadingStickerId === st.id}
                  onClick={() => void handleSelectCatalogSticker(st)}
                  style={{
                    aspectRatio: '1 / 1',
                    borderRadius: 14,
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(255,255,255,0.05)',
                    padding: 6,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    color: '#ffffff',
                    cursor: 'pointer',
                    opacity: loadingStickerId === st.id ? 0.5 : 1,
                  }}
                >
                  {st.webpUrl ? (
                    <img
                      src={st.webpUrl}
                      alt={st.title}
                      loading="lazy"
                      style={{ width: 68, height: 68, objectFit: 'contain' }}
                    />
                  ) : (
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 10,
                        fontWeight: 800,
                        padding: '4px 6px',
                        borderRadius: 6,
                        background: 'rgba(214,160,92,0.2)',
                        color: '#ffd166',
                      }}
                    >
                      GIF
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 600,
                      color: 'rgba(255,255,255,0.78)',
                      textAlign: 'center',
                      lineHeight: 1.15,
                    }}
                  >
                    {st.title}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {faceSheetOpen && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(12, 16, 22, 0.94)',
              backdropFilter: 'blur(22px)',
              WebkitBackdropFilter: 'blur(22px)',
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
              borderTop: '1px solid rgba(255,255,255,0.14)',
              zIndex: 28,
              padding: '14px 16px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: 14 }}>Эффект на лице</strong>
              <button
                type="button"
                onClick={() => setFaceSheetOpen(false)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 999,
                  border: 'none',
                  background: '#ffffff',
                  color: '#0b0e14',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Готово
              </button>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(
                [
                  ['auto', 'Авто'],
                  ['none', 'Без эффекта'],
                  ['pop', 'Наезд на лицо'],
                  ['pulse', 'Пульс'],
                  ['shake', 'Тряска'],
                  ['big', 'Крупно всегда'],
                ] as [FaceFx, string][]
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    sfxUiTap();
                    setFaceFx(k);
                    playheadRef.current = 0;
                    setPlayheadSec(0);
                    setIsPlaying(true);
                  }}
                  style={{
                    padding: '7px 12px',
                    borderRadius: 999,
                    border: 'none',
                    background: faceFx === k ? '#ffd166' : 'rgba(255,255,255,0.09)',
                    color: faceFx === k ? '#141210' : '#ffffff',
                    fontSize: 12.5,
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.55)' }}>
              «Авто» сама выбирает эффект по тому, что случилось после ответа: удар по шкалам — тряска, большой плюс — наезд, средний сдвиг — пульс. Берётся лицо из момента ответа.
            </div>
          </div>
        )}

        {/* КОМПАКТНАЯ ШТОРКА «А КАК НА ЭТОТ ВОПРОС ОТВЕТИЛ…» */}
        {caseSheetOpen && selectedCase && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(12, 16, 22, 0.94)',
              backdropFilter: 'blur(22px)',
              WebkitBackdropFilter: 'blur(22px)',
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
              borderTop: '1px solid rgba(255,255,255,0.14)',
              zIndex: 28,
              padding: '14px 16px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: 14 }}>Блок «Как ответили в реальности»</strong>
              <button
                type="button"
                onClick={() => setCaseSheetOpen(false)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 999,
                  border: 'none',
                  background: '#ffffff',
                  color: '#0b0e14',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Готово
              </button>
            </div>

            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
              <button
                type="button"
                onClick={() => setIncludeCaseBlock((v) => !v)}
                style={{
                  whiteSpace: 'nowrap',
                  padding: '6px 11px',
                  borderRadius: 999,
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: includeCaseBlock ? '#5ed4a8' : 'rgba(255,255,255,0.08)',
                  color: includeCaseBlock ? '#090c0f' : '#ffffff',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                {includeCaseBlock ? 'Включён ✓' : 'Выключен'}
              </button>
              {runCases.map((rc, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    sfxUiTap();
                    setIncludeCaseBlock(true);
                    setSelectedCase(rc);
                    setCaseLeadText(buildConversationalCaseLead(rc));
                    if (caseSpan) {
                      playheadRef.current = caseSpan.startSec + 0.1;
                      setPlayheadSec(caseSpan.startSec + 0.1);
                    }
                  }}
                  style={{
                    whiteSpace: 'nowrap',
                    padding: '6px 11px',
                    borderRadius: 999,
                    border: 'none',
                    background:
                      selectedCase.person === rc.person
                        ? 'rgba(255,255,255,0.92)'
                        : 'rgba(255,255,255,0.09)',
                    color: selectedCase.person === rc.person ? '#090c0f' : '#ffffff',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {rc.person} ({rc.year})
                </button>
              ))}
            </div>

            {includeCaseBlock && (
              <input
                type="text"
                value={caseLeadText}
                onChange={(e) => setCaseLeadText(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.16)',
                  background: 'rgba(255,255,255,0.07)',
                  color: '#ffffff',
                  fontSize: 13,
                  outline: 'none',
                }}
              />
            )}
          </div>
        )}

        {/* Всплывающий тост по центру */}
        {toast && (
          <div
            style={{
              position: 'absolute',
              top: 72,
              left: '50%',
              transform: 'translateX(-50%)',
              padding: '7px 14px',
              borderRadius: 999,
              background: 'rgba(10, 14, 20, 0.88)',
              border: '1px solid rgba(255,255,255,0.18)',
              color: '#ffffff',
              fontSize: 12,
              fontWeight: 700,
              whiteSpace: 'nowrap',
              zIndex: 26,
              pointerEvents: 'none',
            }}
          >
            {toast}
          </div>
        )}

        {/* Оверлей прогресса экспорта */}
        {exportState && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(6, 9, 14, 0.76)',
              backdropFilter: 'blur(10px)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              zIndex: 40,
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 800 }}>{exportState.label}</div>
            <div
              style={{
                width: 200,
                height: 6,
                borderRadius: 99,
                background: 'rgba(255,255,255,0.15)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${exportState.pct}%`,
                  height: '100%',
                  background: '#ffffff',
                  transition: 'width 0.14s ease',
                }}
              />
            </div>
          </div>
        )}

        {/* НИЖНИЙ БЛОК STORIES: ЕДИНАЯ ЛЕНТА ТАЙМЛАЙНА С РУЧКАМИ ОБРЕЗКИ + КНОПКА ПОДЕЛИТЬСЯ */}
        {!textEditorState.open && !gifSheetOpen && !caseSheetOpen && !faceSheetOpen && !isDraggingOverlay && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              padding: '28px 14px calc(env(safe-area-inset-bottom, 0px) + 14px)',
              background:
                'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.72) 38%, rgba(0,0,0,0.88) 100%)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              zIndex: 12,
            }}
          >
            {/* Единая лента перемещения по таймлайну и обрезки краёв (как в Telegram / iOS) */}
            <div
              ref={filmstripRef}
              onPointerDown={onTimelinePointerDown}
              onPointerMove={onTimelinePointerMove}
              onPointerUp={onTimelinePointerUp}
              onPointerCancel={onTimelinePointerUp}
              style={{
                position: 'relative',
                height: 38,
                borderRadius: 10,
                background: 'rgba(255,255,255,0.1)',
                overflow: 'hidden',
                touchAction: 'none',
                cursor: 'ew-resize',
                userSelect: 'none',
              }}
            >
              {/* Сегменты сцен внутри ленты */}
              <div style={{ display: 'flex', width: '100%', height: '100%' }}>
                {spans.map((sp) => {
                  const wPct = (sp.duration / Math.max(0.1, totalDuration)) * 100;
                  const isCase = sp.clip.kind === 'real_case';
                  const isQr = sp.clip.kind === 'qr';
                  return (
                    <div
                      key={sp.clip.id}
                      style={{
                        width: `${wPct}%`,
                        height: '100%',
                        borderRight: '1px solid rgba(255,255,255,0.16)',
                        background: isCase
                          ? 'rgba(94, 212, 168, 0.24)'
                          : isQr
                            ? 'rgba(214, 160, 92, 0.28)'
                            : 'rgba(255, 255, 255, 0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 10,
                        fontWeight: 800,
                        color: 'rgba(255,255,255,0.78)',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {wPct > 16
                        ? sp.clip.kind === 'real_case'
                          ? `Ответ: ${sp.clip.realCase.person.split(' ').slice(-1)[0]}`
                          : sp.clip.kind === 'video'
                            ? 'Ваше прохождение'
                            : sp.clip.kind === 'swipe'
                              ? `Смена ${sp.clip.swipe.week}`
                              : ''
                        : ''}
                    </div>
                  );
                })}
              </div>

              {/* Затемнение отрезанных краёв слева и справа */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: 0,
                  width: `${startPct}%`,
                  background: 'rgba(0,0,0,0.68)',
                  pointerEvents: 'none',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  right: 0,
                  width: `${Math.max(0, 100 - endPct)}%`,
                  background: 'rgba(0,0,0,0.68)',
                  pointerEvents: 'none',
                }}
              />

              {/* Золотая рамка активного отрезка + левая и правая ручки обрезки */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: `${startPct}%`,
                  width: `${Math.max(2, endPct - startPct)}%`,
                  borderTop: '2px solid #ffd166',
                  borderBottom: '2px solid #ffd166',
                  pointerEvents: 'none',
                }}
              />

              <div
                data-trim-handle="start"
                title="Отрезать начало"
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: `calc(${startPct}% - 2px)`,
                  width: 14,
                  background: '#ffd166',
                  borderTopLeftRadius: 8,
                  borderBottomLeftRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#141210',
                  fontSize: 10,
                  fontWeight: 900,
                }}
              >
                ‹
              </div>

              <div
                data-trim-handle="end"
                title="Отрезать конец"
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: `calc(${endPct}% - 12px)`,
                  width: 14,
                  background: '#ffd166',
                  borderTopRightRadius: 8,
                  borderBottomRightRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#141210',
                  fontSize: 10,
                  fontWeight: 900,
                }}
              >
                ›
              </div>

              {/* Белая игла текущего кадра (Playhead) */}
              <div
                style={{
                  position: 'absolute',
                  top: 2,
                  bottom: 2,
                  left: `calc(${playheadPct}% - 1.5px)`,
                  width: 3,
                  borderRadius: 2,
                  background: '#ffffff',
                  boxShadow: '0 0 8px rgba(0,0,0,0.8)',
                  pointerEvents: 'none',
                }}
              />
            </div>

            {/* Нижняя строка: Плей/Пауза · Звук · Лицо (если нет) · Кнопка «Поделиться» */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <button
                  type="button"
                  style={{ ...glassCircleStyle, width: 36, height: 36, fontSize: 12 }}
                  onClick={() => setIsPlaying((p) => !p)}
                  aria-label={isPlaying ? 'Пауза' : 'Воспроизвести'}
                >
                  {isPlaying ? '❚❚' : '▶'}
                </button>

                <button
                  type="button"
                  style={{ ...glassCircleStyle, width: 36, height: 36 }}
                  onClick={() => {
                    sfxUiTap();
                    setSoundMuted((m) => !m);
                  }}
                  aria-label="Звук"
                >
                  {soundMuted ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 5L6 9H2v6h4l5 4V5zM15.5 8.5a5 5 0 010 7M19 5a10 10 0 010 14" strokeLinecap="round" />
                    </svg>
                  )}
                </button>

                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11.5,
                    color: 'rgba(255,255,255,0.78)',
                  }}
                >
                  {fmtSec(Math.max(0, playheadSec - trimStartSec))}/
                  {fmtSec(Math.max(1, trimEndSec - trimStartSec))}
                </span>

                {!facePresent && onRequestEnableFace && (
                  <button
                    type="button"
                    onClick={() => {
                      sfxUiTap();
                      onRequestEnableFace();
                    }}
                    style={{
                      height: 32,
                      padding: '0 10px',
                      borderRadius: 999,
                      border: '1px solid rgba(255,209,102,0.55)',
                      background: 'rgba(255,209,102,0.16)',
                      color: '#ffd166',
                      fontSize: 11.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    + Лицо
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <button
                  type="button"
                  style={{ ...glassCircleStyle, width: 38, height: 38 }}
                  onClick={handleCopyGameLink}
                  title="Скопировать ссылку на игру"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" strokeLinecap="round" />
                  </svg>
                </button>

                <button
                  type="button"
                  disabled={Boolean(exportState)}
                  onClick={() => void handleSharePrimary()}
                  style={{
                    height: 40,
                    padding: '0 18px',
                    borderRadius: 999,
                    border: 'none',
                    background: '#ffffff',
                    color: '#0b0e14',
                    fontFamily: 'var(--font-sans)',
                    fontSize: 14,
                    fontWeight: 800,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    cursor: 'pointer',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
                  }}
                >
                  <span>Поделиться</span>
                  <span style={{ fontSize: 16 }}>→</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
