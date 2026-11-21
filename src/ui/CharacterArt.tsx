import type { PackId } from '../types';

interface CharacterArtProps {
  packId: PackId;
  cardId: string;
  speaker: string;
  blockNum: number;
  hideFaceForCutout?: boolean;
}

function hashCode(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h | 0);
}

interface PackPalette {
  bg: string;
  bgDeep: string;
  glow: string;
  suit: string;
  suitAlt: string;
  accent: string;
  skinLight: string;
  skinShade: string;
}

const PALETTES: Record<PackId, PackPalette> = {
  it_product: {
    bg: '#13202C',
    bgDeep: '#0A1219',
    glow: '#294861',
    suit: '#192B3B',
    suitAlt: '#243B50',
    accent: '#D8A25E',
    skinLight: '#F4EAD9',
    skinShade: '#DFCFB6',
  },
  smm_insta: {
    bg: '#24171D',
    bgDeep: '#130B0F',
    glow: '#4F2F3B',
    suit: '#2D1D24',
    suitAlt: '#3D2731',
    accent: '#DF866C',
    skinLight: '#F6EDE4',
    skinShade: '#E2CFC1',
  },
  sales_rop: {
    bg: '#11241E',
    bgDeep: '#091410',
    glow: '#234C3F',
    suit: '#17332A',
    suitAlt: '#214539',
    accent: '#D6A35A',
    skinLight: '#F3EAD9',
    skinShade: '#DDD0B8',
  },
  plastic_surgeon: {
    bg: '#112529',
    bgDeep: '#091517',
    glow: '#245057',
    suit: '#18363B',
    suitAlt: '#22484E',
    accent: '#78C6BC',
    skinLight: '#F2F6F5',
    skinShade: '#D7E3E1',
  },
  renovation_pro: {
    bg: '#261C13',
    bgDeep: '#140E09',
    glow: '#523B24',
    suit: '#302318',
    suitAlt: '#402F20',
    accent: '#DFA752',
    skinLight: '#F4ECDF',
    skinShade: '#DFD0BA',
  },
  wb_seller: {
    bg: '#23172B',
    bgDeep: '#120B17',
    glow: '#4A2F5C',
    suit: '#2C1D37',
    suitAlt: '#3B274A',
    accent: '#D99B72',
    skinLight: '#F4ECF3',
    skinShade: '#DFD0DD',
  },
  sec_sysadmin: {
    bg: '#0F1F1B',
    bgDeep: '#08120F',
    glow: '#1F433B',
    suit: '#152824',
    suitAlt: '#1E3631',
    accent: '#68CE9F',
    skinLight: '#EBF3EF',
    skinShade: '#CFE0D8',
  },
  tender_44fz: {
    bg: '#151E2B',
    bgDeep: '#0B1018',
    glow: '#2B3E59',
    suit: '#1B2636',
    suitAlt: '#263449',
    accent: '#D9A85D',
    skinLight: '#F1EEE7',
    skinShade: '#DAD3C5',
  },
  it_cfo: {
    bg: '#162119',
    bgDeep: '#0C130E',
    glow: '#2D4432',
    suit: '#1C291E',
    suitAlt: '#27382A',
    accent: '#D0AE62',
    skinLight: '#F2EFE5',
    skinShade: '#DBD5C4',
  },
  pvz_december: {
    bg: '#241816',
    bgDeep: '#140D0B',
    glow: '#50322B',
    suit: '#2E1E1B',
    suitAlt: '#3F2A25',
    accent: '#E09458',
    skinLight: '#F4EDE5',
    skinShade: '#E0D1C2',
  },
  ux_designer: {
    bg: '#1E1826',
    bgDeep: '#100C15',
    glow: '#423254',
    suit: '#261E31',
    suitAlt: '#342942',
    accent: '#DF9B78',
    skinLight: '#F5EDE3',
    skinShade: '#E1D1BF',
  },
  hr_family: {
    bg: '#201C18',
    bgDeep: '#120F0D',
    glow: '#433A2E',
    suit: '#27221D',
    suitAlt: '#362F28',
    accent: '#D69E66',
    skinLight: '#F4EFE6',
    skinShade: '#DFD5C5',
  },
  cctv_installer: {
    bg: '#121E24',
    bgDeep: '#0A1115',
    glow: '#264352',
    suit: '#182830',
    suitAlt: '#223742',
    accent: '#63C2D6',
    skinLight: '#F2ECE2',
    skinShade: '#DCD1C0',
  },
  scs_designer: {
    bg: '#111E2D',
    bgDeep: '#09111B',
    glow: '#234263',
    suit: '#17293D',
    suitAlt: '#213852',
    accent: '#76B5F0',
    skinLight: '#F3EFE8',
    skinShade: '#DCD4C7',
  },
  car_flipper: {
    bg: '#251716',
    bgDeep: '#140C0B',
    glow: '#52302C',
    suit: '#301E1C',
    suitAlt: '#422926',
    accent: '#DE8F5B',
    skinLight: '#F4ECE1',
    skinShade: '#DFCEBC',
  },
  barista_pro: {
    bg: '#251A13',
    bgDeep: '#140D09',
    glow: '#523726',
    suit: '#2E2017',
    suitAlt: '#3F2C20',
    accent: '#DEA366',
    skinLight: '#F6EEE4',
    skinShade: '#E2D2C1',
  },
  sales_manager: {
    bg: '#162128',
    bgDeep: '#0C1317',
    glow: '#2C4654',
    suit: '#1C2B34',
    suitAlt: '#273B47',
    accent: '#DFAC60',
    skinLight: '#F4ECE0',
    skinShade: '#DFD1BD',
  },
  office_manager: {
    bg: '#17231E',
    bgDeep: '#0C1411',
    glow: '#2E4A3E',
    suit: '#1F3029',
    suitAlt: '#2B4239',
    accent: '#C89B4F',
    skinLight: '#F5EFE7',
    skinShade: '#E0D5C7',
  },
  ai_agent: {
    bg: '#122022',
    bgDeep: '#091113',
    glow: '#244A4F',
    suit: '#172A2D',
    suitAlt: '#213B3F',
    accent: '#7AE3CE',
    skinLight: '#EDF4F2',
    skinShade: '#D3E1DD',
  },
  nvc_master: {
    bg: '#2A2330',
    bgDeep: '#19141E',
    glow: '#4B3C57',
    suit: '#382D42',
    suitAlt: '#4A3C58',
    accent: '#D9B6E8',
    skinLight: '#F7EFE6',
    skinShade: '#E2D4C5',
  },
};

const FEMALE_TOKENS = [
  'анна',
  'алина',
  'марина',
  'вера',
  'зинаида',
  'ольга',
  'светлана',
  'дарья',
  'екатерина',
  'юлия',
  'ксения',
  'наталья',
  'елена',
  'ирина',
  'татьяна',
  'мария',
  'виктория',
  'полина',
  'софия',
  'леся',
  'настя',
  'катя',
  'таня',
  'оля',
  'клиентка',
  'пациентка',
  'сотрудница',
  'блогерша',
  'бухгалтер',
  'эйчар',
  'жена',
  'сестра',
  'мама',
  'хозяйка',
];

