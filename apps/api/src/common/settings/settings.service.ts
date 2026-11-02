import { Injectable } from '@nestjs/common';
import type { Prisma } from '@layo/db';
import type { Settings, SettingsCategory, UpdateSettingsRequest } from '@layo/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { mergeSettingsCategory } from './settings-defaults';

/**
 * Admin-editable runtime configuration (Settings module), backed by one `AppSetting` row per
 * category. A missing row just means "nothing overridden yet" — `get()` always returns a full,
 * valid object by merging any stored partial over the compiled-in defaults (`mergeSettingsCategory`).
 */
@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async getAll(): Promise<Settings> {
    const rows = await this.prisma.client.appSetting.findMany();
    const byKey = new Map(rows.map((r) => [r.key, r.value as Record<string, unknown>]));
    return {
      moderation: mergeSettingsCategory('moderation', byKey.get('moderation')),
      matching: mergeSettingsCategory('matching', byKey.get('matching')),
      airportChat: mergeSettingsCategory('airportChat', byKey.get('airportChat')),
      featureFlags: mergeSettingsCategory('featureFlags', byKey.get('featureFlags')),
    };
  }

  async getCategory<K extends SettingsCategory>(category: K): Promise<Settings[K]> {
    const row = await this.prisma.client.appSetting.findUnique({ where: { key: category } });
    return mergeSettingsCategory(category, row?.value as object | undefined);
  }

  async update(adminId: string, dto: UpdateSettingsRequest): Promise<Settings> {
    const entries = Object.entries(dto) as Array<[SettingsCategory, object | undefined]>;
    for (const [category, patch] of entries) {
      if (!patch) continue;
      const current = await this.getCategory(category);
      const next = { ...current, ...patch };
      await this.prisma.client.appSetting.upsert({
        where: { key: category },
        create: { key: category, value: next as Prisma.InputJsonValue, updatedByAdminId: adminId },
        update: { value: next as Prisma.InputJsonValue, updatedByAdminId: adminId },
      });
      await this.auditLogService.record(adminId, 'UPDATE_SETTINGS', 'AppSetting', category, { patch });
    }
    return this.getAll();
  }
}
