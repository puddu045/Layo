import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { BusinessStatus } from '@layo/db';
import type { Business, RegisterBusinessRequest } from '@layo/contracts';
import { PrismaService } from '../common/prisma/prisma.service';
import { toBusiness } from '../common/mappers/business.mapper';
import { nextBusinessStatus, type BusinessStatusAction } from './business-status.util';

@Injectable()
export class BusinessesService {
  constructor(private readonly prisma: PrismaService) {}

  async register(userId: string, dto: RegisterBusinessRequest): Promise<Business> {
    const airport = await this.prisma.client.airport.findUnique({ where: { iataCode: dto.airportIata } });
    if (!airport) throw new BadRequestException('Unknown airport');

    const row = await this.prisma.client.business.create({
      data: {
        ownerUserId: userId,
        name: dto.name,
        category: dto.category,
        airportIata: dto.airportIata,
        contactEmail: dto.contactEmail,
      },
    });
    return toBusiness(row);
  }

  async listMine(userId: string): Promise<Business[]> {
    const rows = await this.prisma.client.business.findMany({
      where: { ownerUserId: userId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toBusiness);
  }

  async listAll(status?: BusinessStatus): Promise<Business[]> {
    const rows = await this.prisma.client.business.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toBusiness);
  }

  async applyStatusAction(businessId: string, action: BusinessStatusAction): Promise<Business> {
    const business = await this.prisma.client.business.findUnique({ where: { id: businessId } });
    if (!business) throw new NotFoundException('Business not found');

    const next = nextBusinessStatus(business.status, action);
    if (!next) {
      throw new BadRequestException(`Cannot ${action.toLowerCase()} a business that is ${business.status.toLowerCase()}`);
    }

    const row = await this.prisma.client.business.update({
      where: { id: businessId },
      data: { status: next },
    });
    return toBusiness(row);
  }

  /** Used by `DealsService` to resolve which business a non-admin caller is submitting a deal for,
   * and to check ownership when editing/listing an existing business's deals. */
  async requireOwnedApproved(userId: string, businessId: string | undefined): Promise<{ id: string }> {
    const owned = await this.prisma.client.business.findMany({
      where: { ownerUserId: userId, status: BusinessStatus.APPROVED },
    });

    if (businessId) {
      const match = owned.find((b) => b.id === businessId);
      if (!match) throw new ForbiddenException('You do not own an approved business with that id');
      return { id: match.id };
    }

    if (owned.length === 1) return { id: owned[0]!.id };
    if (owned.length === 0) throw new ForbiddenException('You do not have an approved business');
    throw new BadRequestException('You own multiple businesses — specify businessId');
  }

  /** Used by `DealsService` to authorize a non-admin caller against an existing deal's business. */
  async isOwner(userId: string, businessId: string): Promise<boolean> {
    const business = await this.prisma.client.business.findUnique({ where: { id: businessId } });
    return business?.ownerUserId === userId;
  }
}
