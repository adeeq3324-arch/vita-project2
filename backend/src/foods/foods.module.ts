import { Module } from '@nestjs/common';
import { FoodsController } from './foods.controller';
import { FoodsService } from './foods.service';

/**
 * Foods module — the shared nutrition catalogue that backs food search and
 * gives diary entries their nutrition values. Exports {@link FoodsService} so
 * the meal-log module can resolve a food when an entry is created.
 *
 * The catalogue itself is loaded by `foods.seeder.ts`, run as a release step
 * (`npm run db:seed`) rather than from inside a request.
 */
@Module({
  controllers: [FoodsController],
  providers: [FoodsService],
  exports: [FoodsService],
})
export class FoodsModule {}
