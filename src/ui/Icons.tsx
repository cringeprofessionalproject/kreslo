import type { PackId, StatKey } from '../types';

interface IconProps {
  size?: number;
  className?: string;
}

export function IconGrid({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export function IconDots({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className}>
      <circle cx="5" cy="12" r="1.5" fill="currentColor" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <circle cx="19" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}

export function IconClose({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function IconVolume({ muted, size = 17, className }: IconProps & { muted?: boolean }) {
  return muted ? (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M11 5L6 9H2v6h4l5 4V5z" />
      <path d="M22 9l-6 6M16 9l6 6" />
    </svg>
  ) : (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M11 5L6 9H2v6h4l5 4V5z" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

export function IconShare({ size = 17, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}

export function IconArchive({ size = 17, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2" y="4" width="20" height="5" rx="1" />
      <path d="M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9" />
      <path d="M10 13h4" />
    </svg>
  );
}

export function IconFrame({ size = 17, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="6" y="2" width="12" height="20" rx="2.5" />
      <circle cx="12" cy="18" r="1" fill="currentColor" />
    </svg>
  );
}

export function IconLock({ size = 14, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

export function IconCheck({ size = 14, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function IconInfo({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="9.5" />
      <line x1="12" y1="16" x2="12" y2="11.5" />
      <circle cx="12" cy="8" r="0.8" fill="currentColor" />
    </svg>
  );
}

/**
 * Чистые векторные пиктограммы для 4 метрик вместо разношёрстных системных эмодзи.
 */
export function PillarSvgIcon({
  packId,
  statKey,
  size = 19,
}: {
  packId: PackId;
  statKey: StatKey;
  size?: number;
}) {
  // Деньги / Казна / Маржа / ФОТ / Бюджет
  const moneyMap: Partial<Record<PackId, StatKey>> = {
    sales_rop: 's1',
    sales_manager: 's1',
    smm_insta: 's2',
    plastic_surgeon: 's3',
    renovation_pro: 's1',
    wb_seller: 's1',
    sec_sysadmin: 's3',
    tender_44fz: 's1',
    it_cfo: 's1',
    it_product: 's1',
    pvz_december: 's4',
    ux_designer: 's4',
    hr_family: 's1',
    cctv_installer: 's1',
    scs_designer: 's1',
    car_flipper: 's1',
    barista_pro: 's1',
    office_manager: 's1',
    ai_agent: 's1',
  };

  // Закон / Порядок / Надзор / ИБ
  const lawMap: Partial<Record<PackId, StatKey>> = {
    sales_rop: 's4',
    sales_manager: 's4',
    smm_insta: 's4',
    plastic_surgeon: 's4',
    renovation_pro: 's4',
    wb_seller: 's4',
    sec_sysadmin: 's1',
    tender_44fz: 's3',
    it_cfo: 's2',
    it_product: 's4',
    cctv_installer: 's4',
    scs_designer: 's2',
    car_flipper: 's4',
    office_manager: 's2',
    ai_agent: 's4',
  };

  // Инженерия / Качество / Эстетика / Система
  const craftMap: Partial<Record<PackId, StatKey>> = {
    sales_rop: 's2',
    sales_manager: 's2',
    plastic_surgeon: 's2',
    renovation_pro: 's2',
    sec_sysadmin: 's2',
    it_product: 's2',
    ux_designer: 's2',
    pvz_december: 's3',
    wb_seller: 's2',
    cctv_installer: 's2',
    scs_designer: 's4',
    car_flipper: 's2',
    barista_pro: 's2',
    ai_agent: 's2',
  };

  if (moneyMap[packId] === statKey) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M10 8h3.5a2.5 2.5 0 0 1 0 5H10V8z" />
        <path d="M8.5 13h5M8.5 15.5h4.5M10 13v4.5" />
      </svg>
    );
  }

  if (lawMap[packId] === statKey) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3l8 3.5v5.5c0 5-3.4 8.3-8 9.8-4.6-1.5-8-4.8-8-9.8V6.5L12 3z" />
        <polyline points="9 12 11.2 14.2 15.5 9.8" />
      </svg>
    );
  }

  if (craftMap[packId] === statKey) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 21 7 12 12 3 7 12 2" />
        <polyline points="3 12 12 17 21 12" />
        <polyline points="3 17 12 22 21 17" />
      </svg>
    );
  }

  // Пульс / Люди / Охваты / Нервы
  if (statKey === 's2' || statKey === 's4') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 20 9 4 6 12 2 12" />
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9.5" cy="7" r="3.5" />
      <path d="M22 21v-2a3.5 3.5 0 0 0-2.6-3.4" />
      <path d="M16 3.7a3.5 3.5 0 0 1 0 6.8" />
    </svg>
  );
}
