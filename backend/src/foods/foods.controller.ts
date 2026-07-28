import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { SearchFoodsDto } from './dto/search-foods.dto';
import type { FoodSearchView, FoodView } from './food.view';
import { FoodsService } from './foods.service';

/**
 * Food catalogue endpoints, mounted at `/api/v1/foods`.
 *
 * The catalogue is shared reference data rather than user data, but the routes
 * still sit behind the global auth guard: only signed-in users of the app get
 * to read it.
 */
@Controller({ path: 'foods', version: '1' })
export class FoodsController {
  constructor(private readonly foods: FoodsService) {}

  /** Backs the "Add Meal" search bar. */
  @Get('search')
  search(@Query() dto: SearchFoodsDto): Promise<FoodSearchView> {
    return this.foods.search(dto);
  }

  @Get(':id')
  getById(@Param('id', ParseUUIDPipe) id: string): Promise<FoodView> {
    return this.foods.getById(id);
  }
}
