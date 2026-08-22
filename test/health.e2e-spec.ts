import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { APP_DB_CONNECTION } from '../src/config/database.tokens';

// Requires a reachable finance-dashboard-db (see .env) — this exercises the real
// TypeOrmModule connection, not a mock, so run migrations first (`npm run migration:run`).
describe('Health (e2e)', () => {
  let app: INestApplication;
  let moduleFixture: TestingModule;

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    // @nestjs/typeorm's own shutdown hook for named DataSource connections (like
    // APP_DB_CONNECTION) throws "Nest could not find DataSource element" when
    // resolving the connection to close it in this testing-module context — a known
    // upstream quirk. Destroying the DataSource ourselves first avoids both the
    // benign error AND the dangling open socket that otherwise keeps Jest alive.
    const dataSource = moduleFixture.get<DataSource>(
      getDataSourceToken(APP_DB_CONNECTION),
    );
    await dataSource.destroy();
    await app.close().catch(() => undefined);
  });

  it('/health (GET) reports the app DB as connected', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res) => {
        const body = res.body as {
          status: string;
          appDb: { connected: boolean };
        };
        expect(body.status).toBe('ok');
        expect(body.appDb.connected).toBe(true);
      });
  });

  it('/auth/login (POST) rejects invalid credentials', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'nobody@example.com', password: 'wrong-password' })
      .expect(401);
  });
});
