import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationAutocountCredential } from './entities/organization-autocount-credential.entity';
import { UpsertAutocountCredentialDto } from './dto/upsert-autocount-credential.dto';
import { APP_DB_CONNECTION } from '../../config/database.tokens';
import { EncryptionService } from '../../common/crypto/encryption.service';

export interface DecryptedAutocountCredential {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

export interface MaskedAutocountCredential {
  host: string;
  port: number;
  databaseName: string;
  username: string;
  hasPassword: true;
}

@Injectable()
export class OrganizationAutocountCredentialsService {
  constructor(
    @InjectRepository(OrganizationAutocountCredential, APP_DB_CONNECTION)
    private readonly credentialsRepository: Repository<OrganizationAutocountCredential>,
    private readonly encryptionService: EncryptionService,
  ) {}

  async getMasked(organizationId: number): Promise<MaskedAutocountCredential> {
    const row = await this.findOrThrow(organizationId);
    return {
      host: row.host,
      port: row.port,
      databaseName: row.databaseName,
      username: row.username,
      hasPassword: true,
    };
  }

  /** Returns null when the org has no Autocount connection configured yet. */
  async getDecrypted(
    organizationId: number,
  ): Promise<DecryptedAutocountCredential | null> {
    const row = await this.credentialsRepository.findOne({
      where: { organizationId },
    });
    if (!row) return null;
    return {
      host: row.host,
      port: row.port,
      database: row.databaseName,
      username: row.username,
      password: this.encryptionService.decrypt(row.passwordEncrypted),
    };
  }

  async upsert(
    organizationId: number,
    dto: UpsertAutocountCredentialDto,
  ): Promise<MaskedAutocountCredential> {
    const passwordEncrypted = this.encryptionService.encrypt(dto.password);
    const existing = await this.credentialsRepository.findOne({
      where: { organizationId },
    });

    if (existing) {
      await this.credentialsRepository.update(
        { organizationId },
        {
          host: dto.host,
          port: dto.port,
          databaseName: dto.databaseName,
          username: dto.username,
          passwordEncrypted,
        },
      );
    } else {
      await this.credentialsRepository.save(
        this.credentialsRepository.create({
          organizationId,
          host: dto.host,
          port: dto.port,
          databaseName: dto.databaseName,
          username: dto.username,
          passwordEncrypted,
        }),
      );
    }

    return this.getMasked(organizationId);
  }

  private async findOrThrow(
    organizationId: number,
  ): Promise<OrganizationAutocountCredential> {
    const row = await this.credentialsRepository.findOne({
      where: { organizationId },
    });
    if (!row) {
      throw new NotFoundException(
        `No Autocount database configured for organization #${organizationId}`,
      );
    }
    return row;
  }
}
