import { loadApiEnv } from '@layo/config';
import { PrismaService } from '../common/prisma/prisma.service';
import { computePresenceWindows, type PresenceSegmentInput } from '../matching/presence.util';
import { computeRoomAccessWindows, type RoomAccessWindow } from './room-access.util';

/**
 * Every airport-room access window implied by a user's discoverable journeys,
 * right now. Shared by `AirportRoomsService` (REST reads/writes) and
 * `RealtimeGateway` (socket room join) so there is exactly one place that
 * decides "is this user allowed into this airport's room" — a plain function
 * rather than an injectable service, specifically so both call sites can use
 * it without a circular module dependency between messaging and rooms.
 */
export async function computeUserRoomAccessWindows(
  prisma: PrismaService,
  userId: string,
): Promise<RoomAccessWindow[]> {
  const env = loadApiEnv();

  const journeys = await prisma.client.journey.findMany({
    where: { userId, isDiscoverable: true },
    include: { segments: { include: { flight: true }, orderBy: { sequence: 'asc' } } },
  });

  const windows: RoomAccessWindow[] = [];
  for (const journey of journeys) {
    const segments: PresenceSegmentInput[] = journey.segments.map((s) => ({
      sequence: s.sequence,
      flightId: s.flightId,
      flightNumber: s.flight.flightNumber,
      departureAirportIata: s.flight.departureAirportIata,
      arrivalAirportIata: s.flight.arrivalAirportIata,
      scheduledDepartureUtc: s.flight.scheduledDepartureUtc,
      scheduledArrivalUtc: s.flight.scheduledArrivalUtc,
    }));

    const presenceWindows = computePresenceWindows(segments, {
      departureAirportWindowMinutesBefore: env.DISCOVERY_DEPARTURE_WINDOW_MINUTES_BEFORE,
      departureAirportWindowMinutesAfter: env.DISCOVERY_DEPARTURE_WINDOW_MINUTES_AFTER,
    });

    windows.push(
      ...computeRoomAccessWindows(presenceWindows, {
        accessWindowHoursBefore: env.AIRPORT_ROOM_ACCESS_WINDOW_HOURS_BEFORE,
        accessWindowHoursAfter: env.AIRPORT_ROOM_ACCESS_WINDOW_HOURS_AFTER,
      }),
    );
  }

  return windows;
}
