import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { loadApiEnv } from '@layo/config';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  readonly client: Redis;

  constructor() {
    const env = loadApiEnv();
    this.client = new Redis(env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null, // never block the API waiting on Redis
    });
    this.client.on('error', (err) => this.logger.warn(`Redis error: ${err.message}`));
    this.client.connect().catch((err) => this.logger.warn(`Redis unavailable: ${err.message}`));
  }

  /** Best-effort cache read. Returns null on any Redis failure instead of throwing. */
  async getJson<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.client.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  /** Best-effort cache write. Never throws — a cache outage must not break a request. */
  async setJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch {
      // caching is an optimisation, not a correctness requirement
    }
  }

  async onModuleDestroy() {
    this.client.disconnect();
  }
}
