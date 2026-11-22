import {
  Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../security/jwt-auth.guard';
import { Roles } from '../security/roles.decorator';
import { RolesGuard } from '../security/roles.guard';
import { AdjustStockDto, PageDto, SetSlotDto, SetStockDto, SlotQueryDto } from './dto/inventory.dto';
import { InventoryService } from './inventory.service';

@Controller('inventory')
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  // Any logged-in user: the checkout page shows which slots are free
  @Get('slots')
  slots(@Query() q: SlotQueryDto) {
    return this.inventory.getSlots(q.date);
  }

  // ---------- Admin ----------
  @Put('slots')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  setSlot(@Body() dto: SetSlotDto) {
    return this.inventory.setSlotCapacity(dto.date, dto.slot, dto.capacity);
  }

  @Get('items')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  items(@Query() q: PageDto) {
    return this.inventory.listItems(q.page, q.limit);
  }

  @Put('items/:variantId')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  setStock(@Param('variantId', ParseUUIDPipe) variantId: string, @Body() dto: SetStockDto) {
    return this.inventory.setStock(variantId, dto.onHand);
  }

  @Post('items/:variantId/adjustments')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  adjust(@Param('variantId', ParseUUIDPipe) variantId: string, @Body() dto: AdjustStockDto) {
    return this.inventory.adjust(variantId, dto.delta, dto.reason);
  }

  @Get('items/:variantId/history')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  history(@Param('variantId', ParseUUIDPipe) variantId: string) {
    return this.inventory.history(variantId);
  }
}
