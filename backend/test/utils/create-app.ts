import { INestApplication } from '@nestjs/common';
import { TestingModuleBuilder } from '@nestjs/testing';
import { configureApp } from '../../src/bootstrap';

export { configureApp } from '../../src/bootstrap';

export async function createApp(
  builder: TestingModuleBuilder,
): Promise<INestApplication> {
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication({ rawBody: true });
  configureApp(app);
  await app.init();
  return app;
}
