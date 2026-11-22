import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.enableShutdownHooks();
  const port = Number(process.env.PORT ?? 3005);
  await app.listen(port, '0.0.0.0');
  console.log(JSON.stringify({ level: 'info', service: 'inventory-service', msg: `listening on ${port}` }));
}
bootstrap();
