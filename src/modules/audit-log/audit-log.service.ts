import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';
import { APP_DB_CONNECTION } from '../../config/database.tokens';

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog, APP_DB_CONNECTION)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  findAllForOrganization(organizationId: number): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });
  }

  record(dto: CreateAuditLogDto): Promise<AuditLog> {
    const entry = this.auditLogRepository.create({
      organizationId: dto.organizationId ?? null,
      userId: dto.userId ?? null,
      action: dto.action,
      details: dto.details ? JSON.stringify(dto.details) : null,
    });
    return this.auditLogRepository.save(entry);
  }
}
