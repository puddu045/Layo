import { Injectable } from '@nestjs/common';
import { BusinessStatus, ConnectionStatus, DealStatus, ReportStatus } from '@layo/db';
import type { Analytics, Overview, TimeSeriesPoint } from '@layo/contracts';
import { PrismaService } from '../common/prisma/prisma.service';

const DAYS = 30;

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(): Promise<Overview> {
    const since30d = daysAgo(DAYS);

    const [
      totalUsers,
      newUsersLast30Days,
      activeJourneys,
      totalConnections,
      acceptedConnections,
      pendingReports,
      criticalReports,
      pendingBusinesses,
      pendingDeals,
      openSupportTickets,
      topAirportsRaw,
      recentAuditRows,
    ] = await Promise.all([
      this.prisma.client.user.count({ where: { status: 'ACTIVE' } }),
      this.prisma.client.user.count({ where: { createdAt: { gte: since30d } } }),
      this.prisma.client.journey.count({ where: { isDiscoverable: true } }),
      this.prisma.client.connection.count(),
      this.prisma.client.connection.count({ where: { status: ConnectionStatus.ACCEPTED } }),
      this.prisma.client.report.count({ where: { status: ReportStatus.OPEN } }),
      this.prisma.client.report.count({ where: { status: ReportStatus.OPEN, priority: 'CRITICAL' } }),
      this.prisma.client.business.count({ where: { status: BusinessStatus.PENDING } }),
      this.prisma.client.deal.count({ where: { status: DealStatus.PENDING } }),
      this.prisma.client.supportTicket.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
      this.prisma.client.airportRoomMembership.groupBy({
        by: ['airportIata'],
        _count: { _all: true },
        orderBy: { _count: { airportIata: 'desc' } },
        take: 5,
      }),
      this.prisma.client.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 15 }),
    ]);

    const actorIds = [...new Set(recentAuditRows.map((r) => r.actorAdminId).filter((id): id is string => !!id))];
    const actors = actorIds.length
      ? await this.prisma.client.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, email: true } })
      : [];
    const emailByActorId = new Map(actors.map((a) => [a.id, a.email]));

    return {
      totalUsers,
      newUsersLast30Days,
      activeJourneys,
      totalConnections,
      acceptedConnections,
      pendingReports,
      criticalReports,
      pendingBusinesses,
      pendingDeals,
      openSupportTickets,
      topAirports: topAirportsRaw.map((r) => ({ airportIata: r.airportIata, activity: r._count._all })),
      recentActivity: recentAuditRows.map((row) => ({
        id: row.id,
        actorAdminId: row.actorAdminId ?? undefined,
        actorEmail: row.actorAdminId ? emailByActorId.get(row.actorAdminId) : undefined,
        action: row.action,
        targetType: row.targetType,
        targetId: row.targetId,
        metadata: (row.metadata as Record<string, unknown>) ?? undefined,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }

  async analytics(): Promise<Analytics> {
    const since30d = daysAgo(DAYS);

    const [users, journeys, messages, roomMessages, connections, dealsByStatus, popularAirportsRaw, activeUsersLastWeek] =
      await Promise.all([
        this.prisma.client.user.findMany({ where: { createdAt: { gte: since30d } }, select: { createdAt: true } }),
        this.prisma.client.journey.findMany({ where: { createdAt: { gte: since30d } }, select: { createdAt: true } }),
        this.prisma.client.message.findMany({ where: { createdAt: { gte: since30d } }, select: { createdAt: true } }),
        this.prisma.client.airportRoomMessage.findMany({ where: { createdAt: { gte: since30d } }, select: { createdAt: true } }),
        this.prisma.client.connection.findMany({ select: { status: true } }),
        this.prisma.client.deal.groupBy({ by: ['status'], _count: { _all: true } }),
        this.prisma.client.airportRoomMembership.groupBy({
          by: ['airportIata'],
          _count: { _all: true },
          orderBy: { _count: { airportIata: 'desc' } },
          take: 10,
        }),
        this.distinctActiveUserCount(daysAgo(14), daysAgo(7)),
      ]);

    const chatTimestamps = [...messages, ...roomMessages].map((m) => m.createdAt);
    const acceptedConnections = connections.filter((c) => c.status === ConnectionStatus.ACCEPTED).length;

    // Rough week-over-week retention: of the users active in the prior 7-day window, what
    // share were seen again in the most recent 7 days. Not a cohort-based definition — a
    // simple, honestly-labelled proxy given there's no session/activity table to build one
    // from more precisely.
    const retainedFromLastWeek = await this.retainedCount(daysAgo(14), daysAgo(7), daysAgo(7), new Date());
    const retentionRate = activeUsersLastWeek > 0 ? retainedFromLastWeek / activeUsersLastWeek : 0;

    return {
      userGrowth: toDailySeries(users.map((u) => u.createdAt), DAYS),
      journeyTrends: toDailySeries(journeys.map((j) => j.createdAt), DAYS),
      chatActivity: toDailySeries(chatTimestamps, DAYS),
      retentionRate,
      popularAirports: popularAirportsRaw.map((r) => ({ airportIata: r.airportIata, count: r._count._all })),
      matchingSuccessRate: connections.length > 0 ? acceptedConnections / connections.length : 0,
      dealPerformance: dealsByStatus.map((r) => ({ status: r.status, count: r._count._all })),
    };
  }

  private async distinctActiveUserCount(from: Date, to: Date): Promise<number> {
    const [senders, roomSenders] = await Promise.all([
      this.prisma.client.message.findMany({ where: { createdAt: { gte: from, lt: to } }, select: { senderId: true }, distinct: ['senderId'] }),
      this.prisma.client.airportRoomMessage.findMany({ where: { createdAt: { gte: from, lt: to } }, select: { senderId: true }, distinct: ['senderId'] }),
    ]);
    return new Set([...senders.map((s) => s.senderId), ...roomSenders.map((s) => s.senderId)]).size;
  }

  private async retainedCount(priorFrom: Date, priorTo: Date, recentFrom: Date, recentTo: Date): Promise<number> {
    const [priorSenders, priorRoomSenders, recentSenders, recentRoomSenders] = await Promise.all([
      this.prisma.client.message.findMany({ where: { createdAt: { gte: priorFrom, lt: priorTo } }, select: { senderId: true } }),
      this.prisma.client.airportRoomMessage.findMany({ where: { createdAt: { gte: priorFrom, lt: priorTo } }, select: { senderId: true } }),
      this.prisma.client.message.findMany({ where: { createdAt: { gte: recentFrom, lt: recentTo } }, select: { senderId: true } }),
      this.prisma.client.airportRoomMessage.findMany({ where: { createdAt: { gte: recentFrom, lt: recentTo } }, select: { senderId: true } }),
    ]);
    const prior = new Set([...priorSenders, ...priorRoomSenders].map((s) => s.senderId));
    const recent = new Set([...recentSenders, ...recentRoomSenders].map((s) => s.senderId));
    return [...prior].filter((id) => recent.has(id)).length;
  }
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

function toDailySeries(timestamps: Date[], days: number): TimeSeriesPoint[] {
  const counts = new Map<string, number>();
  for (const ts of timestamps) {
    const key = ts.toISOString().slice(0, 10);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const points: TimeSeriesPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = daysAgo(i).toISOString().slice(0, 10);
    points.push({ date, value: counts.get(date) ?? 0 });
  }
  return points;
}
