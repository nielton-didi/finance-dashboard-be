import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from './entities/organization.entity';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { APP_DB_CONNECTION } from '../../config/database.tokens';
import { OrganizationAccessService } from './organization-access.service';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { Role } from '../../common/auth/role';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(Organization, APP_DB_CONNECTION)
    private readonly organizationsRepository: Repository<Organization>,
    private readonly organizationAccessService: OrganizationAccessService,
  ) {}

  async findAllForUser(user: JwtPayload): Promise<Organization[]> {
    if (user.role === Role.Admin) {
      return this.organizationsRepository.find({ order: { name: 'ASC' } });
    }
    const orgIds = await this.organizationAccessService.listOrganizationIds(
      user.sub,
    );
    if (orgIds.length === 0) return [];
    return this.organizationsRepository.find({
      where: orgIds.map((id) => ({ id })),
      order: { name: 'ASC' },
    });
  }

  async findByIds(ids: number[]): Promise<Organization[]> {
    if (ids.length === 0) return [];
    return this.organizationsRepository.find({
      where: ids.map((id) => ({ id })),
      order: { name: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Organization> {
    const organization = await this.organizationsRepository.findOne({
      where: { id },
    });
    if (!organization)
      throw new NotFoundException(`Organization #${id} not found`);
    return organization;
  }

  create(dto: CreateOrganizationDto): Promise<Organization> {
    const organization = this.organizationsRepository.create({
      name: dto.name,
      registrationNumber: dto.registrationNumber ?? null,
      plan: dto.plan ?? null,
    });
    return this.organizationsRepository.save(organization);
  }

  async update(id: number, dto: UpdateOrganizationDto): Promise<Organization> {
    await this.findOne(id);
    await this.organizationsRepository.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.organizationsRepository.delete(id);
  }
}
