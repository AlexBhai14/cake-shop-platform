import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { isUniqueViolation, slugify } from './slug.util';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  listActive() {
    return this.prisma.category.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
  }

  listAll() {
    return this.prisma.category.findMany({ orderBy: { name: 'asc' } });
  }

  async create(dto: CreateCategoryDto) {
    try {
      return await this.prisma.category.create({
        data: { name: dto.name, slug: slugify(dto.name), description: dto.description },
      });
    } catch (e) {
      if (isUniqueViolation(e)) throw new ConflictException('Category already exists');
      throw e;
    }
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Category not found');
    try {
      return await this.prisma.category.update({
        where: { id },
        data: { ...dto, ...(dto.name ? { slug: slugify(dto.name) } : {}) },
      });
    } catch (e) {
      if (isUniqueViolation(e)) throw new ConflictException('Category already exists');
      throw e;
    }
  }
}
