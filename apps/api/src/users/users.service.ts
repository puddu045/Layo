import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { CreateProfileRequest, OwnProfile, UpdateProfileRequest } from '@layo/contracts';
import { PrismaService } from '../common/prisma/prisma.service';
import { toPublicProfile, type ProfileRow } from '../common/mappers/profile.mapper';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async createProfile(userId: string, dto: CreateProfileRequest): Promise<OwnProfile> {
    const existing = await this.prisma.client.profile.findUnique({ where: { userId } });
    if (existing) {
      throw new ConflictException('Profile already exists for this account');
    }

    if (dto.homeCityIata) {
      await this.assertAirportExists(dto.homeCityIata);
    }

    const profile = await this.prisma.client.profile.create({
      data: {
        userId,
        displayName: dto.displayName,
        dateOfBirth: new Date(`${dto.dateOfBirth}T00:00:00Z`),
        bio: dto.bio,
        interests: dto.interests,
        languages: dto.languages,
        homeCityIata: dto.homeCityIata,
        discoverable: dto.discoverable,
        photoUrl: dto.photoUrl,
      },
    });

    return this.toOwnProfile(profile);
  }

  async updateProfile(userId: string, dto: UpdateProfileRequest): Promise<OwnProfile> {
    const existing = await this.prisma.client.profile.findUnique({ where: { userId } });
    if (!existing) {
      throw new NotFoundException('Profile not found — complete profile setup first');
    }

    if (dto.homeCityIata) {
      await this.assertAirportExists(dto.homeCityIata);
    }

    const profile = await this.prisma.client.profile.update({
      where: { userId },
      data: {
        ...(dto.displayName !== undefined && { displayName: dto.displayName }),
        ...(dto.dateOfBirth !== undefined && { dateOfBirth: new Date(`${dto.dateOfBirth}T00:00:00Z`) }),
        ...(dto.bio !== undefined && { bio: dto.bio }),
        ...(dto.interests !== undefined && { interests: dto.interests }),
        ...(dto.languages !== undefined && { languages: dto.languages }),
        ...(dto.homeCityIata !== undefined && { homeCityIata: dto.homeCityIata }),
        ...(dto.discoverable !== undefined && { discoverable: dto.discoverable }),
        ...(dto.photoUrl !== undefined && { photoUrl: dto.photoUrl }),
      },
    });

    return this.toOwnProfile(profile);
  }

  async getOwnProfile(userId: string): Promise<OwnProfile> {
    const profile = await this.prisma.client.profile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Profile not found — complete profile setup first');
    return this.toOwnProfile(profile);
  }

  /** Public-facing view: never includes date of birth or any contact detail. */
  async getPublicProfile(userId: string): Promise<ReturnType<typeof toPublicProfile>> {
    const profile = await this.prisma.client.profile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Profile not found');
    return toPublicProfile(profile);
  }

  /** Soft-deletes the account: flips `status` away from `ACTIVE` so `SupabaseAuthGuard` rejects
   * the caller's next request, and every existing `status: 'ACTIVE'` filter (matching, discover)
   * already stops surfacing them. Rows are kept, not erased — consistent with every other delete
   * in this codebase (journeys, connections) being a real decision, not a default to revisit. */
  async deleteOwnAccount(userId: string): Promise<{ success: true }> {
    await this.prisma.client.user.update({
      where: { id: userId },
      data: { status: 'DELETED', deletedAt: new Date() },
    });
    return { success: true };
  }

  private async assertAirportExists(iataCode: string) {
    const airport = await this.prisma.client.airport.findUnique({ where: { iataCode } });
    if (!airport) throw new NotFoundException(`Unknown airport code: ${iataCode}`);
  }

  private toOwnProfile(
    profile: ProfileRow & { discoverable: boolean; createdAt: Date; updatedAt: Date },
  ): OwnProfile {
    return {
      ...toPublicProfile(profile),
      dateOfBirth: profile.dateOfBirth.toISOString().slice(0, 10),
      discoverable: profile.discoverable,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    };
  }
}
