import type { PackId } from '../types';

export type SceneMotifKind =
  | 'office_blinds'
  | 'boardroom_panels'
  | 'terminal_telemetry'
  | 'architect_draft'
  | 'cafe_pendant'
  | 'pvz_shelves'
  | 'fulfillment_gates'
  | 'asphalt_beams'
  | 'clinic_halo';

export interface PackAtmosphereTheme {
  motif: SceneMotifKind;
  /** Нижний/внешний тон сцены (meta theme-color, Telegram header/bg) */
  bgCanvas: string;
  /** Центральный световой купол позади колоды */
  bgGlow: string;
  /** Верхний тон модальных листов и каталога */
  bgShell: string;
  /** Нижний тон модальных листов */
  bgShellBottom: string;
  /** Приподнятые плашки, портретная подложка и чипы */
  bgElevated: string;
  /** Фирменный акцент колоды и её аудитории */
  accent: string;
  /** Мягкое свечение акцента */
  accentSoft: string;
  /** Шапка карточки для экспорта вертикальных клипов */
  cardHeader: string;
}

const ATMOSPHERES: Record<SceneMotifKind, PackAtmosphereTheme> = {
  // 1. Офис на грани — вечерний стеклянный опенспейс, сизый сланец и тёплая настольная лампа
  office_blinds: {
    motif: 'office_blinds',
    bgCanvas: '#0c1219',
    bgGlow: '#1b293a',
    bgShell: '#121a24',
    bgShellBottom: '#0b1017',
    bgElevated: '#192432',
    accent: '#d6a05c',
    accentSoft: 'rgba(214, 160, 92, 0.24)',
    cardHeader: '#1c2a3b',
  },

  // 2. Переговоры и Босс продаж — закрытая переговорная, глубокая хвоя и матовая латунь
  boardroom_panels: {
    motif: 'boardroom_panels',
    bgCanvas: '#0b1310',
    bgGlow: '#192e25',
    bgShell: '#101b16',
    bgShellBottom: '#0a120e',
    bgElevated: '#17261f',
    accent: '#c89b4f',
    accentSoft: 'rgba(200, 155, 79, 0.24)',
    cardHeader: '#182b23',
  },

  // 3. Продакт-менеджер и ИТ — полуночный инженерный индиго-графит и холодная стальная лазурь
  terminal_telemetry: {
    motif: 'terminal_telemetry',
    bgCanvas: '#09111b',
    bgGlow: '#162a40',
    bgShell: '#0e1826',
    bgShellBottom: '#080f18',
    bgElevated: '#152336',
    accent: '#72b6d4',
    accentSoft: 'rgba(114, 182, 212, 0.24)',
    cardHeader: '#172c42',
  },

  // 4. Дизайн и Ремонт — архитектурный графит-травертин и тёплая терракотовая латунь
  architect_draft: {
    motif: 'architect_draft',
    bgCanvas: '#140f0b',
    bgGlow: '#2e2218',
    bgShell: '#1b1510',
    bgShellBottom: '#110d09',
    bgElevated: '#261d16',
    accent: '#da9c52',
    accentSoft: 'rgba(218, 156, 82, 0.24)',
    cardHeader: '#302318',
  },

  // 5. Своя кофейня — тёмная эспрессо-обжарка и золотистая крема утренней смены
  cafe_pendant: {
    motif: 'cafe_pendant',
    bgCanvas: '#140d09',
    bgGlow: '#301f14',
    bgShell: '#1c130d',
    bgShellBottom: '#110b08',
    bgElevated: '#281b13',
    accent: '#dea366',
    accentSoft: 'rgba(222, 163, 102, 0.25)',
    cardHeader: '#332217',
  },

  // 6. Менеджер ПВЗ — декабрьские сумерки на выдаче, тёплый крафтовый картон и зимнее стекло
  pvz_shelves: {
    motif: 'pvz_shelves',
    bgCanvas: '#140d0c',
    bgGlow: '#2f1d19',
    bgShell: '#1c1210',
    bgShellBottom: '#110b0a',
    bgElevated: '#271916',
    accent: '#e09458',
    accentSoft: 'rgba(224, 148, 88, 0.24)',
    cardHeader: '#321f1b',
  },

  // 7. Селлер маркетплейса — благородный ежевично-графитовый фулфилмент и медная маржа
  fulfillment_gates: {
    motif: 'fulfillment_gates',
    bgCanvas: '#120b17',
    bgGlow: '#2b1a36',
    bgShell: '#191020',
    bgShellBottom: '#0f0914',
    bgElevated: '#24172e',
    accent: '#d99b72',
    accentSoft: 'rgba(217, 155, 114, 0.24)',
    cardHeader: '#2e1d3a',
  },

  // 8. Автоподбор и Перекуп — мокрый ночной асфальт, отблеск стоп-огней и натриевые фонари
  asphalt_beams: {
    motif: 'asphalt_beams',
    bgCanvas: '#130c0b',
    bgGlow: '#2f1a18',
    bgShell: '#1a1110',
    bgShellBottom: '#100a09',
    bgElevated: '#251817',
    accent: '#de8f5b',
    accentSoft: 'rgba(222, 143, 91, 0.24)',
    cardHeader: '#331e1c',
  },

  // 9. Частная клиника — глубокий хирургический морской петроль и спокойный фарфор-шалфей
  clinic_halo: {
    motif: 'clinic_halo',
    bgCanvas: '#081416',
    bgGlow: '#153136',
    bgShell: '#0d1d20',
    bgShellBottom: '#071012',
    bgElevated: '#142a2e',
    accent: '#78c6bc',
    accentSoft: 'rgba(120, 198, 188, 0.24)',
    cardHeader: '#18363b',
  },
};

