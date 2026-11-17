import type { JobPack, PackCategory, PackId } from '../../types';
import { BARISTA_ACUP_PACK } from './baristaAcup';
import { HR_RECRUITER_PACK } from './hrRecruiter';
import { IT_FIN_DIRECTOR_PACK } from './itFinDirector';
import { PLASTIC_SURGEON_PACK } from './plasticSurgeon';
import { PRODUCT_MANAGER_PACK } from './productManager';
import { PVZ_MANAGER_PACK } from './pvzManager';
import { RECTOR_NII_PACK } from './rectorNii';
import { RENOVATION_PRO_PACK } from './renovationPro';
import { SEC_SYSADMIN_PACK } from './secSysadmin';
import { SMM_PRODUCER_PACK } from './smmProducer';
import { TENDER_SPEC_PACK } from './tenderSpec';
import { WB_SELLER_PACK } from './wbSeller';

function cleanEditorialTag(raw: string): string {
  return raw.replace(/^[^\p{L}\p{N}]+/u, '').trim();
}

function withCategory(pack: JobPack, category: PackCategory): JobPack {
  return {
    ...pack,
    category,
    badge: cleanEditorialTag(pack.badge),
    targetWeeks: 36,
    endings: pack.endings.map((e) => ({
      ...e,
      badge: cleanEditorialTag(e.badge),
    })),
  };
}

// Продакт-менеджер стоит самым первым в списке и выбран по умолчанию!
export const JOB_PACKS: JobPack[] = [
  withCategory(PRODUCT_MANAGER_PACK, 'tech_b2b'),
  withCategory(SMM_PRODUCER_PACK, 'market_media'),
  withCategory(RECTOR_NII_PACK, 'tech_b2b'),
  withCategory(PLASTIC_SURGEON_PACK, 'real_sector'),
  withCategory(WB_SELLER_PACK, 'market_media'),
  withCategory(RENOVATION_PRO_PACK, 'real_sector'),
  withCategory(SEC_SYSADMIN_PACK, 'tech_b2b'),
  withCategory(TENDER_SPEC_PACK, 'tech_b2b'),
  withCategory(IT_FIN_DIRECTOR_PACK, 'tech_b2b'),
  withCategory(PVZ_MANAGER_PACK, 'market_media'),
  withCategory(BARISTA_ACUP_PACK, 'real_sector'),
  withCategory(HR_RECRUITER_PACK, 'market_media'),
];

export function getJobPack(id: PackId): JobPack {
  return JOB_PACKS.find((p) => p.id === id) ?? JOB_PACKS[0];
}
