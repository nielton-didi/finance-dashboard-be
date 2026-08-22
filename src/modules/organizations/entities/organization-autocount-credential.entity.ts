import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Each organization's Autocount database is separate and never shared. The password
 * is stored encrypted (see EncryptionService) and must never be returned by any read endpoint.
 */
@Entity('organization_autocount_credentials')
export class OrganizationAutocountCredential {
  @PrimaryColumn({ name: 'organization_id', type: 'int' })
  organizationId: number;

  @Column({ type: 'nvarchar', length: 255 })
  host: string;

  @Column({ type: 'int' })
  port: number;

  @Column({ name: 'database_name', type: 'nvarchar', length: 255 })
  databaseName: string;

  @Column({ type: 'nvarchar', length: 255 })
  username: string;

  @Column({ name: 'password_encrypted', type: 'nvarchar', length: 'max' })
  passwordEncrypted: string;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt: Date;
}
