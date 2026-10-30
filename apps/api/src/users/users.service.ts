import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  calculateAge,
  type CreateProfileRequest,
  type OwnProfile,
  type PublicProfile,
  type UpdateProfileRequest,
} from '@layo/contracts';
import { PrismaService } from '../common/prisma/prisma.service';

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
  async getPublicProfile(userId: string): Promise<PublicProfile> {
    const profile = await this.prisma.client.profile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Profile not found');
    return this.toPublicProfile(profile);
  }

  private async assertAirportExists(iataCode: string) {
    const airport = await this.prisma.client.airport.findUnique({ where: { iataCode } });
    if (!airport) throw new NotFoundException(`Unknown airport code: ${iataCode}`);
  }

  private toPublicProfile(profile: {
    userId: string;
    displayName: string;
    dateOfBirth: Date;
    bio: string;
    interests: string[];
    languages: string[];
    homeCityIata: string | null;
    photoUrl: string | null;
  }): PublicProfile {
    return {
      userId: profile.userId,
      displayName: profile.displayName,
      age: calculateAge(profile.dateOfBirth.toISOString().slice(0, 10)),
      bio: profile.bio,
      interests: profile.interests,
      languages: profile.languages,
      homeCityIata: profile.homeCityIata ?? undefined,
      photoUrl: profile.photoUrl ?? undefined,
    };
  }

  private toOwnProfile(profile: {
    userId: string;
    displayName: string;
    dateOfBirth: Date;
    bio: string;
    interests: string[];
    languages: string[];
    homeCityIata: string | null;
    photoUrl: string | null;
    discoverable: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): OwnProfile {
    return {
      ...this.toPublicProfile(profile),
      dateOfBirth: profile.dateOfBirth.toISOString().slice(0, 10),
      discoverable: profile.discoverable,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    };
  }
}
