import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sfxUiTap, sfxVictory } from '../audio';
import { DIRECT_PLAY_SLUGS } from '../game/packs';
import type { RecordedReelResult } from '../game/reelVideoRecorder';
import {
  buildConversationalCaseBody,
  buildConversationalCaseLead,
  buildFallbackSwipesFromPack,
  buildMontageMasterAudioBuffer,
  computeTimelineSpans,
  exportMontageProjectToMp4,
  getAllRealCasesInPack,
  getClipDuration,
  getDefaultHookPresets,
  pickBestRealCaseForHighlight,
  renderMontageFrameAtTime,
  type CaptionVisualStyle,
  type MontageClip,
  type MontageGifOverlay,
  type MontageOverlay,
  type MontageProject,
  type MontageSoundtrackMode,
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
import type { EndingDef, JobPack, Stats } from '../types';
import { EditorialCardPortrait } from './CharacterArt';

interface ShortsCombainModalProps {
  pack: JobPack;
  ending: EndingDef;
  finalStats?: Stats;
  weeksSurvived: number;
  swipes: RunSwipeHighlight[];
  recordedReel?: RecordedReelResult | null;
  faceSnapshotUrl?: string | null;
  onClose: () => void;
}

type StudioTab = 'clips' | 'gifs' | 'text' | 'audio';

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

  // Стартовая сборка монтажной дорожки (автосклейка: геймплей/видео -> реальный кейс -> вердикт -> QR)
  const [clips, setClips] = useState<MontageClip[]>(() => {
    const initial: MontageClip[] = [];

    if (recordedReel && recordedReel.durationSec > 0.5) {
      const natDur = Math.max(1, recordedReel.durationSec);
      const tStart = natDur > 7.5 ? Math.max(0, natDur - 6.5) : 0;
      initial.push({
        id: makeId('vid'),
        kind: 'video',
        label: 'Запись игры с лицом',
        videoUrl: recordedReel.url,
        blob: recordedReel.blob,
        naturalDuration: natDur,
        trimStart: Number(tStart.toFixed(1)),
        trimEnd: Number(natDur.toFixed(1)),
        volume: 1,
        fit: 'cover',
      });
    } else {
      const pickedSwipes = usableSwipes.slice(-2);
      pickedSwipes.forEach((sw) => {
        initial.push({
          id: makeId('sw'),
          kind: 'swipe',
          swipe: sw,
          duration: 2.3,
        });
      });
    }

    const bestCase = pickBestRealCaseForHighlight(pack, usableSwipes);
    if (bestCase) {
      initial.push({
        id: makeId('rc'),
        kind: 'real_case',
        realCase: bestCase.realCase,
        playerMatched: bestCase.playerMatched,
        leadText: buildConversationalCaseLead(bestCase.realCase, bestCase.playerMatched),
        bodyText: buildConversationalCaseBody(bestCase.realCase),
        duration: 4.5,
      });
    }

    initial.push({
      id: makeId('end'),
      kind: 'ending',
      duration: 1.9,
    });

    initial.push({
      id: makeId('qr'),
      kind: 'qr',
      duration: 0.45,
    });

    return initial;
  });

  const [overlays, setOverlays] = useState<MontageOverlay[]>(() => [
    {
      id: 'hook_main',
      kind: 'text',
      text: presets[0] || 'Одно решение изменило всю смену',
      style: 'paper',
      x: 0.5,
      y: 0.088,
      scale: 0.94,
      rotDeg: 0,
      startSec: 0,
      endSec: null,
    },
    {
      id: 'gif_starter',
      kind: 'gif',
      sourceType: 'builtin',
      builtinId: ending.isVictory ? 'shades_deal' : 'chair_fire',
      label: ending.isVictory ? 'Холодный расчёт' : 'Кресло в огне',
      x: 0.78,
      y: 0.85,
      scale: 0.95,
      rotDeg: -4,
      startSec: 0,
      endSec: null,
    },
  ]);

  const [soundtrack, setSoundtrack] = useState<MontageSoundtrackMode>('groove');
  const [activeTab, setActiveTab] = useState<StudioTab>('clips');
  const [selectedClipId, setSelectedClipId] = useState<string>(() => clips[0]?.id ?? '');
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [playheadSec, setPlayheadSec] = useState<number>(0);
  const [exportState, setExportState] = useState<{ pct: number; label: string } | null>(null);
  const [statusNote, setStatusNote] = useState<string | null>(null);

  const customStickersRef = useRef<Map<string, CustomStickerMedia>>(new Map());
  const [customStickerList, setCustomStickerList] = useState<CustomStickerMedia[]>([]);

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const hiddenPortraitsRef = useRef<HTMLDivElement | null>(null);
  const portraitImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const faceImgRef = useRef<HTMLImageElement | null>(null);
  const videoElsRef = useRef<Map<string, HTMLVideoElement>>(new Map());

  const videoUploadInputRef = useRef<HTMLInputElement | null>(null);
  const gifUploadInputRef = useRef<HTMLInputElement | null>(null);

  const playheadRef = useRef<number>(0);
  playheadRef.current = playheadSec;

  const dragOverlayRef = useRef<{
    overlayId: string;
    pointerId: number;
    startClientX: number;
    startClientY: number;
    origX: number;
    origY: number;
    moved: boolean;
  } | null>(null);

  // Живое аудио-превью при нажатии Play
  const audioPreviewCtxRef = useRef<AudioContext | null>(null);
  const audioPreviewSrcRef = useRef<AudioBufferSourceNode | null>(null);

  const project = useMemo<MontageProject>(
    () => ({
      pack,
      ending,
      finalStats,
      weeksSurvived,
      clips,
      overlays,
      soundtrack,
      faceSnapshotUrl,
    }),
    [pack, ending, finalStats, weeksSurvived, clips, overlays, soundtrack, faceSnapshotUrl]
  );

  const { spans, totalDuration } = useMemo(() => computeTimelineSpans(clips), [clips]);

  const activeClipSpan = useMemo(
    () => spans.find((s) => s.clip.id === selectedClipId) ?? spans[0] ?? null,
    [selectedClipId, spans]
  );

  const selectedOverlay = useMemo(
    () => overlays.find((o) => o.id === selectedOverlayId) ?? null,
    [overlays, selectedOverlayId]
  );

  // Список всех уникальных портретов для скрытой SVG->Image растеризации
  const portraitTargets = useMemo(() => {
    const items: Array<{ key: string; cardId: string; speaker: string; blockNum: number }> = [];
    const seen = new Set<string>();
    const push = (key: string, cardId: string, speaker: string, blockNum: number) => {
      if (seen.has(key)) return;
      seen.add(key);
      items.push({ key, cardId, speaker, blockNum });
    };

    usableSwipes.forEach((sw) => {
      const k = `card_${sw.cardId ?? sw.speaker}`;
      push(k, sw.cardId ?? sw.speaker, sw.speaker, sw.blockNum ?? 2);
    });
    clips.forEach((cl) => {
      if (cl.kind === 'swipe') {
        const k = `card_${cl.swipe.cardId ?? cl.swipe.speaker}`;
        push(k, cl.swipe.cardId ?? cl.swipe.speaker, cl.swipe.speaker, cl.swipe.blockNum ?? 2);
      } else if (cl.kind === 'real_case') {
        push(`rc_${cl.realCase.person}`, `rc_${cl.realCase.person}`, cl.realCase.person, 3);
      }
    });
    allPackCases.forEach((rc) => {
      push(`rc_${rc.person}`, `rc_${rc.person}`, rc.person, 3);
    });
    push(`ending_${ending.id}`, ending.id, ending.title, 3);
    return items;
  }, [allPackCases, clips, ending.id, ending.title, usableSwipes]);

  // Конвертируем отрендеренные скрытые SVG-портреты в быстрые HTMLImageElement для Canvas
  useEffect(() => {
    const root = hiddenPortraitsRef.current;
    if (!root) return;
    const nodes = root.querySelectorAll('[data-portrait-key]');
    nodes.forEach((node) => {
      const key = node.getAttribute('data-portrait-key');
      if (!key || portraitImagesRef.current.has(key)) return;
      const svgEl = node.querySelector('svg');
      if (!svgEl) return;
      try {
        const xml = new XMLSerializer().serializeToString(svgEl);
        const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
        const im = new Image();
        im.onload = () => {
          portraitImagesRef.current.set(key, im);
        };
        im.src = url;
      } catch {
        // ignore
      }
    });
  }, [portraitTargets]);

  // Загрузка селфи/лица
  useEffect(() => {
    if (!faceSnapshotUrl) {
      faceImgRef.current = null;
      return;
    }
    const im = new Image();
    im.onload = () => {
      faceImgRef.current = im;
    };
    im.src = faceSnapshotUrl;
  }, [faceSnapshotUrl]);

  // Управление скрытыми <video> элементами для всех видеоклипов на дорожке
  useEffect(() => {
    const activeVideoIds = new Set<string>();
    clips.forEach((cl) => {
      if (cl.kind !== 'video') return;
      activeVideoIds.add(cl.id);
      if (!videoElsRef.current.has(cl.id)) {
        const v = document.createElement('video');
        v.src = cl.videoUrl;
        v.muted = true; // Звук микшируется через мастер-дорожку
        v.playsInline = true;
        v.preload = 'auto';
        v.load();
        videoElsRef.current.set(cl.id, v);
      }
    });
    videoElsRef.current.forEach((v, id) => {
      if (!activeVideoIds.has(id)) {
        v.pause();
        v.removeAttribute('src');
        videoElsRef.current.delete(id);
      }
    });
  }, [clips]);

  // Очистка при закрытии редактора
  useEffect(() => {
    return () => {
      audioPreviewSrcRef.current?.stop();
      void audioPreviewCtxRef.current?.close();
      videoElsRef.current.forEach((v) => v.pause());
      customStickersRef.current.forEach((m) => {
        m.videoEl?.pause();
        if (m.objectUrl) URL.revokeObjectURL(m.objectUrl);
      });
    };
  }, []);

  const stopLiveAudioPreview = useCallback(() => {
    try {
      audioPreviewSrcRef.current?.stop();
    } catch {
      // ignore
    }
    audioPreviewSrcRef.current = null;
  }, []);

  const startLiveAudioPreviewFrom = useCallback(
    async (offsetSec: number) => {
      stopLiveAudioPreview();
      if (project.soundtrack === 'mute') {
        const hasVidVol = project.clips.some((c) => c.kind === 'video' && c.volume > 0.01);
        if (!hasVidVol) return;
      }
      try {
        const buf = await buildMontageMasterAudioBuffer(project);
        if (!buf) return;
        if (!audioPreviewCtxRef.current || audioPreviewCtxRef.current.state === 'closed') {
          audioPreviewCtxRef.current = new AudioContext();
        }
        const ctx = audioPreviewCtxRef.current;
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        src.connect(ctx.destination);
        const safeOffset = Math.max(0, Math.min(buf.duration - 0.05, offsetSec));
        src.start(0, safeOffset);
        audioPreviewSrcRef.current = src;
      } catch {
        // ignore autoplay restrictions before user tap
      }
    },
    [project, stopLiveAudioPreview]
  );

  // Синхронизация аудио-превью при переключении Play/Pause или смене бита
  useEffect(() => {
    if (isPlaying && !exportState) {
      void startLiveAudioPreviewFrom(playheadRef.current);
    } else {
      stopLiveAudioPreview();
    }
  }, [exportState, isPlaying, soundtrack, startLiveAudioPreviewFrom, stopLiveAudioPreview]);

  // Главный цикл отрисовки интерактивного 9:16 превью
  useEffect(() => {
    let raf = 0;
    let lastTs = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - lastTs) / 1000);
      lastTs = now;

      let curT = playheadRef.current;
      if (isPlaying && !exportState) {
        curT = (curT + dt) % Math.max(0.5, totalDuration);
        playheadRef.current = curT;
        setPlayheadSec(curT);
      }

      // Синхронизируем HTMLVideoElement текущего клипа
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
  }, [exportState, isPlaying, project, selectedOverlayId, spans, totalDuration]);

  // Обработка перетаскивания гифок и титров пальцем прямо по 9:16 холсту
  const handleStagePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = previewCanvasRef.current;
    if (!canvas || exportState) return;
    const rect = canvas.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    const t = playheadRef.current;

    // Ищем верхний видимый оверлей под пальцем
    const hit = [...overlays].reverse().find((ov) => {
      if (t < ov.startSec || (ov.endSec !== null && t > ov.endSec)) return false;
      const rx = ov.kind === 'text' ? 0.36 * ov.scale : 0.16 * ov.scale;
      const ry = ov.kind === 'text' ? 0.065 * ov.scale : 0.1 * ov.scale;
      return Math.abs(nx - ov.x) <= rx && Math.abs(ny - ov.y) <= ry;
    });

    if (hit) {
      sfxUiTap();
      setSelectedOverlayId(hit.id);
      setActiveTab(hit.kind === 'gif' ? 'gifs' : 'text');
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
        moved: false,
      };
    } else {
      setSelectedOverlayId(null);
      setIsPlaying((p) => !p);
    }
  };

  const handleStagePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = dragOverlayRef.current;
    const canvas = previewCanvasRef.current;
    if (!d || !canvas || d.pointerId !== e.pointerId) return;
    const rect = canvas.getBoundingClientRect();
    const dx = (e.clientX - d.startClientX) / rect.width;
    const dy = (e.clientY - d.startClientY) / rect.height;
    if (Math.hypot(dx, dy) > 0.008) d.moved = true;

    const nextX = Math.max(0.08, Math.min(0.92, d.origX + dx));
    const nextY = Math.max(0.06, Math.min(0.93, d.origY + dy));
    setOverlays((prev) =>
      prev.map((o) => (o.id === d.overlayId ? { ...o, x: nextX, y: nextY } : o))
    );
  };

  const handleStagePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = dragOverlayRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    dragOverlayRef.current = null;
  };

  // Загрузка любого пользовательского видео (.mp4 / .mov / .webm) для склейки и обрезки
  const handleVideoFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    sfxUiTap();
    const url = URL.createObjectURL(file);
    const probe = document.createElement('video');
    probe.preload = 'metadata';
    probe.src = url;
    const dur = await new Promise<number>((resolve) => {
      probe.onloadedmetadata = () => resolve(probe.duration || 5);
      probe.onerror = () => resolve(5);
      setTimeout(() => resolve(probe.duration || 5), 1800);
    });
    const cleanDur = Number.isFinite(dur) && dur > 0.4 ? dur : 5;
    const trimEnd = Number(Math.min(cleanDur, 8).toFixed(1));
    const newClip: MontageVideoClip = {
      id: makeId('vid'),
      kind: 'video',
      label: file.name.slice(0, 20) || 'Видеовставка',
      videoUrl: url,
      blob: file,
      naturalDuration: Number(cleanDur.toFixed(1)),
      trimStart: 0,
      trimEnd,
      volume: 1,
      fit: 'cover',
    };

    // Вставляем сразу после активного клипа (чтобы легко склеивать сцены)
    setClips((prev) => {
      const idx = prev.findIndex((c) => c.id === selectedClipId);
      if (idx === -1) return [newClip, ...prev];
      const copy = [...prev];
      copy.splice(idx + 1, 0, newClip);
      return copy;
    });
    setSelectedClipId(newClip.id);
    setActiveTab('clips');
    setIsPlaying(false);
    setStatusNote('Видео добавлено на дорожку — настройте обрезку ползунками ниже');
  };

  // Загрузка пользовательской GIF / WebP / PNG / видео-реакции
  const handleGifFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    sfxUiTap();
    setStatusNote('Распаковка кадров анимации…');
    try {
      const decoded = await decodeUploadedStickerMedia(file);
      customStickersRef.current.set(decoded.id, decoded);
      setCustomStickerList((prev) => [...prev, decoded]);

      const newOv: MontageGifOverlay = {
        id: makeId('ov_cust'),
        kind: 'gif',
        sourceType: 'custom',
        customMediaId: decoded.id,
        label: file.name.slice(0, 18),
        x: 0.5,
        y: 0.78,
        scale: 1,
        rotDeg: 0,
        startSec: 0,
        endSec: null,
      };
      setOverlays((prev) => [...prev, newOv]);
      setSelectedOverlayId(newOv.id);
      setActiveTab('gifs');
      setStatusNote(
        decoded.kind === 'animated_frames'
          ? `GIF добавлена (${decoded.frames?.length ?? 1} кадров) — двигайте пальцем по экрану`
          : 'Стикер добавлен — двигайте пальцем по экрану'
      );
    } catch {
      setStatusNote('Не удалось прочитать файл стикера');
    }
  };

  const addBuiltinGif = (gifId: BuiltinGifId, label: string) => {
    sfxUiTap();
    const newOv: MontageGifOverlay = {
      id: makeId('ov_gif'),
      kind: 'gif',
      sourceType: 'builtin',
      builtinId: gifId,
      label,
      x: 0.74,
      y: 0.82,
      scale: 1,
      rotDeg: -3,
      startSec: activeClipSpan ? Number(activeClipSpan.startSec.toFixed(1)) : 0,
      endSec: null,
    };
    setOverlays((prev) => [...prev, newOv]);
    setSelectedOverlayId(newOv.id);
  };

  const addFloatingText = () => {
    sfxUiTap();
    const newTxt: MontageTextOverlay = {
      id: makeId('ov_txt'),
      kind: 'text',
      text: 'Вот тут всё и посыпалось',
      style: 'stories_dark',
      x: 0.5,
      y: 0.22,
      scale: 0.9,
      rotDeg: 0,
      startSec: activeClipSpan ? Number(activeClipSpan.startSec.toFixed(1)) : 0,
      endSec: activeClipSpan ? Number(activeClipSpan.endSec.toFixed(1)) : null,
    };
    setOverlays((prev) => [...prev, newTxt]);
    setSelectedOverlayId(newTxt.id);
    setActiveTab('text');
  };

  // Разрезание видеоклипа на две части в точке курсора (чтобы вставить между ними реальный кейс!)
  const handleSplitActiveVideoClip = () => {
    if (!activeClipSpan || activeClipSpan.clip.kind !== 'video') return;
    const vidClip = activeClipSpan.clip;
    const localOffset = playheadSec - activeClipSpan.startSec;
    const splitPoint =
      localOffset > 0.4 && localOffset < activeClipSpan.duration - 0.4
        ? vidClip.trimStart + localOffset
        : (vidClip.trimStart + vidClip.trimEnd) / 2;

    if (splitPoint - vidClip.trimStart < 0.35 || vidClip.trimEnd - splitPoint < 0.35) {
      setStatusNote('Слишком короткий фрагмент для разреза');
      return;
    }

    sfxUiTap();
    const partA: MontageVideoClip = {
      ...vidClip,
      trimEnd: Number(splitPoint.toFixed(2)),
      label: `${vidClip.label} (ч.1)`,
    };
    const partB: MontageVideoClip = {
      ...vidClip,
      id: makeId('vid'),
      trimStart: Number(splitPoint.toFixed(2)),
      label: `${vidClip.label} (ч.2)`,
    };
    setClips((prev) => {
      const idx = prev.findIndex((c) => c.id === vidClip.id);
      if (idx === -1) return prev;
      const copy = [...prev];
      copy.splice(idx, 1, partA, partB);
      return copy;
    });
    setStatusNote('Видео разрезано на 2 сцены — между ними можно поставить исторический кейс');
  };

  const moveClip = (clipId: string, dir: -1 | 1) => {
    sfxUiTap();
    setClips((prev) => {
      const idx = prev.findIndex((c) => c.id === clipId);
      const nextIdx = idx + dir;
      if (idx < 0 || nextIdx < 0 || nextIdx >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[nextIdx]] = [copy[nextIdx], copy[idx]];
      return copy;
    });
  };

  const deleteClip = (clipId: string) => {
    if (clips.length <= 1) return;
    sfxUiTap();
    setClips((prev) => {
      const next = prev.filter((c) => c.id !== clipId);
      if (selectedClipId === clipId && next[0]) {
        setSelectedClipId(next[0].id);
      }
      return next;
    });
  };

  const addRealCaseScene = () => {
    const rc = allPackCases[0];
    if (!rc) return;
    sfxUiTap();
    const newCase: MontageClip = {
      id: makeId('rc'),
      kind: 'real_case',
      realCase: rc,
      leadText: buildConversationalCaseLead(rc),
      bodyText: buildConversationalCaseBody(rc),
      duration: 4.5,
    };
    setClips((prev) => {
      const idx = prev.findIndex((c) => c.id === selectedClipId);
      if (idx === -1) return [...prev, newCase];
      const copy = [...prev];
      copy.splice(idx + 1, 0, newCase);
      return copy;
    });
    setSelectedClipId(newCase.id);
    setActiveTab('clips');
  };

  const addSwipeScene = () => {
    const sw = usableSwipes[usableSwipes.length - 1];
    if (!sw) return;
    sfxUiTap();
    const newSw: MontageClip = {
      id: makeId('sw'),
      kind: 'swipe',
      swipe: sw,
      duration: 2.3,
    };
    setClips((prev) => {
      const idx = prev.findIndex((c) => c.id === selectedClipId);
      if (idx === -1) return [newSw, ...prev];
      const copy = [...prev];
      copy.splice(idx + 1, 0, newSw);
      return copy;
    });
    setSelectedClipId(newSw.id);
    setActiveTab('clips');
  };

  const handleExportMp4 = async () => {
    if (exportState) return;
    sfxUiTap();
    stopLiveAudioPreview();
    setIsPlaying(false);
    setStatusNote(null);
    setExportState({ pct: 2, label: 'Подготовка сцен…' });

    try {
      const res = await exportMontageProjectToMp4(
        project,
        {
          portraits: portraitImagesRef.current,
          faceImg: faceImgRef.current,
          customStickers: customStickersRef.current,
        },
        videoElsRef.current,
        (pct, label) => setExportState({ pct, label })
      );
      sfxVictory();

      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (typeof nav.share === 'function' && nav.canShare?.({ files: [res.file] })) {
        await nav.share({ files: [res.file] });
        setStatusNote('Ролик сохранён / отправлен!');
      } else {
        const a = document.createElement('a');
        a.href = res.url;
        a.download = res.file.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.setTimeout(() => URL.revokeObjectURL(res.url), 45_000);
        setStatusNote('Готовый MP4 скачан — загружайте в Stories / Shorts / Reels!');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message.toLowerCase() : '';
      if (!msg.includes('abort') && !msg.includes('cancel')) {
        setStatusNote('Не удалось завершить экспорт в этом окне');
      }
    } finally {
      setExportState(null);
    }
  };

  const handleShareTelegramLink = () => {
    sfxUiTap();
    const slug = DIRECT_PLAY_SLUGS[pack.id] || pack.id;
    const url = getTelegramBotAppUrl(`play_${slug}`);
    const hookOv = overlays.find((o) => o.kind === 'text');
    const hookLine =
      hookOv && hookOv.kind === 'text' ? hookOv.text : `Попробуй удержать кресло в «${pack.title}»`;
    const shareText = `${hookLine} — сразу в игру:`;
    if (!shareLinkViaTelegramOrNative(url, shareText)) {
      void navigator.clipboard?.writeText(`${shareText} ${url}`);
      setStatusNote('Прямая Telegram-ссылка скопирована');
    }
  };

  const hasQrScene = clips.some((c) => c.kind === 'qr');

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 3400,
        background: 'var(--bg-canvas)',
        color: 'var(--text-light)',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      {/* Скрытый контейнер для мгновенной растеризации настоящих SVG-портретов в Canvas */}
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
            />
          </div>
        ))}
      </div>

      <input
        ref={videoUploadInputRef}
        type="file"
        accept="video/*"
        style={{ display: 'none' }}
        onChange={(e) => void handleVideoFilePicked(e)}
      />
      <input
        ref={gifUploadInputRef}
        type="file"
        accept="image/gif,image/webp,image/png,image/jpeg,video/mp4,video/webm"
        style={{ display: 'none' }}
        onChange={(e) => void handleGifFilePicked(e)}
      />

      <div
        className="reigns-shell"
        style={{
          maxWidth: 500,
          height: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Верхняя студийная панель */}
        <header
          className="top-bar unified-bar"
          style={{
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            paddingBottom: 8,
          }}
        >
          <button
            type="button"
            className="hb-circle-btn"
            disabled={Boolean(exportState)}
            onClick={() => {
              sfxUiTap();
              stopLiveAudioPreview();
              onClose();
            }}
            aria-label="Закрыть студию"
          >
            ×
          </button>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 13.5, fontWeight: 800 }}>Монтаж Stories · 9:16 HD</div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10.5,
                color: 'var(--text-dim)',
              }}
            >
              {clips.length} сцен · {totalDuration.toFixed(1)} сек · со звуком
            </div>
          </div>

          <button
            type="button"
            disabled={Boolean(exportState)}
            onClick={() => void handleExportMp4()}
            style={{
              height: 34,
              padding: '0 13px',
              borderRadius: 999,
              border: 'none',
              background: 'var(--brass)',
              color: '#141210',
              fontFamily: 'var(--font-sans)',
              fontSize: 12.5,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            {exportState ? `${exportState.pct}%` : 'Экспорт MP4'}
          </button>
        </header>

        {/* Интерактивный экран 9:16 (тап = пауза/плей, перетаскивание гифок и титров пальцем!) */}
        <div
          style={{
            flex: '0 0 auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '8px 12px 6px',
          }}
        >
          <div style={{ position: 'relative' }}>
            <canvas
              ref={previewCanvasRef}
              width={360}
              height={640}
              onPointerDown={handleStagePointerDown}
              onPointerMove={handleStagePointerMove}
              onPointerUp={handleStagePointerUp}
              onPointerCancel={handleStagePointerUp}
              style={{
                width: 'min(45vw, 196px)',
                aspectRatio: '9 / 16',
                height: 'auto',
                borderRadius: 16,
                border: '1px solid var(--brass-soft)',
                boxShadow: '0 14px 36px rgba(0,0,0,0.58)',
                touchAction: 'none',
                cursor: 'grab',
                display: 'block',
              }}
            />

            {!isPlaying && !exportState && (
              <button
                type="button"
                onClick={() => setIsPlaying(true)}
                style={{
                  position: 'absolute',
                  right: 8,
                  bottom: 8,
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
                ▶ Плей
              </button>
            )}
          </div>
        </div>

        {/* Таймлайн-скруббер + монтажная дорожка клипов */}
        <div
          style={{
            flexShrink: 0,
            padding: '4px 14px 8px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <button
              type="button"
              onClick={() => {
                sfxUiTap();
                setIsPlaying((p) => !p);
              }}
              style={{
                width: 30,
                height: 28,
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.16)',
                background: 'var(--bg-elevated)',
                color: 'var(--text-light)',
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              {isPlaying ? '❚❚' : '▶'}
            </button>

            <input
              type="range"
              min={0}
              max={Number(totalDuration.toFixed(2))}
              step={0.05}
              value={Math.min(totalDuration, playheadSec)}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                setIsPlaying(false);
                playheadRef.current = v;
                setPlayheadSec(v);
              }}
              style={{ flex: 1, accentColor: 'var(--brass)' }}
            />

            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--text-dim)',
                minWidth: 68,
                textAlign: 'right',
              }}
            >
              {playheadSec.toFixed(1)}/{totalDuration.toFixed(1)}с
            </span>
          </div>

          {/* Горизонтальная лента сцен для склейки */}
          <div
            style={{
              display: 'flex',
              gap: 6,
              overflowX: 'auto',
              paddingBottom: 2,
              alignItems: 'center',
            }}
          >
            {spans.map((sp) => {
              const isSel = sp.clip.id === activeClipSpan?.clip.id;
              const isCurPlay = playheadSec >= sp.startSec && playheadSec < sp.endSec;
              const badge =
                sp.clip.kind === 'video'
                  ? `Видео · ${sp.duration.toFixed(1)}с`
                  : sp.clip.kind === 'swipe'
                    ? `Смена ${sp.clip.swipe.week} · ${sp.duration.toFixed(1)}с`
                    : sp.clip.kind === 'real_case'
                      ? `Кейс: ${sp.clip.realCase.person.split(' ').slice(-1)[0]} · ${sp.duration.toFixed(1)}с`
                      : sp.clip.kind === 'ending'
                        ? `Финал · ${sp.duration.toFixed(1)}с`
                        : 'QR · 0.4с';

              return (
                <button
                  key={sp.clip.id}
                  type="button"
                  onClick={() => {
                    sfxUiTap();
                    setSelectedClipId(sp.clip.id);
                    setActiveTab('clips');
                    playheadRef.current = sp.startSec + 0.02;
                    setPlayheadSec(sp.startSec + 0.02);
                  }}
                  style={{
                    flexShrink: 0,
                    padding: '6px 10px',
                    borderRadius: 9,
                    border: isSel
                      ? '1.5px solid var(--brass)'
                      : isCurPlay
                        ? '1px solid rgba(255,255,255,0.34)'
                        : '1px solid rgba(255,255,255,0.12)',
                    background: isSel ? 'var(--brass-soft)' : 'var(--bg-elevated)',
                    color: 'var(--text-light)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {badge}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => videoUploadInputRef.current?.click()}
              style={{
                flexShrink: 0,
                padding: '6px 10px',
                borderRadius: 9,
                border: '1px dashed var(--brass)',
                background: 'transparent',
                color: 'var(--brass)',
                fontSize: 11.5,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              + Видео
            </button>
            <button
              type="button"
              onClick={addRealCaseScene}
              style={{
                flexShrink: 0,
                padding: '6px 10px',
                borderRadius: 9,
                border: '1px dashed rgba(255,255,255,0.25)',
                background: 'transparent',
                color: 'var(--text-light)',
                fontSize: 11.5,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              + Кейс
            </button>
            <button
              type="button"
              onClick={addSwipeScene}
              style={{
                flexShrink: 0,
                padding: '6px 10px',
                borderRadius: 9,
                border: '1px dashed rgba(255,255,255,0.25)',
                background: 'transparent',
                color: 'var(--text-light)',
                fontSize: 11.5,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              + Смена
            </button>
          </div>
        </div>

        {/* Переключатель 4 вкладок инспектора */}
        <div className="hub-tabs" role="tablist" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {(
            [
              ['clips', 'Сцены'],
              ['gifs', 'Гифки'],
              ['text', 'Титры'],
              ['audio', 'Экспорт'],
            ] as [StudioTab, string][]
          ).map(([tk, label]) => (
            <button
              key={tk}
              type="button"
              role="tab"
              aria-selected={activeTab === tk}
              className={activeTab === tk ? 'active' : ''}
              onClick={() => {
                sfxUiTap();
                setActiveTab(tk);
              }}
              style={{ fontSize: 12.5 }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Нижняя рабочая панель инструментов */}
        <div
          className="apple-cards-scroll"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: '10px 14px calc(env(safe-area-inset-bottom, 0px) + 18px)',
          }}
        >
          {statusNote && (
            <div
              style={{
                padding: '7px 10px',
                borderRadius: 9,
                background: 'rgba(108, 196, 161, 0.14)',
                border: '1px solid rgba(108, 196, 161, 0.35)',
                color: 'var(--forest-light)',
                fontSize: 11.5,
                fontWeight: 700,
                marginBottom: 8,
              }}
            >
              {statusNote}
            </div>
          )}

          {exportState && (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--brass)',
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 12,
                  fontWeight: 700,
                  marginBottom: 6,
                }}
              >
                <span>{exportState.label}</span>
                <span>{exportState.pct}%</span>
              </div>
              <div
                style={{
                  height: 6,
                  borderRadius: 99,
                  background: 'rgba(255,255,255,0.1)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${exportState.pct}%`,
                    height: '100%',
                    background: 'var(--brass)',
                    transition: 'width 0.15s ease',
                  }}
                />
              </div>
            </div>
          )}

          {/* ВКЛАДКА 1: СЦЕНЫ, ОБРЕЗКА ВИДЕО И ИСТОРИЧЕСКАЯ ВСТАВКА */}
          {activeTab === 'clips' && activeClipSpan && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="cta-btn subtle"
                  style={{ flex: 1, padding: '7px 10px', fontSize: 12 }}
                  onClick={() => moveClip(activeClipSpan.clip.id, -1)}
                >
                  ← Сдвинуть раньше
                </button>
                <button
                  type="button"
                  className="cta-btn subtle"
                  style={{ flex: 1, padding: '7px 10px', fontSize: 12 }}
                  onClick={() => moveClip(activeClipSpan.clip.id, 1)}
                >
                  Сдвинуть позже →
                </button>
                {clips.length > 1 && (
                  <button
                    type="button"
                    className="cta-btn subtle"
                    style={{
                      padding: '7px 12px',
                      fontSize: 12,
                      color: 'var(--vermilion-light)',
                    }}
                    onClick={() => deleteClip(activeClipSpan.clip.id)}
                  >
                    Удалить
                  </button>
                )}
              </div>

              {/* Инспектор ОБРЕЗКИ ВИДЕОКЛИПА */}
              {activeClipSpan.clip.kind === 'video' && (() => {
                const vc = activeClipSpan.clip;
                return (
                  <div
                    style={{
                      padding: 12,
                      borderRadius: 12,
                      background: 'var(--bg-elevated)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 9,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 12,
                        fontWeight: 800,
                      }}
                    >
                      <span>Обрезка видеофрагмента</span>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--brass)' }}>
                        {vc.trimStart.toFixed(1)}с — {vc.trimEnd.toFixed(1)}с (
                        {(vc.trimEnd - vc.trimStart).toFixed(1)}с)
                      </span>
                    </div>

                    <label style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>
                      Начало фрагмента ({vc.trimStart.toFixed(1)} сек):
                      <input
                        type="range"
                        min={0}
                        max={Math.max(0.1, vc.trimEnd - 0.5)}
                        step={0.1}
                        value={vc.trimStart}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          setIsPlaying(false);
                          setClips((prev) =>
                            prev.map((c) =>
                              c.id === vc.id && c.kind === 'video'
                                ? { ...c, trimStart: Math.min(v, c.trimEnd - 0.5) }
                                : c
                            )
                          );
                          playheadRef.current = activeClipSpan.startSec + 0.02;
                          setPlayheadSec(activeClipSpan.startSec + 0.02);
                        }}
                        style={{ width: '100%', accentColor: 'var(--brass)' }}
                      />
                    </label>

                    <label style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>
                      Конец фрагмента ({vc.trimEnd.toFixed(1)} из {vc.naturalDuration.toFixed(1)} сек):
                      <input
                        type="range"
                        min={Math.min(vc.naturalDuration, vc.trimStart + 0.5)}
                        max={vc.naturalDuration}
                        step={0.1}
                        value={vc.trimEnd}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          setIsPlaying(false);
                          const newDur = Math.max(0.5, v - vc.trimStart);
                          setClips((prev) =>
                            prev.map((c) =>
                              c.id === vc.id && c.kind === 'video'
                                ? { ...c, trimEnd: Math.max(v, c.trimStart + 0.5) }
                                : c
                            )
                          );
                          playheadRef.current = activeClipSpan.startSec + Math.max(0, newDur - 0.08);
                          setPlayheadSec(activeClipSpan.startSec + Math.max(0, newDur - 0.08));
                        }}
                        style={{ width: '100%', accentColor: 'var(--brass)' }}
                      />
                    </label>

                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        className="cta-btn subtle"
                        style={{ flex: 1, fontSize: 12, padding: '8px 10px' }}
                        onClick={handleSplitActiveVideoClip}
                      >
                        Разрезать по курсору (на 2 части)
                      </button>
                      <button
                        type="button"
                        className="cta-btn subtle"
                        style={{ fontSize: 12, padding: '8px 10px' }}
                        onClick={() =>
                          setClips((prev) =>
                            prev.map((c) =>
                              c.id === vc.id && c.kind === 'video'
                                ? { ...c, fit: c.fit === 'cover' ? 'contain' : 'cover' }
                                : c
                            )
                          )
                        }
                      >
                        {vc.fit === 'cover' ? 'Кадр: Заполнить' : 'Кадр: Целиком'}
                      </button>
                    </div>

                    <label style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>
                      Громкость голоса/видео: {Math.round(vc.volume * 100)}%
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={vc.volume}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          setClips((prev) =>
                            prev.map((c) =>
                              c.id === vc.id && c.kind === 'video' ? { ...c, volume: v } : c
                            )
                          );
                        }}
                        style={{ width: '100%', accentColor: 'var(--brass)' }}
                      />
                    </label>
                  </div>
                );
              })()}

              {/* Инспектор ВСТАВКИ ИСТОРИЧЕСКОГО КЕЙСА («А Стивен Янг из Amazon ответил так...») */}
              {activeClipSpan.clip.kind === 'real_case' && (() => {
                const rcClip = activeClipSpan.clip;
                return (
                  <div
                    style={{
                      padding: 12,
                      borderRadius: 12,
                      background: 'var(--bg-elevated)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 800 }}>
                      Историческая вставка (выберите героя или напишите свою подачу):
                    </div>

                    <div className="ios-context-chips" style={{ padding: 0 }}>
                      {allPackCases.map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className={
                            item.person === rcClip.realCase.person &&
                            item.year === rcClip.realCase.year
                              ? 'on'
                              : ''
                          }
                          onClick={() => {
                            sfxUiTap();
                            setClips((prev) =>
                              prev.map((c) =>
                                c.id === rcClip.id && c.kind === 'real_case'
                                  ? {
                                      ...c,
                                      realCase: item,
                                      leadText: buildConversationalCaseLead(item),
                                      bodyText: buildConversationalCaseBody(item),
                                    }
                                  : c
                              )
                            );
                          }}
                        >
                          {item.person} ({item.year})
                        </button>
                      ))}
                    </div>

                    <label style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>
                      Разговорная подводка:
                      <input
                        type="text"
                        value={rcClip.leadText}
                        onChange={(e) => {
                          const val = e.target.value;
                          setClips((prev) =>
                            prev.map((c) =>
                              c.id === rcClip.id && c.kind === 'real_case'
                                ? { ...c, leadText: val }
                                : c
                            )
                          );
                        }}
                        style={{
                          width: '100%',
                          marginTop: 4,
                          padding: '8px 10px',
                          borderRadius: 8,
                          border: '1px solid rgba(255,255,255,0.16)',
                          background: 'rgba(0,0,0,0.22)',
                          color: '#f4efe4',
                          fontSize: 12.5,
                          fontWeight: 600,
                        }}
                      />
                    </label>

                    <label style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>
                      Текст ответа (подсвечивается по словам в кадре):
                      <textarea
                        rows={3}
                        value={rcClip.bodyText}
                        onChange={(e) => {
                          const val = e.target.value;
                          setClips((prev) =>
                            prev.map((c) =>
                              c.id === rcClip.id && c.kind === 'real_case'
                                ? { ...c, bodyText: val }
                                : c
                            )
                          );
                        }}
                        style={{
                          width: '100%',
                          marginTop: 4,
                          padding: '8px 10px',
                          borderRadius: 8,
                          border: '1px solid rgba(255,255,255,0.16)',
                          background: 'rgba(0,0,0,0.22)',
                          color: '#f4efe4',
                          fontFamily: 'var(--font-sans)',
                          fontSize: 12.5,
                          resize: 'vertical',
                        }}
                      />
                    </label>

                    <label style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>
                      Длительность вставки: {rcClip.duration.toFixed(1)} сек
                      <input
                        type="range"
                        min={2.8}
                        max={7.0}
                        step={0.2}
                        value={rcClip.duration}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          setClips((prev) =>
                            prev.map((c) =>
                              c.id === rcClip.id && c.kind === 'real_case'
                                ? { ...c, duration: v }
                                : c
                            )
                          );
                        }}
                        style={{ width: '100%', accentColor: 'var(--brass)' }}
                      />
                    </label>
                  </div>
                );
              })()}

              {/* Инспектор ИГРОВОГО СВАЙПА */}
              {activeClipSpan.clip.kind === 'swipe' && (() => {
                const swClip = activeClipSpan.clip;
                return (
                  <div
                    style={{
                      padding: 12,
                      borderRadius: 12,
                      background: 'var(--bg-elevated)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 800 }}>
                      Выберите момент из вашей партии для этой сцены:
                    </div>
                    <div className="ios-context-chips" style={{ padding: 0 }}>
                      {usableSwipes.map((swItem, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className={
                            swItem.week === swClip.swipe.week && swItem.text === swClip.swipe.text
                              ? 'on'
                              : ''
                          }
                          onClick={() => {
                            sfxUiTap();
                            setClips((prev) =>
                              prev.map((c) =>
                                c.id === swClip.id && c.kind === 'swipe'
                                  ? { ...c, swipe: swItem }
                                  : c
                              )
                            );
                          }}
                        >
                          Смена {swItem.week} · {swItem.speaker}
                        </button>
                      ))}
                    </div>

                    <label style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>
                      Темп сцены свайпа: {swClip.duration.toFixed(1)} сек
                      <input
                        type="range"
                        min={1.4}
                        max={3.8}
                        step={0.1}
                        value={swClip.duration}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          setClips((prev) =>
                            prev.map((c) =>
                              c.id === swClip.id && c.kind === 'swipe' ? { ...c, duration: v } : c
                            )
                          );
                        }}
                        style={{ width: '100%', accentColor: 'var(--brass)' }}
                      />
                    </label>
                  </div>
                );
              })()}

              {(activeClipSpan.clip.kind === 'ending' || activeClipSpan.clip.kind === 'qr') && (
                <div
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    background: 'var(--bg-elevated)',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  <label style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                    Длительность кадра: {getClipDuration(activeClipSpan.clip).toFixed(2)} сек
                    <input
                      type="range"
                      min={activeClipSpan.clip.kind === 'qr' ? 0.3 : 1.2}
                      max={activeClipSpan.clip.kind === 'qr' ? 1.5 : 3.5}
                      step={0.05}
                      value={getClipDuration(activeClipSpan.clip)}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        setClips((prev) =>
                          prev.map((c) =>
                            c.id === activeClipSpan.clip.id &&
                            (c.kind === 'ending' || c.kind === 'qr')
                              ? { ...c, duration: v }
                              : c
                          )
                        );
                      }}
                      style={{ width: '100%', accentColor: 'var(--brass)', marginTop: 6 }}
                    />
                  </label>
                </div>
              )}

              <button
                type="button"
                className="cta-btn subtle"
                onClick={() => videoUploadInputRef.current?.click()}
              >
                + Вклеить видео с устройства (.mp4 / .mov / реакция)
              </button>
            </div>
          )}

          {/* ВКЛАДКА 2: АНИМИРОВАННЫЕ GIF-СТИКЕРЫ И МЕМЫ */}
          {activeTab === 'gifs' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                type="button"
                className="cta-btn primary"
                onClick={() => gifUploadInputRef.current?.click()}
              >
                + Загрузить свою GIF / WebP / Мем с телефона или ПК
              </button>

              {customStickerList.length > 0 && (
                <div className="ios-context-chips" style={{ padding: 0 }}>
                  {customStickerList.map((cm) => (
                    <button
                      key={cm.id}
                      type="button"
                      onClick={() => {
                        sfxUiTap();
                        const ov: MontageGifOverlay = {
                          id: makeId('ov_cust'),
                          kind: 'gif',
                          sourceType: 'custom',
                          customMediaId: cm.id,
                          label: cm.name.slice(0, 16),
                          x: 0.5,
                          y: 0.78,
                          scale: 1,
                          rotDeg: 0,
                          startSec: 0,
                          endSec: null,
                        };
                        setOverlays((p) => [...p, ov]);
                        setSelectedOverlayId(ov.id);
                      }}
                    >
                      + {cm.name.slice(0, 16)}
                    </button>
                  ))}
                </div>
              )}

              <div style={{ fontSize: 11.5, color: 'var(--text-dim)', fontWeight: 700 }}>
                Встроенные анимированные реакции (нажмите, чтобы добавить, и двигайте по кадру):
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 6,
                }}
              >
                {BUILTIN_ANIMATED_GIFS.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => addBuiltinGif(g.id, g.label)}
                    style={{
                      padding: '9px 10px',
                      borderRadius: 10,
                      border: '1px solid rgba(255,255,255,0.12)',
                      background: 'var(--bg-elevated)',
                      color: 'var(--text-light)',
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <strong style={{ fontSize: 12 }}>{g.label}</strong>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 9.5,
                        color: 'var(--brass)',
                      }}
                    >
                      {g.tag}
                    </span>
                  </button>
                ))}
              </div>

              {selectedOverlay && selectedOverlay.kind === 'gif' && (
                <div
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--brass-soft)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <strong>Выбрано: {selectedOverlay.label}</strong>
                    <button
                      type="button"
                      onClick={() => {
                        setOverlays((p) => p.filter((o) => o.id !== selectedOverlay.id));
                        setSelectedOverlayId(null);
                      }}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--vermilion-light)',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Убрать ×
                    </button>
                  </div>

                  <label style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>
                    Размер: {Math.round(selectedOverlay.scale * 100)}%
                    <input
                      type="range"
                      min={0.45}
                      max={2.2}
                      step={0.05}
                      value={selectedOverlay.scale}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        setOverlays((p) =>
                          p.map((o) => (o.id === selectedOverlay.id ? { ...o, scale: v } : o))
                        );
                      }}
                      style={{ width: '100%', accentColor: 'var(--brass)' }}
                    />
                  </label>

                  <label style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>
                    Наклон: {selectedOverlay.rotDeg}°
                    <input
                      type="range"
                      min={-30}
                      max={30}
                      step={1}
                      value={selectedOverlay.rotDeg}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        setOverlays((p) =>
                          p.map((o) => (o.id === selectedOverlay.id ? { ...o, rotDeg: v } : o))
                        );
                      }}
                      style={{ width: '100%', accentColor: 'var(--brass)' }}
                    />
                  </label>

                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className="cta-btn subtle"
                      style={{ flex: 1, fontSize: 11.5, padding: '6px 8px' }}
                      onClick={() =>
                        setOverlays((p) =>
                          p.map((o) =>
                            o.id === selectedOverlay.id ? { ...o, startSec: 0, endSec: null } : o
                          )
                        )
                      }
                    >
                      На весь ролик
                    </button>
                    {activeClipSpan && (
                      <button
                        type="button"
                        className="cta-btn subtle"
                        style={{ flex: 1, fontSize: 11.5, padding: '6px 8px' }}
                        onClick={() =>
                          setOverlays((p) =>
                            p.map((o) =>
                              o.id === selectedOverlay.id
                                ? {
                                    ...o,
                                    startSec: Number(activeClipSpan.startSec.toFixed(1)),
                                    endSec: Number(activeClipSpan.endSec.toFixed(1)),
                                  }
                                : o
                            )
                          )
                        }
                      >
                        Только на этой сцене
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ВКЛАДКА 3: ТИТРЫ И ПОДПИСИ STORIES */}
          {activeTab === 'text' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {overlays
                  .filter((o): o is MontageTextOverlay => o.kind === 'text')
                  .map((tOv, idx) => (
                    <button
                      key={tOv.id}
                      type="button"
                      onClick={() => setSelectedOverlayId(tOv.id)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 8,
                        border:
                          selectedOverlayId === tOv.id
                            ? '1.5px solid var(--brass)'
                            : '1px solid rgba(255,255,255,0.14)',
                        background: 'var(--bg-elevated)',
                        color: 'var(--text-light)',
                        fontSize: 11.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Титр {idx + 1}
                    </button>
                  ))}
                <button
                  type="button"
                  onClick={addFloatingText}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 8,
                    border: '1px dashed var(--brass)',
                    background: 'transparent',
                    color: 'var(--brass)',
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  + Новый титр
                </button>
              </div>

              {(() => {
                const targetTxt =
                  selectedOverlay && selectedOverlay.kind === 'text'
                    ? selectedOverlay
                    : overlays.find((o): o is MontageTextOverlay => o.kind === 'text');
                if (!targetTxt) return null;

                return (
                  <div
                    style={{
                      padding: 12,
                      borderRadius: 12,
                      background: 'var(--bg-elevated)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <input
                      type="text"
                      value={targetTxt.text}
                      maxLength={84}
                      onChange={(e) => {
                        const val = e.target.value;
                        setOverlays((p) =>
                          p.map((o) =>
                            o.id === targetTxt.id && o.kind === 'text' ? { ...o, text: val } : o
                          )
                        );
                      }}
                      style={{
                        width: '100%',
                        padding: '9px 11px',
                        borderRadius: 8,
                        border: '1px solid var(--brass-soft)',
                        background: 'rgba(0,0,0,0.24)',
                        color: '#f4efe4',
                        fontSize: 13,
                        fontWeight: 700,
                      }}
                    />

                    <div className="ios-context-chips" style={{ padding: 0 }}>
                      {presets.map((pr, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            sfxUiTap();
                            setOverlays((p) =>
                              p.map((o) =>
                                o.id === targetTxt.id && o.kind === 'text' ? { ...o, text: pr } : o
                              )
                            );
                          }}
                        >
                          Заголовок {idx + 1}
                        </button>
                      ))}
                    </div>

                    <div className="ios-context-chips" style={{ padding: 0 }}>
                      {(
                        [
                          ['paper', 'Бумага Эвристики'],
                          ['stories_dark', 'Тёмная капсула'],
                          ['kinetic_bold', 'Чистый титр'],
                          ['accent_tag', 'Акцентная плашка'],
                        ] as [CaptionVisualStyle, string][]
                      ).map(([stKey, stLabel]) => (
                        <button
                          key={stKey}
                          type="button"
                          className={targetTxt.style === stKey ? 'on' : ''}
                          onClick={() =>
                            setOverlays((p) =>
                              p.map((o) =>
                                o.id === targetTxt.id && o.kind === 'text'
                                  ? { ...o, style: stKey }
                                  : o
                              )
                            )
                          }
                        >
                          {stLabel}
                        </button>
                      ))}
                    </div>

                    <label style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>
                      Размер титра: {Math.round(targetTxt.scale * 100)}%
                      <input
                        type="range"
                        min={0.6}
                        max={1.5}
                        step={0.05}
                        value={targetTxt.scale}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          setOverlays((p) =>
                            p.map((o) => (o.id === targetTxt.id ? { ...o, scale: v } : o))
                          );
                        }}
                        style={{ width: '100%', accentColor: 'var(--brass)' }}
                      />
                    </label>

                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        className="cta-btn subtle"
                        style={{ flex: 1, fontSize: 11.5, padding: '6px 8px' }}
                        onClick={() =>
                          setOverlays((p) =>
                            p.map((o) =>
                              o.id === targetTxt.id ? { ...o, startSec: 0, endSec: null } : o
                            )
                          )
                        }
                      >
                        Весь ролик
                      </button>
                      {activeClipSpan && (
                        <button
                          type="button"
                          className="cta-btn subtle"
                          style={{ flex: 1, fontSize: 11.5, padding: '6px 8px' }}
                          onClick={() =>
                            setOverlays((p) =>
                              p.map((o) =>
                                o.id === targetTxt.id
                                  ? {
                                      ...o,
                                      startSec: Number(activeClipSpan.startSec.toFixed(1)),
                                      endSec: Number(activeClipSpan.endSec.toFixed(1)),
                                    }
                                  : o
                              )
                            )
                          }
                        >
                          Только на этой сцене
                        </button>
                      )}
                      <button
                        type="button"
                        className="cta-btn subtle"
                        style={{
                          fontSize: 11.5,
                          padding: '6px 10px',
                          color: 'var(--vermilion-light)',
                        }}
                        onClick={() => {
                          setOverlays((p) => p.filter((o) => o.id !== targetTxt.id));
                          setSelectedOverlayId(null);
                        }}
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ВКЛАДКА 4: САУНДТРЕК, QR-КАДР И ФИНАЛЬНЫЙ ЭКСПОРТ */}
          {activeTab === 'audio' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 800 }}>Звуковая дорожка ролика:</div>
              <div className="ios-context-chips" style={{ padding: 0 }}>
                {(
                  [
                    ['groove', 'Драйв-бит + свайпы'],
                    ['thriller', 'Триллер-пульс'],
                    ['sfx_only', 'Только звуки сцен'],
                    ['mute', 'Без музыки'],
                  ] as [MontageSoundtrackMode, string][]
                ).map(([mKey, mLabel]) => (
                  <button
                    key={mKey}
                    type="button"
                    className={soundtrack === mKey ? 'on' : ''}
                    onClick={() => {
                      sfxUiTap();
                      setSoundtrack(mKey);
                    }}
                  >
                    {mLabel}
                  </button>
                ))}
              </div>

              <button
                type="button"
                className="cta-btn subtle"
                onClick={() => {
                  sfxUiTap();
                  if (hasQrScene) {
                    setClips((p) => p.filter((c) => c.kind !== 'qr'));
                  } else {
                    setClips((p) => [...p, { id: makeId('qr'), kind: 'qr', duration: 0.45 }]);
                  }
                }}
              >
                {hasQrScene
                  ? '✓ Включён финальный QR-кадр 0.45 сек (@vkreslegame)'
                  : '+ Добавить финальный QR-кадр 0.45 сек (@vkreslegame)'}
              </button>

              <button
                type="button"
                className="cta-btn primary big"
                disabled={Boolean(exportState)}
                onClick={() => void handleExportMp4()}
              >
                {exportState
                  ? `${exportState.label} (${exportState.pct}%)`
                  : 'Скачать / Поделиться готовым MP4 (9:16 HD)'}
              </button>

              <button type="button" className="cta-btn subtle" onClick={handleShareTelegramLink}>
                Отправить прямую ссылку на эту игру в Telegram →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
