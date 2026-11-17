import { useState } from 'react';
import { useSheetPullToDismiss } from './useNativeGestures';

// ───────── 1. ПРОЗРАЧНОЕ УВЕДОМЛЕНИЕ О 100% ЛОКАЛЬНОЙ РАБОТЕ КАМЕРЫ ПЕРЕД ПЕРВЫМ ВКЛЮЧЕНИЕМ ─────────

interface CameraLocalNoticeModalProps {
  onConfirmLiveCamera: (withMic: boolean) => void;
  onPickStaticSelfie: () => void;
  onClose: () => void;
}

export function CameraLocalNoticeModal({
  onConfirmLiveCamera,
  onPickStaticSelfie,
  onClose,
}: CameraLocalNoticeModalProps) {
  const [includeMic, setIncludeMic] = useState(false);
  const { sheetProps, backdropStyle } = useSheetPullToDismiss(onClose);

  return (
    <div className="overlay-backdrop" style={backdropStyle} onClick={onClose}>
      <div
        className="info-sheet native-ios-sheet"
        {...sheetProps}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-grabber-bar" />
        <span className="eyebrow-tag">ЛОКАЛЬНЫЙ РЕЖИМ · 0% ПЕРЕДАЧИ ДАННЫХ</span>
        <h3 className="sheet-serif-title">Камера работает только на вашем устройстве</h3>

        <p className="info-lead">
          В этом режиме игра вырезает контур лица в реальном времени прямо внутри вашего браузера,
          чтобы вы могли записать смешное видео прохождения себе в телефон.
        </p>

        <div className="info-danger-card safe">
          <strong>Никакого сбора биометрии и персональных данных</strong>
          <p>
            Видеопоток, звук и контур лица обрабатываются исключительно в оперативной памяти вашего
            устройства, <b>не отправляются на сервер</b>, нигде у нас не сохраняются и не
            используются для установления личности.
          </p>
        </div>

        <label className="mic-checkbox-row" style={{ padding: '4px 2px' }}>
          <input
            type="checkbox"
            checked={includeMic}
            onChange={(e) => setIncludeMic(e.target.checked)}
          />
          <span>Также включить микрофон для записи ваших голосовых реакций</span>
        </label>

        <button
          type="button"
          className="cta-btn primary big"
          onClick={() => onConfirmLiveCamera(includeMic)}
        >
          Понятно, включить камеру
        </button>

        <div className="two-col-btns">
          <button type="button" className="cta-btn subtle" onClick={onPickStaticSelfie}>
            Выбрать фото-селфи
          </button>
          <button type="button" className="cta-btn subtle" onClick={onClose}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}

// ───────── 2. СПРАВКА О КОНФИДЕНЦИАЛЬНОСТИ (0% ПДн) И ПРАВОВОЙ ДИСКЛЕЙМЕР ─────────

export function PrivacyZeroPiiModal({ onClose }: { onClose: () => void }) {
  const { sheetProps, backdropStyle } = useSheetPullToDismiss(onClose);

  return (
    <div className="overlay-backdrop" style={backdropStyle} onClick={onClose}>
      <div
        className="info-sheet native-ios-sheet"
        {...sheetProps}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-grabber-bar" />
        <span className="eyebrow-tag">КОНФИДЕНЦИАЛЬНОСТЬ И ПРАВОВАЯ ИНФОРМАЦИЯ</span>
        <h3 className="sheet-serif-title">Игра не собирает персональные данные</h3>

        <div className="privacy-points-list">
          <div className="info-danger-card safe">
            <strong>1. Без регистрации, форм и cookies</strong>
            <p>
              В тренажёре нет учётных записей, форм ввода имени, телефона или почты, рекламных
              трекеров и файлов cookie. Все шрифты и ресурсы загружаются локально без обращения к
              зарубежным CDN.
            </p>
          </div>

          <div className="info-danger-card safe">
            <strong>2. Камера и микрофон — строго на вашем устройстве</strong>
            <p>
              При включении режима видеозаписи обработка изображения и звука выполняется только
              локально в браузере вашего смартфона или компьютера. Видео, фото и координаты маски не
              передаются на сервер и не используются для биометрической идентификации (ст. 11
              152-ФЗ).
            </p>
          </div>

          <div className="info-danger-card safe">
            <strong>3. Только безымянные суммарные счётчики</strong>
            <p>
              Личный прогресс хранится локально в памяти вашего браузера (localStorage). Сервер
              считает только общие математические суммы нажатий по курсам (например, общее число
              запущенных смен) — без сохранения IP-адресов, User-Agent и любых идентификаторов
              пользователя.
            </p>
          </div>

          <div className="info-danger-card low">
            <strong>4. Образовательный и игровой характер</strong>
            <p>
              Все персонажи и сюжеты вымышлены. Ситуации в симуляторе носят просветительский и
              развлекательный характер и не являются индивидуальной юридической, медицинской или
              финансовой консультацией.
            </p>
          </div>
        </div>

        <button type="button" className="cta-btn primary" onClick={onClose}>
          Закрыть
        </button>
      </div>
    </div>
  );
}
