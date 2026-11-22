import { Module } from '@nestjs/common';
import { CakesService } from './cakes.service';
import { CatalogController } from './catalog.controller';
import { CategoriesService } from './categories.service';

@Module({
  controllers: [CatalogController],
  providers: [CakesService, CategoriesService],
})
export class CatalogModule {}