function detectFemaleSpeaker(speaker: string, seed: number): boolean {
  const low = speaker.toLowerCase();
  const words: string[] = low.match(/[а-яёa-z]+/g) ?? [];
  for (const tok of FEMALE_TOKENS) {
    if (words.includes(tok)) return true;
  }
  const firstWord = words[0] ?? '';
  if (firstWord.endsWith('а') || firstWord.endsWith('я')) {
    if (
      ![
        'гоша',
        'илья',
        'никита',
        'данила',
        'саша',
        'паша',
        'миша',
        'коля',
        'петя',
        'вася',
        'дима',
        'лёша',
        'леша',
        'серёжа',
        'сережа',
        'костя',
        'толя',
        'дядя',
        'саня',
        'женя',
      ].includes(firstWord)
    ) {
      return true;
    }
  }
  // Для обезличенных ролей («Клиент», «Маркетолог», «Аудитор») даём сбалансированное разнообразие
  if (
    low.includes('маркетолог') ||
    low.includes('дизайнер') ||
    low.includes('аналитик') ||
    low.includes('менеджер') ||
    low.includes('продюсер') ||
    low.includes('юрист') ||
    low.includes('инспектор') ||
    low.includes('специалист')
  ) {
    return seed % 2 === 1;
  }
  return false;
}

const HAIR_TONES = ['#171513', '#2A211B', '#3E2B1F', '#4A3525', '#232629', '#5A3826'];

/**
 * Единая редакционная иллюстрация в эстетике Reigns / Apple Arcade:
 * 8 архитектурных сцен × 7 костюмов × 10 причёсок × 6 очков/аксессуаров × 6 эмоций × 12 эмблем профессий.
 * При `hideFaceForCutout = true` оставляет аккуратную шею и воротник для живого ИИ-лица.
 */
