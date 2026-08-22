import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationAccess } from './entities/organization-access.entity';
import { APP_DB_CONNECTION } from '../../config/database.tokens';

@Injectable()
export class OrganizationAccessService {
  constructor(
    @InjectRepository(OrganizationAccess, APP_DB_CONNECTION)
    private readonly accessRepository: Repository<OrganizationAccess>,
  ) {}

  async hasAccess(userId: number, organizationId: number): Promise<boolean> {
    const row = await this.accessRepository.findOne({
      where: { userId, organizationId },
    });
    return row !== null;
  }

  async listOrganizationIds(userId: number): Promise<number[]> {
    const rows = await this.accessRepository.find({ where: { userId } });
    return rows.map((row) => row.organizationId);
  }

  async grant(userId: number, organizationId: number): Promise<void> {
    const existing = await this.hasAccess(userId, organizationId);
    if (existing) return;
    const access = this.accessRepository.create({ userId, organizationId });
    await this.accessRepository.save(access);
  }

  async revoke(userId: number, organizationId: number): Promise<void> {
    await this.accessRepository.delete({ userId, organizationId });
  }
}
