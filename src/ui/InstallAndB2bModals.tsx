import { useEffect, useState } from 'react';
import { sfxCoffeeSave, sfxVictory } from '../audio';
import { fetchServerAggregateStats, type ServerAggregateStats } from '../game/anonymousPulse';
import { JOB_PACKS } from '../game/packs';
import { PRO_VAULT_CHEATSHEETS, type ProVaultDoc } from '../game/proInsights';
import type { PersistentMeta } from '../types';
import { IconClose } from './Icons';
import { useSheetPullToDismiss } from './useNativeGestures';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready?: () => void;
        expand?: () => void;
        addToHomeScreen?: () => void;
      };
    };
  }
}

interface InstallModalProps {
  deferredPrompt: BeforeInstallPromptEvent | null;
  onTriggerAndroidInstall: () => void;
  onClose: () => void;
}

export function InstallHomeScreenModal({
  deferredPrompt,
  onTriggerAndroidInstall,
  onClose,
}: InstallModalProps) {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isInAppWebview = /Instagram|FBAN|FBAV|BytedanceWebview|TikTok|VKClient/i.test(ua);
  const isIos = /iPhone|iPad|iPod/i.test(ua);
  const hasTelegramHomeApi = Boolean(window.Telegram?.WebApp?.addToHomeScreen);
  const [linkCopied, setLinkCopied] = useState(false);
  const { sheetProps, backdropStyle } = useSheetPullToDismiss(onClose);

  const copyGameLink = async () => {
    sfxCoffeeSave();
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 2500);
    } catch {
      setLinkCopied(true);
    }
  };

  return (
    <div className="overlay-backdrop" style={backdropStyle} onClick={onClose}>
      <div
        className="info-sheet native-ios-sheet"
        {...sheetProps}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-grabber-bar" />
        <div className="pw-top-row">
          <span className="eyebrow-tag">АВТОНОМНЫЙ РЕЖИМ · PWA / MINI APP</span>
          <button type="button" className="close-round-btn" onClick={onClose}>
            <IconClose size={16} />
          </button>
        </div>

        <h3 className="sheet-serif-title">Добавить «КРЕСЛО» на экран телефона</h3>
        <p className="info-lead">
          Приложение запускается во весь экран без адресной строки и работает без подключения к
          сети (в дороге, метро и перелётах).
        </p>

        {isInAppWebview && (
          <div className="info-danger-card high">
            <strong>Открыто внутри встроенного браузера соцсети</strong>
            <p>
              Нажмите <b>«•••»</b> в правом верхнем углу окна и выберите{' '}
              <b>«Открыть во внешнем браузере»</b> (Safari или Chrome), чтобы появилась системная
              кнопка установки.
            </p>
          </div>
        )}

        {hasTelegramHomeApi && (
          <button
            type="button"
            className="cta-btn primary big"
            onClick={() => {
              sfxVictory();
              window.Telegram?.WebApp?.addToHomeScreen?.();
              onClose();
            }}
          >
            Добавить иконку на главный экран (Telegram)
          </button>
        )}

        {deferredPrompt && (
          <button
            type="button"
            className="cta-btn primary big"
            onClick={() => {
              sfxVictory();
              onTriggerAndroidInstall();
            }}
          >
            Установить приложение в один клик
          </button>
        )}

        {!deferredPrompt && !hasTelegramHomeApi && (
          <div className="install-steps-box">
            {isIos ? (
              <>
                <div className="inst-step">
                  <span className="step-num">01</span>
                  <p>
                    Нажмите системную иконку <b>«Поделиться»</b> на нижней панели браузера Safari.
                  </p>
                </div>
                <div className="inst-step">
                  <span className="step-num">02</span>
                  <p>
                    Выберите пункт <b>«На экран „Домой“»</b> и подтвердите добавление.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="inst-step">
                  <span className="step-num">01</span>
                  <p>
                    Откройте меню браузера <b>«⋮»</b> в правом верхнем углу экрана.
                  </p>
                </div>
                <div className="inst-step">
                  <span className="step-num">02</span>
                  <p>
                    Нажмите <b>«Установить приложение»</b> или <b>«Добавить на главный экран»</b>.
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        <div className="two-col-btns">
          <button type="button" className="cta-btn subtle" onClick={copyGameLink}>
            {linkCopied ? 'Ссылка скопирована' : 'Скопировать ссылку'}
          </button>
          <button type="button" className="cta-btn primary" onClick={onClose}>
            Готово
          </button>
        </div>
      </div>
    </div>
  );
}

interface VaultAndB2bModalProps {
  meta: PersistentMeta;
  initialTab?: 'vault' | 'b2b' | 'telemetry';
  onUnlockVaultDemand: () => void;
  onTrackB2bClick: () => void;
  onClose: () => void;
}

export function VaultAndB2bModal({
  meta,
  initialTab = 'b2b',
  onUnlockVaultDemand,
  onTrackB2bClick,
  onClose,
}: VaultAndB2bModalProps) {
  const [tab, setTab] = useState<'vault' | 'b2b' | 'telemetry'>(initialTab);
  const [openedDoc, setOpenedDoc] = useState<ProVaultDoc | null>(null);
  const [copiedB2b, setCopiedB2b] = useState(false);
  const [statsScope, setStatsScope] = useState<'server' | 'local'>('server');
  const [serverStats, setServerStats] = useState<ServerAggregateStats | null>(null);
  const { sheetProps, backdropStyle } = useSheetPullToDismiss(onClose);

  useEffect(() => {
    if (tab !== 'telemetry') return;
    let cancelled = false;
    fetchServerAggregateStats().then((res) => {
      if (cancelled) return;
      if (res) {
        setServerStats(res);
      } else {
        setStatsScope('local');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [tab]);

  const downloadVaultFile = (doc: ProVaultDoc) => {
    sfxVictory();
    const blob = new Blob([doc.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportTelemetryJson = () => {
    sfxCoffeeSave();
    const payload = {
      exportedAt: new Date().toISOString(),
      serverAggregateZeroPii: serverStats,
      localDevice: {
        unlockMoreClicks: meta.telemetry.unlockMoreClicks ?? 0,
        unlockMoreByPack: meta.telemetry.unlockMoreByPack ?? {},
        unlockMoreBySource: meta.telemetry.unlockMoreBySource ?? {},
        smsEventsShown: meta.telemetry.smsEventsShown ?? 0,
        smsEventsOpened: meta.telemetry.smsEventsOpened ?? 0,
        bestWeeksByPack: meta.bestWeeksByPack,
        bestIqByPack: meta.bestIqByPack,
        checkpointBlockByPack: meta.checkpointBlockByPack,
        unlockedEndingsCount: meta.unlockedEndings.length,
        telemetry: meta.telemetry,
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kreslo-stats-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const useServer = statsScope === 'server' && serverStats !== null;

  const unlockClicks = useServer
    ? serverStats.totals.unlockMoreClicks
    : (meta.telemetry.unlockMoreClicks ?? 0);
  const runsCount = useServer ? serverStats.totals.runsStarted : meta.telemetry.runsStarted;
  const swipesCount = useServer ? serverStats.totals.swipesTotal : meta.telemetry.swipesTotal;
  const blocksCount = useServer
    ? serverStats.totals.blocksCleared
    : (meta.telemetry.blocksCleared ?? 0);
  const sharesCount = useServer ? serverStats.totals.sharesClicked : meta.telemetry.sharesClicked;
  const smsOpened = useServer
    ? serverStats.totals.smsEventsOpened
    : (meta.telemetry.smsEventsOpened ?? 0);
  const smsShown = meta.telemetry.smsEventsShown ?? 0;
  const bySource = useServer
    ? serverStats.unlockMoreBySource
    : (meta.telemetry.unlockMoreBySource ?? {});
  const byPack = useServer
    ? serverStats.unlockMoreByPack
    : (meta.telemetry.unlockMoreByPack ?? {});
  const playsByPack = useServer ? serverStats.packPlays : meta.telemetry.packPlays;

  return (
    <div className="overlay-backdrop" style={backdropStyle} onClick={onClose}>
      <div
        className="paywall-sheet native-ios-sheet"
        {...sheetProps}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-grabber-bar" />
        <div className="pw-top-row">
          <span className="eyebrow-tag">МАТЕРИАЛЫ И МЕТРИКИ СПРОСА · ЭВРИСТИКА</span>
          <button type="button" className="close-round-btn" onClick={onClose}>
            <IconClose size={16} />
          </button>
        </div>

        <div className="vault-tabs-row">
          <button
            type="button"
            className={tab === 'telemetry' ? 'active' : ''}
            onClick={() => setTab('telemetry')}
          >
            Метрики спроса
          </button>
          <button
            type="button"
            className={tab === 'vault' ? 'active' : ''}
            onClick={() => setTab('vault')}
          >
            Чек-листы (4)
          </button>
          <button
            type="button"
            className={tab === 'b2b' ? 'active' : ''}
            onClick={() => setTab('b2b')}
          >
            Для бизнеса
          </button>
        </div>

        {tab === 'b2b' && (
          <div className="pw-options-stack">
            <div className="pw-card pro-card">
              <div className="pw-card-badge">WHITE-LABEL РАЗРАБОТКА · СРОК 5 ДНЕЙ</div>
              <h4>Кастомный тренажёр под задачи вашей компании</h4>
              <p className="pw-sponsor-desc">
                Адаптируем игровой движок под онбординг сотрудников, проверку регламентов (продажи,
                ИБ, 152-ФЗ, охрана труда) или интерактивный стенд для отраслевой конференции.
              </p>
              <div className="two-col-btns">
                <a
                  href="https://heuristics.ru"
                  target="_blank"
                  rel="noreferrer"
                  className="cta-btn primary link-as-btn"
                  onClick={onTrackB2bClick}
                >
                  Связаться на heuristics.ru ↗
                </a>
                <button
                  type="button"
                  className="cta-btn subtle"
                  onClick={async () => {
                    onTrackB2bClick();
                    sfxCoffeeSave();
                    try {
                      await navigator.clipboard.writeText(
                        'Здравствуйте! Посмотрели тренажёр «КРЕСЛО» — хотим обсудить разработку корпоративного сценария.'
                      );
                    } catch {
                      // ignore
                    }
                    setCopiedB2b(true);
                    window.setTimeout(() => setCopiedB2b(false), 2500);
                  }}
                >
                  {copiedB2b ? 'Текст скопирован' : 'Скопировать запрос'}
                </button>
              </div>
            </div>

            <div className="pw-card sponsor-card">
              <div className="pw-card-badge">АКАДЕМИЯ ПРИКЛАДНЫХ ПРОГРАММ</div>
              <h4>Платформа тренажёров edu.heuristics.ru</h4>
              <p className="pw-sponsor-desc">
                Короткие 4-дневные программы по 152-ФЗ, 44-ФЗ, КИИ, СКС и разработке продукта с
                практической проверкой рабочих документов.
              </p>
              <a
                href="https://edu.heuristics.ru"
                target="_blank"
                rel="noreferrer"
                className="cta-btn secondary link-as-btn"
                onClick={onTrackB2bClick}
              >
                Перейти на edu.heuristics.ru ↗
              </a>
            </div>
          </div>
        )}

        {tab === 'vault' && (
          <div className="pw-options-stack">
            {!meta.proUnlocked && (
              <div className="info-danger-card safe">
                <strong>Дополнительные материалы к курсам (4 рабочих регламента)</strong>
                <p>
                  Краткие прикладные памятки по маркировке ERID, аудиту 152-ФЗ, 44-ФЗ и ИТ-выручке
                  70%. Открываются в один клик без оплаты:
                </p>
                <button
                  type="button"
                  className="cta-btn primary"
                  style={{ marginTop: 10, width: '100%' }}
                  onClick={() => {
                    sfxVictory();
                    onUnlockVaultDemand();
                  }}
                >
                  Открыть ещё: все 4 памятки бесплатно →
                </button>
              </div>
            )}

            {PRO_VAULT_CHEATSHEETS.map((doc, idx) => (
              <div key={doc.id} className="vault-doc-item">
                <span className="step-num">0{idx + 1}</span>
                <div className="vd-body">
                  <strong>{doc.title}</strong>
                  <small>{doc.subtitle}</small>
                  {openedDoc?.id === doc.id && (
                    <pre className="vd-preview">{doc.content}</pre>
                  )}
                </div>
                {meta.proUnlocked ? (
                  <div className="vd-actions">
                    <button
                      type="button"
                      className="vd-btn"
                      onClick={() =>
                        setOpenedDoc((cur) => (cur?.id === doc.id ? null : doc))
                      }
                    >
                      {openedDoc?.id === doc.id ? 'Свернуть' : 'Текст'}
                    </button>
                    <button
                      type="button"
                      className="vd-btn gold"
                      onClick={() => downloadVaultFile(doc)}
                    >
                      Скачать
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="vd-btn gold"
                    onClick={() => {
                      sfxVictory();
                      onUnlockVaultDemand();
                      setOpenedDoc(doc);
                    }}
                  >
                    Открыть
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'telemetry' && (
          <div className="pw-options-stack">
            {serverStats && (
              <div className="ios-segmented-control" style={{ marginBottom: 2 }}>
                <button
                  type="button"
                  className={statsScope === 'server' ? 'active' : ''}
                  onClick={() => setStatsScope('server')}
                >
                  Весь сервер (0% ПДн)
                </button>
                <button
                  type="button"
                  className={statsScope === 'local' ? 'active' : ''}
                  onClick={() => setStatsScope('local')}
                >
                  Это устройство
                </button>
              </div>
            )}

            <p className="pw-sponsor-desc">
              {useServer
                ? 'Суммарные обезличенные счётчики сервера по всем игрокам (без IP, cookies и идентификаторов устройств — 100% соответствие 152-ФЗ):'
                : 'Локальные счётчики на этом устройстве (в памяти вашего браузера):'}
            </p>
            <div className="telemetry-grid">
              <div className="tm-box highlight">
                <strong>{unlockClicks}</strong>
                <span>Нажатий «Открыть ещё»</span>
              </div>
              <div className="tm-box">
                <strong>{runsCount}</strong>
                <span>Запусков смен</span>
              </div>
              <div className="tm-box">
                <strong>{swipesCount}</strong>
                <span>Свайпов карт</span>
              </div>
              <div className="tm-box">
                <strong>{blocksCount}</strong>
                <span>Блоков сдано</span>
              </div>
              <div className="tm-box">
                <strong>
                  {useServer ? serverStats.totals.cameraActivations : `${smsOpened}/${smsShown}`}
                </strong>
                <span>{useServer ? 'Включений лица' : 'СМС открыто'}</span>
              </div>
              <div className="tm-box">
                <strong>{sharesCount}</strong>
                <span>Поделились</span>
              </div>
            </div>

            <div className="tm-packs-breakdown">
              <small>Точки нажатия «Открыть ещё»:</small>
              <div className="tm-pack-row">
                <span>После Блока I (12-я смена)</span>
                <b>{bySource.intermission ?? 0}</b>
              </div>
              <div className="tm-pack-row">
                <span>На экране итога смены</span>
                <b>{bySource.ending ?? 0}</b>
              </div>
              <div className="tm-pack-row">
                <span>В каталоге профессий</span>
                <b>{bySource.hub ?? 0}</b>
              </div>
              <div className="tm-pack-row">
                <span>Сейф чек-листов (.txt)</span>
                <b>{bySource.vault ?? 0}</b>
              </div>
            </div>

            <div className="tm-packs-breakdown">
              <small>По специальностям (запуски / нажатия «Открыть ещё»):</small>
              {JOB_PACKS.map((jp) => (
                <div key={jp.id} className="tm-pack-row">
                  <span>{jp.shortTitle}</span>
                  <b>
                    {playsByPack[jp.id] ?? 0} / {byPack[jp.id] ?? 0}
                  </b>
                </div>
              ))}
            </div>

            <button type="button" className="cta-btn primary" onClick={exportTelemetryJson}>
              Скачать сводку (.json)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
