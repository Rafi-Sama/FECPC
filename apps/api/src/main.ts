import 'reflect-metadata';
import { Logger } from 'nestjs-pino';
import { createApp } from './server.ts';
import { ConfigService } from './platform/config/config.service.ts';

async function bootstrap() {
  const app = await createApp();
  const config = app.get(ConfigService);
  const logger = app.get(Logger);
  const port = config.env.PORT;
  const host = config.env.HOST;

  await app.listen(port, host);
  logger.log(`FECPC API successfully listening on http://${host}:${port}/v1`);
}

bootstrap().catch((err) => {
  console.error('Fatal error during bootstrap:', err);
  process.exit(1);
});
