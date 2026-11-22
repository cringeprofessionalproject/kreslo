import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sfxUiTap, sfxVictory } from '../audio';
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
  getDefaultHookPresets,
  pickBestRealCaseForHighlight,
  renderMontageFrameAtTime,
  type MontageClip,
  type MontageGifOverlay,
  type MontageOverlay,
  type MontageProject,
  type MontageTextOverlay,
  type MontageVideoClip,
  type RunSwipeHighlight,
} from '../game/shortsHighlightBuilder';
import {
  BUILTIN_ANIMATED_GIFS,
  decodeUploadedStickerMedia,
  type BuiltinGifId,
  type CustomStickerMedia,
} from '../game/storiesAnimatedGifs';
import { getTelegramBotAppUrl, shareLinkViaTelegramOrNative } from '../game/telegramStars';
import type { EndingDef, JobPack, RealHistoricalCase, Stats } from '../types';
import { EditorialCardPortrait } from './CharacterArt';
import { IconShare } from './Icons';

export type ShareVideoPresetMode = 'playthrough' | 'with_history' | 'short';

type ActivePopover = 'none' | 'caption' | 'gif' | 'history';

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

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
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
  const presets = useMemo(
    () => getDefaultHookPresets(pack, ending, weeksSurvived),
    [pack, ending, weeksSurvived]
  );
  const allPackCases = useMemo(() => getAllRealCasesInPack(pack), [pack]);
  const usableSwipes = useMemo(
    () => (swipes.length > 0 ? swipes : buildFallbackSwipesFromPack(pack)),
    [pack, swipes]
  );

  // 3 чистых представления ролика
  const [viewMode, setViewMode] = useState<ShareVideoPresetMode>(() =>
    recordedReel ? 'playthrough' : 'with_history'
  );

  // Пользовательский видеофайл, если захотели подгрузить реакцию с телефона
  const [extraVideoClip, setExtraVideoClip] = useState<MontageVideoClip | null>(null);

  // Выбранный исторический кейс для представления «С историей»
  const initialCaseBundle = useMemo(
    () => pickBestRealCaseForHighlight(pack, usableSwipes),
    [pack, usableSwipes]
  );
  const [selectedCase, setSelectedCase] = useState<RealHistoricalCase | null>(
    () => initialCaseBundle?.realCase ?? allPackCases[0] ?? null
  );
  const [caseLeadText, setCaseLeadText] = useState<string>(() =>
    initialCaseBundle
      ? buildConversationalCaseLead(initialCaseBundle.realCase, initialCaseBundle.playerMatched)
      : allPackCases[0]
        ? buildConversationalCaseLead(allPackCases[0])
        : ''
  );

  // Лаконичные опциональные дополнения (по умолчанию ничего лишнего не захламляет кадр живого прохождения!)
  const [captionText, setCaptionText] = useState<string>('');
  const [gifOverlays, setGifOverlays] = useState<MontageGifOverlay[]>([]);
  const [captionPos, setCaptionPos] = useState<{ x: number; y: number }>({ x: 0.5, y: 0.09 });
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);
  const [activePopover, setActivePopover] = useState<ActivePopover>('none');

  // Автоматическая сборка дорожки под выбранное представление
  const clips = useMemo<MontageClip[]>(() => {
    const list: MontageClip[] = [];

    if (viewMode === 'playthrough') {
      if (recordedReel && recordedReel.durationSec > 0.4) {
        list.push({
          id: 'main_recorded_reel',
          kind: 'video',
          label: 'Прохождение',
          videoUrl: recordedReel.url,
          blob: recordedReel.blob,
          naturalDuration: recordedReel.durationSec,
          trimStart: 0,
          trimEnd: recordedReel.durationSec,
          volume: 1,
          fit: 'cover',
        });
      } else {
        usableSwipes.slice(-3).forEach((sw, idx) => {
          list.push({
            id: `sw_play_${idx}_${sw.week}`,
            kind: 'swipe',
            swipe: sw,
            duration: 2.3,
          });
        });
        list.push({ id: 'end_play', kind: 'ending', duration: 1.9 });
      }
      if (extraVideoClip) list.push(extraVideoClip);
      return list;
    }

    if (viewMode === 'with_history') {
      if (recordedReel && recordedReel.durationSec > 0.4) {
        const dur = recordedReel.durationSec;
        const start = dur > 8 ? Math.max(0, dur - 7) : 0;
        list.push({
          id: 'hist_recorded_reel',
          kind: 'video',
          label: 'Прохождение',
          videoUrl: recordedReel.url,
          blob: recordedReel.blob,
          naturalDuration: dur,
          trimStart: Number(start.toFixed(1)),
          trimEnd: Number(dur.toFixed(1)),
          volume: 1,
          fit: 'cover',
        });
      } else {
        usableSwipes.slice(-2).forEach((sw, idx) => {
          list.push({
            id: `sw_hist_${idx}_${sw.week}`,
            kind: 'swipe',
            swipe: sw,
            duration: 2.2,
          });
        });
      }

      if (extraVideoClip) list.push(extraVideoClip);

      if (selectedCase) {
        list.push({
          id: 'rc_main',
          kind: 'real_case',
          realCase: selectedCase,
          playerMatched: initialCaseBundle?.playerMatched,
          leadText: caseLeadText || buildConversationalCaseLead(selectedCase),
          bodyText: buildConversationalCaseBody(selectedCase),
          duration: 4.4,
        });
      }

      if (!recordedReel) {
        list.push({ id: 'end_hist', kind: 'ending', duration: 1.7 });
      }
      list.push({ id: 'qr_tail', kind: 'qr', duration: 0.45 });
      return list;
    }

    // viewMode === 'short' — быстрый ударный отрывок (6–8 сек)
    if (recordedReel && recordedReel.durationSec > 0.4) {
      const dur = recordedReel.durationSec;
      const start = dur > 6 ? Math.max(0, dur - 5.5) : 0;
      list.push({
        id: 'short_recorded_reel',
        kind: 'video',
        label: 'Развязка',
        videoUrl: recordedReel.url,
        blob: recordedReel.blob,
        naturalDuration: dur,
        trimStart: Number(start.toFixed(1)),
        trimEnd: Number(dur.toFixed(1)),
        volume: 1,
        fit: 'cover',
      });
    } else {
      const lastSwipe = usableSwipes[usableSwipes.length - 1];
      if (lastSwipe) {
        list.push({
          id: 'sw_short_last',
          kind: 'swipe',
          swipe: lastSwipe,
          duration: 2.4,
        });
      }
      list.push({ id: 'end_short', kind: 'ending', duration: 2.0 });
    }
    if (extraVideoClip) list.push(extraVideoClip);
    return list;
  }, [
    caseLeadText,
    extraVideoClip,
    initialCaseBundle?.playerMatched,
    recordedReel,
    selectedCase,
    usableSwipes,
    viewMode,
  ]);

  const overlays = useMemo<MontageOverlay[]>(() => {
    const out: MontageOverlay[] = [];
    if (captionText.trim()) {
      const txtOv: MontageTextOverlay = {
        id: 'caption_top',
        kind: 'text',
        text: captionText,
        style: 'stories_dark',
        x: captionPos.x,
        y: captionPos.y,
        scale: 0.92,
        rotDeg: 0,
        startSec: 0,
        endSec: null,
      };
      out.push(txtOv);
    }
    out.push(...gifOverlays);
    return out;
  }, [captionPos.x, captionPos.y, captionText, gifOverlays]);

  const { spans, totalDuration } = useMemo(() => computeTimelineSpans(clips), [clips]);

  // Единая простая полоса обрезки начала и конца ролика
  const [trimStartSec, setTrimStartSec] = useState<number>(0);
  const [trimEndSec, setTrimEndSec] = useState<number>(totalDuration);

  useEffect(() => {
    setTrimStartSec(0);
    setTrimEndSec(Number(totalDuration.toFixed(1)));
    playheadRef.current = 0;
    setPlayheadSec(0);
  }, [totalDuration, viewMode]);

  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [playheadSec, setPlayheadSec] = useState<number>(0);
  const [exportState, setExportState] = useState<{ pct: number; label: string } | null>(null);
  const [statusNote, setStatusNote] = useState<string | null>(null);

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const hiddenPortraitsRef = useRef<HTMLDivElement | null>(null);
  const portraitImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const swipeFaceImagesRef = useRef<Map<number, HTMLImageElement>>(new Map());
  const faceImgRef = useRef<HTMLImageElement | null>(null);
  const videoElsRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const customStickersRef = useRef<Map<string, CustomStickerMedia>>(new Map());

  const gifUploadInputRef = useRef<HTMLInputElement | null>(null);
  const videoUploadInputRef = useRef<HTMLInputElement | null>(null);

  const playheadRef = useRef<number>(0);
  playheadRef.current = playheadSec;

  const audioPreviewCtxRef = useRef<AudioContext | null>(null);
  const audioPreviewSrcRef = useRef<AudioBufferSourceNode | null>(null);

  const dragOverlayRef = useRef<{
    overlayId: string;
    pointerId: number;
    startClientX: number;
    startClientY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const project = useMemo<MontageProject>(
    () => ({
      pack,
      ending,
      finalStats,
      weeksSurvived,
      clips,
      overlays,
      soundtrack: recordedReel ? 'sfx_only' : 'groove',
      faceSnapshotUrl,
    }),
    [pack, ending, finalStats, weeksSurvived, clips, overlays, recordedReel, faceSnapshotUrl]
  );

  // Подготовка SVG-портретов (обычных и безголовых под живое лицо человека!)
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
    if (!isPlaying || exportState) return;
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
        // ignore before gesture
      }
    });
    return () => {
      cancelled = true;
      stopAudioPreview();
    };
  }, [exportState, isPlaying, project, stopAudioPreview, trimEndSec, trimStartSec]);

  // Живой цикл превью в пределах выбранной обрезки [trimStartSec..trimEndSec]
  useEffect(() => {
    let raf = 0;
    let lastTs = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - lastTs) / 1000);
      lastTs = now;

      const lo = Math.max(0, Math.min(totalDuration - 0.3, trimStartSec));
      const hi = Math.max(lo + 0.3, Math.min(totalDuration, trimEndSec));

      let curT = playheadRef.current;
      if (isPlaying && !exportState) {
        curT += dt;
        if (curT >= hi || curT < lo) curT = lo;
        playheadRef.current = curT;
        setPlayheadSec(curT);
      }

      const curSpan = spans.find((s) => curT >= s.startSec && curT < s.endSec);
      const videoFrameMap = new Map<string, CanvasImageSource | null>();
      videoElsRef.current.forEach((vid, id) => {
        if (curSpan && curSpan.clip.kind === 'video' && curSpan.clip.id === id) {
          const targetVidTime = curSpan.clip.trimStart + (curT - curSpan.startSec);
          if (isPlaying && !exportState) {
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
            if (Math.abs(vid.currentTime - targetVidTime) > 0.04) {
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
            selectedOverlayId
          );
        }
      }

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [
    exportState,
    isPlaying,
    liveFaceSource,
    project,
    selectedOverlayId,
    spans,
    totalDuration,
    trimEndSec,
    trimStartSec,
  ]);

  // Перетаскивание гифки или подписи пальцем прямо на видео
  const onCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = previewCanvasRef.current;
    if (!canvas || exportState) return;
    const rect = canvas.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;

    const hit = [...overlays].reverse().find((ov) => {
      const rx = ov.kind === 'text' ? 0.36 : 0.16 * ov.scale;
      const ry = ov.kind === 'text' ? 0.07 : 0.11 * ov.scale;
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
        startClientX: e.clientX,
        startClientY: e.clientY,
        origX: hit.x,
        origY: hit.y,
      };
    } else {
      setSelectedOverlayId(null);
      setIsPlaying((p) => !p);
    }
  };

  const onCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = dragOverlayRef.current;
    const canvas = previewCanvasRef.current;
    if (!d || !canvas || d.pointerId !== e.pointerId) return;
    const rect = canvas.getBoundingClientRect();
    const nx = Math.max(0.08, Math.min(0.92, d.origX + (e.clientX - d.startClientX) / rect.width));
    const ny = Math.max(0.06, Math.min(0.92, d.origY + (e.clientY - d.startClientY) / rect.height));

    if (d.overlayId === 'caption_top') {
      setCaptionPos({ x: nx, y: ny });
    } else {
      setGifOverlays((prev) =>
        prev.map((g) => (g.id === d.overlayId ? { ...g, x: nx, y: ny } : g))
      );
    }
  };

  const onCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = dragOverlayRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    dragOverlayRef.current = null;
  };

  const handleGifFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
        x: 0.75,
        y: 0.8,
        scale: 1,
        rotDeg: 0,
        startSec: 0,
        endSec: null,
      };
      setGifOverlays((prev) => [...prev, ov]);
      setSelectedOverlayId(ov.id);
      setActivePopover('none');
    } catch {
      setStatusNote('Не удалось открыть файл');
    }
  };

  const handleExtraVideoPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    sfxUiTap();
    const url = URL.createObjectURL(file);
    const probe = document.createElement('video');
    probe.preload = 'metadata';
    probe.src = url;
    const dur = await new Promise<number>((resolve) => {
      probe.onloadedmetadata = () => resolve(probe.duration || 4);
      probe.onerror = () => resolve(4);
      setTimeout(() => resolve(probe.duration || 4), 1500);
    });
    const cleanDur = Math.max(0.5, Math.min(10, Number.isFinite(dur) ? dur : 4));
    setExtraVideoClip({
      id: makeId('ext_vid'),
      kind: 'video',
      label: 'Вставка',
      videoUrl: url,
      blob: file,
      naturalDuration: Number(cleanDur.toFixed(1)),
      trimStart: 0,
      trimEnd: Number(cleanDur.toFixed(1)),
      volume: 1,
      fit: 'cover',
    });
  };

  const addBuiltinReaction = (id: BuiltinGifId, label: string) => {
    sfxUiTap();
    const ov: MontageGifOverlay = {
      id: makeId('gif'),
      kind: 'gif',
      sourceType: 'builtin',
      builtinId: id,
      label,
      x: 0.76,
      y: 0.82,
      scale: 0.95,
      rotDeg: -3,
      startSec: 0,
      endSec: null,
    };
    setGifOverlays((prev) => [...prev, ov]);
    setSelectedOverlayId(ov.id);
    setActivePopover('none');
  };

  const handleShareVideoPrimary = async () => {
    if (exportState) return;

    // Мгновенная 0-мс отправка сырой записи живого прохождения, если она не обрезалась и без стикеров
    const isUntouchedRawReel =
      viewMode === 'playthrough' &&
      Boolean(recordedReel) &&
      !extraVideoClip &&
      overlays.length === 0 &&
      trimStartSec <= 0.15 &&
      Math.abs(trimEndSec - totalDuration) <= 0.2;

    if (isUntouchedRawReel && recordedReel) {
      stopAudioPreview();
      const directOutcome = await shareRecordedReelToGallery(recordedReel);
      if (directOutcome === 'shared') {
        sfxVictory();
        setStatusNote('Видео сохранено / отправлено');
        return;
      }
      if (directOutcome === 'aborted') return;
      const a = document.createElement('a');
      a.href = recordedReel.url;
      a.download = recordedReel.file.name;
      a.click();
      setStatusNote('Видео скачано');
      return;
    }

    sfxUiTap();
    stopAudioPreview();
    setIsPlaying(false);
    setStatusNote(null);
    setExportState({ pct: 3, label: 'Готовим видео…' });

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
        setStatusNote('Видео сохранено / отправлено');
      } else {
        const a = document.createElement('a');
        a.href = res.url;
        a.download = res.file.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.setTimeout(() => URL.revokeObjectURL(res.url), 45_000);
        setStatusNote('Видео сохранено на устройство');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message.toLowerCase() : '';
      if (!msg.includes('abort') && !msg.includes('cancel')) {
        setStatusNote('Отправка отменена');
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
      setStatusNote('Ссылка на игру скопирована');
    }
  };

  const trimmedDuration = Math.max(0.4, trimEndSec - trimStartSec);
  const facePresent =
    Boolean(recordedReel) || Boolean(hasLiveFace) || Boolean(liveFaceSource) || Boolean(faceSnapshotUrl);

  return (
    <div
      className="overlay-backdrop"
      style={{ zIndex: 3400 }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !exportState) {
          stopAudioPreview();
          onClose();
        }
      }}
    >
      {/* Скрытая растеризация карточных портретов */}
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
        ref={gifUploadInputRef}
        type="file"
        accept="image/gif,image/webp,image/png,image/jpeg,video/mp4,video/webm"
        style={{ display: 'none' }}
        onChange={(e) => void handleGifFilePicked(e)}
      />
      <input
        ref={videoUploadInputRef}
        type="file"
        accept="video/*"
        style={{ display: 'none' }}
        onChange={(e) => void handleExtraVideoPicked(e)}
      />

      <div
        className="ending-sheet native-ios-sheet"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 448,
          width: '94vw',
          maxHeight: '94dvh',
          padding: '14px 16px 18px',
          gap: 10,
        }}
      >
        <div className="sheet-grabber-bar" />

        {/* Чистая шапка без нейрослопа */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
          }}
        >
          <h3 className="sheet-serif-title" style={{ margin: 0, fontSize: 20 }}>
            Поделиться видео
          </h3>
          <button
            type="button"
            className="hb-circle-btn"
            disabled={Boolean(exportState)}
            onClick={() => {
              sfxUiTap();
              stopAudioPreview();
              onClose();
            }}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>

        {/* Переключатель 3 представлений */}
        <div className="hub-tabs" role="tablist" style={{ width: '100%' }}>
          <span
            className="hub-tabs-ink"
            aria-hidden="true"
            style={{
              transform: `translateX(${
                viewMode === 'playthrough' ? 0 : viewMode === 'with_history' ? 100 : 200
              }%)`,
            }}
          />
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'playthrough'}
            className={viewMode === 'playthrough' ? 'active' : ''}
            onClick={() => {
              sfxUiTap();
              setViewMode('playthrough');
            }}
          >
            Прохождение
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'with_history'}
            className={viewMode === 'with_history' ? 'active' : ''}
            onClick={() => {
              sfxUiTap();
              setViewMode('with_history');
            }}
          >
            С историей
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'short'}
            className={viewMode === 'short' ? 'active' : ''}
            onClick={() => {
              sfxUiTap();
              setViewMode('short');
            }}
          >
            Короткий
          </button>
        </div>

        {/* Крупное чистое превью видео 9:16 */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            justifyContent: 'center',
            width: '100%',
          }}
        >
          <div style={{ position: 'relative' }}>
            <canvas
              ref={previewCanvasRef}
              width={360}
              height={640}
              onPointerDown={onCanvasPointerDown}
              onPointerMove={onCanvasPointerMove}
              onPointerUp={onCanvasPointerUp}
              onPointerCancel={onCanvasPointerUp}
              style={{
                width: 'min(54vw, 222px)',
                aspectRatio: '9 / 16',
                height: 'auto',
                borderRadius: 16,
                border: '1px solid rgba(255,255,255,0.14)',
                boxShadow: '0 16px 38px rgba(0,0,0,0.55)',
                touchAction: 'none',
                display: 'block',
              }}
            />

            {/* Если человек играл без камеры — кнопка в 1 тап посадить своё живое лицо прямо в кадр */}
            {!facePresent && onRequestEnableFace && (
              <button
                type="button"
                onClick={() => {
                  sfxUiTap();
                  onRequestEnableFace();
                }}
                style={{
                  position: 'absolute',
                  left: '50%',
                  bottom: 10,
                  transform: 'translateX(-50%)',
                  whiteSpace: 'nowrap',
                  padding: '6px 12px',
                  borderRadius: 999,
                  border: '1px solid var(--brass)',
                  background: 'rgba(12, 16, 20, 0.88)',
                  color: '#f4efe4',
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                + Включить своё лицо
              </button>
            )}

            {!isPlaying && !exportState && (
              <button
                type="button"
                onClick={() => setIsPlaying(true)}
                style={{
                  position: 'absolute',
                  top: 10,
                  right: 10,
                  padding: '4px 9px',
                  borderRadius: 999,
                  border: '1px solid rgba(255,255,255,0.22)',
                  background: 'rgba(10, 14, 18, 0.82)',
                  color: '#f4efe4',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                ▶
              </button>
            )}
          </div>
        </div>

        {/* Единая спокойная полоса обрезки [Начало — Конец] */}
        <div
          style={{
            width: '100%',
            padding: '8px 12px',
            borderRadius: 12,
            background: 'var(--bg-elevated)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 11.5,
              color: 'var(--text-dim)',
              marginBottom: 4,
            }}
          >
            <span>Обрезка</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-light)' }}>
              {trimStartSec.toFixed(1)}с — {trimEndSec.toFixed(1)}с ({trimmedDuration.toFixed(1)} сек)
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="range"
              aria-label="Начало ролика"
              min={0}
              max={Math.max(0.1, Number((trimEndSec - 0.5).toFixed(1)))}
              step={0.1}
              value={trimStartSec}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                setTrimStartSec(Math.min(v, trimEndSec - 0.5));
                playheadRef.current = v;
                setPlayheadSec(v);
              }}
              style={{ flex: 1, accentColor: 'var(--brass)' }}
            />
            <input
              type="range"
              aria-label="Конец ролика"
              min={Math.min(totalDuration, Number((trimStartSec + 0.5).toFixed(1)))}
              max={Number(totalDuration.toFixed(1))}
              step={0.1}
              value={trimEndSec}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                setTrimEndSec(Math.max(v, trimStartSec + 0.5));
                playheadRef.current = Math.max(trimStartSec, v - 0.3);
                setPlayheadSec(Math.max(trimStartSec, v - 0.3));
              }}
              style={{ flex: 1, accentColor: 'var(--brass)' }}
            />
          </div>
        </div>

        {/* Компактный ряд необязательных добавок (раскрываются только по клику) */}
        <div className="ios-context-chips" style={{ width: '100%', padding: 0 }}>
          <button
            type="button"
            className={activePopover === 'caption' || Boolean(captionText) ? 'on' : ''}
            onClick={() => {
              sfxUiTap();
              setActivePopover((p) => (p === 'caption' ? 'none' : 'caption'));
            }}
          >
            {captionText ? 'Подпись ✓' : '+ Подпись'}
          </button>

          <button
            type="button"
            className={activePopover === 'gif' || gifOverlays.length > 0 ? 'on' : ''}
            onClick={() => {
              sfxUiTap();
              setActivePopover((p) => (p === 'gif' ? 'none' : 'gif'));
            }}
          >
            {gifOverlays.length > 0 ? `Гифка (${gifOverlays.length})` : '+ Гифка'}
          </button>

          {viewMode === 'with_history' && selectedCase && (
            <button
              type="button"
              className={activePopover === 'history' ? 'on' : ''}
              onClick={() => {
                sfxUiTap();
                setActivePopover((p) => (p === 'history' ? 'none' : 'history'));
              }}
            >
              История: {selectedCase.person.split(' ').slice(-1)[0]}
            </button>
          )}

          <button
            type="button"
            className={extraVideoClip ? 'on' : ''}
            onClick={() => {
              sfxUiTap();
              if (extraVideoClip) setExtraVideoClip(null);
              else videoUploadInputRef.current?.click();
            }}
          >
            {extraVideoClip ? 'Своё видео ×' : '+ Видео'}
          </button>
        </div>

        {/* Мини-панель «Подпись» */}
        {activePopover === 'caption' && (
          <div
            style={{
              width: '100%',
              padding: 10,
              borderRadius: 12,
              background: 'var(--bg-elevated)',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="text"
                placeholder="Короткая подпись сверху…"
                value={captionText}
                maxLength={70}
                onChange={(e) => setCaptionText(e.target.value)}
                style={{
                  flex: 1,
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.16)',
                  background: 'rgba(0,0,0,0.22)',
                  color: '#f4efe4',
                  fontSize: 12.5,
                }}
              />
              {captionText && (
                <button
                  type="button"
                  className="cta-btn subtle"
                  style={{ width: 'auto', padding: '0 10px', fontSize: 12 }}
                  onClick={() => setCaptionText('')}
                >
                  Убрать
                </button>
              )}
            </div>
            <div className="ios-context-chips" style={{ padding: 0 }}>
              {presets.map((pr, idx) => (
                <button key={idx} type="button" onClick={() => setCaptionText(pr)}>
                  {pr.slice(0, 26)}…
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Мини-панель «Гифка» */}
        {activePopover === 'gif' && (
          <div
            style={{
              width: '100%',
              padding: 10,
              borderRadius: 12,
              background: 'var(--bg-elevated)',
              display: 'flex',
              flexDirection: 'column',
              gap: 7,
            }}
          >
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                className="cta-btn subtle"
                style={{ flex: 1, padding: '7px 10px', fontSize: 12 }}
                onClick={() => gifUploadInputRef.current?.click()}
              >
                Загрузить свою GIF / мем
              </button>
              {gifOverlays.length > 0 && (
                <button
                  type="button"
                  className="cta-btn subtle"
                  style={{
                    width: 'auto',
                    padding: '7px 10px',
                    fontSize: 12,
                    color: 'var(--vermilion-light)',
                  }}
                  onClick={() => {
                    setGifOverlays([]);
                    setSelectedOverlayId(null);
                  }}
                >
                  Очистить
                </button>
              )}
            </div>
            <div className="ios-context-chips" style={{ padding: 0 }}>
              {BUILTIN_ANIMATED_GIFS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => addBuiltinReaction(g.id, g.label)}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Мини-панель выбора героя для режима «С историей» */}
        {activePopover === 'history' && viewMode === 'with_history' && (
          <div
            style={{
              width: '100%',
              padding: 10,
              borderRadius: 12,
              background: 'var(--bg-elevated)',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <div className="ios-context-chips" style={{ padding: 0 }}>
              {allPackCases.map((rc, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={selectedCase?.person === rc.person ? 'on' : ''}
                  onClick={() => {
                    sfxUiTap();
                    setSelectedCase(rc);
                    setCaseLeadText(buildConversationalCaseLead(rc));
                  }}
                >
                  {rc.person} ({rc.year})
                </button>
              ))}
            </div>
            <input
              type="text"
              value={caseLeadText}
              onChange={(e) => setCaseLeadText(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 10px',
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.16)',
                background: 'rgba(0,0,0,0.22)',
                color: '#f4efe4',
                fontSize: 12,
              }}
            />
          </div>
        )}

        {statusNote && (
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--forest-light)',
              textAlign: 'center',
            }}
          >
            {statusNote}
          </div>
        )}

        {/* Главная кнопка «Поделиться видео» */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, width: '100%' }}>
          <button
            type="button"
            className="cta-btn primary big icon-inline-btn"
            disabled={Boolean(exportState)}
            onClick={() => void handleShareVideoPrimary()}
          >
            <IconShare size={18} />
            <span>
              {exportState ? `${exportState.label}` : 'Поделиться видео'}
            </span>
          </button>

          <button type="button" className="cta-btn subtle" onClick={handleCopyGameLink}>
            Скопировать ссылку на игру
          </button>
        </div>
      </div>
    </div>
  );
}
