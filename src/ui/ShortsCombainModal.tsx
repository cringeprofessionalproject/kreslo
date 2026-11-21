import { useEffect, useMemo, useRef, useState } from 'react';
import { sfxUiTap, sfxVictory } from '../audio';
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
  const [hookText, setHookText] = useState<string>(presets[0] || 'Один свайп решил всё');
  const [sticker, setSticker] = useState<HighlightStickerId>(
    ending.isVictory ? 'crown_win' : 'fire_chair'
  );
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const realCaseInfo = useMemo(
    () => pickBestRealCaseForHighlight(pack, swipes),
    [pack, swipes]
  );

  // Живое превью 13.5-секундного ролика на холсте
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
        setStatusNote('Ролик отправлен!');
      } else {
        const a = document.createElement('a');
        a.href = res.url;
        a.download = res.file.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.setTimeout(() => URL.revokeObjectURL(res.url), 30_000);
        setStatusNote('Видео сохранено — загружай в Shorts / Reels / Stories!');
      }
    } catch {
      setStatusNote('Отправка отменена или недоступна в этом окне');
    } finally {
      setExportProgress(null);
    }
  };

  const handleShareTelegramLink = () => {
    sfxUiTap();
    const url = getTelegramBotAppUrl(`pack_${pack.id}`);
    const shareText = `${hookText} — попробуй удержать кресло в «${pack.title}»:`;
    if (!shareLinkViaTelegramOrNative(url, shareText)) {
      void navigator.clipboard?.writeText(`${shareText} ${url}`);
      setStatusNote('Ссылка на @vkreslegame скопирована!');
    }
  };

  return (
    <div
      className="overlay-backdrop"
      style={{ zIndex: 3200 }}
      onClick={(e) => {
        if (e.target === e.currentTarget && exportProgress === null) onClose();
      }}
    >
      <div
        className="modal-card ending-editorial-sheet"
        style={{
          maxWidth: 440,
          width: '94vw',
          maxHeight: '92dvh',
          overflowY: 'auto',
          padding: '16px 16px 20px',
          background: '#12101d',
          color: '#f5f3ff',
          border: '1px solid rgba(255,255,255,0.14)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 10,
          }}
        >
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>🎬 Шортс-комбайн · 13.5 сек</div>
            <div style={{ fontSize: 11.5, color: 'rgba(245,243,255,0.62)' }}>
              Автонарезка свайпов + реальный кейс + микро-QR на 0.4 сек
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={exportProgress !== null}
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              border: '1px solid rgba(255,255,255,0.18)',
              background: 'rgba(255,255,255,0.06)',
              color: '#fff',
              fontSize: 15,
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        {/* Живое превью 9:16 */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: 12,
          }}
        >
          <canvas
            ref={previewCanvasRef}
            width={360}
            height={640}
            style={{
              width: 176,
              height: 313,
              borderRadius: 18,
              border: '1px solid rgba(255,255,255,0.2)',
              boxShadow: '0 14px 36px rgba(0,0,0,0.45)',
            }}
          />
        </div>

        {realCaseInfo && (
          <div
            style={{
              padding: '8px 11px',
              borderRadius: 12,
              background:
                realCaseInfo.realCase.kind === 'blunder'
                  ? 'rgba(244, 63, 94, 0.14)'
                  : 'rgba(16, 185, 129, 0.14)',
              border: `1px solid ${
                realCaseInfo.realCase.kind === 'blunder'
                  ? 'rgba(244, 63, 94, 0.4)'
                  : 'rgba(16, 185, 129, 0.4)'
              }`,
              fontSize: 12,
              lineHeight: 1.35,
              marginBottom: 10,
            }}
          >
            <strong>
              {realCaseInfo.realCase.kind === 'blunder'
                ? '💀 В ролик вшит знаменитый тупняк:'
                : '🏛 В ролик вшит реальный кейс:'}
            </strong>{' '}
            {realCaseInfo.realCase.person} ({realCaseInfo.realCase.year}) —{' '}
            {realCaseInfo.realCase.headline}
          </div>
        )}

        {/* Текст верхнего хука */}
        <div style={{ marginBottom: 10 }}>
          <div
            style={{
              fontSize: 11.5,
              fontWeight: 700,
              color: 'rgba(245,243,255,0.72)',
              marginBottom: 5,
            }}
          >
            Заголовок сверху (свой или в 1 тап):
          </div>
          <input
            type="text"
            value={hookText}
            maxLength={68}
            onChange={(e) => setHookText(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 11px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.07)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 6,
            }}
          />
          <div style={{ display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 2 }}>
            {presets.map((pr, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  sfxUiTap();
                  setHookText(pr);
                }}
                style={{
                  whiteSpace: 'nowrap',
                  padding: '4px 9px',
                  borderRadius: 999,
                  fontSize: 11,
                  border: '1px solid rgba(255,255,255,0.16)',
                  background:
                    hookText === pr ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.05)',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                Вариант {idx + 1}
              </button>
            ))}
          </div>
        </div>

        {/* Анимированный стикер */}
        <div style={{ marginBottom: 12 }}>
          <div
            style={{
              fontSize: 11.5,
              fontWeight: 700,
              color: 'rgba(245,243,255,0.72)',
              marginBottom: 5,
            }}
          >
            Живой стикер-реакция:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {HIGHLIGHT_STICKERS.map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => {
                  sfxUiTap();
                  setSticker(st.id);
                }}
                style={{
                  padding: '5px 10px',
                  borderRadius: 999,
                  fontSize: 11.5,
                  fontWeight: 700,
                  border:
                    sticker === st.id
                      ? '1px solid #fbbf24'
                      : '1px solid rgba(255,255,255,0.15)',
                  background:
                    sticker === st.id ? 'rgba(251, 191, 36, 0.22)' : 'rgba(255,255,255,0.05)',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                {st.emoji} {st.label}
              </button>
            ))}
          </div>
        </div>

        {statusNote && (
          <div
            style={{
              fontSize: 12,
              textAlign: 'center',
              color: '#86efac',
              marginBottom: 8,
              fontWeight: 600,
            }}
          >
            {statusNote}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            type="button"
            className="cta-btn primary big"
            disabled={exportProgress !== null}
            onClick={() => void handleExportAndShare()}
            style={{ width: '100%' }}
          >
            {exportProgress !== null
              ? `Собираем ролик… ${exportProgress}%`
              : '🎬 Скачать / Поделиться клипом (MP4)'}
          </button>
          <button
            type="button"
            className="cta-btn secondary"
            onClick={handleShareTelegramLink}
            style={{ width: '100%' }}
          >
            Отправить игру в чат Telegram →
          </button>
        </div>
      </div>
    </div>
  );
}
