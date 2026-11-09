import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

/** Limite les tentatives de connexion/inscription par IP (anti force brute). Désactivé en test. */
export const limiteurAuth = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => env.isTest,
  message: { erreur: 'Trop de tentatives, réessayez dans quelques minutes.' },
});
