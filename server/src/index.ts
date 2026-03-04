import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyMultipart from '@fastify/multipart';
import { jobRoutes } from './routes/jobs';
import { syncRoutes } from './routes/sync';
import { profileRoutes } from './routes/profile';
import { applyRoutes } from './routes/apply';

const fastify = Fastify({ logger: true });

async function start() {
  await fastify.register(fastifyCors, { origin: true });
  await fastify.register(fastifyMultipart, { limits: { fileSize: 20 * 1024 * 1024 } });
  await fastify.register(jobRoutes, { prefix: '/api' });
  await fastify.register(syncRoutes, { prefix: '/api' });
  await fastify.register(profileRoutes, { prefix: '/api' });
  await fastify.register(applyRoutes, { prefix: '/api' });

  fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  try {
    await fastify.listen({ port: 3001, host: '0.0.0.0' });
    console.log('\n  API server running at http://localhost:3001\n');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
