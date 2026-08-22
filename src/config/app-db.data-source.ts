// TypeORM CLI DataSource — used ONLY by the migration CLI (migration:generate, migration:run, etc.).
// This file is NOT imported by the NestJS application; app bootstrap uses app.module.ts instead.
import 'dotenv/config';
import { DataSource } from 'typeorm';

export const AppDataSource = new DataSource({
  type: 'mssql',
  host: process.env.APP_DB_HOST || 'localhost',
  port: parseInt(process.env.APP_DB_PORT || '1433', 10),
  username: process.env.APP_DB_USERNAME || '',
  password: process.env.APP_DB_PASSWORD || '',
  database: process.env.APP_DB_NAME || 'finance-dashboard-db',
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
  entities: [`${__dirname}/../modules/**/*.entity{.ts,.js}`],
  migrations: [`${__dirname}/../migrations/*{.ts,.js}`],
  synchronize: false,
  logging: ['migration'],
});
