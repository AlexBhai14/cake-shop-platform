import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAddressDto, UpdateAddressDto, UpdateProfileDto } from './dto/user.dto';

export interface AuthUser {
  userId: string;
  email: string;
  role: string;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // The profile is created lazily the first time a logged-in customer asks for it.
  getOrCreateProfile(user: AuthUser) {
    return this.prisma.profile.upsert({
      where: { userId: user.userId },
      update: {},
      create: { userId: user.userId, email: user.email, fullName: user.email.split('@')[0] },
      include: { addresses: { orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] } },
    });
  }

  async updateProfile(user: AuthUser, dto: UpdateProfileDto) {
    await this.getOrCreateProfile(user);
    return this.prisma.profile.update({ where: { userId: user.userId }, data: dto });
  }

  async listAddresses(user: AuthUser) {
    const profile = await this.getOrCreateProfile(user);
    return this.prisma.address.findMany({
      where: { profileId: profile.id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async addAddress(user: AuthUser, dto: CreateAddressDto) {
    const profile = await this.getOrCreateProfile(user);
    const count = await this.prisma.address.count({ where: { profileId: profile.id } });
    // The first address is always the default.
    const makeDefault = dto.isDefault === true || count === 0;
    return this.prisma.$transaction(async (tx) => {
      if (makeDefault) {
        await tx.address.updateMany({
          where: { profileId: profile.id, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.address.create({ data: { ...dto, isDefault: makeDefault, profileId: profile.id } });
    });
  }

  async updateAddress(user: AuthUser, id: string, dto: UpdateAddressDto) {
    await this.ownedAddress(user, id);
    return this.prisma.address.update({ where: { id }, data: dto });
  }

  async setDefault(user: AuthUser, id: string) {
    const address = await this.ownedAddress(user, id);
    return this.prisma.$transaction(async (tx) => {
      await tx.address.updateMany({
        where: { profileId: address.profileId, isDefault: true },
        data: { isDefault: false },
      });
      return tx.address.update({ where: { id }, data: { isDefault: true } });
    });
  }

  async deleteAddress(user: AuthUser, id: string) {
    const address = await this.ownedAddress(user, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.address.delete({ where: { id } });
      if (address.isDefault) {
        // Promote the oldest remaining address so the customer always has a default.
        const next = await tx.address.findFirst({
          where: { profileId: address.profileId },
          orderBy: { createdAt: 'asc' },
        });
        if (next) await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
      }
    });
    return { message: 'Address deleted' };
  }

  // Admin: customer list
  async listProfiles(page = 1, limit = 20) {
    const [items, total] = await Promise.all([
      this.prisma.profile.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.profile.count(),
    ]);
    return { items, total, page, limit };
  }

  // Ownership check: an address of another customer looks like "not found".
  private async ownedAddress(user: AuthUser, id: string) {
    const profile = await this.getOrCreateProfile(user);
    const address = await this.prisma.address.findFirst({ where: { id, profileId: profile.id } });
    if (!address) throw new NotFoundException('Address not found');
    return address;
  }
}
