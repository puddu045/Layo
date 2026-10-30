import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async hasProfile(userId: string): Promise<boolean> {
    const profile = await this.prisma.client.profile.findUnique({ where: { userId } });
    return profile !== null;
  }
}
