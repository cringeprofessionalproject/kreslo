import { useEffect, useMemo, useRef, useState } from 'react';
import { sfxUiTap, sfxVictory } from '../audio';
import { DIRECT_PLAY_SLUGS } from '../game/packs';
import {
  exportShortsCombainVideo,
  getDefaultHookPresets,
  HIGHLIGHT_STICKERS,
  pickBestRealCaseForHighlight,
  renderShortsFrameAtTime,
  type HighlightStickerId,
  type RunSwipeHighlight,
} from '../game/shortsHighlightBuilder';
import { getTelegramBotAppUrl, shareLinkViaTelegramOrNative } from '../game/telegramStars';
import type { EndingDef, JobPack } from '../types';
import { useSheetPullToDismiss } from './useNativeGestures';

interface ShortsCombainModalProps {
  pack: JobPack;
  ending: EndingDef;
  weeksSurvived: number;
  swipes: RunSwipeHighlight[];
  faceSnapshotUrl?: string | null;
  onClose: () => void;
}

export function ShortsCombainModal({
  pack,
  ending,
  weeksSurvived,
  swipes,
  faceSnapshotUrl,
  onClose,
}: ShortsCombainModalProps) {
  const presets = useMemo(
    () => getDefaultHookPresets(pack, ending, weeksSurvived),
    [pack, ending, weeksSurvived]
  );
  const [hookText, setHookText] = useState<string>(
    presets[0] || 'Одно решение изменило всю смену'
  );
  const [sticker, setSticker] = useState<HighlightStickerId>(
    ending.isVictory ? 'crown_win' : 'fire_chair'
  );
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const { sheetProps, backdropStyle } = useSheetPullToDismiss(() => {
    if (exportProgress === null) onClose();
  });

  const realCaseInfo = useMemo(
    () => pickBestRealCaseForHighlight(pack, swipes),
    [pack, swipes]
  );

  useEffect(() => {
    let raf = 0;
    let faceImg: HTMLImageElement | null = null;
    if (faceSnapshotUrl) {
      const im = new Image();
      im.onload = () => {
        faceImg = im;
      };
      im.src = faceSnapshotUrl;
    }
    const start = performance.now();
    const loop = () => {
      const c = previewCanvasRef.current;
      if (c) {
        const ctx = c.getContext('2d');
        if (ctx) {
          const t = ((performance.now() - start) / 1000) % 13.5;
          renderShortsFrameAtTime(
            ctx,
            c.width,
            c.height,
            t,
            {
              pack,
              ending,
              weeksSurvived,
              swipes,
              hookText,
              sticker,
              faceSnapshotUrl,
            },
            faceImg
          );
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [pack, ending, weeksSurvived, swipes, hookText, sticker, faceSnapshotUrl]);

  const handleExportAndShare = async () => {
    if (exportProgress !== null) return;
    sfxUiTap();
    setStatusNote(null);
    setExportProgress(1);
    try {
      const res = await exportShortsCombainVideo(
        {
          pack,
          ending,
          weeksSurvived,
          swipes,
          hookText,
          sticker,
          faceSnapshotUrl,
        },
        (pct) => setExportProgress(pct)
      );
      sfxVictory();

      const nav = navigator as Navigator & {
        canShare?: (data: ShareData) => boolean;
      };
      if (typeof nav.share === 'function' && nav.canShare?.({ files: [res.file] })) {
        await nav.share({
          files: [res.file],
          title: 'КРЕСЛО · Хайлайт смены',
          text: `${hookText} — проверь себя в @vkreslegame`,
        });
        setStatusNote('Ролик отправлен');
      } else {
        const a = document.createElement('a');
        a.href = res.url;
        a.download = res.file.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.setTimeout(() => URL.revokeObjectURL(res.url), 30_000);
        setStatusNote('Видео сохранено для Shorts / Reels / Stories');
      }
    } catch {
      setStatusNote('Отправка отменена');
    } finally {
      setExportProgress(null);
    }
  };

  const handleShareTelegramLink = () => {
    sfxUiTap();
    const slug = DIRECT_PLAY_SLUGS[pack.id] || pack.id;
    const url = getTelegramBotAppUrl(`play_${slug}`);
    const shareText = `${hookText} — попробуй удержать кресло в «${pack.title}»:`;
    if (!shareLinkViaTelegramOrNative(url, shareText)) {
      void navigator.clipboard?.writeText(`${shareText} ${url}`);
      setStatusNote('Ссылка на @vkreslegame скопирована');
    }
  };

  return (
    <div
      className="overlay-backdrop"
      style={{ ...backdropStyle, zIndex: 3200 }}
      onClick={(e) => {
        if (e.target === e.currentTarget && exportProgress === null) onClose();
      }}
    >
      <div
        className="ending-sheet native-ios-sheet"
        {...sheetProps}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 440, textAlign: 'left' }}
      >
        <div className="sheet-grabber-bar" />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            marginBottom: 10,
          }}
        >
          <div>
            <span className="eyebrow-tag">ВИДЕО-СВОДКА СМЕНЫ · 13.5 СЕК</span>
            <h3 className="sheet-serif-title" style={{ margin: '2px 0 0', fontSize: 19 }}>
              Сборка вертикального клипа
            </h3>
          </div>
          <button
            type="button"
            className="hb-circle-btn"
            onClick={onClose}
            disabled={exportProgress !== null}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', width: '100%', marginBottom: 12 }}>
          <canvas
            ref={previewCanvasRef}
            width={360}
            height={640}
            style={{
              width: 172,
              height: 306,
              borderRadius: 14,
              border: '1px solid rgba(200, 155, 79, 0.34)',
              boxShadow: '0 14px 34px rgba(0,0,0,0.48)',
            }}
          />
        </div>

        {realCaseInfo && (
          <div
            style={{
              width: '100%',
              padding: '9px 11px',
              borderRadius: 10,
              background: 'var(--paper)',
              color: 'var(--ink)',
              border: '1px solid var(--paper-Rule)',
              fontSize: 12,
              lineHeight: 1.36,
              marginBottom: 10,
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color:
                  realCaseInfo.realCase.kind === 'blunder'
                    ? 'var(--vermilion)'
                    : 'var(--forest)',
                marginBottom: 2,
              }}
            >
              {realCaseInfo.realCase.kind === 'blunder'
                ? 'В ролик включён исторический просчёт'
                : 'В ролик включён исторический прецедент'}
            </div>
            <strong>
              {realCaseInfo.realCase.person} ({realCaseInfo.realCase.year})
            </strong>{' '}
            — {realCaseInfo.realCase.headline}
          </div>
        )}

        <div style={{ width: '100%', marginBottom: 10 }}>
          <div
            style={{
              fontSize: 11.5,
              fontWeight: 700,
              color: 'var(--text-dim)',
              marginBottom: 5,
            }}
          >
            Верхний тезис ролика:
          </div>
          <input
            type="text"
            value={hookText}
            maxLength={68}
            onChange={(e) => setHookText(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 11px',
              borderRadius: 9,
              border: '1px solid rgba(200, 155, 79, 0.28)',
              background: 'var(--bg-elevated)',
              color: 'var(--text-light)',
              fontFamily: 'var(--font-sans)',
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 6,
              outline: 'none',
            }}
          />
          <div className="ios-context-chips" style={{ padding: 0 }}>
            {presets.map((pr, idx) => (
              <button
                key={idx}
                type="button"
                className={hookText === pr ? 'on' : ''}
                onClick={() => {
                  sfxUiTap();
                  setHookText(pr);
                }}
              >
                Тезис {idx + 1}
              </button>
            ))}
          </div>
        </div>

        <div style={{ width: '100%', marginBottom: 12 }}>
          <div
            style={{
              fontSize: 11.5,
              fontWeight: 700,
              color: 'var(--text-dim)',
              marginBottom: 5,
            }}
          >
            Архивный штамп на кадре:
          </div>
          <div className="ios-context-chips" style={{ padding: 0 }}>
            {HIGHLIGHT_STICKERS.map((st) => (
              <button
                key={st.id}
                type="button"
                className={sticker === st.id ? 'on' : ''}
                onClick={() => {
                  sfxUiTap();
                  setSticker(st.id);
                }}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {statusNote && (
          <div
            style={{
              width: '100%',
              fontSize: 12,
              textAlign: 'center',
              color: 'var(--forest-light)',
              marginBottom: 8,
              fontWeight: 700,
            }}
          >
            {statusNote}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
          <button
            type="button"
            className="cta-btn primary big"
            disabled={exportProgress !== null}
            onClick={() => void handleExportAndShare()}
          >
            {exportProgress !== null
              ? `Сборка видео… ${exportProgress}%`
              : 'Сохранить или отправить клип (MP4)'}
          </button>
          <button type="button" className="cta-btn subtle" onClick={handleShareTelegramLink}>
            Отправить ссылку на эту колоду в Telegram →
          </button>
        </div>
      </div>
    </div>
  );
}
