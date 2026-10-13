/**
 * Test de fumée sans base de données : vérifie le câblage (DI, guards globaux, validation, préfixe /api).
 * Les tests d'intégration avec PostgreSQL réel viendront avec les modules métier (finance, isolation tenant).
 */
import './setup-env';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('API (smoke, sans base)', () => {
  let app: INestApplication;
  const prismaMock = {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    organization: {
      findFirst: jest.fn().mockResolvedValue({ id: 'o1', name: 'Study in World', settings: null }),
    },
    user: { findFirst: jest.fn().mockResolvedValue(null) },
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(() => app.close());

  it('GET /api/health => 200', async () => {
    await request(app.getHttpServer()).get('/api/health').expect(200, { status: 'ok' });
  });

  it('GET /api/public/agency est public', async () => {
    const res = await request(app.getHttpServer()).get('/api/public/agency').expect(200);
    expect(res.body.name).toBe('Study in World');
    expect(res.body).not.toHaveProperty('bankDetails');
    expect(res.body).not.toHaveProperty('taxId');
  });

  it.each(['/api/employees', '/api/roles', '/api/branches', '/api/settings/agency', '/api/audit/activity', '/api/auth/me'])(
    'GET %s sans jeton => 401',
    async (path) => {
      await request(app.getHttpServer()).get(path).expect(401);
    },
  );

  it('un jeton invalide => 401', async () => {
    await request(app.getHttpServer()).get('/api/employees').set('Authorization', 'Bearer nope').expect(401);
  });

  it('POST /api/auth/login valide le corps (400)', async () => {
    await request(app.getHttpServer()).post('/api/auth/login').send({ email: 'pas-un-email' }).expect(400);
    await request(app.getHttpServer()).post('/api/auth/login').send({ email: 'a@b.tn', password: 'x', extra: 1 }).expect(400);
  });

  it('POST /api/auth/refresh sans cookie => 401', async () => {
    await request(app.getHttpServer()).post('/api/auth/refresh').send({}).expect(401);
  });
});
