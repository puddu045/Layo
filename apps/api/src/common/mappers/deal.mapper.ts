import type { Deal, DealCategory, DealLocationType, DealStatus } from '@layo/contracts';

export interface DealRow {
  id: string;
  businessId: string;
  business: { name: string };
  airportIata: string;
  terminal: string | null;
  locationType: string;
  category: string;
  title: string;
  description: string;
  termsAndConditions: string | null;
  promoCode: string | null;
  validFrom: Date;
  validUntil: Date;
  status: string;
  rejectionReason: string | null;
}

export function toDeal(row: DealRow): Deal {
  return {
    id: row.id,
    businessId: row.businessId,
    businessName: row.business.name,
    airportIata: row.airportIata,
    terminal: row.terminal ?? undefined,
    locationType: row.locationType as DealLocationType,
    category: row.category as DealCategory,
    title: row.title,
    description: row.description,
    termsAndConditions: row.termsAndConditions ?? undefined,
    promoCode: row.promoCode ?? undefined,
    validFrom: row.validFrom.toISOString().slice(0, 10),
    validUntil: row.validUntil.toISOString().slice(0, 10),
    status: row.status as DealStatus,
    rejectionReason: row.rejectionReason ?? undefined,
  };
}
