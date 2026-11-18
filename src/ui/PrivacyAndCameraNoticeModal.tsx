import { useState } from 'react';
import { useSheetPullToDismiss } from './useNativeGestures';

// ───────── 1. ЧИСТОЕ APPLE iOS ОКНО ПЕРЕД ВКЛЮЧЕНИЕМ КАМЕРЫ (БЕЗ НЕЙРОСЛОПНЫХ РАМОК) ─────────

interface CameraLocalNoticeModalProps {
  defaultIncludeMic?: boolean;
  onConfirmLiveCamera: (withMic: boolean) => void;
  onPickStaticSelfie: () => void;
  onClose: () => void;
}

export function CameraLocalNoticeModal({
  defaultIncludeMic = true,
  onConfirmLiveCamera,
  onPickStaticSelfie,
  onClose,
}: CameraLocalNoticeModalProps) {
  const [includeMic, setIncludeMic] = useState(defaultIncludeMic);
  const { sheetProps, backdropStyle } = useSheetPullToDismiss(onClose);

  return (
    <div className="overlay-backdrop" style={backdropStyle} onClick={onClose}>
      <div
        className="info-sheet apple-clean-sheet native-ios-sheet"
        {...sheetProps}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-grabber-bar" />

        <div className="acs-header">
          <h3 className="acs-title">Режим с живым лицом</h3>
          <p className="acs-body">
            Камера обрабатывается только внутри браузера на этом устройстве, чтобы вырезать лицо на
            героя и сохранить ролик в память телефона. Видео и звук никуда не отправляются и не
            хранятся на сервере.
          </p>
        </div>

        {/* Нативная iOS-строка с переключателем вместо сырого чекбокса */}
        <div
          className="ios-grouped-row clickable"
          role="switch"
          aria-checked={includeMic}
          tabIndex={0}
          onClick={() => setIncludeMic((v) => !v)}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              setIncludeMic((v) => !v);
            }
          }}
        >
          <div className="igr-labels">
            <strong>Записывать голос с микрофона</strong>
            <span>Ваши комментарии и реакции попадут в ролик. Можно выключить в настройках</span>
          </div>
          <span className={`ios-toggle-pill ${includeMic ? 'on' : ''}`} aria-hidden="true">
            <span className="ios-toggle-knob" />
          </span>
        </div>

        <div className="acs-actions">
          <button
            type="button"
            className="apple-sheet-btn primary"
            onClick={() => onConfirmLiveCamera(includeMic)}
          >
            Включить камеру
          </button>

          <button type="button" className="apple-sheet-btn secondary" onClick={onPickStaticSelfie}>
            Выбрать фото из галереи
          </button>

          <button type="button" className="apple-sheet-btn ghost" onClick={onClose}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}

// ───────── 2. ЛАКОНИЧНАЯ СПРАВКА О ДАННЫХ В СТИЛЕ APPLE SETTINGS ─────────

export function PrivacyZeroPiiModal({ onClose }: { onClose: () => void }) {
  const { sheetProps, backdropStyle } = useSheetPullToDismiss(onClose);

  return (
    <div className="overlay-backdrop" style={backdropStyle} onClick={onClose}>
      <div
        className="info-sheet apple-clean-sheet native-ios-sheet"
        {...sheetProps}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-grabber-bar" />

        <div className="acs-header">
          <h3 className="acs-title">Конфиденциальность</h3>
          <p className="acs-body">
            В этой версии симулятора не используются персональные данные, регистрация и сторонние
            рекламные трекеры.
          </p>
        </div>

        <div className="ios-grouped-list">
          <div className="ios-grouped-item">
            <strong>Камера и микрофон — только на устройстве</strong>
            <p>
              Наложение лица и запись ролика выполняются в оперативной памяти вашего браузера без
              выгрузки на сервер и без биометрической идентификации.
            </p>
          </div>

          <div className="ios-grouped-item">
            <strong>Без аккаунтов, форм и cookies</strong>
            <p>
              Прогресс смен хранится локально в памяти вашего браузера (localStorage). Все шрифты и
              ресурсы загружаются без внешних рекламных сетей.
            </p>
          </div>

          <div className="ios-grouped-item">
            <strong>Игровой характер сценариев</strong>
            <p>
              Все персонажи и ситуации вымышлены, носят развлекательный и просветительский характер
              и не заменяют профильную консультацию специалиста.
            </p>
          </div>
        </div>

        <button type="button" className="apple-sheet-btn secondary" onClick={onClose}>
          Готово
        </button>
      </div>
    </div>
  );
}
