import { BadRequestException, PipeTransform } from '@nestjs/common';
import type { ZodTypeAny } from 'zod';

/**
 * Validates and transforms request bodies/queries/params against a Zod schema.
 * Usage: `@Body(new ZodValidationPipe(createProfileRequestSchema)) dto: CreateProfileRequest`.
 */
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodTypeAny) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        issues: result.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      });
    }
    return result.data;
  }
}
