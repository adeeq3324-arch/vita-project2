import { Global, Module } from '@nestjs/common';
import { CacheService } from './cache.service';

/**
 * Global cache module. Exposes {@link CacheService} everywhere so any feature
 * can cache reads — or invalidate another feature's cache by key — without a
 * module-level dependency between them. The underlying Redis client comes from
 * the global `RedisModule`.
 */
@Global()
@Module({
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}
