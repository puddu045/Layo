import type { Business, BusinessCategory, BusinessStatus } from '@layo/contracts';

export interface BusinessRow {
  id: string;
  name: string;
  category: string;
  airportIata: string;
  status: string;
  contactEmail: string;
  createdAt: Date;
}

export function toBusiness(row: BusinessRow): Business {
  return {
    id: row.id,
    name: row.name,
    category: row.category as BusinessCategory,
    airportIata: row.airportIata,
    status: row.status as BusinessStatus,
    contactEmail: row.contactEmail,
    createdAt: row.createdAt.toISOString(),
  };
}
