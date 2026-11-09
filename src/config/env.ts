import 'dotenv/config';

/** Configuration centralisée, lue une seule fois depuis les variables d'environnement. */
const nodeEnv = process.env.NODE_ENV ?? 'development';

const sessionSecret = process.env.SESSION_SECRET ?? '';
if (nodeEnv === 'production' && sessionSecret.length < 32) {
  throw new Error('SESSION_SECRET doit contenir au moins 32 caractères en production');
}

export const env = {
  nodeEnv,
  isProd: nodeEnv === 'production',
  isTest: nodeEnv === 'test',
  port: Number(process.env.PORT ?? 3000),
  mongoUri: process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/vie-associative',
  sessionSecret: sessionSecret || 'secret-de-developpement-a-ne-pas-utiliser-en-production',
};
