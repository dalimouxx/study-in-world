import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import type { Env } from './config/env';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const isProd = config.get('NODE_ENV', { infer: true }) === 'production';

  app.set('trust proxy', 1); // derrière Nginx : IP réelle pour le rate limiting et les journaux
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: [config.get('FRONTEND_URL', { infer: true })],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  if (!isProd || config.get('SWAGGER_ENABLED', { infer: true })) {
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('Study in World API').setVersion('0.1').addBearerAuth().build(),
    );
    SwaggerModule.setup('api/docs', app, doc);
  }

  const port = config.get('PORT', { infer: true });
  await app.listen(port);
  new Logger('Bootstrap').log(`API prête sur http://localhost:${port}/api`);
}

void bootstrap();
