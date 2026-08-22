import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1787415441000 implements MigrationInterface {
  public name = 'InitialSchema1787415441000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[users]') AND type = N'U')
      BEGIN
        CREATE TABLE [dbo].[users] (
          [id]            INT           IDENTITY(1,1) NOT NULL PRIMARY KEY,
          [full_name]     NVARCHAR(255) NOT NULL,
          [email]         NVARCHAR(255) NOT NULL UNIQUE,
          [phone]         NVARCHAR(50)  NULL,
          [password_hash] NVARCHAR(255) NOT NULL,
          [role]          NVARCHAR(20)  NOT NULL DEFAULT 'staff',
          [status]        NVARCHAR(20)  NOT NULL DEFAULT 'active',
          [created_at]    DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
          [updated_at]    DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
        )
      END
    `);

    await queryRunner.query(`
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[organizations]') AND type = N'U')
      BEGIN
        CREATE TABLE [dbo].[organizations] (
          [id]                   INT           IDENTITY(1,1) NOT NULL PRIMARY KEY,
          [name]                 NVARCHAR(255) NOT NULL,
          [registration_number]  NVARCHAR(100) NULL,
          [plan]                 NVARCHAR(100) NULL,
          [created_at]           DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
          [updated_at]           DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
        )
      END
    `);

    // No role column here — role is a single global attribute on the user (see [dbo].[users].[role]).
    // This table only records which organizations a `staff` user has been explicitly granted;
    // `admin` users bypass it entirely at the application layer.
    await queryRunner.query(`
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[organization_access]') AND type = N'U')
      BEGIN
        CREATE TABLE [dbo].[organization_access] (
          [user_id]         INT       NOT NULL,
          [organization_id] INT       NOT NULL,
          [created_at]      DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
          CONSTRAINT PK_organization_access PRIMARY KEY ([user_id], [organization_id]),
          CONSTRAINT FK_organization_access_users FOREIGN KEY ([user_id])
            REFERENCES [dbo].[users]([id]) ON DELETE CASCADE,
          CONSTRAINT FK_organization_access_organizations FOREIGN KEY ([organization_id])
            REFERENCES [dbo].[organizations]([id]) ON DELETE CASCADE
        )
      END
    `);

    // Each organization's Autocount database is separate and never shared; password_encrypted
    // holds an AES-256-GCM ciphertext (see EncryptionService), never a plaintext password.
    await queryRunner.query(`
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[organization_autocount_credentials]') AND type = N'U')
      BEGIN
        CREATE TABLE [dbo].[organization_autocount_credentials] (
          [organization_id]     INT           NOT NULL PRIMARY KEY,
          [host]                NVARCHAR(255) NOT NULL,
          [port]                INT           NOT NULL,
          [database_name]       NVARCHAR(255) NOT NULL,
          [username]            NVARCHAR(255) NOT NULL,
          [password_encrypted]  NVARCHAR(MAX) NOT NULL,
          [created_at]          DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
          [updated_at]          DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
          CONSTRAINT FK_autocount_credentials_organizations FOREIGN KEY ([organization_id])
            REFERENCES [dbo].[organizations]([id]) ON DELETE CASCADE
        )
      END
    `);

    await queryRunner.query(`
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[audit_log]') AND type = N'U')
      BEGIN
        CREATE TABLE [dbo].[audit_log] (
          [id]              BIGINT        IDENTITY(1,1) NOT NULL PRIMARY KEY,
          [organization_id] INT           NULL,
          [user_id]         INT           NULL,
          [action]          NVARCHAR(255) NOT NULL,
          [details]         NVARCHAR(MAX) NULL,
          [created_at]      DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
          CONSTRAINT FK_audit_log_organizations FOREIGN KEY ([organization_id])
            REFERENCES [dbo].[organizations]([id]) ON DELETE SET NULL,
          CONSTRAINT FK_audit_log_users FOREIGN KEY ([user_id])
            REFERENCES [dbo].[users]([id]) ON DELETE SET NULL
        )
      END
    `);

    await queryRunner.query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_audit_log_organization_id')
        CREATE INDEX IX_audit_log_organization_id ON [dbo].[audit_log]([organization_id])
    `);

    await queryRunner.query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_audit_log_created_at')
        CREATE INDEX IX_audit_log_created_at ON [dbo].[audit_log]([created_at] DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS [IX_audit_log_created_at] ON [dbo].[audit_log]`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS [IX_audit_log_organization_id] ON [dbo].[audit_log]`,
    );

    await queryRunner.query(`
      IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[audit_log]') AND type = N'U')
        DROP TABLE [dbo].[audit_log]
    `);
    await queryRunner.query(`
      IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[organization_autocount_credentials]') AND type = N'U')
        DROP TABLE [dbo].[organization_autocount_credentials]
    `);
    await queryRunner.query(`
      IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[organization_access]') AND type = N'U')
        DROP TABLE [dbo].[organization_access]
    `);
    await queryRunner.query(`
      IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[organizations]') AND type = N'U')
        DROP TABLE [dbo].[organizations]
    `);
    await queryRunner.query(`
      IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[users]') AND type = N'U')
        DROP TABLE [dbo].[users]
    `);
  }
}