const PACK_TO_MOTIF: Record<PackId, SceneMotifKind> = {
  office_manager: 'office_blinds',
  sales_rop: 'boardroom_panels',
  it_product: 'terminal_telemetry',
  renovation_pro: 'architect_draft',
  barista_pro: 'cafe_pendant',
  pvz_december: 'pvz_shelves',
  wb_seller: 'fulfillment_gates',
  car_flipper: 'asphalt_beams',
  plastic_surgeon: 'clinic_halo',

  // Резервные колоды также получают органичную среду по домену и аудитории
  nvc_master: 'office_blinds',
  sales_manager: 'boardroom_panels',
  scs_designer: 'architect_draft',
  cctv_installer: 'terminal_telemetry',
  sec_sysadmin: 'terminal_telemetry',
  it_cfo: 'boardroom_panels',
  tender_44fz: 'office_blinds',
  ux_designer: 'fulfillment_gates',
  ai_agent: 'terminal_telemetry',
  smm_insta: 'fulfillment_gates',
  hr_family: 'cafe_pendant',
};

function mixHex(hexA: string, hexB: string, ratioB: number): string {
  const cleanA = hexA.replace('#', '');
  const cleanB = hexB.replace('#', '');
  if (cleanA.length !== 6 || cleanB.length !== 6) return hexA;
  const rA = parseInt(cleanA.slice(0, 2), 16);
  const gA = parseInt(cleanA.slice(2, 4), 16);
  const bA = parseInt(cleanA.slice(4, 6), 16);
  const rB = parseInt(cleanB.slice(0, 2), 16);
  const gB = parseInt(cleanB.slice(2, 4), 16);
  const bB = parseInt(cleanB.slice(4, 6), 16);
  const t = Math.max(0, Math.min(1, ratioB));
  const r = Math.round(rA + (rB - rA) * t);
  const g = Math.round(gA + (gB - gA) * t);
  const b = Math.round(bA + (bB - bA) * t);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b
    .toString(16)
    .padStart(2, '0')}`;
}

/**
 * Возвращает атмосферу комнаты с учётом:
 * 1) выбранной колоды и её целевой аудитории;
 * 2) драматургии забега (Блок I -> Блок II вечернее сгущение -> Блок III ночной пик);
 * 3) критического состояния шкал (деликатный тревожный отблеск).
 */
export function getPackAtmosphere(
  packId: PackId,
  blockNum: number = 1,
  inDanger: boolean = false
): PackAtmosphereTheme {
  const motif = PACK_TO_MOTIF[packId] ?? 'office_blinds';
  const base = ATMOSPHERES[motif];

  let bgCanvas = base.bgCanvas;
  let bgGlow = base.bgGlow;

  if (blockNum === 2) {
    // Блок II: чуть глубже тени и теплее центральный свет
    bgCanvas = mixHex(base.bgCanvas, '#070608', 0.16);
    bgGlow = mixHex(base.bgGlow, base.accent, 0.08);
  } else if (blockNum >= 3) {
    // Блок III: ночная кульминация с высоким контрастом сцены
    bgCanvas = mixHex(base.bgCanvas, '#050408', 0.28);
    bgGlow = mixHex(base.bgGlow, base.accent, 0.14);
  }

  if (inDanger) {
    // Едва заметное тёпло-багровое напряжение в куполе света при критической шкале
    bgGlow = mixHex(bgGlow, '#5c1f1a', 0.22);
  }

  return {
    ...base,
    bgCanvas,
    bgGlow,
  };
}

let lastAppliedKey = '';

/**
 * Синхронизирует CSS-переменные сцены, системную плашку Safari (theme-color)
 * и рамку Telegram Mini App с текущей атмосферой колоды.
 */
export function applyAtmosphereToDocument(
  packId: PackId,
  blockNum: number = 1,
  inDanger: boolean = false
): PackAtmosphereTheme {
  const theme = getPackAtmosphere(packId, blockNum, inDanger);
  if (typeof document === 'undefined') return theme;

  const cacheKey = `${packId}:${blockNum}:${inDanger ? 1 : 0}`;
  if (cacheKey === lastAppliedKey) return theme;
  lastAppliedKey = cacheKey;

  const root = document.documentElement;
  root.style.setProperty('--bg-canvas', theme.bgCanvas);
  root.style.setProperty('--bg-glow', theme.bgGlow);
  root.style.setProperty('--bg-shell', theme.bgShell);
  root.style.setProperty('--bg-shell-bottom', theme.bgShellBottom);
  root.style.setProperty('--bg-elevated', theme.bgElevated);
  root.style.setProperty('--brass', theme.accent);
  root.style.setProperty('--brass-soft', theme.accentSoft);

  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute('content', theme.bgCanvas);
  }

  try {
    const tg = (
      window as unknown as {
        Telegram?: {
          WebApp?: {
            setHeaderColor?: (c: string) => void;
            setBackgroundColor?: (c: string) => void;
          };
        };
      }
    ).Telegram?.WebApp;
    tg?.setHeaderColor?.(theme.bgCanvas);
    tg?.setBackgroundColor?.(theme.bgCanvas);
  } catch {
    // ignore
  }

  return theme;
}
