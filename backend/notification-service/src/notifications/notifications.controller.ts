import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { JwtAuthGuard } from '../security/jwt-auth.guard';
import { Roles } from '../security/roles.decorator';
import { RolesGuard } from '../security/roles.guard';
import { PrismaService } from '../prisma/prisma.service';

class ListQuery {
  @IsOptional() @IsIn(['PENDING', 'SENT', 'FAILED']) status?: 'PENDING' | 'SENT' | 'FAILED';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}

const FIELDS = { id: true, orderId: true, type: true, subject: true, status: true, createdAt: true, sentAt: true };

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}

  // A customer sees only their own notifications
  @Get()
  mine(@Req() req: { user: { userId: string } }, @Query() q: ListQuery) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    return this.prisma.notification.findMany({
      where: { userId: req.user.userId },
      select: FIELDS,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  @Get('admin/all')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async all(@Query() q: ListQuery) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const where = q.status ? { status: q.status } : {};
    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({ where, select: { ...FIELDS, toEmail: true, attempts: true, lastError: true }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      this.prisma.notification.count({ where }),
    ]);
    return { items, total, page, limit };
  }
}
