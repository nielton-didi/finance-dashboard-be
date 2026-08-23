import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { APP_DB_CONNECTION } from '../../config/database.tokens';
import { OrganizationAccessService } from '../organizations/organization-access.service';
import { OrganizationsService } from '../organizations/organizations.service';
import type { Organization } from '../organizations/entities/organization.entity';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User, APP_DB_CONNECTION)
    private readonly usersRepository: Repository<User>,
    private readonly organizationAccessService: OrganizationAccessService,
    private readonly organizationsService: OrganizationsService,
  ) {}

  findAll(): Promise<User[]> {
    return this.usersRepository.find({ order: { fullName: 'ASC' } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async findOne(id: number): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User #${id} not found`);
    return user;
  }

  async create(dto: CreateUserDto): Promise<User> {
    const existing = await this.findByEmail(dto.email);
    if (existing) {
      throw new BadRequestException('A user with this email already exists');
    }
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = this.usersRepository.create({
      fullName: dto.fullName,
      email: dto.email,
      phone: dto.phone ?? null,
      passwordHash,
      role: dto.role,
    });
    return this.usersRepository.save(user);
  }

  async update(id: number, dto: UpdateUserDto): Promise<User> {
    await this.findOne(id);
    await this.usersRepository.update(id, dto);
    return this.findOne(id);
  }

  async updateProfile(id: number, dto: UpdateAccountDto): Promise<User> {
    await this.findOne(id);
    await this.usersRepository.update(id, dto);
    return this.findOne(id);
  }

  async updatePassword(id: number, dto: UpdatePasswordDto): Promise<void> {
    const user = await this.findOne(id);
    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid)
      throw new UnauthorizedException('Current password is incorrect');
    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.usersRepository.update(id, { passwordHash });
  }

  async grantOrganizationAccess(
    userId: number,
    organizationId: number,
  ): Promise<void> {
    await this.findOne(userId);
    await this.organizationAccessService.grant(userId, organizationId);
  }

  async revokeOrganizationAccess(
    userId: number,
    organizationId: number,
  ): Promise<void> {
    await this.findOne(userId);
    await this.organizationAccessService.revoke(userId, organizationId);
  }

  async findOrganizations(userId: number): Promise<Organization[]> {
    await this.findOne(userId);
    const orgIds =
      await this.organizationAccessService.listOrganizationIds(userId);
    return this.organizationsService.findByIds(orgIds);
  }

  async remove(id: number, currentUserId: number): Promise<void> {
    if (id === currentUserId) {
      throw new BadRequestException('You cannot delete your own account');
    }
    await this.findOne(id);
    await this.usersRepository.delete(id);
  }
}
