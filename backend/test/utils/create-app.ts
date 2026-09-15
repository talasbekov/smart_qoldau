import { INestApplication } from '@nestjs/common';
import { TestingModuleBuilder } from '@nestjs/testing';
import { configureApp } from '../../src/bootstrap';

export { configureApp } from '../../src/bootstrap';

export async function createApp(
  builder: TestingModuleBuilder,
): Promise<INestApplication> {
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication({ rawBody: true });
  try {
    configureApp(app);
    await app.init();
    return app;
  } catch (bootstrapError) {
    try {
      await app.close();
    } catch (cleanupError) {
      try {
        if (
          bootstrapError !== null &&
          (typeof bootstrapError === 'object' ||
            typeof bootstrapError === 'function')
        ) {
          Object.defineProperty(bootstrapError, 'cleanupError', {
            value: cleanupError,
            configurable: true,
          });
        }
      } catch {
        // Diagnostic attachment is best-effort; preserve the bootstrap error.
      }
    }
    throw bootstrapError;
  }
}
