import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { BusinessStatus, DealStatus } from '@layo/db';
import type { CreateDealRequest, Deal, ModerateDealRequest, UpdateDealRequest } from '@layo/contracts';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditLogService } from '../common/audit/audit-log.service';
import { toDeal } from '../common/mappers/deal.mapper';
import { BusinessesService } from '../businesses/businesses.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { RequestUser } from '../common/guards/supabase-auth.guard';

const DEAL_INCLUDE = { business: { select: { name: true } } } as const;

@Injectable()
export class DealsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businessesService: BusinessesService,
    private readonly notificationsService: NotificationsService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async create(user: RequestUser, dto: CreateDealRequest): Promise<Deal> {
    const airport = await this.prisma.client.airport.findUnique({ where: { iataCode: dto.airportIata } });
    if (!airport) throw new BadRequestException('Unknown airport');

    const businessId = await this.resolveBusinessId(user, dto.businessId);

    const row = await this.prisma.client.deal.create({
      data: {
        businessId,
        airportIata: dto.airportIata,
        terminal: dto.terminal,
        locationType: dto.locationType,
        category: dto.category,
        title: dto.title,
        description: dto.description,
        termsAndConditions: dto.termsAndConditions,
        promoCode: dto.promoCode,
        validFrom: new Date(dto.validFrom),
        validUntil: new Date(dto.validUntil),
        createdBy: user.isAdmin ? 'ADMIN' : 'BUSINESS',
        status: user.isAdmin ? DealStatus.APPROVED : DealStatus.PENDING,
      },
      include: DEAL_INCLUDE,
    });
    return toDeal(row);
  }

  async update(user: RequestUser, dealId: string, dto: UpdateDealRequest): Promise<Deal> {
    const existing = await this.requireOwnedOrAdmin(user, dealId);

    if (dto.airportIata) {
      const airport = await this.prisma.client.airport.findUnique({ where: { iataCode: dto.airportIata } });
      if (!airport) throw new BadRequestException('Unknown airport');
    }

    const validFrom = dto.validFrom ?? existing.validFrom.toISOString().slice(0, 10);
    const validUntil = dto.validUntil ?? existing.validUntil.toISOString().slice(0, 10);
    if (validFrom > validUntil) {
      throw new BadRequestException('validUntil must be on or after validFrom');
    }

    // A non-admin edit always goes back through review, even if the deal was already approved —
    // otherwise an owner could bait-and-switch an approved deal's content after the fact.
    const resetsToReview = !user.isAdmin;

    const row = await this.prisma.client.deal.update({
      where: { id: dealId },
      data: {
        airportIata: dto.airportIata,
        terminal: dto.terminal,
        locationType: dto.locationType,
        category: dto.category,
        title: dto.title,
        description: dto.description,
        termsAndConditions: dto.termsAndConditions,
        promoCode: dto.promoCode,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
        ...(resetsToReview ? { status: DealStatus.PENDING, rejectionReason: null } : {}),
      },
      include: DEAL_INCLUDE,
    });
    return toDeal(row);
  }

  async remove(user: RequestUser, dealId: string): Promise<{ success: true }> {
    await this.requireOwnedOrAdmin(user, dealId);
    await this.prisma.client.deal.delete({ where: { id: dealId } });
    return { success: true };
  }

  async listForBusiness(user: RequestUser, businessId: string): Promise<Deal[]> {
    if (!user.isAdmin) {
      const owns = await this.businessesService.isOwner(user.id, businessId);
      if (!owns) throw new ForbiddenException('You do not own this business');
    }

    const rows = await this.prisma.client.deal.findMany({
      where: { businessId },
      include: DEAL_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toDeal);
  }

  async listAll(status?: DealStatus): Promise<Deal[]> {
    const rows = await this.prisma.client.deal.findMany({
      where: status ? { status } : undefined,
      include: DEAL_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toDeal);
  }

  async moderate(adminId: string, dealId: string, dto: ModerateDealRequest): Promise<Deal> {
    const existing = await this.prisma.client.deal.findUnique({
      where: { id: dealId },
      include: { business: { select: { ownerUserId: true } } },
    });
    if (!existing) throw new NotFoundException('Deal not found');
    if (existing.status !== DealStatus.PENDING) {
      throw new BadRequestException('Only a pending deal can be approved or rejected');
    }

    const status = dto.approve ? DealStatus.APPROVED : DealStatus.REJECTED;
    const row = await this.prisma.client.deal.update({
      where: { id: dealId },
      data: dto.approve
        ? { status: DealStatus.APPROVED, rejectionReason: null }
        : { status: DealStatus.REJECTED, rejectionReason: dto.rejectionReason },
      include: DEAL_INCLUDE,
    });

    await Promise.all([
      this.auditLogService.record(adminId, dto.approve ? 'APPROVE' : 'REJECT', 'Deal', dealId, {
        rejectionReason: dto.rejectionReason,
      }),
      this.notificationsService.create(existing.business.ownerUserId, 'DEAL_STATUS_CHANGED', {
        dealId,
        status,
        rejectionReason: dto.rejectionReason,
      }),
    ]);

    return toDeal(row);
  }

  /** The traveller-facing list: approved, currently valid deals at airports the caller's own
   * journeys actually touch (optionally narrowed to one of them). */
  async listForMe(userId: string, airportIata?: string): Promise<Deal[]> {
    const myAirports = await this.getUserAirportCodes(userId);
    if (myAirports.length === 0) return [];

    if (airportIata && !myAirports.includes(airportIata)) return [];
    const airportFilter = airportIata ? [airportIata] : myAirports;

    const now = new Date();
    const rows = await this.prisma.client.deal.findMany({
      where: {
        airportIata: { in: airportFilter },
        status: DealStatus.APPROVED,
        validFrom: { lte: now },
        validUntil: { gte: now },
      },
      include: DEAL_INCLUDE,
      orderBy: { validUntil: 'asc' },
    });
    return rows.map(toDeal);
  }

  private async resolveBusinessId(user: RequestUser, businessId: string | undefined): Promise<string> {
    if (user.isAdmin) {
      if (!businessId) throw new BadRequestException('businessId is required');
      const business = await this.prisma.client.business.findUnique({ where: { id: businessId } });
      if (!business) throw new NotFoundException('Business not found');
      if (business.status !== BusinessStatus.APPROVED) {
        throw new BadRequestException('Deals can only be created for an approved business');
      }
      return business.id;
    }

    return (await this.businessesService.requireOwnedApproved(user.id, businessId)).id;
  }

  private async requireOwnedOrAdmin(user: RequestUser, dealId: string) {
    const existing = await this.prisma.client.deal.findUnique({ where: { id: dealId } });
    if (!existing) throw new NotFoundException('Deal not found');

    if (!user.isAdmin) {
      const owns = await this.businessesService.isOwner(user.id, existing.businessId);
      if (!owns) throw new ForbiddenException('You do not own this deal');
    }
    return existing;
  }

  private async getUserAirportCodes(userId: string): Promise<string[]> {
    const journeys = await this.prisma.client.journey.findMany({
      where: { userId },
      include: { segments: { include: { flight: true } } },
    });

    const codes = new Set<string>();
    for (const journey of journeys) {
      for (const segment of journey.segments) {
        codes.add(segment.flight.departureAirportIata);
        codes.add(segment.flight.arrivalAirportIata);
      }
    }
    return [...codes];
  }
}
