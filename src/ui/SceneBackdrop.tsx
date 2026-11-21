import type { PackId } from '../types';
import { getPackAtmosphere, type SceneMotifKind } from '../game/sceneAtmospheres';

interface SceneBackdropProps {
  packId: PackId;
  blockNum?: number;
  inDanger?: boolean;
}

function renderMotifGeometry(motif: SceneMotifKind, accent: string) {
  switch (motif) {
    case 'office_blinds':
      // Стеклянный опенспейс и свет сквозь горизонтальные жалюзи переговорки
      return (
        <g stroke={accent} fill="none">
          <polygon
            points="40,0 440,0 380,310 100,310"
            fill={accent}
            fillOpacity="0.035"
            stroke="none"
          />
          {[34, 58, 82, 106, 130, 154, 178].map((y, idx) => (
            <line
              key={y}
              x1={56}
              y1={y}
              x2={424}
              y2={y + 16}
              strokeOpacity={0.14 - idx * 0.014}
              strokeWidth="1.2"
            />
          ))}
          <line x1="128" y1="0" x2="128" y2="860" strokeOpacity="0.06" strokeWidth="1" />
          <line x1="352" y1="0" x2="352" y2="860" strokeOpacity="0.06" strokeWidth="1" />
        </g>
      );

    case 'boardroom_panels':
      // Строгие высокие стеновые панели переговорной и купол люстры
      return (
        <g stroke={accent} fill="none">
          <ellipse cx="240" cy="48" rx="190" ry="110" fill={accent} fillOpacity="0.045" stroke="none" />
          <rect x="38" y="36" width="122" height="320" rx="3" strokeOpacity="0.09" strokeWidth="1" />
          <rect x="179" y="36" width="122" height="320" rx="3" strokeOpacity="0.11" strokeWidth="1" />
          <rect x="320" y="36" width="122" height="320" rx="3" strokeOpacity="0.09" strokeWidth="1" />
          <line x1="0" y1="388" x2="480" y2="388" strokeOpacity="0.08" strokeWidth="1" />
        </g>
      );

    case 'terminal_telemetry':
      // Инженерная координатная сетка релиза и спокойная кривая метрики
      return (
        <g stroke={accent} fill="none">
          {[80, 160, 240, 320, 400].map((x) => (
            <line key={x} x1={x} y1="0" x2={x} y2="460" strokeOpacity="0.055" strokeWidth="1" />
          ))}
          {[72, 144, 216, 288, 360].map((y) => (
            <line key={y} x1="0" y1={y} x2="480" y2={y} strokeOpacity="0.055" strokeWidth="1" />
          ))}
          <path
            d="M 24 276 C 110 268, 152 212, 240 206 C 322 200, 368 134, 456 118"
            strokeOpacity="0.18"
            strokeWidth="1.5"
          />
          <circle cx="240" cy="206" r="3.5" fill={accent} fillOpacity="0.28" stroke="none" />
          <circle cx="456" cy="118" r="3.5" fill={accent} fillOpacity="0.28" stroke="none" />
        </g>
      );

    case 'architect_draft':
      // Архитектурный чертёж, осевые засечки и дуга золотого сечения
      return (
        <g stroke={accent} fill="none">
          <circle cx="356" cy="176" r="148" strokeOpacity="0.10" strokeWidth="1" strokeDasharray="4 5" />
          <path d="M 84 324 A 240 240 0 0 1 324 84" strokeOpacity="0.14" strokeWidth="1.2" />
          <line x1="84" y1="44" x2="84" y2="420" strokeOpacity="0.09" strokeWidth="1" />
          <line x1="44" y1="324" x2="436" y2="324" strokeOpacity="0.09" strokeWidth="1" />
          <line x1="78" y1="84" x2="90" y2="84" strokeOpacity="0.18" strokeWidth="1.2" />
          <line x1="324" y1="318" x2="324" y2="330" strokeOpacity="0.18" strokeWidth="1.2" />
        </g>
      );

    case 'cafe_pendant':
      // Арочное окно спешелти-кофейни, подвесной плафон и тёплый конус света
      return (
        <g stroke={accent} fill="none">
          <polygon
            points="206,62 274,62 410,360 70,360"
            fill={accent}
            fillOpacity="0.05"
            stroke="none"
          />
          <line x1="240" y1="0" x2="240" y2="48" strokeOpacity="0.22" strokeWidth="1.5" />
          <path d="M 198 62 Q 240 34 282 62 Z" strokeOpacity="0.22" strokeWidth="1.3" />
          <path
            d="M 92 420 L 92 190 A 148 148 0 0 1 388 190 L 388 420"
            strokeOpacity="0.08"
            strokeWidth="1.1"
          />
        </g>
      );

    case 'pvz_shelves':
      // Перспектива стеллажей пункта выдачи и ритм ячеек хранения
      return (
        <g stroke={accent} fill="none">
          <line x1="36" y1="48" x2="118" y2="340" strokeOpacity="0.10" strokeWidth="1.1" />
          <line x1="444" y1="48" x2="362" y2="340" strokeOpacity="0.10" strokeWidth="1.1" />
          {[96, 168, 240, 312].map((y) => (
            <line key={y} x1="48" y1={y} x2="432" y2={y} strokeOpacity="0.08" strokeWidth="1" />
          ))}
          {[140, 152, 160, 174, 182, 196, 204].map((x, idx) => (
            <line
              key={x}
              x1={x + 68}
              y1="38"
              x2={x + 68}
              y2="58"
              strokeOpacity="0.14"
              strokeWidth={idx % 2 === 0 ? '2' : '1'}
            />
          ))}
        </g>
      );

    case 'fulfillment_gates':
      // Складские доки маркетплейса и ступенчатый контур поставок
      return (
        <g stroke={accent} fill="none">
          <rect x="54" y="64" width="110" height="190" rx="6" strokeOpacity="0.09" strokeWidth="1.1" />
          <rect x="185" y="64" width="110" height="190" rx="6" strokeOpacity="0.12" strokeWidth="1.1" />
          <rect x="316" y="64" width="110" height="190" rx="6" strokeOpacity="0.09" strokeWidth="1.1" />
          <polyline
            points="44,332 132,332 132,296 236,296 236,268 344,268 344,234 436,234"
            strokeOpacity="0.16"
            strokeWidth="1.4"
          />
        </g>
      );

    case 'asphalt_beams':
      // Лучи натриевых фонарей и косые отражения на мокром вечернем асфальте
      return (
        <g stroke={accent} fill="none">
          <polygon
            points="96,0 164,0 320,380 18,380"
            fill={accent}
            fillOpacity="0.045"
            stroke="none"
          />
          <polygon
            points="344,0 404,0 472,340 250,340"
            fill={accent}
            fillOpacity="0.03"
            stroke="none"
          />
          <line x1="20" y1="396" x2="210" y2="352" strokeOpacity="0.12" strokeWidth="1.2" />
          <line x1="180" y1="428" x2="448" y2="368" strokeOpacity="0.10" strokeWidth="1.2" />
        </g>
      );

    case 'clinic_halo':
      // Бестеневая операционная лампа и чистая линия монитора
      return (
        <g stroke={accent} fill="none">
          <circle cx="240" cy="126" r="112" strokeOpacity="0.12" strokeWidth="1.2" />
          <circle cx="240" cy="126" r="74" strokeOpacity="0.09" strokeWidth="1" />
          <circle cx="240" cy="126" r="28" fill={accent} fillOpacity="0.05" strokeOpacity="0.14" />
          <polyline
            points="28,312 168,312 186,292 202,334 218,274 234,320 252,312 452,312"
            strokeOpacity="0.16"
            strokeWidth="1.3"
          />
        </g>
      );
  }
}

export function SceneBackdrop({ packId, blockNum = 1, inDanger = false }: SceneBackdropProps) {
  const theme = getPackAtmosphere(packId, blockNum, inDanger);
  const motifOpacity = blockNum >= 3 ? 1.18 : blockNum === 2 ? 1.08 : 1;

  return (
    <div className="scene-backdrop-layer" aria-hidden="true">
      <svg
        viewBox="0 0 480 920"
        preserveAspectRatio="xMidYMin slice"
        className="scene-backdrop-svg"
        style={{ opacity: motifOpacity }}
      >
        {renderMotifGeometry(theme.motif, theme.accent)}
      </svg>

      {blockNum >= 2 && (
        <div
          className={`scene-escalation-vignette ${blockNum >= 3 ? 'tier-3' : 'tier-2'}`}
        />
      )}

      {inDanger && <div className="scene-danger-halo" />}
    </div>
  );
}
