import {
  Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../security/jwt-auth.guard';
import { Roles } from '../security/roles.decorator';
import { RolesGuard } from '../security/roles.guard';
import { CakesService } from './cakes.service';
import { CategoriesService } from './categories.service';
import {
  CakeQueryDto, CreateCakeDto, UpdateCakeDto, UpdateVariantDto, VariantDto,
} from './dto/cake.dto';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

@Controller()
export class CatalogController {
  constructor(
    private readonly cakes: CakesService,
    private readonly categories: CategoriesService,
  ) {}

  // ---------- Public ----------
  @Get('categories')
  listCategories() {
    return this.categories.listActive();
  }

  @Get('cakes')
  listCakes(@Query() query: CakeQueryDto) {
    return this.cakes.listPublic(query);
  }

  @Get('variants/:id')
  getVariant(@Param('id', ParseUUIDPipe) id: string) {
    return this.cakes.getVariant(id);
  }

  // ---------- Admin (declared before cakes/:id so "admin" is not read as an id) ----------
  @Get('cakes/admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  listAdmin(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.cakes.listAdmin(Number(page) || 1, Math.min(Number(limit) || 20, 100));
  }

  @Get('categories/admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  listAllCategories() {
    return this.categories.listAll();
  }

  @Post('categories')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.categories.create(dto);
  }

  @Patch('categories/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  updateCategory(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCategoryDto) {
    return this.categories.update(id, dto);
  }

  @Post('cakes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  createCake(@Body() dto: CreateCakeDto) {
    return this.cakes.create(dto);
  }

  @Patch('cakes/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  updateCake(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCakeDto) {
    return this.cakes.update(id, dto);
  }

  @Patch('cakes/:id/deactivate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.cakes.deactivate(id);
  }

  @Post('cakes/:id/variants')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  addVariant(@Param('id', ParseUUIDPipe) id: string, @Body() dto: VariantDto) {
    return this.cakes.addVariant(id, dto);
  }

  @Patch('variants/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  updateVariant(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateVariantDto) {
    return this.cakes.updateVariant(id, dto);
  }

  // ---------- Public single cake (last, so fixed paths above win) ----------
  @Get('cakes/:id')
  getCake(@Param('id', ParseUUIDPipe) id: string) {
    return this.cakes.getPublic(id);
  }
}