export function EditorialCardPortrait({
  packId,
  cardId,
  speaker,
  blockNum,
  hideFaceForCutout = false,
}: CharacterArtProps) {
  const pal = PALETTES[packId] ?? PALETTES.it_product;
  const seed = hashCode(`${packId}::${cardId}::${speaker}`);

  const isFemale = detectFemaleSpeaker(speaker, seed);
  const sceneKind = seed % 8;
  const outfitKind = (seed >> 3) % 7;
  const hairKind = (seed >> 6) % 5;
  const hairColor = HAIR_TONES[(seed >> 9) % HAIR_TONES.length];
  const glassesKind = (seed >> 12) % 5; // 0: rect, 1: round, 2: browline, 3 & 4: none
  const expressionKind = (seed >> 15) % 6;
  const hasBeard = !isFemale && (seed >> 18) % 4 === 0;
  const suitFill = (seed >> 4) % 2 === 0 ? pal.suit : pal.suitAlt;

  const gradId = `ed_spot_${packId}_${seed % 9973}`;
  const beamId = `ed_beam_${packId}_${seed % 9973}`;

  return (
    <svg
      viewBox="0 0 360 200"
      className="editorial-svg-portrait"
      preserveAspectRatio="xMidYMid slice"
      aria-label={speaker}
    >
      <defs>
        <radialGradient id={gradId} cx="50%" cy="52%" r="62%">
          <stop offset="0%" stopColor={pal.glow} />
          <stop offset="68%" stopColor={pal.bg} />
          <stop offset="100%" stopColor={pal.bgDeep} />
        </radialGradient>
        <linearGradient id={beamId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={pal.accent} stopOpacity="0.16" />
          <stop offset="100%" stopColor={pal.accent} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Базовый глубокий фон */}
      <rect width="360" height="200" fill={`url(#${gradId})`} />

      {/* ───────── 1. ВОСЕМЬ АРХИТЕКТУРНЫХ ФОНОВЫХ КОМПОЗИЦИЙ ───────── */}
      {sceneKind === 0 && (
        <g opacity="0.9">
          <circle
            cx="180"
            cy="116"
            r="88"
            fill="none"
            stroke={pal.accent}
            strokeWidth="1"
            opacity="0.2"
          />
          <circle
            cx="180"
            cy="116"
            r="66"
            fill="rgba(0,0,0,0.18)"
            stroke={pal.accent}
            strokeWidth="1.3"
            opacity="0.42"
          />
          <line
            x1="180"
            y1="10"
            x2="180"
            y2="38"
            stroke={pal.accent}
            strokeWidth="1.2"
            opacity="0.32"
          />
        </g>
      )}

      {sceneKind === 1 && (
        <g>
          {/* Высокое панорамное окно переговорной с косым лучом света */}
          <polygon points="62,0 168,0 246,200 118,200" fill={`url(#${beamId})`} />
          <rect
            x="92"
            y="14"
            width="176"
            height="168"
            rx="8"
            fill="none"
            stroke={pal.accent}
            strokeWidth="1"
            opacity="0.24"
          />
          <line x1="180" y1="14" x2="180" y2="182" stroke={pal.accent} strokeWidth="1" opacity="0.18" />
          <line x1="92" y1="74" x2="268" y2="74" stroke={pal.accent} strokeWidth="1" opacity="0.18" />
        </g>
      )}

      {sceneKind === 2 && (
        <g opacity="0.25" stroke={pal.accent} strokeWidth="1">
          {/* Кабинетные горизонтальные жалюзи в духе Severance */}
          <line x1="36" y1="34" x2="324" y2="34" />
          <line x1="48" y1="54" x2="312" y2="54" />
          <line x1="60" y1="74" x2="300" y2="74" />
          <line x1="72" y1="94" x2="288" y2="94" />
          <circle cx="180" cy="112" r="64" fill="rgba(0,0,0,0.28)" strokeWidth="1.4" />
        </g>
      )}

      {sceneKind === 3 && (
        <g>
          {/* Классическая арка-ниша */}
          <path
            d="M108 200 V96 A72 72 0 0 1 252 96 V200"
            fill="rgba(0,0,0,0.22)"
            stroke={pal.accent}
            strokeWidth="1.3"
            opacity="0.42"
          />
          <path
            d="M94 200 V92 A86 86 0 0 1 266 92 V200"
            fill="none"
            stroke={pal.accent}
            strokeWidth="0.9"
            opacity="0.18"
          />
        </g>
      )}

      {sceneKind === 4 && (
        <g stroke={pal.accent}>
          {/* Прицельная телеметрия / дашборд */}
          <circle cx="180" cy="108" r="74" fill="rgba(0,0,0,0.16)" strokeWidth="1.1" strokeDasharray="5 5" opacity="0.38" />
          <circle cx="180" cy="108" r="52" fill="none" strokeWidth="1.2" opacity="0.32" />
          <line x1="86" y1="108" x2="118" y2="108" strokeWidth="1" opacity="0.28" />
          <line x1="242" y1="108" x2="274" y2="108" strokeWidth="1" opacity="0.28" />
        </g>
      )}

      {sceneKind === 5 && (
        <g>
          {/* Геометрический ромб ар-деко */}
          <polygon
            points="180,18 268,106 180,194 92,106"
            fill="rgba(0,0,0,0.2)"
            stroke={pal.accent}
            strokeWidth="1.3"
            opacity="0.38"
          />
          <circle cx="180" cy="108" r="54" fill="none" stroke={pal.accent} strokeWidth="0.9" opacity="0.24" />
        </g>
      )}

      {sceneKind === 6 && (
        <g>
          {/* Двухчастный светотеневой диптих */}
          <rect x="180" y="0" width="180" height="200" fill="rgba(0,0,0,0.22)" />
          <circle
            cx="180"
            cy="112"
            r="68"
            fill="rgba(0,0,0,0.16)"
            stroke={pal.accent}
            strokeWidth="1.4"
            opacity="0.4"
          />
        </g>
      )}

      {sceneKind === 7 && (
        <g stroke={pal.accent} fill="none">
          {/* Ступенчатый портал */}
          <path d="M84 200 V132 H112 V82 H144 V42 H216 V82 H248 V132 H276 V200" opacity="0.26" strokeWidth="1.2" />
          <circle cx="180" cy="112" r="58" fill="rgba(0,0,0,0.2)" opacity="0.38" strokeWidth="1.2" />
        </g>
      )}

      {/* Мягкая виньетка по нижнему краю портрета */}
      <rect x="0" y="168" width="360" height="32" fill="rgba(0,0,0,0.18)" />

      {/* ───────── 1.5. ТЕМАТИЧЕСКИЕ ПРОФЕССИОНАЛЬНЫЕ СЦЕНЫ ДЛЯ СПЕЦИАЛЬНОСТЕЙ ───────── */}
      {packId === 'cctv_installer' && (
        <g opacity="0.9">
          {/* Луч обзора уличной IP-камеры слева + экран регистратора NVR 2x2 справа */}
          <polygon points="62,64 148,48 148,142" fill={pal.accent} opacity="0.1" />
          <g stroke={pal.accent} strokeWidth="1.4" fill="#101B20">
            <line x1="20" y1="78" x2="38" y2="78" />
            <rect x="34" y="54" width="30" height="16" rx="4" transform="rotate(10 49 62)" />
            <circle cx="62" cy="64" r="3" fill="#FF6B5E" stroke="none" />
          </g>
          <g transform="translate(262, 54)" opacity="0.72">
            <rect x="0" y="0" width="76" height="52" rx="5" fill="rgba(8,14,18,0.78)" stroke={pal.accent} strokeWidth="1.2" />
            <line x1="38" y1="0" x2="38" y2="52" stroke={pal.accent} strokeWidth="0.8" opacity="0.5" />
            <line x1="0" y1="26" x2="76" y2="26" stroke={pal.accent} strokeWidth="0.8" opacity="0.5" />
            <circle cx="68" cy="8" r="2.5" fill="#FF5A4E" />
          </g>
        </g>
      )}

      {packId === 'scs_designer' && (
        <g opacity="0.88">
          {/* Миллиметровая сетка чертежа + перфорированный кабельный лоток сверху + шкаф 42U справа */}
          <g stroke={pal.accent} strokeWidth="0.6" opacity="0.18">
            <line x1="0" y1="44" x2="360" y2="44" strokeDasharray="4 4" />
            <line x1="56" y1="0" x2="56" y2="200" />
            <line x1="304" y1="0" x2="304" y2="200" />
          </g>
          <rect x="20" y="36" width="108" height="8" rx="2" fill="rgba(12,22,36,0.7)" stroke={pal.accent} strokeWidth="1.1" opacity="0.65" />
          <g transform="translate(274, 42)" opacity="0.8">
            <rect x="0" y="0" width="60" height="128" rx="4" fill="rgba(9,17,27,0.82)" stroke={pal.accent} strokeWidth="1.3" />
            {[14, 32, 50, 68].map((ry) => (
              <g key={ry}>
                <rect x="6" y={ry} width="48" height="10" rx="1.5" fill="rgba(118,181,240,0.12)" stroke={pal.accent} strokeWidth="0.8" />
                <circle cx="12" cy={ry + 5} r="1.4" fill="#6EE7B7" />
                <circle cx="19" cy={ry + 5} r="1.4" fill={pal.accent} />
                <circle cx="26" cy={ry + 5} r="1.4" fill="#6EE7B7" />
              </g>
            ))}
          </g>
        </g>
      )}

      {packId === 'car_flipper' && (
        <g opacity="0.9">
          {/* Силуэт авто с горящими фарами слева и экран толщиномера ЛКП справа */}
          <g transform="translate(18, 98)">
            <path
              d="M6 38 L18 18 H68 L84 34 H92 V50 H4 V38 Z"
              fill="rgba(18,13,9,0.78)"
              stroke={pal.accent}
              strokeWidth="1.4"
            />
            <polygon points="74,36 92,35 92,41 76,41" fill="#FFE09E" />
            <polygon points="92,36 134,26 134,52 92,42" fill={pal.accent} opacity="0.14" />
            <circle cx="24" cy="50" r="8" fill="#120E0B" stroke={pal.accent} strokeWidth="1.4" />
            <circle cx="72" cy="50" r="8" fill="#120E0B" stroke={pal.accent} strokeWidth="1.4" />
          </g>
          <g transform="translate(268, 56)" opacity="0.82">
            <rect x="0" y="0" width="68" height="44" rx="8" fill="rgba(18,13,10,0.82)" stroke={pal.accent} strokeWidth="1.2" />
            <text x="34" y="21" textAnchor="middle" fill={pal.accent} fontSize="11" fontWeight="700" fontFamily="JetBrains Mono, monospace">
              {(seed % 2 === 0 ? '118' : '940') + ' µm'}
            </text>
            <text x="34" y="34" textAnchor="middle" fill="rgba(255,255,255,0.55)" fontSize="7.5" fontFamily="JetBrains Mono, monospace">
              ЗАМЕР ЛКП
            </text>
          </g>
        </g>
      )}

      {packId === 'barista_pro' && (
        <g opacity="0.92">
          {/* Подвесные тёплые лампы кофейни + профессиональная эспрессо-машина с холдером и паром */}
          <g>
            <line x1="78" y1="0" x2="78" y2="28" stroke={pal.accent} strokeWidth="1.2" opacity="0.6" />
            <path d="M64 38 C66 26, 90 26, 92 38 Z" fill="#2A1C14" stroke={pal.accent} strokeWidth="1.3" />
            <polygon points="66,38 90,38 108,110 48,110" fill={pal.accent} opacity="0.08" />
          </g>
          <g transform="translate(22, 92)">
            <rect x="0" y="0" width="76" height="64" rx="6" fill="rgba(22,14,10,0.86)" stroke={pal.accent} strokeWidth="1.4" />
            <circle cx="24" cy="18" r="7" fill="none" stroke={pal.accent} strokeWidth="1.2" />
            <line x1="24" y1="18" x2="28" y2="14" stroke="#FFD699" strokeWidth="1.2" />
            <rect x="44" y="28" width="18" height="8" rx="2" fill={pal.accent} opacity="0.8" />
            <line x1="62" y1="32" x2="78" y2="35" stroke={pal.accent} strokeWidth="2.6" strokeLinecap="round" />
            <path d="M52 52 C50 44, 56 44, 54 38" fill="none" stroke="rgba(255,245,232,0.45)" strokeWidth="1.3" strokeLinecap="round" />
          </g>
        </g>
      )}

      {packId === 'sales_manager' && (
        <g opacity="0.86">
          {/* Канбан-этапы сделки слева и график личного плана справа (внутри безопасной зоны кадрирования) */}
          <g transform="translate(80, 34) scale(0.62)">
            <rect x="0" y="0" width="76" height="58" rx="6" fill="rgba(12,20,25,0.76)" stroke={pal.accent} strokeWidth="1.1" />
            <rect x="8" y="10" width="24" height="8" rx="2" fill={pal.accent} opacity="0.4" />
            <rect x="8" y="24" width="42" height="8" rx="2" fill={pal.accent} opacity="0.65" />
            <rect x="8" y="38" width="60" height="8" rx="2" fill="#6EE7B7" opacity="0.75" />
          </g>
          <g transform="translate(236, 40) scale(0.7)">
            <polyline
              points="4,44 22,32 38,35 64,10"
              fill="none"
              stroke={pal.accent}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="64" cy="10" r="3.5" fill="#6EE7B7" />
          </g>
        </g>
      )}

      {packId === 'office_manager' && (
        <g opacity="0.88">
          {/* Сплит-система кондиционера с потоками прохлады слева + курьерские коробки и папки справа */}
          <g transform="translate(20, 46)">
            <rect x="0" y="0" width="78" height="22" rx="5" fill="rgba(18,26,22,0.84)" stroke={pal.accent} strokeWidth="1.2" />
            <line x1="8" y1="16" x2="70" y2="16" stroke={pal.accent} strokeWidth="1" opacity="0.6" />
            <path d="M18 26 Q24 38 14 46 M38 26 Q44 38 34 46 M58 26 Q64 38 54 46" fill="none" stroke="#9EEAD1" strokeWidth="1.2" opacity="0.48" strokeLinecap="round" />
          </g>
          <g transform="translate(268, 96)">
            <rect x="8" y="24" width="56" height="38" rx="3" fill="#2A231B" stroke={pal.accent} strokeWidth="1.2" />
            <rect x="16" y="4" width="40" height="20" rx="2.5" fill="#342B20" stroke={pal.accent} strokeWidth="1.1" />
            <line x1="36" y1="4" x2="36" y2="24" stroke={pal.accent} strokeWidth="2" opacity="0.6" />
          </g>
        </g>
      )}

      {packId === 'nvc_master' && (
        <g opacity="0.9">
          {/* Тёплая пробковая доска с 4 кубиками-карточками конструктора диалога */}
          <g transform="translate(20, 46)">
            <rect x="0" y="0" width="76" height="54" rx="8" fill="rgba(46,35,54,0.82)" stroke={pal.accent} strokeWidth="1.1" />
            <rect x="8" y="9" width="26" height="15" rx="3" fill="#D9B6E8" opacity="0.72" />
            <rect x="40" y="9" width="28" height="15" rx="3" fill="#8ED7B6" opacity="0.72" />
            <rect x="8" y="30" width="26" height="15" rx="3" fill="#F0C886" opacity="0.72" />
            <rect x="40" y="30" width="28" height="15" rx="3" fill="rgba(255,255,255,0.22)" />
          </g>
          {/* Два пересекающихся тёплых диалоговых облака и кружка чая */}
          <g transform="translate(268, 48)" opacity="0.82">
            <rect x="0" y="6" width="44" height="24" rx="12" fill="rgba(217,182,232,0.2)" stroke={pal.accent} strokeWidth="1.2" />
            <rect x="20" y="22" width="46" height="24" rx="12" fill="rgba(142,215,182,0.18)" stroke="#8ED7B6" strokeWidth="1.2" />
          </g>
        </g>
      )}

      {packId === 'ai_agent' && (
        <g opacity="0.9">
          {/* Терминальные блоки промпта и нейронный граф токенов */}
          <g transform="translate(18, 52)">
            <rect x="0" y="0" width="82" height="54" rx="6" fill="rgba(8,18,20,0.82)" stroke={pal.accent} strokeWidth="1.1" />
            <line x1="10" y1="14" x2="52" y2="14" stroke={pal.accent} strokeWidth="2" strokeLinecap="round" />
            <line x1="10" y1="25" x2="68" y2="25" stroke="rgba(255,255,255,0.38)" strokeWidth="1.6" strokeLinecap="round" />
            <line x1="10" y1="36" x2="44" y2="36" stroke="#7AE3CE" strokeWidth="1.6" strokeLinecap="round" opacity="0.7" />
          </g>
          <g stroke={pal.accent} strokeWidth="1" opacity="0.55">
            <line x1="268" y1="62" x2="298" y2="48" />
            <line x1="268" y1="62" x2="306" y2="82" />
            <line x1="298" y1="48" x2="328" y2="68" />
            <line x1="306" y1="82" x2="328" y2="68" />
            <circle cx="268" cy="62" r="3.5" fill={pal.accent} />
            <circle cx="298" cy="48" r="3" fill="#0D1F22" />
            <circle cx="306" cy="82" r="3" fill="#0D1F22" />
            <circle cx="328" cy="68" r="4" fill={pal.accent} />
          </g>
        </g>
      )}

      {/* Для длинных женских волос — задний слой локонов за плечами */}
      {!hideFaceForCutout && isFemale && (hairKind === 1 || hairKind === 3) && (
        <path
          d="M140 76 C134 108, 134 134, 144 148 L216 148 C226 134, 226 108, 220 76 Z"
          fill={hairColor}
        />
      )}

      {/* Шея рисуется ДО воротника и костюма, чтобы не перекрывать водолазки */}
      <rect x="168" y="113" width="24" height="25" rx="8" fill={pal.skinShade} />
      {!hideFaceForCutout && (
        <ellipse cx="180" cy="120" rx="12" ry="5" fill="rgba(0,0,0,0.22)" />
      )}

      {/* ───────── 2. СЕМЬ СИЛУЭТОВ ОДЕЖДЫ И АКСЕССУАРОВ ПЛЕЧЕВОГО ПОЯСА ───────── */}
      {/* Базовый скульптурный торс со светотенью */}
      <path
        d={
          isFemale
            ? 'M104 204 C110 152, 138 135, 180 135 C222 135, 250 152, 256 204 Z'
            : 'M94 204 C100 149, 133 133, 180 133 C227 133, 260 149, 266 204 Z'
        }
        fill={suitFill}
        stroke={pal.accent}
        strokeWidth="1.5"
      />
      <path
        d={
          isFemale
            ? 'M180 135 C222 135, 250 152, 256 204 L180 204 Z'
            : 'M180 133 C227 133, 260 149, 266 204 L180 204 Z'
        }
        fill="rgba(0,0,0,0.25)"
      />

      {/* Профессиональная форма новых специальностей (либо базовые 7 костюмов) */}
      {packId === 'barista_pro' ? (
        /* Крафтовый фартук бариста с латунными пряжками и темпером/ручником */
        <g>
          <polygon points="158,134 180,156 202,134" fill="#1D1612" />
          <rect x="144" y="152" width="72" height="52" rx="5" fill="#3B271B" stroke={pal.accent} strokeWidth="1.4" />
          <line x1="154" y1="134" x2="154" y2="154" stroke={pal.accent} strokeWidth="3.2" />
          <line x1="206" y1="134" x2="206" y2="154" stroke={pal.accent} strokeWidth="3.2" />
          <circle cx="154" cy="154" r="2.6" fill="#FFE0B2" />
          <circle cx="206" cy="154" r="2.6" fill="#FFE0B2" />
          <rect x="164" y="170" width="32" height="16" rx="3" fill="rgba(0,0,0,0.26)" stroke={pal.accent} strokeWidth="0.9" />
        </g>
      ) : packId === 'cctv_installer' ? (
        /* Утеплённый монтажный жилет со светоотражающими полосами и тестером витой пары */
        <g>
          <rect x="162" y="128" width="36" height="16" rx="4" fill="#101B20" stroke={pal.accent} strokeWidth="1" />
          <line x1="116" y1="168" x2="162" y2="168" stroke={pal.accent} strokeWidth="3.2" opacity="0.85" />
          <line x1="198" y1="168" x2="244" y2="168" stroke={pal.accent} strokeWidth="3.2" opacity="0.85" />
          <line x1="180" y1="144" x2="180" y2="204" stroke="rgba(255,255,255,0.22)" strokeWidth="1.6" />
          <rect x="204" y="176" width="18" height="22" rx="3" fill="#0E171C" stroke={pal.accent} strokeWidth="1.1" />
        </g>
      ) : packId === 'car_flipper' ? (
        /* Стёганый бомбер / куртка с воротником-стойкой и толщиномером в нагрудном кармане */
        <g>
          <path d="M154 132 L180 162 L206 132" fill="#18120E" stroke={pal.accent} strokeWidth="1.5" />
          <line x1="180" y1="162" x2="180" y2="204" stroke={pal.accent} strokeWidth="1.8" />
          <line x1="114" y1="164" x2="164" y2="164" stroke="rgba(255,255,255,0.1)" strokeWidth="1.2" />
          <line x1="196" y1="164" x2="246" y2="164" stroke="rgba(255,255,255,0.1)" strokeWidth="1.2" />
          <rect x="204" y="156" width="14" height="20" rx="3" fill="#120E0A" stroke={pal.accent} strokeWidth="1.3" />
          <rect x="207" y="159" width="8" height="6" rx="1" fill={pal.accent} />
        </g>
      ) : packId === 'scs_designer' ? (
        /* Инженерная рубашка с бейджем СКС и масштабной линейкой */
        <g>
          <polygon points="156,134 180,168 204,134" fill="#EBF2FA" opacity="0.92" />
          <path d="M162 140 L177 180 L198 140" fill="none" stroke={pal.accent} strokeWidth="1.6" />
          <rect x="170" y="178" width="20" height="15" rx="2.5" fill="#0E1B2B" stroke={pal.accent} strokeWidth="1.2" />
          <rect x="208" y="158" width="6" height="22" rx="1.5" fill={pal.accent} opacity="0.85" />
        </g>
      ) : packId === 'ai_agent' ? (
        /* Минималистичный кибер-воротник с подсвеченными нейронными дорожками */
        <g>
          <rect x="160" y="128" width="40" height="15" rx="5" fill="#0B191B" stroke={pal.accent} strokeWidth="1.3" />
          <path d="M142 152 L168 152 L180 168 L192 152 L218 152" fill="none" stroke={pal.accent} strokeWidth="1.6" opacity="0.85" />
          <circle cx="180" cy="168" r="3.5" fill={pal.accent} />
          <line x1="180" y1="172" x2="180" y2="202" stroke={pal.accent} strokeWidth="1.4" strokeDasharray="3 3" opacity="0.7" />
        </g>
      ) : outfitKind === 0 ? (
        /* Деловой пиджак с галстуком и нагрудным платком */
        <g>
          <polygon points="158,134 180,178 202,134" fill={pal.skinLight} opacity="0.94" />
          <polygon points="176,143 184,143 186,175 180,184 174,175" fill={pal.accent} />
          <path
            d="M150 136 L173 176 M210 136 L187 176"
            stroke="rgba(255,255,255,0.22)"
            strokeWidth="1.6"
            fill="none"
          />
          <polygon points="214,168 228,165 225,173" fill={pal.accent} opacity="0.85" />
        </g>
      ) : outfitKind === 1 ? (
        /* Водолазка основателя + бейдж на ленте */
        <g>
          <rect x="162" y="127" width="36" height="16" rx="5" fill="#14181B" stroke={pal.accent} strokeWidth="1" />
          <path d="M163 142 L177 182 L197 142" fill="none" stroke={pal.accent} strokeWidth="1.6" opacity="0.8" />
          <rect x="171" y="180" width="18" height="16" rx="3" fill="rgba(255,255,255,0.88)" />
        </g>
      ) : outfitKind === 2 ? (
        /* Продуктовое худи со шнурками и студийными наушниками на шее */
        <g>
          <path
            d="M146 136 C154 152, 206 152, 214 136"
            fill="none"
            stroke={pal.accent}
            strokeWidth="2"
          />
          <ellipse cx="155" cy="142" rx="9" ry="6" fill="#181A1D" stroke={pal.accent} strokeWidth="1.3" />
          <ellipse cx="205" cy="142" rx="9" ry="6" fill="#181A1D" stroke={pal.accent} strokeWidth="1.3" />
          <line x1="168" y1="148" x2="168" y2="178" stroke="rgba(255,255,255,0.5)" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="192" y1="148" x2="192" y2="178" stroke="rgba(255,255,255,0.5)" strokeWidth="1.6" strokeLinecap="round" />
        </g>
      ) : outfitKind === 3 ? (
        /* Открытый воротник рубашки + жилет */
        <g>
          <polygon points="156,134 180,168 204,134" fill={pal.skinLight} opacity="0.92" />
          <polygon points="156,134 168,154 160,158 148,140" fill="#FFFFFF" opacity="0.85" />
          <polygon points="204,134 192,154 200,158 212,140" fill="#EAE4D8" opacity="0.85" />
          <line x1="180" y1="168" x2="180" y2="200" stroke="rgba(255,255,255,0.16)" strokeWidth="1.4" />
        </g>
      ) : outfitKind === 4 ? (
        /* V-образный жакет с минималистичным кулоном / платком */
        <g>
          <polygon points="160,134 180,172 200,134" fill={pal.skinShade} />
          <path d="M167 144 Q180 158 193 144" fill="none" stroke={pal.accent} strokeWidth="1.5" />
          <circle cx="180" cy="154" r="3" fill={pal.accent} />
          <path d="M152 135 L178 176 M208 135 L182 176" stroke="rgba(255,255,255,0.22)" strokeWidth="1.5" fill="none" />
        </g>
      ) : outfitKind === 5 && packId === 'plastic_surgeon' ? (
        /* Медицинский халат со стетоскопом — строго в клинике */
        <g>
          <polygon points="158,134 180,170 202,134" fill="#F5F7F6" />
          <path d="M154 136 C150 162, 164 174, 172 174" fill="none" stroke={pal.accent} strokeWidth="2" />
          <circle cx="173" cy="174" r="4" fill={pal.accent} />
          <rect x="206" y="164" width="18" height="4" rx="2" fill={pal.accent} opacity="0.85" />
        </g>
      ) : outfitKind === 6 && packId === 'renovation_pro' ? (
        /* Ремесленный фартук — только для стройки и кофейни */
        <g>
          <polygon points="160,134 180,160 200,134" fill={pal.skinLight} opacity="0.9" />
          <rect x="150" y="156" width="60" height="46" rx="4" fill="rgba(0,0,0,0.28)" stroke={pal.accent} strokeWidth="1.2" />
          <line x1="156" y1="135" x2="156" y2="156" stroke={pal.accent} strokeWidth="2.4" />
          <line x1="204" y1="135" x2="204" y2="156" stroke={pal.accent} strokeWidth="2.4" />
        </g>
      ) : (
        /* Современный блейзер поверх футболки */
        <g>
          <polygon points="160,134 180,168 200,134" fill="#F4F1EA" />
          <path d="M154 134 L176 174 M206 134 L184 174" stroke={pal.accent} strokeWidth="1.6" fill="none" opacity="0.7" />
        </g>
      )}

      {/* ───────── 3. СКУЛЬПТУРНАЯ ГОЛОВА, ПРИЧЁСКИ, ОЧКИ И МИМИКА ───────── */}
      {!hideFaceForCutout && (
        <g>
          {/* Уши + серьги у части женских персонажей */}
          <circle cx="147" cy="88" r="5.8" fill={pal.skinShade} />
          <circle cx="213" cy="88" r="5.8" fill={pal.skinShade} />
          {isFemale && seed % 2 === 0 && (
            <>
              <circle cx="147" cy="95" r="2.2" fill={pal.accent} />
              <circle cx="213" cy="95" r="2.2" fill={pal.accent} />
            </>
          )}

          {/* Двухтоновое лицо с мягким боковым светом */}
          <rect
            x={isFemale ? '150' : '148'}
            y="48"
            width={isFemale ? '60' : '64'}
            height="72"
            rx={isFemale ? '29' : '26'}
            fill={pal.skinLight}
          />
          <path
            d={
              isFemale
                ? 'M180 48 H181 A29 29 0 0 1 210 77 V91 A29 29 0 0 1 181 120 H180 Z'
                : 'M180 48 H186 A26 26 0 0 1 212 74 V94 A26 26 0 0 1 186 120 H180 Z'
            }
            fill={pal.skinShade}
            opacity="0.72"
          />

          {/* Борода / щетина для части мужских персонажей */}
          {hasBeard && (
            <path
              d="M149 92 C149 114, 164 122, 180 122 C196 122, 211 114, 211 92 C205 104, 194 108, 180 108 C166 108, 155 104, 149 92 Z"
              fill={hairColor}
              opacity="0.86"
            />
          )}

          {/* Причёски и профессиональные головные уборы */}
          {packId === 'renovation_pro' && seed % 2 === 0 ? (
            /* Строительная каска */
            <g>
              <path d="M141 71 C143 37, 217 37, 219 71 L228 75 L132 75 Z" fill={pal.accent} />
              <rect x="174" y="42" width="12" height="22" rx="3" fill="rgba(255,255,255,0.22)" />
            </g>
          ) : packId === 'cctv_installer' && seed % 2 === 0 ? (
            /* Тёплая вязаная шапка монтажника с налобным фонарём */
            <g>
              <path d="M145 72 C146 39, 214 39, 215 72 Z" fill="#1F3440" stroke={pal.accent} strokeWidth="1.2" />
              <rect x="144" y="64" width="72" height="9" rx="4" fill="#16262F" stroke={pal.accent} strokeWidth="1" />
              <rect x="171" y="57" width="18" height="9" rx="3" fill="#0E161B" stroke={pal.accent} strokeWidth="1.2" />
              <circle cx="180" cy="61.5" r="2.6" fill="#FFE8A3" />
            </g>
          ) : packId === 'plastic_surgeon' && seed % 2 === 0 ? (
            /* Хирургическая шапочка */
            <path d="M146 70 C148 41, 212 41, 214 70 Z" fill={pal.accent} />
          ) : isFemale ? (
            hairKind === 0 ? (
              /* Каре с косым пробором */
              <path
                d="M144 98 C142 54, 154 40, 182 40 C210 40, 218 56, 216 98 C210 74, 200 60, 174 58 C156 58, 149 74, 144 98 Z"
                fill={hairColor}
              />
            ) : hairKind === 1 ? (
              /* Мягкая волна на плечи */
              <path
                d="M145 84 C145 42, 215 42, 215 84 C205 60, 186 55, 168 58 C154 60, 149 70, 145 84 Z"
                fill={hairColor}
              />
            ) : hairKind === 2 ? (
              /* Высокий гладкий пучок */
              <g fill={hairColor}>
                <circle cx="180" cy="37" r="13" />
                <path d="M148 76 C148 44, 212 44, 212 76 C202 58, 158 58, 148 76 Z" />
              </g>
            ) : hairKind === 3 ? (
              /* Прямая чёлка + длинные пряди */
              <path
                d="M146 80 C146 42, 214 42, 214 80 L208 66 L152 66 Z"
                fill={hairColor}
              />
            ) : (
              /* Короткая стильная пикси */
              <path
                d="M147 74 C148 40, 204 36, 213 68 C196 53, 162 56, 147 74 Z"
                fill={hairColor}
              />
            )
          ) : hairKind === 0 ? (
            /* Классический пробор */
            <path
              d="M146 75 C145 40, 215 40, 214 75 C204 57, 160 57, 146 75 Z"
              fill={hairColor}
            />
          ) : hairKind === 1 ? (
            /* Асимметричная волна */
            <path
              d="M147 74 C148 39, 198 34, 214 67 C198 53, 164 57, 147 74 Z"
              fill={hairColor}
            />
          ) : hairKind === 2 ? (
            /* Объёмные кудри */
            <g fill={hairColor}>
              <circle cx="158" cy="52" r="11" />
              <circle cx="173" cy="47" r="12" />
              <circle cx="190" cy="48" r="12" />
              <circle cx="203" cy="55" r="10" />
            </g>
          ) : hairKind === 3 ? (
            /* Короткий фейд / бокс */
            <path
              d="M148 68 C150 43, 210 43, 212 68 C202 56, 158 56, 148 68 Z"
              fill={hairColor}
            />
          ) : (
            /* Зачёс назад */
            <path
              d="M146 72 C144 38, 216 38, 214 72 C208 52, 152 52, 146 72 Z"
              fill={hairColor}
            />
          )}

          {/* Брови в зависимости от эмоции (6 вариантов характера) */}
          {expressionKind === 1 ? (
            /* Скептически приподнятая бровь */
            <path
              d="M157 76 L173 75 M187 72 L203 75"
              stroke="#1A1715"
              strokeWidth="2.3"
              strokeLinecap="round"
            />
          ) : expressionKind === 2 || expressionKind === 5 ? (
            /* Нахмуренные деловые брови */
            <path
              d="M157 73 L173 77 M187 77 L203 73"
              stroke="#1A1715"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          ) : (
            /* Спокойные уверенные брови */
            <path
              d="M158 75 L173 75.5 M187 75.5 L202 75"
              stroke="#1A1715"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          )}

          {/* Очки / взгляд / кибер-визор ИИ-агента */}
          {packId === 'ai_agent' && seed % 3 !== 0 ? (
            <g>
              <rect
                x="151"
                y="78"
                width="58"
                height="14"
                rx="7"
                fill="#0B191B"
                stroke={pal.accent}
                strokeWidth="1.8"
              />
              <line x1="158" y1="85" x2="202" y2="85" stroke={pal.accent} strokeWidth="2.2" strokeLinecap="round" />
              <circle cx="167" cy="85" r="2.5" fill="#FFFFFF" />
              <circle cx="193" cy="85" r="2.5" fill="#FFFFFF" />
            </g>
          ) : (
            <>
              {/* Зрачки рисуются ДО прозрачных линз очков */}
              <g fill="#181614">
                <circle cx="166" cy="84.5" r="2.6" />
                <circle cx="194" cy="84.5" r="2.6" />
              </g>
              {glassesKind === 0 ? (
                <g>
                  <line x1="147" y1="84" x2="155" y2="84" stroke="#181614" strokeWidth="1.8" />
                  <line x1="205" y1="84" x2="213" y2="84" stroke="#181614" strokeWidth="1.8" />
                  <rect
                    x="155"
                    y="79"
                    width="20"
                    height="13"
                    rx="3.5"
                    fill="rgba(20,28,26,0.12)"
                    stroke="#181614"
                    strokeWidth="2.1"
                  />
                  <rect
                    x="185"
                    y="79"
                    width="20"
                    height="13"
                    rx="3.5"
                    fill="rgba(20,28,26,0.12)"
                    stroke="#181614"
                    strokeWidth="2.1"
                  />
                  <line x1="175" y1="84" x2="185" y2="84" stroke="#181614" strokeWidth="2" />
                </g>
              ) : glassesKind === 1 ? (
                <g>
                  <line x1="147" y1="85" x2="156" y2="85" stroke="#221E1A" strokeWidth="1.6" />
                  <line x1="204" y1="85" x2="213" y2="85" stroke="#221E1A" strokeWidth="1.6" />
                  <circle
                    cx="165"
                    cy="85"
                    r="9"
                    fill="rgba(200,155,79,0.08)"
                    stroke="#221E1A"
                    strokeWidth="1.9"
                  />
                  <circle
                    cx="195"
                    cy="85"
                    r="9"
                    fill="rgba(200,155,79,0.08)"
                    stroke="#221E1A"
                    strokeWidth="1.9"
                  />
                  <line x1="174" y1="85" x2="186" y2="85" stroke="#221E1A" strokeWidth="1.8" />
                </g>
              ) : glassesKind === 2 ? (
                <g>
                  <line x1="147" y1="83" x2="155" y2="83" stroke="#181614" strokeWidth="1.8" />
                  <line x1="205" y1="83" x2="213" y2="83" stroke="#181614" strokeWidth="1.8" />
                  <path d="M154 80 H176 M184 80 H206" stroke="#181614" strokeWidth="2.8" strokeLinecap="round" />
                  <rect x="155" y="80" width="20" height="12" rx="5" fill="rgba(20,28,26,0.1)" stroke="#181614" strokeWidth="1.4" />
                  <rect x="185" y="80" width="20" height="12" rx="5" fill="rgba(20,28,26,0.1)" stroke="#181614" strokeWidth="1.4" />
                  <line x1="175" y1="83" x2="185" y2="83" stroke="#181614" strokeWidth="1.8" />
                </g>
              ) : null}
            </>
          )}

          {/* Нос и мимика губ (или медицинская маска у части врачей) */}
          {packId === 'plastic_surgeon' && seed % 3 === 0 ? (
            <rect x="155" y="94" width="50" height="22" rx="7" fill={pal.accent} />
          ) : (
            <>
              <polygon points="180,82 176,97 182,97" fill="rgba(0,0,0,0.18)" />
              {expressionKind === 0 || expressionKind === 4 ? (
                /* Сдержанная уверенная полуулыбка */
                <path
                  d="M173 105 Q180 109.5 188 104.5"
                  fill="none"
                  stroke="#2A2420"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              ) : expressionKind === 2 ? (
                /* Эмоциональная реплика / срочный вопрос */
                <rect x="175" y="103" width="10" height="5.5" rx="2.7" fill="#2A2420" />
              ) : expressionKind === 5 ? (
                /* Суровый скепсис */
                <path
                  d="M173 107 Q180 104 187 107"
                  fill="none"
                  stroke="#2A2420"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              ) : (
                /* Спокойная деловая линия */
                <line
                  x1="173"
                  y1="106"
                  x2="187"
                  y2="106"
                  stroke="#2A2420"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              )}
            </>
          )}

          {/* Телефонная гарнитура сейлза с микрофоном у щеки */}
          {(packId === 'sales_manager' || (packId === 'sales_rop' && seed % 2 === 0)) && (
            <g>
              <rect x="209" y="81" width="7" height="14" rx="3.5" fill="#141C22" stroke={pal.accent} strokeWidth="1.2" />
              <path
                d="M212 93 Q208 108 191 108"
                fill="none"
                stroke={pal.accent}
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <circle cx="190" cy="108" r="2.4" fill={pal.accent} />
            </g>
          )}
        </g>
      )}

      {/* ───────── 4. ПРОФЕССИОНАЛЬНАЯ ЭМБЛЕМА В SAFE-ZONE СМАРТФОНА ───────── */}
      <g transform="translate(226, 144)" stroke={pal.accent} strokeWidth="1.6" fill="none">
        <rect
          x="0"
          y="0"
          width="52"
          height="46"
          rx="12"
          fill="rgba(0,0,0,0.36)"
          stroke="rgba(255,255,255,0.11)"
          strokeWidth="1"
        />

        {packId === 'it_product' && (
          /* Канбан / продуктовая дорожная карта */
          <>
            <rect x="12" y="11" width="8" height="24" rx="2" />
            <rect x="22" y="11" width="8" height="16" rx="2" fill={pal.accent} fillOpacity="0.28" />
            <rect x="32" y="11" width="8" height="20" rx="2" />
          </>
        )}

        {packId === 'smm_insta' && (
          /* Вертикальный смартфон с Play */
          <>
            <rect x="16" y="9" width="20" height="28" rx="4" />
            <polygon points="24,19 24,27 31,23" fill={pal.accent} />
          </>
        )}

        {packId === 'sales_rop' && (
          /* Воронка продаж и конверсия */
          <>
            <polygon points="12,11 40,11 30,23 30,34 22,36 22,23" />
          </>
        )}

        {packId === 'plastic_surgeon' && (
          /* Кардиопульс эстетической хирургии */
          <polyline points="11,24 19,24 23,14 28,33 32,20 35,24 41,24" strokeLinecap="round" strokeLinejoin="round" />
        )}

        {packId === 'renovation_pro' && (
          /* Строительный угольник и уровень */
          <path d="M13 33 L39 13 M13 13 L39 13 L39 33 Z" />
        )}

        {packId === 'wb_seller' && (
          /* 3D-коробка маркетплейса */
          <>
            <path d="M14 15 L26 9 L38 15 L38 31 L26 37 L14 31 Z" />
            <line x1="14" y1="15" x2="26" y2="21" />
            <line x1="38" y1="15" x2="26" y2="21" />
            <line x1="26" y1="21" x2="26" y2="37" />
          </>
        )}

        {packId === 'pvz_december' && (
          /* Сканер штрих-кода ПВЗ */
          <>
            <line x1="14" y1="13" x2="14" y2="33" />
            <line x1="19" y1="13" x2="19" y2="33" strokeWidth="2.4" />
            <line x1="25" y1="13" x2="25" y2="33" />
            <line x1="31" y1="13" x2="31" y2="33" strokeWidth="2.4" />
            <line x1="37" y1="13" x2="37" y2="33" />
            <line x1="11" y1="23" x2="41" y2="23" stroke="#ff7a6b" strokeWidth="1.5" />
          </>
        )}

        {packId === 'sec_sysadmin' && (
          /* Щит информационной безопасности */
          <>
            <path d="M26 10 L38 15 V23 C38 30, 32 35, 26 37 C20 35, 14 30, 14 23 V15 Z" />
            <polyline points="21,23 25,27 32,19" />
          </>
        )}

        {packId === 'tender_44fz' && (
          /* Документ с печатью 44-ФЗ */
          <>
            <rect x="15" y="9" width="22" height="28" rx="3" />
            <line x1="20" y1="16" x2="32" y2="16" />
            <line x1="20" y1="21" x2="30" y2="21" />
            <circle cx="29" cy="29" r="4" fill={pal.accent} fillOpacity="0.3" />
          </>
        )}

        {packId === 'it_cfo' && (
          /* Финансовый график CFO */
          <>
            <line x1="13" y1="34" x2="39" y2="34" />
            <polyline points="14,29 22,23 27,26 37,14" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points="31,14 37,14 37,20" strokeLinecap="round" strokeLinejoin="round" />
          </>
        )}

        {packId === 'ux_designer' && (
          /* Перо кривых Безье и сетка дизайна */
          <>
            <path d="M26 10 L36 24 L29 35 H23 L16 24 Z" />
            <circle cx="26" cy="22" r="2.2" fill={pal.accent} />
          </>
        )}

        {packId === 'hr_family' && (
          /* Контур команды / оргструктуры */
          <>
            <circle cx="26" cy="17" r="4.5" />
            <path d="M16 33 C17 26, 35 26, 36 33" strokeLinecap="round" />
          </>
        )}

        {packId === 'cctv_installer' && (
          /* Объектив уличной IP-камеры */
          <>
            <rect x="13" y="14" width="22" height="14" rx="4" />
            <polygon points="35,17 41,14 41,28 35,25" />
            <circle cx="23" cy="21" r="3.2" fill={pal.accent} />
            <line x1="18" y1="28" x2="14" y2="35" />
          </>
        )}

        {packId === 'scs_designer' && (
          /* Патч-панель СКС и трасса чертежа */
          <>
            <rect x="12" y="13" width="28" height="10" rx="2" />
            <circle cx="17" cy="18" r="1.5" fill={pal.accent} />
            <circle cx="23" cy="18" r="1.5" fill={pal.accent} />
            <circle cx="29" cy="18" r="1.5" fill={pal.accent} />
            <polyline points="17,23 17,33 35,33 35,23" />
          </>
        )}

        {packId === 'car_flipper' && (
          /* Силуэт кузова и датчик толщиномера */
          <>
            <path d="M12 26 L16 18 H34 L39 26 V32 H12 Z" />
            <circle cx="18" cy="32" r="3" fill={pal.accent} />
            <circle cx="33" cy="32" r="3" fill={pal.accent} />
          </>
        )}

        {packId === 'barista_pro' && (
          /* Чашка капучино и пар */
          <>
            <path d="M15 19 H33 V26 C33 31, 29 34, 24 34 C19 34, 15 31, 15 26 Z" />
            <path d="M33 21 H37 C38.5 21, 38.5 26, 37 26 H33" />
            <path d="M21 15 C21 12, 23 12, 23 10 M27 15 C27 12, 29 12, 29 10" strokeLinecap="round" />
          </>
        )}

        {packId === 'sales_manager' && (
          /* Сделка и рост личного плана */
          <>
            <rect x="14" y="11" width="24" height="24" rx="4" />
            <polyline points="19,27 24,22 27,25 33,17" strokeLinecap="round" strokeLinejoin="round" />
          </>
        )}

        {packId === 'office_manager' && (
          /* Канцелярская скрепка-органайзер офиса */
          <path
            d="M21 25 V15 C21 11.5, 29 11.5, 29 15 V28 C29 33, 18 33, 18 28 V17"
            strokeLinecap="round"
          />
        )}

        {packId === 'nvc_master' && (
          /* Два диалоговых облака живого контакта */
          <>
            <rect x="13" y="13" width="16" height="12" rx="6" />
            <rect x="21" y="22" width="16" height="12" rx="6" />
          </>
        )}

        {packId === 'ai_agent' && (
          /* Нейронный узел ИИ-агента */
          <>
            <rect x="17" y="14" width="18" height="18" rx="4" />
            <circle cx="26" cy="23" r="3" fill={pal.accent} />
            <line x1="26" y1="9" x2="26" y2="14" />
            <line x1="26" y1="32" x2="26" y2="37" />
            <line x1="12" y1="23" x2="17" y2="23" />
            <line x1="35" y1="23" x2="40" y2="23" />
          </>
        )}
      </g>
    </svg>
  );
}
