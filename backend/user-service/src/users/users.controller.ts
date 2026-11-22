import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../security/jwt-auth.guard';
import { Roles } from '../security/roles.decorator';
import { RolesGuard } from '../security/roles.guard';
import { CreateAddressDto, PageQueryDto, UpdateAddressDto, UpdateProfileDto } from './dto/user.dto';
import { AuthUser, UsersService } from './users.service';

type AuthedRequest = { user: AuthUser };

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  me(@Req() req: AuthedRequest) {
    return this.users.getOrCreateProfile(req.user);
  }

  @Patch('me')
  updateMe(@Req() req: AuthedRequest, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(req.user, dto);
  }

  @Get('me/addresses')
  listAddresses(@Req() req: AuthedRequest) {
    return this.users.listAddresses(req.user);
  }

  @Post('me/addresses')
  addAddress(@Req() req: AuthedRequest, @Body() dto: CreateAddressDto) {
    return this.users.addAddress(req.user, dto);
  }

  @Patch('me/addresses/:id')
  updateAddress(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.users.updateAddress(req.user, id, dto);
  }

  @Patch('me/addresses/:id/default')
  setDefault(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.users.setDefault(req.user, id);
  }

  @Delete('me/addresses/:id')
  deleteAddress(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.users.deleteAddress(req.user, id);
  }

  // Admin only: customer management
  @Get()
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  list(@Query() q: PageQueryDto) {
    return this.users.listProfiles(q.page, q.limit);
  }
}
