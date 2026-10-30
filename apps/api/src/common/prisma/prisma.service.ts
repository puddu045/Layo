import { Injectable } from '@nestjs/common';
import { prisma } from '@layo/db';

/**
 * Thin DI wrapper around the shared `@layo/db` Prisma singleton. Injecting this
 * (rather than importing `prisma` directly everywhere) keeps services testable —
 * tests can provide a mock `PrismaService`.
 */
@Injectable()
export class PrismaService {
  readonly client = prisma;
}
