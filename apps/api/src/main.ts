import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { loadApiEnv } from '@layo/config';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const env = loadApiEnv();

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: env.CORS_ORIGINS,
    credentials: true,
  });
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.listen(env.PORT);
  // eslint-disable-next-line no-console
  console.log(`Layo API listening on http://localhost:${env.PORT}/api/v1`);
}

bootstrap();
